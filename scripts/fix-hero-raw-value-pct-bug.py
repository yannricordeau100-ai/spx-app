#!/usr/bin/env python3
"""fix-hero-raw-value-pct-bug.py — Yann 18 mai 2026.

Bug détecté visuellement sur ASML : hero KPI value = 32 667 300 000 avec
unit = "%". Le LLM Pass 1/2/3 a confondu le nom d'un ratio (% du revenu)
avec la valeur du revenu sous-jacent. Résultat : "32 milliards de %"
affiché à l'utilisateur.

Scan : 63 stés avec value > 1e8 ET unit = "%" sur leur hero KPI.
Pattern : revenu raw en EUR/USD/CHF/etc + unit "%" erroné.

Fix :
  - rescale value/history /1e9 → Mds
  - unit "%" → "Mds $" (ou EUR/CHF/GBP/JPY selon ticker suffix)
  - tag _hero_value_rescaled = true (audit)
  - laisse name_fr/name_en intact (refactor risqué, juste l'unité change)

Ne touche PAS aux KPIs non-hero (autres value=ratio % légitimes).
"""
import json
import glob
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PIPELINE = ROOT / "src/data/v2-pipeline"

# Suffix ticker → currency unit
SUFFIX_UNIT = {
    ".PA": "Mds €", ".DE": "Mds €", ".AS": "Mds €", ".MC": "Mds €",
    ".MI": "Mds €", ".BR": "Mds €", ".LS": "Mds €", ".HE": "Mds €",
    ".VI": "Mds €", ".BV": "Mds €", ".PA": "Mds €",
    ".L": "Mds £",
    ".SW": "Mds CHF",
    ".ST": "Mds SEK", ".CO": "Mds DKK", ".OL": "Mds NOK",
    ".T": "Mds ¥", ".HK": "Mds HK$",
    ".TO": "Mds CAD",
}


def get_currency_unit(ticker: str) -> str:
    """Détermine l'unité par défaut selon le suffixe du ticker."""
    tu = ticker.upper()
    for suffix, unit in SUFFIX_UNIT.items():
        if tu.endswith(suffix):
            return unit
    return "Mds $"  # US par défaut


def fix_sté(p: Path) -> bool:
    """Applique le fix sur 1 sté. Returns True si modifié."""
    try:
        d = json.loads(p.read_text())
    except Exception:
        return False
    hero_short = d.get("hero_kpi")
    if not hero_short:
        return False
    kpis = d.get("kpis") or []
    hero = next((k for k in kpis if k.get("short") == hero_short), None)
    if not hero:
        return False
    value = hero.get("value")
    unit = (hero.get("unit") or "").strip()
    if not isinstance(value, (int, float)) or abs(value) <= 1e8:
        return False
    if unit != "%":
        return False
    # Rescale
    ticker = d.get("ticker") or p.stem.upper()
    new_unit = get_currency_unit(ticker)
    factor = 1e9
    hero["value"] = round(value / factor, 3)
    history = hero.get("history") or []
    if isinstance(history, list):
        hero["history"] = [
            round(h / factor, 3) if isinstance(h, (int, float)) and abs(h) > 1e5 else h
            for h in history
        ]
    hero["unit"] = new_unit
    hero["_hero_value_rescaled"] = {
        "fixed_at": "2026-05-18",
        "reason": "LLM mixed ratio name with raw revenue value (>1e8 + unit=%)",
        "old_unit": "%",
        "old_value": value,
        "factor": factor,
    }
    p.write_text(json.dumps(d, indent=2, ensure_ascii=False))
    return True


def main():
    fixed = 0
    for f in sorted(PIPELINE.glob("*.json")):
        if "merged" in f.name or f.name.startswith("_"):
            continue
        if fix_sté(f):
            fixed += 1
            print(f"  ✓ {f.stem.upper()}")
    print(f"\n✅ {fixed} stés fixées")


if __name__ == "__main__":
    main()
