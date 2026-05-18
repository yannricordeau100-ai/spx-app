#!/usr/bin/env python3
"""
ranks-audit-fix.py — audit + fix des ranks (#mondial, #US, sector,
subsector) sur les 307 stés V1.8 contre une source externe fraîche
(companiesmarketcap.com top 1000).

Yann 9 mai 2026 : RANKS-V2 a corrigé NVDA #10 → #1 mais audit incomplet
(couverture pleine de trous, _source absent, ranks proches mais imprécis).
Il faut un audit indépendant + correction systématique.

Process :
  1. Scrape top 1000 mondial depuis companiesmarketcap.com (10 pages, 1
     req / 2 sec respectueux).
  2. Pour chaque sté V1.8 (307), match par ticker → rank global_world.
  3. Calcule global_us (filter pays US, recalcul rank), sector / subsector
     (groupé par GICS depuis nos datasets v2-pipeline).
  4. Output `<ticker>.ranks.json` au format compatible load-company.ts
     avec `_source = "companiesmarketcap.com"` + `_data_freshness_date`.
  5. Diff vs RANKS-V2 actuel : log les écarts > 5 places (alerte).
  6. Rebuild merged + audit + commit + push.

Usage :
    python3 scripts/ranks-audit-fix.py [--limit N] [--dry-run]
"""
import argparse
import json
import os
import re
import ssl
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
ENR = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
V18_LIST = PROJECT_ROOT / "src/data/v1-8-tickers-sorted.json"
PUB = PROJECT_ROOT / "src/data/v1-7-public.json"

CMC_BASE = "https://companiesmarketcap.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def fetch_url(url: str, retries: int = 2) -> str | None:
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=30) as r:
                return r.read().decode("utf-8", errors="ignore")
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(5 + attempt * 5)
                continue
            return None
        except Exception:
            if attempt < retries:
                time.sleep(3)
                continue
            return None
    return None


# Extracteur ticker + rank + market_cap_usd + country depuis HTML CMC.
# Convention CMC : table avec lignes <tr><td><div class="rank-row">N</div>...
# <div class="company-code">TICKER</div>...<td>$X.XXX T/B/M</td>...
# Regex robuste ; capture ticker (uppercase 1-6 lettres, possibles tirets/points
# pour ADR / classes). market_cap converti en USD.

ROW_RE = re.compile(
    r'data-rank-row="(?P<rank>\d+)"'
    r'.*?<a[^>]*class="company-code[^"]*"[^>]*>(?P<ticker>[A-Z][A-Z0-9.\-]{0,7})</a>'
    r'.*?<td[^>]*>\s*\$(?P<mc>[\d,.]+)\s*(?P<unit>[TBMK])',
    re.DOTALL | re.IGNORECASE,
)
# Fallback regex plus permissif si CMC change format
ROW_RE_FALLBACK = re.compile(
    r'<a[^>]+href="/[^"]+"[^>]*>(?P<ticker>[A-Z][A-Z0-9.\-]{0,7})</a>'
    r'.*?(?:rank-row[^>]*>(?P<rank>\d+)|>(?P<rank2>\d+)\.</td>)'
    r'.*?\$(?P<mc>[\d,.]+)\s*(?P<unit>[TBMK])',
    re.DOTALL | re.IGNORECASE,
)


def mc_to_usd(value: str, unit: str) -> float:
    try:
        v = float(value.replace(",", ""))
    except ValueError:
        return 0.0
    mult = {"T": 1e12, "B": 1e9, "M": 1e6, "K": 1e3}.get(unit.upper(), 1)
    return v * mult


def parse_cmc_html(html: str) -> list[dict]:
    """Parse le HTML CMC réel (vérifié 9 mai 2026). Format observé :
       <tr>
         <td class="fav">...</td>
         <td class="rank-td td-right" data-sort="N">N</td>
         <td class="name-td">
           <div class="company-code">...TICKER</div>
         </td>
         <td class="td-right" data-sort="MARKET_CAP_RAW">$X.XXX T</td>
         <td class="td-right" data-sort="PRICE_RAW">$XXX.XX</td>
         ...
         <td>🇺🇸 <span class="responsive-hidden">USA</span></td>
       </tr>
    """
    out: list[dict] = []
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.DOTALL)
    for row in rows:
        # Rank : <td class="rank-td td-right" data-sort="N">N</td>
        m_r = re.search(r'rank-td[^>]*data-sort="(\d+)"', row)
        if not m_r:
            continue
        rank = int(m_r.group(1))

        # Ticker : <div class="company-code">...TICKER</div>
        # Ticker collé après <span class="rank d-none"></span> ou direct.
        m_t = re.search(
            r'class="company-code"[^>]*>(?:\s*<span[^>]*></span>)?\s*([A-Z][A-Z0-9.\-]{0,7})\s*</div>',
            row,
        )
        if not m_t:
            continue
        ticker = m_t.group(1).strip().upper()

        # Market cap : data-sort="X" (raw value) sur le <td> juste après name-td.
        # Plus fiable que de parser "$5.230 T".
        m_mc_raw = re.search(
            r'name-td.*?data-sort="(\d+)"',
            row,
            re.DOTALL,
        )
        if m_mc_raw:
            mc = float(m_mc_raw.group(1))
        else:
            # Fallback : parse "$X.XXX T/B/M"
            m_mc = re.search(r"\$([\d,.]+)\s*([TBMK])", row)
            if not m_mc:
                continue
            mc = mc_to_usd(m_mc.group(1), m_mc.group(2))

        # Pays : <td>🇺🇸 <span class="responsive-hidden">USA</span></td>
        country = None
        m_c = re.search(
            r'<span class="responsive-hidden">([A-Z][a-z]+(?: [A-Z][a-z]+)*|[A-Z]{2,4})</span>',
            row,
        )
        if m_c:
            country_full = m_c.group(1).strip()
            # Normalise : USA → US ; United States → US ; France → FR ; etc.
            country_map = {
                "USA": "US", "United States": "US", "U.S.": "US",
                "United Kingdom": "GB", "UK": "GB", "Britain": "GB",
                "Germany": "DE", "France": "FR", "Italy": "IT", "Spain": "ES",
                "Netherlands": "NL", "Belgium": "BE", "Switzerland": "CH",
                "Sweden": "SE", "Denmark": "DK", "Finland": "FI", "Norway": "NO",
                "China": "CN", "Hong Kong": "HK", "Japan": "JP", "South Korea": "KR",
                "Taiwan": "TW", "India": "IN", "Australia": "AU", "Canada": "CA",
                "Brazil": "BR", "Mexico": "MX", "Singapore": "SG",
                "Saudi Arabia": "SA", "UAE": "AE",
            }
            country = country_map.get(country_full, country_full[:2].upper())

        out.append({
            "ticker": ticker,
            "rank": rank,
            "market_cap_usd": mc,
            "country": country,
        })
    return out


def scrape_cmc_top(pages: int = 10) -> list[dict]:
    """Scrape top N×100 du leaderboard CMC."""
    all_rows: list[dict] = []
    for p in range(1, pages + 1):
        url = f"{CMC_BASE}/page/{p}/" if p > 1 else CMC_BASE + "/"
        html = fetch_url(url)
        if not html:
            print(f"  ⚠️ page {p} fetch failed, skip")
            time.sleep(3)
            continue
        rows = parse_cmc_html(html)
        # CMC ne donne pas toujours le rank explicite : on l'attribue par ordre
        # quand absent (page p, position j → rank = (p-1)*100 + j+1).
        for j, r in enumerate(rows):
            if r["rank"] is None:
                r["rank"] = (p - 1) * 100 + j + 1
        all_rows.extend(rows)
        print(f"  page {p}: {len(rows)} stés ({len(all_rows)} total)")
        time.sleep(2)
    return all_rows


def normalize_ticker(t: str) -> str:
    """Normalise ticker : supprime suffixes country (.PA, .DE, .L, etc.)
    n'est PAS appliqué ici : on garde le format CMC qui matche v17-public.
    Mais on harmonise les variants : BRK-B / BRK.B / BRK-A → BRK-B.
    """
    u = t.upper().replace(".", "-")
    aliases = {
        "BRK-A": "BRK-B",
        "GOOG": "GOOGL",
        "FOX": "FOXA",
        "NWSA": "NWS",
        "UAA": "UA",
    }
    return aliases.get(u, u)


def load_v18_tickers() -> list[str]:
    if V18_LIST.exists():
        return [t.upper() for t in json.loads(V18_LIST.read_text())]
    pub = json.loads(PUB.read_text())
    return [t.upper() for t in pub.keys()]


def load_company_data(ticker: str) -> dict | None:
    p = PIPELINE / f"{ticker.lower()}.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--pages", type=int, default=10, help="Nb pages CMC à scrape (100 stés/page)")
    args = ap.parse_args()

    print("📊 RANKS-AUDIT-FIX | source = companiesmarketcap.com")
    print("─" * 60)

    # 1. Scrape CMC
    print(f"1. Scrape CMC top {args.pages * 100}…")
    cmc = scrape_cmc_top(args.pages)
    if not cmc:
        print("❌ Aucune donnée CMC scrapée. Abort.")
        sys.exit(1)
    print(f"   → {len(cmc)} stés mondiales scrapées")

    # 2. Index by ticker (harmonisé)
    cmc_by_ticker: dict[str, dict] = {}
    for r in cmc:
        t = normalize_ticker(r["ticker"])
        if t not in cmc_by_ticker or (cmc_by_ticker[t]["rank"] or 9999) > (r["rank"] or 9999):
            cmc_by_ticker[t] = r
    print(f"   → {len(cmc_by_ticker)} tickers uniques après normalisation")

    # 3. Calcule rank US : filter pays US, recalcule rang dans le sous-ensemble
    us_only = sorted(
        [r for r in cmc if (r.get("country") == "US" or r.get("country") == "USA")],
        key=lambda x: x["rank"] or 9999,
    )
    us_rank_by_ticker: dict[str, int] = {}
    for i, r in enumerate(us_only, 1):
        us_rank_by_ticker[normalize_ticker(r["ticker"])] = i

    # 4. Pour chaque sté V1.8 : match + écris ranks.json
    v18 = load_v18_tickers()
    if args.limit:
        v18 = v18[: args.limit]

    pub = json.loads(PUB.read_text())
    matched = 0
    not_in_cmc = 0
    written = 0
    diff_warnings = []

    fresh = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    for t in v18:
        norm = normalize_ticker(t)
        cmc_entry = cmc_by_ticker.get(norm)
        if not cmc_entry:
            not_in_cmc += 1
            continue
        matched += 1

        global_world = f"#{cmc_entry['rank']}"
        global_us = f"#{us_rank_by_ticker.get(norm, '?')}" if norm in us_rank_by_ticker else "—"

        # Sector / subsector : récup depuis dataset v2-pipeline pour avoir le
        # nom GICS, puis on calcule rank via les V1.8 tickers du même
        # secteur/sous-secteur triés par market cap.
        co = pub.get(t) or {}
        sector_name = co.get("sector", "")
        subsector_name = co.get("subsector", "")

        # Diff alert si ancien rank très différent
        old_p = ENR / f"{t.lower()}.ranks.json"
        if old_p.exists():
            try:
                old = json.loads(old_p.read_text())
                old_world = old.get("ranks", {}).get("global_world", "")
                old_n = re.search(r"\d+", str(old_world))
                if old_n:
                    delta = abs(int(old_n.group(0)) - cmc_entry["rank"])
                    if delta > 5:
                        diff_warnings.append((t, old_world, global_world, delta))
            except Exception:
                pass

        out = {
            "ticker": t,
            "ranks": {
                "global_world": global_world,
                "global_us": global_us,
                "sector": f"Top {sector_name}" if sector_name else "—",
                "subsector": f"#? in {subsector_name}" if subsector_name else "—",
            },
            "market_cap_usd": cmc_entry["market_cap_usd"],
            "country": cmc_entry.get("country"),
            "_source": "companiesmarketcap.com",
            "_data_freshness_date": fresh,
            "_audited_by": "ranks-audit-fix.py",
        }

        # 5. Calcule sector / subsector rank dans le sous-ensemble V1.8
        # (groupage GICS sur tous les V1.8 tickers du même sector/subsector,
        # tri par market_cap décroissant, position de t dans la liste).
        same_sector = [
            (other_t, cmc_by_ticker.get(normalize_ticker(other_t), {}).get("market_cap_usd", 0))
            for other_t in v18
            if (pub.get(other_t) or {}).get("sector") == sector_name and sector_name
        ]
        same_sector.sort(key=lambda x: -x[1])
        sector_rank = next((i + 1 for i, (ot, _) in enumerate(same_sector) if ot == t), None)
        if sector_rank:
            out["ranks"]["sector"] = f"#{sector_rank} dans {sector_name}"

        same_subsector = [
            (other_t, cmc_by_ticker.get(normalize_ticker(other_t), {}).get("market_cap_usd", 0))
            for other_t in v18
            if (pub.get(other_t) or {}).get("subsector") == subsector_name and subsector_name
        ]
        same_subsector.sort(key=lambda x: -x[1])
        subsector_rank = next((i + 1 for i, (ot, _) in enumerate(same_subsector) if ot == t), None)
        if subsector_rank:
            out["ranks"]["subsector"] = f"#{subsector_rank} dans {subsector_name}"

        if not args.dry_run:
            ENR.mkdir(parents=True, exist_ok=True)
            (ENR / f"{t.lower()}.ranks.json").write_text(json.dumps(out, indent=2, ensure_ascii=False))
            written += 1

    print(f"\n✅ Audit fini :")
    print(f"   - {matched}/{len(v18)} stés matched dans CMC top {args.pages * 100}")
    print(f"   - {not_in_cmc}/{len(v18)} non trouvées (probablement hors top mondial)")
    print(f"   - {written} fichiers ranks.json écrits")
    print(f"   - {len(diff_warnings)} écarts >5 places vs ancien RANKS-V2")
    for t, old, new, d in diff_warnings[:10]:
        print(f"     {t}: {old} → {new} (Δ {d})")


if __name__ == "__main__":
    main()
