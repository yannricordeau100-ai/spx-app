#!/usr/bin/env python3
"""Batch2 chunk1 — 50 stés SP500. Reuses extract.py logic."""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
import extract as base

TICKERS = ["BAC","BALL","BAX","BBY","BDX","BEN","BF.B","BG","BIIB","BKNG",
           "BKR","BLDR","BLK","BMY","BR","BRK.B","BRO","BSX","BX","BXP",
           "C","CAG","CAH","CARR","CASY","CAT","CB","CBOE","CBRE","CCI",
           "CCL","CDNS","CDW","CEG","CF","CFG","CHD","CHRW","CHTR","CI",
           "CIEN","CINF","CL","CLX","CMCSA","CME","CMG","CMI","CMS","CNC"]

LOG = "/Users/yann/spx-app/.conv-state/chantier-quarters-log-batch2-chunk1.json"

if __name__ == "__main__":
    log = {"processed": [], "ok": [], "partial": [], "fail": []}
    for t in TICKERS:
        try:
            r = base.process_ticker(t)
            log["processed"].append(r)
            if r["status"] != "ok":
                log["fail"].append({"t": t, "reason": r["status"]})
            elif r.get("failed"):
                log["partial"].append({"t": t, "failed": r["failed"]})
                log["ok"].append(t)
            else:
                log["ok"].append(t)
            print(t, r["status"], "added=", r.get("added"), "updated=", r.get("updated"), "failed=", r.get("failed"))
        except Exception as e:
            log["fail"].append({"t": t, "reason": repr(e)})
            print(t, "ERROR", repr(e))
    with open(LOG, "w") as f:
        json.dump(log, f, ensure_ascii=False, indent=2)
    print("\nLOG written to", LOG)
