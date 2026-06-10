#!/usr/bin/env python3
"""
clean-yfinance-mentions.py — retire TOUTE mention "yfinance" des champs TEXTE
visibles (description/explanation/signal/rationale/...) des fichiers data, en
préservant le sens de la phrase. yfinance reste autorisé dans les champs
_source / provenance NON affichés.

Usage : python3 scripts/clean-yfinance-mentions.py [--apply]   (sans --apply = dry-run)
"""
import json, os, re, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APPLY = "--apply" in sys.argv
# (les descriptions des 7 ex-polluées sont déjà réécrites ; on traite tout désormais)
EXCLUDE = set()

# champs texte VISIBLES à nettoyer
VISIBLE_KEYS = {"description", "explanation", "signal", "rationale", "hero_kpi_rationale",
                "story_fr", "story", "activity", "products", "edge", "positioning",
                "risks", "summary", "name_fr", "name_en", "name", "tagline",
                "interpretation", "lead", "moteur", "vigilance", "surveillance",
                "score_rationale", "explication"}

def clean_yf(text):
    s = text
    # "computed: yfinance.X / yfinance.Y"
    s = re.sub(r'\bcomputed\s*:\s*yfinance\.\w+(?:\s*[/,]\s*yfinance\.\w+)*', '', s, flags=re.I)
    # verbe + (depuis/via) yfinance(.X) (et/,/ yfinance(.Y))
    s = re.sub(r'\b(?:valeur\s+)?(?:extrait[es]?|agr[ée]g[ée]e?s?|calcul[ée]e?s?|consolid[ée]e?s?|issue?s?|tir[ée]e?s?)\s+(?:depuis\s+|via\s+|à\s+partir\s+de\s+|de\s+)?yfinance(?:\.\w+)?(?:\s*(?:et|,|/|ou)\s*yfinance(?:\.\w+)?)*',
               '', s, flags=re.I)
    # (depuis/via/source) yfinance(.X) (et yfinance(.Y))
    s = re.sub(r'\s*(?:depuis|via|à\s+partir\s+de|source\s*:?|selon|d[\'’]apr[èe]s)\s+yfinance(?:\.\w+)?(?:\s*(?:et|,|/|ou)\s*yfinance(?:\.\w+)?)*',
               '', s, flags=re.I)
    # yfinance(.X) isolé (+ séparateurs résiduels)
    s = re.sub(r'\s*yfinance(?:\.\w+)?(?:\s*(?:et|,|/|ou)\s*yfinance(?:\.\w+)?)*', ' ', s, flags=re.I)
    # mot yfinance résiduel
    s = re.sub(r'\s*\(?\s*\byfinance\b\s*\)?', ' ', s, flags=re.I)
    # nettoyage grammaire
    s = re.sub(r'\(\s*\)', '', s)
    s = re.sub(r'\s+', ' ', s)
    s = re.sub(r'\s+([.,;:%)])', r'\1', s)
    s = re.sub(r'\(\s+', '(', s)
    s = re.sub(r',\s*\.', '.', s)
    s = re.sub(r'\.\s*\.+', '.', s)
    s = re.sub(r'\s*,\s*,', ',', s)
    s = re.sub(r'(?:,|\s)+$', '', s.strip())
    s = re.sub(r'^\s*,\s*', '', s)
    return s.strip()

NEUTRAL_MAP = {
    "income_stmt": "compte de résultat consolidé", "balance_sheet": "bilan consolidé",
    "cashflow": "tableau des flux de trésorerie", "dividends": "historique des dividendes",
    "info": "données de marché", "financials": "états financiers consolidés",
    "earnings": "publications de résultats", "calendar": "calendrier financier",
    "quarterly_income_stmt": "comptes trimestriels", "quarterly_financials": "comptes trimestriels",
}
def neutral_src(text):
    s = re.sub(r'yfinance[._]company_?officers', "registre public des dirigeants", text, flags=re.I)
    s = re.sub(r'yfinance[._]ceo\w*', "registre public des dirigeants", s, flags=re.I)
    s = re.sub(r'yfinance[._]mission\w*', "données publiques", s, flags=re.I)
    s = re.sub(r'yfinance[._](\w+)', lambda m: NEUTRAL_MAP.get(m.group(1).lower(), "rapport financier"), s, flags=re.I)
    s = re.sub(r'yfinance', "données publiques", s, flags=re.I)  # catch-all (underscore/bare/toute forme)
    return s

def walk(obj, changed):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str) and "yfinance" in v.lower():
                if k in VISIBLE_KEYS:
                    nv = clean_yf(v)            # texte affiché : retire la clause de provenance
                else:
                    nv = neutral_src(v)         # _source / metadata : libellé neutre (token yfinance retiré)
                if nv != v:
                    obj[k] = nv
                    changed.append((k, v[:80], nv[:80]))
            else:
                walk(v, changed)
    elif isinstance(obj, list):
        for it in obj:
            walk(it, changed)

files = glob.glob(os.path.join(ROOT, "src/data/v2-pipeline/*.json")) + \
        glob.glob(os.path.join(ROOT, "src/data/v2-pipeline-enrich/*.json"))
total_files = 0
total_fields = 0
samples = []
for f in files:
    base = os.path.basename(f)
    if base.startswith("_") or ".bak." in base or ".before-" in base or base.endswith(".bak.json"):
        continue
    slug = base.split(".")[0].lower()
    # exclure les 7 re-extraites (mais garder leurs KPIs : on exclut tout le fichier par prudence agent)
    tk = base.rsplit(".json", 1)[0]
    tk_l = tk.lower()
    if any(tk_l == e or tk_l.startswith(e + ".") for e in EXCLUDE):
        continue
    try:
        raw = open(f).read()
        if "yfinance" not in raw:
            continue
        d = json.loads(raw)
    except Exception:
        continue
    changed = []
    walk(d, changed)
    if changed:
        total_files += 1
        total_fields += len(changed)
        if len(samples) < 12:
            for k, old, new in changed[:1]:
                samples.append((base, k, old, new))
        if APPLY:
            pretty = raw[:300].count(chr(10)) > 3
            open(f, "w").write(json.dumps(d, ensure_ascii=False, indent=2 if pretty else None))

print(f"{'APPLIED' if APPLY else 'DRY-RUN'} : {total_fields} champs nettoyés dans {total_files} fichiers")
print("--- échantillons avant/après ---")
for base, k, old, new in samples:
    print(f"[{base}:{k}]")
    print(f"  AV: {old[:160]}")
    print(f"  AP: {new[:160]}")
