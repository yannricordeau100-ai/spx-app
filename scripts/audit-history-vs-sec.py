#!/usr/bin/env python3
"""
audit-history-vs-sec.py — détecte les KPIs dont l'history contient un
point au-delà de la dernière période fiscale publiée par la sté (selon
SEC EDGAR latest_filing.period_end).

Cas problématique typique :
- KPI period_type=quarter, last_data_date=2026-03-31 (Q1 2026)
- history a 10 points → le code labels génère T2 25 → T1 26 → T2 26
  alors que Q2 2026 n'est PAS publié (en cours ou pas encore filé)
- Le graph affiche un point T2 2026 fantôme.

Le fix : tronquer history pour qu'elle s'arrête à la période vraiment
publiée. Si l'inverse (history < SEC = sté en retard), on n'ajoute pas
de fake point — on flag pour ré-extraction par CONV-DATA.

Output : `src/data/v2-history-audit.json` avec liste des KPIs à tronquer
+ liste des stés en retard.

Mode --apply : applique les troncatures dans v2-pipeline/<t>.json
(idempotent, ne rajoute jamais de data).

Usage :
  python3 scripts/audit-history-vs-sec.py             # dry-run
  python3 scripts/audit-history-vs-sec.py --apply     # tronque vraiment
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PIPELINE = ROOT / "src/data/v2-pipeline"
ENR_DIR = ROOT / "src/data/v2-pipeline-enrich"
V18 = ROOT / "src/data/v1-8-tickers-sorted.json"
OUT = ROOT / "src/data/v2-history-audit.json"


def quarter_of(iso: str) -> tuple[int, int] | None:
    try:
        d = datetime.fromisoformat(iso)
        return d.year, (d.month - 1) // 3 + 1
    except Exception:
        return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--top", type=int, default=307)
    args = ap.parse_args()

    tickers = json.loads(V18.read_text())[: args.top]
    truncated = []  # KPIs où history dépasse la SEC publication
    behind = []    # stés où SEC publié plus récent que ce qu'on a en local
    missing_sec = []
    truncations_done = 0

    for t in tickers:
        pp = PIPELINE / f"{t.lower()}.json"
        if not pp.exists():
            continue
        try:
            data = json.loads(pp.read_text())
        except Exception:
            continue

        # Lire latest_filing depuis l'enrich
        ep = ENR_DIR / f"{t.lower()}.json"
        sec_period = None
        if ep.exists():
            try:
                e = json.loads(ep.read_text())
                lf = e.get("latest_filing")
                if isinstance(lf, dict):
                    sec_period = lf.get("period_end")
            except Exception:
                pass

        if not sec_period:
            missing_sec.append(t)
            continue

        sec_q = quarter_of(sec_period)
        if not sec_q:
            continue
        sec_year, sec_quarter = sec_q

        kpis = data.get("kpis") or []
        if not isinstance(kpis, list):
            continue

        modified = False
        for k in kpis:
            if not isinstance(k, dict):
                continue
            ldd = k.get("last_data_date")
            hist = k.get("history") or []
            if not ldd or not hist:
                continue
            local_q = quarter_of(ldd)
            if not local_q:
                continue
            local_year, local_quarter = local_q
            pt = k.get("period_type")

            # CAS 1 : KPI quarter et local DÉPASSE SEC → tronquer
            if pt == "quarter" and (local_year, local_quarter) > (sec_year, sec_quarter):
                # Combien de trimestres en trop ?
                excess_q = (local_year - sec_year) * 4 + (local_quarter - sec_quarter)
                if excess_q > 0 and excess_q < len(hist):
                    new_hist = hist[:-excess_q]
                    # Recalcule last_data_date pour matcher le dernier trimestre publié (sec)
                    new_ldd = sec_period
                    truncated.append(
                        {
                            "ticker": t,
                            "kpi_short": k.get("short"),
                            "old_history_len": len(hist),
                            "new_history_len": len(new_hist),
                            "old_last_data_date": ldd,
                            "new_last_data_date": new_ldd,
                            "excess_quarters": excess_q,
                            "sec_period_end": sec_period,
                        }
                    )
                    if args.apply:
                        k["history"] = new_hist
                        k["last_data_date"] = new_ldd
                        modified = True
                        truncations_done += 1

            # CAS 2 : KPI annuel et local > SEC reportDate (rare, on flag)
            elif pt in (None, "year") and (local_year, local_quarter) > (sec_year, sec_quarter):
                # Si on est en année courante et SEC dit l'an dernier, on a peut-être un fake.
                # Mais ces cas sont sensibles (year-end != filing date), on log seulement.
                pass

            # CAS 3 : SEC plus récent que local → sté en retard côté local
            elif (sec_year, sec_quarter) > (local_year, local_quarter):
                behind.append(
                    {
                        "ticker": t,
                        "kpi_short": k.get("short"),
                        "local_last_data_date": ldd,
                        "sec_period_end": sec_period,
                        "period_type": pt,
                    }
                )

        if modified and args.apply:
            pp.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    OUT.write_text(
        json.dumps(
            {
                "generated_at": datetime.now().isoformat(),
                "tickers_checked": len(tickers),
                "kpis_truncated_count": len(truncated),
                "kpis_truncated": truncated,
                "behind_count": len(behind),
                "behind": behind[:200],  # cap pour lisibilité
                "missing_sec_count": len(missing_sec),
                "missing_sec": missing_sec[:50],
                "applied": args.apply,
                "truncations_done": truncations_done,
            },
            indent=2,
            ensure_ascii=False,
        )
    )

    print(
        f"\n📊 {len(tickers)} stés auditées\n"
        f"  ⚠ {len(truncated)} KPIs avec history qui DÉPASSE SEC publié → à tronquer"
        + (f" ({truncations_done} appliqués)" if args.apply else " (dry-run)")
        + f"\n"
        f"  🚨 {len(behind)} KPIs en retard (SEC > local) → ré-extraction CONV-DATA\n"
        f"  · {len(missing_sec)} stés sans latest_filing (FPI EU sans SEC)\n"
        f"\nDétail : {OUT.relative_to(ROOT)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
