#!/usr/bin/env python3
"""
validate-hero-value-vs-history.py — règle desk_block_rules.hero_kpi #1
(Yann 31 mai 2026) : "le chiffre principal de la page doit toujours
correspondre au plus récent du graph juste à droite".

Scan tous les v2-pipeline/<ticker>.json. Pour chaque sté :
  - Identifie hero_kpi
  - Compare kpis[hero].value vs history[last_non_null]
  - Si écart > 1% → flag + auto-correct (value := history[last])

Output :
  - /tmp/hero-value-mismatch-report.json (liste détaillée)
  - Patches in-place sur src/data/v2-pipeline/<ticker>.json si --apply
  - Sinon dry-run (juste rapport)

Usage :
  python3 scripts/validate-hero-value-vs-history.py           # dry-run
  python3 scripts/validate-hero-value-vs-history.py --apply    # patche réellement
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PIPELINE_DIR = ROOT / "src/data/v2-pipeline"
REPORT = Path("/tmp/hero-value-mismatch-report.json")

def last_non_null(history):
    if not isinstance(history, list):
        return None
    for v in reversed(history):
        if isinstance(v, (int, float)) and v == v:  # skip NaN
            return v
    return None

def main():
    apply = "--apply" in sys.argv
    files = sorted(PIPELINE_DIR.glob("*.json"))
    mismatches = []
    auto_fixed = []
    skipped = 0

    for f in files:
        if f.name in {"_merged.json", "_index.json"}:
            continue
        try:
            d = json.loads(f.read_text())
        except Exception:
            skipped += 1
            continue
        if not isinstance(d, dict):
            skipped += 1
            continue

        hero_short = d.get("hero_kpi")
        if not hero_short:
            skipped += 1
            continue
        kpis = d.get("kpis", [])
        hero = next((k for k in kpis if isinstance(k, dict) and k.get("short") == hero_short), None)
        if not hero:
            skipped += 1
            continue

        value = hero.get("value")
        history = hero.get("history")
        last = last_non_null(history)

        if not isinstance(value, (int, float)) or last is None:
            continue

        # Anti-zero division
        denom = max(abs(value), abs(last), 1e-9)
        diff_pct = abs(value - last) / denom * 100

        # Filtre faux positifs unit mismatch : value en Mds/M et history en raw.
        # Si value × 1e9 ≈ last OU value × 1e6 ≈ last → c'est juste un scale issue,
        # pas un vrai bug. On skip.
        for factor in (1e9, 1e6, 1e3, 1e-9, 1e-6, 1e-3):
            scaled = value * factor
            ds = max(abs(scaled), abs(last), 1e-9)
            if abs(scaled - last) / ds * 100 < 5.0:
                diff_pct = -1  # tag as false positive
                break

        if diff_pct > 1.0:
            mismatches.append({
                "ticker": d.get("ticker", f.stem),
                "hero": hero_short,
                "value": value,
                "history_last": last,
                "diff_pct": round(diff_pct, 2),
                "history_len": len(history) if isinstance(history, list) else 0,
            })
            if apply:
                hero["value"] = last
                f.write_text(json.dumps(d, ensure_ascii=False, indent=2))
                auto_fixed.append(d.get("ticker", f.stem))

    report = {
        "scanned": len(files),
        "skipped": skipped,
        "mismatch_count": len(mismatches),
        "auto_fixed": len(auto_fixed),
        "applied": apply,
        "mismatches": sorted(mismatches, key=lambda r: -r["diff_pct"])[:50],
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"scanned={len(files)} skipped={skipped} mismatch={len(mismatches)} auto_fixed={len(auto_fixed)} applied={apply}")
    print(f"Report : {REPORT}")
    if mismatches:
        print("Top 5 worst:")
        for m in report["mismatches"][:5]:
            print(f"  {m['ticker']:8s} {m['hero']:30s} value={m['value']} last={m['history_last']} ({m['diff_pct']}%)")

if __name__ == "__main__":
    main()
