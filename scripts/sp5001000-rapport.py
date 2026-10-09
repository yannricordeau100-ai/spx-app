#!/usr/bin/env python3
"""Mission sp5001000 : rapport d avancement (markdown) a partir de liste.json, existant.json,
etat.json et etat-transcripts.json. Usage : python3 scripts/sp5001000-rapport.py <sortie.md>"""
import json, os, sys, collections
from datetime import datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M = f"{ROOT}/data-lake/_sp5001000"
def lit(n):
    try: return json.load(open(f"{M}/{n}"))
    except Exception: return {}
L = lit("liste.json"); E = lit("existant.json"); S = lit("etat.json"); T = lit("etat-transcripts.json")
import glob as _g
for _p in sorted(_g.glob(f"{M}/etat-transcripts-*.json")):   # fils secondaires
    T.setdefault("societes", {}).update({k: v for k, v in lit(os.path.basename(_p)).get("societes", {}).items() if v.get("fini") or k not in T.get("societes", {})})
soc = L.get("societes", []); act = [r for r in soc if not r.get("radiee")]
ss = S.get("societes", {}); ts = T.get("societes", {})
fin = [t for t, v in ss.items() if v.get("fini")]
types = collections.Counter()
for v in ss.values():
    for k, n in v.get("n", {}).items(): types[k] += n
ex = E.get("totaux_copies", {})
err = [(t, e) for t, v in ss.items() for e in v.get("erreurs", [])]
s = os.statvfs(ROOT); libre = s.f_bavail * s.f_frsize / 1e9
o = []
o.append(f"# Mission sp5001000 : Russell 1000 hors univers Mettrik\n\nMis a jour le {datetime.now():%Y-%m-%d %H:%M}. Espace libre : {libre:.1f} Go.\n")
o.append("| Etape | Etat |\n|---|---|")
o.append(f"| 1. Liste | {len(soc)} societes hors univers ({len(act)} actives, {len(soc)-len(act)} radiees depuis le 30 juin) sur {L.get('n_societes_iwb')} societes du Russell 1000 (iShares IWB, N-PORT SEC au {L.get('date_liste')}) ; {L.get('n_deja_univers')} deja sur Mettrik |")
o.append(f"| 2. Existant | {E.get('n_societes_avec_existant', 0)} societes avec documents deja sur le Mac ; copies : " + ", ".join(f"{k} {v}" for k, v in sorted(ex.items())) + f" (total {sum(ex.values())}) |")
o.append(f"| 3. EDGAR | {len(fin)}/{len(act)} societes terminees ; {sum(types.values())} fichiers telecharges, {sum(v.get('octets',0) for v in ss.values())/1e9:.2f} Go ; {len(err)} erreurs ; {S.get('resume',{}).get('requetes_sec',0)} requetes  |")
_s = T.get("societes", {})
tr = {"n_finies": sum(1 for v in _s.values() if v.get("fini")), "transcripts": sum(v.get("n", 0) for v in _s.values()), "n_avec_transcripts": sum(1 for v in _s.values() if v.get("n", 0) > 0),
      "par_source": {k: sum(1 for v in _s.values() if v.get("fini") and v.get("source") == k) for k in ("stockanalysis", "marketbeat", None)}}
o.append(f"| 3. Transcripts | {tr.get('n_finies',0)}/{len(act)} societes traitees ; {tr.get('transcripts',0)} transcripts ; {tr.get('n_avec_transcripts',0)} societes avec au moins un ; sources {tr.get('par_source',{})} |")
o.append("\n## Documents telecharges par type (passe EDGAR)\n\n| Type | Fichiers |\n|---|---|")
for k, v in sorted(types.items()): o.append(f"| {k} | {v} |")
if err:
    o.append(f"\n## Erreurs ({len(err)})\n")
    for t, e in err[:40]: o.append(f"- {t} : {e}")
o.append("\n## Fichiers\n\n- data-lake/_sp5001000/liste.json, existant.json, etat.json, etat-transcripts.json, plan-integration.json\n- scripts : sp5001000-existant.py, sp5001000-telecharge.py, sp5001000-transcripts.py, sp5001000-rapport.py\n")
open(sys.argv[1], "w").write("\n".join(o) + "\n")
