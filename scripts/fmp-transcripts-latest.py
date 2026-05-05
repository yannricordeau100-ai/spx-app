#!/usr/bin/env python3
"""
Récupère le dernier earning call transcript pour chaque société.
Utilise la nouvelle API FMP /stable/ (legacy /api/v3/v4 deprecated août 2025).

Endpoints :
  - GET /stable/earning-call-transcript-dates?symbol=X → liste dates (le 1er = le plus récent)
  - GET /stable/earning-call-transcript?symbol=X&year=Y&quarter=Q → contenu complet

Output : src/data/transcripts/<ticker>.json
Format :
  {
    "ticker": "AAPL",
    "fetched_at": "2026-05-05T03:35:00Z",
    "latest": {
      "quarter": 2,
      "year": 2026,
      "date": "2026-04-30",
      "content": "..."
    }
  }

Usage :
  python3 scripts/fmp-transcripts-latest.py [--limit N] [--ticker-file PATH] [--skip-existing]
"""
import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env.local"
OUT_DIR = ROOT / "src/data/transcripts"
OUT_DIR.mkdir(parents=True, exist_ok=True)
LOG_PATH = ROOT / "sec-data/_meta/fmp-transcripts.log"

# Charge les 4 clés FMP
KEYS = []
if ENV_PATH.exists():
    for line in ENV_PATH.read_text().splitlines():
        if line.startswith(("FMP_API_KEY=", "FMP2_API_KEY=", "FMP3_API_KEY=", "FMP4_API_KEY=")):
            KEYS.append(line.split("=", 1)[1].strip())
if not KEYS:
    print("[fatal] No FMP keys found", file=sys.stderr)
    sys.exit(1)

BASE = "https://financialmodelingprep.com/stable"


def log(msg: str):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_PATH, "a") as f:
        f.write(line + "\n")


_key_idx = 0


def next_key() -> str:
    global _key_idx
    k = KEYS[_key_idx]
    _key_idx = (_key_idx + 1) % len(KEYS)
    return k


def get_latest_date(ticker: str) -> Optional[dict]:
    """Retourne {date, quarter, fiscalYear} le plus récent ou None."""
    url = f"{BASE}/earning-call-transcript-dates?symbol={ticker}&apikey={next_key()}"
    try:
        r = requests.get(url, timeout=30)
        if r.status_code != 200:
            return None
        data = r.json()
        if not isinstance(data, list) or not data:
            return None
        # Le 1er = le plus récent (API les retourne en ordre desc)
        return data[0]
    except Exception:
        return None


def get_content(ticker: str, year: int, quarter: int) -> Optional[str]:
    """Retourne le contenu complet du transcript."""
    url = (
        f"{BASE}/earning-call-transcript?symbol={ticker}&year={year}&quarter={quarter}"
        f"&apikey={next_key()}"
    )
    try:
        r = requests.get(url, timeout=60)
        if r.status_code != 200:
            return None
        data = r.json()
        if isinstance(data, list) and data:
            return data[0].get("content", "") or None
        if isinstance(data, dict):
            return data.get("content", "") or None
    except Exception:
        return None
    return None


def fetch_one(ticker: str, skip_existing: bool = True) -> str:
    out = OUT_DIR / f"{ticker.lower()}.json"
    if skip_existing and out.exists():
        try:
            d = json.loads(out.read_text())
            if d.get("latest") and d["latest"].get("content"):
                return "skip"
        except Exception:
            pass
    latest = get_latest_date(ticker)
    if not latest:
        return "no_dates"
    year = latest.get("fiscalYear") or latest.get("year")
    quarter = latest.get("quarter")
    if not year or not quarter:
        return "bad_dates"
    content = get_content(ticker, year, quarter)
    if not content:
        return "no_content"
    payload = {
        "ticker": ticker.upper(),
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "latest": {
            "quarter": quarter,
            "year": year,
            "date": latest.get("date"),
            "content": content,
        },
    }
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    return "ok"


def load_tickers(path: Optional[Path]) -> list[str]:
    if path and path.exists():
        return [t.strip().upper() for t in path.read_text().splitlines() if t.strip()]
    # Sinon : lit les fiches validées
    pipe_dir = ROOT / "src/data/v2-pipeline"
    out = []
    for f in pipe_dir.glob("*.json"):
        n = f.name
        if n.startswith("_") or ".gemini.json" in n:
            continue
        try:
            d = json.loads(f.read_text())
            if "_validation" in d:
                tk = n[:-5].upper()
                # Skip cat 3 EU (.PA, .DE, etc.) — pas de transcripts FMP pour ceux-là
                if "." in tk:
                    continue
                out.append(tk)
        except Exception:
            continue
    return sorted(out)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--ticker-file", type=Path, default=None)
    p.add_argument("--skip-existing", action="store_true", default=True)
    p.add_argument("--no-skip", dest="skip_existing", action="store_false")
    p.add_argument("--rate-pause", type=float, default=0.3, help="seconds between calls")
    args = p.parse_args()

    tickers = load_tickers(args.ticker_file)
    if args.limit > 0:
        tickers = tickers[:args.limit]
    log(f"START : {len(tickers)} tickers, {len(KEYS)} keys, skip_existing={args.skip_existing}")

    counts = {"ok": 0, "skip": 0, "no_dates": 0, "bad_dates": 0, "no_content": 0}
    t0 = time.time()
    for i, tk in enumerate(tickers):
        try:
            r = fetch_one(tk, args.skip_existing)
        except Exception as e:
            log(f"   ❌ {tk} : exception {e}")
            r = "no_content"
        counts[r] = counts.get(r, 0) + 1
        if r == "ok":
            log(f"   ✅ {tk}")
        elif r == "skip":
            pass
        else:
            log(f"   ⚠ {tk} : {r}")
        if (i + 1) % 25 == 0:
            elapsed = time.time() - t0
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            eta = (len(tickers) - i - 1) / rate if rate > 0 else 0
            log(f"   [{i+1}/{len(tickers)}] ok={counts['ok']} skip={counts['skip']} no_dates={counts['no_dates']} no_content={counts['no_content']} ({rate:.1f}/s, ETA {eta/60:.1f}min)")
        time.sleep(args.rate_pause)

    log(f"END : {counts}")


if __name__ == "__main__":
    main()
