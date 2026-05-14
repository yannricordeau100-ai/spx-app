#!/usr/bin/env python3
"""enrich-stoxx-yfinance-bulk.py — fait en 1 proc Python TOUS les enrichments
yfinance gratuits pour les 375 stés Stoxx 600 EU hors top 307.

Blocs traités :
- events (yfinance.news, max 4 recent + filtré pertinence)
- freshness (mostRecentQuarter date)
- company_description (longBusinessSummary)
- ranks fallback (marketCap si pas déjà)
- governance officers fallback (companyOfficers si CEO absent)

Output : update direct v2-pipeline/<ticker>.json (additif, ne overwrite que
les champs vides).

1 proc, sleep 0.3s yfinance, ETA ~5 min pour 375 stés.
"""
import json
import os
import re
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
PENDING_FILE = Path(os.environ.get("PENDING_FILE", "/tmp/stoxx-all.txt"))

try:
    import yfinance as yf
except ImportError:
    print("❌ pip install yfinance", file=sys.stderr)
    sys.exit(1)

NOISE_RE = re.compile(
    r"\b(stock price|share price|trading|buy now|sell now|analyst rating|target price|stock surge|stock drop|stock dip)\b",
    re.IGNORECASE,
)
RELEVANT_RE = re.compile(
    r"\b(earnings|results|revenue|profit|loss|guidance|forecast|acquisition|merger|launches?|unveils?|appoint(s|ed)?|fired|resign(s|ed)?|partner|deal|invest|expansion|recall|fda|approval|cleared|sec|fine|lawsuit|chip|product|cloud|ia|ai|patent|spinoff|ipo|dividend|buyback|guidance|warning)\b",
    re.IGNORECASE,
)


def is_recent(pub_iso: str, days: int = 365) -> bool:
    try:
        d = datetime.fromisoformat(pub_iso.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - d).days <= days
    except Exception:
        return False


def fetch_news(t: yf.Ticker, max_events: int = 4):
    try:
        news = t.news or []
    except Exception:
        return []
    events = []
    for item in news[:30]:
        content = item.get("content", item)
        title = (content.get("title") or "").strip()
        if not title or len(title) < 8:
            continue
        if NOISE_RE.search(title):
            continue
        if not RELEVANT_RE.search(title):
            continue
        pub = content.get("pubDate") or content.get("displayTime") or ""
        if not pub or not is_recent(pub):
            continue
        try:
            d = datetime.fromisoformat(pub.replace("Z", "+00:00"))
        except Exception:
            continue
        body = (content.get("summary") or content.get("description") or "").strip()
        body = re.sub(r"\s+", " ", body)[:240]
        url = content.get("canonicalUrl", {}).get("url") or content.get("clickThroughUrl", {}).get("url") or ""
        provider = content.get("provider", {}).get("displayName") or "Yahoo Finance"
        events.append({
            "year": d.year,
            "month": d.month,
            "title": title[:120],
            "body": body or title,
            "source": provider,
            "url": url,
            "date": d.date().isoformat(),
        })
    seen = set()
    deduped = []
    for e in events:
        key = e["title"].lower()[:60]
        if key in seen:
            continue
        seen.add(key)
        deduped.append(e)
    deduped.sort(key=lambda x: x.get("date", ""), reverse=True)
    return deduped[:max_events]


def main():
    pending = [t for t in PENDING_FILE.read_text().splitlines() if t.strip()]
    print(f"📊 Stoxx yfinance bulk : {len(pending)} stés", flush=True)

    updated_events = 0
    updated_freshness = 0
    updated_desc = 0
    updated_gov = 0
    fails = 0

    for i, tk in enumerate(pending):
        if i and i % 25 == 0:
            print(f"  [{i}/{len(pending)}] events={updated_events} fresh={updated_freshness} desc={updated_desc} gov={updated_gov} fail={fails}", flush=True)
        p = PIPELINE / f"{tk.lower()}.json"
        if not p.exists():
            continue
        try:
            data = json.loads(p.read_text())
        except Exception:
            fails += 1
            continue
        changed = False
        try:
            t = yf.Ticker(tk)
            info = t.info or {}
        except Exception:
            fails += 1
            continue

        # events
        if not data.get("events"):
            events = fetch_news(t)
            if events:
                data["events"] = events
                updated_events += 1
                changed = True

        # company_description
        if not data.get("company_description"):
            desc = info.get("longBusinessSummary") or info.get("description")
            if desc and len(desc) > 80:
                data["company_description"] = desc[:1200]
                updated_desc += 1
                changed = True

        # freshness via mostRecentQuarter
        if not data.get("last_data_date"):
            mrq = info.get("mostRecentQuarter")
            if mrq:
                try:
                    if isinstance(mrq, (int, float)):
                        d = datetime.fromtimestamp(int(mrq), tz=timezone.utc)
                    else:
                        d = datetime.fromisoformat(str(mrq).replace("Z", "+00:00"))
                    data["last_data_date"] = d.date().isoformat()
                    updated_freshness += 1
                    changed = True
                except Exception:
                    pass

        # governance fallback if ceo_name missing
        gov = data.get("governance") or {}
        if not gov.get("ceo_name"):
            officers = info.get("companyOfficers") or []
            for off in officers:
                title = (off.get("title") or "").lower()
                if "chief executive" in title or " ceo" in title or title == "ceo":
                    name = off.get("name", "").strip()
                    if name:
                        gov["ceo_name"] = name
                        gov["_source"] = "yfinance.companyOfficers"
                        data["governance"] = gov
                        updated_gov += 1
                        changed = True
                    break

        if changed:
            try:
                p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
            except Exception:
                fails += 1

        time.sleep(0.3)

    print(f"DONE: events={updated_events} freshness={updated_freshness} desc={updated_desc} gov={updated_gov} fails={fails}", flush=True)


if __name__ == "__main__":
    main()
