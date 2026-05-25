#!/usr/bin/env python3
"""scan-kpis.py — Mission KPI Verification Exhaustive v3 (CONV-CONCEPTS / Yann 25 mai 03h40)

Scope strict :
  - Pour chaque sté clean_all (audit v1-9-pre-publication-audit.json),
  - Lit l'état actuel : src/data/v2-pipeline/<t>.json + v2-pipeline-enrich/<t>.*.json
  - Liste TOUS les docs locaux dans sec-data/_manifests/<TICKER>.json
  - Scan keywords KPI sectoriels (banques/pharma/tech/etc) dans les sources
  - Identifie les KPI keywords présents ≥3 mentions MAIS absents des KPI extraits
  - Extrait via Cerebras Qwen-3 235B free (strict "null si non chiffré")
  - Écrit : src/data/v2-pipeline-enrich/<ticker>.kpis-v3.json (NOUVEAU SCOPE)

ANTI-DOUBLON STRICT :
  - N'écrit JAMAIS dans v2-pipeline/<t>.json (scope CONV-DATA)
  - N'écrit JAMAIS dans v2-pipeline-enrich/<t>.json (scope concurrent)
  - N'écrit QUE dans v2-pipeline-enrich/<t>.kpis-v3.json

Mode dry-run par défaut. Use --apply pour LLM extraction réelle.

USAGE:
  python3 scripts/verify-kpis-v3/scan-kpis.py --tickers NVDA,GOOGL  # dry-run
  python3 scripts/verify-kpis-v3/scan-kpis.py --batch 10            # top 10 dry-run
  python3 scripts/verify-kpis-v3/scan-kpis.py --batch 10 --apply    # top 10 with LLM
"""
import argparse
import gzip
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA = PROJECT_ROOT / "src" / "data"
V2P = DATA / "v2-pipeline"
V2E = DATA / "v2-pipeline-enrich"
SEC = PROJECT_ROOT / "sec-data"
MANIFESTS = SEC / "_manifests"
AUDIT = DATA / "v1-9-pre-publication-audit.json"
LOG_DIR = PROJECT_ROOT / ".conv-state"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG = LOG_DIR / "CONV-CONCEPTS-kpis-v3.log"

# KPI keywords by GICS sector / sub-industry (FR + EN, case-insensitive)
# Each entry: (KPI canonical name, list of regex patterns to match in source text)
SECTOR_KPI_KEYWORDS = {
    # ===== BANKS / FINANCIALS =====
    "banks": [
        ("Tier 1 Capital Ratio", [r"\btier\s*1\s*(capital\s*)?ratio\b", r"\bratio\s*tier\s*1\b", r"\bcet1\s*ratio\b"]),
        ("Net Interest Margin", [r"\bnet\s*interest\s*margin\b", r"\bmarge\s*d['']?intér[êe]ts?\b", r"\bNIM\b"]),
        ("Non-Performing Loan Ratio", [r"\bnon[-\s]performing\s*loans?\b", r"\bNPL\s*ratio\b", r"\bcr[ée]ances?\s*douteuses?\b"]),
        ("Cost-to-Income Ratio", [r"\bcost[-\s]to[-\s]income\b", r"\bcoefficient\s*d['']exploitation\b"]),
        ("Loan Book Total", [r"\btotal\s*loans?\b", r"\bencours\s*de\s*pr[êe]ts?\b", r"\bportefeuille\s*de\s*pr[êe]ts?\b"]),
        ("Deposits Total", [r"\btotal\s*deposits?\b", r"\bd[ée]p[ôo]ts?\s*totaux\b"]),
        ("Return on Tangible Equity", [r"\bRoTE\b", r"\breturn\s*on\s*tangible\s*equity\b"]),
        ("Liquidity Coverage Ratio", [r"\bLCR\b", r"\bliquidity\s*coverage\s*ratio\b"]),
    ],
    # ===== PHARMA / BIOTECH =====
    "pharma": [
        ("R&D as % of Revenue", [r"\bR\s*&\s*D\s*(expenses?)?\s*(as\s*[a-z]+\s*of|/)?\s*revenue\b", r"\brecherche\s*et\s*d[ée]veloppement\b.{0,40}%"]),
        ("Top Drug Sales", [r"\btop\s*(selling|product)\b", r"\bblockbuster\b", r"\bproduit\s*phare\b"]),
        ("Pipeline Phase 3", [r"\bphase\s*(III|3)\s*(trials?|clinical|study|studies)\b", r"\bpipeline\b"]),
        ("FDA Approvals", [r"\bFDA\s*approval\b", r"\bautorisations?\s*FDA\b"]),
        ("Gross Margin Pharma", [r"\bgross\s*margin\b.{0,30}(pharma|drug|product)"]),
        ("New Molecular Entities", [r"\bnew\s*molecular\s*entit", r"\bNME\b"]),
    ],
    # ===== TECH / SAAS =====
    "tech": [
        ("MAU (Monthly Active Users)", [r"\bMAU\b", r"\bmonthly\s*active\s*users?\b", r"\butilisateurs?\s*actifs?\s*mensuels?\b"]),
        ("DAU (Daily Active Users)", [r"\bDAU\b", r"\bdaily\s*active\s*users?\b", r"\butilisateurs?\s*actifs?\s*quotidiens?\b"]),
        ("ARR (Annual Recurring Revenue)", [r"\bARR\b", r"\bannual\s*recurring\s*revenue\b"]),
        ("NRR (Net Revenue Retention)", [r"\bNRR\b", r"\bnet\s*revenue\s*retention\b", r"\bnet\s*dollar\s*retention\b", r"\bNDR\b"]),
        ("Cloud Revenue", [r"\bcloud\s*revenue\b", r"\brevenus?\s*cloud\b"]),
        ("AI Revenue", [r"\bAI\s*revenue\b", r"\bartificial\s*intelligence\s*revenue\b", r"\brevenus?\s*IA\b"]),
        ("R&D as % of Revenue", [r"\bR\s*&\s*D\s*(expenses?)?\s*(as\s*[a-z]+\s*of|/)?\s*revenue\b"]),
        ("Subscribers", [r"\bsubscribers?\b", r"\babonn[ée]s?\b"]),
        ("ARPU", [r"\bARPU\b", r"\baverage\s*revenue\s*per\s*user\b"]),
    ],
    # ===== SEMICONDUCTORS =====
    "semis": [
        ("Data Center Revenue", [r"\bdata\s*center\s*revenue\b", r"\brevenus?\s*data\s*center\b"]),
        ("Gaming Revenue", [r"\bgaming\s*revenue\b", r"\brevenus?\s*gaming\b"]),
        ("Automotive Revenue", [r"\bautomotive\s*revenue\b", r"\brevenus?\s*automobile\b"]),
        ("R&D Spend", [r"\bR\s*&\s*D\s*(spend|expenses?|investments?)\b"]),
        ("Wafer Shipments", [r"\bwafer\s*shipments?\b"]),
        ("ASP (Average Selling Price)", [r"\bASP\b", r"\baverage\s*selling\s*price\b"]),
        ("Foundry Utilization", [r"\bfoundry\s*utili[zs]ation\b", r"\bcapacity\s*utili[zs]ation\b"]),
    ],
    # ===== RETAIL / CONSUMER =====
    "retail": [
        ("Comparable Sales Growth", [r"\bcomp(arable)?\s*(store\s*)?sales\b", r"\bsame[-\s]store\s*sales\b", r"\bventes?\s*comparables?\b"]),
        ("Number of Stores", [r"\bnumber\s*of\s*stores\b", r"\bstore\s*count\b", r"\bnombre\s*de\s*magasins?\b"]),
        ("Sales per Square Foot", [r"\bsales\s*per\s*square\s*foot\b"]),
        ("Inventory Turnover", [r"\binventory\s*turnover\b", r"\brotation\s*des\s*stocks?\b"]),
        ("E-commerce Penetration", [r"\be[-\s]commerce\s*(penetration|sales|revenue)\b"]),
    ],
    # ===== ENERGY / OIL & GAS =====
    "energy": [
        ("Production (boe/day)", [r"\bboe\s*/\s*day\b", r"\bbarrels?\s*per\s*day\b", r"\bproduction\b.{0,30}(barrels?|boe)"]),
        ("Reserves (boe)", [r"\b(proved|2P)\s*reserves?\b", r"\br[ée]serves?\s*prouv[ée]es?\b"]),
        ("Refining Capacity", [r"\brefining\s*capacity\b", r"\bcapacit[ée]\s*de\s*raffinage\b"]),
        ("LNG Volumes", [r"\bLNG\b", r"\bliquefied\s*natural\s*gas\b"]),
        ("Renewable Capacity (GW)", [r"\brenewable\s*capacity\b", r"\bcapacit[ée]\s*renouvelable\b"]),
    ],
    # ===== INDUSTRIALS / TRANSPORTATION =====
    "industrials": [
        ("Backlog", [r"\bbacklog\b", r"\bcarnet\s*de\s*commandes?\b"]),
        ("Book-to-Bill Ratio", [r"\bbook[-\s]to[-\s]bill\b"]),
        ("Free Cash Flow Conversion", [r"\bFCF\s*conversion\b", r"\bfree\s*cash\s*flow\s*conversion\b"]),
        ("Operating Margin Adjusted", [r"\badjusted\s*operating\s*margin\b", r"\bmarge\s*op[ée]rationnelle\s*ajust[ée]e?\b"]),
        ("On-Time Delivery", [r"\bon[-\s]time\s*delivery\b", r"\bOTD\b"]),
    ],
    # ===== INSURANCE =====
    "insurance": [
        ("Combined Ratio", [r"\bcombined\s*ratio\b", r"\bratio\s*combin[ée]\b"]),
        ("Loss Ratio", [r"\bloss\s*ratio\b", r"\bratio\s*de\s*sinistralit[ée]\b"]),
        ("Solvency II Ratio", [r"\bsolvency\s*II\s*ratio\b", r"\bratio\s*solvabilit[ée]\s*II\b"]),
        ("Gross Written Premiums", [r"\bgross\s*written\s*premiums?\b", r"\bGWP\b", r"\bprimes?\s*[ée]mises?\s*brutes?\b"]),
        ("Embedded Value", [r"\bembedded\s*value\b"]),
    ],
    # ===== HOSPITALITY / HOTELS / CASINO =====
    "hospitality": [
        ("RevPAR", [r"\bRevPAR\b", r"\brevenue\s*per\s*available\s*room\b"]),
        ("ADR (Average Daily Rate)", [r"\bADR\b.{0,40}room", r"\baverage\s*daily\s*rate\b"]),
        ("Hotel Occupancy", [r"\boccupancy\s*(rate|percentage|%)\b", r"\btaux\s*d['']occupation\b"]),
        ("EBITDAR", [r"\bEBITDAR\b"]),
        ("Gross Gaming Revenue", [r"\bgross\s*gaming\s*revenue\b", r"\bGGR\b"]),
        ("Hold Percentage", [r"\bhold\s*percentage\b", r"\bhold\s*%\b"]),
        ("Properties Count", [r"\bnumber\s*of\s*(properties|hotels|casinos)\b", r"\bnombre\s*d['']h[ôo]tels?\b"]),
    ],
    # ===== UTILITIES =====
    "utilities": [
        ("Regulated Asset Base", [r"\bregulated\s*asset\s*base\b", r"\bRAB\b"]),
        ("Allowed ROE", [r"\ballowed\s*ROE\b", r"\bROE\s*autoris[ée]\b"]),
        ("Customer Count", [r"\bnumber\s*of\s*customers\b", r"\bnombre\s*de\s*clients\b"]),
        ("Grid Losses", [r"\bgrid\s*losses?\b", r"\bpertes?\s*r[ée]seau\b"]),
        ("Renewable Generation %", [r"\brenewable\s*generation\b", r"\bg[ée]n[ée]ration\s*renouvelable\b"]),
        ("Capex Regulated", [r"\bregulated\s*capex\b", r"\bcapex\s*r[ée]gul[ée]\b"]),
    ],
    # ===== REIT / REAL ESTATE =====
    "reit": [
        ("FFO (Funds From Operations)", [r"\bFFO\b", r"\bfunds\s*from\s*operations\b"]),
        ("AFFO", [r"\bAFFO\b", r"\badjusted\s*funds\s*from\s*operations\b"]),
        ("NAV per Share", [r"\bNAV\s*per\s*share\b", r"\bnet\s*asset\s*value\s*per\s*share\b"]),
        ("Occupancy Rate", [r"\boccupancy\s*rate\b", r"\btaux\s*d['']occupation\b"]),
        ("Same-Store NOI", [r"\bsame[-\s]store\s*NOI\b", r"\bsame[-\s]property\s*NOI\b"]),
        ("Cap Rate", [r"\bcap\s*rate\b", r"\bcapitali[zs]ation\s*rate\b"]),
        ("LTV", [r"\bLTV\b", r"\bloan[-\s]to[-\s]value\b"]),
    ],
    # ===== MINING / METALS =====
    "mining": [
        ("Production Ounces", [r"\bounces?\s*produced\b", r"\bonces?\s*produites?\b"]),
        ("AISC (All-In Sustaining Cost)", [r"\bAISC\b", r"\ball[-\s]in\s*sustaining\s*cost\b"]),
        ("Reserves (oz/Mt)", [r"\b(proved|probable)\s*reserves?\b"]),
        ("Grade (g/t)", [r"\bgrade\b.{0,20}g/t\b", r"\bteneur\b"]),
    ],
    # ===== AEROSPACE / DEFENSE =====
    "aerospace": [
        ("Deliveries (Aircraft)", [r"\baircraft\s*deliveries?\b", r"\blivraisons?\s*d['']?avions?\b"]),
        ("Backlog Aircraft", [r"\baircraft\s*backlog\b", r"\bcarnet\s*de\s*commandes?\s*avions?\b"]),
        ("Defense Backlog", [r"\bdefense\s*backlog\b", r"\bcarnet\s*d[ée]fense\b"]),
        ("Book-to-Bill", [r"\bbook[-\s]to[-\s]bill\b"]),
    ],
    # ===== LUXURY / FASHION =====
    "luxury": [
        ("Same-Store Sales Growth", [r"\borganic\s*growth\b", r"\bsame[-\s]store\s*sales\b", r"\bcroissance\s*organique\b"]),
        ("Number of Boutiques", [r"\bnumber\s*of\s*boutiques\b", r"\bnombre\s*de\s*boutiques\b"]),
        ("Wholesale vs Retail Mix", [r"\bwholesale\b.{0,40}\bretail\b"]),
    ],
}

# Mapping (sub_sector heuristic → keyword bucket)
def detect_buckets(sector: str, subsector: str, tagline: str = "") -> list[str]:
    """Return list of relevant keyword buckets for this sté."""
    s = (sector or "").lower()
    ss = (subsector or "").lower()
    tg = (tagline or "").lower()
    text = f"{s} {ss} {tg}"
    buckets = []
    if any(k in text for k in ["bank", "banque", "financial", "credit"]):
        buckets.append("banks")
    if any(k in text for k in ["insurance", "assurance", "reinsurance"]):
        buckets.append("insurance")
    if any(k in text for k in ["pharma", "biotech", "drug", "medical device", "health care", "santé"]):
        buckets.append("pharma")
    if any(k in text for k in ["semiconductor", "semi-conducteur", "chip"]):
        buckets.append("semis")
    if any(k in text for k in ["software", "internet", "media", "tech", "cloud", "saas", "platform"]):
        buckets.append("tech")
    if any(k in text for k in ["retail", "consumer disc", "consumer staples", "store", "restaurant"]):
        buckets.append("retail")
    if any(k in text for k in ["energy", "oil", "gas", "petrol"]):
        buckets.append("energy")
    if any(k in text for k in ["industrial", "machinery", "transport", "manufacturer"]):
        buckets.append("industrials")
    if any(k in text for k in ["aerospace", "defense", "aircraft", "a[ée]ronautique", "d[ée]fense"]):
        buckets.append("aerospace")
    if any(k in text for k in ["hotel", "casino", "resort", "leisure", "h[ôo]tel", "loisir"]):
        buckets.append("hospitality")
    if any(k in text for k in ["utility", "utilities", "electric", "water", "grid"]):
        buckets.append("utilities")
    if any(k in text for k in ["reit", "real estate", "immobilier", "property"]):
        buckets.append("reit")
    if any(k in text for k in ["mining", "metals", "gold", "copper", "mine", "or"]):
        buckets.append("mining")
    if any(k in text for k in ["luxury", "luxe", "fashion", "apparel", "cosmetic"]):
        buckets.append("luxury")
    # Default fallback: scan all (slower but exhaustive)
    if not buckets:
        buckets = list(SECTOR_KPI_KEYWORDS.keys())
    return buckets


def load_audit_clean_all() -> list[dict]:
    with open(AUDIT) as f:
        data = json.load(f)
    return [a for a in data['audits'] if a.get('is_clean_all')]


def load_existing_kpis(ticker: str) -> tuple[dict, set[str]]:
    """Returns (company_meta, set of KPI shorts/names already extracted)."""
    tl = ticker.lower()
    # Try multiple file path variants
    base_candidates = [V2P / f"{ticker}.json", V2P / f"{tl}.json"]
    base = None
    base_path = None
    for c in base_candidates:
        if c.exists():
            try:
                base = json.loads(c.read_text())
                base_path = c
                break
            except Exception:
                pass
    if not base:
        return ({}, set())

    kpis_seen = set()
    for kpi in base.get('kpis', []) or []:
        if isinstance(kpi, dict):
            for k in ('short', 'name_en', 'name_fr'):
                v = kpi.get(k)
                if isinstance(v, str):
                    kpis_seen.add(v.strip().lower())
    for kpi in base.get('stories_kpis', []) or []:
        if isinstance(kpi, dict):
            for k in ('short', 'name_en', 'name_fr'):
                v = kpi.get(k)
                if isinstance(v, str):
                    kpis_seen.add(v.strip().lower())

    # Also check enrich files for additional KPIs
    enrich_candidates = list(V2E.glob(f"{ticker}*.json")) + list(V2E.glob(f"{tl}*.json"))
    for ep in enrich_candidates:
        try:
            ed = json.loads(ep.read_text())
        except Exception:
            continue
        for kpi in ed.get('kpis', []) or []:
            if isinstance(kpi, dict):
                for k in ('short', 'name_en', 'name_fr'):
                    v = kpi.get(k)
                    if isinstance(v, str):
                        kpis_seen.add(v.strip().lower())

    return (base, kpis_seen)


def load_manifest(ticker: str) -> dict | None:
    p = MANIFESTS / f"{ticker.upper()}.json"
    if p.exists():
        try:
            return json.loads(p.read_text())
        except Exception:
            return None
    return None


def read_source_text(rel_path: str, max_chars: int = 1_500_000) -> str:
    """Read a sec-data source file, decompress if .gz, return text (truncated)."""
    full = SEC / rel_path
    if not full.exists():
        return ""
    try:
        if str(full).endswith('.gz'):
            with gzip.open(full, 'rt', encoding='utf-8', errors='ignore') as f:
                txt = f.read(max_chars)
        else:
            with open(full, 'r', encoding='utf-8', errors='ignore') as f:
                txt = f.read(max_chars)
        # Strip HTML tags lightly
        txt = re.sub(r'<[^>]+>', ' ', txt)
        txt = re.sub(r'\s+', ' ', txt)
        return txt[:max_chars]
    except Exception:
        return ""


def scan_kpi_candidates(ticker: str, base: dict, manifest: dict | None, buckets: list[str]) -> list[dict]:
    """Scan manifest sources for KPI keywords absent from already-extracted KPIs."""
    if not manifest:
        return []
    existing_kpis = set()
    for kpi in base.get('kpis', []) or []:
        if isinstance(kpi, dict):
            for k in ('short', 'name_en', 'name_fr'):
                v = kpi.get(k)
                if isinstance(v, str):
                    existing_kpis.add(v.strip().lower())

    # Collect candidate KPI definitions per bucket
    candidates = []
    seen_kpi = set()
    # Helper to normalize KPI names for matching (strip parentheses, lowercase, drop punctuation)
    def _norm(s: str) -> str:
        s = re.sub(r'\([^)]*\)', '', s).lower()
        s = re.sub(r'[^a-z0-9]+', ' ', s).strip()
        return s
    existing_normalized = {_norm(e) for e in existing_kpis}
    # Also build a set of significant tokens from existing names
    existing_token_sets = []
    for e in existing_normalized:
        toks = [t for t in e.split() if len(t) > 2]
        if toks:
            existing_token_sets.append(set(toks))

    for bucket in buckets:
        for kpi_name, patterns in SECTOR_KPI_KEYWORDS.get(bucket, []):
            kpi_norm = _norm(kpi_name)
            kpi_tokens = set(t for t in kpi_norm.split() if len(t) > 2)
            # Skip if already extracted (exact normalized match OR token overlap ≥ 60%)
            if kpi_norm in existing_normalized:
                continue
            already = False
            for ets in existing_token_sets:
                if not kpi_tokens:
                    continue
                overlap = len(kpi_tokens & ets) / len(kpi_tokens)
                if overlap >= 0.6:
                    already = True
                    break
            if already:
                continue
            if kpi_name in seen_kpi:
                continue
            candidates.append({'name': kpi_name, 'patterns': patterns, 'bucket': bucket, 'mentions': 0, 'sources_hit': []})
            seen_kpi.add(kpi_name)

    if not candidates:
        return []

    # Read sources from manifest (annual_report + current_report + half_year + ad_hoc)
    present = manifest.get('present', {}) or {}
    source_paths = []
    for kind in ('annual_report', 'half_year_report', 'interim_report', 'current_report', 'ad_hoc', 'ir_presentations', 'esg_report'):
        block = present.get(kind, {})
        if not isinstance(block, dict) or not block.get('present'):
            continue
        # Use latest_path and any other paths fields
        for path_field in ('latest_path',):
            p = block.get(path_field)
            if isinstance(p, str) and p:
                source_paths.append(p)
        for p in block.get('paths', []) or []:
            if isinstance(p, str) and p:
                source_paths.append(p)
    source_paths = list(dict.fromkeys(source_paths))[:5]  # cap 5 docs

    if not source_paths:
        return []

    # Scan each source for keyword mentions
    for rel in source_paths:
        text = read_source_text(rel, max_chars=1_500_000)
        if not text:
            continue
        text_lower = text.lower()
        for cand in candidates:
            for pat in cand['patterns']:
                try:
                    matches = re.findall(pat, text_lower, re.IGNORECASE)
                except re.error:
                    continue
                if matches:
                    cand['mentions'] += len(matches)
                    if rel not in cand['sources_hit']:
                        cand['sources_hit'].append(rel)

    # Keep only candidates with ≥3 mentions across sources (anti faux-positif)
    promising = [c for c in candidates if c['mentions'] >= 3]
    return promising


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--tickers', help='Comma-separated tickers')
    parser.add_argument('--batch', type=int, help='Top N from market_cap clean_all')
    parser.add_argument('--apply', action='store_true', help='Run LLM extraction (not just scan)')
    parser.add_argument('--out-dir', default=str(V2E))
    args = parser.parse_args()

    # Load tickers
    if args.tickers:
        targets = [t.strip().upper() for t in args.tickers.split(',') if t.strip()]
    elif args.batch:
        clean = load_audit_clean_all()
        clean_sorted = sorted(clean, key=lambda a: -(a.get('market_cap_usd') or 0))
        targets = [a['ticker'] for a in clean_sorted[:args.batch]]
    else:
        print('Usage: --tickers T1,T2 OR --batch N', file=sys.stderr)
        sys.exit(2)

    print(f'[scan-kpis-v3] targets: {len(targets)} stés')
    report = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'total_targets': len(targets),
        'mode': 'apply' if args.apply else 'dry-run',
        'results': [],
    }

    for ticker in targets:
        base, kpis_seen = load_existing_kpis(ticker)
        if not base:
            print(f'  {ticker}: SKIP (no base file)')
            report['results'].append({'ticker': ticker, 'status': 'skip_no_base'})
            continue

        sector = base.get('sector', '')
        subsector = base.get('subsector', '')
        tagline = base.get('tagline', '')
        buckets = detect_buckets(sector, subsector, tagline)

        manifest = load_manifest(ticker)
        if not manifest:
            print(f'  {ticker}: SKIP (no manifest)')
            report['results'].append({'ticker': ticker, 'status': 'skip_no_manifest'})
            continue

        candidates = scan_kpi_candidates(ticker, base, manifest, buckets)
        cand_summary = [{'name': c['name'], 'mentions': c['mentions'], 'sources': c['sources_hit'][:3]} for c in candidates]
        print(f'  {ticker}: sector={sector} buckets={buckets} kpis_existing={len(kpis_seen)} candidates={len(candidates)}')
        for c in candidates[:5]:
            print(f'    - {c["name"]} ({c["mentions"]} mentions across {len(c["sources_hit"])} src)')

        report['results'].append({
            'ticker': ticker,
            'status': 'scanned',
            'sector': sector,
            'subsector': subsector,
            'buckets': buckets,
            'kpis_existing': len(kpis_seen),
            'candidates': cand_summary,
        })

    out_path = LOG_DIR / 'CONV-CONCEPTS-kpis-v3-scan.json'
    with open(out_path, 'w') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f'\n[scan-kpis-v3] report → {out_path}')

    # Summary
    total_candidates = sum(len(r.get('candidates', [])) for r in report['results'])
    with_cands = sum(1 for r in report['results'] if r.get('candidates'))
    print(f'[summary] {with_cands}/{len(targets)} stés ont ≥1 KPI candidat (total {total_candidates} candidats)')


if __name__ == '__main__':
    main()
