#!/usr/bin/env python3
"""
image-findings-autorun.py V2 — Orchestrateur autonome scraping multi-sources
pour demandes "Graphiques et Schémas de sources diverses" Mettrik AI.

ZÉRO coût API : Gemini 2.5 Flash free tier (1500 req/jour) pour orchestration
+ scraping HTTP direct (DuckDuckGo HTML, Reddit JSON, Nitter, etc.).

Sources implémentées V2 (7/9) :
    - web         : DuckDuckGo HTML + Gemini filter
    - x_anon      : Nitter (rotation 3 instances + skip si down)
    - reddit      : Reddit JSON public
    - substack    : DuckDuckGo site:substack.com + whitelist auteurs
    - ddg_images  : DuckDuckGo Images
    - huggingface : API papers + search
    - high_rep    : Allowlist domaines réputés
Reportées V3 :
    - company_docs : parsing PDF lourd (placeholder log)
    - x_authed     : Chrome MCP manuel (skip)

Usage :
    python3 scripts/image-findings-autorun.py --request-id <UUID>
    python3 scripts/image-findings-autorun.py --all-pending
    python3 scripts/image-findings-autorun.py --request-id <UUID> --dry-run
"""
import argparse
import json
import os
import re
import sys
import time
import traceback
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

import requests

# google-generativeai optional (free tier)
try:
    import google.generativeai as genai
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False

# BeautifulSoup optional
try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False

# ---------- Setup ----------

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if not SUPABASE_URL or not SERVICE_KEY:
    print("ERREUR: SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis", file=sys.stderr)
    sys.exit(1)

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"

HTTP_HEADERS = {"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"}

REPO_ROOT = Path(__file__).resolve().parent.parent
FINDINGS_DIR = REPO_ROOT / "public" / "findings"

SOURCES = ["web", "x_anon", "reddit", "substack", "ddg_images", "huggingface", "company_docs", "high_rep"]
# x_authed skip (Chrome MCP manuel only)

SUBSTACK_WHITELIST = [
    "semianalysis", "stratechery", "fabricatedknowledge", "mulesmusings",
    "thediff", "doomberg", "noahpinion", "matthewball", "ben-evans",
    "axios", "platformer",
]

HIGH_REP_DOMAINS = [
    "semiwiki.com", "spectrum.ieee.org", "bloomberg.com", "reuters.com",
    "ft.com", "asia.nikkei.com", "theinformation.com", "wsj.com",
    "economist.com", "ft.com",
]

NITTER_INSTANCES = [
    "nitter.net", "nitter.privacydev.net", "nitter.cz",
    "nitter.poast.org", "nitter.unixfox.eu",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def log(msg: str):
    print(msg, flush=True)


# ---------- Gemini ----------

_gemini_model = None
_gemini_last_call = 0.0


def get_gemini():
    """Lazy init Gemini 2.5 Flash."""
    global _gemini_model
    if _gemini_model is not None:
        return _gemini_model
    if not HAS_GEMINI or not GEMINI_API_KEY:
        return None
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        _gemini_model = genai.GenerativeModel("gemini-2.5-flash")
        return _gemini_model
    except Exception as e:
        log(f"    [gemini] init fail: {e}")
        return None


def gemini_call(prompt: str, timeout_s: float = 30) -> str | None:
    """Throttled Gemini call. Free tier ~15 req/sec. Returns text or None."""
    global _gemini_last_call
    model = get_gemini()
    if not model:
        return None
    # Throttle 1s between calls (very conservative vs 15/sec limit)
    elapsed = time.time() - _gemini_last_call
    if elapsed < 1.0:
        time.sleep(1.0 - elapsed)
    try:
        response = model.generate_content(prompt)
        _gemini_last_call = time.time()
        return (response.text or "").strip()
    except Exception as e:
        log(f"    [gemini] call fail: {str(e)[:120]}")
        _gemini_last_call = time.time()
        return None


def gemini_judge_pertinent(url: str, title: str, snippet: str, query: str) -> tuple[bool, str]:
    """Ask Gemini if this URL/snippet looks like a data-driven chart on the query."""
    prompt = (
        f"You are an expert curator for an investor app. Given this URL and snippet, "
        f'decide if it likely contains a real data-driven chart/graph (not a cover slide, '
        f'photo, logo, meme) about the query "{query}".\n\n'
        f"URL: {url}\nTitle: {title}\nSnippet: {snippet[:400]}\n\n"
        f'Respond with strict JSON only: {{"pertinent": true|false, "reason": "<15 words max>"}}'
    )
    txt = gemini_call(prompt)
    if not txt:
        # Sans Gemini → heuristique conservatrice : on accepte si chart/graph mots-clés
        kw = (title + " " + snippet).lower()
        if any(w in kw for w in ["chart", "graph", "evolution", "market share", "trend", "data"]):
            return True, "heuristic: chart keyword found"
        return False, "no Gemini, no kw"
    # Parse JSON
    try:
        m = re.search(r'\{.*?\}', txt, re.DOTALL)
        if m:
            data = json.loads(m.group(0))
            return bool(data.get("pertinent")), str(data.get("reason", ""))[:120]
    except Exception:
        pass
    return False, f"parse fail: {txt[:80]}"


def gemini_translate(text_en: str) -> dict:
    """Translate EN to FR+DE via Gemini. Returns {'fr':..., 'de':...} or fallback EN."""
    if not text_en:
        return {"fr": text_en, "de": text_en}
    prompt = (
        f"Translate this English business chart title to French and German. "
        f"Keep it concise and professional.\n\nEN: {text_en}\n\n"
        f'Respond with strict JSON only: {{"fr": "...", "de": "..."}}'
    )
    txt = gemini_call(prompt)
    if not txt:
        return {"fr": text_en, "de": text_en}
    try:
        m = re.search(r'\{.*?\}', txt, re.DOTALL)
        if m:
            data = json.loads(m.group(0))
            return {"fr": data.get("fr", text_en), "de": data.get("de", text_en)}
    except Exception:
        pass
    return {"fr": text_en, "de": text_en}


# ---------- Supabase ----------

def fetch_pending_requests() -> list:
    url = f"{SUPABASE_URL}/rest/v1/desk_image_findings_requests"
    params = {
        "select": "id,display_number,title,query,target_tickers,languages,status",
        "status": "in.(claude_pending,in_progress)",
        "order": "display_number.asc",
    }
    r = requests.get(url, headers=HEADERS, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def fetch_request_by_id(request_id: str) -> dict | None:
    url = f"{SUPABASE_URL}/rest/v1/desk_image_findings_requests"
    params = {
        "select": "id,display_number,title,query,target_tickers,languages,status",
        "id": f"eq.{request_id}",
    }
    r = requests.get(url, headers=HEADERS, params=params, timeout=30)
    r.raise_for_status()
    rows = r.json()
    return rows[0] if rows else None


def update_request(request_id: str, patch: dict):
    url = f"{SUPABASE_URL}/rest/v1/desk_image_findings_requests"
    params = {"id": f"eq.{request_id}"}
    r = requests.patch(url, headers=HEADERS, params=params, json=patch, timeout=30)
    if not r.ok:
        log(f"    [warn] update request fail HTTP {r.status_code} {r.text[:200]}")


def insert_finding(finding: dict, dry_run: bool = False) -> bool:
    if dry_run:
        log(f"    [dry-run] would insert: {finding.get('title')[:80]}")
        return True
    url = f"{SUPABASE_URL}/rest/v1/desk_image_findings"
    r = requests.post(url, headers=HEADERS, json=finding, timeout=30)
    if not r.ok:
        log(f"    [warn] insert fail HTTP {r.status_code} {r.text[:200]}")
        return False
    return True


# ---------- HTTP helpers ----------

def http_get(url: str, timeout: int = 15, **kwargs) -> requests.Response | None:
    try:
        return requests.get(url, headers=HTTP_HEADERS, timeout=timeout, **kwargs)
    except Exception as e:
        log(f"    [http] fail {url[:80]} → {type(e).__name__}: {str(e)[:80]}")
        return None


def ddg_html_search(query: str, max_results: int = 10) -> list[dict]:
    """DuckDuckGo HTML search. Returns [{url, title, snippet}]."""
    if not HAS_BS4:
        return []
    q = urllib.parse.quote_plus(query)
    url = f"https://html.duckduckgo.com/html/?q={q}"
    r = http_get(url, timeout=20)
    if not r or not r.ok:
        return []
    soup = BeautifulSoup(r.text, "html.parser" if "lxml" not in sys.modules else "lxml")
    results = []
    for div in soup.select("div.result")[:max_results]:
        a = div.select_one("a.result__a")
        snip = div.select_one("a.result__snippet")
        if not a:
            continue
        href = a.get("href", "")
        # DDG wraps results with redirect → extract uddg param if present
        if "uddg=" in href:
            try:
                href = urllib.parse.unquote(href.split("uddg=")[1].split("&")[0])
            except Exception:
                pass
        results.append({
            "url": href,
            "title": a.get_text(strip=True),
            "snippet": snip.get_text(strip=True) if snip else "",
        })
    return results


# ---------- SVG generation ----------

def make_placeholder_svg(title: str, source: str, source_url: str, theme: str = "dark") -> str:
    """Minimal placeholder SVG EN-canonical. Real V2.5 = parse source image and reconstruct."""
    bg = "#0a0a0e" if theme == "dark" else "#fafafa"
    fg = "#fafafa" if theme == "dark" else "#0a0a0e"
    sub = "#888"
    accent = "#a78bfa"

    title_safe = (title or "Untitled")[:80].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    source_safe = (source or "")[:60].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" font-family="ui-sans-serif, system-ui">
<rect width="800" height="450" fill="{bg}"/>
<text x="40" y="40" fill="{fg}" font-size="18" font-weight="700">{title_safe}</text>
<text x="40" y="64" fill="{sub}" font-size="12">Source: {source_safe}</text>
<rect x="40" y="100" width="720" height="300" fill="none" stroke="{accent}" stroke-width="1" stroke-dasharray="4 3" rx="6"/>
<text x="400" y="240" fill="{accent}" font-size="14" text-anchor="middle">Chart placeholder (V2 autorun)</text>
<text x="400" y="262" fill="{sub}" font-size="11" text-anchor="middle">SVG reconstruction in V3</text>
<text x="40" y="430" fill="{sub}" font-size="10">Mettrik AI · autonomous scraping</text>
</svg>'''
    return svg


def validate_svg(svg_content: str) -> bool:
    """Minimal SVG validation: try xmllint if available, else basic check."""
    import subprocess
    try:
        result = subprocess.run(
            ["xmllint", "--noout", "-"],
            input=svg_content, capture_output=True, text=True, timeout=10,
        )
        return result.returncode == 0
    except Exception:
        # Fallback: very basic
        return svg_content.strip().startswith("<svg") and svg_content.strip().endswith("</svg>")


def write_svg(request_n: int, slug: str, idx: int, theme: str, svg_content: str) -> str | None:
    """Write SVG to disk. Returns local path or None on failure."""
    folder = FINDINGS_DIR / f"demande-{request_n}"
    folder.mkdir(parents=True, exist_ok=True)
    fname = f"autorun-{slug}-{idx:02d}-{theme}.svg"
    path = folder / fname
    try:
        path.write_text(svg_content, encoding="utf-8")
        return f"/findings/demande-{request_n}/{fname}"
    except Exception as e:
        log(f"    [svg] write fail: {e}")
        return None


# ---------- Sources ----------

def scrape_web(query: str, tickers: list) -> list[dict]:
    """DDG general search + Gemini filter."""
    log(f"    [web] DDG search for chart on '{query}'")
    results = ddg_html_search(f"{query} chart", max_results=10)
    findings = []
    for r in results[:8]:
        time.sleep(0.5)
        pertinent, reason = gemini_judge_pertinent(r["url"], r["title"], r["snippet"], query)
        if not pertinent:
            continue
        findings.append({
            "image_url": r["url"],  # source page URL (no specific image extraction in V2)
            "source_url": r["url"],
            "source_author": urllib.parse.urlparse(r["url"]).netloc,
            "source_date": None,
            "title_en": r["title"][:200],
            "summary_en": (r["snippet"] or "")[:400],
            "suggested_kpi_topics": [],
        })
        if len(findings) >= 5:
            break
    log(f"    [web] {len(findings)} findings retained")
    return findings


def scrape_x_anon(query: str, tickers: list) -> list[dict]:
    """Nitter scraping with instance rotation."""
    if not HAS_BS4:
        return []
    q = urllib.parse.quote_plus(query)
    for instance in NITTER_INSTANCES:
        url = f"https://{instance}/search?q={q}&f=tweets"
        log(f"    [x_anon] trying {instance}")
        r = http_get(url, timeout=12)
        if not r or not r.ok:
            time.sleep(1)
            continue
        soup = BeautifulSoup(r.text, "html.parser")
        items = soup.select(".timeline-item")[:10]
        if not items:
            continue
        findings = []
        for item in items:
            link = item.select_one("a.tweet-link")
            text = item.select_one(".tweet-content")
            user = item.select_one(".username")
            img = item.select_one(".attachment.image img")
            if not link or not img:
                continue
            tweet_url = f"https://{instance}{link.get('href', '')}"
            img_url = img.get("src", "")
            if img_url.startswith("/"):
                img_url = f"https://{instance}{img_url}"
            findings.append({
                "image_url": img_url,
                "source_url": tweet_url,
                "source_author": user.get_text(strip=True) if user else "x_anon",
                "source_date": None,
                "title_en": (text.get_text(strip=True) if text else query)[:200],
                "summary_en": (text.get_text(strip=True) if text else "")[:400],
                "suggested_kpi_topics": [],
            })
        log(f"    [x_anon] {instance} → {len(findings)} candidates")
        return findings[:5]
    log(f"    [x_anon] all Nitter instances down, skip")
    return []


def scrape_reddit(query: str, tickers: list) -> list[dict]:
    """Reddit public JSON. Pick general subs."""
    subs = ["investing", "stocks", "wallstreetbets", "SecurityAnalysis"]
    # Optional sector-specific by detecting tickers
    q_lower = query.lower()
    if any(w in q_lower for w in ["semi", "chip", "tsm", "amd", "nvda", "asml"]):
        subs += ["semiconductors", "hardware"]
    findings = []
    for sub in subs[:3]:
        q = urllib.parse.quote_plus(query)
        url = f"https://www.reddit.com/r/{sub}/search.json?q={q}&sort=top&t=year&limit=10&restrict_sr=1"
        log(f"    [reddit] r/{sub}")
        r = http_get(url, timeout=15)
        if not r or not r.ok:
            time.sleep(1)
            continue
        try:
            data = r.json()
            posts = data.get("data", {}).get("children", [])
        except Exception:
            continue
        for p in posts[:6]:
            d = p.get("data", {})
            preview = d.get("preview", {}).get("images", [])
            if not preview:
                continue
            img_url = preview[0].get("source", {}).get("url", "").replace("&amp;", "&")
            if not img_url:
                continue
            findings.append({
                "image_url": img_url,
                "source_url": f"https://reddit.com{d.get('permalink', '')}",
                "source_author": d.get("author", "reddit"),
                "source_date": datetime.fromtimestamp(d.get("created_utc", 0), tz=timezone.utc).date().isoformat() if d.get("created_utc") else None,
                "title_en": (d.get("title") or "")[:200],
                "summary_en": (d.get("title") or "")[:400],
                "suggested_kpi_topics": [],
            })
            if len(findings) >= 6:
                break
        time.sleep(1)
        if len(findings) >= 6:
            break
    log(f"    [reddit] {len(findings)} findings retained")
    return findings


def scrape_substack(query: str, tickers: list) -> list[dict]:
    """DDG site:substack.com filtered by whitelist."""
    log(f"    [substack] DDG site:substack.com")
    results = ddg_html_search(f"site:substack.com {query} chart", max_results=15)
    findings = []
    for r in results:
        host = urllib.parse.urlparse(r["url"]).netloc.lower()
        # Match whitelist by subdomain or path
        if not any(w in host or w in r["url"].lower() for w in SUBSTACK_WHITELIST):
            continue
        findings.append({
            "image_url": r["url"],
            "source_url": r["url"],
            "source_author": host.split(".")[0],
            "source_date": None,
            "title_en": r["title"][:200],
            "summary_en": (r["snippet"] or "")[:400],
            "suggested_kpi_topics": [],
        })
        if len(findings) >= 4:
            break
    log(f"    [substack] {len(findings)} findings retained")
    return findings


def scrape_ddg_images(query: str, tickers: list) -> list[dict]:
    """DDG Images search (HTML)."""
    # DDG Images HTML returns image hits with vqd token; using simpler HTML version
    if not HAS_BS4:
        return []
    q = urllib.parse.quote_plus(f"{query} chart")
    url = f"https://duckduckgo.com/html/?q={q}+chart&iax=images&ia=images"
    log(f"    [ddg_images] {query} chart")
    r = http_get(url, timeout=15)
    if not r or not r.ok:
        return []
    soup = BeautifulSoup(r.text, "html.parser")
    findings = []
    # Fall back: extract any results, treat as image-bearing pages
    for div in soup.select("div.result")[:8]:
        a = div.select_one("a.result__a")
        snip = div.select_one("a.result__snippet")
        if not a:
            continue
        href = a.get("href", "")
        if "uddg=" in href:
            try:
                href = urllib.parse.unquote(href.split("uddg=")[1].split("&")[0])
            except Exception:
                pass
        findings.append({
            "image_url": href,
            "source_url": href,
            "source_author": urllib.parse.urlparse(href).netloc,
            "source_date": None,
            "title_en": a.get_text(strip=True)[:200],
            "summary_en": (snip.get_text(strip=True) if snip else "")[:400],
            "suggested_kpi_topics": [],
        })
        if len(findings) >= 4:
            break
    log(f"    [ddg_images] {len(findings)} findings retained")
    return findings


def scrape_huggingface(query: str, tickers: list) -> list[dict]:
    """HF papers API for relevant research."""
    q = urllib.parse.quote_plus(query)
    url = f"https://huggingface.co/api/papers/search?q={q}"
    log(f"    [huggingface] papers search '{query}'")
    r = http_get(url, timeout=15)
    findings = []
    if r and r.ok:
        try:
            papers = r.json()
            for p in papers[:5] if isinstance(papers, list) else []:
                paper = p.get("paper", p) if isinstance(p, dict) else {}
                pid = paper.get("id") or paper.get("arxiv_id") or paper.get("paperId")
                title = paper.get("title", "")
                summary = paper.get("summary") or paper.get("abstract", "")
                if not pid:
                    continue
                paper_url = f"https://huggingface.co/papers/{pid}"
                findings.append({
                    "image_url": paper_url,
                    "source_url": paper_url,
                    "source_author": "huggingface_papers",
                    "source_date": paper.get("publishedAt", "").split("T")[0] if paper.get("publishedAt") else None,
                    "title_en": title[:200],
                    "summary_en": (summary or "")[:400],
                    "suggested_kpi_topics": [],
                })
        except Exception as e:
            log(f"    [huggingface] parse fail: {e}")
    log(f"    [huggingface] {len(findings)} findings retained")
    return findings


def scrape_company_docs(query: str, tickers: list) -> list[dict]:
    """V2 placeholder: PDF parsing reported to V3. Log only."""
    log(f"    [company_docs] V3 TODO: PDF parsing for tickers {tickers[:5]} (skipped)")
    return []


def scrape_high_rep(query: str, tickers: list) -> list[dict]:
    """DDG search restricted to high-rep allowlist."""
    sites = " OR ".join(f"site:{d}" for d in HIGH_REP_DOMAINS[:6])
    log(f"    [high_rep] DDG allowlist for '{query}'")
    results = ddg_html_search(f"({sites}) {query}", max_results=10)
    findings = []
    for r in results:
        host = urllib.parse.urlparse(r["url"]).netloc.lower()
        if not any(d in host for d in HIGH_REP_DOMAINS):
            continue
        findings.append({
            "image_url": r["url"],
            "source_url": r["url"],
            "source_author": host,
            "source_date": None,
            "title_en": r["title"][:200],
            "summary_en": (r["snippet"] or "")[:400],
            "suggested_kpi_topics": [],
        })
        if len(findings) >= 4:
            break
    log(f"    [high_rep] {len(findings)} findings retained")
    return findings


SCRAPERS = {
    "web": scrape_web,
    "x_anon": scrape_x_anon,
    "reddit": scrape_reddit,
    "substack": scrape_substack,
    "ddg_images": scrape_ddg_images,
    "huggingface": scrape_huggingface,
    "company_docs": scrape_company_docs,
    "high_rep": scrape_high_rep,
}

SOURCE_SLEEP = {
    "web": 5, "x_anon": 3, "reddit": 1, "substack": 5,
    "ddg_images": 5, "huggingface": 1, "company_docs": 0, "high_rep": 5,
}


# ---------- Pipeline ----------

def process_request(req: dict, dry_run: bool = False) -> dict:
    request_id = req["id"]
    query = req.get("query", "") or ""
    target_tickers = req.get("target_tickers", []) or []
    languages = req.get("languages", ["en"]) or ["en"]
    display_n = req.get("display_number", 0) or 0

    log(f"=== Demande #{display_n} ({request_id[:8]}) : {query[:80]}")
    log(f"    Tickers: {target_tickers} | Langues: {languages}")

    # Mark in_progress
    if not dry_run:
        update_request(request_id, {"status": "in_progress", "error_msg": None, "updated_at": now_iso()})

    inserted = 0
    skipped = 0
    source_recap = {}
    errors = []

    candidates_by_source: dict[str, list] = {}

    # Phase 1 : scrape
    for source in SOURCES:
        try:
            scraper = SCRAPERS[source]
            candidates = scraper(query, target_tickers)
            candidates_by_source[source] = candidates
            source_recap[source] = f"ok ({len(candidates)})"
            if not candidates:
                skipped += 1
        except Exception as e:
            log(f"    [{source}] ERROR: {type(e).__name__}: {str(e)[:120]}")
            traceback.print_exc()
            source_recap[source] = f"fail ({type(e).__name__})"
            errors.append(f"{source}: {type(e).__name__}")
            candidates_by_source[source] = []
        time.sleep(SOURCE_SLEEP.get(source, 2))

    # Phase 2 : SVG + insert
    idx = 0
    for source, candidates in candidates_by_source.items():
        for c in candidates:
            idx += 1
            slug = re.sub(r"[^a-z0-9]+", "-", source.lower())[:20]
            title_en = c.get("title_en", "Untitled")[:200]

            # Translate via Gemini
            tr = gemini_translate(title_en)
            title_i18n = {"en": title_en, "fr": tr.get("fr", title_en), "de": tr.get("de", title_en)}
            summary_en = c.get("summary_en", "")[:600]
            summary_i18n = {"en": summary_en, "fr": summary_en, "de": summary_en}

            # SVG dark + light
            svg_dark = make_placeholder_svg(title_en, c.get("source_author", source), c.get("source_url", ""), "dark")
            svg_light = make_placeholder_svg(title_en, c.get("source_author", source), c.get("source_url", ""), "light")

            if not validate_svg(svg_dark):
                log(f"    [svg] invalid dark for finding {idx}, skip")
                continue

            local_path_dark = None
            local_path_light = None
            if not dry_run:
                local_path_dark = write_svg(display_n, slug, idx, "dark", svg_dark)
                local_path_light = write_svg(display_n, slug, idx, "light", svg_light)

            finding = {
                "request_id": request_id,
                "target_tickers": target_tickers,
                "languages": languages,
                "source_url": c.get("source_url"),
                "source_author": c.get("source_author"),
                "source_handle": None,
                "source_date": c.get("source_date"),
                "source_platform": source,
                "image_url": c.get("image_url"),
                "image_local_path": local_path_dark,
                "title": title_en,
                "caption": title_en,
                "summary": summary_en,
                "title_i18n": title_i18n,
                "summary_i18n": summary_i18n,
                "detected_kpi_topics": c.get("suggested_kpi_topics") or [],
                "approved": False,
                "rejected": False,
                "show_summary": True,
                "display_order": idx,
            }
            if insert_finding(finding, dry_run=dry_run):
                inserted += 1

    # Final status
    recap_str = " | ".join(f"{k}={v}" for k, v in source_recap.items())
    note = f"V2 autorun · {inserted} insert · sources: {recap_str}"

    if not dry_run:
        if inserted == 0 and errors:
            update_request(request_id, {
                "status": "error",
                "error_msg": "all sources failed: " + " | ".join(errors)[:400],
                "notes": note[:500],
                "updated_at": now_iso(),
            })
            log(f"    → status=error ({inserted} inserted)")
        else:
            update_request(request_id, {
                "status": "pending_review",
                "error_msg": None,
                "notes": note[:500],
                "updated_at": now_iso(),
            })
            log(f"    → status=pending_review ({inserted} inserted)")

    return {"request_id": request_id, "inserted": inserted, "skipped": skipped, "errors": errors}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--request-id", help="UUID demande spécifique")
    parser.add_argument("--all-pending", action="store_true", help="Traite tous les claude_pending/in_progress")
    parser.add_argument("--dry-run", action="store_true", help="Simule sans BDD ni fichiers")
    args = parser.parse_args()

    if not args.request_id and not args.all_pending:
        print("ERREUR: --request-id ou --all-pending requis", file=sys.stderr)
        sys.exit(2)

    if not HAS_BS4:
        log("[warn] beautifulsoup4 not installed → web/substack/ddg_images/high_rep/x_anon limited")
    if not HAS_GEMINI or not GEMINI_API_KEY:
        log("[warn] Gemini not configured → using heuristic fallback for filtering + EN-only titles")

    if args.request_id:
        req = fetch_request_by_id(args.request_id)
        if not req:
            log(f"Demande {args.request_id} introuvable")
            sys.exit(0)
        requests_to_process = [req]
    else:
        requests_to_process = fetch_pending_requests()

    if not requests_to_process:
        log("Aucune demande à traiter. Exit.")
        return

    log(f"=== {len(requests_to_process)} demande(s) à traiter ===\n")

    total_inserted = 0
    total_errors = 0
    for req in requests_to_process:
        try:
            result = process_request(req, dry_run=args.dry_run)
            total_inserted += result["inserted"]
            if result["errors"]:
                total_errors += 1
        except Exception as e:
            log(f"[fatal] {req.get('id')}: {type(e).__name__}: {e}")
            traceback.print_exc()
            total_errors += 1

    log(f"\n=== Fin : {total_inserted} finding(s) inséré(s), {total_errors} demande(s) en erreur ===")


if __name__ == "__main__":
    main()
