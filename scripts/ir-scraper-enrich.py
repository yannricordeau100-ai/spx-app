#!/usr/bin/env python3
"""IR scraper ENRICH (complément Pass 1).

Re-fetch léger des pages IR pour ajouter :
  - Snapshot HTML texte de chaque page visitée (home, IR home, IR docs, additional, regulator)
  - Détection de fichiers supplémentaires (.xlsx, .xls, .docx, .doc, .zip)
  - Mise à jour du manifest avec snapshot_paths + extra_files

Output enrichi :
  ~/Mettrik/sec-data/ir-scrape/<TICKER>/snapshots/<label>.html
  ~/Mettrik/sec-data/ir-scrape/<TICKER>/snapshots/<label>.txt
  ~/Mettrik/sec-data/ir-scrape/<TICKER>/extras/<filename>

Usage :
  python3 scripts/ir-scraper-enrich.py --top307 --workers 4
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("pip3 install requests")

ROOT = Path(__file__).resolve().parent.parent
SEED_DIR = ROOT / "supabase" / "seeds"
OUT_ROOT = Path.home() / "Mettrik" / "sec-data" / "ir-scrape"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Mettrik-IR-Enrich/1.0"
TIMEOUT_HTML = 12
TIMEOUT_FILE = 60
MAX_FILE_BYTES = 60 * 1024 * 1024
EXTRA_EXT = (".xlsx", ".xls", ".docx", ".doc", ".zip", ".csv")


def parse_seed_sql(path):
    txt = path.read_text()
    pattern = re.compile(
        r"\(\s*'([^']*)'\s*,\s*"
        r"('(?:[^']|'')*'|NULL)\s*,\s*"
        r"('(?:[^']|'')*'|NULL)\s*,\s*"
        r"('(?:[^']|'')*'|NULL)\s*,\s*"
        r"('(?:[^']|'')*'|NULL)::jsonb\s*,\s*"
        r"(?:('(?:[^']|'')*'|NULL)\s*,\s*)?"
        r"('(?:[^']|'')*'|NULL)\s*\)",
        re.M,
    )
    rows = []
    for m in pattern.finditer(txt):
        def unq(s):
            if s is None or s == "NULL": return None
            return s[1:-1].replace("''", "'")
        rows.append({
            "ticker": m.group(1),
            "home_url": unq(m.group(2)),
            "ir_home_url": unq(m.group(3)),
            "ir_docs_main_url": unq(m.group(4)),
            "additional_json": unq(m.group(5)) or "[]",
            "regulator_url": unq(m.group(6)) if m.group(6) else None,
        })
    return rows


def load_all_seeds():
    merged = {}
    for f in sorted(SEED_DIR.glob("seed-ir-sources-*.sql")):
        for r in parse_seed_sql(f):
            merged[r["ticker"]] = r
    return merged


def html_to_text(html):
    """Extraction texte basique."""
    if not html:
        return ""
    text = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.I | re.S)
    text = re.sub(r"<style[^>]*>.*?</style>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    import html as htmllib
    text = htmllib.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def safe_filename(url):
    path = urllib.parse.urlparse(url).path
    name = os.path.basename(path) or "file"
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    return name[:120]


def disk_free_gb():
    import shutil
    return shutil.disk_usage("/").free / (1024**3)


def process_ticker(row, session):
    t = row["ticker"]
    out_dir = OUT_ROOT / t
    snap_dir = out_dir / "snapshots"
    extra_dir = out_dir / "extras"
    snap_dir.mkdir(parents=True, exist_ok=True)

    urls = []
    for k in ("home_url", "ir_home_url", "ir_docs_main_url"):
        if row.get(k): urls.append((k, row[k]))
    try:
        for i, u in enumerate(json.loads(row.get("additional_json") or "[]")):
            if u: urls.append((f"additional_{i+1}", u))
    except Exception:
        pass
    if row.get("regulator_url"):
        urls.append(("regulator_url", row["regulator_url"]))

    snaps = []
    extras = []
    for label, u in urls:
        try:
            r = session.get(u, timeout=TIMEOUT_HTML, headers={"User-Agent": UA}, allow_redirects=True)
            if r.status_code != 200:
                continue
            html = r.text
            text = html_to_text(html)
            if not text:
                continue
            # Save HTML + TXT snapshot
            html_path = snap_dir / f"{label}.html"
            txt_path = snap_dir / f"{label}.txt"
            html_path.write_text(html[:500000], errors="ignore")  # cap 500KB HTML
            txt_path.write_text(text[:200000], errors="ignore")    # cap 200KB text
            snaps.append({"label": label, "url": u, "html": str(html_path.relative_to(OUT_ROOT)), "txt": str(txt_path.relative_to(OUT_ROOT)), "text_len": len(text)})

            # Detect extra file types
            pattern = re.compile(r'<a\s+[^>]*href=["\']([^"\']+)["\']', re.I)
            for m in pattern.finditer(html):
                href = m.group(1).strip()
                abs_url = urllib.parse.urljoin(u, href).split("#")[0]
                path_lc = urllib.parse.urlparse(abs_url).path.lower()
                if any(path_lc.endswith(ext) for ext in EXTRA_EXT):
                    if disk_free_gb() < 3.0:
                        continue
                    fname = safe_filename(abs_url)
                    dest = extra_dir / fname
                    if dest.exists() and dest.stat().st_size > 100:
                        extras.append({"url": abs_url, "path": str(dest.relative_to(OUT_ROOT)), "msg": "skip-exists"})
                        continue
                    try:
                        rr = session.get(abs_url, timeout=TIMEOUT_FILE, headers={"User-Agent": UA}, stream=True, allow_redirects=True)
                        if rr.status_code != 200:
                            continue
                        dest.parent.mkdir(parents=True, exist_ok=True)
                        total = 0
                        with open(dest, "wb") as f:
                            for chunk in rr.iter_content(64 * 1024):
                                total += len(chunk)
                                if total > MAX_FILE_BYTES:
                                    f.close(); dest.unlink(missing_ok=True); break
                                f.write(chunk)
                        if dest.exists():
                            extras.append({"url": abs_url, "path": str(dest.relative_to(OUT_ROOT)), "size": total, "msg": "downloaded"})
                    except Exception:
                        continue
        except Exception:
            continue

    # Update manifest
    mp = out_dir / "_manifest.json"
    manifest = {}
    if mp.exists():
        try: manifest = json.loads(mp.read_text())
        except: pass
    manifest["snapshots"] = snaps
    manifest["extras"] = extras
    manifest["enriched_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    mp.write_text(json.dumps(manifest, indent=2))
    return {"ticker": t, "snaps": len(snaps), "extras": len(extras)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top307", action="store_true")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--tickers")
    ap.add_argument("--workers", type=int, default=3)
    args = ap.parse_args()

    seeds = load_all_seeds()
    selected = []
    if args.tickers:
        for t in args.tickers.split(","):
            if t in seeds: selected.append(seeds[t])
    elif args.top307:
        v18 = json.load(open(ROOT / "src/data/v1-8-tickers-sorted.json"))
        for t in v18:
            if t in seeds: selected.append(seeds[t])
    elif args.all:
        selected = list(seeds.values())
    else:
        ap.error("--tickers/--top307/--all required")

    print(f"Enriching {len(selected)} stés (workers={args.workers})")
    t0 = time.time()
    import threading
    local = threading.local()
    def sf():
        if not hasattr(local, "s"): local.s = requests.Session()
        return local.s
    done = 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(process_ticker, r, sf()): r["ticker"] for r in selected}
        for fut in as_completed(futs):
            try: res = fut.result()
            except Exception as e: res = {"ticker": futs[fut], "err": str(e)}
            done += 1
            if done % 20 == 0 or done == len(selected):
                dt = time.time() - t0
                eta = (dt / done) * (len(selected) - done) if done else 0
                print(f"  [{done}/{len(selected)}] {res} | ETA {eta:.0f}s")

    print(f"\n✅ Enrich done in {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
