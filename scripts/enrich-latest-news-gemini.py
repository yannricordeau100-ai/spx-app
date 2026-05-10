#!/usr/bin/env python3
"""
enrich-latest-news-gemini.py — récupère la dernière actualité par sé et la
résume en 2-3 phrases FR via Gemini 2.5 Flash Lite (gratuit).

RÈGLE ABSOLUE (Yann 10 mai 2026) : NE PAS DÉPASSER les limites du tier
gratuit Gemini. Cap strict :
  - Gemini 2.5 Flash Lite gratuit : 15 RPM, 1500 RPD par clé.
  - Gemini 1.5 Pro gratuit : 2 RPM, 50 RPD par clé (utilisé en fallback
    seulement pour les news complexes).
  - Multi-clés OK via env GEMINI_API_KEYS="key1,key2,..." (rotation).

On RESPECTE :
  - 4.5 sec d'attente minimale entre 2 calls Flash Lite (≤ 13 RPM par clé,
    marge de sécurité).
  - Compteur quotidien persisté dans `~/.spx-app/gemini-quota.json` :
    dès qu'une clé atteint 1450 calls, on l'écarte jusqu'à minuit UTC.
  - Si toutes les clés sont saturées → on s'arrête proprement.

Source des news : yfinance.Ticker(t).news (gratuit, déjà utilisé par
enrich-events-yfinance.py). Filtre sur les 7 derniers jours puis prend la
plus récente. Si aucune news <7j → skip cette sé (on garde l'ancienne news
si elle est récente, sinon le bloc affichera la description).

Output : merge dans `src/data/v2-pipeline-enrich/<ticker>.json` champ
`latest_news: { date, headline, summary, url, source, fetched_at }`.

Usage :
  GEMINI_API_KEYS="..." python3 scripts/enrich-latest-news-gemini.py [--top N] [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENR_DIR = ROOT / "src/data/v2-pipeline-enrich"
V18 = ROOT / "src/data/v1-8-tickers-sorted.json"
QUOTA_FILE = Path.home() / ".spx-app/gemini-quota.json"

# Limites SAFE (en dessous des limites tier gratuit)
RPM_PER_KEY = 13  # < 15 RPM (marge)
RPD_PER_KEY = 1450  # < 1500 RPD (marge)
SECONDS_BETWEEN_CALLS = 60.0 / RPM_PER_KEY  # ~4.6 sec

NEWS_RECENCY_DAYS = 14  # ne traite que les news < 14 jours


def load_quota() -> dict:
    if not QUOTA_FILE.exists():
        return {}
    try:
        return json.loads(QUOTA_FILE.read_text())
    except Exception:
        return {}


def save_quota(q: dict) -> None:
    QUOTA_FILE.parent.mkdir(parents=True, exist_ok=True)
    QUOTA_FILE.write_text(json.dumps(q, indent=2))


def today_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def get_available_key(keys: list[str], quota: dict) -> tuple[str | None, dict]:
    """Renvoie une clé qui n'a pas atteint son cap quotidien, sinon None."""
    today = today_utc()
    # Reset les compteurs des jours précédents
    for k in keys:
        if quota.get(k, {}).get("date") != today:
            quota[k] = {"date": today, "count": 0}
    # Trie par count croissant (round-robin équitable)
    sorted_keys = sorted(keys, key=lambda k: quota[k]["count"])
    for k in sorted_keys:
        if quota[k]["count"] < RPD_PER_KEY:
            return k, quota
    return None, quota


def gemini_summarize(api_key: str, ticker: str, headline: str, body: str) -> str | None:
    """Appel Gemini 2.5 Flash Lite. Renvoie le résumé FR ou None si erreur."""
    import urllib.request
    import urllib.error

    prompt = (
        f"Résume en 2 ou 3 phrases courtes en français cette actualité de "
        f"la société {ticker}, pour un investisseur particulier. Reste "
        f"factuel, pas d'em-dash, pas de superlatifs. Ne pas commencer par "
        f"\"L'entreprise\" ou \"La société\". Headline : {headline}\n\n"
        f"Contenu : {body[:2500]}"
    )
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash-lite:generateContent?key={api_key}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 250},
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        cands = data.get("candidates") or []
        if not cands:
            return None
        parts = cands[0].get("content", {}).get("parts") or []
        if not parts:
            return None
        return str(parts[0].get("text", "")).strip().replace("—", ":")
    except urllib.error.HTTPError as e:
        body_err = e.read().decode("utf-8", errors="ignore")[:300]
        print(f"  ⚠ Gemini HTTP {e.code} : {body_err}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  ⚠ Gemini ERR : {e}", file=sys.stderr)
        return None


def fetch_latest_news(ticker: str) -> dict | None:
    """yfinance.news → news la plus récente < NEWS_RECENCY_DAYS, sinon None."""
    try:
        import yfinance as yf  # type: ignore
    except ImportError:
        print("yfinance manquant : pip install yfinance", file=sys.stderr)
        sys.exit(1)
    try:
        t = yf.Ticker(ticker)
        items = t.news or []
    except Exception as e:
        print(f"  ⚠ yfinance ERR {ticker} : {e}", file=sys.stderr)
        return None
    cutoff = datetime.now(timezone.utc) - timedelta(days=NEWS_RECENCY_DAYS)
    best = None
    best_dt = None
    for it in items:
        # yfinance v0.2+ : structure {"content": {...}, ...} ; older : flat
        content = it.get("content") if isinstance(it, dict) else None
        if isinstance(content, dict):
            ts = content.get("pubDate") or content.get("displayTime")
            headline = content.get("title")
            url = (content.get("canonicalUrl") or {}).get("url") if isinstance(content.get("canonicalUrl"), dict) else None
            summary = content.get("summary") or ""
            provider = (content.get("provider") or {}).get("displayName") if isinstance(content.get("provider"), dict) else None
        else:
            ts = it.get("providerPublishTime") or it.get("publishedAt")
            headline = it.get("title")
            url = it.get("link")
            summary = ""
            provider = it.get("publisher")
        if not headline or not ts:
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
    ap.add_argument("--top", type=int, default=305, help="N premières stés V1.8")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--ticker", help="Forcer un seul ticker")
    args = ap.parse_args()

    keys_raw = os.environ.get("GEMINI_API_KEYS") or os.environ.get("GEMINI_API_KEY") or ""
    keys = [k.strip() for k in keys_raw.split(",") if k.strip()]
    if not keys:
        print("ERR : env GEMINI_API_KEYS ou GEMINI_API_KEY requis (clé Gemini gratuite, https://aistudio.google.com/app/apikey)", file=sys.stderr)
        return 2

    if args.ticker:
        tickers = [args.ticker.upper()]
    else:
        sorted_list = json.loads(V18.read_text())
        tickers = sorted_list[: args.top]

    quota = load_quota()
    last_call_ts = 0.0
    written = 0
    skipped_recent = 0
    skipped_no_news = 0

    for t in tickers:
        out_path = ENR_DIR / f"{t.lower()}.json"
        existing = {}
        if out_path.exists():
            try:
                existing = json.loads(out_path.read_text())
            except Exception:
                existing = {}
        # Skip si on a déjà une news < 24h
        cur = existing.get("latest_news") if isinstance(existing, dict) else None
        if isinstance(cur, dict):
            fetched = cur.get("fetched_at") or ""
            try:
                if fetched and (datetime.now(timezone.utc) - datetime.fromisoformat(fetched.replace("Z", "+00:00"))).total_seconds() < 86400:
                    skipped_recent += 1
                    continue
            except Exception:
                pass

        news = fetch_latest_news(t)
        if not news:
            skipped_no_news += 1
            print(f"  · {t} : pas de news récente", flush=True)
            continue

        # Rate-limit + key rotation
        key, quota = get_available_key(keys, quota)
        if key is None:
            print("⚠ Toutes les clés Gemini saturées pour aujourd'hui. Stop.", flush=True)
            break
        elapsed = time.time() - last_call_ts
        if elapsed < SECONDS_BETWEEN_CALLS:
            time.sleep(SECONDS_BETWEEN_CALLS - elapsed)

        body = news.get("raw_summary") or news.get("headline") or ""
        if args.dry_run:
            summary = f"[dry-run] {body[:200]}"
        else:
            summary = gemini_summarize(key, t, news["headline"], body)
            quota[key]["count"] += 1
            save_quota(quota)
            last_call_ts = time.time()
        if not summary:
            print(f"  ⚠ {t} : Gemini summary fail", flush=True)
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

    print(
        f"\n✅ {written} stés enrichies · {skipped_recent} skip déjà < 24h · {skipped_no_news} pas de news",
        flush=True,
    )
    print(f"Quota Gemini après run : {json.dumps({k: v.get('count') for k, v in quota.items()})}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
