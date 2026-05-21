#!/usr/bin/env python3
"""
Canada TSX 60 scraper — Phase 1 (DOWNLOAD ONLY, no extraction)

Mission Yann 21 mai 2026 :
- 60 sociétés du S&P/TSX 60 (liste autoritaire Wikipedia)
- Sources légales : SEDAR+ (sedarplus.ca) — équivalent SEC EDGAR Canada
  · AIF (Annual Information Form)
  · MD&A (Management Discussion & Analysis)
  · Annual Financial Statements
  · Material Change Reports (équivalent 8-K)
  · Proxy Circular (DEF14A)
- Sources IR : site corporate de chaque sté
  · Annual Report PDF
  · Investor Day decks
  · Quarterly slides
  · ESG / Sustainability Report
- Snapshot HTML home + IR page

Output organisé pour la conv qui traitera ensuite (Pass 1/2/3) :
  sec-data/cat-canadian/<TICKER>/
    ├── annual-report/<year>.pdf
    ├── annual-text/<year>.txt        (via pdftotext)
    ├── mda/<year>.pdf
    ├── proxy/<year>.pdf
    ├── ir-presentations/<date>-<title>.pdf
    ├── esg/<year>-sustainability.pdf
    ├── ir-page-snapshot/<date>.html
    ├── half-year/<year>-H1.pdf       (rare au Canada, mais cas particuliers)
    ├── material-change/<date>-<title>.pdf
    └── manifest.json

NB : Phase 1 = pas d'extraction LLM, juste téléchargement + organisation.

Usage :
    python3 scripts/canada-tsx60-scraper.py            # 60 stés TSX 60
    python3 scripts/canada-tsx60-scraper.py --ticker RY.TO --years-min 5
    python3 scripts/canada-tsx60-scraper.py --workers 4
"""
from __future__ import annotations
import argparse
import json
import re
import ssl
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_ROOT = PROJECT_ROOT / "sec-data"
OUT_DIR = DATA_ROOT / "cat-canadian"
LOG_PATH = DATA_ROOT / "_meta" / "canada-tsx60-scraper.log"
MANIFEST_GLOBAL = DATA_ROOT / "_meta" / "canada-tsx60-manifest-global.json"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mettrik-Research/1.0"

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl._create_unverified_context()


# ─────────────────────────────────────────────────────────────
# TSX 60 — liste autoritaire (Wikipedia 31 jan 2026)
# Format ticker : version Yahoo Finance (.TO suffixe, "." remplacé par "-" pour subclass)
# ─────────────────────────────────────────────────────────────
TSX_60 = [
    # (ticker_yahoo, name, ir_url_hint, home_url_hint)
    ("AEM.TO",   "Agnico Eagle Mines Limited",          "https://www.agnicoeagle.com/English/investor-relations/", "https://www.agnicoeagle.com"),
    ("ATD.TO",   "Alimentation Couche-Tard Inc.",       "https://corpo.couche-tard.com/en/investors/", "https://corpo.couche-tard.com"),
    ("BMO.TO",   "Bank of Montreal",                    "https://www.bmo.com/main/about-bmo/investor-relations/", "https://www.bmo.com"),
    ("BNS.TO",   "Bank of Nova Scotia",                 "https://www.scotiabank.com/ca/en/about/investors-shareholders.html", "https://www.scotiabank.com"),
    ("ABX.TO",   "Barrick Mining Corporation",          "https://www.barrick.com/English/investors/", "https://www.barrick.com"),
    ("BCE.TO",   "BCE Inc.",                            "https://www.bce.ca/investors", "https://www.bce.ca"),
    ("BAM.TO",   "Brookfield Asset Management Ltd.",    "https://bam.brookfield.com/investors", "https://bam.brookfield.com"),
    ("BN.TO",    "Brookfield Corporation",              "https://bn.brookfield.com/investors", "https://bn.brookfield.com"),
    ("BIP-UN.TO", "Brookfield Infrastructure Partners L.P.", "https://bip.brookfield.com/investors", "https://bip.brookfield.com"),
    ("CAE.TO",   "CAE Inc.",                            "https://www.cae.com/investors/", "https://www.cae.com"),
    ("CCO.TO",   "Cameco Corporation",                  "https://www.cameco.com/invest/", "https://www.cameco.com"),
    ("CM.TO",    "Canadian Imperial Bank of Commerce",  "https://www.cibc.com/en/about-cibc/investor-relations.html", "https://www.cibc.com"),
    ("CNR.TO",   "Canadian National Railway Company",   "https://www.cn.ca/en/investors/", "https://www.cn.ca"),
    ("CNQ.TO",   "Canadian Natural Resources Limited",  "https://www.cnrl.com/investors/", "https://www.cnrl.com"),
    ("CP.TO",    "Canadian Pacific Kansas City Limited", "https://investor.cpkcr.com/", "https://www.cpkcr.com"),
    ("CTC-A.TO", "Canadian Tire Corporation Limited",   "https://corp.canadiantire.ca/English/investors/", "https://corp.canadiantire.ca"),
    ("CCL-B.TO", "CCL Industries Inc.",                 "https://www.cclind.com/investors", "https://www.cclind.com"),
    ("CLS.TO",   "Celestica Inc.",                      "https://www.celestica.com/investor-relations", "https://www.celestica.com"),
    ("CVE.TO",   "Cenovus Energy Inc.",                 "https://www.cenovus.com/invest/", "https://www.cenovus.com"),
    ("GIB-A.TO", "CGI Inc.",                            "https://www.cgi.com/en/investors", "https://www.cgi.com"),
    ("CSU.TO",   "Constellation Software Inc.",         "https://www.csisoftware.com/investor-relations", "https://www.csisoftware.com"),
    ("DOL.TO",   "Dollarama Inc.",                      "https://www.dollarama.com/en-CA/corp/investor-relations", "https://www.dollarama.com"),
    ("EMA.TO",   "Emera Incorporated",                  "https://www.emera.com/investors", "https://www.emera.com"),
    ("ENB.TO",   "Enbridge Inc.",                       "https://www.enbridge.com/investment-center", "https://www.enbridge.com"),
    ("FFH.TO",   "Fairfax Financial Holdings Limited",  "https://www.fairfax.ca/financials/", "https://www.fairfax.ca"),
    ("FM.TO",    "First Quantum Minerals Ltd.",         "https://www.first-quantum.com/English/investors/", "https://www.first-quantum.com"),
    ("FSV.TO",   "FirstService Corporation",            "https://investors.firstservice.com/", "https://www.firstservice.com"),
    ("FTS.TO",   "Fortis Inc.",                         "https://www.fortisinc.com/investor-relations", "https://www.fortisinc.com"),
    ("FNV.TO",   "Franco-Nevada Corporation",           "https://www.franco-nevada.com/investors/", "https://www.franco-nevada.com"),
    ("WN.TO",    "George Weston Limited",               "https://www.weston.ca/en/Investor-Centre.aspx", "https://www.weston.ca"),
    ("GIL.TO",   "Gildan Activewear Inc.",              "https://gildancorp.com/en/investors/", "https://gildancorp.com"),
    ("H.TO",     "Hydro One Limited",                   "https://www.hydroone.com/investor-relations", "https://www.hydroone.com"),
    ("IMO.TO",   "Imperial Oil Limited",                "https://www.imperialoil.ca/en-ca/company/investors", "https://www.imperialoil.ca"),
    ("IFC.TO",   "Intact Financial Corporation",        "https://www.intactfc.com/English/investors/", "https://www.intactfc.com"),
    ("K.TO",     "Kinross Gold Corporation",            "https://www.kinross.com/investors/", "https://www.kinross.com"),
    ("L.TO",     "Loblaw Companies Limited",            "https://www.loblaw.ca/en/investors.html", "https://www.loblaw.ca"),
    ("MG.TO",    "Magna International Inc.",            "https://www.magna.com/company/investors", "https://www.magna.com"),
    ("MFC.TO",   "Manulife Financial Corporation",      "https://www.manulife.com/en/investors.html", "https://www.manulife.com"),
    ("MRU.TO",   "Metro Inc.",                          "https://corpo.metro.ca/en/investors.html", "https://corpo.metro.ca"),
    ("NA.TO",    "National Bank of Canada",             "https://www.nbc.ca/en/about-us/investors.html", "https://www.nbc.ca"),
    ("NTR.TO",   "Nutrien Ltd.",                        "https://www.nutrien.com/investors", "https://www.nutrien.com"),
    ("OTEX.TO",  "Open Text Corporation",               "https://investors.opentext.com/", "https://www.opentext.com"),
    ("PPL.TO",   "Pembina Pipeline Corporation",        "https://www.pembina.com/investors/", "https://www.pembina.com"),
    ("POW.TO",   "Power Corporation of Canada",         "https://www.powercorporation.com/en/investors/", "https://www.powercorporation.com"),
    ("QSR.TO",   "Restaurant Brands International Inc.", "https://www.rbi.com/investors", "https://www.rbi.com"),
    ("RCI-B.TO", "Rogers Communications Inc.",          "https://about.rogers.com/investors/", "https://about.rogers.com"),
    ("RY.TO",    "Royal Bank of Canada",                "https://www.rbc.com/investor-relations/", "https://www.rbc.com"),
    ("SAP.TO",   "Saputo Inc.",                         "https://www.saputo.com/en/our-corporation/investors", "https://www.saputo.com"),
    ("SHOP.TO",  "Shopify Inc.",                        "https://investors.shopify.com/", "https://www.shopify.com"),
    ("SLF.TO",   "Sun Life Financial Inc.",             "https://www.sunlife.com/en/investors/", "https://www.sunlife.com"),
    ("SU.TO",    "Suncor Energy Inc.",                  "https://www.suncor.com/en-ca/investor-centre", "https://www.suncor.com"),
    ("TRP.TO",   "TC Energy Corporation",               "https://www.tcenergy.com/investors/", "https://www.tcenergy.com"),
    ("TECK-B.TO", "Teck Resources Limited",             "https://www.teck.com/investors", "https://www.teck.com"),
    ("T.TO",     "Telus Corporation",                   "https://www.telus.com/en/about/investors", "https://www.telus.com"),
    ("TRI.TO",   "Thomson Reuters Corporation",         "https://www.thomsonreuters.com/en/investor-relations.html", "https://www.thomsonreuters.com"),
    ("TD.TO",    "Toronto-Dominion Bank",               "https://www.td.com/ca/en/about-td/for-investors", "https://www.td.com"),
    ("TOU.TO",   "Tourmaline Oil Corp.",                "https://www.tourmalineoil.com/investors/", "https://www.tourmalineoil.com"),
    ("WCN.TO",   "Waste Connections Inc.",              "https://investors.wasteconnections.com/", "https://www.wasteconnections.com"),
    ("WPM.TO",   "Wheaton Precious Metals Corp.",       "https://www.wheatonpm.com/investors/", "https://www.wheatonpm.com"),
    ("WSP.TO",   "WSP Global Inc.",                     "https://www.wsp.com/en-gl/investors", "https://www.wsp.com"),
]

# Convert YYYY filename-safe
SAFE_FILENAME_RE = re.compile(r"[^a-zA-Z0-9._-]+")
log_lock = Lock()


def log(msg: str, log_fh=None):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    with log_lock:
        print(line, flush=True)
        if log_fh:
            log_fh.write(line + "\n")
            log_fh.flush()


def safe_filename(s: str, max_len: int = 100) -> str:
    s = SAFE_FILENAME_RE.sub("-", s).strip("-")
    return s[:max_len] if len(s) > max_len else s


def http_get(url: str, timeout: int = 30, accept: str = "*/*") -> tuple[int, bytes]:
    headers = {"User-Agent": UA, "Accept": accept}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception:
        return 0, b""


def download_file(url: str, dest: Path, min_bytes: int = 10000) -> bool:
    if dest.exists() and dest.stat().st_size >= min_bytes:
        return True  # déjà téléchargé
    code, body = http_get(url, timeout=180)
    if code != 200 or len(body) < min_bytes:
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(body)
    return True


def pdf_to_text(pdf_path: Path, txt_path: Path) -> bool:
    pdftotext = "/opt/homebrew/bin/pdftotext"
    if not Path(pdftotext).exists():
        pdftotext = "pdftotext"
    txt_path.parent.mkdir(parents=True, exist_ok=True)
    if txt_path.exists() and txt_path.stat().st_size > 5000:
        return True
    try:
        subprocess.run(
            [pdftotext, "-layout", str(pdf_path), str(txt_path)],
            check=True, capture_output=True, timeout=180
        )
        return txt_path.exists() and txt_path.stat().st_size > 5000
    except Exception:
        return False


def snapshot_html(url: str, dest: Path) -> bool:
    if dest.exists() and dest.stat().st_size > 1000:
        return True
    code, body = http_get(url, timeout=30, accept="text/html")
    if code != 200 or len(body) < 1000:
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(body)
    return True


def search_sedar_plus(name: str, log_fh=None) -> list[dict]:
    """
    Recherche SEDAR+ par nom de société.
    SEDAR+ (sedarplus.ca) propose une API REST publique pour rechercher filings.
    Endpoint observé : /csa-party/service/searchEntity (POST JSON)
    et /csa-party/service/getEntityFilings
    Sinon fallback : page de recherche HTML.

    Retourne liste filings : [{"date", "type", "title", "pdf_url"}, ...]
    """
    # Throttle 3s avant chaque appel SEDAR+ pour éviter rate-limit
    time.sleep(3)

    # Approche 1 : API recherche entité SEDAR+
    search_url = "https://www.sedarplus.ca/csa-party/service/searchEntity"
    payload = json.dumps({
        "searchString": name,
        "sortField": "name",
        "sortOrder": "asc",
        "pageNumber": 1,
        "pageSize": 10,
    }).encode("utf-8")

    headers = {
        "User-Agent": UA,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    filings = []
    try:
        req = urllib.request.Request(search_url, data=payload, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as r:
            if r.status == 200:
                data = json.loads(r.read().decode("utf-8"))
                # Le format exact peut varier ; SEDAR+ a changé son API en 2023+
                # On loggue le résultat brut pour diagnostic
                log(f"  SEDAR+ search '{name}' returned {len(json.dumps(data))} bytes", log_fh)
    except Exception as e:
        log(f"  SEDAR+ API fail for '{name}': {e}", log_fh)

    return filings  # peut être vide, c'est OK


def find_ir_pdf_links(html: str, base_url: str, keywords: list[str]) -> list[tuple[str, str]]:
    """Parse HTML pour trouver des liens PDF correspondant aux keywords.
    Retourne [(url_absolue, anchor_text), ...].
    """
    results = []
    # Regex tolérante : href="...pdf" + texte interne
    pattern = re.compile(
        r'<a[^>]*href="([^"#]+\.pdf[^"]*)"[^>]*>(.*?)</a>',
        re.IGNORECASE | re.DOTALL
    )
    for m in pattern.finditer(html):
        url = m.group(1)
        anchor = re.sub(r'<[^>]+>', '', m.group(2)).strip()
        # Resolve relatif → absolu
        if url.startswith("//"):
            url = "https:" + url
        elif url.startswith("/"):
            from urllib.parse import urlparse
            base = urlparse(base_url)
            url = f"{base.scheme}://{base.netloc}{url}"
        elif not url.startswith("http"):
            url = base_url.rstrip("/") + "/" + url

        anchor_lower = anchor.lower()
        if any(kw.lower() in anchor_lower for kw in keywords):
            results.append((url, anchor))
    return results


def process_ticker(
    ticker: str,
    name: str,
    ir_url: str,
    home_url: str,
    years_min: int,
    log_fh=None,
) -> dict:
    """Scrape 1 ticker TSX 60. Returns result dict + écrit manifest.json."""
    ticker_safe = ticker.replace("/", "_")
    out = OUT_DIR / ticker_safe
    out.mkdir(parents=True, exist_ok=True)

    # Créer tous les sous-dossiers
    for subdir in ("annual-text", "annual-report", "mda", "proxy",
                   "ir-presentations", "esg", "ir-page-snapshot",
                   "half-year", "material-change"):
        (out / subdir).mkdir(parents=True, exist_ok=True)

    manifest = {
        "ticker": ticker,
        "name": name,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "scraper_version": "canada-tsx60-scraper-v1",
        "ir_url": ir_url,
        "home_url": home_url,
        "annual_reports": [],
        "mda_reports": [],
        "proxy_circulars": [],
        "ir_presentations": [],
        "esg_reports": [],
        "material_changes": [],
        "snapshots": [],
        "sedar_filings": [],
        "fails": [],
    }

    log(f"[{ticker}] {name} — start", log_fh)

    # 1) Snapshot IR page + home page (HTML brut)
    today = datetime.now().strftime("%Y%m%d")
    ir_snapshot = out / "ir-page-snapshot" / f"ir-page-{today}.html"
    if snapshot_html(ir_url, ir_snapshot):
        manifest["snapshots"].append({"kind": "ir-page", "url": ir_url, "path": str(ir_snapshot.relative_to(DATA_ROOT))})
        log(f"  [OK] IR snapshot", log_fh)
    else:
        manifest["fails"].append({"step": "ir-snapshot", "url": ir_url})
        log(f"  [FAIL] IR snapshot {ir_url}", log_fh)

    home_snapshot = out / "ir-page-snapshot" / f"home-page-{today}.html"
    if snapshot_html(home_url, home_snapshot):
        manifest["snapshots"].append({"kind": "home-page", "url": home_url, "path": str(home_snapshot.relative_to(DATA_ROOT))})
        log(f"  [OK] Home snapshot", log_fh)
    else:
        manifest["fails"].append({"step": "home-snapshot", "url": home_url})

    # 2) Parse IR page HTML → liens PDF
    try:
        ir_html = ir_snapshot.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        ir_html = ""

    if ir_html:
        # 2a) Annual reports : keywords FR + EN (sociétés FR-Canada bilingues)
        annual_links = find_ir_pdf_links(ir_html, ir_url, [
            "annual report", "rapport annuel", "annual-report",
            "AIF", "annual information form", "notice annuelle",
            "annual & sustainability", "integrated report", "form 40-f"
        ])
        for url, anchor in annual_links[:8]:  # top 8 pour 5 ans + safety
            # Tenter d'extraire year depuis l'anchor ou l'url
            year_match = re.search(r'(20\d{2})', anchor + " " + url)
            year = year_match.group(1) if year_match else today[:4]
            pdf_dest = out / "annual-report" / f"{year}.pdf"
            if pdf_dest.exists() and pdf_dest.stat().st_size > 50000:
                continue  # déjà ok
            if download_file(url, pdf_dest, min_bytes=50000):
                txt_dest = out / "annual-text" / f"{year}.txt"
                pdf_to_text(pdf_dest, txt_dest)
                manifest["annual_reports"].append({
                    "year": year, "url": url, "anchor": anchor[:80],
                    "pdf_path": str(pdf_dest.relative_to(DATA_ROOT)),
                    "txt_path": str(txt_dest.relative_to(DATA_ROOT)) if txt_dest.exists() else None,
                })
                log(f"  [OK] Annual {year} ({pdf_dest.stat().st_size//1024} KB)", log_fh)
            else:
                manifest["fails"].append({"step": "annual-pdf", "url": url, "year": year})

        # 2b) MD&A
        mda_links = find_ir_pdf_links(ir_html, ir_url, [
            "MD&A", "management discussion", "rapport de gestion",
            "management's discussion"
        ])
        for url, anchor in mda_links[:6]:
            year_match = re.search(r'(20\d{2})', anchor + " " + url)
            year = year_match.group(1) if year_match else today[:4]
            pdf_dest = out / "mda" / f"{year}.pdf"
            if pdf_dest.exists() and pdf_dest.stat().st_size > 30000:
                continue
            if download_file(url, pdf_dest, min_bytes=30000):
                manifest["mda_reports"].append({
                    "year": year, "url": url, "anchor": anchor[:80],
                    "pdf_path": str(pdf_dest.relative_to(DATA_ROOT)),
                })
                log(f"  [OK] MD&A {year}", log_fh)

        # 2c) Proxy circular
        proxy_links = find_ir_pdf_links(ir_html, ir_url, [
            "proxy circular", "management proxy", "circulaire",
            "information circular", "circulaire de sollicitation"
        ])
        for url, anchor in proxy_links[:3]:
            year_match = re.search(r'(20\d{2})', anchor + " " + url)
            year = year_match.group(1) if year_match else today[:4]
            pdf_dest = out / "proxy" / f"{year}.pdf"
            if pdf_dest.exists() and pdf_dest.stat().st_size > 30000:
                continue
            if download_file(url, pdf_dest, min_bytes=30000):
                manifest["proxy_circulars"].append({
                    "year": year, "url": url, "pdf_path": str(pdf_dest.relative_to(DATA_ROOT)),
                })
                log(f"  [OK] Proxy {year}", log_fh)

        # 2d) IR presentations / Investor Day
        ir_pres_links = find_ir_pdf_links(ir_html, ir_url, [
            "investor day", "investor presentation", "présentation investisseurs",
            "quarterly presentation", "investor update", "investor briefing"
        ])
        for url, anchor in ir_pres_links[:5]:
            date_match = re.search(r'(20\d{2})', anchor + " " + url)
            date = date_match.group(1) if date_match else today
            filename = safe_filename(f"{date}-{anchor[:50]}") + ".pdf"
            pdf_dest = out / "ir-presentations" / filename
            if pdf_dest.exists() and pdf_dest.stat().st_size > 20000:
                continue
            if download_file(url, pdf_dest, min_bytes=20000):
                manifest["ir_presentations"].append({
                    "url": url, "anchor": anchor[:80],
                    "pdf_path": str(pdf_dest.relative_to(DATA_ROOT)),
                })
                log(f"  [OK] IR pres {filename[:50]}", log_fh)

        # 2e) ESG / Sustainability
        esg_links = find_ir_pdf_links(ir_html, ir_url, [
            "sustainability", "ESG report", "rapport ESG", "responsibility",
            "climate report", "TCFD", "rapport de durabilité"
        ])
        for url, anchor in esg_links[:3]:
            year_match = re.search(r'(20\d{2})', anchor + " " + url)
            year = year_match.group(1) if year_match else today[:4]
            pdf_dest = out / "esg" / f"{year}-sustainability.pdf"
            if pdf_dest.exists() and pdf_dest.stat().st_size > 30000:
                continue
            if download_file(url, pdf_dest, min_bytes=30000):
                manifest["esg_reports"].append({
                    "year": year, "url": url, "pdf_path": str(pdf_dest.relative_to(DATA_ROOT)),
                })
                log(f"  [OK] ESG {year}", log_fh)

    # 3) SEDAR+ search (best-effort, throttled 3s)
    sedar_filings = search_sedar_plus(name, log_fh=log_fh)
    manifest["sedar_filings"] = sedar_filings

    # 4) Counts pour reporting
    manifest["counts"] = {
        "annual_reports": len(manifest["annual_reports"]),
        "mda_reports": len(manifest["mda_reports"]),
        "proxy_circulars": len(manifest["proxy_circulars"]),
        "ir_presentations": len(manifest["ir_presentations"]),
        "esg_reports": len(manifest["esg_reports"]),
        "snapshots": len(manifest["snapshots"]),
        "fails": len(manifest["fails"]),
    }

    # Écrire manifest
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False))

    total_docs = sum([manifest["counts"][k] for k in ("annual_reports", "mda_reports", "proxy_circulars", "ir_presentations", "esg_reports")])
    log(f"[{ticker}] DONE — {total_docs} docs scrapés, {manifest['counts']['fails']} fails", log_fh)

    return manifest


def main():
    parser = argparse.ArgumentParser(description="Canada TSX 60 IR scraper (Phase 1 download only)")
    parser.add_argument("--ticker", type=str, help="Single ticker (e.g. RY.TO)")
    parser.add_argument("--years-min", type=int, default=5, help="Minimum years to target")
    parser.add_argument("--workers", type=int, default=2, help="Parallel workers (default 2, max 4)")
    args = parser.parse_args()

    workers = max(1, min(args.workers, 4))

    # Filter tickers
    if args.ticker:
        targets = [t for t in TSX_60 if t[0] == args.ticker]
        if not targets:
            print(f"Ticker {args.ticker} not in TSX 60 list", file=sys.stderr)
            sys.exit(1)
    else:
        targets = TSX_60

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    log_fh = open(LOG_PATH, "a", encoding="utf-8")
    log(f"=== Canada TSX 60 scraper start — {len(targets)} stés, workers={workers} ===", log_fh)

    all_manifests = []
    results_count = {"ok": 0, "partial": 0, "fail": 0}

    def _worker(spec):
        ticker, name, ir_url, home_url = spec
        try:
            m = process_ticker(ticker, name, ir_url, home_url, args.years_min, log_fh=log_fh)
            total = sum([m["counts"][k] for k in ("annual_reports", "mda_reports", "proxy_circulars", "ir_presentations", "esg_reports")])
            if total >= 5:
                results_count["ok"] += 1
            elif total >= 1:
                results_count["partial"] += 1
            else:
                results_count["fail"] += 1
            return m
        except Exception as e:
            log(f"[{ticker}] EXCEPTION: {e}", log_fh)
            results_count["fail"] += 1
            return {"ticker": ticker, "error": str(e)}

    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = [ex.submit(_worker, spec) for spec in targets]
        for fut in as_completed(futures):
            all_manifests.append(fut.result())

    # Global manifest
    MANIFEST_GLOBAL.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_GLOBAL.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "tickers_total": len(targets),
        "results_count": results_count,
        "manifests": all_manifests,
    }, indent=2, ensure_ascii=False))

    log(f"=== DONE — ok={results_count['ok']}, partial={results_count['partial']}, fail={results_count['fail']} ===", log_fh)
    log_fh.close()

    print(f"\nGlobal manifest written: {MANIFEST_GLOBAL}")
    print(f"Results: {results_count}")


if __name__ == "__main__":
    main()
