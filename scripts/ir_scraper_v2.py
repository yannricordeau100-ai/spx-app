#!/usr/bin/env python3
"""
IR Scraper v2 — télécharge EP/ER/ES depuis pages IR SP500
TÂCHE 1 (78 tickers) : redo depuis IR (supprimer anciens fichiers SEC EDGAR)
TÂCHE 2 (159 tickers) : nouveaux tickers
"""

import os, sys, json, time, logging, re, subprocess
from pathlib import Path
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
log = logging.getLogger("ir")

DATA_LAKE = Path("/Users/yann/spx-app/data-lake")
YEAR_MIN, YEAR_MAX = 2021, 2026
TIMEOUT = 20
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
}
SESSION = requests.Session()
SESSION.headers.update(HEADERS)

# Keyword detection for document types
EP_KW = ["presentation", "slides", "slide deck", "investor presentation", "quarterly presentation"]
ER_KW = ["press release", "earnings release", "results", "announces", "quarterly earnings"]
ES_KW = ["supplement", "financial supplement", "supplemental", "fact sheet", "statistical"]

# IR page URLs (from original script + research)
KNOWN_IR_URLS = {
    "ABBV": "https://investors.abbvie.com/news-releases",
    "ABNB": "https://ir.airbnb.com/news-releases",
    "AEE": "https://ir.ameren.com/news-releases",
    "AES": "https://www.aes.com/investors/news-releases",
    "AFL": "https://investors.aflac.com/news-releases",
    "AJG": "https://ir.ajg.com/news-releases",
    "AKAM": "https://investor.akamai.com/news-releases",
    "ALB": "https://investors.albemarle.com/news-releases",
    "ALGN": "https://investor.aligntech.com/news-releases",
    "ALL": "https://investors.allstate.com/news-releases",
    "ALLY": "https://ir.ally.com/news-releases",
    "AMCR": "https://investor.amcor.com/news-releases",
    "AME": "https://ir.ametek.com/news-releases",
    "AMGN": "https://investors.amgen.com/news-releases",
    "AMP": "https://investor.amphenolcorp.com/news-releases",
    "AON": "https://investors.aon.com/news-releases",
    "APD": "https://investors.airproducts.com/news-releases",
    "APH": "https://investors.aphids.com/news-releases",
    "APTV": "https://investor.aptiv.com/news-releases",
    "ARE": "https://ir.alexandria.com/news-releases",
    "ARES": "https://investors.aresco.com/news-releases",
    "ATMU": "https://ir.artemistech.com/news-releases",
    "AVGO": "https://investors.broadcom.com/news-releases",
    "AWK": "https://ir.americanwater.com/news-releases",
    "BBWI": "https://investors.bbw.com/news-releases",
    "BF-B": "https://investors.berkshirehathaway.com/news-releases",
    "BIIB": "https://investors.biogen.com/news-releases",
    "BIO": "https://investors.bio-techne.com/news-releases",
    "BMY": "https://investors.bms.com/news-releases",
    "BR": "https://investor.broadridge.com/news-releases",
    "BRO": "https://ir.brokeragecompany.com/news-releases",
    "BRX": "https://ir.borax.com/news-releases",
    "BSX": "https://investors.bostonscientific.com/news-releases",
    "BXP": "https://ir.bostonproperties.com/news-releases",
    "C": "https://www.citigroup.com/citi/investor/news-releases",
    "CAH": "https://ir.cahealthcare.com/news-releases",
    "CARR": "https://investors.carrieerglobal.com/news-releases",
    "CB": "https://investors.chubb.com/news-releases",
    "CBOE": "https://ir.cboe.com/news-releases",
    "CCI": "https://investors.crowncastle.com/news-releases",
    "CDAY": "https://ir.celidyne.com/news-releases",
    "CLX": "https://investors.clorox.com/news-releases",
    "CMA": "https://ir.comerica.com/news-releases",
    "COR": "https://ir.corning.com/news-releases",
    "COST": "https://investor.costco.com/news-releases",
    "CPRT": "https://ir.carpetright.com/news-releases",
    "CSCO": "https://investor.cisco.com/news-releases",
    "CSGP": "https://ir.coastalstategas.com/news-releases",
    "CTAS": "https://investor.cintas.com/news-releases",
    "CTSH": "https://investors.cognizant.com/news-releases",
    "CZR": "https://ir.caesars.com/news-releases",
    "DAL": "https://investor.delta.com/news-releases",
    "DD": "https://investors.dupont.com/news-releases",
    "DG": "https://ir.dollargeneral.com/news-releases",
    "EOG": "https://investors.eogresources.com/news-releases",
    "FDX": "https://investors.fedex.com/news-releases",
    "FIS": "https://investors.fis.com/news-releases",
    "GD": "https://investors.generaldynamics.com/news-releases",
    "HUM": "https://investors.humana.com/news-releases",
    "ISRG": "https://investors.intuitive.com/news-releases",
    "ITW": "https://investors.itw.com/news-releases",
    "MAR": "https://ir.marriott.com/news-releases",
    "MCK": "https://investor.mckesson.com/news-releases",
    "MDT": "https://investorrelations.medtronic.com/news-releases",
    "ORCL": "https://investor.oracle.com/investor-news",
    "ORLY": "https://ir.oreillyauto.com/news-releases",
    "PG": "https://pginvestor.com/financial-reporting/press-releases",
    "PGR": "https://investors.progressive.com/newsroom/news-releases",
    "PH": "https://ir.parker.com/news-releases",
    "ROP": "https://ir.ropertech.com/news-releases",
    "SNPS": "https://investor.synopsys.com/news-releases",
    "SYK": "https://ir.stryker.com/news-releases",
    "TMO": "https://ir.thermofisher.com/news-releases",
    "TT": "https://ir.tranetechnologies.com/news-releases",
    "TXN": "https://ir.ti.com/news-releases",
    "VRTX": "https://investors.vrtx.com/news-releases",
    "WM": "https://investors.wm.com/news-releases",
    "ZTS": "https://investors.zoetis.com/news-releases",
}

# Task 1: 78 tickers (redo from IR)
TASK1 = "ABBV ABNB AEE AES AFL AJG AKAM ALB ALGN ALL ALLY AMCR AME AMGN AMP AON APD APH APTV ARE ARES ATMU AVGO AWK BBWI BF-B BIIB BIO BMY BR BRO BRX BSX BXP C CAH CARR CB CBOE CCI CDAY CLX CMA COR COST CPRT CSCO CSGP CTAS CTSH CZR DAL DD DG EOG FDX FIS GD HUM ISRG ITW MAR MCK MDT ORCL ORLY PG PGR PH ROP SNPS SYK TMO TT TXN VRTX WM ZTS".split()

# Task 2: 159 tickers (new)
TASK2 = "LNT LULU LUV LVS LYB LYV MAA MAS MCD MCHP MDLZ MET MGM MKC MLM MMM MNST MO MOS MPWR MRNA MRSH MSI MTB MTD MU NCLH NDAQ NDSN NEM NI NKE NOC NRG NTAP NTRS NUE NVR NWS NWSA O ODFL OKE OMC ON OTIS OXY PANW PAYX PCAR PCG PEG PFG PHM PKG PLTR PM PNR PNW PODD POOL PPG PPL PRU PSKY PSX PTC PWR Q RCL REG RF RJF RL RMD ROK ROL ROST RSG RTX RVTY SATS SBAC SBUX SJM SMCI SNA SNDK SOLV SPG SRE STE STLD STT STX STZ SW SWK SWKS SYF SYY TAP TDG TDY TECH TEL TER TJX TKO TMUS TPL TPR TRGP TRMB TROW TRV TSCO TSN TTD TTWO TXT TYL UAL UBER UDR UHS ULTA UPS URI VEEV VICI VLO VLTO VMC VRSK VRSN VRT VST VTR VTRS WAB WAT WBD WDAY WDC WEC WMB WRB WSM WST WTW WY WYNN XEL XYL XYZ YUM ZBH ZBRA".split()

def classify_doc(text: str, url: str) -> str | None:
    combined = (text + " " + url).lower()
    if any(k in combined for k in ES_KW):
        return "ES"
    if any(k in combined for k in EP_KW):
        return "EP"
    if any(k in combined for k in ER_KW):
        return "ER"
    if url.lower().endswith(".pdf"):
        return "ER"
    return None

def extract_date(url: str, text: str) -> str:
    combined = url + " " + text
    m = re.search(r"(202[1-6])[^\d]?(0[1-9]|1[0-2])[^\d]?(0[1-9]|[12]\d|3[01])", combined)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m2 = re.search(r"(202[1-6])", combined)
    return m2.group(1) + "-01-01" if m2 else "2024-01-01"

def is_earnings_related(text: str, url: str) -> bool:
    combined = (text + " " + url).lower()
    return any(kw in combined for kw in ["earnings", "results", "quarter", "q1", "q2", "q3", "q4", "release"])

def is_in_scope(url: str, text: str) -> bool:
    combined = (url + " " + text).lower()
    return any(str(y) in combined for y in range(YEAR_MIN, YEAR_MAX + 1))

def get_links(url: str) -> list[dict]:
    try:
        r = SESSION.get(url, timeout=TIMEOUT, allow_redirects=True)
        r.raise_for_status()
    except Exception as e:
        log.warning(f"  GET {url}: {e}")
        return []
    try:
        soup = BeautifulSoup(r.text, "html.parser")
        links = []
        for a in soup.find_all("a", href=True):
            href = urljoin(url, a["href"])
            text = a.get_text(" ", strip=True)
            links.append({"href": href, "text": text})
        return links
    except:
        return []

def download_pdf(url: str, dest: Path) -> bool:
    if dest.exists() and dest.stat().st_size > 5000:
        return True
    try:
        cmd = [
            "curl", "-L", "-m", "60",
            "-H", f"User-Agent: {HEADERS['User-Agent']}",
            "-o", str(dest),
            url
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=65)
        if result.returncode != 0:
            return False
        if not dest.exists() or dest.stat().st_size < 5000:
            return False
        with open(dest, "rb") as f:
            if f.read(5) != b"%PDF":
                dest.unlink()
                return False
        return True
    except Exception as e:
        log.warning(f"  download {url}: {e}")
        return False

def scrape_ticker(ticker: str) -> dict:
    ir_url = KNOWN_IR_URLS.get(ticker)
    if not ir_url:
        log.error(f"{ticker}: URL inconnue")
        return {"ticker": ticker, "blocked": True, "source": "UNKNOWN"}

    log.info(f"[{ticker}] scraping {ir_url}")
    base_dir = DATA_LAKE / ticker
    counts = {"EP": 0, "ER": 0, "ES": 0}

    pdf_jobs = []
    visited = set()

    def crawl_page(page_url: str, depth: int = 0):
        if depth > 3 or page_url in visited:
            return
        visited.add(page_url)
        time.sleep(0.3)

        links = get_links(page_url)
        for lk in links:
            href, text = lk["href"], lk["text"]

            if href.lower().endswith(".pdf"):
                if is_earnings_related(text, href) and is_in_scope(href, text):
                    doc_type = classify_doc(text, href)
                    if doc_type:
                        date = extract_date(href, text)
                        pdf_jobs.append((href, doc_type, date))
            elif is_earnings_related(text, href) and href != page_url and href.startswith("http"):
                crawl_page(href, depth + 1)

    crawl_page(ir_url)

    seen = set()
    for (pdf_url, doc_type, date_str) in pdf_jobs:
        if pdf_url in seen:
            continue
        seen.add(pdf_url)

        fname = f"{ticker}_{date_str}_{doc_type}.pdf"
        dest = base_dir / doc_type / fname
        dest.parent.mkdir(parents=True, exist_ok=True)

        if download_pdf(pdf_url, dest):
            counts[doc_type] += 1
            log.info(f"  ✓ {fname}")
        time.sleep(1)

    recap = {
        "ticker": ticker,
        "source": ir_url,
        "ep": counts["EP"],
        "er": counts["ER"],
        "es": counts["ES"],
        "blocked": False,
    }
    Path(f"/tmp/ir_scrape_{ticker}.json").write_text(json.dumps(recap, indent=2))
    log.info(f"[{ticker}] EP={counts['EP']} ER={counts['ER']} ES={counts['ES']}")
    return recap

def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--task", type=int, choices=[1, 2])
    ap.add_argument("--ticker")
    args = ap.parse_args()

    if args.ticker:
        tickers = [args.ticker.upper()]
    elif args.task == 1:
        tickers = TASK1
    elif args.task == 2:
        tickers = TASK2
    else:
        ap.print_help()
        sys.exit(1)

    log.info(f"Starting: {len(tickers)} tickers, task {args.task}")
    results = []

    with ThreadPoolExecutor(max_workers=12) as ex:
        futures = {ex.submit(scrape_ticker, t): t for t in tickers}
        for fut in as_completed(futures):
            try:
                results.append(fut.result())
            except Exception as e:
                log.error(f"{futures[fut]}: {e}")

    ok = [r for r in results if not r.get("blocked")]
    blocked = [r for r in results if r.get("blocked")]
    log.info(f"Done: {len(ok)} OK / {len(blocked)} blocked")
    for r in blocked:
        log.info(f"  BLOCKED: {r['ticker']}")

    out = DATA_LAKE / f"_ir_task{args.task}_results.json"
    out.write_text(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
