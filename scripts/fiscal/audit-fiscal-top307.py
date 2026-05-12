#!/usr/bin/env python3
"""
Audit fiscal year end + dernier filing 10-Q/10-K pour les 305 stés V1.8.

Sortie : src/data/fiscal-audit.json contenant pour chaque ticker (qui a un CIK
US SEC) :
  - cik
  - fiscalYearEndMonth (1-12, ex : 6 pour MSFT, 9 pour AAPL, 12 pour calendrier)
  - fiscalYearEndDay (1-31, dernier jour du mois fiscal)
  - latestForm ("10-Q" ou "10-K")
  - latestFilingDate (ISO, date où SEC a reçu le filing)
  - latestPeriodEnd (ISO, fin de période fiscale couverte par le filing)

Stés sans CIK (foreign ADR, .L .DE .PA etc) : skip (gérées séparément).

Yann 13 mai 2026 : base de données canonique pour FreshnessIndicator
fiscal-aware. Re-run mensuel suffisant (fiscal year end ne change pas).
"""
from __future__ import annotations
import json
import ssl
import urllib.request
import urllib.error
import time
from pathlib import Path

# macOS Python SSL : utiliser ssl context permissif pour SEC (data publique).
_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

ROOT = Path(__file__).resolve().parents[2]
TICKERS_FILE = ROOT / "src/data/v1-8-tickers-sorted.json"
CIK_FILE = Path("/tmp/sec-ticker-cik.json")
OUT_FILE = ROOT / "src/data/fiscal-audit.json"

UA = "Mettrik AI Research yann@mettrik.ai"


def fetch_json(url: str, retries: int = 3) -> dict | None:
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=20, context=_SSL_CTX) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(2 ** attempt)
                continue
            return None
        except Exception:
            time.sleep(1)
            continue
    return None


def audit_ticker(ticker: str, cik: str) -> dict | None:
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    d = fetch_json(url)
    if not d:
        return None
    fy_end = d.get("fiscalYearEnd", "")  # ex "0930", "0630", "1231"
    if not fy_end or len(fy_end) != 4:
        return None
    fy_end_month = int(fy_end[:2])
    fy_end_day = int(fy_end[2:])
    r = d.get("filings", {}).get("recent", {})
    forms = r.get("form", [])
    dates = r.get("filingDate", [])
    periods = r.get("reportDate", [])
    latest_form = None
    latest_filing = None
    latest_period = None
    for i, form in enumerate(forms):
        if form in ("10-Q", "10-K", "20-F", "6-K"):
            latest_form = form
            latest_filing = dates[i]
            latest_period = periods[i]
            break
    return {
        "ticker": ticker,
        "cik": cik,
        "fiscalYearEndMonth": fy_end_month,
        "fiscalYearEndDay": fy_end_day,
        "latestForm": latest_form,
        "latestFilingDate": latest_filing,
        "latestPeriodEnd": latest_period,
    }


def main() -> None:
    tickers = json.loads(TICKERS_FILE.read_text())
    cik_map = json.loads(CIK_FILE.read_text())

    out = {}
    skipped = []
    foreign = []
    for i, t in enumerate(tickers):
        # Skip foreign (suffixes .PA .DE .L .SW .MI .ST .HE .CO .AS .MC .OL .BR .LS .KS .T)
        if "." in t or "-" in t:
            foreign.append(t)
            continue
        cik = cik_map.get(t)
        if not cik:
            skipped.append(t)
            continue
        res = audit_ticker(t, cik)
        if not res:
            skipped.append(t)
            continue
        out[t] = res
        # SEC rate-limit: 10 req/sec
        time.sleep(0.15)
        if (i + 1) % 20 == 0:
            print(f"  {i+1}/{len(tickers)} done, last={t}")

    # Stats: fiscal-shifted (FY end != Dec)
    shifted = {k: v for k, v in out.items() if v["fiscalYearEndMonth"] != 12}
    print()
    print(f"=== AUDIT TERMINÉ ===")
    print(f"Total V1.8 : {len(tickers)}")
    print(f"Avec CIK + fiscal : {len(out)}")
    print(f"Foreign (skip pour ce script) : {len(foreign)}")
    print(f"Sans CIK / sans fiscal : {len(skipped)}")
    print()
    print(f"STÉS À EXERCICE DÉCALÉ (FY end != décembre) : {len(shifted)}")
    by_month = {}
    for k, v in shifted.items():
        m = v["fiscalYearEndMonth"]
        by_month.setdefault(m, []).append(k)
    for m in sorted(by_month.keys()):
        names = ["Jan","Fév","Mars","Avr","Mai","Juin","Juil","Août","Sept","Oct","Nov","Déc"]
        print(f"  FY end {names[m-1]} ({m}) : {len(by_month[m])} stés → {', '.join(by_month[m][:10])}{'...' if len(by_month[m]) > 10 else ''}")

    OUT_FILE.write_text(json.dumps(out, indent=2))
    print(f"\nSauvé : {OUT_FILE}")


if __name__ == "__main__":
    main()
