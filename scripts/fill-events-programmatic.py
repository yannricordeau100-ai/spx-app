#!/usr/bin/env python3
"""
fill-events-programmatic.py — sub-agent #37 (CONV-CONCEPTS).

Mission : combler les events sur les 130 stés publishable strict V1.9
résiduelles `i_events KO` après refresh news yfinance du sub-agent #36.

Stratégie programmatic (NO LLM) :
  1. yfinance.Ticker(t).calendar       → next earnings date
  2. yfinance.Ticker(t).actions        → dividends + splits (last 5 years)
  3. yfinance.Ticker(t).info           → mostRecentQuarter / lastDividendDate

Pour chaque sté résiduelle :
  - Génère event "Publication trimestrielle Q{N} {year}" depuis earnings date
    (passé) et mostRecentQuarter
  - Génère event "Prochaine publication trimestrielle (Q{N} {year})" depuis
    earnings date future si dispo
  - Génère event "Dividende {value} {unit}/action versé" pour les derniers
    4 dividendes (dans fenêtre 12 derniers mois)
  - Génère event "Stock split {ratio}:1" si applicable (split récent)

Output : merge dans `src/data/v2-pipeline-enrich/<ticker_lower>.events.json`
(append, dédup par (title,date), tri date desc, cap 8 events).

Idempotent : si run précédemment, garde events news existants + ajoute
events programmatic.

Cible : 4+ events par sté.

Usage:
    python3 scripts/fill-events-programmatic.py [--limit N]

Rate-limit yfinance : ~10 req/s mais on bride à ~2 req/s (sleep 0.5s)
pour rester sage sur Mac RAM-fragile et éviter les 429.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA = PROJECT_ROOT / "src/data"
ENR = DATA / "v2-pipeline-enrich"
AUDIT = DATA / "v1-9-pre-publication-audit.json"
TARGETS_TXT = Path("/tmp/i-events-ko-tickers.txt")

MONTHS_FR = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]

def quarter_of(month: int) -> int:
    return (month - 1) // 3 + 1


def fmt_date_fr(d: datetime) -> str:
    return f"{d.day} {MONTHS_FR[d.month - 1]} {d.year}"


def load_targets(limit: int | None = None) -> list[str]:
    if TARGETS_TXT.exists():
        tickers = [t.strip() for t in TARGETS_TXT.read_text().splitlines() if t.strip()]
    else:
        audit = json.loads(AUDIT.read_text())
        tickers = [
            a["ticker"]
            for a in audit["audits"]
            if a.get("extensions", {}).get("i_events", {}).get("ok") is False
        ]
    if limit:
        tickers = tickers[:limit]
    return tickers


def load_existing(ticker: str) -> tuple[Path, list[dict]]:
    path = ENR / f"{ticker.lower()}.events.json"
    if path.exists():
        try:
            data = json.loads(path.read_text())
            return path, list(data.get("events", []))
        except Exception:
            return path, []
    return path, []


def build_event(year: int, month: int, title: str, body: str, source: str,
                url: str = "", date_iso: str = "") -> dict:
    return {
        "year": year,
        "month": month,
        "title": title[:140],
        "body": body[:280],
        "source": source,
        "url": url,
        "date": date_iso,
    }


def fetch_programmatic_events(ticker: str) -> list[dict]:
    """Retourne une liste d'events synthétisés depuis yfinance (no LLM)."""
    import yfinance as yf
    import pandas as pd

    events: list[dict] = []
    try:
        t = yf.Ticker(ticker)
    except Exception:
        return events

    # --- INFO : last quarter + last dividend ---
    info: dict = {}
    try:
        info = t.info or {}
    except Exception:
        info = {}

    most_recent_q_ts = info.get("mostRecentQuarter")
    if most_recent_q_ts:
        try:
            d = datetime.fromtimestamp(int(most_recent_q_ts), tz=timezone.utc)
            q = quarter_of(d.month)
            events.append(build_event(
                year=d.year,
                month=d.month,
                title=f"Publication des résultats Q{q} {d.year}",
                body=f"Clôture du trimestre Q{q} {d.year} le {fmt_date_fr(d)}.",
                source="yfinance · mostRecentQuarter",
                date_iso=d.date().isoformat(),
            ))
        except Exception:
            pass

    # --- CALENDAR : next earnings date (future) ---
    try:
        cal = t.calendar
    except Exception:
        cal = None

    if cal is not None:
        try:
            # yfinance v0.2+ : calendar est un dict {Earnings Date: [date1, date2], ...}
            if isinstance(cal, dict):
                edates = cal.get("Earnings Date") or cal.get("earnings_date")
                if edates:
                    if not isinstance(edates, list):
                        edates = [edates]
                    for ed in edates[:1]:
                        try:
                            if hasattr(ed, "year"):
                                d = datetime(ed.year, ed.month, ed.day, tzinfo=timezone.utc)
                            else:
                                d = datetime.fromisoformat(str(ed)).replace(tzinfo=timezone.utc)
                            now = datetime.now(timezone.utc)
                            if d > now and (d - now).days <= 180:
                                q = quarter_of(d.month)
                                events.append(build_event(
                                    year=d.year,
                                    month=d.month,
                                    title=f"Prochaine publication Q{q} {d.year}",
                                    body=f"Publication attendue le {fmt_date_fr(d)} (Q{q} {d.year}).",
                                    source="yfinance · calendar",
                                    date_iso=d.date().isoformat(),
                                ))
                        except Exception:
                            continue
        except Exception:
            pass

    # --- ACTIONS : dividends + splits (last 5 years) ---
    try:
        actions = t.actions
    except Exception:
        actions = None

    if actions is not None and not actions.empty:
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(days=365 * 2)
            # actions est un DataFrame avec colonnes Dividends, Stock Splits
            recent = actions[actions.index >= cutoff.replace(tzinfo=None)] if actions.index.tz is None else actions[actions.index >= cutoff]
            # Dividends
            divs = recent[recent.get("Dividends", 0) > 0] if "Dividends" in recent.columns else None
            if divs is not None and not divs.empty:
                # Garde les 4 derniers
                last_divs = divs.tail(4)
                # Détecte devise via info
                currency = info.get("currency") or "USD"
                cur_symbol = {"USD": "$", "EUR": "€", "GBP": "£", "CHF": "CHF", "JPY": "¥"}.get(currency, currency)
                for idx, row in last_divs.iterrows():
                    try:
                        val = float(row["Dividends"])
                        if val <= 0:
                            continue
                        d = idx.to_pydatetime() if hasattr(idx, "to_pydatetime") else idx
                        if d.tzinfo is None:
                            d = d.replace(tzinfo=timezone.utc)
                        # Format value (avoid trailing zeros)
                        val_s = f"{val:.4f}".rstrip("0").rstrip(".")
                        events.append(build_event(
                            year=d.year,
                            month=d.month,
                            title=f"Dividende {val_s} {cur_symbol}/action versé",
                            body=f"Dividende ordinaire de {val_s} {cur_symbol} par action, ex-date {fmt_date_fr(d)}.",
                            source="yfinance · actions",
                            date_iso=d.date().isoformat(),
                        ))
                    except Exception:
                        continue

            # Splits
            splits = recent[recent.get("Stock Splits", 0) > 0] if "Stock Splits" in recent.columns else None
            if splits is not None and not splits.empty:
                for idx, row in splits.iterrows():
                    try:
                        ratio = float(row["Stock Splits"])
                        if ratio <= 0 or ratio == 1.0:
                            continue
                        d = idx.to_pydatetime() if hasattr(idx, "to_pydatetime") else idx
                        if d.tzinfo is None:
                            d = d.replace(tzinfo=timezone.utc)
                        ratio_s = f"{ratio:g}:1" if ratio >= 1 else f"1:{1/ratio:g}"
                        events.append(build_event(
                            year=d.year,
                            month=d.month,
                            title=f"Stock split {ratio_s}",
                            body=f"Division de l'action {ratio_s} effective le {fmt_date_fr(d)}.",
                            source="yfinance · actions",
                            date_iso=d.date().isoformat(),
                        ))
                    except Exception:
                        continue
        except Exception:
            pass

    return events


def merge_events(existing: list[dict], new_events: list[dict], cap: int = 8) -> list[dict]:
    """Merge avec dédup par (title lowercased prefix, date)."""
    seen = set()
    out: list[dict] = []
    # Garde existing d'abord
    for e in existing:
        key = (str(e.get("title", "")).lower()[:60], e.get("date", ""))
        if key in seen:
            continue
        seen.add(key)
        out.append(e)
    # Ajoute new_events
    for e in new_events:
        key = (str(e.get("title", "")).lower()[:60], e.get("date", ""))
        if key in seen:
            continue
        seen.add(key)
        out.append(e)
    # Tri date desc (ISO date string compare works)
    out.sort(key=lambda e: e.get("date", ""), reverse=True)
    return out[:cap]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--sleep", type=float, default=0.5, help="sleep between tickers (yfinance bridé)")
    args = ap.parse_args()

    targets = load_targets(args.limit)
    print(f"📊 Programmatic events fill : {len(targets)} stés résiduelles", flush=True)

    ENR.mkdir(parents=True, exist_ok=True)

    stats = {
        "processed": 0,
        "yfinance_fail": 0,
        "written": 0,
        "skipped_no_data": 0,
        "earnings_count": 0,
        "dividends_count": 0,
        "splits_count": 0,
        "with_4plus_events": 0,
        "with_existing_news": 0,
    }

    by_source: dict[str, int] = {}

    for i, ticker in enumerate(targets):
        stats["processed"] += 1
        try:
            new_events = fetch_programmatic_events(ticker)
        except Exception as e:
            stats["yfinance_fail"] += 1
            print(f"  ❌ {ticker}: yfinance err {e}", file=sys.stderr)
            continue

        # Count by source type for stats
        for ev in new_events:
            title = ev["title"]
            if "Publication" in title or "publication" in title:
                stats["earnings_count"] += 1
            elif "Dividende" in title:
                stats["dividends_count"] += 1
            elif "split" in title.lower():
                stats["splits_count"] += 1
            src = ev.get("source", "")
            by_source[src] = by_source.get(src, 0) + 1

        path, existing = load_existing(ticker)
        if existing:
            stats["with_existing_news"] += 1

        if not new_events and not existing:
            stats["skipped_no_data"] += 1
            continue

        merged = merge_events(existing, new_events)

        if len(merged) >= 4:
            stats["with_4plus_events"] += 1

        payload = {
            "ticker": ticker,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "events": merged,
            "_programmatic_fill_at": datetime.now(timezone.utc).isoformat(),
        }
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
        stats["written"] += 1

        # ALSO merge events into the main enrich file <ticker>.json so that
        # both the prod loader (src/lib/v1-7/load-company.ts) and the audit
        # script (audit-v1-9-pre-publication.js) pick them up. Without this,
        # the .events.json sidecar file is invisible to both.
        for main_name in [f"{ticker}.json", f"{ticker.lower()}.json"]:
            main_path = ENR / main_name
            if main_path.exists():
                try:
                    main_data = json.loads(main_path.read_text())
                except Exception:
                    continue
                existing_main_events = main_data.get("events")
                if not isinstance(existing_main_events, list):
                    existing_main_events = []
                # If main file already has 4+ events, leave it (don't overwrite news curation)
                if len(existing_main_events) >= 4:
                    break
                # Merge programmatic events with whatever main already had
                merged_main = merge_events(existing_main_events, merged)
                main_data["events"] = merged_main
                main_data["_events_programmatic_fill_at"] = datetime.now(timezone.utc).isoformat()
                main_path.write_text(json.dumps(main_data, ensure_ascii=False, indent=2))
                break

        if (i + 1) % 10 == 0:
            print(f"  …{i + 1}/{len(targets)} written={stats['written']} fail={stats['yfinance_fail']} ≥4ev={stats['with_4plus_events']}", flush=True)

        time.sleep(args.sleep)

    print("\n📈 Bilan :", flush=True)
    print(f"  - processed : {stats['processed']}")
    print(f"  - written   : {stats['written']}")
    print(f"  - yfinance_fail : {stats['yfinance_fail']}")
    print(f"  - skipped_no_data : {stats['skipped_no_data']}")
    print(f"  - with_4plus_events : {stats['with_4plus_events']} / {stats['processed']}")
    print(f"  - with_existing_news : {stats['with_existing_news']}")
    print("\n📦 Distribution sources programmatic :")
    print(f"  - earnings_count : {stats['earnings_count']}")
    print(f"  - dividends_count : {stats['dividends_count']}")
    print(f"  - splits_count : {stats['splits_count']}")
    print("\n📊 By source label :")
    for src, n in sorted(by_source.items(), key=lambda x: -x[1]):
        print(f"  - {src} : {n}")

    # Dump stats
    out = Path("/tmp/conv-concepts-runs/programmatic-events-stats.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "stats": stats,
        "by_source": by_source,
    }, ensure_ascii=False, indent=2))
    print(f"\n💾 Stats dump → {out}")


if __name__ == "__main__":
    main()
