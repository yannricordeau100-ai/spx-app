#!/usr/bin/env python3
"""Iterative refinement (Idée 3) : extract → critique Sonnet → re-extract gaps.

Pour chaque ticker top 50 USA :
1. Lit dataset existant + sub-industry template + 10-K full text
2. Sonnet identifie KPIs whaou MANQUANTS (Wafer Volume pour NVDA, FSD pour TSLA, etc.)
3. Sonnet RE-EXTRACT les KPIs gaps avec valeurs réelles depuis 10-K
4. Merge dans dataset existant
"""
from __future__ import annotations
import argparse, asyncio, json, os, re, sys, time
from pathlib import Path

ROOT = Path("/Users/yann/spx-app")
sys.path.insert(0, str(ROOT / "scripts"))
import importlib.util
spec = importlib.util.spec_from_file_location("p", ROOT / "scripts/pipeline-llm.py")
pl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pl)
pl.load_env()

OUT_DIR = ROOT / "src/data/v2-pipeline"

# Charge sub-industry templates
sub_t = json.loads((ROOT / "src/lib/kpi-templates-by-subindustry.json").read_text())
gics_lookup = json.loads((ROOT / "src/lib/gics-code-lookup.json").read_text())

# Anthropic Sonnet pricing
PRICE_IN = 3.0  # $/M
PRICE_OUT = 15.0
spend_total = 0.0


async def call_sonnet(system: str, user: str) -> tuple[str, dict]:
    import aiohttp
    connector = aiohttp.TCPConnector(ssl=False)
    headers = {
        "x-api-key": os.environ["ANTHROPIC_API_KEY"],
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    body = {
        "model": "claude-sonnet-4-5-20250929",
        "max_tokens": 8000,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    async with aiohttp.ClientSession(connector=connector) as s:
        async with s.post("https://api.anthropic.com/v1/messages", headers=headers, json=body, timeout=aiohttp.ClientTimeout(total=300)) as r:
            data = await r.json()
            if "content" not in data:
                raise RuntimeError(f"Sonnet error: {data}")
            text = data["content"][0]["text"]
            usage = data.get("usage", {})
            in_t = usage.get("input_tokens", 0)
            out_t = usage.get("output_tokens", 0)
            cost = (in_t * PRICE_IN + out_t * PRICE_OUT) / 1_000_000
            return text, {"in": in_t, "out": out_t, "cost": cost}


# SUBSECTOR_GUESS embedded (was in pipeline-llm.py but seems removed by other conv)
SUBSECTOR_GUESS = {
    "AAPL": "Technology Hardware, Storage & Peripherals",
    "MSFT": "Systems Software", "ORCL": "Systems Software",
    "NVDA": "Semiconductors", "AVGO": "Semiconductors", "AMD": "Semiconductors",
    "INTC": "Semiconductors", "QCOM": "Semiconductors", "MU": "Semiconductors",
    "ARM": "Semiconductors", "MCHP": "Semiconductors",
    "META": "Interactive Media & Services", "GOOGL": "Interactive Media & Services",
    "GOOG": "Interactive Media & Services", "PINS": "Interactive Media & Services",
    "RDDT": "Interactive Media & Services", "SNAP": "Interactive Media & Services",
    "ADBE": "Application Software", "CRM": "Application Software", "INTU": "Application Software",
    "NOW": "Application Software", "SNOW": "Application Software", "PLTR": "Application Software",
    "DDOG": "Application Software", "PANW": "Application Software", "CRWD": "Application Software",
    "WDAY": "Application Software", "SHOP": "Application Software",
    "NFLX": "Movies & Entertainment", "DIS": "Movies & Entertainment",
    "TMUS": "Wireless Telecommunication Services", "VZ": "Integrated Telecommunication Services",
    "T": "Integrated Telecommunication Services",
    "AMZN": "Broadline Retail",
    "JPM": "Diversified Banks", "BAC": "Diversified Banks", "WFC": "Diversified Banks", "C": "Diversified Banks",
    "MS": "Investment Banking & Brokerage", "GS": "Investment Banking & Brokerage", "SCHW": "Investment Banking & Brokerage",
    "BX": "Asset Management & Custody Banks", "BLK": "Asset Management & Custody Banks", "KKR": "Asset Management & Custody Banks",
    "BRK-B": "Multi-Sector Holdings",
    "V": "Transaction & Payment Processing Services", "MA": "Transaction & Payment Processing Services",
    "PYPL": "Transaction & Payment Processing Services",
    "PGR": "Property & Casualty Insurance",
    "MMC": "Insurance Brokers", "AON": "Insurance Brokers",
    "LLY": "Pharmaceuticals", "PFE": "Pharmaceuticals", "MRK": "Pharmaceuticals",
    "ABBV": "Pharmaceuticals", "BMY": "Pharmaceuticals", "JNJ": "Pharmaceuticals",
    "MRNA": "Biotechnology", "VRTX": "Biotechnology", "REGN": "Biotechnology",
    "GILD": "Biotechnology", "AMGN": "Biotechnology",
    "MDT": "Health Care Equipment", "ABT": "Health Care Equipment",
    "TMO": "Life Sciences Tools & Services", "DHR": "Life Sciences Tools & Services",
    "ISRG": "Health Care Equipment", "SYK": "Health Care Equipment",
    "UNH": "Managed Health Care", "ELV": "Managed Health Care",
    "TSLA": "Automobile Manufacturers", "F": "Automobile Manufacturers",
    "GM": "Automobile Manufacturers", "RIVN": "Automobile Manufacturers",
    "LCID": "Automobile Manufacturers", "NIO": "Automobile Manufacturers",
    "LI": "Automobile Manufacturers",
    "NKE": "Footwear",
    "MCD": "Restaurants", "SBUX": "Restaurants",
    "HD": "Home Improvement Retail", "LOW": "Home Improvement Retail",
    "ABNB": "Hotels, Resorts & Cruise Lines", "MAR": "Hotels, Resorts & Cruise Lines",
    "WMT": "Consumer Staples Merchandise Retail", "COST": "Consumer Staples Merchandise Retail",
    "PG": "Personal Care Products",
    "KO": "Soft Drinks & Non-alcoholic Beverages", "PEP": "Soft Drinks & Non-alcoholic Beverages",
    "PM": "Tobacco", "MO": "Tobacco",
    "CAT": "Construction Machinery & Heavy Transportation Equipment",
    "BA": "Aerospace & Defense", "LMT": "Aerospace & Defense", "RTX": "Aerospace & Defense",
    "GE": "Industrial Conglomerates", "NOC": "Aerospace & Defense", "GD": "Aerospace & Defense",
    "UPS": "Air Freight & Logistics", "FDX": "Air Freight & Logistics",
    "DAL": "Passenger Airlines", "UAL": "Passenger Airlines",
    "XOM": "Integrated Oil & Gas", "CVX": "Integrated Oil & Gas",
    "COP": "Oil & Gas Exploration & Production",
    "PLD": "Industrial REITs", "AMT": "Specialized REITs",
    "NEE": "Electric Utilities", "DUK": "Electric Utilities", "SO": "Electric Utilities",
    "GME": "Apparel Retail", "AMC": "Movies & Entertainment",
    "MSTR": "Application Software", "COIN": "Capital Markets", "HOOD": "Investment Banking & Brokerage",
    "SMCI": "Technology Hardware, Storage & Peripherals",
}


FUZZY_OVERRIDES = {
    # Subsectors LLM-generated additionnels (top 308 EU + UK)
    "automotive manufacturing": "automobile manufacturers",
    "automotive and autonomous driving": "automobile manufacturers",
    "automotive - tires & related equipment": "tires & rubber",
    "building materials & fixtures": "building products",
    "oil & gas integrated": "integrated oil & gas",
    "household & personal care": "household products",
    "residential development": "homebuilding",
    "homebuilders": "homebuilding",
    "information services": "research & consulting services",
    "apparel & accessories": "apparel, accessories & luxury goods",
    "medical devices & wound care": "health care equipment",
    "luxury goods": "apparel, accessories & luxury goods",
    "trade association": "research & consulting services",
    "industry representation": "research & consulting services",
    "industry association": "research & consulting services",
    "industry representative organization": "research & consulting services",
    "association professionnelle": "research & consulting services",
    "inland waterway transport advocacy": "marine ports & services",
    "inland waterways & shipping": "marine ports & services",
    "maritime & inland waterway": "marine ports & services",
    "transportation infrastructure": "highways & railtracks",
    # Existants ci-dessous
    # Banks
    "banks": "diversified banks", "banking": "diversified banks", "banques": "diversified banks",
    "banques et services financiers": "diversified banks", "regional banks": "regional banks",
    # Insurance
    "insurance": "multi-line insurance", "insurances": "multi-line insurance",
    "assurance": "multi-line insurance",
    # Software
    "software": "application software", "software - application": "application software",
    "software - infrastructure": "systems software", "saas": "application software",
    "logiciels": "application software",
    # Semi
    "semi-conducteurs": "semiconductors", "semiconducteurs": "semiconductors",
    # REITs
    "real estate investment trusts (reits)": "diversified reits",
    "real estate investment trust (reit)": "diversified reits",
    "reit": "diversified reits", "reits": "diversified reits",
    # IT services
    "it services": "it consulting & other services",
    "services informatiques": "it consulting & other services",
    # Asset mgmt
    "asset management": "asset management & custody banks",
    "gestion d'actifs": "asset management & custody banks",
    # Fintech
    "financial technology": "transaction & payment processing services",
    "fintech": "transaction & payment processing services",
    # Medical
    "medical devices": "health care equipment",
    "healthcare technology": "health care technology",
    "biopharmaceutical": "biotechnology", "biopharmaceuticals": "biotechnology",
    "biopharma": "biotechnology",
    # Retail
    "specialty retail": "specialty stores", "retail": "broadline retail",
    # Telco
    "telecommunications services": "integrated telecommunication services",
    "telecom": "integrated telecommunication services",
    # Industrial
    "industrial machinery & equipment": "industrial machinery & supplies & components",
    "machinery & equipment": "industrial machinery & supplies & components",
    "industrial technology": "industrial machinery & supplies & components",
    # Misc
    "airlines": "passenger airlines",
    "beverages": "soft drinks & non-alcoholic beverages",
    "packaging": "metal, glass & plastic containers",
    "education technology": "education services",
    "healthcare services": "health care services",
    "financial services": "diversified financial services",
    "inland waterway transport": "marine transportation",
}


def get_subindustry_template(ticker: str, dataset: dict | None = None) -> dict | None:
    # 1. Préfère SUBSECTOR_GUESS hardcodé (overrides curatés)
    sub = SUBSECTOR_GUESS.get(ticker.upper())
    # 2. Fallback : lit le subsector depuis le dataset lui-même
    if not sub and dataset:
        sub = dataset.get("subsector") or dataset.get("subSector")
    if not sub:
        return None
    sub_norm = sub.lower().strip()
    name_to_code = gics_lookup.get("NAME_TO_CODE", {})
    code = name_to_code.get(sub_norm)
    # 3. Fuzzy override mapping
    if not code:
        mapped = FUZZY_OVERRIDES.get(sub_norm)
        if mapped:
            code = name_to_code.get(mapped)
    # 4. Substring match (fallback)
    if not code:
        for key, c in name_to_code.items():
            if sub_norm in key or key in sub_norm:
                code = c
                break
    if code:
        return sub_t.get("SUBINDUSTRY_TEMPLATES", {}).get(code)
    return None


async def refine_ticker(ticker: str, log) -> dict | None:
    global spend_total
    json_path = OUT_DIR / f"{ticker.lower()}.json"
    if not json_path.exists():
        log(f"[SKIP] {ticker}: no dataset")
        return None
    dataset = json.loads(json_path.read_text())

    sub_template = get_subindustry_template(ticker, dataset)
    if not sub_template:
        log(f"[SKIP] {ticker}: no sub-industry template")
        return None

    # Détecte cat depuis ticker : "." dans tk → cat 3 EU ; sinon cat 1 USA.
    # FPI ADR pas distinguable par ticker seul, fallback try cat 1 puis cat 2.
    cats_to_try = [3, 1, 2] if "." in ticker else [1, 2, 3]
    annual = ""
    for c in cats_to_try:
        try:
            docs = pl.gather_docs(ticker, c)
            annual = docs.get("annual_text", "")[:30000]
            if len(annual) >= 5000:
                break
        except Exception:
            continue
    if not annual or len(annual) < 5000:
        log(f"[SKIP] {ticker}: no source")
        return None

    existing_kpis = [k.get("short", "?") for k in dataset.get("kpis", [])]
    sub_heros = [{"short": h.get("short"), "name_fr": h.get("name_fr"), "explanation": h.get("explanation"), "wow_or_generic": h.get("wow_or_generic")} for h in sub_template.get("hero_candidates", [])]

    # ÉTAPE 1 : critique Sonnet identifie gaps
    system_critique = f"""Tu es analyste financier expert. Tu lis :
1. Un dataset existant avec ses KPIs déjà extraits
2. Un template KPI WOW typiques de la sous-industrie GICS de cette sté
3. Le texte 10-K source

Ta mission : identifier les KPI WOW listés dans le template qui sont MENTIONNÉS dans le 10-K mais ABSENTS du dataset. Réponds UNIQUEMENT en JSON :
{{
  "gaps": [
    {{"short": "...", "reason_in_10k": "phrase exacte du 10-K qui mentionne ce KPI", "value": "...", "unit": "...", "yoy": "..."}}
  ]
}}

Règle : SI un KPI whaou n'est PAS mentionné dans le 10-K, NE PAS l'inclure (pas inventé). 0 invention. Sois strict."""

    user_critique = f"""TICKER : {ticker}
SOUS-INDUSTRIE : {sub_template.get('name')} ({sub_template.get('parent_industry_group','?')})

═══ KPIS DÉJÀ EXTRAITS (à compléter, pas remplacer) ═══
{json.dumps(existing_kpis, ensure_ascii=False)}

═══ TEMPLATE WOW SOUS-INDUSTRIE (à chercher dans le 10-K) ═══
{json.dumps(sub_heros, ensure_ascii=False, indent=2)[:3000]}

═══ EXTRAIT 10-K ═══
{annual}"""

    log(f"   {ticker} : Sonnet critique starting...")
    t0 = time.time()
    try:
        resp, usage = await call_sonnet(system_critique, user_critique)
        spend_total += usage["cost"]
    except Exception as e:
        log(f"[ERR] {ticker}: Sonnet fail: {e}")
        return None

    dt = time.time() - t0
    # Parse gaps
    m = re.search(r'\{[\s\S]*\}', resp)
    if not m:
        log(f"[ERR] {ticker}: no JSON in response")
        return None
    try:
        gaps_data = json.loads(m.group(0))
    except Exception as e:
        log(f"[ERR] {ticker}: parse fail: {e}")
        return None

    gaps = gaps_data.get("gaps", [])
    if not gaps:
        log(f"   {ticker} : no gaps detected ({dt:.1f}s, ${usage['cost']:.4f})")
        return dataset

    # Étape 2 : merge gaps dans dataset existant
    new_kpis = []
    for g in gaps:
        new_kpi = {
            "short": g.get("short"),
            "name_fr": g.get("short"),  # placeholder, peut améliorer
            "value": g.get("value"),
            "unit": g.get("unit", ""),
            "yoy": g.get("yoy", ""),
            "type": "Profit" if "income" in (g.get("short", "") or "").lower() else "Revenue",
            "is_wow": True,
            "_added_by_iterative_refinement": g.get("reason_in_10k", "")[:200],
        }
        new_kpis.append(new_kpi)

    dataset["kpis"] = (dataset.get("kpis", []) or []) + new_kpis
    dataset["_iterative_refinement"] = {
        "date": time.strftime("%Y-%m-%d %H:%M"),
        "kpis_added": len(new_kpis),
        "model": "claude-sonnet-4-5",
        "cost_usd": round(usage["cost"], 4),
    }
    json_path.write_text(json.dumps(dataset, ensure_ascii=False, indent=2))
    log(f"   ✅ {ticker} : +{len(new_kpis)} KPIs whaou (cost ${usage['cost']:.4f}, {dt:.1f}s)")
    return dataset


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ticker-file", help="Fichier 1 ticker par ligne")
    parser.add_argument("--budget", type=float, default=15.0)
    args = parser.parse_args()

    tickers = [l.strip().upper() for l in open(args.ticker_file).read().splitlines() if l.strip()]
    print(f"Iterative refinement on {len(tickers)} tickers, budget ${args.budget}")

    LOG = ROOT / "sec-data/_meta/iterative-refinement.log"
    log_fh = open(LOG, "a")
    def log(msg):
        line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
        print(line, flush=True); log_fh.write(line + "\n"); log_fh.flush()

    log(f"Démarrage iterative refinement, budget ${args.budget}")
    for ticker in tickers:
        if spend_total >= args.budget:
            log(f"Budget atteint ${spend_total:.2f}, stop")
            break
        await refine_ticker(ticker, log)
    log(f"\n=== TOTAL spent: ${spend_total:.4f} ===")
    log_fh.close()


if __name__ == "__main__":
    asyncio.run(main())
