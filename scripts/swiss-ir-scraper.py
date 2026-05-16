#!/usr/bin/env python3
"""
Swiss IR scraper — récupère docs réglementaires + IR + page d'accueil
des 20 SMI top et 50 populaires Suisses.

Sources :
1. annualreports.com aggregator (annual reports, jusqu'à 17 ans dispo)
2. Page IR officielle de chaque sté (half-year, ad-hoc, IR presentations, ESG)
3. Snapshot home page + IR page (HTML brut)

Output organisé pour la conv qui traitera les docs ensuite (pass 1/2/3) :
  sec-data/cat3-european/<TICKER>.SW/
    ├── annual-report/<year>.pdf      (PDFs annuels)
    ├── annual-text/<year>.txt        (texte extrait via pdftotext)
    ├── half-year/<year>-H1.pdf
    ├── half-year-text/<year>-H1.txt
    ├── ad-hoc/<date>-<title>.pdf
    ├── ir-presentations/<date>-<title>.pdf
    ├── esg/<year>-sustainability.pdf
    ├── snapshots/
    │     ├── ir-page-<DATE>.html
    │     └── home-page-<DATE>.html
    └── manifest.json                  (inventaire avec metadata)

Usage :
    python3 scripts/swiss-ir-scraper.py --smi-top20      # 20 plus grosses SMI
    python3 scripts/swiss-ir-scraper.py --tickers ROG.SW,NESN.SW
    python3 scripts/swiss-ir-scraper.py --all-swiss      # toutes (50 populaires)
    python3 scripts/swiss-ir-scraper.py --ticker ROG.SW --years-min 5

NB : pas d'extraction LLM, juste téléchargement + organisation.
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
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_ROOT = PROJECT_ROOT / "sec-data"
OUT_DIR = DATA_ROOT / "cat3-european"
LOG_PATH = DATA_ROOT / "_meta" / "swiss-ir-scraper.log"
MANIFEST_GLOBAL = DATA_ROOT / "_meta" / "swiss-ir-manifest-global.json"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mettrik-Research/1.0"
ANNUAL_BASE = "https://www.annualreports.com"

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl._create_unverified_context()


# ─────────────────────────────────────────────────────────────
# 20 SMI top + leur slug annualreports.com + URL IR + URL home
# ─────────────────────────────────────────────────────────────
SMI_20 = {
    # Ticker        : (annualreports_slug, ir_url,                                            home_url,                        nom)
    "NESN.SW":  ("nestle",            "https://www.nestle.com/investors/annual-report",       "https://www.nestle.com",         "Nestlé"),
    "NOVN.SW":  ("novartis-ag",       "https://www.novartis.com/investors/financial-data/annual-results", "https://www.novartis.com", "Novartis"),
    "ROG.SW":   ("roche-holdings",    "https://www.roche.com/investors/financial-reports",    "https://www.roche.com",          "Roche Holding"),
    "UBSG.SW":  ("ubs-group-ag",      "https://www.ubs.com/global/en/investor-relations/financial-information/annual-reporting.html", "https://www.ubs.com", "UBS Group"),
    "ABBN.SW":  ("abb",               "https://global.abb/group/en/investors/financial-information/annual-reports", "https://global.abb", "ABB"),
    "ZURN.SW":  ("zurich-insurance-group-ag", "https://www.zurich.com/investor-relations/results-and-reports/annual-results", "https://www.zurich.com", "Zurich Insurance"),
    "CFR.SW":   ("compagnie-financiere-richemont-sa", "https://www.richemont.com/en/home/investors/results-reports-presentations/", "https://www.richemont.com", "Richemont"),
    "GIVN.SW":  ("givaudan",          "https://www.givaudan.com/investors/results-centre",    "https://www.givaudan.com",       "Givaudan"),
    "LONN.SW":  ("lonza-group-ag",    "https://www.lonza.com/investors/financial-reports",    "https://www.lonza.com",          "Lonza Group"),
    "SREN.SW":  ("swiss-re",          "https://www.swissre.com/investors/financial-information/annual-reports.html", "https://www.swissre.com", "Swiss Re"),
    "ALC.SW":   ("alcon",             "https://investor.alcon.com/financial-information/annual-reports", "https://www.alcon.com", "Alcon"),
    "SLHN.SW":  ("swiss-life",        "https://www.swisslife.com/en/home/investors/results-and-reports/annual-report.html", "https://www.swisslife.com", "Swiss Life"),
    "GEBN.SW":  ("geberit-ag",        "https://www.geberit.com/investors/annual-reports/",     "https://www.geberit.com",        "Geberit"),
    "HOLN.SW":  ("holcim-ltd",        "https://www.holcim.com/investors",                      "https://www.holcim.com",         "Holcim"),
    "SCMN.SW":  ("swisscom",          "https://www.swisscom.ch/en/about/investors/financial-reports.html", "https://www.swisscom.ch", "Swisscom"),
    "LOGN.SW":  ("logitech-international-sa", "https://ir.logitech.com/financials/annual-reports", "https://www.logitech.com", "Logitech"),
    "PGHN.SW":  ("partners-group",    "https://www.partnersgroup.com/en/investors/results-reports/", "https://www.partnersgroup.com", "Partners Group"),
    "SIKA.SW":  ("sika-ag",           "https://www.sika.com/en/about-us/investors/results-reports.html", "https://www.sika.com", "Sika"),
    "STMN.SW":  ("straumann-holding", "https://www.straumann-group.com/en/investors/financial-reports.html", "https://www.straumann-group.com", "Straumann Holding"),
    "KNIN.SW":  ("kuehne-nagel",      "https://home.kuehne-nagel.com/-/company/investor-relations/results", "https://home.kuehne-nagel.com", "Kuehne + Nagel"),
}

# Stés Suisses suivantes (rangs 21-50) — populaires
SMI_EXTRA_30 = {
    "BAER.SW":  ("julius-baer-group-ltd", "https://www.juliusbaer.com/en/investors/results-and-reports/", "https://www.juliusbaer.com", "Julius Baer"),
    "ADEN.SW":  ("adecco-group-ag",      "https://www.adeccogroup.com/investors/reports-and-presentations/", "https://www.adeccogroup.com", "Adecco Group"),
    "SGSN.SW":  ("sgs-sa",                "https://www.sgs.com/en/investor-relations/financial-and-reporting", "https://www.sgs.com", "SGS"),
    "SOON.SW":  ("sonova-holding-ag",    "https://www.sonova.com/en/investors/reporting-center", "https://www.sonova.com", "Sonova"),
    "BALN.SW":  ("baloise-holding-ag",   "https://www.baloise.com/en/home/about-us/investor-relations/reports.html", "https://www.baloise.com", "Baloise"),
    "GALD.SW":  ("galderma-group-ag",    "https://www.galderma.com/investors", "https://www.galderma.com", "Galderma"),
    "TEMN.SW":  ("temenos-ag",           "https://www.temenos.com/investors/financial-results/", "https://www.temenos.com", "Temenos"),
    "SCHN.SW":  ("schindler-holding-ag", "https://www.schindler.com/com/internet/en/investor-relations/reports-and-presentations.html", "https://www.schindler.com", "Schindler"),
    "SCHP.SW":  ("schindler-holding-ag", "https://www.schindler.com/com/internet/en/investor-relations/reports-and-presentations.html", "https://www.schindler.com", "Schindler (PS)"),
    "EMSN.SW":  ("ems-chemie-holding-ag","https://www.emsgroup.com/en/group/investor-relations/financial-reports/", "https://www.emsgroup.com", "EMS-Chemie"),
    "VACN.SW":  ("vat-group-ag",         "https://www.vatvalve.com/investors/financial-publications", "https://www.vatvalve.com", "VAT Group"),
    "SDZ.SW":   ("sandoz-group-ag",      "https://www.sandoz.com/investors/results-and-presentations/", "https://www.sandoz.com", "Sandoz"),
    "SQN.SW":   ("swissquote-group-holding-sa", "https://www.swissquote.com/en/group/investors/financial-reports", "https://www.swissquote.com", "Swissquote"),
    "BARN.SW":  ("barry-callebaut-ag",   "https://www.barry-callebaut.com/en/group/investors/results-publications-presentations", "https://www.barry-callebaut.com", "Barry Callebaut"),
    "BCVN.SW":  ("banque-cantonale-vaudoise", "https://www.bcv.ch/en/Investor-Relations", "https://www.bcv.ch", "BCV"),
    "CMBN.SW":  ("cembra-money-bank-ag", "https://www.cembra.ch/en/investors/", "https://www.cembra.ch", "Cembra Money Bank"),
    "BEAN.SW":  ("belimo-holding-ag",    "https://www.belimo.com/mam/group/investor-relations/", "https://www.belimo.com", "Belimo"),
    "BOSN.SW":  ("boehringer-ingelheim", None, None, "Bossard Holding"),
    "BUCN.SW":  ("bucher-industries-ag", "https://www.bucherindustries.com/en/investors/financial-publications", "https://www.bucherindustries.com", "Bucher Industries"),
    "CLN.SW":   ("clariant-ag",          "https://www.clariant.com/en/Corporate/Investors", "https://www.clariant.com", "Clariant"),
    "DKSH.SW":  ("dksh-holding-ag",      "https://www.dksh.com/global-en/investors/results-reports", "https://www.dksh.com", "DKSH"),
    "DUFN.SW":  ("avolta-ag",            "https://www.avoltaworld.com/en/investors", "https://www.avoltaworld.com", "Avolta (ex Dufry)"),
    "FHZN.SW":  ("flughafen-zurich-ag",  "https://report.flughafen-zuerich.ch/", "https://www.flughafen-zuerich.ch", "Flughafen Zurich"),
    "GALE.SW":  ("galenica-ag",          "https://www.galenica.com/en/investors/reports-and-presentations.php", "https://www.galenica.com", "Galenica"),
    "HELN.SW":  ("helvetia-holding-ag",  "https://www.helvetia.com/corporate/web/en/home/about_us/investors/financial-reports.html", "https://www.helvetia.com", "Helvetia"),
    "IMPN.SW":  ("implenia-ag",          "https://implenia.com/en/investor-relations/results-publications/", "https://implenia.com", "Implenia"),
    "INRN.SW":  ("interroll-holding-ag", "https://www.interroll.com/investors/financial-reports/", "https://www.interroll.com", "Interroll"),
    "KARN.SW":  ("kardex-holding-ag",    "https://www.kardex.com/en/company/investor-relations/financial-reports", "https://www.kardex.com", "Kardex"),
    "KOMN.SW":  ("komax-holding-ag",     "https://www.komaxgroup.com/en/Investors/Reports-and-Presentations/", "https://www.komaxgroup.com", "Komax"),
    "LEHN.SW":  ("lem-holding-sa",       "https://www.lem.com/en/investors/key-figures-and-reports", "https://www.lem.com", "LEM Holding"),
}

ALL_SWISS = {**SMI_20, **SMI_EXTRA_30}


def log(msg: str, log_fh=None):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    if log_fh:
        log_fh.write(line + "\n")
        log_fh.flush()


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


def get_pdf_links_annualreports(slug: str) -> list[tuple[int, str]]:
    """Pour un slug annualreports.com, parse la page et retourne [(year, pdf_url), ...]."""
    url = f"{ANNUAL_BASE}/Company/{slug}"
    code, body = http_get(url, accept="text/html")
    if code != 200:
        return []
    html = body.decode("utf-8", errors="ignore")
    pdfs = []
    for m in re.finditer(r'href="(/HostedData/AnnualReportArchive/[^"]+_(\d{4})\.pdf)"', html):
        path = m.group(1)
        year = int(m.group(2))
        full_url = ANNUAL_BASE + path
        if (year, full_url) not in pdfs:
            pdfs.append((year, full_url))
    return sorted(pdfs, key=lambda x: -x[0])


def download_file(url: str, dest: Path, min_bytes: int = 10000) -> bool:
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
    try:
        subprocess.run(
            [pdftotext, "-layout", str(pdf_path), str(txt_path)],
            check=True, capture_output=True, timeout=180
        )
        return txt_path.exists() and txt_path.stat().st_size > 5000
    except Exception:
        return False


def snapshot_html(url: str, dest: Path) -> bool:
    """Save raw HTML of a page (IR page or home page)."""
    code, body = http_get(url, timeout=30, accept="text/html")
    if code != 200 or len(body) < 1000:
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(body)
    return True


def write_manifest(out_dir: Path, ticker: str, manifest: dict):
    """Écrit le manifest.json avec inventaire de tous les docs téléchargés."""
    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))


def process_ticker(
    ticker: str,
    slug: str | None,
    ir_url: str | None,
    home_url: str | None,
    name: str,
    years_min: int,
    log_fh,
) -> dict:
    """Scrape 1 ticker. Returns result dict + écrit manifest.json."""
    out = OUT_DIR / ticker.replace("/", "_")
    out.mkdir(parents=True, exist_ok=True)

    manifest = {
        "ticker": ticker,
        "name": name,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "scraper_version": "swiss-ir-scraper-v1",
        "annualreports_slug": slug,
        "ir_url": ir_url,
        "home_url": home_url,
        "annual_reports": [],   # [{year, pdf_path, txt_path, source}]
        "snapshots": {},        # {ir_page: path, home_page: path}
        "errors": [],
    }

    # ──────────────────────────────────────────────────────
    # 1. Annual reports via annualreports.com (jusqu'à 17 ans dispo)
    # ──────────────────────────────────────────────────────
    if slug:
        log(f"   [{ticker}] annualreports.com slug={slug}", log_fh)
        pdfs = get_pdf_links_annualreports(slug)
        time.sleep(1)
        if not pdfs:
            log(f"      ⚠ aucun PDF trouvé sur annualreports.com", log_fh)
            manifest["errors"].append("annualreports: no PDF found")
        else:
            log(f"      → {len(pdfs)} PDFs annuels disponibles (cible : ≥{years_min} ans)", log_fh)
            for year, url in pdfs[:max(years_min, 5)]:
                pdf_dest = out / "annual-report" / f"{year}.pdf"
                if pdf_dest.exists() and pdf_dest.stat().st_size > 100000:
                    log(f"      [SKIP] {year}.pdf existe déjà ({pdf_dest.stat().st_size // 1024} KB)", log_fh)
                    txt_dest = out / "annual-text" / f"{year}.txt"
                    if not txt_dest.exists():
                        pdf_to_text(pdf_dest, txt_dest)
                    manifest["annual_reports"].append({
                        "year": year, "pdf_path": str(pdf_dest.relative_to(DATA_ROOT)),
                        "txt_path": str(txt_dest.relative_to(DATA_ROOT)) if txt_dest.exists() else None,
                        "source": "annualreports.com (skip-existing)"
                    })
                    continue
                log(f"      → DL {year} : {url[-60:]}", log_fh)
                ok = download_file(url, pdf_dest, min_bytes=50000)
                if ok:
                    txt_dest = out / "annual-text" / f"{year}.txt"
                    txt_ok = pdf_to_text(pdf_dest, txt_dest)
                    manifest["annual_reports"].append({
                        "year": year,
                        "pdf_path": str(pdf_dest.relative_to(DATA_ROOT)),
                        "txt_path": str(txt_dest.relative_to(DATA_ROOT)) if txt_ok else None,
                        "source": "annualreports.com",
                        "size_kb": pdf_dest.stat().st_size // 1024,
                    })
                    log(f"      ✓ PDF {pdf_dest.stat().st_size // 1024} KB + txt {'OK' if txt_ok else 'FAIL'}", log_fh)
                else:
                    log(f"      ❌ DL fail {year}", log_fh)
                    manifest["errors"].append(f"DL fail year={year} url={url}")
                time.sleep(2)
    else:
        log(f"   [{ticker}] pas de slug annualreports.com", log_fh)
        manifest["errors"].append("no annualreports.com slug")

    # ──────────────────────────────────────────────────────
    # 2. Snapshot IR page + home page (HTML brut)
    # ──────────────────────────────────────────────────────
    today = datetime.now().strftime("%Y-%m-%d")
    if ir_url:
        snap_dest = out / "snapshots" / f"ir-page-{today}.html"
        if snapshot_html(ir_url, snap_dest):
            manifest["snapshots"]["ir_page"] = str(snap_dest.relative_to(DATA_ROOT))
            log(f"      ✓ IR page snapshot ({snap_dest.stat().st_size // 1024} KB)", log_fh)
        else:
            manifest["errors"].append(f"IR page snapshot fail : {ir_url}")
            log(f"      ⚠ IR page snapshot fail", log_fh)
        time.sleep(1)

    if home_url:
        snap_dest = out / "snapshots" / f"home-page-{today}.html"
        if snapshot_html(home_url, snap_dest):
            manifest["snapshots"]["home_page"] = str(snap_dest.relative_to(DATA_ROOT))
            log(f"      ✓ home page snapshot ({snap_dest.stat().st_size // 1024} KB)", log_fh)
        else:
            manifest["errors"].append(f"home page snapshot fail : {home_url}")
            log(f"      ⚠ home page snapshot fail", log_fh)
        time.sleep(1)

    # ──────────────────────────────────────────────────────
    # 3. Écrire manifest.json
    # ──────────────────────────────────────────────────────
    write_manifest(out, ticker, manifest)
    log(f"      → manifest écrit ({len(manifest['annual_reports'])} annual + {len(manifest['snapshots'])} snapshots)", log_fh)
    return manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--smi-top20", action="store_true", help="20 plus grosses SMI Suisses")
    parser.add_argument("--all-swiss", action="store_true", help="Toutes les Suisses (50 populaires)")
    parser.add_argument("--tickers", help="Comma-separated tickers (subset)")
    parser.add_argument("--years-min", type=int, default=5, help="Nombre min d'années à télécharger (default 5)")
    args = parser.parse_args()

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    log_fh = open(LOG_PATH, "a")

    if args.tickers:
        targets = {t.strip().upper(): ALL_SWISS.get(t.strip().upper(), (None, None, None, t)) for t in args.tickers.split(",")}
    elif args.smi_top20:
        targets = SMI_20
    elif args.all_swiss:
        targets = ALL_SWISS
    else:
        log("ERR: spécifie --smi-top20, --all-swiss ou --tickers", log_fh)
        sys.exit(1)

    log(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", log_fh)
    log(f"START swiss-ir-scraper · {len(targets)} tickers · years_min={args.years_min}", log_fh)
    log(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", log_fh)

    global_results = []
    for i, (ticker, info) in enumerate(targets.items(), 1):
        slug, ir_url, home_url, name = info
        log(f"\n[{i}/{len(targets)}] ━━ {ticker} ({name}) ━━", log_fh)
        try:
            manifest = process_ticker(ticker, slug, ir_url, home_url, name, args.years_min, log_fh)
            global_results.append({
                "ticker": ticker,
                "name": name,
                "annual_reports_count": len(manifest["annual_reports"]),
                "snapshots_count": len(manifest["snapshots"]),
                "errors_count": len(manifest["errors"]),
            })
        except Exception as e:
            log(f"   ❌ EXCEPTION {ticker}: {e}", log_fh)
            global_results.append({"ticker": ticker, "name": name, "error": str(e)})

    # Manifest global
    MANIFEST_GLOBAL.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_GLOBAL.write_text(json.dumps({
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "scraper_version": "swiss-ir-scraper-v1",
        "results": global_results,
    }, indent=2, ensure_ascii=False))

    log(f"\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", log_fh)
    log(f"DONE · {len(global_results)} tickers traités", log_fh)
    log(f"   Manifest global : {MANIFEST_GLOBAL}", log_fh)
    log_fh.close()


if __name__ == "__main__":
    main()
