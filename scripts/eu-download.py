#!/usr/bin/env python3
"""
EU equivalent of sec-download.py — récupère les rapports annuels et
semestriels des grandes sociétés cotées européennes (Stoxx 600 approx)
depuis AnnualReports.com (agrégateur public, gratuit, sans API key).

Limites :
  - Couverture ~70-85 % du Stoxx 600 (le reste à compléter via OAM nationaux)
  - Annuels uniquement (parfois semestriels), pas d'équivalent 8-K
  - PDFs (pas de gzip car PDFs déjà compressés)

Storage :
  ~/spx-app/sec-data/eu/<COMPANY_SLUG>/<year>_annual.pdf
  ~/spx-app/sec-data/eu/_index.json
  ~/spx-app/sec-data/eu/_progress.json
  ~/spx-app/sec-data/eu/_missing.txt  (sociétés non trouvées)
"""

from __future__ import annotations
import argparse
import json
import re
import ssl
import sys
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

USER_AGENT = "Mozilla/5.0 (Mettrik Research / yannricordeau100@gmail.com)"
RATE_DELAY_S = 0.5  # 2 req/s — reste poli avec AnnualReports.com
DATA_DIR = Path.home() / "spx-app" / "sec-data" / "eu"
INDEX_PATH = DATA_DIR / "_index.json"
PROGRESS_PATH = DATA_DIR / "_progress.json"
LOG_PATH = DATA_DIR / "_log.txt"
MISSING_PATH = DATA_DIR / "_missing.txt"

# SSL context — comme sec-download.py (Python macOS sans cert bundle)
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

# ---------- Stoxx 600 approx (450-500 blue chips européens) ----------
# Format : (slug-ish company name, country)
# Le slug est utilisé pour la recherche AnnualReports.com et pour le dossier.
EU_COMPANIES = [
    # FTSE 100 UK
    ("AstraZeneca", "UK"), ("Shell", "UK"), ("HSBC Holdings", "UK"),
    ("Unilever", "UK"), ("BP", "UK"), ("GlaxoSmithKline", "UK"),
    ("Diageo", "UK"), ("British American Tobacco", "UK"),
    ("Rio Tinto", "UK"), ("Reckitt Benckiser", "UK"),
    ("Lloyds Banking Group", "UK"), ("Barclays", "UK"),
    ("NatWest Group", "UK"), ("Standard Chartered", "UK"),
    ("Prudential", "UK"), ("Aviva", "UK"), ("Legal & General", "UK"),
    ("BT Group", "UK"), ("Vodafone Group", "UK"), ("Sage Group", "UK"),
    ("Compass Group", "UK"), ("WPP", "UK"), ("Pearson", "UK"),
    ("Tesco", "UK"), ("Sainsbury", "UK"), ("Marks and Spencer", "UK"),
    ("BAE Systems", "UK"), ("Rolls-Royce Holdings", "UK"),
    ("Imperial Brands", "UK"), ("Burberry Group", "UK"),
    ("Next plc", "UK"), ("Kingfisher", "UK"), ("Whitbread", "UK"),
    ("Intercontinental Hotels Group", "UK"), ("3i Group", "UK"),
    ("Schroders", "UK"), ("M&G plc", "UK"), ("Hargreaves Lansdown", "UK"),
    ("London Stock Exchange Group", "UK"), ("Experian", "UK"),
    ("RELX", "UK"), ("Informa", "UK"), ("Bunzl", "UK"),
    ("Smith and Nephew", "UK"), ("Croda International", "UK"),
    ("Halma", "UK"), ("Spirax-Sarco Engineering", "UK"),
    ("Intertek Group", "UK"), ("Smiths Group", "UK"),
    ("Berkeley Group Holdings", "UK"), ("Persimmon", "UK"),
    ("Taylor Wimpey", "UK"), ("Barratt Developments", "UK"),
    ("Rightmove", "UK"), ("Auto Trader Group", "UK"),
    ("Ocado Group", "UK"), ("JD Sports Fashion", "UK"),
    ("Associated British Foods", "UK"), ("Coca-Cola HBC", "UK"),
    ("National Grid", "UK"), ("SSE", "UK"), ("Centrica", "UK"),
    ("Severn Trent", "UK"), ("United Utilities Group", "UK"),
    ("Pennon Group", "UK"), ("Anglo American", "UK"),
    ("Glencore", "UK"), ("Antofagasta", "UK"), ("Fresnillo", "UK"),
    ("Endeavour Mining", "UK"), ("BHP Group", "UK"),
    ("Mondi", "UK"), ("Smurfit Westrock", "UK"),
    # DAX 40 Allemagne
    ("SAP SE", "DE"), ("Siemens", "DE"), ("Deutsche Telekom", "DE"),
    ("Allianz SE", "DE"), ("Mercedes-Benz Group", "DE"),
    ("Volkswagen", "DE"), ("BMW Group", "DE"),
    ("Munich Re", "DE"), ("Deutsche Bank", "DE"),
    ("Deutsche Boerse", "DE"), ("Bayer AG", "DE"),
    ("BASF SE", "DE"), ("Adidas", "DE"), ("Henkel", "DE"),
    ("Merck KGaA", "DE"), ("Beiersdorf", "DE"), ("Continental AG", "DE"),
    ("Daimler Truck Holding", "DE"), ("Porsche AG", "DE"),
    ("Porsche SE", "DE"), ("Heidelberg Materials", "DE"),
    ("Hannover Re", "DE"), ("Commerzbank", "DE"),
    ("Infineon Technologies", "DE"), ("Siemens Energy", "DE"),
    ("Siemens Healthineers", "DE"), ("MTU Aero Engines", "DE"),
    ("Vonovia", "DE"), ("Brenntag", "DE"), ("Symrise", "DE"),
    ("Sartorius", "DE"), ("Rheinmetall", "DE"),
    ("Fresenius SE", "DE"), ("Fresenius Medical Care", "DE"),
    ("Qiagen", "DE"), ("Zalando", "DE"), ("Delivery Hero", "DE"),
    ("RWE", "DE"), ("EON SE", "DE"), ("Puma SE", "DE"),
    # CAC 40 France
    ("LVMH", "FR"), ("L'Oreal", "FR"), ("TotalEnergies", "FR"),
    ("Hermes International", "FR"), ("Sanofi", "FR"),
    ("Schneider Electric", "FR"), ("Air Liquide", "FR"),
    ("Airbus", "FR"), ("BNP Paribas", "FR"), ("AXA", "FR"),
    ("Pernod Ricard", "FR"), ("Kering", "FR"), ("Christian Dior", "FR"),
    ("Dassault Systemes", "FR"), ("Safran", "FR"),
    ("Capgemini", "FR"), ("Vinci", "FR"), ("Bouygues", "FR"),
    ("Eiffage", "FR"), ("Veolia Environnement", "FR"),
    ("Engie", "FR"), ("Saint-Gobain", "FR"), ("Stellantis", "FR"),
    ("Michelin", "FR"), ("Renault", "FR"), ("Carrefour", "FR"),
    ("Danone", "FR"), ("Publicis Groupe", "FR"),
    ("Worldline", "FR"), ("Edenred", "FR"), ("Legrand", "FR"),
    ("STMicroelectronics", "FR"), ("Thales", "FR"),
    ("Orange SA", "FR"), ("Vivendi", "FR"), ("Bureau Veritas", "FR"),
    ("Teleperformance", "FR"), ("Unibail-Rodamco-Westfield", "FR"),
    ("Sodexo", "FR"), ("Accor", "FR"),
    # IBEX 35 Espagne
    ("Banco Santander", "ES"), ("BBVA", "ES"), ("Iberdrola", "ES"),
    ("Inditex", "ES"), ("Telefonica", "ES"), ("Repsol", "ES"),
    ("Ferrovial", "ES"), ("Endesa", "ES"), ("Naturgy", "ES"),
    ("Aena", "ES"), ("CaixaBank", "ES"), ("Banco de Sabadell", "ES"),
    ("Mapfre", "ES"), ("Acciona", "ES"), ("Cellnex Telecom", "ES"),
    ("Amadeus IT Group", "ES"), ("ACS Group", "ES"),
    ("Grifols", "ES"), ("IAG", "ES"), ("Merlin Properties", "ES"),
    ("Red Electrica", "ES"), ("Enagas", "ES"),
    # FTSE MIB Italie
    ("Eni", "IT"), ("Enel", "IT"), ("Intesa Sanpaolo", "IT"),
    ("UniCredit", "IT"), ("Stellantis NV", "IT"),
    ("Generali", "IT"), ("Ferrari", "IT"), ("Atlantia", "IT"),
    ("Snam", "IT"), ("Terna", "IT"), ("Mediobanca", "IT"),
    ("Banco BPM", "IT"), ("Pirelli", "IT"), ("Leonardo", "IT"),
    ("Saipem", "IT"), ("Tenaris", "IT"), ("Telecom Italia", "IT"),
    ("Prysmian", "IT"), ("Recordati", "IT"), ("Moncler", "IT"),
    ("Campari Group", "IT"), ("Brembo", "IT"), ("Amplifon", "IT"),
    ("DiaSorin", "IT"), ("Mediaset", "IT"),
    # AEX 25 Pays-Bas
    ("ASML Holding", "NL"), ("Prosus", "NL"), ("Royal Dutch Shell", "NL"),
    ("Universal Music Group", "NL"), ("Heineken", "NL"),
    ("Ahold Delhaize", "NL"), ("Wolters Kluwer", "NL"),
    ("Philips", "NL"), ("ING Group", "NL"), ("Adyen", "NL"),
    ("ASM International", "NL"), ("Akzo Nobel", "NL"),
    ("DSM-Firmenich", "NL"), ("Aegon", "NL"), ("NN Group", "NL"),
    ("Randstad", "NL"), ("KPN", "NL"), ("BE Semiconductor Industries", "NL"),
    ("Just Eat Takeaway", "NL"), ("ArcelorMittal", "NL"),
    # BEL 20 Belgique
    ("AB InBev", "BE"), ("KBC Group", "BE"), ("UCB", "BE"),
    ("Solvay", "BE"), ("Umicore", "BE"), ("D'Ieteren Group", "BE"),
    ("Proximus", "BE"), ("Ageas", "BE"), ("Telenet", "BE"),
    ("Colruyt", "BE"), ("Galapagos", "BE"), ("WDP", "BE"),
    ("Cofinimmo", "BE"), ("Aedifica", "BE"),
    # SMI 20 Suisse
    ("Nestle", "CH"), ("Roche Holding", "CH"), ("Novartis", "CH"),
    ("UBS Group", "CH"), ("ABB Ltd", "CH"), ("Richemont", "CH"),
    ("Zurich Insurance Group", "CH"), ("Glencore plc", "CH"),
    ("Lonza Group", "CH"), ("Sika", "CH"),
    ("Givaudan", "CH"), ("Holcim", "CH"), ("Alcon", "CH"),
    ("Swiss Re", "CH"), ("Partners Group", "CH"), ("Kuehne + Nagel", "CH"),
    ("Geberit", "CH"), ("Logitech", "CH"), ("Swiss Life", "CH"),
    ("Sonova", "CH"), ("Straumann", "CH"), ("Baloise", "CH"),
    # OMX Stockholm 30 Suède
    ("Atlas Copco", "SE"), ("Volvo Group", "SE"), ("Investor AB", "SE"),
    ("EQT AB", "SE"), ("Hexagon AB", "SE"), ("Sandvik", "SE"),
    ("Ericsson", "SE"), ("H&M Hennes & Mauritz", "SE"),
    ("Skanska", "SE"), ("Assa Abloy", "SE"), ("Essity", "SE"),
    ("Electrolux", "SE"), ("SEB", "SE"), ("Swedbank", "SE"),
    ("Svenska Handelsbanken", "SE"), ("Nordea Bank", "SE"),
    ("Boliden", "SE"), ("Tele2", "SE"), ("Telia Company", "SE"),
    ("Husqvarna", "SE"), ("Industrivarden", "SE"), ("Kinnevik", "SE"),
    ("Latour", "SE"), ("SCA", "SE"), ("Securitas", "SE"),
    # ATX Autriche
    ("OMV", "AT"), ("Erste Group Bank", "AT"),
    ("Verbund", "AT"), ("Andritz", "AT"), ("Voestalpine", "AT"),
    ("Raiffeisen Bank International", "AT"), ("Wienerberger", "AT"),
    ("Vienna Insurance Group", "AT"), ("Mondi plc", "AT"),
    ("BAWAG Group", "AT"),
    # OBX Norvège
    ("Equinor", "NO"), ("DNB Bank", "NO"), ("Mowi", "NO"),
    ("Yara International", "NO"), ("Telenor", "NO"),
    ("Aker BP", "NO"), ("Norsk Hydro", "NO"), ("Storebrand", "NO"),
    ("Schibsted", "NO"), ("Orkla", "NO"), ("Adevinta", "NO"),
    ("Kongsberg Gruppen", "NO"), ("Salmar", "NO"),
    # WIG 20 Pologne
    ("PKN Orlen", "PL"), ("PKO Bank Polski", "PL"), ("PZU", "PL"),
    ("KGHM Polska Miedz", "PL"), ("CD Projekt", "PL"),
    ("Allegro.eu", "PL"), ("LPP SA", "PL"), ("Dino Polska", "PL"),
    ("Pekao", "PL"), ("Cyfrowy Polsat", "PL"),
    # ISEQ Irlande
    ("CRH plc", "IE"), ("Ryanair Holdings", "IE"),
    ("Bank of Ireland Group", "IE"), ("Kerry Group", "IE"),
    ("AIB Group", "IE"), ("Smurfit Westrock plc", "IE"),
    ("Flutter Entertainment", "IE"), ("Glanbia", "IE"),
    ("Kingspan Group", "IE"), ("DCC plc", "IE"),
    # PSI Portugal
    ("Galp Energia", "PT"), ("EDP - Energias de Portugal", "PT"),
    ("Jeronimo Martins", "PT"), ("Banco Comercial Portugues", "PT"),
    ("REN", "PT"), ("Sonae SGPS", "PT"), ("NOS SGPS", "PT"),
    # Finlande (OMX Helsinki 25)
    ("Nokia", "FI"), ("Kone", "FI"), ("Sampo", "FI"), ("Stora Enso", "FI"),
    ("Neste", "FI"), ("Wartsila", "FI"), ("Fortum", "FI"),
    ("Elisa", "FI"), ("UPM-Kymmene", "FI"), ("Outokumpu", "FI"),
    # Danemark (OMX Copenhagen 25)
    ("Novo Nordisk", "DK"), ("Maersk", "DK"), ("Orsted", "DK"),
    ("DSV", "DK"), ("Pandora", "DK"), ("Carlsberg", "DK"),
    ("Coloplast", "DK"), ("Vestas Wind Systems", "DK"),
    ("Demant", "DK"), ("Genmab", "DK"), ("Tryg", "DK"),
    ("Royal Unibrew", "DK"), ("Ambu", "DK"), ("ISS A/S", "DK"),
    # Grèce
    ("Hellenic Telecom", "GR"), ("National Bank of Greece", "GR"),
    ("Alpha Services", "GR"), ("Public Power Corporation", "GR"),
    ("Mytilineos", "GR"), ("OPAP", "GR"),
]

# Dédupliquer par nom
seen = set()
EU_COMPANIES = [(n, c) for (n, c) in EU_COMPANIES if not (n in seen or seen.add(n))]

# ---------- HTTP throttled ----------
_last_call = 0.0


def http_get(url: str, accept: str = "*/*", binary: bool = False) -> bytes:
    global _last_call
    delta = time.time() - _last_call
    if delta < RATE_DELAY_S:
        time.sleep(RATE_DELAY_S - delta)
    _last_call = time.time()
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": accept,
        "Accept-Language": "en-US,en;q=0.9",
    })
    with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as resp:
        return resp.read()


# ---------- Logging ----------
def log(msg: str) -> None:
    ts = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    line = f"[{ts}] {msg}\n"
    print(line, end="", flush=True)
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a") as f:
        f.write(line)


# ---------- State ----------
def load_index() -> dict:
    if INDEX_PATH.exists():
        return json.loads(INDEX_PATH.read_text())
    return {}


def save_index(idx: dict) -> None:
    INDEX_PATH.write_text(json.dumps(idx, indent=2, sort_keys=True))


def load_progress() -> dict:
    if PROGRESS_PATH.exists():
        return json.loads(PROGRESS_PATH.read_text())
    return {"completed": [], "started_at": datetime.utcnow().isoformat() + "Z"}


def save_progress(p: dict) -> None:
    PROGRESS_PATH.write_text(json.dumps(p, indent=2))


# ---------- AnnualReports.com scraping ----------
def safe_slug(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "_", name).strip("_")
    return s[:80]


def search_annualreports(name: str) -> str | None:
    """Recherche une société sur AnnualReports.com et retourne l'URL de
    sa page (ou None si pas trouvée)."""
    q = urllib.parse.quote(name)
    url = f"https://www.annualreports.com/Companies?search={q}"
    try:
        html = http_get(url).decode("utf-8", errors="replace")
    except Exception as e:
        log(f"     ! search failed for {name!r}: {e}")
        return None
    # Cherche le 1er lien /Company/<slug>
    m = re.search(r'href="(/Company/[^"]+)"', html)
    if m:
        return "https://www.annualreports.com" + m.group(1)
    return None


def parse_company_pdfs(company_url: str) -> list[tuple[str, str]]:
    """Parse la page société et retourne [(year, pdf_url), ...]."""
    try:
        html = http_get(company_url).decode("utf-8", errors="replace")
    except Exception as e:
        log(f"     ! company page failed: {e}")
        return []
    # AnnualReports.com utilise des liens de type :
    #   https://www.annualreports.com/HostedData/AnnualReportArchive/X/SUFFIX_<year>.pdf
    # ou parfois href absolu vers le PDF.
    pdfs = []
    seen_urls = set()
    # Pattern PDFs hostés
    for m in re.finditer(
        r'href="((?:https://www\.annualreports\.com)?/HostedData/AnnualReport(?:Archive)?/[^"]+\.pdf)"',
        html,
        re.IGNORECASE,
    ):
        url = m.group(1)
        if not url.startswith("http"):
            url = "https://www.annualreports.com" + url
        if url in seen_urls:
            continue
        seen_urls.add(url)
        # Essayer d'extraire l'année du nom de fichier
        yr_match = re.search(r"(20\d{2})", url)
        year = yr_match.group(1) if yr_match else "unknown"
        pdfs.append((year, url))
    # Trie par année descendante, prend les 3 plus récents
    pdfs.sort(key=lambda x: x[0], reverse=True)
    return pdfs[:3]


def download_pdf(url: str, dest: Path) -> int:
    """Download un PDF, retourne sa taille."""
    content = http_get(url, accept="application/pdf", binary=True)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(content)
    return len(content)


# ---------- Pipeline ----------
def process_company(name: str, country: str, idx: dict) -> bool:
    log(f"  → {name} [{country}]")
    slug = safe_slug(name)
    company_idx = idx.setdefault(slug, {
        "name": name,
        "country": country,
        "filings": [],
    })
    existing_keys = {f["url"] for f in company_idx["filings"]}

    page_url = search_annualreports(name)
    if not page_url:
        log(f"     ! not found on AnnualReports.com")
        with MISSING_PATH.open("a") as f:
            f.write(f"{country}\t{name}\n")
        return False

    log(f"     page: {page_url}")
    pdfs = parse_company_pdfs(page_url)
    if not pdfs:
        log(f"     ! no PDFs on page")
        with MISSING_PATH.open("a") as f:
            f.write(f"{country}\t{name}\t(page found, no PDFs)\n")
        return False

    n_new = 0
    for year, pdf_url in pdfs:
        if pdf_url in existing_keys:
            continue
        dest = DATA_DIR / slug / f"{year}_annual.pdf"
        if dest.exists():
            existing_keys.add(pdf_url)
            company_idx["filings"].append({
                "year": year, "url": pdf_url, "type": "annual",
                "path": str(dest.relative_to(DATA_DIR)),
            })
            continue
        try:
            size = download_pdf(pdf_url, dest)
            company_idx["filings"].append({
                "year": year, "url": pdf_url, "type": "annual",
                "path": str(dest.relative_to(DATA_DIR)),
                "size_bytes": size,
            })
            existing_keys.add(pdf_url)
            n_new += 1
            log(f"     ✓ {year} annual ({size//1024} KB)")
        except urllib.error.HTTPError as e:
            log(f"     ! HTTP {e.code} on {year}: {e.reason}")
        except Exception as e:
            log(f"     ! download failed for {year}: {e}")

    log(f"     {n_new} new file(s) for {name}")
    return n_new > 0 or len(pdfs) > 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--start", type=int, default=0)
    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    log(f"==== eu-download.py started ====")
    log(f"data dir: {DATA_DIR}")
    log(f"companies in target list: {len(EU_COMPANIES)}")

    progress = load_progress()
    completed = set(progress["completed"])
    log(f"Resume : {len(completed)} société(s) déjà traitée(s).")

    queue = [(n, c) for (n, c) in EU_COMPANIES if n not in completed]
    queue = queue[args.start:]
    if args.limit:
        queue = queue[:args.limit]
    log(f"Queue : {len(queue)} société(s) à traiter.")

    idx = load_index()
    save_every = 5
    counter = 0

    for name, country in queue:
        try:
            ok = process_company(name, country, idx)
            completed.add(name)
            progress["completed"] = sorted(completed)
            progress["last_company"] = name
            progress["last_at"] = datetime.utcnow().isoformat() + "Z"
            counter += 1
            if counter % save_every == 0:
                save_index(idx)
                save_progress(progress)
                log(f"  · checkpoint saved ({counter} processed)")
        except KeyboardInterrupt:
            log("Interrupted by user.")
            break
        except Exception as e:
            log(f"  !! Unhandled: {e}")
            log(traceback.format_exc())

    save_index(idx)
    save_progress(progress)
    log(f"==== Done. {len(completed)} société(s) complétée(s) total. ====")


if __name__ == "__main__":
    main()
