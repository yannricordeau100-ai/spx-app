#!/usr/bin/env python3
"""Recale last_data_date de chaque série trimestrielle US sur la clôture
réelle de son dernier point (calendrier fiscal + convention calibrée).

Yann 8 août 2026, cas V : last_data_date restait à 2025-12-31 alors que le
dernier point était Q2-FY2026 (clos 2026-03-31). Conséquences visibles :
axe X décalé d'un trimestre (les labels sont reconstruits depuis
last_data_date) et badge de fraîcheur faux.

Ne traite QUE les stés dont la convention de label est calibrable sur le
dernier filing (à jour au sens de kpi-lag-detect). Les stés en retard sont
traitées par les agents de refresh qui posent last_data_date eux-mêmes.
"""
import json, glob, os, sys, datetime, importlib.util

spec = importlib.util.spec_from_file_location(
    "lag", os.path.join(os.path.dirname(__file__), "kpi-lag-detect.py"))
lag = importlib.util.module_from_spec(spec)
spec.loader.exec_module.__self__ if False else spec.loader.exec_module(lag)

ROOT = lag.ROOT
KPIS = lag.KPIS

def main():
    audit = json.load(open(os.path.join(ROOT, "src/data/fiscal-audit.json")))
    lagging = set(json.load(open(os.path.join(ROOT, ".conv-state/lag-scan.json"))))
    changed_files = 0
    changed_series = 0
    for f in sorted(glob.glob(f"{KPIS}/*.json")):
        t = os.path.basename(f)[:-5]
        if "." in t or t in lagging:
            continue
        nf = lag.newest_filing(t)
        best = lag.last_label_of_file(f)
        if not nf or not best:
            continue
        fdate, form, fpath = nf
        fy, q, label = best
        fye = lag.fiscal_year_end_month(t, audit)
        c1 = lag.close_of_label(q, fy, fye)
        c2 = lag.close_of_label(q, fy + 1, fye)
        txt = lag.read_head_text(fpath)
        pm = lag.PERIOD_RE.search(txt) or lag.FYE_RE.search(txt)
        if not (pm and pm.group(1).lower() in lag.MONTHS):
            continue
        pend = datetime.date(int(pm.group(3)),
                             lag.MONTHS[pm.group(1).lower()], int(pm.group(2)))
        d1, d2 = abs((pend - c1).days), abs((pend - c2).days)
        if min(d1, d2) > 40:
            continue  # pas calibrable, ne pas toucher
        fy_offset = 1 if d2 < d1 else 0
        try:
            data = json.load(open(f))
        except Exception:
            continue
        kpis = data.get("kpis") if isinstance(data, dict) else data
        if not isinstance(kpis, list):
            continue
        touched = False
        for k in kpis:
            if not isinstance(k, dict):
                continue
            h = k.get("history")
            if not (isinstance(h, list) and h and isinstance(h[-1], dict)):
                continue
            m = lag.QLAB.match(str(h[-1].get("q", "")).strip())
            if not m:
                continue
            close = lag.close_of_label(int(m.group(1)),
                                       int(m.group(2)) + fy_offset, fye)
            # la vraie clôture (52/53 sem.) peut différer de qq jours : si le
            # dernier point est CELUI du dernier filing, prendre pend exact.
            if abs((close - pend).days) <= 40:
                close = pend
            iso = close.isoformat()
            if k.get("last_data_date") != iso:
                k["last_data_date"] = iso
                touched = True
                changed_series += 1
        if touched:
            json.dump(data, open(f, "w"), ensure_ascii=False, indent=1)
            changed_files += 1
    print(f"files={changed_files} series={changed_series}", file=sys.stderr)

if __name__ == "__main__":
    main()
