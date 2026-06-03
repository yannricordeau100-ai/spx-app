#!/usr/bin/env python3
"""Download discovered PDFs + convert to text."""
import json
import os
import subprocess
import time

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
BASE = "/Users/yann/Mettrik/sec-data/cat3-european"

with open("/Users/yann/spx-app/scripts/sa14-tmp/discovered_urls.json") as f:
    URLS = json.load(f)

log = {"ok": [], "fail": []}
for ticker, years in URLS.items():
    if ticker.startswith("_"):
        continue
    out_dir = os.path.join(BASE, ticker, "half-year")
    os.makedirs(out_dir, exist_ok=True)
    for year, url in years.items():
        out_pdf = os.path.join(out_dir, f"{year}-H1.pdf")
        if os.path.exists(out_pdf) and os.path.getsize(out_pdf) > 100_000:
            log["ok"].append(f"{ticker}/{year} (cached)")
            print(f"CACHED {ticker} {year}")
            continue
        try:
            r = subprocess.run(
                ["curl", "-sL", "-A", UA, "--max-time", "30",
                 "-o", out_pdf, "-w", "%{http_code}|%{size_download}", url],
                capture_output=True, text=True, timeout=40,
            )
            status, size = (r.stdout.strip() + "|0|0").split("|")[:2]
            size_i = int(size or 0)
            if status == "200" and size_i > 100_000:
                with open(out_pdf, "rb") as f:
                    if f.read(4) == b"%PDF":
                        log["ok"].append(f"{ticker}/{year} ({size_i} bytes)")
                        print(f"OK {ticker} {year} {size_i}")
                        # Convert to text
                        txt = out_pdf.replace(".pdf", ".txt")
                        subprocess.run(["pdftotext", "-layout", out_pdf, txt], timeout=60)
                    else:
                        os.remove(out_pdf)
                        log["fail"].append(f"{ticker}/{year} (not PDF)")
                        print(f"FAIL {ticker} {year} not-pdf")
            else:
                if os.path.exists(out_pdf):
                    os.remove(out_pdf)
                log["fail"].append(f"{ticker}/{year} HTTP={status} size={size_i}")
                print(f"FAIL {ticker} {year} {status} {size_i}")
        except Exception as e:
            log["fail"].append(f"{ticker}/{year} ERR={e}")
            print(f"ERR {ticker} {year} {e}")
        time.sleep(1.5)  # be gentle

with open("/Users/yann/spx-app/scripts/sa14-tmp/download_log.json", "w") as f:
    json.dump(log, f, indent=2)
print(f"\nOK={len(log['ok'])} FAIL={len(log['fail'])}")
