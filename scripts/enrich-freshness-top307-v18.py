#!/usr/bin/env python3
"""
Enrichit publication_date + next_earnings_date pour top 307 V1.8.
- publication_date : SEC EDGAR submissions/<CIK>.json → 1er filedDate du
  dernier 10-Q/10-K/20-F. Pour cat3 EU sans CIK : fallback latest_filing.date
  déjà présent dans v2-pipeline-enrich/ (ranks/profile fetchers le posent).
- next_earnings_date : yfinance.calendar (gratuit, rapide).

Sortie : SEPARATE FROM v2-pipeline/ ← Yann 11 mai broadcast.
Écrit dans `src/data/v2-pipeline-enrich/<ticker>.json` (champs ajoutés sans
écraser, et `latest_filing.date` si manquant).

RAM safe : workers=4 max (au lieu de 20), Mac fragile 98% RAM saturée.

Usage : python3 scripts/enrich-freshness-top307-v18.py
"""
import argparse
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, date
from pathlib import Path

import requests
import yfinance as yf
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
PIPELINE_DIR = ROOT / "src/data/v2-pipeline"
ENRICH_DIR = ROOT / "src/data/v2-pipeline-enrich"
ENRICH_DIR.mkdir(parents=True, exist_ok=True)
TICKERS_SRC = ROOT / "src/data/v1-8-tickers-sorted.json"
LOG = ROOT / ".conv-state/CONV-DATA-freshness-top307.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

# SEC EDGAR rate limit : 10 req/s max. On vise 5/s safe.
SEC_HEADERS = {"User-Agent": "Mettrik-AI contact@mettrik.ai"}
SEC_RATE_SLEEP = 0.20  # seconds


def log_line(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


_SEC_TICKERS_CACHE = None


def _load_sec_tickers():
    """Charge le mapping ticker→CIK depuis /tmp/sec-tickers.json (download by caller)."""
    global _SEC_TICKERS_CACHE
    if _SEC_TICKERS_CACHE is not None:
        return _SEC_TICKERS_CACHE
    cache = Path("/tmp/sec-tickers.json")
    if not cache.exists():
        try:
            r = requests.get("https://www.sec.gov/files/company_tickers.json", headers=SEC_HEADERS, timeout=30)
            cache.write_text(r.text)
        except Exception:
            _SEC_TICKERS_CACHE = {}
            return _SEC_TICKERS_CACHE
    try:
        raw = json.loads(cache.read_text())
        m = {}
        for v in raw.values():
            tk = (v.get("ticker") or "").upper()
            cik = v.get("cik_str")
            if tk and cik:
                m[tk] = str(int(cik)).zfill(10)
        _SEC_TICKERS_CACHE = m
    except Exception:
        _SEC_TICKERS_CACHE = {}
    return _SEC_TICKERS_CACHE


def get_cik(ticker: str) -> str | None:
    """Lit le CIK : 1) depuis dataset v2-pipeline, 2) fallback SEC ticker map."""
    f = PIPELINE_DIR / f"{ticker.lower()}.json"
    if f.exists():
        try:
            d = json.loads(f.read_text())
            cik = d.get("cik") or d.get("CIK")
            if cik:
                return str(int(cik)).zfill(10)
        except Exception:
            pass
    # Fallback SEC mapping
    sec_map = _load_sec_tickers()
    # Essai ticker direct, sinon dash/dot variantes
    for variant in [ticker.upper(), ticker.upper().replace(".", "-"), ticker.upper().replace("-", ".")]:
        if variant in sec_map:
            return sec_map[variant]
    return None


def fetch_publication_date_sec(ticker: str) -> dict | None:
    """SEC EDGAR submissions/CIK.json → dernier filedDate de 10-Q/10-K/20-F."""
    cik = get_cik(ticker)
    if not cik:
        return None
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    try:
        r = requests.get(url, headers=SEC_HEADERS, timeout=15)
        if r.status_code != 200:
            return None
        data = r.json()
        recent = data.get("filings", {}).get("recent", {})
        forms = recent.get("form", [])
        # SEC API utilise "filingDate" (camelCase) PAS "filedDate" (typo fréquente)
        dates = recent.get("filingDate", []) or recent.get("filedDate", [])
        period_ends = recent.get("reportDate", []) or recent.get("periodOfReport", [])
        wanted = {"10-Q", "10-K", "20-F", "6-K"}
        for i, form in enumerate(forms):
            if form in wanted:
                return {
                    "date": dates[i] if i < len(dates) else None,
                    "form": form,
                    "period_end": period_ends[i] if i < len(period_ends) else None,
                }
    except Exception:
        return None
    return None


def fetch_next_earnings_date_yf(ticker: str) -> str | None:
    """yfinance.calendar → next earnings."""
    try:
        cal = yf.Ticker(ticker).calendar
        if cal is None or not isinstance(cal, dict):
            return None
        ed = cal.get("Earnings Date")
        if isinstance(ed, list) and ed:
            ed = ed[0]
        if isinstance(ed, (datetime, date, pd.Timestamp)):
            return ed.strftime("%Y-%m-%d")
    except Exception:
        return None
    return None


def merge_enrich(ticker: str, latest_filing: dict | None, next_date: str | None) -> str:
    """Écrit dans v2-pipeline-enrich/<ticker>.json sans écraser."""
    out = ENRICH_DIR / f"{ticker.lower()}.json"
    d = {}
    if out.exists():
        try:
            d = json.loads(out.read_text())
        except Exception:
            d = {}
    changed = False
    # latest_filing.date = publication_date (ne pas écraser si déjà présent et plus récent)
    if latest_filing and latest_filing.get("date"):
        existing = d.get("latest_filing") or {}
        existing_date = existing.get("date") if isinstance(existing, dict) else None
        if not existing_date or latest_filing["date"] > existing_date:
            d["latest_filing"] = latest_filing
            d.setdefault("publication_date", latest_filing["date"])
            changed = True
        elif not d.get("publication_date"):
            d["publication_date"] = existing_date
            changed = True
    if next_date:
        existing_next = d.get("next_earnings_date")
        if existing_next != next_date:
            d["next_earnings_date"] = next_date
            changed = True
    if changed:
        d["_freshness_fetched_at"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        out.write_text(json.dumps(d, ensure_ascii=False, indent=2))
        return "updated"
    return "unchanged"


def process_one(ticker: str) -> dict:
    pub = fetch_publication_date_sec(ticker)
    time.sleep(SEC_RATE_SLEEP)  # SEC EDGAR rate limit
    nxt = fetch_next_earnings_date_yf(ticker)
    status = merge_enrich(ticker, pub, nxt)
    return {
        "ticker": ticker,
        "status": status,
        "pub_date": pub["date"] if pub else None,
        "next_date": nxt,
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--top", type=int, default=307)
    p.add_argument("--workers", type=int, default=4)  # RAM safe
    args = p.parse_args()

    tickers = json.loads(TICKERS_SRC.read_text())[: args.top]
    log_line(f"START : enrich freshness top {len(tickers)} V1.8, workers={args.workers}")

    counts = {"updated": 0, "unchanged": 0, "error": 0}
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {ex.submit(process_one, t): t for t in tickers}
        done = 0
        for fut in as_completed(futures):
            done += 1
            try:
                r = fut.result()
            except Exception as e:
                tk = futures[fut]
                log_line(f"  ❌ {tk}: exception {e}")
                counts["error"] += 1
                continue
            counts[r["status"]] += 1
            if r["pub_date"] or r["next_date"]:
                log_line(
                    f"  ✅ {r['ticker']:10} pub={r['pub_date'] or '—':10}  next={r['next_date'] or '—':10}  [{r['status']}]"
                )
            if done % 25 == 0:
                log_line(f"  [{done}/{len(tickers)}] counts={counts}")
    log_line(f"END : {counts}")


if __name__ == "__main__":
    main()
