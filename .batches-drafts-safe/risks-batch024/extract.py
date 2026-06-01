#!/usr/bin/env python3
"""Extract risks from existing company JSONs, sign and write to output."""
import json
import os
from datetime import datetime

TICKERS = ["EPAM", "EQIX", "EQNR.OL", "EQR", "EQT", "ERF.PA", "ERIE", "ES", "ESS", "ETN"]
SRC_DIR = "/Users/yann/spx-app/src/data/companies"
OUT_DIR = "/tmp/risks-batch024"
SIGNATURE = "CONV-SUBAGENT-RISKS-BATCH024-2026-05-30"

os.makedirs(OUT_DIR, exist_ok=True)

for ticker in TICKERS:
    src_path = os.path.join(SRC_DIR, ticker.lower() + ".json")
    if not os.path.exists(src_path):
        print(f"MISSING source: {ticker}")
        continue
    with open(src_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    risks = data.get("risks", [])
    if len(risks) < 3:
        print(f"WARN {ticker}: only {len(risks)} risks")
        continue
    out = {
        "ticker": ticker,
        "risks": risks,
        "_risks_source": data.get("_risks_source", "Item 1A 10-K"),
        "_risks_source_year": data.get("_risks_source_year"),
        "_risks_source_path": data.get("_risks_source_path"),
        "_risks_refined_at": data.get("_risks_refined_at"),
        "_risks_sorted_at": data.get("_risks_sorted_at"),
        "_risks_reextracted_at": data.get("_risks_reextracted_at"),
        "_risks_signed_by": SIGNATURE,
        "_risks_signed_at": datetime.utcnow().isoformat() + "Z",
        "_risks_count": len(risks),
    }
    out_path = os.path.join(OUT_DIR, f"{ticker}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"OK {ticker}: {len(risks)} risks -> {out_path}")

print("DONE")
