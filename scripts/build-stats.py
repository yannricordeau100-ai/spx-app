#!/usr/bin/env python3
"""Génère sec-data/_meta/stats.txt — récap par catégorie + par pays."""

import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from datetime import datetime

ROOT = Path.home() / "spx-app" / "sec-data"
META = ROOT / "_meta"

# Map name -> country pour cat3 (depuis eu-download.py)
def load_eu_country_map():
    p = Path(__file__).parent / "eu-download.py"
    txt = p.read_text()
    m = re.search(r"EU_COMPANIES = \[(.*?)\]\s*\n# D[ée]dupliquer", txt, re.DOTALL) or \
        re.search(r"EU_COMPANIES = \[(.*?)\nseen", txt, re.DOTALL)
    if not m:
        return {}
    entries = re.findall(r'\("([^"]+)",\s*"([A-Z]{2})"\)', m.group(1))
    return dict(entries)


def slug(n):
    return re.sub(r"[^a-zA-Z0-9]+", "_", n).strip("_")[:80]


def main():
    sec_idx_path = META / "cat1-cat2-index.json"
    eu_idx_path = META / "cat3-european-index.json"
    sec_idx = json.loads(sec_idx_path.read_text()) if sec_idx_path.exists() else {}
    eu_idx = json.loads(eu_idx_path.read_text()) if eu_idx_path.exists() else {}
    eu_map = load_eu_country_map()

    # === Cat 1 / Cat 2 stats ===
    cat1_count = 0
    cat2_count = 0
    cat2_canadian = 0
    cat_other = 0  # ETFs, trusts, S-1 filers, etc.
    forms_in_cat1 = Counter()
    forms_in_cat2 = Counter()

    for ticker, data in sec_idx.items():
        forms_set = {f["form"] for f in data["filings"]}
        # Classification
        is_us = "10-K" in forms_set
        is_fpi = "20-F" in forms_set
        is_can = "40-F" in forms_set

        if is_us:
            cat1_count += 1
        elif is_fpi:
            cat2_count += 1
        elif is_can:
            cat2_canadian += 1
        else:
            cat_other += 1

        for f in data["filings"]:
            form = f["form"]
            if form in ("10-K", "10-Q", "8-K", "DEF 14A", "3", "4", "5"):
                forms_in_cat1[form] += 1
            elif form in ("20-F", "6-K", "40-F"):
                forms_in_cat2[form] += 1

    # === Cat 3 stats par pays ===
    cat3_per_country = Counter()
    cat3_filings_per_country = Counter()
    cat3_years_per_country = defaultdict(list)
    slug_to_name = {slug(n): n for n in eu_map}

    for s, data in eu_idx.items():
        name = slug_to_name.get(s, s)
        country = eu_map.get(name, "??")
        if data.get("filings"):
            cat3_per_country[country] += 1
            for f in data["filings"]:
                cat3_filings_per_country[country] += 1
                yr = f.get("year")
                if yr and yr != "unknown":
                    try:
                        cat3_years_per_country[country].append(int(yr))
                    except ValueError:
                        pass

    cat3_targeted = Counter(eu_map.values())

    # === Output ===
    out = []
    out.append("=" * 70)
    out.append(f"SEC-DATA STATS · généré le {datetime.utcnow().isoformat()}Z")
    out.append("=" * 70)
    out.append("")
    out.append("TROIS CATÉGORIES")
    out.append("  Cat 1 = sociétés US (10-K filers)")
    out.append("  Cat 2 = sociétés étrangères cotées aux USA (ADR : 20-F, MJDS : 40-F)")
    out.append("  Cat 3 = sociétés européennes (EuroSTOXX 600 cible)")
    out.append("")
    out.append("─" * 70)
    out.append("CATÉGORIE 1 — Sociétés US (10-K filers)")
    out.append("─" * 70)
    out.append(f"  Sociétés US   : {cat1_count:,}")
    out.append("  Sélection     : top 2000 par capi-boursière + S&P 500/400/600 priority")
    out.append("                  (en pratique : tout reporter SEC qui a filé un 10-K récent)")
    out.append("  Forms téléchargés (filings totaux par form) :")
    for f in ("10-K", "10-Q", "8-K", "DEF 14A", "3", "4", "5"):
        n = forms_in_cat1.get(f, 0)
        out.append(f"    {f:10s} : {n:>7,}")
    out.append("")
    out.append("  STATUT : période actuelle = derniers filings (1 × 10-K, 4 × 10-Q,")
    out.append("           1 × DEF14A, ~8 × 8-K des 12 derniers mois)")
    out.append("  À FAIRE : étendre à 5 dernières années + ajouter Forms 3/4/5")
    out.append("            (insider transactions) — voir _meta/plan.md")
    out.append("")
    out.append("─" * 70)
    out.append("CATÉGORIE 2 — Sociétés étrangères cotées aux USA")
    out.append("─" * 70)
    out.append(f"  Foreign Private Issuers (20-F) : {cat2_count:,}")
    out.append(f"  Canadian filers (40-F)         : {cat2_canadian:,}")
    out.append(f"  TOTAL CAT 2                    : {cat2_count + cat2_canadian:,}")
    out.append("")
    out.append("  Filtre demandé : market cap > 1 Md $")
    out.append("  STATUT : non appliqué (besoin source de données market cap)")
    out.append("           pour l'instant TOUTES les ADR + 40-F sont incluses")
    out.append("  À FAIRE : récupérer market cap (Yahoo / IEX gratuit) + filtrer")
    out.append("")
    out.append("  Forms téléchargés :")
    for f in ("20-F", "6-K", "40-F"):
        n = forms_in_cat2.get(f, 0)
        out.append(f"    {f:10s} : {n:>7,}")
    out.append("")
    out.append("─" * 70)
    out.append("AUTRES filers SEC (cat 1+2 secondaire)")
    out.append("─" * 70)
    out.append(f"  Autres        : {cat_other:,}  (ETFs, trusts, S-1 filers, MLP, ADRs sans 20-F récent)")
    out.append(f"  TOTAL SEC indexées : {len(sec_idx):,}")
    out.append("")
    out.append("─" * 70)
    out.append("CATÉGORIE 3 — Sociétés européennes (EuroSTOXX 600)")
    out.append("─" * 70)
    out.append(f"  Liste cible (curated) : {sum(cat3_targeted.values())}")
    out.append(f"  Sociétés trouvées avec doc(s) : {sum(cat3_per_country.values())}")
    out.append(f"  Source : AnnualReports.com (gratuit, sans API key)")
    out.append("")
    out.append(f"  {'Pays':5} {'Cible':>6} {'Trouvées':>9} {'Couv.':>7}  {'Période':<13} {'Filings':>8}")
    out.append(f"  {'-'*5} {'-'*6} {'-'*9} {'-'*7}  {'-'*13} {'-'*8}")
    total_targeted = total_found = total_filings = 0
    for c in sorted(cat3_targeted):
        cible = cat3_targeted[c]
        found = cat3_per_country.get(c, 0)
        flgs = cat3_filings_per_country.get(c, 0)
        yrs = cat3_years_per_country.get(c, [])
        period = f"{min(yrs)}-{max(yrs)}" if yrs else "—"
        cov = f"{100*found/cible:.0f}%" if cible else "—"
        out.append(f"  {c:5} {cible:>6} {found:>9} {cov:>7}  {period:<13} {flgs:>8}")
        total_targeted += cible
        total_found += found
        total_filings += flgs
    cov = f"{100*total_found/total_targeted:.0f}%" if total_targeted else "—"
    out.append(f"  {'-'*5} {'-'*6} {'-'*9} {'-'*7}  {'-'*13} {'-'*8}")
    out.append(f"  {'TOTAL':5} {total_targeted:>6} {total_found:>9} {cov:>7}  {'2011-2024':<13} {total_filings:>8}")
    out.append("")
    out.append("  Doc types téléchargés : Rapports annuels (URD) UNIQUEMENT.")
    out.append("  À FAIRE : Rapports semestriels, communiqués ad-hoc (MAR),")
    out.append("            déclarations transactions — nécessite OAM nationaux")
    out.append("            par pays (Companies House UK, AMF, BaFin, etc.)")
    out.append("")
    out.append("─" * 70)
    out.append("DOCUMENTS À AJOUTER (placeholders prêts dans chaque catégorie)")
    out.append("─" * 70)
    out.append("  - ER (Earnings Releases / presentations)")
    out.append("  - Call transcripts trimestriels")
    out.append("  - Investor day decks")
    out.append("  - Sustainability reports (CSRD européen)")
    out.append("  - Capital market days")
    out.append("  Localisation : <cat>/_placeholder_ER/, _placeholder_transcripts/, _placeholder_other/")
    out.append("")
    out.append("=" * 70)

    out_text = "\n".join(out) + "\n"
    (META / "stats.txt").write_text(out_text)
    print(out_text)


if __name__ == "__main__":
    main()
