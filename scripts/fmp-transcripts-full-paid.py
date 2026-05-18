#!/usr/bin/env python3
"""
FMP transcripts FULL run avec plan payant (FMP_PAID_API_KEY).
Récupère TOUS les transcripts disponibles (pas seulement le dernier) pour
cat 1 + cat 2 + cat 3 sur les 5 dernières années (2021-2026).

Plan Starter $14 = 300 calls/min, transcripts illimités.

Output : src/data/transcripts-full/<ticker>.json
Format :
  {
    "ticker": "AAPL",
    "fetched_at": "...",
    "transcripts": [
      {"quarter": 1, "year": 2026, "date": "...", "content": "..."},
      ...
    ]
  }

Usage : python3 scripts/fmp-transcripts-full-paid.py
"""
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env.local"
OUT_DIR = ROOT / "src/data/transcripts-full"
OUT_DIR.mkdir(parents=True, exist_ok=True)
LOG_PATH = ROOT / "sec-data/_meta/fmp-transcripts-full.log"

# Charge la clé payante
KEY = None
if ENV_PATH.exists():
    for line in ENV_PATH.read_text().splitlines():
        if line.startswith("FMP_PAID_API_KEY="):
            KEY = line.split("=", 1)[1].strip()
            break

if not KEY:
    print("[fatal] FMP_PAID_API_KEY not found in .env.local", file=sys.stderr)
    print("        Add line: FMP_PAID_API_KEY=<your-paid-key>", file=sys.stderr)
    sys.exit(1)

BASE = "https://financialmodelingprep.com/stable"
RATE_LIMIT_CALLS_PER_MIN = 280  # marge sous les 300 du plan Starter
THREADS = 8


def log(msg: str):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_PATH, "a") as f:
        f.write(line + "\n")


def list_dates(ticker: str) -> list:
    """Retourne la liste des dates de transcripts (les plus récentes d'abord)."""
    url = f"{BASE}/earning-call-transcript-dates?symbol={ticker}&apikey={KEY}"
    try:
        r = requests.get(url, timeout=30)
        if r.status_code != 200:
            return []
        data = r.json()
        return data if isinstance(data, list) else []
    except Exception:
        return []


def get_content(ticker: str, year: int, quarter: int) -> Optional[str]:
    url = f"{BASE}/earning-call-transcript?symbol={ticker}&year={year}&quarter={quarter}&apikey={KEY}"
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


def fetch_one(ticker: str) -> dict:
    """Pour un ticker, récupère les 20 derniers transcripts (5 ans)."""
    out = OUT_DIR / f"{ticker.lower()}.json"
    if out.exists():
        try:
            d = json.loads(out.read_text())
            # Skip si on a déjà 4 transcripts (1 an complet)
            if d.get("transcripts") and len(d["transcripts"]) >= 4:
                return {"ticker": ticker, "status": "skip", "n": len(d["transcripts"])}
        except Exception:
            pass

    dates = list_dates(ticker)
    if not dates:
        return {"ticker": ticker, "status": "no_dates", "n": 0}

    # Limite aux 4 plus récents (1 an = 4 trim)
    # Affichage UI = seulement le dernier, mais on garde 1 an d'historique
    # pour pouvoir afficher des comparaisons trimestrielles dans le futur
    dates = dates[:4]
    transcripts = []
    for entry in dates:
        year = entry.get("fiscalYear") or entry.get("year")
        quarter = entry.get("quarter")
        if not year or not quarter:
            continue
        content = get_content(ticker, year, quarter)
        if content:
            transcripts.append({
                "quarter": quarter,
                "year": year,
                "date": entry.get("date"),
                "content": content,
            })

    if not transcripts:
        return {"ticker": ticker, "status": "no_content", "n": 0}

    payload = {
        "ticker": ticker.upper(),
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "transcripts": transcripts,
    }
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    return {"ticker": ticker, "status": "ok", "n": len(transcripts)}


def load_tickers() -> list[str]:
    """Charge tous les tickers cat 1 + 2 + 3 depuis v1-7-tickers-sorted.json (top 622)."""
    src = ROOT / "src/data/v1-7-tickers-sorted.json"
    if src.exists():
        d = json.loads(src.read_text())
        if isinstance(d, list):
            return [t.upper() for t in d]
    # Fallback : v2-pipeline glob
    pipe_dir = ROOT / "src/data/v2-pipeline"
    out = []
    for f in pipe_dir.glob("*.json"):
        n = f.name
        if n.startswith("_") or ".gemini.json" in n:
            continue
        try:
            d = json.loads(f.read_text())
            if "_validation" in d:
                out.append(n[:-5].upper())
        except Exception:
            continue
    return sorted(out)


def main():
    tickers = load_tickers()
    log(f"START : {len(tickers)} tickers, paid key, {THREADS} threads, target rate {RATE_LIMIT_CALLS_PER_MIN}/min")

    counts = {"ok": 0, "skip": 0, "no_dates": 0, "no_content": 0}
    total_transcripts = 0
    t0 = time.time()
    rate_token_interval = 60.0 / RATE_LIMIT_CALLS_PER_MIN  # secondes par appel

    # ThreadPool avec rate limit doux
    with ThreadPoolExecutor(max_workers=THREADS) as ex:
        futures = {}
        for tk in tickers:
            futures[ex.submit(fetch_one, tk)] = tk
            time.sleep(rate_token_interval / THREADS)  # spread initial

        for i, fut in enumerate(as_completed(futures)):
            try:
                r = fut.result()
            except Exception as e:
                tk = futures[fut]
                log(f"   ❌ {tk} : exception {e}")
                continue
            counts[r["status"]] = counts.get(r["status"], 0) + 1
            total_transcripts += r.get("n", 0)
            if r["status"] == "ok":
                log(f"   ✅ {r['ticker']} : {r['n']} transcripts")
            elif r["status"] not in ("skip",):
                log(f"   ⚠ {r['ticker']} : {r['status']}")
            if (i + 1) % 25 == 0:
                elapsed = time.time() - t0
                rate = (i + 1) / elapsed if elapsed > 0 else 0
                eta = (len(tickers) - i - 1) / rate if rate > 0 else 0
                log(f"   [{i+1}/{len(tickers)}] ok={counts['ok']} skip={counts['skip']} no_dates={counts['no_dates']} ({rate:.1f}/s, ETA {eta/60:.1f}min, total={total_transcripts})")

    log(f"END : {counts}, total transcripts saved = {total_transcripts}")


if __name__ == "__main__":
    main()
