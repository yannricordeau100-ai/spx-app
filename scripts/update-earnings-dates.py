#!/usr/bin/env python3
"""
update-earnings-dates.py — Composant 1 mission daily-doc-watcher.

Pour chaque sté clean_all V1.9.5 (lit src/data/v1-9-pre-publication-audit.json
filter is_clean_all), récupère next_earnings_date via yfinance.Ticker(<t>).calendar
et MAJ src/data/v2-pipeline-enrich/<ticker>.json field next_earnings_date (ISO).

Update aussi last_data_date du hero KPI si yfinance reporte un trimestre plus
récent qu'en stock (champ mostRecentQuarter dans yfinance.info).

Idempotent : skip si _earnings_updated_at < 24h.

Usage :
  python3 scripts/update-earnings-dates.py [--tickers NVDA,AAPL] [--workers 10]
                                            [--force] [--limit 100]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, date, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIT_PATH = ROOT / "src/data/v1-9-pre-publication-audit.json"
ENRICH_DIR = ROOT / "src/data/v2-pipeline-enrich"
PIPELINE_DIR = ROOT / "src/data/v2-pipeline"

try:
    import yfinance as yf
    import pandas as pd
except ImportError as e:
    print(f"Missing dep: {e}. Run: pip install yfinance pandas", file=sys.stderr)
    sys.exit(2)


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def is_recent(iso_ts: str | None, hours: int = 24) -> bool:
    dt = parse_iso(iso_ts)
    if not dt:
        return False
    return (datetime.now(timezone.utc) - dt) < timedelta(hours=hours)


def fetch_yf(ticker: str) -> dict:
    """Récupère next_earnings_date + most_recent_quarter via yfinance.
    Retourne dict {next_earnings_date, most_recent_quarter, error?}"""
    out = {"ticker": ticker}
    try:
        t = yf.Ticker(ticker)
        # calendar peut renvoyer dict (yfinance >=0.2) ou DataFrame (legacy)
        ned = None
        try:
            cal = t.calendar
            if cal is None:
                pass
            elif isinstance(cal, dict):
                ed = cal.get("Earnings Date")
                if isinstance(ed, list) and ed:
                    ed = ed[0]
                if isinstance(ed, (datetime, date, pd.Timestamp)):
                    ned = ed.strftime("%Y-%m-%d")
            elif hasattr(cal, "loc"):
                try:
                    val = cal.loc["Earnings Date"].iloc[0]
                    if isinstance(val, (datetime, date, pd.Timestamp)):
                        ned = val.strftime("%Y-%m-%d")
                except Exception:
                    pass
        except Exception as e:
            out["calendar_error"] = str(e)[:120]

        # most_recent_quarter via info
        mrq = None
        try:
            info = t.info or {}
            mrq_epoch = info.get("mostRecentQuarter")
            if isinstance(mrq_epoch, (int, float)):
                mrq = datetime.fromtimestamp(mrq_epoch, timezone.utc).strftime("%Y-%m-%d")
        except Exception as e:
            out["info_error"] = str(e)[:120]

        out["next_earnings_date"] = ned
        out["most_recent_quarter"] = mrq
    except Exception as e:
        out["error"] = str(e)[:200]
    return out


def normalize_ticker_for_file(ticker: str) -> str:
    # v2-pipeline-enrich utilise lowercase + remplace . par - dans le nom de fichier
    return ticker.lower()


def find_enrich_file(ticker: str) -> Path | None:
    """Trouve le fichier enrich correspondant en testant plusieurs variantes."""
    candidates = [
        ticker.lower(),
        ticker.lower().replace(".", "-"),
        ticker.lower().replace("-", "."),
        ticker.replace(".", "_").lower(),
    ]
    for c in candidates:
        p = ENRICH_DIR / f"{c}.json"
        if p.exists():
            return p
    return None


def find_pipeline_file(ticker: str) -> Path | None:
    candidates = [
        ticker.lower(),
        ticker.lower().replace(".", "-"),
        ticker.lower().replace("-", "."),
    ]
    for c in candidates:
        p = PIPELINE_DIR / f"{c}.json"
        if p.exists():
            return p
    return None


def update_one(ticker: str, force: bool = False) -> dict:
    """Update next_earnings_date + last_data_date du hero. Retourne stats."""
    stats = {"ticker": ticker, "status": "skip", "changes": []}

    enrich_path = find_enrich_file(ticker)
    if not enrich_path:
        stats["status"] = "no_enrich_file"
        return stats

    try:
        enrich = json.loads(enrich_path.read_text())
    except Exception as e:
        stats["status"] = "enrich_parse_error"
        stats["error"] = str(e)[:120]
        return stats

    if not force and is_recent(enrich.get("_earnings_updated_at"), hours=24):
        stats["status"] = "recent_skip"
        return stats

    yf_data = fetch_yf(ticker)
    if yf_data.get("error"):
        stats["status"] = "yf_error"
        stats["error"] = yf_data["error"]
        return stats

    ned = yf_data.get("next_earnings_date")
    mrq = yf_data.get("most_recent_quarter")

    if ned and ned != enrich.get("next_earnings_date"):
        old = enrich.get("next_earnings_date")
        enrich["next_earnings_date"] = ned
        stats["changes"].append(f"next_earnings_date {old} -> {ned}")

    # Update hero KPI last_data_date dans v2-pipeline si mrq plus récent
    if mrq:
        pipeline_path = find_pipeline_file(ticker)
        if pipeline_path:
            try:
                pipeline = json.loads(pipeline_path.read_text())
                hero_short = pipeline.get("hero_kpi")
                if hero_short:
                    for kpi in pipeline.get("kpis", []):
                        if kpi.get("short") == hero_short:
                            current = kpi.get("last_data_date") or ""
                            if mrq > current:
                                kpi["last_data_date"] = mrq
                                stats["changes"].append(
                                    f"hero {hero_short} last_data_date {current} -> {mrq}"
                                )
                            break
                    if any("last_data_date" in c for c in stats["changes"]):
                        pipeline_path.write_text(json.dumps(pipeline, indent=2, ensure_ascii=False) + "\n")
            except Exception as e:
                stats["pipeline_error"] = str(e)[:120]

    enrich["_earnings_updated_at"] = now_iso()
    enrich["_earnings_source"] = "yfinance.calendar+info"
    enrich_path.write_text(json.dumps(enrich, indent=2, ensure_ascii=False) + "\n")

    stats["status"] = "updated" if stats["changes"] else "no_change"
    stats["next_earnings_date"] = ned
    stats["most_recent_quarter"] = mrq
    return stats


def load_clean_all_tickers() -> list[str]:
    d = json.loads(AUDIT_PATH.read_text())
    return [a["ticker"] for a in d.get("audits", []) if a.get("is_clean_all")]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers", type=str, default="", help="Comma list. Empty = all clean_all.")
    ap.add_argument("--workers", type=int, default=10)
    ap.add_argument("--force", action="store_true", help="Ignore _earnings_updated_at < 24h skip.")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    if args.tickers:
        tickers = [t.strip() for t in args.tickers.split(",") if t.strip()]
    else:
        tickers = load_clean_all_tickers()

    if args.limit:
        tickers = tickers[: args.limit]

    print(f"[update-earnings-dates] Processing {len(tickers)} stés (workers={args.workers}, force={args.force})")
    t0 = time.time()

    results = []
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(update_one, t, args.force): t for t in tickers}
        for i, fut in enumerate(as_completed(futs), 1):
            try:
                r = fut.result()
            except Exception as e:
                r = {"ticker": futs[fut], "status": "future_error", "error": str(e)[:120]}
            results.append(r)
            if i % 50 == 0 or i == len(tickers):
                print(f"  {i}/{len(tickers)} done, {time.time()-t0:.1f}s")

    status_counts = {}
    for r in results:
        status_counts[r["status"]] = status_counts.get(r["status"], 0) + 1
    print(f"\n[update-earnings-dates] Done in {time.time()-t0:.1f}s")
    print(f"Status: {status_counts}")

    # Sample updated
    updated = [r for r in results if r["status"] == "updated"]
    if updated:
        print(f"\nSample updates (first 10):")
        for r in updated[:10]:
            print(f"  {r['ticker']}: {'; '.join(r['changes'])}")


if __name__ == "__main__":
    main()
