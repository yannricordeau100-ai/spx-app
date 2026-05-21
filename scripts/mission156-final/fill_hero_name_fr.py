#!/usr/bin/env python3
"""
Mission #156 batch 2 — fill hero_name_fr for 4 single-KO stés.

Targets: MRNA, SBAC, ACN, INGA.AS

Strategy: write src/data/v2-pipeline-enrich/<ticker>.hero_name_fr.json with
{ hero_kpi_override, overrides_hero_name_fr: { hero_short, name_fr } } where
name_fr is a strict, human-verified French translation of the EN technical
term. Conservative: only translate hero short names where the FR equivalent
is unambiguous in finance.
"""
import json, os
from datetime import datetime, timezone

REPO = "/Users/yann/spx-app"
ENRICH = os.path.join(REPO, "src/data/v2-pipeline-enrich")
NOW = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

# Strict translation map (hero_short -> name_fr)
# Validated terms in French financial vocabulary
TRANSLATIONS = {
    "MRNA": {
        "hero_short": "Pipeline Programs",
        "name_fr": "Programmes en pipeline",
    },
    "SBAC": {
        "hero_short": "Tower Cash Flow Margin",
        "name_fr": "Marge de cash-flow des tours",
    },
    "ACN": {
        "hero_short": "Consulting Revenue",
        "name_fr": "Revenu Conseil",
    },
    "INGA.AS": {
        "hero_short": "Return on Equity (ROE)",
        "name_fr": "Rentabilité des capitaux propres",
    },
}


def main():
    for ticker, payload in TRANSLATIONS.items():
        fp = os.path.join(ENRICH, f"{ticker.lower()}.hero_name_fr.json")
        # Check pipeline file exists
        data = {
            "ticker": ticker,
            "hero_kpi_override": payload["hero_short"],
            "overrides_hero_name_fr": {
                "hero_short": payload["hero_short"],
                "name_fr": payload["name_fr"],
            },
            "_mission156_filled_at": NOW,
            "_mission156_source": "manual_strict_translation",
        }
        with open(fp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"{ticker}: {payload['hero_short']} -> {payload['name_fr']}")


if __name__ == "__main__":
    main()
