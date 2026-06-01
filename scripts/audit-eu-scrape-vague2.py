#!/usr/bin/env python3
"""
Audit qualité EU scrape vague 1+2.
- Lit /Users/yann/spx-app/sec-data/cat3-european/<TICKER>/annual-text/<YEAR>.txt
- Pour les fichiers modifiés < 24h.
- Vérifie : taille, présence nom officiel, mentions année, ratio caractères imprimables.
- Output : audit-quality-vague2.json + .md
NE TOUCHE PAS aux fichiers source. Audit only.
"""

import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/Users/yann/spx-app/sec-data/cat3-european")
META = Path("/Users/yann/spx-app/sec-data/_meta")
OUT_JSON = META / "audit-quality-vague2.json"
OUT_MD = META / "audit-quality-vague2.md"
TOP500_PATH = META / "cat3-top500-eu.json"

# Cross-pollution thresholds
MIN_OFFICIAL_NAME_HITS = 5
# Intruders watchlist (frequent cross-pollution targets observed in top500 URLs)
INTRUDER_PATTERNS = {
    "Tesla": r"\btesla\b",
    "AbbVie": r"\babbvie\b",
    "GSK": r"\bglaxosmithkline\b|\bgsk\b",
    "ECB": r"european central bank",
    "Providence": r"providence,?\s+rhode\s+island|city of providence",
    "ALD Connect": r"\bald\s+connect\b",
    "Sodexo": r"\bsodexo\b",
    "Stellantis": r"\bstellantis\b",
}

# Size thresholds (bytes)
SIZE_SUSPECT = 10 * 1024   # < 10 KB
SIZE_WARNING = 50 * 1024   # < 50 KB

# Year mention threshold
MIN_YEAR_MENTIONS = 100

# Printable ratio threshold for corrupt PDF
PRINTABLE_RATIO_MIN = 0.85
# Min file size to bother checking printable ratio (smaller = surely corrupt)
CORRUPT_MIN_SIZE = 1024

WINDOW_HOURS = 24


def load_ticker_names():
    """Return dict ticker -> official_name (lowercased substrings for matching)."""
    out = {}
    if TOP500_PATH.exists():
        with open(TOP500_PATH) as f:
            d = json.load(f)
        for k, v in d.items():
            if k.startswith("_"):
                continue
            if isinstance(v, dict) and "name" in v:
                name = v["name"].strip()
                if not name:
                    continue
                # Skip degenerate names where name == ticker prefix or full ticker (auto-fallback)
                ticker_prefix = k.split(".")[0]
                if name.upper() == ticker_prefix.upper() or name.upper() == k.upper():
                    continue
                # Skip degenerate where name is ticker_prefix + 1-2 trailing letters (e.g. ALTR -> ALTRS, BCP -> BCPS)
                if name.upper().startswith(ticker_prefix.upper()) and len(name) <= len(ticker_prefix) + 2 and name.isupper() and " " not in name:
                    continue
                # Skip too-short names (less than 4 chars) — too ambiguous to grep meaningfully
                if len(name) < 4:
                    continue
                out[k] = name
    return out


def count_occurrences(text_lower, needle):
    """Case-insensitive substring count."""
    if not needle:
        return 0
    return text_lower.count(needle.lower())


def printable_ratio(sample_bytes):
    if not sample_bytes:
        return 0.0
    try:
        text = sample_bytes.decode("utf-8", errors="replace")
    except Exception:
        return 0.0
    printable = sum(1 for c in text if c.isprintable() or c in "\n\r\t ")
    return printable / max(1, len(text))


def audit_file(path: Path, ticker: str, year: str, name_map: dict):
    """Return dict of audit findings for one file."""
    findings = {
        "ticker": ticker,
        "year": year,
        "file": str(path),
        "size": 0,
        "official_name": name_map.get(ticker, "unknown"),
        "name_hits": None,
        "year_mentions": None,
        "intruders": [],
        "printable_ratio": None,
        "flags": [],
    }
    try:
        st = path.stat()
        findings["size"] = st.st_size
    except OSError:
        findings["flags"].append("stat_error")
        return findings

    size = findings["size"]
    # Size checks
    if size < SIZE_SUSPECT:
        findings["flags"].append("too_small")
    elif size < SIZE_WARNING:
        findings["flags"].append("warning_small")

    # Read content (cap at 5 MB to stay light)
    READ_CAP = 5 * 1024 * 1024
    try:
        with open(path, "rb") as f:
            raw = f.read(READ_CAP)
    except Exception:
        findings["flags"].append("read_error")
        return findings

    # Printable ratio on first 64KB sample for speed
    sample = raw[:65536]
    ratio = printable_ratio(sample)
    findings["printable_ratio"] = round(ratio, 3)
    if size < CORRUPT_MIN_SIZE:
        findings["flags"].append("corrupt_pdf_extract")
    elif ratio < PRINTABLE_RATIO_MIN:
        findings["flags"].append("corrupt_pdf_extract")

    # Decode to text for grep-like ops
    text = raw.decode("utf-8", errors="replace")
    text_lower = text.lower()

    # Year mentions
    findings["year_mentions"] = text.count(year)
    if findings["year_mentions"] < MIN_YEAR_MENTIONS:
        findings["flags"].append("wrong_year_date_majority")

    # Cross-pollution: check official name hits if known
    official = findings["official_name"]
    if official != "unknown":
        # Try multiple variants to handle diacritics, suffix variations, partial matches
        variants = set()
        variants.add(official.lower())
        # Strip corporate suffixes
        core = re.sub(r"\b(group|holding|holdings|gmbh|ag|sa|se|nv|plc|inc|spa|ltd|llc|asa|oyj|sas)\b", "", official, flags=re.I).strip()
        if core:
            variants.add(core.lower())
        # Diacritic-fold: replace common substitutions
        def fold(s):
            tr = str.maketrans({"ä":"a","ö":"o","ü":"u","ß":"ss","é":"e","è":"e","ê":"e","á":"a","à":"a","ó":"o","ñ":"n","ç":"c"})
            return s.lower().translate(tr)
        # First significant token (skip "the", "le", etc.)
        # Split on whitespace, hyphens, AND apostrophes (straight & curly) to handle Sainsbury's etc.
        toks = [t for t in re.split(r"[\s\-'’`]+", core or official) if len(t) >= 3 and t.lower() not in ("the","les","une","der","den","das","group","holding")]
        for tk in toks[:2]:  # use up to 2 lead tokens
            variants.add(tk.lower())
        # Folded text + folded variants
        text_folded = fold(text_lower)
        hits = 0
        for v in variants:
            h1 = text_lower.count(v)
            h2 = text_folded.count(fold(v))
            hits = max(hits, h1, h2)
        findings["name_hits"] = hits
        if hits < MIN_OFFICIAL_NAME_HITS:
            findings["flags"].append("suspect_cross_pollution")
            # Identify intruders
            for intruder, pat in INTRUDER_PATTERNS.items():
                m = re.findall(pat, text_lower)
                if len(m) >= 5:
                    findings["intruders"].append({"name": intruder, "hits": len(m)})
    else:
        # Still scan for intruders as informational signal
        for intruder, pat in INTRUDER_PATTERNS.items():
            m = re.findall(pat, text_lower)
            if len(m) >= 20:  # higher bar without baseline
                findings["intruders"].append({"name": intruder, "hits": len(m)})
        if findings["intruders"]:
            findings["flags"].append("suspect_intruder_unknown_baseline")

    return findings


def main():
    name_map = load_ticker_names()
    print(f"[audit] loaded {len(name_map)} ticker->name mappings", flush=True)

    cutoff = time.time() - WINDOW_HOURS * 3600
    candidates = []
    for ticker_dir in sorted(ROOT.iterdir()):
        if not ticker_dir.is_dir():
            continue
        # Skip non-ticker special dirs
        if ticker_dir.name.startswith("_") or "(" in ticker_dir.name:
            continue
        annual = ticker_dir / "annual-text"
        if not annual.is_dir():
            continue
        for txt in annual.glob("*.txt"):
            try:
                m = txt.stat().st_mtime
            except OSError:
                continue
            if m >= cutoff:
                year_match = re.match(r"^(\d{4})\.txt$", txt.name)
                if not year_match:
                    continue
                candidates.append((ticker_dir.name, year_match.group(1), txt))

    total = len(candidates)
    print(f"[audit] {total} files to audit", flush=True)

    suspect_cross = []
    too_small = []
    warning_small = []
    wrong_year = []
    corrupt = []
    intruder_unknown = []

    for i, (ticker, year, path) in enumerate(candidates, 1):
        if i % 100 == 0:
            print(f"[audit] {i}/{total}", flush=True)
        f = audit_file(path, ticker, year, name_map)
        if "suspect_cross_pollution" in f["flags"]:
            suspect_cross.append({
                "ticker": f["ticker"],
                "year": f["year"],
                "file": f["file"],
                "official_name": f["official_name"],
                "count": f["name_hits"],
                "intruders": [it["name"] for it in f["intruders"]],
                "size": f["size"],
            })
        if "too_small" in f["flags"]:
            too_small.append({
                "ticker": f["ticker"],
                "year": f["year"],
                "file": f["file"],
                "size": f["size"],
            })
        elif "warning_small" in f["flags"]:
            warning_small.append({
                "ticker": f["ticker"],
                "year": f["year"],
                "file": f["file"],
                "size": f["size"],
            })
        if "wrong_year_date_majority" in f["flags"]:
            wrong_year.append({
                "ticker": f["ticker"],
                "year": f["year"],
                "file": f["file"],
                "year_mentions": f["year_mentions"],
                "size": f["size"],
            })
        if "corrupt_pdf_extract" in f["flags"]:
            corrupt.append({
                "ticker": f["ticker"],
                "year": f["year"],
                "file": f["file"],
                "size": f["size"],
                "printable_ratio": f["printable_ratio"],
            })
        if "suspect_intruder_unknown_baseline" in f["flags"]:
            intruder_unknown.append({
                "ticker": f["ticker"],
                "year": f["year"],
                "file": f["file"],
                "intruders": [it["name"] for it in f["intruders"]],
            })

    audited_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    report = {
        "audited_at": audited_at,
        "window_hours": WINDOW_HOURS,
        "total_files_audited": total,
        "ticker_name_map_size": len(name_map),
        "thresholds": {
            "min_official_name_hits": MIN_OFFICIAL_NAME_HITS,
            "size_suspect_bytes": SIZE_SUSPECT,
            "size_warning_bytes": SIZE_WARNING,
            "min_year_mentions": MIN_YEAR_MENTIONS,
            "printable_ratio_min": PRINTABLE_RATIO_MIN,
        },
        "counts": {
            "suspect_cross_pollution": len(suspect_cross),
            "too_small": len(too_small),
            "warning_small": len(warning_small),
            "wrong_year_date_majority": len(wrong_year),
            "corrupt_pdf_extract": len(corrupt),
            "suspect_intruder_unknown_baseline": len(intruder_unknown),
        },
        "suspect_cross_pollution": suspect_cross,
        "too_small": too_small,
        "warning_small": warning_small,
        "wrong_year_date_majority": wrong_year,
        "corrupt_pdf_extract": corrupt,
        "suspect_intruder_unknown_baseline": intruder_unknown,
    }

    OUT_JSON.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"[audit] wrote {OUT_JSON}", flush=True)

    # Markdown report
    lines = []
    lines.append(f"# Audit qualité EU scrape vague 1+2")
    lines.append("")
    lines.append(f"- Date audit : `{audited_at}`")
    lines.append(f"- Fenêtre : fichiers modifiés < {WINDOW_HOURS}h")
    lines.append(f"- Total fichiers audités : **{total}**")
    lines.append(f"- Map ticker->nom officiel : {len(name_map)} entrées (source : `cat3-top500-eu.json`)")
    lines.append("")
    lines.append("## Synthèse")
    lines.append("")
    lines.append(f"| Catégorie | Nb |")
    lines.append(f"|---|---|")
    lines.append(f"| Suspect cross-pollution | {len(suspect_cross)} |")
    lines.append(f"| Too small (<10 KB) | {len(too_small)} |")
    lines.append(f"| Warning small (10-50 KB) | {len(warning_small)} |")
    lines.append(f"| Année peu mentionnée (<100 occ.) | {len(wrong_year)} |")
    lines.append(f"| PDF corrupt (ratio imprimable bas) | {len(corrupt)} |")
    lines.append(f"| Intrus détectés (baseline inconnue) | {len(intruder_unknown)} |")
    lines.append("")

    def section(title, items, fields):
        lines.append(f"## {title} ({len(items)})")
        lines.append("")
        if not items:
            lines.append("_Aucun._")
            lines.append("")
            return
        head = "| " + " | ".join(fields) + " |"
        sep = "|" + "|".join(["---"] * len(fields)) + "|"
        lines.append(head)
        lines.append(sep)
        # cap to first 200 rows in MD to keep readable
        for it in items[:200]:
            row = []
            for f in fields:
                v = it.get(f, "")
                if isinstance(v, list):
                    v = ", ".join(str(x) for x in v) if v else ""
                row.append(str(v))
            lines.append("| " + " | ".join(row) + " |")
        if len(items) > 200:
            lines.append(f"")
            lines.append(f"_... {len(items) - 200} lignes supplémentaires dans le JSON._")
        lines.append("")

    section("Suspect cross-pollution",
            suspect_cross,
            ["ticker", "year", "official_name", "count", "intruders", "size"])
    section("Too small (<10 KB)",
            too_small,
            ["ticker", "year", "size"])
    section("Warning small (10-50 KB)",
            warning_small,
            ["ticker", "year", "size"])
    section("Année peu mentionnée",
            wrong_year,
            ["ticker", "year", "year_mentions", "size"])
    section("PDF corrupt / extraction ratée",
            corrupt,
            ["ticker", "year", "size", "printable_ratio"])
    section("Intrus détectés (ticker hors top500, baseline inconnue)",
            intruder_unknown,
            ["ticker", "year", "intruders"])

    lines.append("## Recommandations vague 3 (rescrape ciblé)")
    lines.append("")
    lines.append("1. **Priorité haute** : tous les `suspect_cross_pollution` → URL source pointe vers mauvaise société (ex: STLA.PA pointant sur Tesla 10-K). Vérifier `cat3-top500-eu.json` et corriger l'URL avant rescrape.")
    lines.append("2. **Priorité haute** : tous les `corrupt_pdf_extract` → pdftotext a échoué. Réessayer avec OCR ou source alternative.")
    lines.append("3. **Priorité moyenne** : `too_small` (<10 KB) → probable HTML wrapper, 404, ou paywall. Vérifier que l'URL ne renvoie pas une page d'erreur.")
    lines.append("4. **Priorité moyenne** : `wrong_year_date_majority` → fichier `<year>.txt` qui ne parle pas de cette année. Souvent rapport antérieur (URL pointe vers PDF d'une autre année).")
    lines.append("5. **Priorité basse** : `warning_small` (10-50 KB) → rapport tronqué probable mais peut être valide pour petites sociétés. Vérifier manuellement.")
    lines.append("6. **À investiguer** : `suspect_intruder_unknown_baseline` → tickers sans nom officiel dans `cat3-top500-eu.json`. Compléter la map et relancer l'audit. **Faux positifs probables** : banques EU (BNP, GLE, BCP, BMPS, EBS) qui mentionnent légitimement la BCE/ECB ; tickers Stellantis (STLAM, STLAP) qui SONT Stellantis. Vérifier au cas par cas.")
    lines.append("")
    lines.append("**Action correctrice : aucun fichier supprimé. Liste fournie pour rescrape vague 3 ciblé.**")

    OUT_MD.write_text("\n".join(lines))
    print(f"[audit] wrote {OUT_MD}", flush=True)


if __name__ == "__main__":
    main()
