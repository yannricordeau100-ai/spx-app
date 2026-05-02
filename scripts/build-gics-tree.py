#!/usr/bin/env python3
"""
Construit l'arborescence GICS dans chaque catégorie (cat1/cat2/cat3) :

  <cat>/_gics/
    <secCode>-<secName>/
      <igCode>-<igName>/
        <indCode>-<indName>/
          <subCode>-<subName>/
            companies.txt    (1 ligne par société, vide initialement)

Génère aussi :
  _meta/gics-163-master.md          (référence GICS complète)
  _meta/gics-163-companies.txt      (mapping sub-industry -> sociétés, global)
  _meta/cat<N>-index-alpha.txt      (sociétés par cat, ordre alphabétique avec GICS)
"""

import json
import re
from pathlib import Path
from datetime import datetime

import sys
sys.path.insert(0, str(Path(__file__).parent))
from gics_taxonomy import GICS, all_sub_industries, counts

ROOT = Path.home() / "spx-app" / "sec-data"
META = ROOT / "_meta"
CATS = ["cat1-us", "cat2-foreign-adr", "cat3-european"]


def safe(s: str) -> str:
    """Sanitise un nom pour usage en chemin de fichier."""
    return re.sub(r"[/\\<>:|?*]", "_", s).strip()


def build_tree(cat_root: Path):
    gics_root = cat_root / "_gics"
    gics_root.mkdir(parents=True, exist_ok=True)
    n_subs = 0
    for sec_code, sec in GICS.items():
        sec_dir = gics_root / f"{sec_code}-{safe(sec['name'])}"
        sec_dir.mkdir(exist_ok=True)
        # README au niveau secteur
        (sec_dir / "_README.txt").write_text(
            f"Secteur GICS {sec_code} — {sec['name']} ({sec['name_fr']})\n"
            f"Groupes d'industries : {len(sec['groups'])}\n"
        )
        for ig_code, ig in sec["groups"].items():
            ig_dir = sec_dir / f"{ig_code}-{safe(ig['name'])}"
            ig_dir.mkdir(exist_ok=True)
            for ind_code, ind in ig["industries"].items():
                ind_dir = ig_dir / f"{ind_code}-{safe(ind['name'])}"
                ind_dir.mkdir(exist_ok=True)
                for sub_code, sub_name in ind["sub"].items():
                    sub_dir = ind_dir / f"{sub_code}-{safe(sub_name)}"
                    sub_dir.mkdir(exist_ok=True)
                    companies_file = sub_dir / "companies.txt"
                    if not companies_file.exists():
                        companies_file.write_text(
                            f"# Sociétés dans la sous-industrie GICS {sub_code} — {sub_name}\n"
                            f"# Catégorie : {cat_root.name}\n"
                            f"# Format : <ticker> | <nom> | <pays>\n"
                            f"# Ce fichier sera populé par scripts/populate-gics.py\n"
                            f"\n"
                        )
                    n_subs += 1
    return n_subs


def write_master_md():
    out = []
    out.append(f"# GICS 2024 · Référence des 163 sous-industries\n")
    n_sec, n_ig, n_ind, n_sub = counts()
    out.append(f"_Source : S&P Dow Jones Indices / MSCI · méthodologie août 2024_\n\n")
    out.append(f"**Hiérarchie totale :** {n_sec} secteurs → {n_ig} groupes → {n_ind} industries → {n_sub} sous-industries.\n\n")
    out.append("## Table complète\n\n")
    out.append("| Code | Sous-industrie | Industrie | Groupe | Secteur |\n")
    out.append("|---|---|---|---|---|\n")
    for sec_code, sec_name, ig_code, ig_name, ind_code, ind_name, sub_code, sub_name in all_sub_industries():
        out.append(f"| `{sub_code}` | {sub_name} | {ind_name} | {ig_name} | **{sec_name}** |\n")
    out.append("\n")
    out.append("## Arborescence par secteur\n\n")
    for sec_code, sec in GICS.items():
        out.append(f"### {sec_code} — {sec['name']} ({sec['name_fr']})\n\n")
        for ig_code, ig in sec["groups"].items():
            out.append(f"- **{ig_code} — {ig['name']}**\n")
            for ind_code, ind in ig["industries"].items():
                out.append(f"  - {ind_code} — {ind['name']}\n")
                for sub_code, sub_name in ind["sub"].items():
                    out.append(f"    - `{sub_code}` {sub_name}\n")
        out.append("\n")
    META.mkdir(parents=True, exist_ok=True)
    (META / "gics-163-master.md").write_text("".join(out))
    return len(all_sub_industries())


def write_global_companies_template():
    """Crée le fichier global qui recense toutes les sociétés par sous-industrie.
    Vide initialement, sera populé par populate-gics.py."""
    out = []
    out.append(f"# GICS 163 · Sociétés par sous-industrie · global (cat1 + cat2 + cat3)\n")
    out.append(f"# Généré : {datetime.utcnow().isoformat()}Z\n")
    out.append(f"# Format : <gics_code> | <sub-industry name> ↓\n")
    out.append(f"#   <ticker_or_slug> | <nom> | <cat> | <pays>\n")
    out.append(f"# Note : populé par scripts/populate-gics.py (à venir)\n\n")
    for sec_code, sec_name, ig_code, ig_name, ind_code, ind_name, sub_code, sub_name in all_sub_industries():
        out.append(f"\n=== {sub_code} | {sub_name} (Industrie : {ind_name} · Secteur : {sec_name}) ===\n")
        out.append("(aucune société classée)\n")
    (META / "gics-163-companies.txt").write_text("".join(out))


def write_alpha_indexes():
    """Crée les index alphabétiques par catégorie.
    Format : <name> | <ticker_or_slug> | <country> | <gics_sub_code> | <gics_sub_name>
    Sera enrichi par populate-gics.py.
    """
    sec_idx_path = META / "cat1-cat2-index.json"
    eu_idx_path = META / "cat3-european-index.json"
    sec_idx = json.loads(sec_idx_path.read_text()) if sec_idx_path.exists() else {}
    eu_idx = json.loads(eu_idx_path.read_text()) if eu_idx_path.exists() else {}

    # Cat1 = US (10-K filers) ; Cat2 = FPI (20-F or 40-F) ; Cat3 = EU
    cat1_companies = []
    cat2_companies = []
    cat_other = []

    for ticker, data in sec_idx.items():
        forms = {f["form"] for f in data["filings"]}
        name = data.get("name", ticker)
        if "10-K" in forms:
            cat1_companies.append((ticker, name, "US"))
        elif "20-F" in forms:
            cat2_companies.append((ticker, name, "??"))  # country needs SIC fetch
        elif "40-F" in forms:
            cat2_companies.append((ticker, name, "CA"))
        else:
            cat_other.append((ticker, name, "??"))

    cat3_companies = []
    for slug, data in eu_idx.items():
        name = data.get("name", slug)
        country = data.get("country", "??")
        cat3_companies.append((slug, name, country))

    def write_index(cat_name: str, companies: list[tuple[str, str, str]], cat_label: str):
        companies_sorted = sorted(companies, key=lambda x: x[1].lower())
        lines = []
        lines.append(f"# Index alphabétique · {cat_label}\n")
        lines.append(f"# Généré : {datetime.utcnow().isoformat()}Z\n")
        lines.append(f"# Format : <nom> | <ticker_or_slug> | <pays> | <gics_sub_code> | <gics_sub_name>\n")
        lines.append(f"# Note : la classification GICS sera ajoutée par scripts/populate-gics.py\n\n")
        for slug, name, country in companies_sorted:
            lines.append(f"{name} | {slug} | {country} | (TBD) | (TBD)\n")
        (META / f"{cat_name}-index-alpha.txt").write_text("".join(lines))
        return len(companies_sorted)

    n1 = write_index("cat1-us", cat1_companies, "Cat 1 — Sociétés US (10-K filers)")
    n2 = write_index("cat2-foreign-adr", cat2_companies, "Cat 2 — Sociétés étrangères cotées aux USA (20-F, 40-F)")
    n3 = write_index("cat3-european", cat3_companies, "Cat 3 — Sociétés européennes (EuroSTOXX 600 cible)")
    return n1, n2, n3


def main():
    print("== Construction de l'arborescence GICS ==")
    n_sec, n_ig, n_ind, n_sub = counts()
    print(f"Taxonomie : {n_sec} secteurs / {n_ig} groupes / {n_ind} industries / {n_sub} sous-industries")
    print()

    for cat_name in CATS:
        cat_root = ROOT / cat_name
        if not cat_root.exists():
            print(f"  ! {cat_root} n'existe pas, skip")
            continue
        n = build_tree(cat_root)
        print(f"  ✓ {cat_name} : {n} sous-industries créées")
    print()

    print("Génération _meta/gics-163-master.md...")
    n = write_master_md()
    print(f"  ✓ {n} sous-industries listées")
    print()

    print("Génération _meta/gics-163-companies.txt (template)...")
    write_global_companies_template()
    print(f"  ✓ template global créé")
    print()

    print("Génération index alphabétiques...")
    n1, n2, n3 = write_alpha_indexes()
    print(f"  ✓ cat1-us-index-alpha.txt        : {n1:>5} sociétés")
    print(f"  ✓ cat2-foreign-adr-index-alpha.txt : {n2:>5} sociétés")
    print(f"  ✓ cat3-european-index-alpha.txt    : {n3:>5} sociétés")
    print()
    print("== Terminé. Mapping company→GICS reste à faire (populate-gics.py). ==")


if __name__ == "__main__":
    main()
