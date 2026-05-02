#!/usr/bin/env python3
"""
FMP — récupère market cap (tri) + dernier transcript pour chaque ticker.

Usage :
    # 1. Rank tickers par market cap décroissant
    python3 scripts/fmp-rank-and-transcripts.py rank --tickers-file /path/to.csv [--out tickers-by-mc.json]

    # 2. Fetch dernier transcript pour une liste
    python3 scripts/fmp-rank-and-transcripts.py transcripts --tickers AAPL,MSFT [--out src/data/transcripts/]

API FMP free : 250 calls/jour. Pour 3000 stés MC = 3000 calls = 12 jours.
Pour 3000 transcripts = 3000 calls = 12 jours.
"""

import argparse
import asyncio
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import urllib.request
import urllib.parse
import urllib.error
import ssl

# Fix SSL: macOS Python framework n'a pas les certs système → certifi en fallback
try:
    import certifi
    _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _SSL_CTX = ssl._create_unverified_context()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
LOG_PATH = PROJECT_ROOT / "sec-data/_meta/fmp.log"


def load_env():
    env_file = PROJECT_ROOT / ".env.local"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ[k.strip()] = v.strip().strip('"').strip("'")


_FMP_KEY_INDEX = 0
def fmp_get(path: str, params: dict) -> dict | list | None:
    """Round-robin sur les 2 clés FMP (250/j chacune = 500/j total).
    Fallback : si 1 clé renvoie 429 (rate limit), bascule sur l'autre.
    """
    global _FMP_KEY_INDEX
    keys = []
    for var in ("FMP_API_KEY", "FMP2_API_KEY", "FMP3_API_KEY", "FMP4_API_KEY"):
        v = os.environ.get(var)
        if v:
            keys.append(v)
    if not keys:
        return None

    # Tente chaque clé en commençant par celle round-robin courante
    last_err = None
    for offset in range(len(keys)):
        idx = (_FMP_KEY_INDEX + offset) % len(keys)
        params_try = dict(params)
        params_try["apikey"] = keys[idx]
        qs = urllib.parse.urlencode(params_try)
        url = f"https://financialmodelingprep.com/stable/{path}?{qs}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mettrik/1.0"})
            with urllib.request.urlopen(req, timeout=30, context=_SSL_CTX) as r:
                _FMP_KEY_INDEX = (idx + 1) % len(keys)  # rotate
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code in (429, 403):
                # quota épuisé sur cette clé, on tente la suivante
                continue
            return None
        except Exception as e:
            last_err = e
            return None
    return None


def cmd_rank(args, log):
    """Récupère market cap pour chaque ticker, trie desc, écrit JSON."""
    # Sources des tickers : SP1500 + top 100 CSV
    tickers = set()

    # SP1500
    sp1500_path = Path("/Volumes/250GB/Mettrik/sec-data/_meta/sp1500.json")
    if sp1500_path.exists():
        sp = json.loads(sp1500_path.read_text())
        for t in sp.get("tickers", []):
            tickers.add(t["ticker"])

    # Top 100 CSV (si fourni)
    if args.tickers_file:
        with open(args.tickers_file) as f:
            for line in f:
                parts = line.strip().split(",")
                if len(parts) >= 2 and parts[1] not in ("Ticker", ""):
                    tickers.add(parts[1].strip())

    log(f"Total tickers à ranker : {len(tickers)}")
    results = []
    for i, t in enumerate(sorted(tickers)):
        if i > 0 and i % 50 == 0:
            log(f"   {i}/{len(tickers)} done...")
        data = fmp_get("quote", {"symbol": t})
        if isinstance(data, list) and data:
            mc = data[0].get("marketCap", 0)
            if mc:
                results.append({"ticker": t, "market_cap": mc, "name": data[0].get("name", "")})
        time.sleep(0.1)  # ne pas surcharger

    results.sort(key=lambda x: x["market_cap"], reverse=True)
    out_path = Path(args.out or PROJECT_ROOT / "sec-data/_meta/tickers-by-mc.json")
    out_path.write_text(json.dumps(results, indent=2))
    log(f"✅ {len(results)} tickers ranked → {out_path}")
    log(f"   Top 5 : {[r['ticker'] for r in results[:5]]}")


def cmd_transcripts(args, log):
    """Pour chaque ticker : fetch dernier transcript, sauvegarde dans src/data/transcripts/."""
    out_dir = Path(args.out or PROJECT_ROOT / "src/data/transcripts")
    out_dir.mkdir(parents=True, exist_ok=True)
    tickers = [t.strip().upper() for t in args.tickers.split(",")] if args.tickers else []

    if args.tickers_file:
        with open(args.tickers_file) as f:
            for line in f:
                t = line.strip().split(",")[0].strip().upper()
                if t and t != "TICKER":
                    tickers.append(t)

    log(f"Total transcripts à fetch : {len(tickers)}")
    ok = 0
    fail = 0
    skip = 0

    # Pour chaque ticker, on tente Q4 dernière année puis fallback
    current_year = datetime.now().year
    for i, t in enumerate(tickers):
        out_file = out_dir / f"{t.lower()}.json"
        if out_file.exists():
            skip += 1
            continue

        if i > 0 and i % 20 == 0:
            log(f"   {i}/{len(tickers)} done... (ok={ok} fail={fail} skip={skip})")

        # Essaie année courante Q4 → Q3 → Q2 → Q1, puis année précédente Q4 etc.
        found = None
        for year in [current_year, current_year - 1]:
            for q in [4, 3, 2, 1]:
                data = fmp_get("earning-call-transcript", {"symbol": t, "year": year, "quarter": q})
                if isinstance(data, list) and data and data[0].get("content"):
                    found = data[0]
                    break
            if found:
                break

        if found:
            out_file.write_text(json.dumps(found, ensure_ascii=False, indent=2))
            log(f"   ✅ {t} : {found.get('period')} {found.get('year')} ({len(found.get('content', ''))} chars)")
            ok += 1
        else:
            log(f"   ❌ {t} : aucun transcript dispo")
            fail += 1

        time.sleep(0.3)  # rate limit safe (250/jour = 1 toutes les 6min mais on peut burst)

    log(f"\n=== TOTAL : {ok} OK, {fail} fail, {skip} skip ===")


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd")

    p_rank = sub.add_parser("rank")
    p_rank.add_argument("--tickers-file")
    p_rank.add_argument("--out")

    p_tr = sub.add_parser("transcripts")
    p_tr.add_argument("--tickers", help="ex: AAPL,MSFT")
    p_tr.add_argument("--tickers-file")
    p_tr.add_argument("--out")

    args = parser.parse_args()
    load_env()

    n_keys = sum(1 for v in ("FMP_API_KEY", "FMP2_API_KEY", "FMP3_API_KEY", "FMP4_API_KEY") if os.environ.get(v))
    if n_keys == 0:
        print("ERREUR : aucune clé FMP_API_KEY/FMP2/FMP3/FMP4")
        sys.exit(1)
    print(f"[fmp] {n_keys} clé(s) actives → {n_keys * 250} calls/jour")

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    log_fh = open(LOG_PATH, "a")

    def log(msg):
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{ts}] {msg}"
        print(line, flush=True)
        log_fh.write(line + "\n")
        log_fh.flush()

    if args.cmd == "rank":
        cmd_rank(args, log)
    elif args.cmd == "transcripts":
        cmd_transcripts(args, log)
    else:
        parser.print_help()
        sys.exit(1)

    log_fh.close()


if __name__ == "__main__":
    main()
