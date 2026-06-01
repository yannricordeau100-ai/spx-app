#!/usr/bin/env python3
"""
Batch download de PDFs annual reports Nordiques depuis URLs trouvées via WebSearch.

Lit un fichier TSV: URL <tab> TICKER <tab> YEAR <tab> COMPANY_NAME
Pour chaque ligne:
  1. curl le PDF (UA Chrome, timeout 600s)
  2. pdftotext -layout
  3. Anti-cross-pollution: grep COMPANY_NAME ≥5 mentions
  4. Si OK: écrit sec-data/cat3-european/<TICKER>/annual-text/<YEAR>.txt
  5. Garde PDF dans sec-data/cat3-european/<TICKER>/annual-report/<YEAR>.pdf
  6. Skip si <YEAR>.txt déjà ≥30KB

Usage: python3 scripts/nordic-batch-download.py <tsv_file>
"""
import csv
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUT_BASE = PROJECT_ROOT / "sec-data/cat3-european"
LOG_PATH = PROJECT_ROOT / "sec-data/_meta/nordic-batch.log"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"


def log(msg, fh=None):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    if fh:
        fh.write(line + "\n")
        fh.flush()


def download(url, dest, timeout=600):
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        result = subprocess.run([
            "curl", "-sSL", "-k",
            "--max-time", str(timeout),
            "--max-filesize", "104857600",  # 100 MB
            "-A", UA,
            "-H", "Accept: application/pdf,*/*",
            "-o", str(dest),
            url,
        ], capture_output=True, timeout=timeout + 30)
        if result.returncode != 0:
            return False, f"curl rc={result.returncode}: {result.stderr.decode()[:150]}"
        if not dest.exists():
            return False, "no output"
        sz = dest.stat().st_size
        if sz < 50000:
            return False, f"too small ({sz} bytes)"
        with open(dest, "rb") as f:
            header = f.read(8)
        if not header.startswith(b"%PDF"):
            return False, f"not PDF (header={header[:8]!r})"
        return True, f"{sz} bytes"
    except subprocess.TimeoutExpired:
        return False, "timeout"
    except Exception as e:
        return False, str(e)


def pdf2txt(pdf, txt):
    try:
        subprocess.run(
            ["/opt/homebrew/bin/pdftotext", "-layout", str(pdf), str(txt)],
            check=True, capture_output=True, timeout=300,
        )
        if not txt.exists() or txt.stat().st_size < 10000:
            return False, "txt too small"
        return True, f"{txt.stat().st_size} chars"
    except Exception as e:
        return False, str(e)


def validate(txt_path, company_name, min_mentions=5):
    try:
        with open(txt_path, "r", errors="ignore") as f:
            content = f.read()
        # Test multi: nom complet + premier mot significatif
        full_count = content.count(company_name)
        words = [w for w in company_name.split() if w.lower() not in ("the", "a", "ab", "asa", "oyj", "as", "plc", "group", "and", "of")]
        primary = words[0] if words else company_name
        primary_count = content.lower().count(primary.lower())
        if full_count >= min_mentions:
            return True, f"full={full_count}"
        if primary_count >= min_mentions * 3:
            return True, f"primary({primary})={primary_count}"
        return False, f"full={full_count}, primary({primary})={primary_count}"
    except Exception as e:
        return False, str(e)


def process(url, ticker, year, name, fh, force=False):
    out_dir = OUT_BASE / ticker / "annual-text"
    pdf_dir = OUT_BASE / ticker / "annual-report"
    out_dir.mkdir(parents=True, exist_ok=True)
    pdf_dir.mkdir(parents=True, exist_ok=True)

    txt_dest = out_dir / f"{year}.txt"
    pdf_dest = pdf_dir / f"{year}.pdf"

    if not force and txt_dest.exists() and txt_dest.stat().st_size > 30000:
        # Validate existing
        ok, msg = validate(txt_dest, name)
        if ok:
            log(f"   {ticker} {year}: SKIP existing valid ({msg})", fh)
            return "skip-valid"
        else:
            log(f"   {ticker} {year}: existing INVALID ({msg}), re-download", fh)

    log(f"   {ticker} {year}: download {url[:120]}", fh)
    ok, msg = download(url, pdf_dest)
    if not ok:
        log(f"      DL FAIL: {msg}", fh)
        return "dl-fail"
    log(f"      DL OK: {msg}", fh)
    ok, msg = pdf2txt(pdf_dest, txt_dest)
    if not ok:
        log(f"      TXT FAIL: {msg}", fh)
        return "txt-fail"
    log(f"      TXT OK: {msg}", fh)
    ok, msg = validate(txt_dest, name)
    if not ok:
        log(f"      VALIDATE FAIL: {msg} -> reject", fh)
        # Move to REJECTED for audit
        rej_pdf = pdf_dir / f"{year}.REJECTED.pdf"
        rej_txt = pdf_dir / f"{year}.REJECTED.txt"
        try:
            pdf_dest.rename(rej_pdf)
            txt_dest.rename(rej_txt)
        except Exception:
            pass
        return "rejected"
    log(f"      ✓ {ticker} {year} OK ({msg})", fh)
    return "ok"


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/nordic-batch-download.py <tsv_file>")
        sys.exit(1)
    tsv = sys.argv[1]
    force = "--force" in sys.argv

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    fh = open(LOG_PATH, "a")
    log("=" * 70, fh)
    log(f"START batch from {tsv}", fh)

    counts = {"ok": 0, "skip-valid": 0, "dl-fail": 0, "txt-fail": 0, "rejected": 0}
    with open(tsv) as f:
        for row in csv.reader(f, delimiter="\t"):
            if len(row) < 4 or row[0].startswith("#"):
                continue
            url, ticker, year, name = row[0].strip(), row[1].strip(), row[2].strip(), row[3].strip()
            try:
                r = process(url, ticker, year, name, fh, force=force)
                counts[r] = counts.get(r, 0) + 1
            except Exception as e:
                log(f"   EXCEPTION {ticker} {year}: {e}", fh)
                counts["dl-fail"] = counts.get("dl-fail", 0) + 1
    log(f"=== TOTAL: {counts} ===", fh)
    fh.close()


if __name__ == "__main__":
    main()
