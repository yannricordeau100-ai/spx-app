#!/usr/bin/env python3
"""
Construit la liste S&P 1500 (= S&P 500 + 400 + 600) depuis Wikipedia.
Stocke dans _meta/sp1500.json pour usage par sec-download-v2.

Usage : python3 scripts/build-sp1500-list.py
"""
import json
import re
import ssl
import urllib.request
from pathlib import Path

USER_AGENT = "Mettrik Research yannricordeau100@gmail.com"
META = Path.home() / "spx-app" / "sec-data" / "_meta"
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as r:
        return r.read().decode("utf-8", errors="replace")


def parse_wiki_sp_table(html: str, table_id_or_header: str = None) -> list[tuple[str, str]]:
    """Parse a wikitable and extract (ticker, name) pairs.
    Cherche une table avec colonne 'Symbol' / 'Ticker symbol' / 'Stock Symbol'."""
    out = []
    # Trouver toutes les tables wikitable
    tables = re.findall(r'<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>(.*?)</table>', html, re.DOTALL)
    for tbl in tables:
        # Header
        head_match = re.search(r'<tr[^>]*>(.*?)</tr>', tbl, re.DOTALL)
        if not head_match:
            continue
        headers = [re.sub(r"<[^>]+>", "", h).strip().lower()
                   for h in re.findall(r'<th[^>]*>(.*?)</th>', head_match.group(1), re.DOTALL)]
        # Find symbol column index
        sym_idx = None
        name_idx = None
        for i, h in enumerate(headers):
            if "symbol" in h or "ticker" in h:
                sym_idx = i
            if "company" in h or "security" in h or "name" in h:
                if name_idx is None:
                    name_idx = i
        if sym_idx is None:
            continue
        # Iterate rows
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', tbl, re.DOTALL)
        for row in rows[1:]:
            cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.DOTALL)
            if len(cells) <= sym_idx:
                continue
            sym = re.sub(r"<[^>]+>", "", cells[sym_idx]).strip()
            sym = sym.replace("​", "").replace("&nbsp;", " ").strip()
            if not re.match(r"^[A-Z][A-Z0-9.\-]{0,9}$", sym):
                continue
            name = ""
            if name_idx is not None and len(cells) > name_idx:
                name = re.sub(r"<[^>]+>", "", cells[name_idx]).strip()
                name = re.sub(r"\s+", " ", name)
            out.append((sym, name))
        if out:
            return out  # Premier tableau valide
    return out


def main():
    META.mkdir(parents=True, exist_ok=True)
    urls = {
        "sp500": "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
        "sp400": "https://en.wikipedia.org/wiki/List_of_S%26P_400_companies",
        "sp600": "https://en.wikipedia.org/wiki/List_of_S%26P_600_companies",
    }
    all_data = {}
    for key, url in urls.items():
        try:
            print(f"Fetching {key}...")
            html = fetch(url)
            entries = parse_wiki_sp_table(html)
            print(f"  ✓ {len(entries)} entrées extraites")
            all_data[key] = entries
        except Exception as e:
            print(f"  ! échec: {e}")
            all_data[key] = []

    # Compose ordered list: 500 + 400 + 600
    seen = set()
    ordered = []
    for key in ["sp500", "sp400", "sp600"]:
        for sym, name in all_data[key]:
            if sym not in seen:
                seen.add(sym)
                ordered.append({"ticker": sym, "name": name, "index": key})

    out_path = META / "sp1500.json"
    out_path.write_text(json.dumps({
        "generated": "2026-04-28",
        "source": "Wikipedia",
        "count": len(ordered),
        "by_index": {k: len(v) for k, v in all_data.items()},
        "tickers": ordered,
    }, indent=2, ensure_ascii=False))
    print()
    print(f"✓ {len(ordered)} sociétés total → {out_path}")
    print(f"  S&P 500: {len(all_data['sp500'])}")
    print(f"  S&P 400: {len(all_data['sp400'])}")
    print(f"  S&P 600: {len(all_data['sp600'])}")


if __name__ == "__main__":
    main()
