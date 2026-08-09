#!/usr/bin/env python3
# Onboarding AEX 25 + DAX 40 : fiches v2-pipeline + gates + disabled-blocks.
# Idempotent : re-exécutable sans dommage. Aucune invention : tout vient des
# drafts kpis-haut (P2) et des blocs data-lake (P3).
import json, os, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def rj(p):
    with open(p, encoding="utf-8") as f: return json.load(f)
def wj(p, d):
    with open(p, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=1); f.write("\n")

STATE = rj(f"{ROOT}/.conv-state/aexdax-state.json")
UNIV  = rj(f"{ROOT}/.conv-state/aexdax-univers-verifie.json")
TICKERS = STATE["a_traiter"]

names = {}
def walk(o):
    if isinstance(o, dict):
        if "ticker_yahoo" in o and "name" in o: names[o["ticker_yahoo"]] = o["name"]
        for v in o.values(): walk(v)
    elif isinstance(o, list):
        for v in o: walk(v)
walk(UNIV)

SECTEURS = {
 "SHELL.AS":("Énergie","Pétrole et gaz intégrés"),"UNA.AS":("Consommation de base","Biens de grande consommation"),
 "INGA.AS":("Finance","Banque"),"REN.AS":("Technologie","Information professionnelle et analytique"),
 "ASM.AS":("Technologie","Équipements semi-conducteurs"),"PRX.AS":("Technologie","Internet et investissements numériques"),
 "AD.AS":("Consommation de base","Distribution alimentaire"),"ADYEN.AS":("Technologie","Paiements"),
 "ABN.AS":("Finance","Banque"),"HEIA.AS":("Consommation de base","Boissons"),
 "BESI.AS":("Technologie","Équipements semi-conducteurs"),"UMG.AS":("Communication","Musique"),
 "NN.AS":("Finance","Assurance"),"PHIA.AS":("Santé","Technologies médicales"),
 "DSFIR.AS":("Matériaux","Arômes, parfums et nutrition"),"KPN.AS":("Télécommunications","Opérateur télécoms"),
 "WKL.AS":("Technologie","Information professionnelle et logiciels"),"ASRNL.AS":("Finance","Assurance"),
 "AKZA.AS":("Matériaux","Peintures et revêtements"),"EXO.AS":("Finance","Holding d'investissement"),
 "IMCD.AS":("Industrie","Distribution de spécialités chimiques"),"SBMO.AS":("Énergie","Services pétroliers offshore"),
 "AALB.AS":("Industrie","Technologie industrielle"),"ADS.DE":("Consommation discrétionnaire","Équipement sportif"),
 "ALV.DE":("Finance","Assurance"),"BAS.DE":("Matériaux","Chimie"),
 "BAYN.DE":("Santé","Pharmacie et agrochimie"),"BEI.DE":("Consommation de base","Soins de la peau"),
 "BMW.DE":("Consommation discrétionnaire","Automobile premium"),"BNR.DE":("Industrie","Distribution de produits chimiques"),
 "CBK.DE":("Finance","Banque"),"CON.DE":("Consommation discrétionnaire","Pneumatiques"),
 "DTG.DE":("Industrie","Poids lourds"),"DBK.DE":("Finance","Banque"),
 "DB1.DE":("Finance","Infrastructure de marché"),"DHL.DE":("Industrie","Logistique"),
 "DTE.DE":("Télécommunications","Opérateur télécoms"),"EOAN.DE":("Services aux collectivités","Réseaux d'énergie"),
 "FRE.DE":("Santé","Services de santé"),"FME.DE":("Santé","Dialyse"),
 "G1A.DE":("Industrie","Équipements process agroalimentaire"),"HNR1.DE":("Finance","Réassurance"),
 "HEI.DE":("Matériaux","Ciment et matériaux de construction"),"HEN3.DE":("Consommation de base","Adhésifs et grande consommation"),
 "HOT.DE":("Industrie","BTP et concessions"),"IFX.DE":("Technologie","Semi-conducteurs"),
 "MBG.DE":("Consommation discrétionnaire","Automobile premium"),"MRK.DE":("Santé","Sciences de la vie et pharmacie"),
 "MTX.DE":("Industrie","Moteurs d'avion"),"MUV2.DE":("Finance","Réassurance"),
 "QIA.DE":("Santé","Diagnostic moléculaire"),"RHM.DE":("Industrie","Défense"),
 "RWE.DE":("Services aux collectivités","Énergies renouvelables"),"SAP.DE":("Technologie","Logiciels d'entreprise"),
 "G24.DE":("Technologie","Plateformes immobilières"),"SIE.DE":("Industrie","Conglomérat technologique"),
 "ENR.DE":("Industrie","Équipements pour l'énergie"),"SHL.DE":("Santé","Imagerie et diagnostic médical"),
 "SY1.DE":("Matériaux","Arômes et parfums"),"VOW3.DE":("Consommation discrétionnaire","Automobile"),
 "VNA.DE":("Immobilier","Immobilier résidentiel"),"ZAL.DE":("Consommation discrétionnaire","E-commerce mode"),
}

# events pollués relevés en P2/P3 -> désactivation du bloc events
EVENTS_POLLUES = {"ADS.DE","IFX.DE","VOW3.DE","FRE.DE","DSFIR.AS","AKZA.AS","VNA.DE"}
# IA désactivée en P3 (fichier non écrit)
IA_OFF = {"ALV.DE","EOAN.DE","MTX.DE"}
# actionnariat vide (top_capital ET top_voting vides) -> gouvernance_top3_capital off (calculé plus bas aussi)

TODAY = "2026-08-09"
rapport = {"fiches": 0, "fallback_secteur": [], "sans_ia": [], "sans_geo": [], "sans_seg": [], "top3_off": [], "warn": []}

for T in TICKERS:
    low = T.lower()
    draft_p = f"{ROOT}/.batches-drafts-safe/kpis-haut/{T}.json"
    if not os.path.exists(draft_p):
        rapport["warn"].append(f"{T}: draft kpis-haut ABSENT"); continue
    draft = rj(draft_p)
    hero_short = draft.get("hero_kpi")
    hero = next((k for k in draft.get("kpis", []) if k.get("short") == hero_short), None)
    if hero is None and draft.get("kpis"):
        hero = draft["kpis"][0]; rapport["warn"].append(f"{T}: hero '{hero_short}' introuvable, 1er KPI pris")

    dl = f"{ROOT}/data-lake/{T}"
    risks = rj(f"{dl}/risks/extracted.json")["risks"] if os.path.exists(f"{dl}/risks/extracted.json") else []
    gov   = rj(f"{dl}/gouvernance_fr.json")["data"] if os.path.exists(f"{dl}/gouvernance_fr.json") else None
    seg   = rj(f"{dl}/segments_fr.json")["data"] if os.path.exists(f"{dl}/segments_fr.json") else None
    geo   = rj(f"{dl}/geo_fr.json")["data"] if os.path.exists(f"{dl}/geo_fr.json") else None
    ia    = rj(f"{dl}/ia_positionnement_fr.json")["data"] if os.path.exists(f"{dl}/ia_positionnement_fr.json") else None

    if not seg: rapport["sans_seg"].append(T)
    if not geo: rapport["sans_geo"].append(T)
    if not ia:  rapport["sans_ia"].append(T)

    sec, sub = SECTEURS.get(T, ("Industrie", ""))
    if T not in SECTEURS: rapport["fallback_secteur"].append(T)

    fiche = {
        "ticker": T,
        "name": names.get(T, draft.get("company", T)),
        "sector": sec, "subsector": sub,
        "tagline": None, "logo_treatment": "text",
        "_aexdax_note": "Fiche generee par la chaine AEX25+DAX40 du 9 aout 2026 (docs IR 10 ans, extraction verbatim, blocs P3 sources URD)",
        "hero_kpi": hero.get("short") if hero else None,
        "hero_kpi_rationale": draft.get("hero_kpi_rationale"),
        "kpis": [hero] if hero else [],
        "risks": risks,
        "governance": gov,
        "revenue_by_segment": seg,
        "revenue_by_geography": geo,
        "ai_positioning": ia,
        "_maj_at": TODAY, "_maj_by": "aexdax-chain",
        "_validation": {"validated_by": "aexdax-chain", "validated_at": TODAY,
                        "note": "Extraction verbatim des documents IR (10 ans). Controles sommes segments/geo = CA verts en P2 et P3."},
    }
    wj(f"{ROOT}/src/data/v2-pipeline/{low}.json", fiche)
    # neutraliser une eventuelle fiche majuscule divergente (contaminations historiques)
    up_p = f"{ROOT}/src/data/v2-pipeline/{T}.json"
    if os.path.exists(up_p) and up_p != f"{ROOT}/src/data/v2-pipeline/{low}.json":
        wj(up_p, fiche)
    rapport["fiches"] += 1

    # v1-9-complete : remplacer les blocs contamines par les blocs P3 (si le fichier existe)
    v19_p = f"{ROOT}/src/data/v1-9-complete/{T}.json"
    if os.path.exists(v19_p):
        v19 = rj(v19_p)
        if risks: v19["risks"] = risks
        if gov: v19["governance"] = gov
        if seg: v19["revenue_by_segment"] = seg
        elif "revenue_by_segment" in v19: v19["revenue_by_segment"] = None
        if geo: v19["revenue_by_geography"] = geo
        elif "revenue_by_geography" in v19: v19["revenue_by_geography"] = None
        if ia: v19["ai_positioning"] = ia
        elif "ai_positioning" in v19: v19["ai_positioning"] = None
        # identite IVR (HEI.DE et freres) : reprendre l'identite de la fiche
        if v19.get("name") in ("IVR",) or "waterway" in str(v19.get("tagline", "")).lower():
            v19["name"] = fiche["name"]; v19["sector"] = sec; v19["subsector"] = sub; v19["tagline"] = None
            rapport["warn"].append(f"{T}: identite IVR remplacee dans v1-9-complete")
        v19["_maj_at"] = TODAY; v19["_maj_by"] = "aexdax-chain"
        wj(v19_p, v19)

# identite IVR dans companies/ et v2-pipeline/ (HEI.DE releve en P2)
for pth in (f"{ROOT}/src/data/companies/HEI.DE.json", f"{ROOT}/src/data/companies/hei.de.json"):
    if os.path.exists(pth):
        c = rj(pth)
        if c.get("name") == "IVR" or "waterway" in str(c.get("tagline", "")).lower():
            c["name"] = names.get("HEI.DE", "Heidelberg Materials")
            c["sector"], c["subsector"] = SECTEURS["HEI.DE"]; c["tagline"] = None
            wj(pth, c); rapport["warn"].append(f"{pth.split('/')[-1]}: identite IVR corrigee")

# hero_kpi_override obsolete DTG + KPI tna_rev invente (releve en P2)
enr_p = f"{ROOT}/src/data/v2-pipeline-enrich/dtg.de.json"
if os.path.exists(enr_p):
    e = rj(enr_p); ch = False
    if e.get("hero_kpi_override") == "tna_rev": del e["hero_kpi_override"]; ch = True
    if isinstance(e.get("kpis"), list):
        n = len(e["kpis"]); e["kpis"] = [k for k in e["kpis"] if k.get("short") != "tna_rev"]
        if len(e["kpis"]) != n: ch = True
    if ch: wj(enr_p, e); rapport["warn"].append("dtg.de enrich: override + tna_rev purges")

# gates
pub = rj(f"{ROOT}/src/data/v1-7-public.json")
for T in TICKERS:
    if T not in pub:
        pub[T] = {"ticker": T, "name": names.get(T, T), "sector": SECTEURS.get(T, ("", ""))[0],
                  "subsector": "", "hero_kpi": "", "kpis": [],
                  "_aexdax_gate_note": "Entree minimale ajoutee 09.08.2026 pour la redirection /<t> vers /sandbox/v1-9-5/<t>"}
wj(f"{ROOT}/src/data/v1-7-public.json", pub)

cat = rj(f"{ROOT}/src/data/v1-9-5-clean-all-tickers.json")
added = [T for T in TICKERS if T not in cat["tickers"]]
cat["tickers"] = sorted(set(cat["tickers"]) | set(TICKERS))
cat["count"] = len(cat["tickers"])
cat["_aexdax_note"] = f"AEX 25 + DAX 40 ajoutes le {TODAY} ({len(added)} nouveaux)"
wj(f"{ROOT}/src/data/v1-9-5-clean-all-tickers.json", cat)

db = rj(f"{ROOT}/src/data/disabled-blocks-per-ste.json")
ov = db.setdefault("overrides", {})
for T in TICKERS:
    off = set(ov.get(T, []))
    gp = f"{ROOT}/data-lake/{T}/gouvernance_fr.json"
    if os.path.exists(gp):
        g = rj(gp)["data"]
        if not g.get("top_capital") and not g.get("top_voting"):
            off.add("gouvernance_top3_capital"); rapport["top3_off"].append(T)
    else:
        off.add("gouvernance")
    if T in IA_OFF or not os.path.exists(f"{ROOT}/data-lake/{T}/ia_positionnement_fr.json"):
        off.add("ai_positioning")
    if T in EVENTS_POLLUES:
        off.add("events")
    if off: ov[T] = sorted(off)
wj(f"{ROOT}/src/data/disabled-blocks-per-ste.json", db)

print(json.dumps(rapport, ensure_ascii=False, indent=1))
print(f"clean-all: {cat['count']} tickers (+{len(added)})")
