#!/usr/bin/env python3
"""
enrich-latest-news-cerebras.py — récupère la dernière actualité par sé et la
résume en 1 phrase FR avec PV via Cerebras Llama 3.3 70B (free tier).

Source news : yfinance.Ticker(t).news (gratuit). Filtre clickbait + ticker
tangentiel + Cerebras filtre SKIP final.

Cerebras free tier : 30 RPM par clé, ~14 000 RPD. Plus que confortable
pour 305 stés. Multi-clés OK via env CEREBRAS_API_KEY (ou liste séparée
par virgule). Marge de sécurité : 25 RPM = 2.4 sec entre appels.

Output : merge dans `src/data/v2-pipeline-enrich/<ticker>.json` champ
`latest_news: { date, headline, summary, url, source, fetched_at }`.

Usage :
  python3 scripts/enrich-latest-news-cerebras.py [--top N] [--ticker X]
"""
from __future__ import annotations

import argparse
import json
import os
import re
import ssl
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENR_DIR = ROOT / "src/data/v2-pipeline-enrich"
V18 = ROOT / "src/data/v1-8-tickers-sorted.json"

RPM_PER_KEY = 25
SECONDS_BETWEEN_CALLS = 60.0 / RPM_PER_KEY
NEWS_RECENCY_DAYS = 14

CLICKBAIT_PATTERNS = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"\b(10|100|1000)x\b",
        r"\bbuy\s+(area|zone|now|today)\b",
        r"\b(top|best|hot)\s+\d+\s+stocks?\b",
        r"\bstocks?\s+to\s+(buy|watch|own)\b",
        r"\bshould\s+(buy|own|sell|hold)\b",
        r"\bcould\s+(make|10x|double|triple)\b",
        r"\bmillionaire\b",
        r"\bget\s+rich\b",
        r"\bdow\s+jones\s+futures?\b",
        r"\bmarket\s+(today|update|recap|wrap)\b",
        r"\bpre[\-\s]?market\b.*\b(movers?|gainers?|losers?)\b",
        r"\b(gainers?|losers?)\s+today\b",
        r"^\s*\d+\s+reasons?\b",
        r"\bwall\s+street\s+(thinks?|says?|forecasts?)\b",
    ]
]

try:
    import certifi
    _SSL = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _SSL = ssl.create_default_context()


def is_clickbait(headline: str) -> bool:
    return any(p.search(headline) for p in CLICKBAIT_PATTERNS)


def cerebras_summarize(api_key: str, ticker: str, headline: str, body: str) -> str | None:
    """Cerebras chat completion. Renvoie résumé FR ou None ou 'SKIP'."""
    import urllib.request
    import urllib.error

    prompt = (
        f"Tu écris pour un investisseur français qui veut comprendre en 5 secondes l'intérêt d'une news.\n\n"
        f"NEWS supposée sur {ticker} :\n"
        f"Titre : {headline}\n"
        f"Contenu : {body[:2500]}\n\n"
        f"CONSIGNES STRICTES :\n"
        f"- 1 seule phrase, 25 mots maximum.\n"
        f"- Donne le signal, le chiffre clé, ou la conséquence pour {ticker} en particulier.\n"
        f"- Ne répète pas le titre, apporte une info en plus.\n"
        f"- Pas de \"L'entreprise\", pas de \"La société\", pas d'em-dash, pas de \"potentiellement\".\n\n"
        f"FILTRE QUALITÉ : réponds exactement SKIP (rien d'autre) si :\n"
        f"- La news n'est PAS spécifiquement sur {ticker} (mention de passage, liste générale).\n"
        f"- C'est du clickbait, opinion analyste sans nouveau fait corporate.\n"
        f"- Annonce marketing flou, sponsoring, nomination junior.\n\n"
        f"Résumé (ou SKIP) :"
    )
    # llama3.1-8b : seul modèle Cerebras dispo + jamais "queue_exceeded"
    # comme qwen-3-235b. Petit mais largement suffisant pour 1 phrase de
    # résumé. Free tier illimité côté quota Yann.
    payload = {
        "model": "llama3.1-8b",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
        "max_tokens": 200,
    }
    # Cloudflare devant Cerebras bloque les User-Agent par défaut Python
    # (1010 challenge). On envoie un UA browser-like pour passer.
    req = urllib.request.Request(
        "https://api.cerebras.ai/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30, context=_SSL) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        choices = data.get("choices") or []
        if not choices:
            return None
        return str(choices[0].get("message", {}).get("content", "")).strip().replace("—", ":")
    except urllib.error.HTTPError as e:
        body_err = e.read().decode("utf-8", errors="ignore")[:300]
        if e.code == 429:
            time.sleep(20)
            try:
                with urllib.request.urlopen(req, timeout=30, context=_SSL) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                choices = data.get("choices") or []
                if choices:
                    return str(choices[0].get("message", {}).get("content", "")).strip().replace("—", ":")
            except Exception:
                pass
        print(f"  ⚠ Cerebras HTTP {e.code} : {body_err}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  ⚠ Cerebras ERR : {e}", file=sys.stderr)
        return None


def fetch_latest_news(ticker: str) -> dict | None:
    try:
        import yfinance as yf
    except ImportError:
        print("yfinance manquant", file=sys.stderr)
        sys.exit(1)
    try:
        items = yf.Ticker(ticker).news or []
    except Exception as e:
        print(f"  ⚠ yfinance ERR {ticker} : {e}", file=sys.stderr)
        return None
    cutoff = datetime.now(timezone.utc) - timedelta(days=NEWS_RECENCY_DAYS)
    best = None
    best_dt = None
    tu = ticker.upper()
    for it in items:
        content = it.get("content") if isinstance(it, dict) else None
        if isinstance(content, dict):
            ts = content.get("pubDate") or content.get("displayTime")
            headline = content.get("title")
            url = (content.get("canonicalUrl") or {}).get("url") if isinstance(content.get("canonicalUrl"), dict) else None
            summary = content.get("summary") or ""
            provider = (content.get("provider") or {}).get("displayName") if isinstance(content.get("provider"), dict) else None
            related = content.get("finance", {}).get("stockTickers") if isinstance(content.get("finance"), dict) else None
            if not isinstance(related, list):
                related = []
        else:
            ts = it.get("providerPublishTime") or it.get("publishedAt")
            headline = it.get("title")
            url = it.get("link")
            summary = ""
            provider = it.get("publisher")
            related = it.get("relatedTickers") or []
        if not headline or not ts:
            continue
        related_syms = []
        for r in related if isinstance(related, list) else []:
            if isinstance(r, dict):
                sym = r.get("symbol") or r.get("ticker") or ""
            else:
                sym = str(r)
            if sym:
                related_syms.append(sym.upper())
        if related_syms and tu not in related_syms[:3]:
            continue
        if related_syms and len(related_syms) > 6:
            continue
        if is_clickbait(headline):
            continue
        try:
            if isinstance(ts, (int, float)):
                dt = datetime.fromtimestamp(int(ts), tz=timezone.utc)
            else:
                dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        except Exception:
            continue
        if dt < cutoff:
            continue
        if best_dt is None or dt > best_dt:
            best = {
                "date": dt.strftime("%Y-%m-%d"),
                "headline": headline,
                "url": url,
                "source": provider,
                "raw_summary": summary,
            }
            best_dt = dt
    return best


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=305)
    ap.add_argument("--ticker", help="Forcer un seul ticker")
    args = ap.parse_args()

    keys_raw = os.environ.get("CEREBRAS_API_KEY", "")
    keys = [k.strip() for k in keys_raw.split(",") if k.strip()]
    if not keys:
        print("ERR : CEREBRAS_API_KEY requis dans .env.local", file=sys.stderr)
        return 2

    if args.ticker:
        tickers = [args.ticker.upper()]
    else:
        tickers = json.loads(V18.read_text())[: args.top]

    last_call_ts = 0.0
    written = 0
    skipped = 0
    no_news = 0
    key_idx = 0

    for t in tickers:
        out_path = ENR_DIR / f"{t.lower()}.json"
        existing = json.loads(out_path.read_text()) if out_path.exists() else {}
        cur = existing.get("latest_news") if isinstance(existing, dict) else None
        if isinstance(cur, dict):
            fetched = cur.get("fetched_at") or ""
            try:
                if fetched and (datetime.now(timezone.utc) - datetime.fromisoformat(fetched.replace("Z", "+00:00"))).total_seconds() < 86400:
                    print(f"  · {t} : déjà < 24h, skip", flush=True)
                    continue
            except Exception:
                pass

        news = fetch_latest_news(t)
        if not news:
            no_news += 1
            print(f"  · {t} : pas de news qualifiée", flush=True)
            continue

        elapsed = time.time() - last_call_ts
        if elapsed < SECONDS_BETWEEN_CALLS:
            time.sleep(SECONDS_BETWEEN_CALLS - elapsed)
        key = keys[key_idx % len(keys)]
        key_idx += 1

        body = news.get("raw_summary") or news.get("headline") or ""
        summary = cerebras_summarize(key, t, news["headline"], body)
        last_call_ts = time.time()
        if not summary:
            print(f"  ⚠ {t} : Cerebras fail", flush=True)
            continue
        if summary.upper().startswith("SKIP"):
            skipped += 1
            print(f"  · {t} : sans PV (skip)", flush=True)
            continue

        existing["ticker"] = t
        existing["latest_news"] = {
            "date": news["date"],
            "headline": news["headline"],
            "summary": summary,
            "url": news.get("url"),
            "source": news.get("source"),
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(existing, indent=2, ensure_ascii=False))
        written += 1
        print(f"  ✓ {t} : {news['date']} · {news['headline'][:60]}", flush=True)

    print(f"\n✅ {written} écrites · {skipped} skip PV · {no_news} pas de news qualifiée", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
