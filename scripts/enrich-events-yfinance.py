#!/usr/bin/env python3
"""
enrich-events-yfinance.py — extrait les "faits saillants" récents pour
chaque sté V1.7 Pass 3 strict via `yfinance.news` (gratuit, illimité).

Pour chaque sté :
  - fetch les 20 derniers articles news yfinance
  - filtre les titres pertinents (résultats trimestriels, deals M&A, produits,
    régulation, dirigeants) via heuristiques mots-clés
  - garde max 4 events sur les 12 derniers mois
  - écrit `src/data/v2-pipeline-enrich/<ticker>.events.json`

Format de sortie compatible avec `CompanyEvent[]` (cf. src/lib/events.ts) :
    [
      { "year": 2026, "month": 4, "title": "…", "body": "…", "source": "Yahoo Finance" }
    ]

Usage :
    python3 scripts/enrich-events-yfinance.py [--limit N] [--force]

Idempotent : skip si fichier .events.json existe ET a moins de 7 jours
(les events bougent vite, on rafraîchit toutes les semaines via cron).

Auto-run : à brancher sur le cron `mettrik-rebuild-merged` post-rebuild.
"""

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
V17 = PROJECT_ROOT / "src/data/v1-7-public.json"
ENR = PROJECT_ROOT / "src/data/v2-pipeline-enrich"

# Mots-clés qui indiquent un événement "important" pour un investisseur
# (vs bruit habituel "stock price up X%"). FR + EN.
RELEVANT_PATTERNS = [
    r"earnings|results|q[1-4]|trimestre|résultats",
    r"acqui[sr]|merger|deal|takeover",
    r"buyback|dividend|split|spin[- ]?off",
    r"ceo|cfo|chairman|appoint|step down|resign|nomm[ée]",
    r"regulator|antitrust|sec|fine|settle|lawsuit|sanction",
    r"launch|unveil|announc[ed]|product|approval|fda",
    r"layoff|restructur|cost cut|guidance|forecast|raise.*outlook",
    r"partner|joint venture|strategic|investment",
]
RELEVANT_RE = re.compile("|".join(RELEVANT_PATTERNS), re.IGNORECASE)

# Filtre anti-bruit (titres clickbait à exclure)
NOISE_PATTERNS = [
    r"why .* (stock|shares) (is|are) (up|down|surging|plunging|soaring)",
    r"(\d+) (stocks?|reasons|things)",
    r"buy this stock",
    r"^\d+%",
    r"reddit",
]
NOISE_RE = re.compile("|".join(NOISE_PATTERNS), re.IGNORECASE)


def is_recent(event_date_iso: str, max_days: int = 365) -> bool:
    try:
        d = datetime.fromisoformat(event_date_iso.replace("Z", "+00:00"))
        age = (datetime.now(timezone.utc) - d).days
        return 0 <= age <= max_days
    except Exception:
        return False


def fetch_events(ticker: str, max_events: int = 4):
    import yfinance as yf

    try:
        t = yf.Ticker(ticker)
        news = t.news or []
    except Exception:
        return []

    events = []
    for item in news[:30]:
        content = item.get("content", item)  # yfinance v1.3+ wraps
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

    # Dédup par titre (yfinance renvoie parfois le même article 2x)
    seen = set()
    deduped = []
    for e in events:
        key = e["title"].lower()[:60]
        if key in seen:
            continue
        seen.add(key)
        deduped.append(e)

    # Sort par date desc, garde les N plus récents
    deduped.sort(key=lambda x: x.get("date", ""), reverse=True)
    return deduped[:max_events]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--force", action="store_true", help="Re-fetch même si .events.json récent")
    args = ap.parse_args()

    if not V17.exists():
        print(f"❌ {V17} introuvable", file=sys.stderr)
        sys.exit(1)
    ENR.mkdir(parents=True, exist_ok=True)

    v17 = json.loads(V17.read_text())
    tickers = list(v17.keys())

    pending = []
    for t in tickers:
        out_path = ENR / f"{t.lower()}.events.json"
        if out_path.exists() and not args.force:
            try:
                age = (datetime.now(timezone.utc) - datetime.fromtimestamp(out_path.stat().st_mtime, tz=timezone.utc)).days
                if age < 7:
                    continue
            except Exception:
                pass
        pending.append(t)

    if args.limit:
        pending = pending[: args.limit]
    print(f"📊 Events scraping : {len(pending)} stés à fetcher (sur {len(tickers)} V1.7)")

    written = 0
    empty = 0
    fail = 0
    for i, t in enumerate(pending):
        try:
            events = fetch_events(t)
            if not events:
                empty += 1
                continue
            out_path = ENR / f"{t.lower()}.events.json"
            out_path.write_text(json.dumps({
                "ticker": t,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "events": events,
            }, ensure_ascii=False, indent=2))
            written += 1
        except Exception as e:
            fail += 1
            print(f"  ❌ {t}: {e}", file=sys.stderr)
        if (i + 1) % 25 == 0:
            print(f"  …{i+1}/{len(pending)} (ok={written}, empty={empty}, fail={fail})")
        time.sleep(0.4)  # rate-limit doux yahoo

    print(f"\n✅ {written} fichiers events écrits, {empty} sans événement pertinent, {fail} échecs")


if __name__ == "__main__":
    main()
