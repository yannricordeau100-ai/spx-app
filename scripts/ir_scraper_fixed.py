#!/usr/bin/env python3
"""
IR Scraper — télécharge EP/ER/ES depuis les pages IR des sociétés SP500
Usage:
  python3 scripts/ir_scraper.py --task 2          # 159 tickers _ir_todo_B.txt
  python3 scripts/ir_scraper.py --task 1          # 78 tickers _ir_redo_edgar.txt
  python3 scripts/ir_scraper.py --ticker LOW      # 1 ticker
  python3 scripts/ir_scraper.py --workers 8       # parallélisme (défaut 4)

REGLES:
  - Source = page IR de la société UNIQUEMENT (jamais SEC EDGAR / sec.gov)
  - Stockage: ~/spx-app/data-lake/<TICKER>/{EP,ER,ES}/
  - Nommage: <TICKER>_YYYY-MM-DD_<type>.pdf
  - Période: Q1 2021 → Q1 2026 (~20 trimestres)
"""

import os, re, sys, json, time, argparse, logging, shutil
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

# ─── Configuration ───────────────────────────────────────────────────────────
DATA_LAKE = Path(__file__).parent.parent / "data-lake"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/126.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}
SESSION = requests.Session()
SESSION.headers.update(HEADERS)
TIMEOUT = 25

YEAR_MIN = 2021
YEAR_MAX = 2026

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("ir")

# ─── Mapping ticker → URL page IR ───────────────────────────────────────────
# Couvre TOUS les tickers de _ir_todo_B.txt + _ir_redo_edgar.txt
KNOWN: dict[str, str] = {
    # === _ir_redo_edgar.txt (78 tickers) ===
    "ABBV":  "https://investors.abbvie.com/press-releases",
    "ABNB":  "https://investors.airbnb.com/press-releases",
    "AEE":   "https://investor.ameren.com/news-releases",
    "AES":   "https://investor.aes.com/news-releases",
    "AFL":   "https://investor.aflac.com/news-releases",
    "AJG":   "https://investor.ajg.com/news-releases",
    "AKAM":  "https://ir.akamai.com/news-releases",
    "ALB":   "https://investors.albemarle.com/news-releases",
    "ALGN":  "https://investor.aligntech.com/news-releases",
    "ALL":   "https://www.allstateenewsroom.com/press-releases",
    "ALLY":  "https://ir.ally.com/news-events/press-releases",
    "AMCR":  "https://investors.amcor.com/news-releases",
    "AME":   "https://ir.ametek.com/news-releases",
    "AMGN":  "https://investors.amgen.com/news-releases",
    "AMP":   "https://ir.ameriprise.com/news-releases",
    "AON":   "https://investor.aon.com/news-releases",
    "APD":   "https://investors.airproducts.com/news-releases",
    "APH":   "https://investors.amphenol.com/news-releases",
    "APTV":  "https://ir.aptiv.com/news-releases",
    "ARE":   "https://investor.are.com/news-releases",
    "ARES":  "https://ir.aresmgmt.com/news-releases",
    "ATMU":  "https://ir.atmus.com/news-releases",
    "AVGO":  "https://investors.broadcom.com/news-releases",
    "AWK":   "https://ir.amwater.com/news-releases",
    "BBWI":  "https://investors.bbwinc.com/news-releases",
    "BF-B":  "https://investors.brown-forman.com/press-releases",
    "BIIB":  "https://investors.biogen.com/news-releases",
    "BIO":   "https://www.bio-rad.com/en-us/corporate/investor-relations",
    "BMY":   "https://investor.bms.com/press-releases",
    "BR":    "https://investor.broadridge.com/news-releases",
    "BRO":   "https://ir.bbinsurance.com/news-releases",
    "BRX":   "https://investors.brixmor.com/news-releases",
    "BSX":   "https://investors.bostonscientific.com/news-releases",
    "BXP":   "https://investors.bxp.com/news-releases",
    "C":     "https://www.citigroup.com/global/news/press-release",
    "CAH":   "https://ir.cardinalhealth.com/news-releases",
    "CARR":  "https://ir.carrier.com/news-releases",
    "CB":    "https://investor.chubb.com/news-releases",
    "CBOE":  "https://ir.cboe.com/news-releases",
    "CCI":   "https://investor.crowncastle.com/news-releases",
    "CDAY":  "https://investors.dayforce.com/news-releases",
    "CLX":   "https://investors.thecloroxcompany.com/news-releases",
    "CMA":   "https://ir.comerica.com/news-releases",
    "COR":   "https://investor.cencora.com/news-releases",
    "COST":  "https://investor.costco.com/news-releases",
    "CPRT":  "https://ir.copart.com/news-releases",
    "CSCO":  "https://investor.cisco.com/news-releases",
    "CSGP":  "https://ir.costargroup.com/news-releases",
    "CTAS":  "https://ir.cintas.com/news-releases",
    "CTSH":  "https://investor.cognizant.com/news-releases",
    "CZR":   "https://investor.czr.com/news-releases",
    "DAL":   "https://ir.delta.com/news-releases",
    "DD":    "https://investors.dupont.com/news-releases",
    "DG":    "https://investor.dollargeneral.com/news-releases",
    "EOG":   "https://investors.eogresources.com/news-releases",
    "FDX":   "https://investors.fedex.com/news-releases",
    "FIS":   "https://investor.fisglobal.com/news-releases",
    "GD":    "https://investorrelations.gd.com/news-releases",
    "HUM":   "https://press.humana.com/news-releases",
    "ISRG":  "https://isrg.intuitive.com/news-releases",
    "ITW":   "https://investor.itw.com/news-releases",
    "MAR":   "https://ir.marriott.com/news-releases",
    "MCK":   "https://investor.mckesson.com/news-releases",
    "MDT":   "https://investorrelations.medtronic.com/news-releases",
    "ORCL":  "https://investor.oracle.com/news-releases",
    "ORLY":  "https://ir.oreillyauto.com/news-releases",
    "PG":    "https://pginvestor.com/financial-reporting/press-releases",
    "PGR":   "https://investors.progressive.com/newsroom/news-releases",
    "PH":    "https://ir.parker.com/news-releases",
    "ROP":   "https://ir.ropertech.com/news-releases",
    "SNPS":  "https://investor.synopsys.com/news-releases",
    "SYK":   "https://ir.stryker.com/news-releases",
    "TMO":   "https://ir.thermofisher.com/news-releases",
    "TT":    "https://ir.tranetechnologies.com/news-releases",
    "TXN":   "https://ir.ti.com/news-releases",
    "VRTX":  "https://investors.vrtx.com/news-releases",
    "WM":    "https://investors.wm.com/news-releases",
    "ZTS":   "https://investor.zoetis.com/news-releases",

    # === _ir_todo_B.txt (159 tickers) ===
    "LNT":   "https://investor.alliantenergy.com/news-releases",
    "LULU":  "https://corporate.lululemon.com/media/press-releases",
    "LUV":   "https://investors.southwest.com/news-releases",
    "LVS":   "https://investor.sands.com/news-releases",
    "LYB":   "https://investors.lyondellbasell.com/news-releases",
    "LYV":   "https://investors.livenationentertainment.com/news-releases",
    "MAA":   "https://investors.maac.com/news-releases",
    "MAS":   "https://ir.masco.com/news-releases",
    "MCD":   "https://corporate.mcdonalds.com/corpmcd/investors/financial-information/quarterly-results.html",
    "MCHP":  "https://ir.microchip.com/news-releases",
    "MDLZ":  "https://ir.mondelezinternational.com/news-releases",
    "MET":   "https://investor.metlife.com/news-releases",
    "MGM":   "https://investors.mgmresorts.com/press-releases",
    "MKC":   "https://ir.mccormick.com/news-releases",
    "MLM":   "https://ir.martinmarietta.com/news-releases",
    "MMM":   "https://investors.3m.com/news-releases",
    "MNST":  "https://investors.monsterbevcorp.com/news-releases",
    "MO":    "https://investor.altria.com/press-releases",
    "MOS":   "https://investors.mosaicco.com/news-releases",
    "MPWR":  "https://ir.monolithicpower.com/news-releases",
    "MRNA":  "https://investors.modernatx.com/news-releases",
    "MRSH":  "https://ir.marshmclennan.com/news-releases",
    "MSI":   "https://investors.motorolasolutions.com/news-releases",
    "MTB":   "https://ir.mtb.com/news-releases",
    "MTD":   "https://www.mt.com/us/en/home/insights/investors/press-releases.html",
    "MU":    "https://investors.micron.com/news-releases",
    "NCLH":  "https://www.nclhltd.com/investors/press-releases",
    "NDAQ":  "https://ir.nasdaq.com/news-releases",
    "NDSN":  "https://investors.nordson.com/news-releases",
    "NEM":   "https://www.newmont.com/investors/news-releases",
    "NI":    "https://ir.nisource.com/news-releases",
    "NKE":   "https://investors.nike.com/investors/news-events/press-releases",
    "NOC":   "https://ir.northropgrumman.com/news-releases",
    "NRG":   "https://investors.nrg.com/news-releases",
    "NTAP":  "https://ir.netapp.com/news-releases",
    "NTRS":  "https://ir.northerntrust.com/news-releases",
    "NUE":   "https://ir.nucor.com/news-releases",
    "NVR":   "https://ir.nvrinc.com/news-releases",
    "NWS":   "https://investors.newscorp.com/press-releases",
    "NWSA":  "https://investors.newscorp.com/press-releases",
    "O":     "https://www.realtyincome.com/investors/press-releases",
    "ODFL":  "https://ir.odfl.com/news-releases",
    "OKE":   "https://ir.oneok.com/news-releases",
    "OMC":   "https://investor.omnicomgroup.com/news-releases",
    "ON":    "https://investor.onsemi.com/news-releases",
    "OTIS":  "https://ir.otis.com/news-releases",
    "OXY":   "https://ir.oxy.com/news-releases",
    "PANW":  "https://investors.paloaltonetworks.com/news-releases",
    "PAYX":  "https://www.paychex.com/newsroom/press-releases",
    "PCAR":  "https://www.paccar.com/investors/press-releases",
    "PCG":   "https://investor.pgecorp.com/news-releases",
    "PEG":   "https://investor.pseg.com/news-releases",
    "PFG":   "https://investors.principal.com/news-releases",
    "PHM":   "https://ir.pultegroup.com/news-releases",
    "PKG":   "https://ir.packagingcorp.com/news-releases",
    "PLTR":  "https://investors.palantir.com/news-releases",
    "PM":    "https://www.pmi.com/investor-relations/press-releases-and-events",
    "PNR":   "https://ir.pentair.com/news-releases",
    "PNW":   "https://investors.pinnaclewest.com/news-releases",
    "PODD":  "https://investor.insulet.com/news-releases",
    "POOL":  "https://ir.poolcorp.com/news-releases",
    "PPG":   "https://investor.ppg.com/news-releases",
    "PPL":   "https://ir.pplweb.com/news-releases",
    "PRU":   "https://investor.prudential.com/news-releases",
    "PSKY":  "https://ir.parsons.com/news-releases",
    "PSX":   "https://ir.phillips66.com/news-releases",
    "PTC":   "https://investor.ptc.com/news-releases",
    "PWR":   "https://investor.quantaservices.com/news-releases",
    "Q":     "https://ir.quintiles.com/news-releases",
    "RCL":   "https://www.rclinvestor.com/news-releases",
    "REG":   "https://investors.regencycenters.com/news-releases",
    "RF":    "https://ir.regions.com/news-releases",
    "RJF":   "https://investor.raymondjames.com/news-releases",
    "RL":    "https://investor.ralphlauren.com/news-releases",
    "RMD":   "https://investor.resmed.com/news-releases",
    "ROK":   "https://ir.rockwellautomation.com/news-releases",
    "ROL":   "https://ir.rollins.com/news-releases",
    "ROST":  "https://investors.rossstores.com/news-releases",
    "RSG":   "https://ir.republicservices.com/news-releases",
    "RTX":   "https://ir.rtx.com/news-releases",
    "RVTY":  "https://ir.revvity.com/news-releases",
    "SATS":  "https://ir.echostar.com/news-releases",
    "SBAC":  "https://investors.sbasite.com/news-releases",
    "SBUX":  "https://investor.starbucks.com/press-releases",
    "SJM":   "https://investor.jmsmucker.com/news-releases",
    "SMCI":  "https://ir.supermicro.com/news-releases",
    "SNA":   "https://investor.snapon.com/news-releases",
    "SNDK":  "https://investor.wdc.com/news-releases",
    "SOLV":  "https://ir.solventum.com/news-releases",
    "SPG":   "https://ir.simon.com/news-releases",
    "SRE":   "https://investors.sempra.com/news-releases",
    "STE":   "https://investors.steris.com/news-releases",
    "STLD":  "https://ir.steeldynamics.com/news-releases",
    "STT":   "https://newsroom.statestreet.com/press-releases",
    "STX":   "https://investors.seagate.com/news-releases",
    "STZ":   "https://ir.cbrands.com/news-releases",
    "SW":    "https://ir.smurfitkappa.com/news-releases",
    "SWK":   "https://ir.stanleyblackanddecker.com/news-releases",
    "SWKS":  "https://ir.skyworksinc.com/news-releases",
    "SYF":   "https://investors.synchronyfinancial.com/news-releases",
    "SYY":   "https://ir.sysco.com/news-releases",
    "TAP":   "https://ir.molsoncoors.com/news-releases",
    "TDG":   "https://ir.transdigm.com/news-releases",
    "TDY":   "https://investors.teledyne.com/news-releases",
    "TECH":  "https://ir.bio-techne.com/news-releases",
    "TEL":   "https://investors.te.com/news-releases",
    "TER":   "https://ir.teradyne.com/news-releases",
    "TJX":   "https://ir.tjx.com/news-releases",
    "TKO":   "https://ir.tkogrp.com/news-releases",
    "TMUS":  "https://investor.t-mobile.com/news-releases",
    "TPL":   "https://www.texaspacific.com/investors/press-releases",
    "TPR":   "https://ir.tapestry.com/news-releases",
    "TRGP":  "https://ir.targa.com/news-releases",
    "TRMB":  "https://investors.trimble.com/news-releases",
    "TROW":  "https://investor.troweprice.com/news-releases",
    "TRV":   "https://investor.travelers.com/news-releases",
    "TSCO":  "https://ir.tractorsupply.com/news-releases",
    "TSN":   "https://ir.tysonfoods.com/news-releases",
    "TTD":   "https://investors.thetradedesk.com/news-releases",
    "TTWO":  "https://ir.take2games.com/news-releases",
    "TXT":   "https://investor.textron.com/news-releases",
    "TYL":   "https://investors.tylertech.com/news-releases",
    "UAL":   "https://ir.united.com/news-releases",
    "UBER":  "https://investor.uber.com/news-events",
    "UDR":   "https://investors.udr.com/news-releases",
    "UHS":   "https://ir.uhsinc.com/news-releases",
    "ULTA":  "https://ir.ultabeauty.com/news-releases",
    "UPS":   "https://investors.ups.com/news-releases",
    "URI":   "https://investor.unitedrentals.com/news-releases",
    "VEEV":  "https://ir.veeva.com/news-releases",
    "VICI":  "https://investors.viciproperties.com/news-releases",
    "VLO":   "https://ir.valero.com/news-releases",
    "VLTO":  "https://investors.veralto.com/news-releases",
    "VMC":   "https://ir.vulcanmaterials.com/news-releases",
    "VRSK":  "https://investor.verisk.com/news-releases",
    "VRSN":  "https://investor.verisign.com/news-releases",
    "VRT":   "https://investors.vertiv.com/news-releases",
    "VST":   "https://investor.vistracorp.com/news-releases",
    "VTR":   "https://ir.ventasreit.com/news-releases",
    "VTRS":  "https://investor.viatris.com/news-releases",
    "WAB":   "https://ir.wabtec.com/news-releases",
    "WAT":   "https://ir.waters.com/news-releases",
    "WBD":   "https://ir.wbd.com/news-releases",
    "WDAY":  "https://investor.workday.com/news-releases",
    "WDC":   "https://investor.wdc.com/news-releases",
    "WEC":   "https://ir.wecenergygroup.com/news-releases",
    "WMB":   "https://investor.williams.com/news-releases",
    "WRB":   "https://ir.wrberkley.com/news-releases",
    "WSM":   "https://ir.williams-sonomainc.com/news-releases",
    "WST":   "https://investors.westpharma.com/news-releases",
    "WTW":   "https://ir.wtwco.com/news-releases",
    "WY":    "https://investor.weyerhaeuser.com/news-releases",
    "WYNN":  "https://ir.wynnresorts.com/news-releases",
    "XEL":   "https://investors.xcelenergy.com/news-releases",
    "XYL":   "https://investors.xylem.com/news-releases",
    "XYZ":   "https://ir.blockinc.com/news-releases",
    "YUM":   "https://investors.yum.com/news-releases",
    "ZBH":   "https://investor.zimmerbiomet.com/news-releases",
    "ZBRA":  "https://investors.zebra.com/news-releases",
}

# ─── Classification des documents ───────────────────────────────────────────
# EP = Earnings Presentation / slides / investor presentation
# ER = Earnings Release / press release / quarterly results
# ES = Earnings Supplement / financial supplement / fact sheet / tables

EP_KW = ["presentation", "slides", "slide deck", "earnings slide",
         "investor presentation", "quarterly presentation", "investor deck"]
ES_KW = ["supplement", "financial supplement", "fact sheet", "statistical",
         "financial tables", "data supplement", "supplemental data",
         "supplemental information", "supplemental financial"]
ER_KW = ["press release", "earnings release", "quarterly results",
         "reports results", "announces", "results for"]

QUARTER_RE = re.compile(
    r"(q[1-4][\s._-]*(fy\s*)?20[2-9]\d|"
    r"20[2-9]\d[\s._-]*q[1-4]|"
    r"(first|second|third|fourth)\s+quarter\s+20[2-9]\d|"
    r"full[- ]?year\s+20[2-9]\d)",
    re.I
)

DATE_RE = re.compile(r"(20(?:2[1-6]))[^\d]?(0[1-9]|1[0-2])[^\d]?(0[1-9]|[12]\d|3[01])")


def classify(text: str, url: str) -> str | None:
    """Classe un lien en EP, ER ou ES. None si inclassable."""
    combined = (text + " " + url).lower()
    # ES en premier car "supplement" est plus specifique
    if any(k in combined for k in ES_KW):
        return "ES"
    if any(k in combined for k in EP_KW):
        return "EP"
    if any(k in combined for k in ER_KW):
        return "ER"
    # PDF sans classification = probablement ER (press release)
    if url.lower().endswith(".pdf") and QUARTER_RE.search(combined):
        return "ER"
    return None


def year_in_range(text: str) -> bool:
    """Vérifie que le texte mentionne une année entre 2021 et 2026."""
    for m in re.finditer(r"20(2[1-6])", text):
        return True
    return False


def extract_date(url: str, text: str) -> str:
    """Extrait la date de publication du document."""
    combined = url + " " + text
    m = DATE_RE.search(combined)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    # Fallback: Q + année
    qm = re.search(r"[qQ]([1-4])[\s._-]*(20\d{2})", combined)
    if qm:
        q, y = int(qm.group(1)), qm.group(2)
        month = {1: "02", 2: "05", 3: "08", 4: "11"}[q]
        return f"{y}-{month}-01"
    qm2 = re.search(r"(20\d{2})[\s._-]*[qQ]([1-4])", combined)
    if qm2:
        y, q = qm2.group(1), int(qm2.group(2))
        month = {1: "02", 2: "05", 3: "08", 4: "11"}[q]
        return f"{y}-{month}-01"
    # Dernier fallback
    ym = re.search(r"(202[1-6])", combined)
    return ym.group(1) + "-01-01" if ym else "2024-01-01"


def safe_get(url: str, **kwargs) -> requests.Response | None:
    """GET avec retry et gestion d'erreur."""
    for attempt in range(3):
        try:
            r = SESSION.get(url, timeout=TIMEOUT, allow_redirects=True, **kwargs)
            if r.status_code == 429:
                time.sleep(5 * (attempt + 1))
                continue
            r.raise_for_status()
            return r
        except requests.exceptions.RequestException as e:
            if attempt < 2:
                time.sleep(2 * (attempt + 1))
            else:
                log.warning(f"GET {url} echoue apres 3 tentatives: {e}")
    return None


def get_links(url: str) -> list[dict]:
    """Recupere tous les liens d'une page."""
    r = safe_get(url)
    if not r:
        return []
    soup = BeautifulSoup(r.text, "html.parser")
    links = []
    for a in soup.find_all("a", href=True):
        href = urljoin(url, a["href"])
        text = a.get_text(" ", strip=True)
        links.append({"href": href, "text": text})
    return links


def get_paginated_links(base_url: str, max_pages: int = 10) -> list[dict]:
    """Recupere les liens sur plusieurs pages (pagination)."""
    all_links = []
    seen_urls = set()

    # Page 1
    links = get_links(base_url)
    for lk in links:
        if lk["href"] not in seen_urls:
            seen_urls.add(lk["href"])
            all_links.append(lk)

    # Chercher liens de pagination
    for page_num in range(2, max_pages + 1):
        # Patterns courants de pagination
        next_url = None
        for lk in links:
            href_lower = lk["href"].lower()
            text_lower = lk["text"].lower()
            if ("page=" + str(page_num) in href_lower or
                "page/" + str(page_num) in href_lower or
                "p=" + str(page_num) in href_lower or
                text_lower in ["next", "next page", "suivant", ">", ">>", "›"] or
                (text_lower == str(page_num))):
                next_url = lk["href"]
                break

        if not next_url:
            break

        time.sleep(0.5)
        links = get_links(next_url)
        new_count = 0
        for lk in links:
            if lk["href"] not in seen_urls:
                seen_urls.add(lk["href"])
                all_links.append(lk)
                new_count += 1
        if new_count == 0:
            break

    return all_links


def download_file(url: str, dest: Path) -> bool:
    """Telecharge un fichier (PDF ou HTML)."""
    if dest.exists() and dest.stat().st_size > 5000:
        return True
    try:
        r = safe_get(url, stream=True)
        if not r:
            return False
        content = b""
        for chunk in r.iter_content(8192):
            content += chunk
            if len(content) > 50_000_000:
                log.warning(f"Fichier trop gros (>50MB): {url}")
                return False

        if content[:5] != b"%PDF-":
            log.warning(f"Pas un PDF: {url}")
            return False

        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(content)
        log.info(f"  -> {dest.name} ({len(content)//1024} KB)")
        return True
    except Exception as e:
        log.warning(f"Download echoue {url}: {e}")
        return False


def scrape_ticker(ticker: str, is_redo: bool = False) -> dict:
    """Scrape un ticker. Si is_redo=True, supprime les anciens fichiers EDGAR."""
    base_dir = DATA_LAKE / ticker

    # Pour les redos EDGAR: supprimer les anciens fichiers
    if is_redo and base_dir.exists():
        for doc_type in ["EP", "ER", "ES"]:
            type_dir = base_dir / doc_type
            if type_dir.exists():
                shutil.rmtree(type_dir)
                log.info(f"  Supprime ancien dossier EDGAR: {type_dir}")

    # Verifier si deja complet (seulement si pas un redo)
    if not is_redo:
        existing = 0
        for doc_type in ["EP", "ER", "ES"]:
            type_dir = base_dir / doc_type
            if type_dir.exists():
                existing += len([f for f in type_dir.iterdir() if f.is_file()])
        if existing >= 40:
            log.info(f"{ticker}: deja {existing} fichiers, skip")
            return {"ticker": ticker, "skipped": True, "existing": existing}

    ir_url = KNOWN.get(ticker)
    if not ir_url:
        log.error(f"{ticker}: URL IR inconnue, skip")
        return {"ticker": ticker, "blocked": True, "reason": "URL_INCONNUE"}

    log.info(f"[{ticker}] {ir_url}")
    counts = {"EP": 0, "ER": 0, "ES": 0}

    # Recuperer les liens (avec pagination)
    all_links = get_paginated_links(ir_url, max_pages=8)
    if not all_links:
        log.warning(f"{ticker}: aucun lien trouve sur {ir_url}")
        return {"ticker": ticker, "blocked": True, "reason": "NO_LINKS", "source": ir_url}

    pdf_jobs = []       # (url, doc_type, date_str)
    release_urls = []   # pages de communiques a explorer

    for lk in all_links:
        href, text = lk["href"], lk["text"]
        combined = (href + " " + text).lower()

        # Exclure sec.gov
        if "sec.gov" in href.lower():
            continue

        if not year_in_range(combined):
            continue

        if href.lower().endswith(".pdf"):
            doc_type = classify(text, href)
            if doc_type:
                date = extract_date(href, text)
                pdf_jobs.append((href, doc_type, date))
        elif any(kw in combined for kw in ["earnings", "results", "quarter", "q1 ", "q2 ", "q3 ", "q4 "]):
            if href.startswith("http") and href != ir_url and "sec.gov" not in href:
                release_urls.append(href)

    # Explorer les pages individuelles de communiques
    visited = set()
    for rel_url in release_urls[:80]:
        if rel_url in visited:
            continue
        visited.add(rel_url)
        time.sleep(0.3)

        inner_links = get_links(rel_url)
        for lk in inner_links:
            href, text = lk["href"], lk["text"]
            if "sec.gov" in href.lower():
                continue
            lower_href = href.lower()
            if lower_href.endswith(".pdf"):
                doc_type = classify(text, href)
                if doc_type:
                    date = extract_date(rel_url + " " + href, text)
                    pdf_jobs.append((href, doc_type, date))

    # Deduplication
    seen = set()
    unique_jobs = []
    for job in pdf_jobs:
        key = job[0]
        if key not in seen:
            seen.add(key)
            unique_jobs.append(job)

    # Telecharger
    for (file_url, doc_type, date_str) in unique_jobs:
        fname = f"{ticker}_{date_str}_{doc_type}.pdf"
        dest = base_dir / doc_type / fname
        if download_file(file_url, dest):
            counts[doc_type] += 1
        time.sleep(0.2)

    recap = {
        "ticker": ticker,
        "source": ir_url,
        "ep": counts["EP"],
        "er": counts["ER"],
        "es": counts["ES"],
        "total": sum(counts.values()),
        "blocked": False,
    }
    Path(f"/tmp/ir_scrape_{ticker}.json").write_text(json.dumps(recap, indent=2))
    log.info(f"[{ticker}] EP={counts['EP']} ER={counts['ER']} ES={counts['ES']}")
    return recap


def load_tickers(path: Path) -> list[str]:
    """Charge les tickers depuis un fichier (1 par ligne ou espace-separes)."""
    content = path.read_text()
    tickers = []
    for token in re.split(r'[\s,]+', content):
        t = token.strip().upper()
        if t and not t.startswith("#"):
            tickers.append(t)
    return tickers


def main():
    ap = argparse.ArgumentParser(description="IR Scraper SP500")
    ap.add_argument("--task", type=int, choices=[1, 2],
                    help="1=redo EDGAR (78 tickers), 2=todo B (159 tickers)")
    ap.add_argument("--ticker", help="1 ticker seulement")
    ap.add_argument("--workers", type=int, default=4,
                    help="Parallelisme (defaut 4, max 8)")
    args = ap.parse_args()

    args.workers = min(args.workers, 8)

    if args.ticker:
        tickers = [args.ticker.upper()]
        is_redo = False
    elif args.task == 1:
        tickers = load_tickers(DATA_LAKE / "_ir_redo_edgar.txt")
        is_redo = True
    elif args.task == 2:
        tickers = load_tickers(DATA_LAKE / "_ir_todo_B.txt")
        is_redo = False
    else:
        ap.print_help()
        sys.exit(1)

    log.info(f"Demarrage: {len(tickers)} ticker(s), {args.workers} workers, redo={is_redo}")
    results = []

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {ex.submit(scrape_ticker, t, is_redo): t for t in tickers}
        for fut in as_completed(futures):
            ticker = futures[fut]
            try:
                results.append(fut.result())
            except Exception as e:
                log.error(f"{ticker}: exception {e}")
                results.append({"ticker": ticker, "blocked": True, "reason": str(e)})

    ok = [r for r in results if not r.get("blocked") and not r.get("skipped")]
    blocked = [r for r in results if r.get("blocked")]
    skipped = [r for r in results if r.get("skipped")]

    log.info(f"\n{'='*50}")
    log.info(f"OK: {len(ok)} | Bloques: {len(blocked)} | Skips: {len(skipped)}")
    if blocked:
        for r in blocked:
            log.info(f"  BLOQUE: {r['ticker']} ({r.get('reason', '?')})")

    total_docs = sum(r.get("total", 0) for r in ok)
    log.info(f"Total documents telecharges: {total_docs}")

    out = DATA_LAKE / f"_ir_scrape_task{args.task or 0}_results.json"
    out.write_text(json.dumps(results, indent=2))
    log.info(f"Resultats -> {out}")


if __name__ == "__main__":
    main()
