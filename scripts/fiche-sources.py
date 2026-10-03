#!/usr/bin/env python3
"""Carte des sources d une fiche societe (Yann, 4 oct 2026).

Point d entree UNIQUE pour verifier ou corriger une fiche : pour chaque bloc, affiche la valeur
reellement servie (chargeur du site), toutes les sources candidates, celle qui gagne, et LE fichier
a modifier. Regles de priorite : docs/SOURCES-FICHES.md (relevees dans load-company.ts le 4 oct 2026).

Usage : python3 scripts/fiche-sources.py TICKER [--bloc gouvernance|risques|tam|repartition|kpi|ia|textes] [--json]
"""
import json, os, subprocess, sys, tempfile

ROOT = "/Users/yann/spx-app"
os.chdir(ROOT)
args = [a for a in sys.argv[1:] if not a.startswith("--")]
if not args:
    print(__doc__); sys.exit(1)
T = args[0].upper(); t = T.lower()
BLOC = sys.argv[sys.argv.index("--bloc") + 1] if "--bloc" in sys.argv else None
JSON_OUT = "--json" in sys.argv

def lire(p):
    try:
        return json.load(open(p))
    except Exception:
        return None

PL_P = f"src/data/v2-pipeline/{t}.json"
EN_P = f"src/data/v2-pipeline-enrich/{t}.json"
KH_P = f".batches-drafts-safe/kpis-haut/{T}.json"
PL, EN, KH = lire(PL_P) or {}, lire(EN_P) or {}, lire(KH_P)

# Valeur reellement servie : le vrai chargeur du site
servi = {}
with tempfile.TemporaryDirectory() as d:
    r = subprocess.run(["npx", "tsx", "scripts/verif-fiches/dump-fiches-servies.ts", d, T], capture_output=True, text=True)
    for f in os.listdir(d):
        if f.lower().startswith(t) and f.endswith(".json"):
            servi = lire(os.path.join(d, f)) or {}
    if not servi:
        print("ATTENTION : fiche non servie par le chargeur (hors univers ou non admise).", r.stderr[-300:])

def vide(v):
    return v in (None, "", [], {})

def gov(o, k):
    g = o.get("governance") if isinstance(o.get("governance"), dict) else {}
    return g.get(k)

carte = {}

# Gouvernance : PL > EN.governance (si PL vide) ; EN.overrides_governance ne remplit que les vides
for k in ("top_capital", "top_voting"):
    cands = {
        f"{PL_P} governance.{k}": gov(PL, k),
        f"{EN_P} governance.{k}": gov(EN, k),
        f"{EN_P} overrides_governance.{k}": (EN.get("overrides_governance") or {}).get(k),
    }
    gagnant = next((p for p, v in cands.items() if not vide(v)), None)
    carte[f"gouvernance.{k}"] = {"servi": (servi.get("governance") or {}).get(k), "sources": cands, "a_corriger": gagnant or f"{PL_P} governance.{k}"}

# Risques : EN gagne si EN._risks_reextracted_at, sinon PL
r_en = bool(EN.get("_risks_reextracted_at")) and not vide(EN.get("risks"))
carte["risques"] = {"servi": len(servi.get("risks") or []), "sources": {f"{PL_P} risks": len(PL.get("risks") or []), f"{EN_P} risks": len(EN.get("risks") or [])},
                    "a_corriger": f"{EN_P} risks" if r_en else f"{PL_P} risks"}

# TAM : tam.json gagne si _arbitrage_proprietaire, sinon PL.market_positions
TAM_P = f"src/data/v2-pipeline-enrich/{t}.tam.json"; tam = lire(TAM_P)
arb = isinstance(tam, dict) and tam.get("_arbitrage_proprietaire") is True
carte["tam"] = {"servi": servi.get("market_positions"), "sources": {f"{PL_P} market_positions": PL.get("market_positions"), TAM_P: tam},
                "a_corriger": TAM_P if arb or vide(PL.get("market_positions")) else f"{PL_P} market_positions"}

# Repartition du CA : PL > EN (EN seulement si PL vide)
for k in ("revenue_by_segment", "revenue_by_geography"):
    carte[f"repartition.{k}"] = {"servi": servi.get(k), "sources": {f"{PL_P} {k}": PL.get(k), f"{EN_P} {k}": EN.get(k)},
                                 "a_corriger": f"{PL_P} {k}" if not vide(PL.get(k)) else f"{EN_P} {k}"}

# KPI : si kpis-haut existe, il REMPLACE la liste (sauf _source dans KEPT_SOURCES) ; kpi-annuel-fiche ajoute ensuite
KA_P = f"src/data/kpi-annuel-fiche/{T}.json"; KA = lire(KA_P) or {}
shorts_kh = {k.get("short") for k in (KH or {}).get("kpis", [])} if isinstance(KH, dict) else set()
shorts_ka = {k.get("short") for k in KA.get("kpis", [])}
kpis = []
for k in servi.get("kpis") or []:
    s = k.get("short")
    src = KH_P if s in shorts_kh else (KA_P if s in shorts_ka else f"{EN_P} / {PL_P} / v2-pipeline-specific-kpis (_source={k.get('_source')})")
    kpis.append({"short": s, "nom": k.get("name_fr"), "derniere_valeur": k.get("value"), "unite": k.get("unit"), "a_corriger": src})
carte["kpi"] = {"hero_servi": servi.get("hero_kpi"), "hero_a_corriger": "Supabase desk_hero_kpi_overrides (prioritaire) puis " + KH_P, "kpis": kpis}

# Positionnement IA
AI_P = f"src/data/v2-pipeline-enrich/{t}.ai-pos.json"
carte["ia"] = {"servi": (servi.get("ai_positioning") or {}).get("stance"),
               "sources": {f"{PL_P} ai_positioning": (PL.get("ai_positioning") or {}).get("stance"), AI_P: (lire(AI_P) or {}).get("stance") if isinstance(lire(AI_P), dict) else None,
                           f"{EN_P} ai_positioning_override": EN.get("ai_positioning_override")},
               "a_corriger": "voir docs/SOURCES-FICHES.md (ai-pos.json gagne si PL faible ; override de stance canonique en dernier)"}

# Textes et blocs a source unique
carte["textes"] = {
    "these": "Supabase desk_these (prioritaire) puis src/data/these/" + t + ".json",
    "anti_these": "Supabase desk_att (prioritaire) puis src/data/att/" + t + ".json",
    "clients": f"docs/cahier/clients/{T}.json", "moat": "src/data/moat-univers.json",
    "description": f"src/data/v2-pipeline-enrich/{t}.mettrik-description.json (sinon {t}.description.json)",
    "synthese_appels": f"src/data/transcript-summaries/{t}.json", "kpi_annuels": KA_P,
    "documents_sources": f"data-lake/{T}/ (SEC : 10K 10Q 8K DEF14A ; Europe : ir/URD ir/CP ir/TRIM ; homonymes ecartes : data-lake/_homonymes-sec/)",
}

if BLOC:
    carte = {k: v for k, v in carte.items() if k.startswith(BLOC) or (BLOC == "gouvernance" and k.startswith("gouvernance"))}
if JSON_OUT:
    print(json.dumps(carte, ensure_ascii=False, indent=1, default=str)); sys.exit(0)
for k, v in carte.items():
    print(f"\n== {k}")
    if isinstance(v, dict):
        for kk, vv in v.items():
            s = json.dumps(vv, ensure_ascii=False, default=str)
            print(f"  {kk}: {s[:400]}")
