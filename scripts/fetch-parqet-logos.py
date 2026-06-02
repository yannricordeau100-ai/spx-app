#!/usr/bin/env python3
"""SA16 batch Parqet 512x512 logos pour V1.9.5 (652 stés).

Fetch logos from Parqet API, validate, backup existing, write to public/logos/.
"""
import json
import os
import shutil
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image

ROOT = Path("/Users/yann/spx-app")
TICKERS_FILE = ROOT / "src/data/v1-9-5-clean-all-tickers.json"
LOGOS_DIR = ROOT / "public/logos"
BACKUP_DIR = LOGOS_DIR / ".backup-parqet"
AUDIT_FILE = ROOT / "src/data/logos-parqet-audit.json"

PARQET_URL = "https://assets.parqet.com/logos/symbol/{ticker}?format=png&size=512"

# GOOG → GOOGL alias (Parqet n'a peut-être pas GOOG, prendre logo GOOGL)
TICKER_ALIASES = {
    "GOOG": "GOOGL",
}

# Class B fallback patterns: BRK.B → BRK-B, BF.B → BF-B
def gen_variants(ticker: str) -> list[str]:
    variants = [ticker]
    if ticker in TICKER_ALIASES:
        variants.insert(0, TICKER_ALIASES[ticker])
    # Class B/A: point → dash
    if "." in ticker:
        base, suffix = ticker.rsplit(".", 1)
        if suffix in {"A", "B", "C"}:
            variants.append(f"{base}-{suffix}")
    return variants


def fetch_one(ticker: str) -> dict:
    """Returns dict with status, ticker, variant used, reason."""
    result = {"ticker": ticker, "status": "404", "variant": None, "reason": ""}
    for variant in gen_variants(ticker):
        url = PARQET_URL.format(ticker=variant)
        try:
            r = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        except Exception as e:
            result["reason"] = f"net_error: {e}"
            continue
        if r.status_code != 200:
            result["reason"] = f"http_{r.status_code}"
            continue
        ct = r.headers.get("Content-Type", "")
        content = r.content
        if not content.startswith(b"\x89PNG"):
            result["reason"] = f"not_png (ct={ct}, magic={content[:4]!r})"
            continue
        if len(content) < 200:
            result["reason"] = f"too_small ({len(content)}b)"
            continue
        # Validate dimensions via PIL
        try:
            img = Image.open(BytesIO(content))
            w, h = img.size
        except Exception as e:
            result["reason"] = f"pil_error: {e}"
            continue
        if w < 64:
            result["reason"] = f"width_too_small ({w}px)"
            continue
        # Placeholder detection: small file + small dims = Parqet grey monogram circle
        if len(content) < 500 and w < 100:
            result["status"] = "placeholder"
            result["reason"] = f"likely_placeholder ({len(content)}b, {w}x{h})"
            result["variant"] = variant
            return result
        # OK
        result["status"] = "ok"
        result["variant"] = variant
        result["size"] = len(content)
        result["dims"] = f"{w}x{h}"
        result["_content"] = content  # internal, will be written
        return result
    return result


def write_logo(ticker: str, content: bytes) -> None:
    """Backup existing then write new logo."""
    dst = LOGOS_DIR / f"{ticker}.png"
    if dst.exists():
        backup = BACKUP_DIR / f"{ticker}.png"
        if not backup.exists():
            shutil.copy2(dst, backup)
    dst.write_bytes(content)


def main():
    tickers = json.loads(TICKERS_FILE.read_text())["tickers"]
    print(f"Total tickers: {len(tickers)}")

    audit = {"ok": [], "placeholder": [], "404": [], "errors": []}

    # Concurrency: 6 workers, ~100ms sleep handled by request latency naturally
    with ThreadPoolExecutor(max_workers=6) as exe:
        futures = {exe.submit(fetch_one, t): t for t in tickers}
        done = 0
        for fut in as_completed(futures):
            done += 1
            result = fut.result()
            ticker = result["ticker"]
            status = result["status"]
            if status == "ok":
                write_logo(ticker, result.pop("_content"))
                audit["ok"].append({
                    "ticker": ticker,
                    "variant": result["variant"],
                    "size": result["size"],
                    "dims": result["dims"],
                })
            elif status == "placeholder":
                audit["placeholder"].append({
                    "ticker": ticker,
                    "variant": result["variant"],
                    "reason": result["reason"],
                })
            else:
                audit["404"].append({
                    "ticker": ticker,
                    "reason": result["reason"],
                })
            if done % 50 == 0:
                print(f"  {done}/{len(tickers)} OK={len(audit['ok'])} PH={len(audit['placeholder'])} 404={len(audit['404'])}")

    # Write audit
    AUDIT_FILE.write_text(json.dumps(audit, indent=2, ensure_ascii=False))
    print(f"\n=== AUDIT ===")
    print(f"OK (good logos written):    {len(audit['ok'])}")
    print(f"Placeholder (skip, keep):   {len(audit['placeholder'])}")
    print(f"404 (no logo found):         {len(audit['404'])}")
    print(f"Total: {len(audit['ok']) + len(audit['placeholder']) + len(audit['404'])}")
    print(f"\nAudit written to: {AUDIT_FILE}")
    # Sample 404
    if audit["404"]:
        print("\nSample 404 (first 10):")
        for x in audit["404"][:10]:
            print(f"  {x['ticker']}: {x['reason']}")
    if audit["placeholder"]:
        print("\nSample placeholder (first 5):")
        for x in audit["placeholder"][:5]:
            print(f"  {x['ticker']} (via {x['variant']}): {x['reason']}")


if __name__ == "__main__":
    main()
