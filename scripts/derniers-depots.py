#!/usr/bin/env python3
"""Index des derniers depots de resultats par societe, lu dans les noms de fichiers du data-lake (Yann, 3 oct 2026).

Sert a remplacer au chargement des fiches un latest_filing perime (FMP n est plus rafraichi). Aucune valeur
inventee : seule la date du dernier 10-Q / 10-K / 20-F (ou communique / rapport semestriel / rapport annuel
pour les societes europeennes) est retenue. Sortie : src/data/derniers-depots.json {TICKER: "AAAA-MM-JJ"}.
"""
import datetime, glob, json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
univ = json.load(open(os.path.join(ROOT, "src/data/v1-9-5-clean-all-tickers.json")))["tickers"]
auj = datetime.date.today().isoformat()
out = {}
for t in univ:
    dl = os.path.join(ROOT, "data-lake", t)
    dates = []
    for f in glob.glob(f"{dl}/10Q/*") + glob.glob(f"{dl}/10K/*") + glob.glob(f"{dl}/20F/*") + glob.glob(f"{dl}/ir/*/*"):
        b = os.path.basename(f)
        if "/ir/" in f and not re.search(r"CP_|COMMUNIQUE|RFS|URD", b):
            continue
        m = re.search(r"(20\d\d-\d\d-\d\d)", b)
        if m and m.group(1) <= auj:
            dates.append(m.group(1))
    if dates:
        out[t.upper()] = max(dates)
json.dump(out, open(os.path.join(ROOT, "src/data/derniers-depots.json"), "w"), ensure_ascii=False, indent=0, sort_keys=True)
print(len(out), "societes")
