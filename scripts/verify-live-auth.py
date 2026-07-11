#!/usr/bin/env python3
"""Compare chaque page live N2 aux fingerprints du loader local :
hero_kpi identique + scores de risques identiques + dernière valeur du hero
présente dans le payload. Si égal, la page sert exactement la data validée
par l'audit loader complet (mêmes code + data)."""
import json, os, re, subprocess
from concurrent.futures import ThreadPoolExecutor
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOK = [l.split("=",1)[1].strip() for l in open(f"{ROOT}/.env.local") if l.startswith("VISUAL_AUDIT_TOKEN=")][0]
FP = json.load(open(f"{ROOT}/.conv-state/fingerprints-local.json"))
BASE = "https://mettrik-niveau2.vercel.app/sandbox/v1-9-5"
def unesc(h): return h.replace('\\\\"','\x01').replace('\\"','"').replace('\x01','\\"')
def close(a,b):
    try: return abs(float(a)-float(b)) <= max(abs(float(a)),abs(float(b)))*0.001+1e-9
    except: return False
COOKIE=open("/tmp/mettrik_cookie.txt").read().strip()
def check(item):
    t, fp = item
    if "error" in fp: return (t, [f"fingerprint local: {fp['error']}"])
    r = subprocess.run(["curl","-sL","--max-time","90","-H",f"Cookie: {COOKIE}",f"{BASE}/{t}"],capture_output=True,text=True)
    h = r.stdout
    if len(h) < 100000: return (t,[f"page courte ({len(h)}c)"])
    x = unesc(h)
    errs=[]
    heros = re.findall(r'"hero_kpi":"([^"]+)"', x)
    if not heros or heros[0].strip().lower() != str(fp["hero"]).strip().lower():
        errs.append(f"hero live={heros[:1]} vs local={fp['hero']}")
    live_scores = [int(s) for s in re.findall(r'"score":(\d)[,}]', x) if s in "12345"]
    if sorted(live_scores[:len(fp["scores"])]) != sorted(fp["scores"]):
        # tolérance : les scores locaux doivent être un sous-ensemble ordonné du live
        if sorted(fp["scores"]) != sorted(live_scores[:len(fp["scores"])]):
            errs.append(f"scores live={live_scores[:8]} vs local={fp['scores']}")
    if fp.get("heroLast") is not None:
        # la dernière valeur du hero doit apparaître dans le payload
        v = fp["heroLast"]
        pat = re.escape(f"{v}") if isinstance(v,int) else None
        found = False
        for cand in ({f"{v}", f"{v:.1f}".rstrip('0').rstrip('.'), f"{v:.2f}".rstrip('0').rstrip('.')} if isinstance(v,(int,float)) else set()):
            if cand and cand in x: found=True; break
        if not found: errs.append(f"heroLast {v} absent du payload")
    return (t, errs)
def main():
    report={}
    done=0
    with ThreadPoolExecutor(max_workers=8) as ex:
        for t,errs in ex.map(check, list(FP.items())):
            if errs: report[t]=errs
            done+=1
            if done%50==0: print(f"...{done}/{len(FP)} ({len(report)} mismatch)",flush=True)
    open(f"{ROOT}/.conv-state/verify-live-fp-report.json","w").write(json.dumps({"checked":len(FP),"mismatch":len(report),"report":report},ensure_ascii=False,indent=1))
    print(json.dumps({"checked":len(FP),"mismatch":len(report)},indent=1))
    for t,e in list(report.items())[:30]: print(f"  {t}: {e}")
main()
