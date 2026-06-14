#!/usr/bin/env python3
"""Ingest data-lake kpis_wow + stories -> src/data/v2-pipeline-enrich/<t>.json.
Clean-replace: retire d'abord les anciens KPI wow (is_wow + _source 'ER...') et
stories ingerees (_source 'ER...') de TOUS les enrich, puis re-ajoute depuis le
data-lake courant (la donnee recente prime, pas de contamination stale)."""
import json, os, glob, re

DL = "data-lake"; ENR = "src/data/v2-pipeline-enrich"

GEN = ["net income", "benefice net", " eps", "ebitda", "free cash flow", "fcf",
       "operating margin", "gross margin", "marge brute", "marge operationnelle",
       "capex", "headcount", "payout", "total revenue", "adj eps", "adjusted eps"]
def is_generic(sh):
    s = " " + sh.lower() + " "
    return any(g in s for g in GEN)

def yoy_str(hist):
    prev = None
    if len(hist) >= 5 and hist[-5]: prev = hist[-5]
    elif len(hist) >= 2 and hist[-2]: prev = hist[-2]
    if not prev: return None
    v = round((hist[-1] - prev) / abs(prev) * 100, 1)
    return ("+" if v >= 0 else "") + str(v).replace(".", ",") + "%"

def load(p):
    try: return json.load(open(p))
    except Exception: return None

# Phase 0 : nettoyage des anciens wow/stories ingeres dans TOUS les enrich
cleaned = 0
for enrf in glob.glob(f"{ENR}/*.json"):
    if enrf.endswith(".tam.json"): continue
    enr = load(enrf)
    if not isinstance(enr, dict): continue
    ch = False
    kp = enr.get("kpis")
    if isinstance(kp, list):
        nk = [k for k in kp if not (isinstance(k, dict) and k.get("is_wow") and str(k.get("_source", "")).startswith("ER"))]
        if len(nk) != len(kp): enr["kpis"] = nk; ch = True
    stk = enr.get("stories_kpis")
    if isinstance(stk, list):
        ns = [s for s in stk if not (isinstance(s, dict) and str(s.get("_source", "")).startswith("ER"))]
        if len(ns) != len(stk): enr["stories_kpis"] = ns; ch = True
    if ch:
        json.dump(enr, open(enrf, "w"), ensure_ascii=False, indent=2); cleaned += 1

# Phase 1 : ingest kpis_wow
kw = st = 0
for f in glob.glob(f"{DL}/*/kpis_wow/extracted.json"):
    t = f.split("/")[1]; enrf = f"{ENR}/{t}.json"
    d = load(f)
    if not d or not d.get("kpis"): continue
    enr = load(enrf) or {"ticker": t.upper()}
    if any(isinstance(k, dict) and k.get("is_wow") and not str(k.get("_source", "")).startswith("ER") for k in enr.get("kpis", [])):
        continue  # le pipeline couvre deja cette ste en wow -> eviter la duplication
    src = d.get("source", "ER (extrait)")
    seen = {k.get("short") for k in enr.get("kpis", [])}
    add = []
    for k in d["kpis"]:
        sh = (k.get("short") or "").strip()
        if not sh or sh in seen or "_" in sh or is_generic(sh): continue
        per = sorted([p for p in k.get("periods", []) if isinstance(p.get("value"), (int, float))], key=lambda p: p.get("period_end", ""))
        if not per: continue
        hist = [p["value"] for p in per]
        unit = (k.get("unit") or "").strip()
        if hist[-1] == 0: continue
        if abs(hist[-1]) > 999:
            if re.match(r"^(M\b|M\s*\$|M USD|M GBP|M EUR|million)", unit, re.I):
                hist = [round(h / 1000, 2) for h in hist]
                unit = "Mds " + (re.sub(r"^(M\s*|million\s*)", "", unit, flags=re.I).strip() or "$")
            else:
                continue
        add.append({"short": sh, "name_fr": k.get("name_fr", sh), "name_en": k.get("name_en", sh),
                    "value": hist[-1], "unit": unit, "yoy": yoy_str(hist), "type": "Spécifique",
                    "is_wow": True, "period_type": k.get("period_type", "quarter"), "history": hist,
                    "explanation": (per[-1].get("quote") or "")[:200], "_source": src})
        seen.add(sh)
    if add:
        enr.setdefault("kpis", []).extend(add)
        json.dump(enr, open(enrf, "w"), ensure_ascii=False, indent=2); kw += 1

# Phase 2 : ingest stories
for f in glob.glob(f"{DL}/*/stories/extracted.json"):
    t = f.split("/")[1]; enrf = f"{ENR}/{t}.json"
    d = load(f)
    if not d or not d.get("stories"): continue
    enr = load(enrf) or {"ticker": t.upper()}
    seen = {s.get("short") for s in enr.get("stories_kpis", [])}
    add = []
    for s in d["stories"]:
        sh = s.get("short")
        if not sh or sh in seen: continue
        add.append({"short": sh, "name_fr": sh, "story_fr": s.get("story_fr", ""), "story_en": s.get("story_en", ""),
                    "signal": s.get("signal", ""), "category": s.get("category", "Marché"), "is_short_history": True, "_source": "ER/ES"})
        seen.add(sh)
    if add:
        enr.setdefault("stories_kpis", []).extend(add)
        json.dump(enr, open(enrf, "w"), ensure_ascii=False, indent=2); st += 1

print(f"clean={cleaned} | kpis_wow -> {kw} enrich · stories -> {st} enrich")
