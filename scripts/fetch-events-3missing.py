#!/usr/bin/env python3
"""Fetch events.json pour les 3 stés top 307 sans events."""
import json, sys, time
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
ENR = ROOT / "src/data/v2-pipeline-enrich"
TICKERS = ["ADYEN.AS", "NTNX", "AOS"]

try:
    import yfinance as yf
except ImportError:
    print("yfinance non installé")
    sys.exit(1)


def get_news(ticker):
    try:
        t = yf.Ticker(ticker)
        news = t.news or []
        events = []
        for n in news[:20]:
            content = n.get("content") if isinstance(n.get("content"), dict) else {}
            title = content.get("title") or n.get("title") or ""
            summary = content.get("summary") or content.get("description") or ""
            pub = content.get("pubDate") or n.get("providerPublishTime")
            url = (content.get("canonicalUrl") or {}).get("url") or n.get("link") or ""
            provider = (content.get("provider") or {}).get("displayName") or "Yahoo Finance"
            if not title or not pub: continue
            try:
                if isinstance(pub, (int, float)):
                    dt = datetime.fromtimestamp(pub, tz=timezone.utc)
                else:
                    dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
            except Exception:
                continue
            events.append({
                "year": dt.year,
                "month": dt.month,
                "title": title.strip(),
                "body": summary.strip()[:300],
                "source": provider,
                "url": url,
                "date": dt.strftime("%Y-%m-%d"),
            })
        return events[:4]
    except Exception as e:
        print(f"  ❌ {ticker}: {type(e).__name__} {str(e)[:60]}")
        return []


for tk in TICKERS:
    events = get_news(tk)
    if not events:
        print(f"  ⚠ {tk}: no events from yfinance")
        continue
    out = ENR / f"{tk.lower()}.events.json"
    data = {
        "ticker": tk,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "events": events,
    }
    out.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    print(f"  ✅ {tk}: {len(events)} events")
    time.sleep(1)

print("END")
