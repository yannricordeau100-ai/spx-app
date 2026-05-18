#!/usr/bin/env python3
"""
AlphaVantage transcripts pour top 307 US/ADR.

Stratégie:
- 5 clés AV × 25 calls/jour = 125 calls/jour
- Rotation round-robin des clés
- Sleep 15s entre calls (4/min, sous rate limit AV)
- Skip stés déjà sauvegardées
- Stop quand toutes clés en quota épuisé

Output : src/data/transcripts-av/<ticker>.json
Format :
  {
    "ticker": "NVDA",
    "fetched_at": "...",
    "quarter": "2025Q3",
    "source": "alphavantage",
    "transcript": [...speakers...],
    "full_text": "concat...",
  }

Usage : python3 scripts/av-transcripts-top307.py [--quarter 2025Q3] [--top N]
"""
import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env.local"
OUT_DIR = ROOT / "src/data/transcripts-av"
OUT_DIR.mkdir(parents=True, exist_ok=True)
LOG_PATH = ROOT / "sec-data/_meta/av-transcripts-top307.log"

# Charge les clés AV
KEYS = []
if ENV_PATH.exists():
    for line in ENV_PATH.read_text().splitlines():
        if line.startswith("ALPHAVANTAGE_KEY_"):
            KEYS.append(line.split("=", 1)[1].strip())
if not KEYS:
    print("[fatal] No ALPHAVANTAGE_KEY_* found in .env.local", file=sys.stderr)
    sys.exit(1)
print(f"[init] Loaded {len(KEYS)} AlphaVantage keys")

BASE = "https://www.alphavantage.co/query"
QUOTA_PER_KEY_PER_DAY = 25
SLEEP_BETWEEN_CALLS = 15  # secondes (4/min sous le 5/min rate limit AV)

# State tracking
key_calls_today = [0] * len(KEYS)  # nb calls par clé aujourd'hui
key_exhausted = [False] * len(KEYS)  # True si quota épuisé


def log(msg: str):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_PATH, "a") as f:
        f.write(line + "\n")


def get_available_key() -> Optional[tuple[int, str]]:
    """Retourne (index, key) d'une clé non-épuisée, ou None si toutes épuisées."""
    for i, k in enumerate(KEYS):
        if not key_exhausted[i] and key_calls_today[i] < QUOTA_PER_KEY_PER_DAY:
            return i, k
    return None


def fetch_transcript(ticker: str, quarter: str, key: str) -> dict:
    """Fetch un transcript. Retourne dict status, data."""
    url = f"{BASE}?function=EARNINGS_CALL_TRANSCRIPT&symbol={ticker}&quarter={quarter}&apikey={key}"
    try:
        r = requests.get(url, timeout=30)
        data = r.json()
        if "transcript" in data and data["transcript"] and isinstance(data["transcript"], list):
            return {"status": "ok", "data": data}
        elif "Information" in data:
            info = data["Information"]
            if "rate limit" in info.lower() or "premium" in info.lower():
                return {"status": "quota_exhausted", "info": info}
            return {"status": "rate_limit", "info": info}
        elif "Error Message" in data:
            return {"status": "error", "info": data["Error Message"]}
        else:
            # Possibly empty transcript = sté non couverte
            return {"status": "no_transcript", "info": str(data)[:200]}
    except Exception as e:
        return {"status": "exception", "info": str(e)}


def save_transcript(ticker: str, quarter: str, data: dict):
    """Sauve transcript en JSON."""
    out = OUT_DIR / f"{ticker.lower().replace('.', '_')}.json"
    transcript_list = data.get("transcript", [])
    full_text = " ".join([s.get("content", "") for s in transcript_list if isinstance(s, dict)])
    payload = {
        "ticker": ticker.upper(),
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "quarter": quarter,
        "source": "alphavantage",
        "transcript": transcript_list,
        "full_text": full_text,
        "n_speakers": len(transcript_list),
        "n_chars": len(full_text),
    }
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2))


def load_us_adr_tickers(top_n: int) -> list[str]:
    """Top N tickers sans point (US + ADR cotées US)."""
    src = ROOT / "src/data/v1-7-tickers-sorted.json"
    d = json.loads(src.read_text())
    out = [t for t in d if "." not in t][:top_n]
    return out


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--quarter", default="2025Q3")
    p.add_argument("--top", type=int, default=217, help="Top N US/ADR")
    args = p.parse_args()

    tickers = load_us_adr_tickers(args.top)
    # Skip déjà OK
    to_process = []
    for tk in tickers:
        out = OUT_DIR / f"{tk.lower().replace('.', '_')}.json"
        if out.exists():
            try:
                d = json.loads(out.read_text())
                if d.get("n_speakers", 0) > 0:
                    continue
            except Exception:
                pass
        to_process.append(tk)

    log(f"START: {len(to_process)} to process / {len(tickers)} total ({len(tickers) - len(to_process)} already done)")
    log(f"Keys: {len(KEYS)}, quota={QUOTA_PER_KEY_PER_DAY}/key/day = {len(KEYS) * QUOTA_PER_KEY_PER_DAY} max today")

    counts = {"ok": 0, "no_transcript": 0, "quota_exhausted": 0, "rate_limit": 0, "error": 0}
    for i, tk in enumerate(to_process, 1):
        # Round-robin sur les clés non-épuisées
        key_choice = get_available_key()
        if not key_choice:
            log(f"⛔ ALL KEYS EXHAUSTED. Stopped at {i}/{len(to_process)}. Resume tomorrow.")
            break
        key_idx, key = key_choice
        result = fetch_transcript(tk, args.quarter, key)
        key_calls_today[key_idx] += 1

        if result["status"] == "ok":
            save_transcript(tk, args.quarter, result["data"])
            n_speakers = len(result["data"].get("transcript", []))
            counts["ok"] += 1
            log(f"  [{i:3}/{len(to_process)}] ✅ {tk:8} key{key_idx+1} ({n_speakers} speakers)")
        elif result["status"] == "quota_exhausted":
            key_exhausted[key_idx] = True
            log(f"  [{i:3}/{len(to_process)}] 🔒 {tk:8} key{key_idx+1} QUOTA EXHAUSTED — switching")
            # Re-essayer immédiatement avec une autre clé
            time.sleep(2)
            key_choice2 = get_available_key()
            if key_choice2:
                key_idx2, key2 = key_choice2
                result2 = fetch_transcript(tk, args.quarter, key2)
                key_calls_today[key_idx2] += 1
                if result2["status"] == "ok":
                    save_transcript(tk, args.quarter, result2["data"])
                    counts["ok"] += 1
                    log(f"      ✅ {tk:8} retry on key{key_idx2+1} OK")
                elif result2["status"] == "quota_exhausted":
                    key_exhausted[key_idx2] = True
                    log(f"      🔒 retry key{key_idx2+1} ALSO exhausted")
                else:
                    counts[result2["status"]] = counts.get(result2["status"], 0) + 1
                    log(f"      ⚠ retry key{key_idx2+1}: {result2['status']}")
        elif result["status"] == "no_transcript":
            counts["no_transcript"] += 1
            log(f"  [{i:3}/{len(to_process)}] ⚠ {tk:8} key{key_idx+1} no transcript for {args.quarter}")
        else:
            counts[result["status"]] = counts.get(result["status"], 0) + 1
            log(f"  [{i:3}/{len(to_process)}] ❌ {tk:8} key{key_idx+1}: {result['status']}")

        # Status récap toutes les 25
        if i % 25 == 0:
            log(f"  Quota state: {key_calls_today} (exhausted: {key_exhausted})")
        # Sleep
        time.sleep(SLEEP_BETWEEN_CALLS)

    log(f"END: {counts}")
    log(f"Final quota state: {key_calls_today}")


if __name__ == "__main__":
    main()
