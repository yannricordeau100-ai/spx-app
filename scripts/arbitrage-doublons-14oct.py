#!/usr/bin/env python3
"""Arbitrage des 148 paires « a verifier » du scan des doublons servis (14 oct 2026).

Consigne Yann : decider cas par cas, avec preuve chiffree.
- deux libelles pour la meme mesure (ecart < 0,5 % sur toutes les periodes communes) : garder la
  serie la plus longue et la plus recente, retirer l autre de l affichage (sans perte : archive
  `_doublons_retires_13oct` ou `disabled-kpis-per-ste`) ; ligne jaune rebranchee ;
- « Dette long terme » / « Dette totale » a valeurs egales : lecture du dernier 10-K (data-lake) :
  pas de dette a court terme -> « Dette totale » seule ; dette a court terme -> la serie dont le
  libelle ne correspond pas aux valeurs est retiree ;
- mesures differentes mais proches : les deux restent, libelles explicites.

Reutilise les outils de scripts/scan-kpi-doublons-servis.py.
Usage : python3 scripts/arbitrage-doublons-14oct.py <dump.json> [--apply]
Sortie : .conv-state/kpi-doublons-arbitrage-14oct.json
"""
import collections, importlib.util, json, os, re, shutil, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
sys.argv_saved = list(sys.argv)
sys.argv = [sys.argv[0]]
spec = importlib.util.spec_from_file_location("sds", "scripts/scan-kpi-doublons-servis.py")
sds = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sds)
sys.argv = sys.argv_saved
sdc = sds.sdc
APPLY = "--apply" in sys.argv
DUMP = next(a for a in sys.argv[1:] if not a.startswith("--"))
D = json.load(open(DUMP))
R = json.load(open(".conv-state/kpi-doublons-servis-recomptage-13oct.json"))
HEROS = sdc.heros()
AUJ = "2026-10-14"

# --- decisions par ticker (preuves : rapport doublons-v2-pipeline-13oct.md, section Decisions) ---
# Dette : annuelle « Dette totale » (reperes, 10-K) gardee, trimestrielle « Dette long terme » retiree
# (aucune dette a court terme au dernier 10-K, ou serie trimestrielle qui contient la part courante)
DETTE_GARDE_ANNUELLE = "ADSK AIZ ALL ARE AZO BR BRO CBOE CRWD CSGP EW IR IVZ META MGM MLM MSCI ORLY REG REGN WST WYNN CF KLAC PSA".split()
# Dette : serie trimestrielle gardee, annuelle « Dette totale » retiree
DETTE_GARDE_TRIM = "ADBE MAS SLB ES EOG INTU PTC SPG FANG".split()
# Dette : perimetres differents, les deux restent
DETTE_DEUX = ("ABNB AKAM AMAT AVGO BEN BIIB BNY CAG CIEN CL COF CSX DHR DPZ DXCM FRT FTNT GD GDDY GPN HAL HIG HII HLT HRL "
              "IEX KEYS MSTR NKE OTIS PAYX PFG PKG PNR PYPL RL RTX SPGI STE TDY TPR TRGP UBER VMC AIG").split()
# Flux d exploitation / « flux de tresorerie libre » des reperes sans capex : meme mesure
OCF_SAME = "AFL ARE ARES CB CI COIN DLR EG ESS FANG PFG PLD PRU PSX REG RF TRV VEEV VICI VZ".split()
# Autres doublons de meme mesure (retire : short)
AUTRES_RETIRES = {
    ("XEL", "rate_base_nsp_minnesota"): "nsp_mn_rate_base", ("XEL", "rate_base_psco"): "psco_rate_base",
    ("XEL", "rate_base_sps"): "sps_rate_base", ("SGSN.SW", "Organic Growth"): "ORGANIC_GROWTH",
    ("CMI", "COMPONENTS_SALES_B"): "components_rev", ("HCA", "Capex excl. acq."): "capex",
    ("SNA", "NET_SALES"): "net_sales",
}
# Libelles de frequence seulement (mesures differentes, les deux restent)
FREQ = [("ECL", "CAHIER_ORGANIC_GROWTH", "Organic sales growth"), ("BLDR", "CAHIER_VOLUME_PRICE_SPLIT", "core_organic_growth"),
        ("GPC", "CAHIER_VENTES_COMPARABLES", "Comparable sales growth"), ("SYY", "CAHIER_CASE_VOLUME", "us_total_case_volume"),
        ("UHS", "Revenue per adjusted admission - Acute Care", "AC_rev_per_adj_adm"),
        ("WMT", "CAHIER_COMP_SALES", "WMT_US_COMP_SALES"), ("EOG", "REALIZED_OIL_PRICE", "avg_oil_price"),
        ("EOG", "REALIZED_GAS_PRICE", "avg_gas_price"), ("EOG", "REALIZED_NGL_PRICE", "avg_ngl_price")]


def kpi(t, s):
    return next((k for k in D[t]["kpis"] if str(k["short"]) == str(s)), None)


def ecart(a, b):
    return min(abs(a * f - b) / max(abs(b), 1e-9) * 100 for f in (1, 1000, 0.001)) if b else (0 if not a else 999)


def annee(q):
    m = re.search(r"(\d{4})", str(q))
    return int(m.group(1)) if m else None


def serie_annees(k):
    out = {}
    for x in k["history"]:
        if isinstance(x.get("v"), (int, float)) and annee(x["q"]):
            out.setdefault(annee(x["q"]), x["v"])
    return out


def n_pts(k):
    return sum(1 for x in k["history"] if isinstance(x.get("v"), (int, float)))


def preuve_effectifs(t, a, b):
    A, B = serie_annees(kpi(t, a)), serie_annees(kpi(t, b))
    com = sorted(set(A) & set(B))
    e = {y: round(ecart(A[y], B[y]), 2) for y in com}
    return com, e


def origine_de(p, short):
    return p["a_origine"] if str(p["a"]) == str(short) else p["b_origine"]


def nom_de(t, s):
    k = kpi(t, s)
    return k.get("name_fr") if k else None


retraits, labels, frequences, notes, corrections = [], [], [], [], []


def retire(p, retire_s, garde_s, motif, preuve):
    t = p["ticker"]
    hero = set(HEROS.get(t.upper(), set())) | {str(D[t].get("hero"))}
    assert str(retire_s) not in hero, (t, retire_s, "hero")
    retraits.append({"ticker": t, "retire": str(retire_s), "garde": str(garde_s), "garde_nom": nom_de(t, garde_s),
                     "retire_nom": nom_de(t, retire_s), "retire_origine": origine_de(p, retire_s), "type": "arbitrage_14oct",
                     "decision": motif, "preuve": preuve})


for p in R["a_verifier"]:
    t, a, b = p["ticker"], str(p["a"]), str(p["b"])
    mot = p["motif"]
    # ---- effectifs : meme mesure, plus longue puis plus recente ----
    if b == "effectifs_annuels":
        com, e = preuve_effectifs(t, a, b)
        mx = max(e.values())
        A, B = kpi(t, a), kpi(t, b)
        if t == "APP":  # 864 = employes R&D (54 % de 1 594, 10-K 2021), le repere 1 594 est le total
            retire(p, a, b, "meme mesure, FY2021 de kpis-haut = effectif R&D (864 = 54 % de 1 594, 10-K FY2021)",
                   f"{len(com)} exercices communs, ecart max {mx} % (FY2021 : 864 contre 1 594)")
            continue
        assert mx < 0.5, (t, e)
        garde, ret = (b, a) if n_pts(B) > n_pts(A) else (a, b)
        retire(p, ret, garde, "meme mesure, serie la plus longue gardee (egalite : kpis-haut)",
               f"{len(com)} exercices communs, ecart max {mx} % ; {n_pts(kpi(t, garde))} points gardes contre {n_pts(kpi(t, ret))}")
        continue
    # ---- OCF mal nomme « flux de tresorerie libre » ----
    if b == "fcf_annuel":
        if t == "ACGL":
            notes.append((t, "ACGL : FCF = OCF - capex (source : concept capex present), ecart 0,7 a 1,9 % : deux mesures, gardees"))
            continue
        assert t in OCF_SAME, t
        A = kpi(t, a)
        B = kpi(t, b)
        q = collections.defaultdict(dict)
        for x in A["history"]:
            m = re.match(r"^Q([1-4])-(?:FY)?(\d{4})$", x["q"])
            if m:
                q[int(m.group(2))][int(m.group(1))] = x["v"]
        an = {annee(x["q"]): x["v"] for x in B["history"] if isinstance(x.get("v"), (int, float))}
        ec = {y: round(ecart(sum(d.values()), an[y]), 2) for y, d in q.items() if len(d) == 4 and y in an}
        retire(p, b, a, "le repere « flux de tresorerie libre » est le flux d exploitation (concept investissements absent : "
                        "scripts/kpi-annuel-10ans.py, src/data/kpi-annuel-10ans/%s.json, concept « flux_exploitation (investissements absents) »)" % t,
               f"somme des 4 trimestres du flux d exploitation = repere sur {len(ec)} exercices, ecart max {max(ec.values())} %")
        continue
    # ---- dette ----
    if b == "dette_annuelle":
        if t in DETTE_GARDE_ANNUELLE:
            retire(p, a, b, "valeurs egales a la serie « Dette totale » ; dernier 10-K : pas de dette a court terme hors part courante "
                            "deja incluse, « Dette totale » seule", "ecart annuel/T4 < 0,5 % sur tous les exercices communs (rapport, section Decisions)")
        elif t in DETTE_GARDE_TRIM:
            retire(p, b, a, "valeurs egales ; la serie annuelle « Dette totale » ne correspond pas aux 10-K (dette a court terme absente de la serie) "
                            "ou la serie trimestrielle est deja la dette totale (plus recente)", "ecart annuel/T4 < 0,5 % sur tous les exercices communs")
        elif t in DETTE_DEUX:
            frequences.append(("dette", t, a, b))
            continue
        else:
            notes.append((t, f"dette non classee {a}/{b}"))
        continue
    if t == "AIG" and a == "LT_DEBT":
        frequences.append(("dette", t, a, b))
        continue

for (t, r, g) in [(k[0], k[1], v) for k, v in AUTRES_RETIRES.items()]:
    p = next(x for x in R["a_verifier"] if x["ticker"] == t and {str(x["a"]), str(x["b"])} == {r, g})
    retire(p, r, g, "meme mesure (valeurs identiques sur toutes les periodes communes), serie la plus longue/recente gardee",
           "ecart < 0,5 % sur toutes les periodes communes (voir rapport)")

# FANG : le T4-2023 trimestriel (6,25) est la dette fin 2022 (6 248 M$) ; 10-K FY2023 : dette totale nette 6 641 M$ (aucune part courante)
corrections.append({"ticker": "FANG", "short": "total_debt_q", "q": "Q4-2023", "avant": 6.25, "apres": 6.641,
                    "preuve": "10-K 2023-12-31 (data-lake/FANG/10K/FANG_2024-02-22) : Total debt, net 6 641 (2022 : 6 248), part courante 0"})

paires_app = [dict(ticker=r["ticker"], retire=r["retire"], garde=r["garde"], garde_nom=r["garde_nom"], type="arbitrage_14oct",
                   decision=r["decision"], preuve=r["preuve"], retire_origine=r["retire_origine"]) for r in retraits]


# ---- libelles ----
def renommer_vers(t, short, origine, nom_fr, nom_en=None):
    chemins = ([f".batches-drafts-safe/kpis-haut/{t}.json"] if origine == "kpis-haut" else
               [f"src/data/kpi-annuel-fiche/{t.upper()}.json"] if origine == "reperes-annuels" else sds.fichiers_base(t))
    fait = False
    for c in chemins:
        if not os.path.exists(c):
            continue
        j = sds.Fichier.get(c)[0]
        for k in sds.objets_kpi(j.get("kpis", []) if origine != "base" else j, short, []):
            if k.get("name_fr") != nom_fr:
                k.setdefault("_nom_avant_14oct", k.get("name_fr"))
                k["name_fr"] = nom_fr
                if nom_en:
                    k["name_en"] = nom_en
                if origine == "reperes-annuels":
                    j.setdefault("_libelles_13oct", {})[short] = nom_fr
                sds.Fichier.sale(c)
                fait = True
    return fait


stats = collections.Counter()
for kind, t, a, b in frequences:
    p = next(x for x in R["a_verifier"] if x["ticker"] == t and str(x["a"]) == a and str(x["b"]) == b)
    nb = kpi(t, b)["name_fr"]
    if "(exercice)" in nb or nb.startswith("Dette totale (exercice"):
        nouveau = "Dette totale (court + long terme, exercice)"
    else:
        nouveau = "Dette totale (court + long terme)"
    if t in ("FRT", "GD", "TRGP"):  # deux « totale » : seule la frequence les separe
        nouveau = "Dette totale (exercice)"
        na = kpi(t, a)["name_fr"]
        if renommer_vers(t, a, origine_de(p, a), sds.libelle(na, sds.MOTS_TRI, "trimestre")):
            stats["libelles trimestre"] += 1
    if renommer_vers(t, b, origine_de(p, b), nouveau, "Total debt (short + long term)"):
        stats["libelle dette totale precise"] += 1
for t, an, tr in FREQ:
    p = next(x for x in R["a_verifier"] if x["ticker"] == t and {str(x["a"]), str(x["b"])} == {an, tr})
    hero = set(HEROS.get(t.upper(), set())) | {str(D[t].get("hero"))}
    if an not in hero:
        n0 = kpi(t, an)["name_fr"]
        if renommer_vers(t, an, origine_de(p, an), sds.libelle(n0, sds.MOTS_AN, "exercice")):
            stats["libelles exercice"] += 1
    if tr not in hero:
        n0 = kpi(t, tr)["name_fr"]
        if renommer_vers(t, tr, origine_de(p, tr), sds.libelle(n0, sds.MOTS_TRI, "trimestre")):
            stats["libelles trimestre"] += 1
# SNA : le survivant porte la serie « hors services financiers » (identique a 0,5 % sur 8 exercices)
renommer_vers("SNA", "net_sales", "kpis-haut", "Ventes nettes (hors services financiers)", "Net sales (excluding financial services)")

rapport = {"maj": AUJ, "mode": "apply" if APPLY else "simulation", "retraits": retraits, "frequences": frequences,
           "corrections": corrections, "notes": notes, "libelles": dict(stats)}
os.makedirs(".conv-state", exist_ok=True)
if APPLY:
    sav = os.environ["SAUVEGARDE"]
    for f in ("src/data/disabled-kpis-per-ste.json", "src/data/kpi-industrie-par-societe.json", "src/data/kpi-industries-etat.json"):
        os.makedirs(os.path.join(sav, os.path.dirname(f)), exist_ok=True)
        shutil.copy(f, os.path.join(sav, f))
    # correction de valeur FANG (kpis-haut)
    for c in corrections:
        path = f".batches-drafts-safe/kpis-haut/{c['ticker']}.json"
        j = sds.Fichier.get(path)[0]
        k = next(x for x in j["kpis"] if x["short"] == c["short"])
        pt = next(x for x in k["history"] if x["q"] == c["q"])
        assert pt["v"] == c["avant"]
        pt["v"] = c["apres"]
        j.setdefault("_corrections_14oct", []).append(c)
        sds.Fichier.sale(path)
    # sauvegarde des fichiers modifies par appliquer (retraits)
    for p in paires_app:
        t = p["ticker"]
        for f in (f".batches-drafts-safe/kpis-haut/{t}.json", f"src/data/kpi-annuel-fiche/{t.upper()}.json"):
            if os.path.exists(f):
                sds.Fichier.get(f)
    for p in paires_app:
        if p["retire_origine"] == "base":
            for f in sds.fichiers_base(p["ticker"]):
                sds.Fichier.get(f)
    for pth, (j, raw, sale) in sds.Fichier.cache.items():
        os.makedirs(os.path.join(sav, os.path.dirname(pth)), exist_ok=True)
        open(os.path.join(sav, pth), "w").write(raw)
    rapport["application"] = sds.appliquer(paires_app, [], D)
json.dump(rapport, open(".conv-state/kpi-doublons-arbitrage-14oct.json", "w"), ensure_ascii=False, indent=1)
print("retraits", len(retraits), "dont", collections.Counter(r["retire_origine"] for r in retraits), "| deux gardees (dette)", len(frequences),
      "| libelles", dict(stats), "| notes", notes)
