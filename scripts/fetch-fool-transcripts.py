#!/usr/bin/env python3
"""Telecharge les earnings call transcripts Motley Fool pour les stes SP500.

Phase 1: sitemaps mensuels fool.com/sitemap/YYYY/MM (2016-01 -> 2026-07)
         -> index des URLs de transcripts par ticker SP500.
Phase 2: telechargement de chaque transcript, extraction texte article-body,
         sauvegarde ~/Mettrik/docs/<TICKER>/transcript/fool_QX-YYYY_<date>.txt

Resume-safe: skip si le fichier destination existe deja.
Throttle 0.7s entre requetes. Logs dans .conv-state/fool-transcripts.log
"""
import json
import re
import html as H
import time
import sys
from pathlib import Path
import subprocess

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
ROOT = Path("/Users/yann/spx-app")
DOCS = Path("/Users/yann/Mettrik/docs")
STATE = ROOT / ".conv-state"
STATE.mkdir(exist_ok=True)
INDEX = STATE / "fool-transcript-index.json"
LOG = STATE / "fool-transcripts.log"
THROTTLE = 0.7

sp500 = {t.upper() for t in json.load(open(ROOT / "src/data/sp500-tickers.json"))}
# variantes URL fool : brk.b -> brk-b, bf.b -> bf-b
slug2ticker = {}
for t in sp500:
    slug2ticker[t.lower().replace(".", "-")] = t
    slug2ticker[t.lower().replace(".", "")] = t

def log(msg):
    line = f"{time.strftime('%H:%M:%S')} {msg}"
    with open(LOG, "a") as f:
        f.write(line + "\n")
    print(line, flush=True)

def fetch(url, retries=3):
    for i in range(retries):
        r = subprocess.run(
            ["curl", "-s", "-m", "40", "-A", UA["User-Agent"], url],
            capture_output=True, text=True)
        if r.returncode == 0 and len(r.stdout) > 500:
            return r.stdout
        time.sleep(5 * (i + 1))
    log(f"FAIL {url}")
    return None

Q_RE = re.compile(r"(?:^|-)q([1-4])[- ]?(20\d\d)")

def parse_url(u):
    """Retourne (ticker, quarter, year) ou None."""
    slug = u.rstrip("/").split("/")[-1].replace(".aspx", "")
    m = Q_RE.search(slug)
    if not m:
        return None
    q, y = m.group(1), m.group(2)
    # token ticker = dernier token court avant qN
    head = slug[: m.start()].strip("-")
    for tok in reversed(head.split("-")):
        if tok in slug2ticker:
            return slug2ticker[tok], f"Q{q}", y
    return None

def phase1():
    if INDEX.exists():
        return json.load(open(INDEX))
    index = {}
    months = [(y, m) for y in range(2016, 2027) for m in range(1, 13)]
    months = [x for x in months if x < (2026, 8)]
    for y, m in months:
        xml = fetch(f"https://www.fool.com/sitemap/{y}/{m:02d}")
        time.sleep(THROTTLE)
        if not xml:
            continue
        urls = re.findall(r"<loc>([^<]*call-transcripts[^<]*)</loc>", xml)
        n = 0
        for u in urls:
            p = parse_url(u)
            if p:
                t, q, yy = p
                index.setdefault(t, {})[f"{q}-{yy}"] = u
                n += 1
        log(f"sitemap {y}-{m:02d}: {len(urls)} transcripts, {n} SP500")
    json.dump(index, open(INDEX, "w"), indent=1)
    return index

BODY_RE = re.compile(r'<div[^>]*class="[^"]*article-body[^"]*"[^>]*>(.*?)</div>\s*<div', re.S)

def extract_text(page):
    m = BODY_RE.search(page)
    raw = m.group(1) if m else page
    t = re.sub(r"<script.*?</script>", " ", raw, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    t = H.unescape(t)
    return re.sub(r"[ \t]+", " ", t).strip()

def phase2(index):
    todo = []
    for t, qs in index.items():
        outdir = DOCS / t / "transcript"
        for qk, url in sorted(qs.items()):
            date = "-".join(url.split("/")[-4:-1][:3])
            out = outdir / f"fool_{qk}_{date}.txt"
            if not out.exists():
                todo.append((t, qk, url, out))
    log(f"phase2: {len(todo)} transcripts a telecharger")
    done = 0
    for t, qk, url, out in todo:
        page = fetch(url)
        time.sleep(THROTTLE)
        if not page:
            continue
        txt = extract_text(page)
        if len(txt) < 3000:
            log(f"SKIP court {t} {qk} ({len(txt)} ch)")
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(txt)
        done += 1
        if done % 100 == 0:
            log(f"progress: {done}/{len(todo)}")
    log(f"phase2 TERMINE: {done} nouveaux transcripts")

if __name__ == "__main__":
    idx = phase1()
    ntot = sum(len(v) for v in idx.values())
    log(f"index: {len(idx)} tickers SP500, {ntot} transcripts")
    if "--index-only" not in sys.argv:
        phase2(idx)
