#!/usr/bin/env python3
"""Recupere les derniers earnings call transcripts et les range au format attendu.

Source : sitemaps mensuels de Motley Fool, qui publient les transcripts en clair.
Sortie : src/data/transcripts/<ticker>.json, meme schema que l existant
         {"latest": {"quarter": 2, "year": 2026, "date": "...", "content": "..."}}

Ne remplace un transcript existant que si le nouveau est PLUS RECENT.

Usage : python3 scripts/transcripts-refresh.py --mois 2026-06,2026-07,2026-08
"""
from __future__ import annotations

import argparse
import html as H
import json
import re
import subprocess
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
UNIVERS = RACINE / "src" / "data" / "v1-9-5-clean-all-tickers.json"
SORTIE = RACINE / "src" / "data" / "transcripts"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
PAUSE = 0.6


def note(m: str) -> None:
    print(f"[transcripts] {time.strftime('%H:%M:%S')} {m}", flush=True)


def recupere(url: str, essais: int = 3) -> str | None:
    for i in range(essais):
        r = subprocess.run(
            ["curl", "-s", "-m", "45", "-A", UA, url],
            capture_output=True, text=True,
        )
        if r.returncode == 0 and len(r.stdout) > 500:
            return r.stdout
        time.sleep(4 * (i + 1))
    return None


def univers() -> dict[str, str]:
    """slug Fool -> ticker de l univers."""
    d = json.loads(UNIVERS.read_text(encoding="utf8"))
    tk = d.get("tickers") if isinstance(d, dict) else d
    table: dict[str, str] = {}
    for t in (str(x).upper() for x in tk):
        base = t.split(".")[0].lower()
        table[base] = t
        table[base.replace("-", "")] = t
        table[t.lower().replace(".", "-")] = t
    return table


Q_RE = re.compile(r"(?:^|-)q([1-4])[- ]?(20\d\d)")


def lit_url(u: str, table: dict[str, str]):
    slug = u.rstrip("/").split("/")[-1].replace(".aspx", "")
    m = Q_RE.search(slug)
    if not m:
        return None
    tete = slug[: m.start()].strip("-")
    for tok in reversed(tete.split("-")):
        if tok in table:
            return table[tok], int(m.group(1)), int(m.group(2))
    return None


def texte_article(html: str) -> str:
    # Le corps du transcript est dans un conteneur "article-body
    # transcript-content". On part de la et on prend la suite : le nettoyage des
    # balises suffit, le pied de page est coupe plus bas.
    i = html.find("article-body transcript-content")
    brut = html[i:] if i != -1 else html
    brut = re.sub(r"<script.*?</script>", " ", brut, flags=re.S)
    brut = re.sub(r"<style.*?</style>", " ", brut, flags=re.S)
    brut = re.sub(r"<[^>]+>", " ", brut)
    texte = re.sub(r"\s+", " ", H.unescape(brut)).strip()
    texte = texte.replace('article-body transcript-content">', "").strip()
    # Coupe la queue de page (articles suggeres, mentions legales).
    for marqueur in ("This article is a transcript", "Related Articles", "Premium Investing Services"):
        j = texte.find(marqueur)
        if j > 3000:
            texte = texte[:j]
    return texte.strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mois", default="2026-06,2026-07,2026-08")
    ap.add_argument("--max", type=int, default=0)
    args = ap.parse_args()
    table = univers()
    SORTIE.mkdir(parents=True, exist_ok=True)

    liens: dict[str, tuple[str, int, int]] = {}
    for mois in args.mois.split(","):
        an, m = mois.split("-")
        page = recupere(f"https://www.fool.com/sitemap/{an}/{m}")
        if not page:
            note(f"sitemap {mois} illisible")
            continue
        # Le sitemap est un XML : les adresses sont dans des balises <loc>.
        urls = set(
            re.findall(r"<loc>(https://www\.fool\.com/earnings/call-transcripts/[^<]+)</loc>", page)
        )
        note(f"sitemap {mois} : {len(urls)} transcripts")
        for u in urls:
            plein = u if u.startswith("http") else "https://www.fool.com" + u
            lu = lit_url(plein, table)
            if not lu:
                continue
            t, q, y = lu
            garde = liens.get(t)
            if not garde or (y, q) > (garde[2], garde[1]):
                liens[t] = (plein, q, y)

    note(f"{len(liens)} societes de l univers avec un transcript recent")
    ecrits = 0
    for i, (t, (url, q, y)) in enumerate(sorted(liens.items()), 1):
        if args.max and ecrits >= args.max:
            break
        cible = SORTIE / f"{t.lower()}.json"
        if cible.exists():
            try:
                ancien = json.loads(cible.read_text(encoding="utf8")).get("latest") or {}
                if (int(ancien.get("year") or 0), int(ancien.get("quarter") or 0)) >= (y, q):
                    continue
            except Exception:  # noqa: BLE001
                pass
        page = recupere(url)
        time.sleep(PAUSE)
        if not page:
            note(f"  {t} : page illisible")
            continue
        contenu = texte_article(page)
        if len(contenu) < 3000:
            note(f"  {t} : contenu trop court ({len(contenu)}), ignore")
            continue
        date_m = re.search(r"(20\d\d-\d\d-\d\d)", url) or re.search(
            r'"datePublished"\s*:\s*"(20\d\d-\d\d-\d\d)', page
        )
        cible.write_text(
            json.dumps(
                {
                    "ticker": t,
                    "latest": {
                        "quarter": q,
                        "year": y,
                        "date": date_m.group(1) if date_m else "",
                        "content": contenu,
                        "source_url": url,
                    },
                },
                ensure_ascii=False,
            ),
            encoding="utf8",
        )
        ecrits += 1
        note(f"  {t} Q{q} {y} : {len(contenu)} caracteres")
    note(f"FINI {ecrits} transcripts ecrits")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
