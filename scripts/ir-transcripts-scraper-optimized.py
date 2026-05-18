#!/usr/bin/env python3
"""
IR transcripts scraper ULTRA-OPTIMISÉ pour les sté EU pures (top 50).

Stratégie:
1. yfinance.info["website"] → page IR officielle
2. Test 8 chemins IR communs (/investors, /investor-relations, /en/investors...)
3. Parse HTML pour liens PDFs avec keywords (transcript, earnings, q1/q2/q3/q4 + year)
4. Download PDFs candidats en parallèle
5. pdftotext + check content (chiffres, guidance, "operator")

Stés EU pures top 50:
  ROG.SW, AZN.ST, 9984.T, OR.PA, SIE.DE, TTE.PA, ABBN.SW

Output: src/data/transcripts-ir/<ticker>.json
"""
import json
import os
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "src/data/transcripts-ir"
OUT_DIR.mkdir(parents=True, exist_ok=True)
PDF_CACHE = ROOT / "sec-data/_meta/ir-pdf-cache"
PDF_CACHE.mkdir(parents=True, exist_ok=True)
LOG_PATH = ROOT / "sec-data/_meta/ir-transcripts-scraper.log"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
HEADERS = {"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/pdf,*/*"}

IR_PATHS = [
    "/investors", "/investor-relations", "/en/investors", "/en/investor-relations",
    "/about/investors", "/corporate/investors", "/about-us/investors", "/ir",
    "/investor", "/financial-information",
]

TRANSCRIPT_KEYWORDS = [
    "transcript", "earnings-call", "earnings_call", "earningscall",
    "conference-call", "conference_call",
    "earnings-presentation", "results-presentation",
    "q1-", "q2-", "q3-", "q4-",
    "first-quarter", "second-quarter", "third-quarter", "fourth-quarter",
    "annual-report", "interim-report", "half-year",
]

NUMBER_PATTERN = re.compile(r"(?:\$|€|£|¥)\s*[\d,]+(?:\.\d+)?\s*(?:billion|million|B|M|bn|mn)?", re.I)
GUIDANCE_KEYS = ["guidance", "expect", "outlook", "forecast", "anticipate", "target"]


def log(msg: str):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_PATH, "a") as f:
        f.write(line + "\n")


def get_ir_url(ticker: str) -> list[str]:
    """Retourne candidats URLs IR à essayer."""
    try:
        info = yf.Ticker(ticker).info
        website = info.get("website") or info.get("Website") or ""
    except Exception:
        website = ""
    if not website:
        return []
    if not website.startswith("http"):
        website = "https://" + website
    base = website.rstrip("/")
    return [base + p for p in IR_PATHS]


def fetch_page(url: str, timeout: int = 15) -> str | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout, allow_redirects=True)
        if r.status_code == 200 and "text/html" in r.headers.get("content-type", ""):
            return r.text
    except Exception:
        pass
    return None


def extract_pdf_links(html: str, base_url: str) -> list[str]:
    """Extrait tous les liens PDF avec keywords transcript/earnings."""
    if not html:
        return []
    candidates = []
    for match in re.finditer(r'href=["\']([^"\']+\.pdf[^"\']*)["\']', html, re.I):
        link = match.group(1)
        full = urljoin(base_url, link)
        link_l = full.lower()
        # Match au moins 1 keyword
        if any(kw in link_l for kw in TRANSCRIPT_KEYWORDS):
            candidates.append(full)
    # Dedupe + limit 20 PDFs/sté
    seen, unique = set(), []
    for c in candidates:
        if c not in seen:
            seen.add(c)
            unique.append(c)
    return unique[:20]


def download_pdf(url: str, ticker: str) -> str | None:
    """Télécharge PDF, retourne chemin local."""
    fname = re.sub(r"[^a-zA-Z0-9.-]", "_", urlparse(url).path.split("/")[-1])[:80]
    if not fname.endswith(".pdf"):
        fname += ".pdf"
    out = PDF_CACHE / ticker / fname
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists() and out.stat().st_size > 1024:
        return str(out)
    try:
        r = requests.get(url, headers=HEADERS, timeout=30, stream=True)
        if r.status_code != 200:
            return None
        with open(out, "wb") as f:
            for chunk in r.iter_content(chunk_size=65536):
                f.write(chunk)
        if out.stat().st_size < 1024:
            out.unlink(missing_ok=True)
            return None
        return str(out)
    except Exception:
        out.unlink(missing_ok=True)
        return None


def pdf_to_text(pdf_path: str) -> str | None:
    try:
        r = subprocess.run(
            ["/opt/homebrew/bin/pdftotext", "-q", "-layout", pdf_path, "-"],
            capture_output=True, text=True, timeout=60,
        )
        if r.returncode == 0 and r.stdout:
            return r.stdout
    except Exception:
        pass
    return None


def is_transcript_quality(text: str) -> dict:
    """Vérifie si le texte ressemble à un earnings transcript."""
    if not text or len(text) < 2000:
        return {"is_transcript": False, "reason": "too_short"}
    n_money = len(NUMBER_PATTERN.findall(text))
    n_guidance = sum(text.lower().count(k) for k in GUIDANCE_KEYS)
    has_operator = "operator" in text.lower() or "moderator" in text.lower()
    has_qa = "question" in text.lower() and "answer" in text.lower()
    score = (n_money * 0.3) + (n_guidance * 1.0) + (10 if has_operator else 0) + (5 if has_qa else 0)
    return {
        "is_transcript": score >= 15 and n_money >= 5 and n_guidance >= 3,
        "score": score,
        "n_money": n_money,
        "n_guidance": n_guidance,
        "has_operator": has_operator,
        "has_qa": has_qa,
    }


def process_ticker(ticker: str) -> dict:
    out_file = OUT_DIR / f"{ticker.lower().replace('.', '_')}.json"
    if out_file.exists():
        try:
            d = json.loads(out_file.read_text())
            if d.get("transcripts"):
                return {"ticker": ticker, "status": "skip", "n": len(d["transcripts"])}
        except Exception:
            pass

    log(f"--- {ticker} ---")
    ir_urls = get_ir_url(ticker)
    if not ir_urls:
        log(f"   {ticker}: no IR URL from yfinance")
        return {"ticker": ticker, "status": "no_ir_url", "n": 0}

    # Test paths jusqu'à trouver une page qui charge
    html = None
    base = None
    for url in ir_urls[:6]:
        html = fetch_page(url)
        if html and len(html) > 5000:
            base = url
            log(f"   {ticker}: IR found at {url} ({len(html)} chars)")
            break
    if not html:
        return {"ticker": ticker, "status": "no_ir_page", "n": 0}

    # Extraire candidats PDFs
    pdf_links = extract_pdf_links(html, base)
    log(f"   {ticker}: {len(pdf_links)} PDF candidates")
    if not pdf_links:
        return {"ticker": ticker, "status": "no_pdf_candidates", "n": 0}

    # Download + check chaque PDF
    transcripts = []
    for pdf_url in pdf_links[:10]:
        path = download_pdf(pdf_url, ticker)
        if not path:
            continue
        text = pdf_to_text(path)
        if not text:
            continue
        check = is_transcript_quality(text)
        if check["is_transcript"]:
            transcripts.append({
                "source_url": pdf_url,
                "local_path": path,
                "length": len(text),
                "quality": check,
                "content_excerpt": text[:5000],
            })
            log(f"   {ticker}: ✅ TRANSCRIPT FOUND ({check['n_money']}m, {check['n_guidance']}g, {len(text)}c)")

    if not transcripts:
        return {"ticker": ticker, "status": "no_transcript_quality", "n": 0}

    payload = {
        "ticker": ticker.upper(),
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "ir_base": base,
        "transcripts": transcripts,
    }
    out_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    return {"ticker": ticker, "status": "ok", "n": len(transcripts)}


def main():
    # Top 50 EU pures (avec point) + extension à toutes les EU pures détectées en input
    target = sys.argv[1:] if len(sys.argv) > 1 else None
    if not target:
        d = json.loads((ROOT / "src/data/v1-7-tickers-sorted.json").read_text())
        target = [t for t in d[:50] if "." in t]
    log(f"START : {len(target)} tickers (EU pures top 50) → {target}")

    counts = {}
    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = {ex.submit(process_ticker, tk): tk for tk in target}
        for fut in as_completed(futures):
            try:
                r = fut.result()
            except Exception as e:
                tk = futures[fut]
                log(f"   ❌ {tk}: exception {e}")
                continue
            counts[r["status"]] = counts.get(r["status"], 0) + 1
    log(f"END : {counts}")


if __name__ == "__main__":
    main()
