#!/usr/bin/env python3
"""
scripts/fr-doc-watcher.py

Veille documentaire CAC 40 (Phase 4 chaîne CAC 40, cf .conv-state/cac40-HANDOFF.md).

Workflow :
1. Lire l'univers CAC 40 depuis .conv-state/cac40-state.json (clé `univers`).
2. Pour chaque sté : fetch de la page résultats du site IR officiel (source
   primaire), secours = info-financiere.gouv.fr (API OpenDataSoft flux AMF).
3. Détecter les PDF de publication (URD, RFS, CP, TRIM, SLIDES) récents non
   présents dans data-lake/<T>/ir/<TYPE>/ (dedup sur <T>_<TYPE>_<periode>_*).
4. Télécharger, puis pdftotext -layout + gzip → .txt.gz à côté du PDF.
5. État écrit dans src/data/_fr-doc-watcher-status.json :
   {ticker: {dernier_check, derniere_publication_vue, statut, a_rafraichir}}.

Règles STRICTES :
- User-Agent EXACTEMENT "Mettrik research yannricordeau100@gmail.com".
  JAMAIS d'imitation de navigateur pour passer un WAF (règle durcie 1er août
  2026). Site bloqué (403/timeout) = statut "waf_bloque", PAS un échec.
- 1 requête/seconde max, toutes cibles confondues.
- Ne touche PAS au watcher US (daily-doc-watcher.py / _daily-doc-watcher-status.json).
- Idempotent : un doc déjà sur disque n'est jamais re-téléchargé.
- ZÉRO API Anthropic payante (RULES-GOLDEN §0bis).

Usage :
  python3 scripts/fr-doc-watcher.py                  # les 40 stés
  python3 scripts/fr-doc-watcher.py --tickers=MC.PA,TTE.PA
  python3 scripts/fr-doc-watcher.py --dry-run        # détection sans écriture
"""

from __future__ import annotations

import gzip
import json
import re
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from urllib.parse import urljoin, urlparse, quote

PROJECT_ROOT = Path("/Users/yann/spx-app")
STATE_PATH = PROJECT_ROOT / ".conv-state/cac40-state.json"
STATUS_PATH = PROJECT_ROOT / "src/data/_fr-doc-watcher-status.json"
DATA_LAKE = PROJECT_ROOT / "data-lake"
PDFTOTEXT = "/opt/homebrew/bin/pdftotext"
LOG_PREFIX = "[fr-doc-watcher]"

USER_AGENT = "Mettrik research yannricordeau100@gmail.com"  # STRICT, jamais modifié
RATE_SECONDS = 1.0
MAX_DOWNLOADS_PER_TICKER = 3
MIN_YEAR = datetime.now(timezone.utc).year - 1  # publications récentes uniquement

# Pages résultats IR officielles (source primaire). Best-effort : la première
# URL qui répond 200 est utilisée. Bloqué/KO partout → fallback info-financiere.
IR_PAGES: dict[str, list[str]] = {
    "AC.PA": ["https://group.accor.com/fr-FR/finance"],
    "AI.PA": ["https://www.airliquide.com/fr/investisseurs"],
    "AIR.PA": ["https://www.airbus.com/en/investors/financial-results-and-annual-reports"],
    "MT.AS": ["https://corporate.arcelormittal.com/investors"],
    "CS.PA": ["https://www.axa.com/fr/investisseurs"],
    "BNP.PA": ["https://invest.bnpparibas/resultats", "https://invest.bnpparibas/"],
    "EN.PA": ["https://www.bouygues.com/finance/"],
    "BVI.PA": ["https://group.bureauveritas.com/fr/investisseurs"],
    "CAP.PA": ["https://investors.capgemini.com/fr/", "https://investors.capgemini.com/en/"],
    "CA.PA": ["https://www.carrefour.com/fr/finance"],
    "ACA.PA": ["https://www.credit-agricole.com/finance/publications-financieres", "https://www.credit-agricole.com/finance"],
    "BN.PA": ["https://www.danone.com/fr/investor-relations.html", "https://www.danone.com/investor-relations.html"],
    "DSY.PA": ["https://investor.3ds.com/"],
    "FGR.PA": ["https://www.eiffage.com/finance"],
    "ENGI.PA": ["https://www.engie.com/finance/resultats", "https://www.engie.com/finance"],
    "EL.PA": ["https://www.essilorluxottica.com/en/investors/"],
    "ERF.PA": ["https://www.eurofins.com/investor-relations/"],
    "ENX.PA": ["https://www.euronext.com/en/investor-relations"],
    "RMS.PA": ["https://finance.hermes.com/", "https://finance.hermes.com/en/"],
    "KER.PA": ["https://www.kering.com/fr/finance/", "https://www.kering.com/en/finance/"],
    "LR.PA": ["https://www.legrandgroup.com/fr/investisseurs-et-actionnaires"],
    "OR.PA": ["https://www.loreal-finance.com/fr", "https://www.loreal-finance.com/en"],
    "MC.PA": ["https://www.lvmh.com/en/investors", "https://www.lvmh.fr/investisseurs"],
    "ML.PA": ["https://www.michelin.com/finance/"],
    "ORA.PA": ["https://www.orange.com/fr/finance"],
    "RI.PA": ["https://www.pernod-ricard.com/fr/investisseurs", "https://www.pernod-ricard.com/en/investors"],
    "PUB.PA": ["https://www.publicisgroupe.com/fr/investors", "https://www.publicisgroupe.com/en/investors"],
    "RNO.PA": ["https://www.renaultgroup.com/finance/"],
    "SAF.PA": ["https://www.safran-group.com/fr/finance"],
    "SGO.PA": ["https://www.saint-gobain.com/fr/finance"],
    "SAN.PA": ["https://www.sanofi.com/fr/investisseurs", "https://www.sanofi.com/en/investors"],
    "SU.PA": ["https://www.se.com/ww/en/about-us/investor-relations/"],
    "GLE.PA": ["https://investisseurs.societegenerale.com/fr", "https://www.societegenerale.com/fr/finance"],
    "STLAP.PA": ["https://www.stellantis.com/en/investors"],
    "STMPA.PA": ["https://investors.st.com/"],
    "HO.PA": ["https://www.thalesgroup.com/fr/investisseur"],
    "TTE.PA": ["https://totalenergies.com/fr/investisseurs", "https://totalenergies.com/investors"],
    "URW.PA": ["https://www.urw.com/en/investors"],
    "VIE.PA": ["https://www.veolia.com/fr/finance"],
    "DG.PA": ["https://www.vinci.com/vinci.nsf/fr/finance/pages/index.htm", "https://www.vinci.com/finance"],
}

# Classification type de publication (ordre = priorité).
TYPE_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("URD", re.compile(r"universal[\s_-]?registration|enregistrement[\s_-]?universel|\burd\b|document[\s_-]d[\s_'-]?enregistrement", re.I)),
    ("RFS", re.compile(r"half[\s_-]?year|semestriel|interim[\s_-]financial[\s_-]report|rapport[\s_-]financier[\s_-]semestriel|semi[\s_-]?annual", re.I)),
    ("TRIM", re.compile(r"trimestriel|quarterly[\s_-]information|(first|third|1st|3rd)[\s_-]quarter|\b[qt][13]\b", re.I)),
    ("SLIDES", re.compile(r"presentation|slides|diaporama", re.I)),
    ("CP", re.compile(r"press[\s_-]?release|communiqu|resultats|r[ée]sultats|results|earnings", re.I)),
]
# Un lien doit matcher un mot-clé financier pour être candidat.
FINANCE_HINT = re.compile(
    r"result|r[ée]sultat|communiqu|press|quarter|trimest|semestri|half[\s_-]?year|interim|"
    r"registration|enregistrement|\burd\b|earnings|financial[\s_-](report|statement|document)|presentation",
    re.I,
)
EXCLUDE = re.compile(
    r"sustainab|climate|climat|csr|esg|ethic|conduct|charter|charte|governance[\s_-]report|"
    r"assembl|agm|shareholders?[\s_-]meeting|dividend|prospectus|notice|convocation|"
    r"positive[\s_-]impact|snapshot|brochure",
    re.I,
)

INFOFI_API = (
    "https://www.info-financiere.gouv.fr/api/explore/v2.1/catalog/datasets/"
    "flux-amf-new-prod/records?where=search(identificationsociete_iso_nom_soc,\"{q}\")"
    "&order_by=informationdeposee_inf_dat_emt%20desc&limit=10"
)

_last_request_ts = 0.0


def _ssl_context() -> ssl.SSLContext:
    """Contexte SSL avec un vrai bundle CA (le python.org framework n'en a pas)."""
    try:
        import certifi  # type: ignore
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        pass
    for cafile in ("/etc/ssl/cert.pem", "/opt/homebrew/etc/ca-certificates/cert.pem"):
        if Path(cafile).exists():
            return ssl.create_default_context(cafile=cafile)
    return ssl.create_default_context()


SSL_CTX = _ssl_context()


def log(msg: str) -> None:
    print(f"{LOG_PREFIX} {datetime.now(timezone.utc).isoformat()} {msg}", flush=True)


def throttle() -> None:
    global _last_request_ts
    wait = RATE_SECONDS - (time.monotonic() - _last_request_ts)
    if wait > 0:
        time.sleep(wait)
    _last_request_ts = time.monotonic()


def http_get(url: str, timeout: int = 30) -> bytes:
    """GET avec UA strict + throttle 1 req/s. Lève urllib.error.* si échec."""
    throttle()
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as resp:
        return resp.read()


def load_univers() -> list[dict]:
    with open(STATE_PATH, "r", encoding="utf8") as f:
        state = json.load(f)
    return state.get("univers") or []


def load_status() -> dict:
    if STATUS_PATH.exists():
        try:
            with open(STATUS_PATH, "r", encoding="utf8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            log(f"WARNING: status file illisible, repart de zéro ({STATUS_PATH})")
    return {}


def save_status(status: dict) -> None:
    STATUS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(STATUS_PATH, "w", encoding="utf8") as f:
        json.dump(status, f, indent=2, ensure_ascii=False, sort_keys=True)


def extract_pdf_links(html: str, base_url: str) -> list[tuple[str, str]]:
    """Retourne [(url_absolue, texte_ancre_ou_nom)] pour chaque lien PDF."""
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for m in re.finditer(r'<a\b[^>]*href=["\']([^"\']+\.pdf[^"\']*)["\'][^>]*>(.*?)</a>', html, re.I | re.S):
        href, inner = m.group(1), re.sub(r"<[^>]+>", " ", m.group(2))
        url = urljoin(base_url, unescape(href))
        if url not in seen:
            seen.add(url)
            out.append((url, unescape(inner).strip()[:200]))
    # href pdf hors ancres complètes (JS, data-attrs)
    for m in re.finditer(r'["\'](https?://[^"\']+\.pdf[^"\']*)["\']', html, re.I):
        url = unescape(m.group(1))
        if url not in seen:
            seen.add(url)
            out.append((url, ""))
    return out


def classify(url: str, anchor: str) -> str | None:
    basename = unescape(urlparse(url).path.split("/")[-1])
    hay = f"{basename} {anchor} {url}"
    if EXCLUDE.search(hay):
        return None
    if not FINANCE_HINT.search(hay):
        return None
    for doc_type, pat in TYPE_PATTERNS:
        if pat.search(hay):
            return doc_type
    return None


def infer_periode(url: str, anchor: str, doc_type: str) -> str | None:
    basename = urlparse(url).path.split("/")[-1]
    hay = f"{basename} {anchor}"
    years = re.findall(r"(?<!\d)(20\d{2})(?!\d)", hay)
    if not years:
        return None
    year = max(years)
    if int(year) < MIN_YEAR:
        return None  # trop ancien, pas une nouvelle publication
    if re.search(r"\b(s1|h1|half[\s_-]?year|semestriel|interim|semi[\s_-]?annual)\b", hay, re.I):
        return f"S1{year}"
    m = re.search(r"\b(?:q|t)([1234])\b", hay, re.I)
    if m:
        n = m.group(1)
        return f"S1{year}" if n == "2" else (f"FY{year}" if n == "4" else f"T{n}{year}")
    if re.search(r"\b(first|1st|premier)\b.{0,12}(quarter|trimestre)", hay, re.I):
        return f"T1{year}"
    if re.search(r"\b(third|3rd|troisi)\w*\b.{0,12}(quarter|trimestre)", hay, re.I):
        return f"T3{year}"
    return f"FY{year}"


def already_on_disk(ticker: str, doc_type: str, periode: str) -> bool:
    d = DATA_LAKE / ticker / "ir" / doc_type
    return d.exists() and any(d.glob(f"{ticker}_{doc_type}_{periode}_*.pdf"))


def pdf_to_txt_gz(pdf_path: Path) -> bool:
    txt_path = pdf_path.with_suffix(".txt")
    try:
        subprocess.run([PDFTOTEXT, "-layout", str(pdf_path), str(txt_path)],
                       check=True, capture_output=True, timeout=120)
        with open(txt_path, "rb") as f_in, gzip.open(str(txt_path) + ".gz", "wb") as f_out:
            f_out.write(f_in.read())
        txt_path.unlink()
        return True
    except Exception as e:
        log(f"  ✗ pdftotext fail {pdf_path.name}: {e}")
        if txt_path.exists():
            txt_path.unlink()
        return False


def download_doc(ticker: str, url: str, doc_type: str, periode: str, dry_run: bool) -> str | None:
    """Télécharge un doc, retourne le nom de fichier ou None."""
    today = datetime.now(timezone.utc).date().isoformat()
    fname = f"{ticker}_{doc_type}_{periode}_{today}.pdf"
    target = DATA_LAKE / ticker / "ir" / doc_type / fname
    if dry_run:
        log(f"  [dry-run] téléchargerait {fname} depuis {url}")
        return fname
    try:
        content = http_get(url, timeout=90)
    except Exception as e:
        log(f"  ✗ {ticker} download {url}: {e}")
        return None
    if not content.startswith(b"%PDF"):
        log(f"  ✗ {ticker} contenu non-PDF ignoré: {url}")
        return None
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    pdf_to_txt_gz(target)
    log(f"  ↓ {ticker} {doc_type} {periode} → {target.relative_to(PROJECT_ROOT)} ({len(content)} o)")
    return fname


def fetch_ir_candidates(ticker: str) -> tuple[list[tuple[str, str]] | None, str]:
    """Fetch la page IR primaire. Retourne (liens_pdf, statut_source)."""
    blocked = False
    for page_url in IR_PAGES.get(ticker, []):
        try:
            html = http_get(page_url).decode("utf8", errors="replace")
            return extract_pdf_links(html, page_url), "ir"
        except urllib.error.HTTPError as e:
            log(f"  {ticker} IR {page_url}: HTTP {e.code}")
            if e.code in (401, 403, 406, 429):
                blocked = True
        except Exception as e:
            log(f"  {ticker} IR {page_url}: {e}")
            blocked = True  # timeout probable WAF : pas de contournement
    return None, ("waf_bloque" if blocked else "erreur_source")


def fetch_infofi_fallback(nom: str) -> list[tuple[str, str]]:
    """Secours info-financiere.gouv.fr : dernières publications AMF de la sté."""
    url = INFOFI_API.format(q=quote(nom))
    try:
        data = json.loads(http_get(url).decode("utf8", errors="replace"))
    except Exception as e:
        log(f"  info-financiere fail ({nom}): {e}")
        return []
    out = []
    for rec in data.get("results", []):
        pdf = rec.get("url_de_recuperation")
        title = rec.get("informationdeposee_inf_tit_inf") or ""
        if pdf and pdf.lower().endswith(".pdf"):
            out.append((pdf, title))
    return out


def process_ticker(ticker: str, nom: str, status: dict, dry_run: bool) -> None:
    prev = status.get(ticker, {})
    entry = {
        "dernier_check": datetime.now(timezone.utc).isoformat(),
        "derniere_publication_vue": prev.get("derniere_publication_vue"),
        "statut": "ok",
        "a_rafraichir": bool(prev.get("a_rafraichir", False)),
    }
    links, source = fetch_ir_candidates(ticker)
    if links is None:
        log(f"  {ticker}: source primaire indisponible ({source}), fallback info-financiere")
        links = fetch_infofi_fallback(nom)
        if not links:
            entry["statut"] = source  # waf_bloque ou erreur_source
            status[ticker] = entry
            log(f"  {ticker}: statut={source}, aucune source exploitable")
            return

    candidates: list[tuple[str, str, str, str]] = []  # (url, anchor, type, periode)
    seen_keys: set[tuple[str, str]] = set()
    for url, anchor in links:
        doc_type = classify(url, anchor)
        if not doc_type:
            continue
        periode = infer_periode(url, anchor, doc_type)
        if not periode:
            continue
        key = (doc_type, periode)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        candidates.append((url, anchor, doc_type, periode))

    new_docs: list[str] = []
    for url, anchor, doc_type, periode in candidates:
        if already_on_disk(ticker, doc_type, periode):
            continue
        if len(new_docs) >= MAX_DOWNLOADS_PER_TICKER:
            log(f"  {ticker}: cap {MAX_DOWNLOADS_PER_TICKER} téléchargements atteint")
            break
        fname = download_doc(ticker, url, doc_type, periode, dry_run)
        if fname:
            new_docs.append(fname)

    if new_docs:
        entry["derniere_publication_vue"] = new_docs[-1]
        entry["statut"] = "nouvelle_publication"
        entry["a_rafraichir"] = True
    log(f"  {ticker}: {len(links)} PDF vus, {len(candidates)} candidats, {len(new_docs)} nouveaux, statut={entry['statut']}")
    status[ticker] = entry


def main() -> int:
    dry_run = "--dry-run" in sys.argv
    only: list[str] | None = None
    for arg in sys.argv[1:]:
        if arg.startswith("--tickers="):
            only = [t.strip() for t in arg.split("=", 1)[1].split(",") if t.strip()]
    univers = load_univers()
    if not univers:
        log("FATAL: univers CAC 40 vide (cac40-state.json)")
        return 1
    if only:
        univers = [e for e in univers if e["ticker"] in only]
        missing = set(only) - {e["ticker"] for e in univers}
        if missing:
            log(f"WARNING: tickers inconnus ignorés: {sorted(missing)}")
    log(f"Run {'DRY-RUN ' if dry_run else ''}sur {len(univers)} sté(s): {', '.join(e['ticker'] for e in univers)}")

    status = load_status()
    for e in univers:
        log(f"— {e['ticker']} ({e['nom']})")
        try:
            process_ticker(e["ticker"], e["nom"], status, dry_run)
        except Exception as exc:
            log(f"  ✗ {e['ticker']} erreur inattendue: {exc}")
            status[e["ticker"]] = {
                "dernier_check": datetime.now(timezone.utc).isoformat(),
                "derniere_publication_vue": status.get(e["ticker"], {}).get("derniere_publication_vue"),
                "statut": f"erreur: {type(exc).__name__}",
                "a_rafraichir": bool(status.get(e["ticker"], {}).get("a_rafraichir", False)),
            }
    if dry_run:
        log("DRY-RUN: statut non écrit")
    else:
        save_status(status)
        log(f"Status écrit: {STATUS_PATH.relative_to(PROJECT_ROOT)}")
    log("Done.")
    return 0


if __name__ == "__main__":
    try:
        rc = main()
    except KeyboardInterrupt:
        log("Interrupted by user")
        rc = 130
    sys.exit(rc)
