#!/usr/bin/env python3
"""enrich-sp500-yfinance-bulk-v2.py — 1 proc qui fait en // tous les enrichments
yfinance/Clearbit gratuits pour SP500.

Blocs traités (en série dans 1 proc pour mutualiser yfinance.info call) :
- Logo : Clearbit + yfinance.info["website"] favicon
- Gov CEO : yfinance.companyOfficers
- Ranks : yfinance.marketCap → rang relatif
- Hero last_data_date : yfinance.info["mostRecentQuarter"]
- Events : yfinance.news (top 4)
- Company description : yfinance.longBusinessSummary (si <50 chars)

1 proc, sleep 0.3s entre stés, ETA ~15 min sur 500 stés.
"""
import json
import os
import re
import sys
import time
import urllib.request
import ssl
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi; SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except: SSL_CTX = ssl.create_default_context()

try:
    import yfinance as yf
except ImportError:
    print("❌ pip install yfinance", file=sys.stderr); sys.exit(1)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
LOGO_DIR = PROJECT_ROOT / "public/logos"
PENDING_FILE = Path(os.environ.get("PENDING_FILE", "/tmp/sp500-all-us.txt"))

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

NOISE_RE = re.compile(r"\b(stock price|share price|trading|buy now|sell now|analyst rating|target price)\b", re.I)
RELEVANT_RE = re.compile(r"\b(earnings|results|revenue|profit|loss|guidance|forecast|acquisition|merger|launch|unveils?|appoint|fired|resign|partner|deal|invest|expansion|recall|fda|approval|cleared|sec|fine|lawsuit|chip|product|cloud|ai|patent|spinoff|ipo|dividend|buyback|warning)\b", re.I)


def fetch_logo(tk, website):
    """Try Clearbit + favicon for logo PNG. Save to public/logos/<tk>.png."""
    safe = tk.replace(".","-").replace("/","-").upper()
    dest = LOGO_DIR / f"{safe}.png"
    if dest.exists() and dest.stat().st_size > 500: return True
    # Get domain from website
    if not website: return False
    domain = website.replace("https://","").replace("http://","").split("/")[0]
    # Clearbit
    for url in [f"https://logo.clearbit.com/{domain}?size=128", f"https://www.google.com/s2/favicons?domain={domain}&sz=128"]:
        try:
            req = urllib.request.Request(url, headers={"User-Agent":UA})
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=10) as r:
                data = r.read()
            if len(data) > 500:
                LOGO_DIR.mkdir(exist_ok=True)
                dest.write_bytes(data)
                return True
        except: continue
    return False


def fetch_news_events(t):
    try:
        news = t.news or []
    except: return []
    out = []
    for item in news[:30]:
        content = item.get("content", item)
        title = (content.get("title") or "").strip()
        if not title or len(title) < 8: continue
        if NOISE_RE.search(title): continue
        if not RELEVANT_RE.search(title): continue
        pub = content.get("pubDate") or content.get("displayTime") or ""
        if not pub: continue
        try:
            d = datetime.fromisoformat(pub.replace("Z","+00:00"))
            if (datetime.now(timezone.utc) - d).days > 365: continue
        except: continue
        body = (content.get("summary") or content.get("description") or "").strip()
        body = re.sub(r"\s+", " ", body)[:240]
        url = content.get("canonicalUrl",{}).get("url") or content.get("clickThroughUrl",{}).get("url") or ""
        provider = content.get("provider",{}).get("displayName") or "Yahoo Finance"
        out.append({"year": d.year, "month": d.month, "title": title[:120], "body": body or title, "source": provider, "url": url, "date": d.date().isoformat()})
    seen = set(); dedup = []
    for e in out:
        k = e["title"].lower()[:60]
        if k in seen: continue
        seen.add(k); dedup.append(e)
    dedup.sort(key=lambda x: x.get("date",""), reverse=True)
    return dedup[:4]


def main():
    pending = [t for t in PENDING_FILE.read_text().splitlines() if t.strip()]
    print(f"📊 SP500 yfinance bulk v2 : {len(pending)} stés", flush=True)

    updated_logo = 0
    updated_gov = 0
    updated_ranks = 0
    updated_fresh = 0
    updated_events = 0
    updated_desc = 0
    fails = 0

    for i, tk in enumerate(pending):
        if i and i % 25 == 0:
            print(f"  [{i}/{len(pending)}] logo+{updated_logo} gov+{updated_gov} ranks+{updated_ranks} fresh+{updated_fresh} events+{updated_events} desc+{updated_desc}", flush=True)
        p = PIPELINE / f"{tk.lower()}.json"
        if not p.exists(): continue
        try: data = json.loads(p.read_text())
        except: fails += 1; continue

        try:
            t = yf.Ticker(tk)
            info = t.info or {}
        except: fails += 1; continue

        changed = False
        # 1. Logo
        if fetch_logo(tk, info.get("website","")):
            updated_logo += 1

        # 2. Gov CEO (if missing)
        gov = data.get("governance") or {}
        if not gov.get("ceo_name") or gov.get("ceo_name") in ("À renseigner",""):
            for off in (info.get("companyOfficers") or []):
                title = (off.get("title") or "").lower()
                if "chief executive" in title or "ceo" in title:
                    name = off.get("name","").strip()
                    if name:
                        gov["ceo_name"] = name
                        gov["_source"] = "yfinance.companyOfficers"
                        data["governance"] = gov
                        updated_gov += 1
                        changed = True
                        break

        # 3. Ranks (if missing global_world)
        ranks = data.get("ranks") or {}
        if not ranks.get("global_world"):
            mc = info.get("marketCap")
            if mc:
                # Simplified rank assignment based on market cap
                if mc > 1e12: ranks["global_world"] = "Top 10 monde"
                elif mc > 5e11: ranks["global_world"] = "Top 30 monde"
                elif mc > 2e11: ranks["global_world"] = "Top 50 monde"
                elif mc > 1e11: ranks["global_world"] = "Top 100 monde"
                elif mc > 5e10: ranks["global_world"] = "Top 200 monde"
                elif mc > 2e10: ranks["global_world"] = "Top 500 monde"
                else: ranks["global_world"] = "≈ #" + str(int(2e12 / mc))
                ranks["_source"] = "yfinance.marketCap"
                data["ranks"] = ranks
                updated_ranks += 1
                changed = True

        # 4. Hero last_data_date (KPI level)
        kpis = data.get("kpis") or []
        hero_short = data.get("hero_kpi")
        h_idx = next((i for i,k in enumerate(kpis) if k.get("short")==hero_short), None)
        if h_idx is not None and not kpis[h_idx].get("last_data_date"):
            mrq = info.get("mostRecentQuarter")
            if mrq:
                try:
                    if isinstance(mrq,(int,float)):
                        d_obj = datetime.fromtimestamp(int(mrq), tz=timezone.utc)
                    else:
                        d_obj = datetime.fromisoformat(str(mrq).replace("Z","+00:00"))
                    kpis[h_idx]["last_data_date"] = d_obj.date().isoformat()
                    data["kpis"] = kpis
                    updated_fresh += 1
                    changed = True
                except: pass

        # 5. Events
        if not data.get("events") or len(data["events"]) < 2:
            events = fetch_news_events(t)
            if len(events) >= 2:
                data["events"] = events
                updated_events += 1
                changed = True

        # 6. Description
        if len(str(data.get("company_description") or "")) < 50:
            desc = info.get("longBusinessSummary") or info.get("description")
            if desc and len(desc) > 80:
                data["company_description"] = desc[:1200]
                updated_desc += 1
                changed = True

        if changed:
            try: p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
            except: fails += 1

        time.sleep(0.3)

    print(f"DONE: logo+{updated_logo} gov+{updated_gov} ranks+{updated_ranks} fresh+{updated_fresh} events+{updated_events} desc+{updated_desc} fails={fails}", flush=True)


if __name__ == "__main__":
    main()
