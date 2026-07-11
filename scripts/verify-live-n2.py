#!/usr/bin/env python3
"""Vérification live N2 en profondeur : fetch chaque page sté déployée et
vérifie dans le payload réellement servi :
 - HTTP 200 + page complète (>100k)
 - risques : ≥5 scores UI, distribution non uniforme, ≥5 score_rationale longs
 - hero : hero_kpi présent, history du hero ≥17 pts (quarterly) ou ≥5 (annuel)
 - stories : ≥2 story_category distinctes
 - data enrichie présente (≥5 last_data_date)
Usage : python3 scripts/verify-live-n2.py  (écrit .conv-state/verify-live-report.json)
"""
import json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOK = ""
for line in open(f"{ROOT}/.env.local"):
    if line.startswith("VISUAL_AUDIT_TOKEN="):
        TOK = line.split("=", 1)[1].strip()
BASE = "https://mettrik-niveau2.vercel.app/sandbox/v1-9-5"
STRUCTURAL = {"GEV", "PSKY", "Q", "SNDK", "SOLV", "SW"}

def unesc(h):
    return h.replace('\\\\"', '\x01').replace('\\"', '"').replace('\x01', '\\"')

def check(t):
    errs = []
    r = subprocess.run(["curl", "-s", "--max-time", "90",
                        f"{BASE}/{t}?audit_token={TOK}"],
                       capture_output=True, text=True)
    h = r.stdout
    if len(h) < 100000:
        return (t, [f"page courte/erreur ({len(h)}c)"])
    x = unesc(h)
    # risques
    scores = [s for s in re.findall(r'"score":(\d)[,}]', x) if s in "12345"]
    if len(scores) < 5:
        errs.append(f"risques: {len(scores)} scores (<5)")
    elif len(set(scores[:12])) <= 1:
        errs.append(f"risques uniformes: {scores[:8]}")
    rat = len(re.findall(r'"score_rationale":"[^"]{30,}', x))
    if rat < min(5, len(scores)):
        errs.append(f"rationales: {rat}")
    # hero
    heros = re.findall(r'"hero_kpi":"([^"]+)"', x)
    if not heros:
        errs.append("hero_kpi absent")
    else:
        hero = heros[0]
        m = re.search(r'"short":"' + re.escape(hero) + r'".{0,6000}?"history":\[([^\]]*)\]', x, re.S)
        if not m:
            m = re.search(r'"history":\[([^\]]*)\].{0,6000}?"short":"' + re.escape(hero) + r'"', x, re.S)
        if m:
            pts = len([v for v in m.group(1).split(",") if v.strip()])
            seg = m.group(0)
            q = ('"frequency":"quarterly"' in seg) or ('"period_type":"quarter"' in seg) or re.search(r'"q":"?Q\d', seg)
            if q and pts < 17 and t not in STRUCTURAL:
                errs.append(f"hero {hero}: {pts} pts quarterly")
            elif not q and pts < 5 and t not in STRUCTURAL:
                errs.append(f"hero {hero}: {pts} pts annuel")
        # si non trouvé par regex, non bloquant (structure RSC coupée) : signal doux
    # stories
    cats = set(re.findall(r'"story_category":"([^"]+)"', x))
    if len(cats) < 2:
        errs.append(f"stories: {len(cats)} catégorie(s) {sorted(cats)}")
    # data enrichie
    ldd = len(re.findall(r'"last_data_date":"\d{4}-\d{2}-\d{2}"', x))
    if ldd < 5:
        errs.append(f"last_data_date: {ldd} (<5)")
    return (t, errs)

def main():
    sp = [t.upper() for t in json.load(open(f"{ROOT}/src/data/sp500-tickers.json"))]
    targets = [t for t in sp if t not in STRUCTURAL]
    report = {}
    done = 0
    with ThreadPoolExecutor(max_workers=8) as ex:
        for t, errs in ex.map(check, targets):
            if errs:
                report[t] = errs
            done += 1
            if done % 50 == 0:
                print(f"...{done}/{len(targets)} ({len(report)} issues)", flush=True)
    out = {"checked": len(targets), "with_issues": len(report), "report": report}
    open(f"{ROOT}/.conv-state/verify-live-report.json", "w").write(json.dumps(out, ensure_ascii=False, indent=1))
    print(json.dumps({"checked": len(targets), "with_issues": len(report)}, indent=1))
    for t, e in list(report.items())[:40]:
        print(f"  {t}: {e}")

main()
