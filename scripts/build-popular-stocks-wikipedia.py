#!/usr/bin/env python3
"""build-popular-stocks-wikipedia.py — Construire le ranking des stés
les plus consultées Wikipedia par langue (proxy popularité retail investors).

Sources :
1. Wikidata : ticker → Q-id → sitelinks Wikipedia per language
2. Wikipedia pageviews API : views per article per language (12 derniers mois)

Output : src/data/popular-stocks-by-language.json
Format : {
  "world": [{ticker, name, total_views, rank}, ...],
  "fr": [...], "en": [...], "de": [...], "nl": [...], "en-GB": [...],
  "sv": [...], "da": [...], "de-CH": [...]
}

Universe : top 307 V1.8 + tous SP500 (déduplication).
"""
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from pathlib import Path

try:
    import certifi; SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except: SSL_CTX = ssl.create_default_context()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
UA = "Mettrik research contact@mettrik.ai"

# Mapping site language → Wikipedia language code
LANG_MAP = {
    "fr": "fr",
    "en": "en",
    "de": "de",
    "nl": "nl",
    "en-GB": "en",   # same en wiki
    "sv": "sv",
    "da": "da",
    "de-CH": "de",   # same de wiki
}

# Country override for retail visitor context (page "popular" prio)
COUNTRY_TO_LANGS = {
    "France": ["fr"], "United States": ["en"], "United Kingdom": ["en-GB"],
    "Germany": ["de"], "Netherlands": ["nl"], "Sweden": ["sv"],
    "Denmark": ["da"], "Switzerland": ["de-CH", "fr"],
}

# 12 months window: today - 13 months → today - 1 month
END = datetime.utcnow().replace(day=1) - timedelta(days=1)
START = (END.replace(day=1) - timedelta(days=365)).replace(day=1)
START_S = START.strftime("%Y%m%d") + "00"
END_S = END.strftime("%Y%m%d") + "00"


def http_json(url, retries=3):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=20) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code in (429, 503): time.sleep(5); continue
            return None
        except Exception:
            if attempt < retries-1: time.sleep(2); continue
            return None
    return None


def find_wikidata_qid(name, ticker=None):
    """Search Wikidata for a company by name (and ticker if helpful)."""
    # Try direct name search
    q = name.replace("&", "and")
    url = f"https://www.wikidata.org/w/api.php?action=wbsearchentities&search={urllib.parse.quote(q)}&language=en&type=item&limit=5&format=json"
    data = http_json(url)
    if not data: return None
    candidates = data.get("search") or []
    # Pick first match that has description mentioning company/corporation
    for c in candidates:
        desc = (c.get("description") or "").lower()
        if any(kw in desc for kw in ["company", "corporation", "société", "groupe", "inc.", "ltd", "ag", "sa", "se", "plc", "holding"]):
            return c.get("id")
    return candidates[0].get("id") if candidates else None


def get_sitelinks(qid):
    """Get Wikipedia article names per language for a Wikidata Q-id."""
    url = f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json"
    data = http_json(url)
    if not data: return {}
    entities = data.get("entities", {})
    qdata = entities.get(qid, {})
    sitelinks = qdata.get("sitelinks", {})
    out = {}
    for site, info in sitelinks.items():
        # e.g. site = "enwiki", "frwiki", etc.
        m = re.match(r"^([a-z]{2,3})wiki$", site)
        if m:
            lang = m.group(1)
            out[lang] = info.get("title")
    return out


def get_pageviews(lang, article):
    """Get total pageviews for article in given language wiki, last 12 months."""
    enc = urllib.parse.quote(article, safe="")
    url = f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/{lang}.wikipedia/all-access/all-agents/{enc}/monthly/{START_S}/{END_S}"
    data = http_json(url)
    if not data: return 0
    return sum(it.get("views", 0) for it in (data.get("items") or []))


def main():
    # Universe: top 307 V1.8 + SP500 unique
    top307 = json.load(open(PROJECT_ROOT / "src/data/v1-8-tickers-sorted.json"))[:307]
    sp500 = sorted(set(open("/tmp/sp500-tickers.txt").read().splitlines()) - {""})
    universe = sorted(set(top307) | set(sp500))
    print(f"Universe : {len(universe)} stés (top 307 ∪ SP500)", flush=True)

    # Load names from pipeline
    name_by_ticker = {}
    PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
    for tk in universe:
        p = PIPELINE / f"{tk.lower()}.json"
        if p.exists():
            try:
                d = json.loads(p.read_text())
                name_by_ticker[tk] = d.get("name") or tk
            except: name_by_ticker[tk] = tk
        else:
            name_by_ticker[tk] = tk

    # Step 1 : Find Q-id + sitelinks for each ticker
    out_data = {"_meta": {"window": f"{START_S} to {END_S}", "source": "Wikipedia pageviews via Wikidata"}}
    qid_cache = PROJECT_ROOT / ".popular-stocks-cache.json"
    cache = {}
    if qid_cache.exists():
        try: cache = json.loads(qid_cache.read_text())
        except: cache = {}

    rows = []  # (ticker, name, qid, sitelinks, views_per_lang)
    wiki_langs = set(["en","fr","de","nl","sv","da"])

    for i, tk in enumerate(universe):
        if i and i % 25 == 0:
            print(f"  [{i}/{len(universe)}] cached={len(cache)}", flush=True)
            # Save cache periodically
            qid_cache.write_text(json.dumps(cache))

        if tk in cache:
            entry = cache[tk]
        else:
            name = name_by_ticker.get(tk, tk)
            qid = find_wikidata_qid(name, tk)
            time.sleep(0.3)
            if not qid:
                cache[tk] = {"qid": None, "sitelinks": {}, "views": {}}
                continue
            sitelinks = get_sitelinks(qid)
            time.sleep(0.3)
            views = {}
            for lang in wiki_langs:
                if lang in sitelinks:
                    v = get_pageviews(lang, sitelinks[lang])
                    views[lang] = v
                    time.sleep(0.2)
            entry = {"qid": qid, "sitelinks": sitelinks, "views": views}
            cache[tk] = entry

        rows.append({"ticker": tk, "name": name_by_ticker.get(tk, tk), "qid": entry["qid"], "sitelinks": entry["sitelinks"], "views": entry["views"]})

    qid_cache.write_text(json.dumps(cache))

    # Step 2 : Compute rankings per site language
    site_langs = ["en","fr","de","nl","en-GB","sv","da","de-CH"]
    out_data["world"] = sorted(
        [{"ticker": r["ticker"], "name": r["name"], "qid": r["qid"], "total_views": sum(r["views"].values())} for r in rows],
        key=lambda x: -x["total_views"]
    )
    for rank, r in enumerate(out_data["world"], 1): r["rank"] = rank

    for site_lang in site_langs:
        wiki_lang = LANG_MAP[site_lang]
        ranked = sorted(
            [{"ticker": r["ticker"], "name": r["name"], "views": r["views"].get(wiki_lang, 0)} for r in rows],
            key=lambda x: -x["views"]
        )
        for rank, r in enumerate(ranked, 1): r["rank"] = rank
        out_data[site_lang] = ranked

    out_file = PROJECT_ROOT / "src/data/popular-stocks-by-language.json"
    out_file.write_text(json.dumps(out_data, indent=2, ensure_ascii=False))
    print(f"\n✅ Saved {out_file}", flush=True)
    print(f"World top 15:")
    for r in out_data["world"][:15]:
        print(f"  #{r['rank']:<3} {r['ticker']:<10} {r['name'][:40]:<41} {r['total_views']:,}")


if __name__ == "__main__":
    main()
