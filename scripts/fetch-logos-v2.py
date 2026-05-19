#!/usr/bin/env python3
"""
fetch-logos-v2.py · CONV-MODULE-LOGOS-V175

Récupère un meilleur logo pour chaque ticker depuis sources gratuites :
  1. yfinance → domain officiel
  2. Wikidata P154 → logo SVG/PNG officiel (priorité)
  3. og:image scraping si path contient "logo"
  4. apple-touch-icon comme fallback

Compare au logo existant via pHash (perceptual hash) + taille fichier.
Replace si :
  - L'ancien fait < 5 KB ET le nouveau fait > 5 KB
  - OU pHash distance > 20 ET nouveau > 8 KB

Sortie :
  public/logos/<TICKER>.png         → logo final
  public/logos/.backup/<TICKER>.png → ancien sauvé
  src/data/logos-replacement-log.json → audit trail

Usage :
  python3 scripts/fetch-logos-v2.py --tickers 307     # top 307 V1.8
  python3 scripts/fetch-logos-v2.py --tickers all     # union 985
  python3 scripts/fetch-logos-v2.py --tickers TTE.PA  # 1 ticker
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.parse
from io import BytesIO
from pathlib import Path

import imagehash
import requests
import yfinance as yf
from bs4 import BeautifulSoup
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LOGOS_DIR = ROOT / "public" / "logos"
BACKUP_DIR = LOGOS_DIR / ".backup"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)
LOG_PATH = ROOT / "src" / "data" / "logos-replacement-log.json"
CACHE_DIR = ROOT / "src" / "data" / ".cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
YF_CACHE = CACHE_DIR / "yf-domains.json"
WD_CACHE = CACHE_DIR / "wikidata-q.json"

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Mettrik-Logo-Fetch/1.0"}
TIMEOUT = 15
MIN_GOOD_SIZE = 5000  # bytes
MIN_GOOD_DIM = 128

# Session HTTP réutilisable (connection pooling, gain perf)
SESSION = requests.Session()
SESSION.headers.update(HEADERS)

# Cache mémoire (chargés depuis disque au démarrage)
_yf_cache: dict[str, str | None] = {}
_wd_cache: dict[str, str | None] = {}
_rate_limit_pause = 0.0  # secondes additionnelles si rate limit détecté


def load_caches():
    global _yf_cache, _wd_cache
    if YF_CACHE.exists():
        try:
            _yf_cache = json.loads(YF_CACHE.read_text())
        except Exception:
            _yf_cache = {}
    if WD_CACHE.exists():
        try:
            _wd_cache = json.loads(WD_CACHE.read_text())
        except Exception:
            _wd_cache = {}


def save_caches():
    YF_CACHE.write_text(json.dumps(_yf_cache, indent=2))
    WD_CACHE.write_text(json.dumps(_wd_cache, indent=2))


def ticker_to_filename(ticker: str) -> str:
    return ticker.replace(".", "-") + ".png"


def load_union_tickers():
    v17 = json.loads((ROOT / "src/data/v1-7-tickers-sorted.json").read_text())
    v18 = json.loads((ROOT / "src/data/v1-8-tickers-sorted.json").read_text())
    v175 = list(json.loads((ROOT / "src/data/v1-7-5-public.json").read_text()).keys())
    return v17, v18, v175, sorted(set(v17) | set(v18) | set(v175))


def get_yf_website(ticker: str) -> str | None:
    global _rate_limit_pause
    # Cache hit (incluant cache de None pour éviter retries)
    if ticker in _yf_cache:
        return _yf_cache[ticker]
    # Backoff exponential si rate limit détecté précédemment
    if _rate_limit_pause > 0:
        time.sleep(_rate_limit_pause)
    try:
        info = yf.Ticker(ticker).info
        if not info or not isinstance(info, dict):
            _yf_cache[ticker] = None
            return None
        url = info.get("website") or info.get("websiteUrl")
        result = url.rstrip("/") if (url and isinstance(url, str)) else None
        _yf_cache[ticker] = result
        # Succès : réduit la pause progressivement
        if _rate_limit_pause > 0:
            _rate_limit_pause = max(0, _rate_limit_pause - 1)
        return result
    except Exception as e:
        msg = str(e).lower()
        if "too many requests" in msg or "rate" in msg or "429" in msg:
            _rate_limit_pause = min(30, _rate_limit_pause * 2 + 2)  # 2, 6, 14, 30 max
        # Ne pas cache les errors (peut retry après backoff)
        return None


def fetch_image(url: str) -> bytes | None:
    try:
        r = SESSION.get(url, timeout=TIMEOUT, allow_redirects=True)
        if r.status_code == 200 and len(r.content) > 200:
            ctype = r.headers.get("Content-Type", "").lower()
            if "image" in ctype or url.lower().endswith((".png", ".jpg", ".jpeg", ".svg", ".webp")):
                return r.content
    except Exception:
        pass
    return None


def try_wikidata(ticker: str, name: str) -> bytes | None:
    """Cherche le ticker dans Wikidata, récupère property P154 (logo)."""
    try:
        # Search by name
        q = urllib.parse.quote(name)
        r = SESSION.get(
            f"https://www.wikidata.org/w/api.php?action=wbsearchentities&search={q}&language=en&format=json&type=item",
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        if r.status_code != 200:
            return None
        results = r.json().get("search", [])
        if not results:
            return None
        # Take first match (best heuristic for now)
        qid = results[0]["id"]
        # Get logo claim
        r2 = requests.get(
            f"https://www.wikidata.org/w/api.php?action=wbgetentities&ids={qid}&props=claims&format=json",
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        if r2.status_code != 200:
            return None
        claims = r2.json()["entities"][qid].get("claims", {})
        if "P154" not in claims:
            return None
        logo_file = claims["P154"][0]["mainsnak"]["datavalue"]["value"]
        # Download from Commons (Special:FilePath redirects to actual file)
        url = f"https://commons.wikimedia.org/wiki/Special:FilePath/{urllib.parse.quote(logo_file)}?width=512"
        return fetch_image(url)
    except Exception:
        return None


def try_og_image(domain_url: str) -> bytes | None:
    """Scrape la home page, prend og:image si path contient 'logo' ou apple-touch-icon."""
    try:
        r = SESSION.get(domain_url, headers=HEADERS, timeout=TIMEOUT)
        if r.status_code != 200:
            return None
        soup = BeautifulSoup(r.text, "html.parser")
        # 1. apple-touch-icon (best for logo)
        for link in soup.find_all("link", rel=re.compile(r"apple-touch-icon", re.I)):
            href = link.get("href")
            if href:
                full_url = urllib.parse.urljoin(domain_url, href)
                img = fetch_image(full_url)
                if img and len(img) > MIN_GOOD_SIZE:
                    return img
        # 2. og:image si nom contient logo/brand
        og = soup.find("meta", property="og:image")
        if og and og.get("content"):
            href = og["content"]
            if re.search(r"logo|brand|wordmark", href, re.I):
                full_url = urllib.parse.urljoin(domain_url, href)
                img = fetch_image(full_url)
                if img:
                    return img
        # 3. link rel=icon (taille >= 192)
        for link in soup.find_all("link", rel=re.compile(r"^(icon|shortcut icon)$", re.I)):
            sizes = link.get("sizes", "")
            if sizes and any(int(s.split("x")[0]) >= 128 for s in sizes.split() if "x" in s and s.split("x")[0].isdigit()):
                href = link.get("href")
                if href:
                    full_url = urllib.parse.urljoin(domain_url, href)
                    img = fetch_image(full_url)
                    if img and len(img) > 2000:
                        return img
    except Exception:
        pass
    return None


def image_quality_score(img_bytes: bytes) -> dict | None:
    """Renvoie {size, width, height, phash} ou None si invalide."""
    try:
        im = Image.open(BytesIO(img_bytes))
        if im.mode in ("RGBA", "LA", "P"):
            im2 = im.convert("RGB")
        else:
            im2 = im
        ph = str(imagehash.phash(im2))
        return {"size": len(img_bytes), "width": im.width, "height": im.height, "phash": ph}
    except Exception:
        return None


def to_png_512(img_bytes: bytes) -> bytes | None:
    """Convert PNG/JPG/WEBP/SVG to PNG 512px max side."""
    # Détection SVG (texte XML qui commence par <svg ou <?xml)
    head = img_bytes[:200].lower()
    if b"<svg" in head or (b"<?xml" in head and b"svg" in img_bytes[:500].lower()):
        try:
            import cairosvg
            img_bytes = cairosvg.svg2png(bytestring=img_bytes, output_width=512)
        except Exception:
            return None
    try:
        im = Image.open(BytesIO(img_bytes))
        if im.mode != "RGBA":
            im = im.convert("RGBA")
        # Resize to 512 max side, keep ratio
        max_side = 512
        if max(im.size) > max_side:
            scale = max_side / max(im.size)
            new_size = (int(im.width * scale), int(im.height * scale))
            im = im.resize(new_size, Image.LANCZOS)
        out = BytesIO()
        im.save(out, format="PNG", optimize=True)
        return out.getvalue()
    except Exception:
        return None


def should_replace(old_info: dict | None, new_info: dict) -> tuple[bool, str]:
    if not old_info:
        return True, "no_old"
    # Si nouveau est nettement plus gros et meilleurs dims
    if new_info["size"] > old_info["size"] * 2 and new_info["width"] >= MIN_GOOD_DIM:
        return True, f"size 2x+ ({old_info['size']}→{new_info['size']})"
    # Si ancien est tiny et nouveau est bon
    if old_info["size"] < 5000 and new_info["size"] >= 8000 and new_info["width"] >= MIN_GOOD_DIM:
        return True, f"tiny→good ({old_info['size']}B→{new_info['size']}B)"
    # Si phash distance grosse + nouveau est bien
    try:
        d = imagehash.hex_to_hash(old_info["phash"]) - imagehash.hex_to_hash(new_info["phash"])
        if d > 20 and new_info["size"] > 8000:
            return True, f"phash diff ({d})"
    except Exception:
        pass
    return False, "no_improvement"


def process_ticker(ticker: str, name_map: dict) -> dict:
    log = {"ticker": ticker, "action": "skip", "reason": "", "old": None, "new": None, "source": None}
    fname = ticker_to_filename(ticker)
    existing_path = LOGOS_DIR / fname

    old_info = None
    if existing_path.exists():
        old_bytes = existing_path.read_bytes()
        old_info = image_quality_score(old_bytes)
        log["old"] = old_info

    # Get domain
    website = get_yf_website(ticker)
    log["website"] = website
    if not website:
        log["reason"] = "no_yf_website"
        return log

    name = name_map.get(ticker, ticker)

    # Try Wikidata first (most reliable)
    candidate = try_wikidata(ticker, name)
    source = "wikidata" if candidate else None

    # Then og:image / apple-touch-icon
    if not candidate or len(candidate) < MIN_GOOD_SIZE:
        c2 = try_og_image(website)
        if c2 and (not candidate or len(c2) > len(candidate)):
            candidate = c2
            source = "scrape"

    if not candidate:
        log["reason"] = "no_candidate"
        return log

    # Normalize to PNG 512
    png = to_png_512(candidate)
    if not png:
        log["reason"] = "convert_fail"
        return log

    new_info = image_quality_score(png)
    if not new_info:
        log["reason"] = "invalid_image"
        return log
    log["new"] = new_info
    log["source"] = source

    do, reason = should_replace(old_info, new_info)
    if not do:
        log["reason"] = reason
        return log

    # Backup old + replace
    if existing_path.exists():
        backup_path = BACKUP_DIR / fname
        if not backup_path.exists():
            backup_path.write_bytes(existing_path.read_bytes())
    existing_path.write_bytes(png)
    log["action"] = "replaced"
    log["reason"] = reason
    return log


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--tickers", default="307", help="307 | 1500 | 600 | all | <ticker,ticker>")
    p.add_argument("--limit", type=int, default=0, help="cap number")
    p.add_argument("--throttle", type=float, default=0.8, help="seconds between tickers")
    p.add_argument("--retry-failed", action="store_true", help="retry only tickers not yet replaced")
    args = p.parse_args()

    v17, v18, v175, union = load_union_tickers()

    if args.tickers == "307":
        targets = v18[:307]
        label = "top 307 V1.8"
    elif args.tickers == "all":
        targets = union
        label = "union 985"
    elif args.tickers == "merged":
        merged_all = json.loads((ROOT / "src/data/v2-pipeline/_merged.json").read_text())
        targets = sorted(merged_all.keys())
        label = f"merged {len(targets)}"
    elif "," in args.tickers or len(args.tickers) <= 12:
        targets = args.tickers.split(",") if "," in args.tickers else [args.tickers]
        label = f"custom {len(targets)}"
    else:
        targets = v18[:307]
        label = "top 307 V1.8 (default)"

    if args.retry_failed and LOG_PATH.exists():
        prev = json.loads(LOG_PATH.read_text()).get("logs", [])
        replaced_set = {l["ticker"] for l in prev if l.get("action") == "replaced"}
        targets = [t for t in targets if t not in replaced_set]
        label += f" retry-failed ({len(targets)} not yet replaced)"

    if args.limit:
        targets = targets[: args.limit]

    # Name map (best effort)
    name_map = {}
    try:
        merged = json.loads((ROOT / "src/data/v2-pipeline/_merged.json").read_text())
        for t, v in merged.items():
            if isinstance(v, dict) and v.get("name"):
                name_map[t] = v["name"]
    except Exception:
        pass

    load_caches()
    print(f"[fetch-logos] {len(targets)} tickers, {label}, throttle={args.throttle}s, yf-cache={len(_yf_cache)}, wd-cache={len(_wd_cache)}")

    # Load existing log (resume support)
    existing_logs = []
    done_set = set()
    if LOG_PATH.exists():
        try:
            existing = json.loads(LOG_PATH.read_text())
            existing_logs = existing.get("logs", [])
            done_set = {l["ticker"] for l in existing_logs if l.get("action") == "replaced"}
            # En mode retry-failed, on garde uniquement les entries replaced (les autres seront retentées)
            if args.retry_failed:
                existing_logs = [l for l in existing_logs if l.get("action") == "replaced"]
        except Exception:
            pass

    new_logs = []
    counts = {"replaced": 0, "skip": 0, "error": 0}
    for i, t in enumerate(targets, 1):
        if t in done_set:
            counts["skip"] += 1
            continue
        try:
            log = process_ticker(t, name_map)
            new_logs.append(log)
            counts[log["action"] if log["action"] in counts else "skip"] += 1
            if log["action"] == "replaced":
                print(f"  [{i}/{len(targets)}] {t:14s} ✅ replaced  src={log.get('source')}  {log.get('old', {}).get('size', 0)}→{log['new']['size']}B  {log.get('reason', '')}")
            elif i % 20 == 0 or log["reason"] in ("no_yf_website", "no_candidate"):
                print(f"  [{i}/{len(targets)}] {t:14s} ⏭  skip  {log.get('reason', '')}")
        except Exception as e:
            counts["error"] += 1
            new_logs.append({"ticker": t, "action": "error", "reason": str(e)[:120]})
            print(f"  [{i}/{len(targets)}] {t:14s} ❌ {e}")
        time.sleep(args.throttle)
        # Sauvegarde des caches toutes les 50 stés (résilience crash)
        if i % 50 == 0:
            save_caches()
            LOG_PATH.write_text(json.dumps({"generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "logs": existing_logs + new_logs}, indent=2))

    save_caches()

    # Save log
    all_logs = existing_logs + new_logs
    LOG_PATH.write_text(json.dumps({"generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "logs": all_logs}, indent=2))
    print(f"\n=== RÉCAP {label} ===")
    print(f"  replaced : {counts['replaced']}")
    print(f"  skip     : {counts['skip']}")
    print(f"  error    : {counts['error']}")
    print(f"\nLog : {LOG_PATH}")


if __name__ == "__main__":
    main()
