#!/usr/bin/env python3
"""
Extrait Earning Slides (ES) + Earning Releases (ER) depuis les exhibits
des earnings 8-K pour les 5 sociétés V1 (GOOGL, META, MSCI, SPGI, CAT).

Stockage cible : /Users/yann/Desktop/Projets 2025 26/App KPI/DATA/<NOM>/ES|ER/
où <NOM> est le nom de dossier déjà utilisé par l'user :
  GOOGL → Google, META → META, MSCI → MSCI, SPGI → SPGI, CAT → CATERPILLAR

Algo :
  1. Pour chaque ticker, fetch tous les 8-K via SEC submissions
  2. Pour chaque 8-K, fetch l'index.json du dossier EDGAR
     → liste les exhibits (ex99-1, ex99-2, etc.)
  3. Download les exhibits matchant 99.1 (ER) et 99.2/99.3 (ES)
  4. Skip si déjà téléchargé

Sources EDGAR :
  - https://data.sec.gov/submissions/CIK<X>.json (filings list)
  - https://www.sec.gov/Archives/edgar/data/<cik>/<accession>/index.json
"""
import json
import re
import ssl
import sys
import time
import urllib.request
from pathlib import Path
from datetime import datetime, timedelta

USER_AGENT = "Mettrik Research yannricordeau100@gmail.com"
RATE_DELAY_S = 0.5  # 2 req/s pour ne pas perturber les 2 process en cours

DATA_DIR = Path("/Users/yann/Desktop/Projets 2025 26/App KPI/DATA")

V1_TICKERS = {
    "GOOGL": {"name": "Alphabet Inc.", "folder": "Google"},
    "META":  {"name": "Meta Platforms", "folder": "META"},
    "MSCI":  {"name": "MSCI Inc.",      "folder": "MSCI"},
    "SPGI":  {"name": "S&P Global",     "folder": "SPGI"},
    "CAT":   {"name": "Caterpillar",    "folder": "CATERPILLAR"},
}

# Combien d'années en arrière (5 ans = 20 quarters)
YEARS_BACK = 5

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

_last_call = 0.0


def http_get(url: str) -> bytes:
    global _last_call
    delta = time.time() - _last_call
    if delta < RATE_DELAY_S:
        time.sleep(RATE_DELAY_S - delta)
    _last_call = time.time()
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept-Encoding": "gzip, deflate",
        "Host": url.split("/")[2],
    })
    with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as resp:
        data = resp.read()
        if resp.headers.get("Content-Encoding") == "gzip":
            import gzip as gz
            data = gz.decompress(data)
    return data


def http_json(url: str) -> dict:
    return json.loads(http_get(url).decode("utf-8"))


def get_cik(ticker: str) -> int | None:
    """Resolve ticker → CIK via SEC company_tickers.json (cached locally)."""
    cache = Path("/tmp/_sec_company_tickers.json")
    if cache.exists() and (time.time() - cache.stat().st_mtime) < 86400:
        all_t = json.loads(cache.read_text())
    else:
        all_t = http_json("https://www.sec.gov/files/company_tickers.json")
        cache.write_text(json.dumps(all_t))
    for entry in all_t.values():
        if entry["ticker"] == ticker:
            return entry["cik_str"]
    return None


def get_8k_filings(cik: int, years_back: int = 5) -> list[dict]:
    """Fetch toutes les soumissions 8-K récentes (<= years_back ans)."""
    main = http_json(f"https://data.sec.gov/submissions/CIK{cik:010d}.json")
    recent = main.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    accs = recent.get("accessionNumber", [])
    dates = recent.get("filingDate", [])
    items = recent.get("items", [])  # ex: "2.02,9.01"
    primary = recent.get("primaryDocument", [])
    cutoff = (datetime.utcnow() - timedelta(days=365 * years_back)).strftime("%Y-%m-%d")
    out = []
    for i in range(len(forms)):
        if forms[i] != "8-K":
            continue
        if dates[i] < cutoff:
            continue
        out.append({
            "accession": accs[i],
            "date": dates[i],
            "items": items[i] if i < len(items) else "",
            "primary": primary[i] if i < len(primary) else "",
        })
    return out


def fetch_filing_index(cik: int, accession: str) -> list[dict]:
    """Fetch l'index.json d'une soumission, retourne la liste des fichiers."""
    accession_clean = accession.replace("-", "")
    url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession_clean}/index.json"
    try:
        data = http_json(url)
    except Exception as e:
        print(f"     ! index.json failed for {accession}: {e}")
        return []
    return data.get("directory", {}).get("item", [])


def classify_exhibit(name: str, filing_type_hint: str = "") -> str | None:
    """Identifie si le fichier est ER (99.1) ou ES (99.2+) ou rien.
    Retourne 'ER', 'ES', ou None.
    """
    n = name.lower()
    # Skip XBRL / metadata / images
    if n.endswith((".xml", ".xsd", ".jpg", ".png", ".gif", ".css", ".js", ".zip")):
        return None
    if "metalinks" in n or "filingsummary" in n or "-index" in n:
        return None
    # Patterns ES en premier (slides) — souvent visuels donc PDF ou htm volumineux
    es_patterns = [
        r"ex.?99[._-]?2", r"ex.?99[._-]?3", r"exhibit.?99[._-]?2", r"99-2\.", r"_992\.", r"_99_2",
        r"earnings[._-]?presentation", r"earnings[._-]?slides", r"earnings[._-]?deck",
        r"[._-]presentation", r"[._-]slides", r"investor[._-]?presentation",
        r"q[1-4][._-]?20\d{2}[._-]?slides",
    ]
    for p in es_patterns:
        if re.search(p, n):
            return "ES"
    # Patterns ER (press release texte)
    er_patterns = [
        r"ex.?99[._-]?1", r"exhibit.?99[._-]?1", r"99-1\.", r"_991\.", r"_99_1",
        r"earnings[._-]?release",
        r"[._-]?earnings\.htm", r"earnings[._-]?announcement",
        r"q[1-4][._-]?20\d{2}[._-]?earnings",
        r"results[._-]?announcement",
    ]
    for p in er_patterns:
        if re.search(p, n):
            return "ER"
    return None


def download_exhibit(cik: int, accession: str, name: str, dest: Path) -> int:
    accession_clean = accession.replace("-", "")
    url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession_clean}/{name}"
    content = http_get(url)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(content)
    return len(content)


def is_earnings_8k(items_str: str) -> bool:
    """Item 2.02 = Results of Operations and Financial Condition (earnings)."""
    return "2.02" in items_str


def main():
    print(f"=== Extraction ES + ER depuis SEC 8-K exhibits ===")
    print(f"Cible : {DATA_DIR}")
    print(f"Période : {YEARS_BACK} dernières années")
    print()

    summary = {}
    for ticker, info in V1_TICKERS.items():
        print(f"\n--- {ticker} ({info['name']}) ---")
        cik = get_cik(ticker)
        if not cik:
            print(f"  ! CIK introuvable pour {ticker}")
            continue
        print(f"  CIK : {cik}")
        all_8k = get_8k_filings(cik, YEARS_BACK)
        # Filtrer earnings (Item 2.02)
        earnings_8k = [f for f in all_8k if is_earnings_8k(f["items"])]
        print(f"  8-K total {YEARS_BACK} ans : {len(all_8k)} (dont earnings : {len(earnings_8k)})")

        n_er = 0
        n_es = 0
        n_skipped = 0
        for f in earnings_8k:
            files = fetch_filing_index(cik, f["accession"])
            if not files:
                continue
            for file in files:
                name = file.get("name", "")
                if not name:
                    continue
                # Skip dirs / images / xml indexes
                if name.lower().endswith((".xml", ".xsd", ".jpg", ".png", ".gif")):
                    continue
                # Skip the primary 8-K cover
                if name == f["primary"]:
                    continue
                kind = classify_exhibit(name)
                if not kind:
                    continue
                # Determine file extension
                ext = Path(name).suffix or ".htm"
                # Skip .htm if there's a corresponding .pdf
                year = f["date"][:4]
                date = f["date"]
                folder = DATA_DIR / info["folder"] / kind / year
                dest_name = f"{ticker}_{date}_{Path(name).name}"
                dest = folder / dest_name
                if dest.exists():
                    n_skipped += 1
                    continue
                try:
                    size = download_exhibit(cik, f["accession"], name, dest)
                    if kind == "ER": n_er += 1
                    else: n_es += 1
                    print(f"    ✓ {kind} {date} {Path(name).name} ({size//1024} KB)")
                except Exception as e:
                    print(f"    ! {kind} {date} {name} failed: {e}")

        print(f"  Total : {n_er} ER + {n_es} ES + {n_skipped} skipped")
        summary[ticker] = {"ER": n_er, "ES": n_es, "skipped": n_skipped}

    print()
    print("=== RÉSUMÉ ===")
    for ticker, s in summary.items():
        print(f"  {ticker:6} : {s['ER']:>2} ER + {s['ES']:>2} ES (skipped {s['skipped']})")


if __name__ == "__main__":
    main()
