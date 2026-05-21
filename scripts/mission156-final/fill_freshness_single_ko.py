#!/usr/bin/env python3
"""
Mission #156 batch 2 — fill m_freshness for 4 single-KO stés.

Targets: MAA, HON, HLT, KO (last_data_date absent dans merged hero)

Strategy: write publication_date in v2-pipeline-enrich/<ticker>.json,
sourced from yfinance.info.mostRecentQuarter or fallback to hero KPI
last_data_date in v2-pipeline (preferring the most recent ISO date).
"""
import json, os, sys
from datetime import datetime, timezone

try:
    import yfinance as yf
except Exception:
    yf = None

REPO = "/Users/yann/spx-app"
ENRICH = os.path.join(REPO, "src/data/v2-pipeline-enrich")
PIPE = os.path.join(REPO, "src/data/v2-pipeline")

TARGETS = ["MAA", "HON", "HLT", "KO"]
NOW_ISO = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def hero_last_date(ticker):
    for lc in (ticker, ticker.lower(), ticker.upper()):
        fp = os.path.join(PIPE, f"{lc}.json")
        if os.path.exists(fp):
            d = json.load(open(fp))
            hero_short = d.get("hero_kpi")
            for k in d.get("kpis", []):
                if k.get("short") == hero_short and k.get("last_data_date"):
                    return k.get("last_data_date")
            # fallback: max last_data_date across kpis
            dates = [k.get("last_data_date") for k in d.get("kpis", []) if k.get("last_data_date")]
            if dates:
                return max(dates)
    return None


def yf_recent_quarter(ticker):
    if yf is None:
        return None
    try:
        info = yf.Ticker(ticker).info or {}
        ts = info.get("mostRecentQuarter")
        if isinstance(ts, (int, float)) and ts > 0:
            return datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
    except Exception:
        return None
    return None


def main():
    res = []
    for t in TARGETS:
        # determine date
        d_yf = yf_recent_quarter(t)
        d_pipe = hero_last_date(t)
        cand = [x for x in [d_yf, d_pipe] if x]
        chosen = max(cand) if cand else None
        if not chosen:
            res.append({"ticker": t, "status": "skip_no_date"})
            print(f"{t}: skip (no date)")
            continue
        # write publication_date in enrich
        for lc in (t, t.lower(), t.upper()):
            fp = os.path.join(ENRICH, f"{lc}.json")
            if os.path.exists(fp):
                e = json.load(open(fp))
                e["publication_date"] = chosen
                e["_mission156_freshness_at"] = NOW_ISO
                e["_mission156_freshness_source"] = "yfinance.mostRecentQuarter" if d_yf == chosen else "v2-pipeline.hero.last_data_date"
                with open(fp, "w", encoding="utf-8") as f:
                    json.dump(e, f, ensure_ascii=False, indent=2)
                res.append({"ticker": t, "status": "ok", "date": chosen, "source": e["_mission156_freshness_source"]})
                print(f"{t}: ok {chosen} (yf={d_yf}, pipe={d_pipe})")
                break
        else:
            res.append({"ticker": t, "status": "skip_no_enrich"})
            print(f"{t}: no enrich file")

    with open("/tmp/mission156-freshness-results.json", "w") as f:
        json.dump(res, f, indent=2)


if __name__ == "__main__":
    main()
