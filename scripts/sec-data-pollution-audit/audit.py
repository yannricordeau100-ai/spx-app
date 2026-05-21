#!/usr/bin/env python3
"""Audit cross-pollution sec-data EU/UK — sub-agent #110
Read-only audit: sample EU/UK tickers, check if annual-text content matches ticker's expected country.
"""
import os
import re
import json
import random
from pathlib import Path

SEC_ROOT = Path("/Users/yann/spx-app/sec-data/cat3-european")
OUTPUT_JSON = Path("/Users/yann/spx-app/src/data/v1-9-sec-data-pollution-audit.json")
UNIVERSE_JSON = Path("/Users/yann/spx-app/src/data/v1-9-universe.json")


def load_universe():
    with open(UNIVERSE_JSON) as f:
        u = json.load(f)
    return {t["ticker"]: t.get("name", "") for t in u}


UNIVERSE_NAMES = load_universe()


def name_tokens(name: str):
    """Extract significant tokens from a company name for fuzzy match.
    e.g. "AB InBev" -> ["InBev", "Anheuser", "Busch"]; "National Grid" -> ["National", "Grid"]
    """
    if not name:
        return []
    # Remove suffix noise
    name = re.sub(r"\b(AG|SA|S\.A\.|PLC|plc|Plc|Ltd|Limited|N\.V\.|NV|SE|S\.p\.A\.|SpA|S\.A|S\.E\.|AB|ASA|Holding|Holdings|Group|Company|Co\.|Inc\.?|Aktiengesellschaft|Corporation)\b", "", name)
    toks = re.findall(r"[A-Za-zÀ-ÿ]{4,}", name)
    # Filter generic
    blacklist = {"International", "Consolidated", "Airlines", "Group", "Company", "Banco",
                 "Bank", "Holding", "Holdings", "Industries", "Industrial"}
    return [t for t in toks if t not in blacklist]

# Map exchange suffix to expected country/currency/exchange names
SUFFIX_MAP = {
    "PA": {"country": "France",       "ccy": "EUR", "city_hints": ["Paris", "Courbevoie", "Suresnes", "La Défense", "Boulogne"], "exchange_hints": ["Euronext Paris", "Paris", "Bourse de Paris"], "isin_prefix": "FR"},
    "DE": {"country": "Germany",      "ccy": "EUR", "city_hints": ["Frankfurt", "München", "Munich", "Berlin", "Hamburg", "Stuttgart", "Düsseldorf", "Köln", "Cologne", "Bonn", "Leverkusen", "Walldorf", "Wolfsburg", "Essen", "Bayreuth", "Erlangen", "Heidelberg"], "exchange_hints": ["Frankfurt", "Xetra", "Deutsche Börse", "DAX"], "isin_prefix": "DE"},
    "MI": {"country": "Italy",        "ccy": "EUR", "city_hints": ["Milano", "Milan", "Roma", "Rome", "Torino", "Turin", "Bologna"], "exchange_hints": ["Borsa Italiana", "Milano", "FTSE MIB"], "isin_prefix": "IT"},
    "L":  {"country": "United Kingdom","ccy": "GBP", "city_hints": ["London", "Manchester", "Edinburgh", "Birmingham", "Leeds", "Glasgow"], "exchange_hints": ["London Stock Exchange", "LSE", "FTSE"], "isin_prefix": "GB"},
    "SW": {"country": "Switzerland",  "ccy": "CHF", "city_hints": ["Zürich", "Zurich", "Basel", "Genève", "Geneva", "Bern", "Lausanne", "Vevey"], "exchange_hints": ["SIX Swiss", "SIX", "Swiss Exchange"], "isin_prefix": "CH"},
    "AS": {"country": "Netherlands",  "ccy": "EUR", "city_hints": ["Amsterdam", "Rotterdam", "Den Haag", "The Hague", "Eindhoven", "Utrecht"], "exchange_hints": ["Euronext Amsterdam", "AEX"], "isin_prefix": "NL"},
    "BR": {"country": "Belgium",      "ccy": "EUR", "city_hints": ["Brussels", "Bruxelles", "Antwerp", "Anvers", "Leuven", "Liège"], "exchange_hints": ["Euronext Brussels", "BEL 20"], "isin_prefix": "BE"},
    "LS": {"country": "Portugal",     "ccy": "EUR", "city_hints": ["Lisbon", "Lisboa", "Porto", "Oporto"], "exchange_hints": ["Euronext Lisbon", "PSI"], "isin_prefix": "PT"},
    "MC": {"country": "Spain",        "ccy": "EUR", "city_hints": ["Madrid", "Barcelona", "Bilbao", "Valencia"], "exchange_hints": ["BME", "IBEX", "Bolsa de Madrid"], "isin_prefix": "ES"},
    "ST": {"country": "Sweden",       "ccy": "SEK", "city_hints": ["Stockholm", "Göteborg", "Gothenburg", "Malmö"], "exchange_hints": ["Nasdaq Stockholm", "OMX"], "isin_prefix": "SE"},
    "HE": {"country": "Finland",      "ccy": "EUR", "city_hints": ["Helsinki", "Espoo", "Tampere"], "exchange_hints": ["Nasdaq Helsinki", "OMX Helsinki"], "isin_prefix": "FI"},
    "OL": {"country": "Norway",       "ccy": "NOK", "city_hints": ["Oslo", "Bergen", "Stavanger", "Trondheim"], "exchange_hints": ["Oslo Børs", "Oslo Stock Exchange"], "isin_prefix": "NO"},
    "CO": {"country": "Denmark",      "ccy": "DKK", "city_hints": ["Copenhagen", "København", "Aarhus"], "exchange_hints": ["Nasdaq Copenhagen", "OMX Copenhagen"], "isin_prefix": "DK"},
    "VI": {"country": "Austria",      "ccy": "EUR", "city_hints": ["Wien", "Vienna", "Graz", "Linz", "Salzburg"], "exchange_hints": ["Wiener Börse", "ATX"], "isin_prefix": "AT"},
    "IR": {"country": "Ireland",      "ccy": "EUR", "city_hints": ["Dublin", "Cork"], "exchange_hints": ["Euronext Dublin", "ISEQ"], "isin_prefix": "IE"},
}

# Pays "polluants" suspects (filiales géographiques typiques)
POLLUTION_FLAGS = [
    "India", "Indian", "INDIA",
    "Brasil", "Brazil", "Brazilian",
    "China", "Chinese", "Chinese Taipei",
    "México", "Mexico", "Mexican",
    "Vietnam", "Vietnamese",
    "Argentina", "Argentine",
    "Türkiye", "Turkey", "Turkish",
    "Indonesia", "Indonesian",
    "Thailand", "Thai",
    "Philippines", "Filipino",
    "South Africa",
    "Nigeria",
    "Kenya",
]

# Markers of foreign-subsidiary filing (when present prominently, signals scrape grabbed wrong entity)
FOREIGN_SUB_MARKERS = {
    "India": ["Mumbai", "Bangalore", "Bengaluru", "Chennai", "Kolkata", "Delhi", "Pune",
              "Hyderabad", "Gurgaon", "Worli", "Maharashtra", "Karnataka", "Tamil Nadu",
              "₹", "Rupee", "Rupees", "Lakh", "Crore", "INR"],
    "Brazil": ["São Paulo", "Sao Paulo", "Rio de Janeiro", "BRL", "Real Brasileiro", "R$"],
    "China": ["Shanghai", "Beijing", "Shenzhen", "RMB", "Renminbi", "Yuan"],
    "Mexico": ["Ciudad de México", "Mexico City", "Guadalajara", "Monterrey", "MXN", "Peso"],
    "Turkey": ["Istanbul", "Ankara", "TRY", "Lira"],
}

TRUNCATED_THRESHOLD = 30_000  # < 30k chars considered truncated
HEAD_CHARS = 8000  # chars to read from head for analysis


def get_latest_annual(ticker_dir: Path):
    annual_text = ticker_dir / "annual-text"
    if not annual_text.is_dir():
        return None
    files = sorted([f for f in annual_text.glob("*.txt")], key=lambda f: f.name)
    if not files:
        return None
    # latest year file (max year)
    def year_key(p):
        m = re.match(r"(\d{4})", p.stem)
        return int(m.group(1)) if m else 0
    files.sort(key=year_key, reverse=True)
    return files[0]


def classify_ticker(ticker: str, ticker_dir: Path):
    if "." not in ticker:
        return None
    suffix = ticker.split(".")[-1]
    if suffix not in SUFFIX_MAP:
        return None
    expected = SUFFIX_MAP[suffix]

    annual_file = get_latest_annual(ticker_dir)
    if annual_file is None:
        return {"ticker": ticker, "suffix": suffix, "expected_country": expected["country"],
                "category": "EMPTY", "evidence": "no annual-text or empty dir", "size": 0,
                "latest_file": None}

    size = annual_file.stat().st_size
    if size == 0:
        return {"ticker": ticker, "suffix": suffix, "expected_country": expected["country"],
                "category": "EMPTY", "evidence": "file 0 bytes", "size": 0,
                "latest_file": annual_file.name}

    try:
        with open(annual_file, "r", errors="ignore") as f:
            content = f.read(HEAD_CHARS)
            f.seek(0)
            full_for_count = f.read()  # full read for grep counts
    except Exception as e:
        return {"ticker": ticker, "suffix": suffix, "expected_country": expected["country"],
                "category": "ERROR", "evidence": f"read error {e}", "size": size,
                "latest_file": annual_file.name}

    head_snippet = content[:400].replace("\n", " ")

    if size < TRUNCATED_THRESHOLD:
        # short — flag truncated
        return {"ticker": ticker, "suffix": suffix, "expected_country": expected["country"],
                "category": "TRUNCATED", "evidence": f"size={size}b head={head_snippet!r}",
                "size": size, "latest_file": annual_file.name}

    # First 2k chars — issuer name typically appears here
    issuer_zone = content[:2000]

    # WRONG_ISSUER detection : expected name tokens absent from issuer zone
    expected_name = UNIVERSE_NAMES.get(ticker, "")
    name_toks = name_tokens(expected_name)
    name_match_count = 0
    name_match_in_full = 0
    if name_toks:
        for tok in name_toks:
            if tok in issuer_zone:
                name_match_count += 1
            if tok in full_for_count:
                name_match_in_full += 1

    # Check if a pollution flag appears in issuer zone (BAD = subsidiary report)
    issuer_pollution = [flag for flag in POLLUTION_FLAGS if flag in issuer_zone]

    # Count expected vs pollution in full content
    country_count = full_for_count.count(expected["country"])
    city_count = sum(full_for_count.count(c) for c in expected["city_hints"])
    exch_count = sum(full_for_count.count(e) for e in expected["exchange_hints"])
    isin_count = len(re.findall(r"\b" + expected["isin_prefix"] + r"[0-9A-Z]{10}\b", full_for_count))

    # Pollution score: count of pollution flags appearing >5 times in full
    pollution_counts = {flag: full_for_count.count(flag) for flag in POLLUTION_FLAGS if flag in full_for_count}
    # Strong pollution = flag appears more than 10x AND no/weak expected signals
    strong_pollution = {f: c for f, c in pollution_counts.items() if c > 10}

    expected_total = country_count + city_count + exch_count + isin_count

    # Check for foreign-subsidiary markers in issuer zone (first 2k chars) + early body (8k)
    # Strong signal: subsidiary city + foreign currency early in doc
    foreign_sub_hits = {}
    for region, markers in FOREIGN_SUB_MARKERS.items():
        head_hits = [m for m in markers if m in content[:8000]]
        if len(head_hits) >= 2:
            foreign_sub_hits[region] = head_hits

    # Category logic v2
    # -1) FOREIGN SUBSIDIARY DETECTION : strong subsidiary markers in head
    if foreign_sub_hits and expected["country"] not in foreign_sub_hits:
        # The expected country shouldn't be the foreign region. Strong mismatch.
        # Check expected-country mention not dominating early
        return {"ticker": ticker, "suffix": suffix, "expected_country": expected["country"],
                "expected_name": expected_name,
                "category": "MISMATCH_COUNTRY",
                "evidence": f"foreign-subsidiary markers in head: {foreign_sub_hits} head={head_snippet!r}",
                "size": size, "latest_file": annual_file.name,
                "foreign_sub_hits": foreign_sub_hits,
                "name_match_issuer_zone": name_match_count,
                "name_match_in_full": name_match_in_full}

    # 0) WRONG_ISSUER : we have expected name tokens, but NONE appear anywhere in full doc
    if name_toks and name_match_in_full == 0:
        return {"ticker": ticker, "suffix": suffix, "expected_country": expected["country"],
                "expected_name": expected_name,
                "category": "WRONG_ISSUER",
                "evidence": f"none of name tokens {name_toks} found in full doc; head={head_snippet!r}",
                "size": size, "latest_file": annual_file.name,
                "name_match_in_full": 0,
                "name_match_issuer_zone": name_match_count}

    # 1) issuer_zone contains pollution flag (e.g. "INDIA LIMITED" on first page) — clear MISMATCH_COUNTRY
    if issuer_pollution:
        return {"ticker": ticker, "suffix": suffix, "expected_country": expected["country"],
                "category": "MISMATCH_COUNTRY",
                "evidence": f"pollution in issuer zone={issuer_pollution} head={head_snippet!r}",
                "size": size, "latest_file": annual_file.name,
                "issuer_pollution": issuer_pollution,
                "expected_total": expected_total,
                "country_count": country_count, "city_count": city_count,
                "exch_count": exch_count, "isin_count": isin_count}

    # 2) Strong pollution >> expected signals = likely subsidiary report
    if strong_pollution and expected_total < 5 and sum(strong_pollution.values()) > expected_total * 3:
        return {"ticker": ticker, "suffix": suffix, "expected_country": expected["country"],
                "category": "MISMATCH_SUBSIDIARY",
                "evidence": f"strong_pollution={strong_pollution} expected_total={expected_total}; head={head_snippet!r}",
                "size": size, "latest_file": annual_file.name,
                "strong_pollution": strong_pollution,
                "expected_total": expected_total}

    # 3) Zero expected signals = MISMATCH_NO_EVIDENCE
    if expected_total == 0:
        return {"ticker": ticker, "suffix": suffix, "expected_country": expected["country"],
                "category": "MISMATCH_NO_EVIDENCE",
                "evidence": f"no expected signals; head={head_snippet!r}",
                "size": size, "latest_file": annual_file.name,
                "expected_total": 0}

    # 4) Otherwise MATCH (note: if name tokens missing from issuer_zone but present elsewhere, flag soft)
    soft = ""
    if name_toks and name_match_count == 0 and name_match_in_full > 0:
        soft = " SOFT_NAME_MISSING_FROM_ISSUER_ZONE"
    return {"ticker": ticker, "suffix": suffix, "expected_country": expected["country"],
            "expected_name": expected_name,
            "category": "MATCH" + soft,
            "evidence": f"expected_total={expected_total} country={country_count} city={city_count} exch={exch_count} isin={isin_count} name_in_full={name_match_in_full}/{len(name_toks)} name_in_issuer_zone={name_match_count}",
            "size": size, "latest_file": annual_file.name,
            "expected_total": expected_total,
            "country_count": country_count, "city_count": city_count,
            "exch_count": exch_count, "isin_count": isin_count,
            "name_match_in_full": name_match_in_full,
            "name_match_issuer_zone": name_match_count}


def main():
    random.seed(20260521)

    # Collect all EU/UK tickers (with valid exchange suffix)
    all_tickers = []
    for d in sorted(SEC_ROOT.iterdir()):
        if not d.is_dir():
            continue
        name = d.name
        if "." not in name:
            continue
        suffix = name.split(".")[-1]
        if suffix in SUFFIX_MAP:
            all_tickers.append((name, d))

    print(f"Total EU/UK tickers with valid suffix: {len(all_tickers)}")

    # Quick population stats by suffix
    by_suffix = {}
    for t, _ in all_tickers:
        suf = t.split(".")[-1]
        by_suffix.setdefault(suf, 0)
        by_suffix[suf] += 1
    print("By suffix:", by_suffix)

    # ---- Phase A : sample 30 stés mixed countries ----
    sample = []
    # Force include known-problematic tickers
    forced = ["ABI.BR", "BCP.LS", "MB.MI", "RI.PA", "UNI.MI", "ROG.SW", "HOLN.SW", "CON.DE", "IAG.L",
              "DG.PA", "SIE.DE", "NG.L"]
    forced_added = set()
    for t, d in all_tickers:
        if t in forced:
            sample.append((t, d))
            forced_added.add(t)

    remaining = [(t, d) for t, d in all_tickers if t not in forced_added]
    # Stratified by suffix — pick proportional
    by_suffix_list = {}
    for t, d in remaining:
        suf = t.split(".")[-1]
        by_suffix_list.setdefault(suf, []).append((t, d))

    # Target 30 total, already have len(forced_added)
    needed = 30 - len(sample)
    # Pick ~2 per suffix max to keep mixed
    suffix_keys = list(by_suffix_list.keys())
    random.shuffle(suffix_keys)
    picked = 0
    while picked < needed and any(by_suffix_list.values()):
        for suf in suffix_keys:
            if picked >= needed:
                break
            lst = by_suffix_list.get(suf, [])
            if not lst:
                continue
            chosen = random.choice(lst)
            lst.remove(chosen)
            sample.append(chosen)
            picked += 1

    print(f"Sample size: {len(sample)}")

    # ---- Phase A bis : classify ----
    results = []
    for t, d in sample:
        r = classify_ticker(t, d)
        if r:
            results.append(r)
            print(f"  {t}: {r['category']} (size={r.get('size')})")

    # ---- Phase B : stats ----
    cats = {}
    for r in results:
        cats[r["category"]] = cats.get(r["category"], 0) + 1
    total = len(results)
    cat_pct = {k: round(100 * v / total, 1) for k, v in cats.items()}

    # ---- Phase B : extrapolation on full population ----
    # Run quick size check on all to count truncated/empty
    full_audit = []
    for t, d in all_tickers:
        af = get_latest_annual(d)
        if af is None:
            full_audit.append({"ticker": t, "category": "EMPTY", "size": 0})
            continue
        sz = af.stat().st_size
        if sz == 0:
            full_audit.append({"ticker": t, "category": "EMPTY", "size": 0})
        elif sz < TRUNCATED_THRESHOLD:
            full_audit.append({"ticker": t, "category": "TRUNCATED", "size": sz})
        else:
            full_audit.append({"ticker": t, "category": "OK_SIZE", "size": sz})

    full_cats = {}
    for r in full_audit:
        full_cats[r["category"]] = full_cats.get(r["category"], 0) + 1

    # ---- Phase B bis : audit all EU/UK regex_real_sourced ----
    real_tickers = set()
    try:
        prepub = json.load(open("/Users/yann/spx-app/src/data/v1-9-pre-publication-audit.json"))
        for a in prepub["audits"]:
            s = json.dumps(a)
            if "regex_real_sourced" in s:
                t = a["ticker"]
                if "." in t and t.split(".")[-1] in SUFFIX_MAP:
                    real_tickers.add(t)
    except Exception as e:
        print(f"warning: prepub load fail {e}")
    print(f"\nregex_real_sourced EU/UK tickers count: {len(real_tickers)}")

    # Pick 10 random EU/UK real_sourced + classify
    real_sample = random.sample(sorted(real_tickers), min(10, len(real_tickers)))
    real_results = []
    for t in real_sample:
        d = SEC_ROOT / t
        if d.is_dir():
            r = classify_ticker(t, d)
        else:
            r = {"ticker": t, "category": "NO_SEC_DIR"}
        if r:
            real_results.append(r)
            print(f"  REAL {t}: {r.get('category')}")

    # Classify ALL regex_real EU/UK (deeper)
    real_full = []
    for t in sorted(real_tickers):
        d = SEC_ROOT / t
        if d.is_dir():
            r = classify_ticker(t, d)
        else:
            r = {"ticker": t, "category": "NO_SEC_DIR"}
        if r:
            real_full.append(r)
    real_cats = {}
    for r in real_full:
        c = r.get("category", "?")
        real_cats[c] = real_cats.get(c, 0) + 1

    output = {
        "audit_date": "2026-05-21",
        "subagent": "#110",
        "scope": {
            "total_eu_uk_tickers": len(all_tickers),
            "by_suffix": by_suffix,
        },
        "sample_size": len(results),
        "sample_categorization": cats,
        "sample_categorization_pct": cat_pct,
        "full_population_size_audit": full_cats,
        "sample_results": results,
        "full_truncated_or_empty": [r for r in full_audit if r["category"] in ("TRUNCATED", "EMPTY")],
        "regex_real_sourced_eu_uk_count": len(real_tickers),
        "regex_real_sourced_sample10": real_results,
        "regex_real_sourced_full_categorization": real_cats,
        "regex_real_sourced_full_results": real_full,
    }

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"\nWrote {OUTPUT_JSON}")
    print(f"\nSample cats: {cats}")
    print(f"Full pop size audit: {full_cats}")


if __name__ == "__main__":
    main()
