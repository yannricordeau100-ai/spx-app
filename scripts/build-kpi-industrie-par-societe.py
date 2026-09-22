#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Construit src/data/kpi-industrie-par-societe.json.

Pour chaque societe de l'univers, compare les indicateurs ATTENDUS de sa
sous-industrie (docs/cahier/kpi/<code_gics>.json) avec les indicateurs
REELLEMENT SERVIS sur sa fiche (loadV17Company, mode v18).

Le statut issu de la campagne de recherche de septembre
(docs/cahier/donnees/<TICKER>.json) est conserve a part, dans
"statut_cahier" : il dit si la donnee avait ete trouvee a l'epoque, pas si
l'indicateur figure aujourd'hui sur la fiche.

Methode de correspondance, par ordre de priorite :
 1. code court identique entre l'attendu et un indicateur de la fiche ;
 2. alias de la societe : le libelle en ligne releve par la campagne
    (short_en_ligne) retrouve sur la fiche ;
 3. alias du corpus : les memes libelles releves pour d'autres societes ;
 4. similarite lexicale bilingue sur le libelle francais, le libelle anglais,
    le type comparable et le code de la fiche, apres canonicalisation par un
    lexique de synonymes francais-anglais, ponderee par la rarete des jetons,
    puis affaiblie en cas d'incoherence d'unite, de nature (part contre
    croissance, marge contre niveau) ou de concept metier.

Etape 1 : cache des fiches (resumable, une ligne JSON par societe).
Etape 2 : rapprochement et ecriture du fichier de donnees.

Usage :
    python3 scripts/build-kpi-industrie-par-societe.py            # tout
    python3 scripts/build-kpi-industrie-par-societe.py --cache    # cache seul
    python3 scripts/build-kpi-industrie-par-societe.py --match    # rapprochement seul

Le cache vit dans /tmp/fiches-kpi-cache.jsonl ; il est complete ligne a ligne,
donc une erreur de serveur en cours de route ne fait rien reperdre : relancer
la commande reprend la ou elle s'etait arretee.
"""

import collections
import datetime
import glob
import json
import math
import os
import re
import subprocess
import sys
import unicodedata


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")

def tokens_bruts(s):
    if not s:
        return []
    s = strip_accents(str(s)).lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return [t for t in s.split() if t]

# tokens ignores (trop generiques)
STOP = set("""de des du la le les l d et en par pour au aux a un une sur the of and or in to for by per a an total totaux
rate ratio taux niveau mesure indicateur kpi metric value valeur donnee data annuel annuelle yearly quarterly trimestriel
group groupe consolide consolidated global overall net nets nette nettes gross brut brute base basis fy ttm rapporte rapportee rapportes rapportees rapport relatif relative compare comparee versus vs propre propres own owned company societe firme interne internes externe externes moyenne moyen average declare declared reported publie publiee courant courante annualise annualisee estime estimee ajuste ajustee adjusted underlying sousjacent principal principaux nombre count number montant amount""".split())

# groupes de synonymes : chaque ligne -> un jeton canonique
GROUPES = {
 "REV": "revenu revenus revenue revenues chiffre affaires ca sales vente ventes turnover facturation facturations billings topline",
 "GROWTH": "croissance growth crois progression evolution variation increase hausse",
 "ORG": "organique organic comparable comparables lfl likeforlike perimetre currencyneutral constant change devises",
 "MARGIN": "marge marges margin margins",
 "EBITDA": "ebitda ebita",
 "EBIT": "ebit exploitation operating operationnel operationnelle",
 "ORDER": "commande commandes order orders bookings prises intake",
 "BACKLOG": "backlog carnet rpo obligations restantes",
 "BILL": "bill billed billings facture factures",
 "UTIL": "utilisation utilization utilisee occupancy occupation remplissage load charge",
 "CAPACITY": "capacite capacity capacites capacities",
 "INVENTORY": "stock stocks inventory inventaire inventaires rotation turns dio",
 "CAPEX": "capex investissement investissements investment investments capital expenditure depenses",
 "RD": "rd recherche developpement research development innovation",
 "INTENSITY": "intensite intensity",
 "SHARE": "part parts share mix proportion repartition split poids penetration",
 "CUSTOMER": "client clients customer customers abonne abonnes subscriber subscribers membre membres utilisateur utilisateurs user users adherents",
 "RETENTION": "retention fidelisation churn attrition resiliation resiliations renouvellement renewal nrr",
 "PRICE": "prix price pricing asp realise realized tarif tarifs",
 "VOLUME": "volume volumes unite unites unit units shipment shipments expedition expeditions livraison livraisons tonnage tonnes quantites",
 "NETDEBT": "endettement dette debt levier leverage gearing",
 "CARBON": "carbone carbon co2 ges ghg emission emissions scope",
 "ENERGY": "energie energy energetique electricite renouvelable renewable",
 "WATER": "eau water hydrique",
 "SAFETY": "securite safety trir accident accidents blessure blessures incident incidents lti frequence",
 "WASTE": "dechet dechets waste recyclage recycling circulaire",
 "RESERVE": "reserve reserves ressource ressources",
 "PRODUCTION": "production produite output extraction",
 "YIELD": "rendement yield rendements",
 "COMBINED": "combine combined",
 "LOSS": "sinistre sinistres sinistralite loss claims perte pertes",
 "CAPITAL": "cet1 solvabilite solvency capital adequacy tier",
 "DIGITAL": "numerique digital ligne online ecommerce internet web omnicanal",
 "STORE": "magasin magasins store stores boutique boutiques enseigne enseignes succursale succursales reseau network retail detail surface",
 "SAMESTORE": "samestore comparables identiques perimetre magasins existant existants",
 "FFO": "ffo affo",
 "NOI": "noi",
 "RENT": "loyer loyers rent rental rents location bail baux leasing locatif locative",
 "MKTSHARE": "marche market",
 "ARPU": "arpu arpa moyen moyenne average par",
 "CONVERSION": "conversion convertis taux_conversion",
 "DESIGNWIN": "design wins conception conceptions gagnees remportees",
 "PLANT": "usine usines fab fabs fonderie plant plants site sites installation installations",
 "RECALL": "rappel rappels recall recalls",
 "SUPPLIER": "fournisseur fournisseurs supplier suppliers approvisionnement chaine sourcing",
 "AUDIT": "audit audits controle controles inspection inspections certification certifications conformite compliance",
 "RATEBASE": "ratebase tarifaire regule regulee regulated regulatoire",
 "ROE": "roe roic rotce rentabilite return returns",
 "PIPELINE": "pipeline portefeuille developpement projets projet phase essais trials",
 "CASHFLOW": "cash flow fcf tresorerie liquidite liquidites disponible libre free",
 "PAYOUT": "dividende dividendes distribution payout rachat rachats buyback",
 "EMPLOYEE": "salarie salaries employe employes employee employees effectif effectifs headcount personnel collaborateur collaborateurs",
 "DIVERSITY": "diversite diversity femmes women parite mixite inclusion",
 "TURNOVERSTAFF": "turnover rotation depart departs attrition_personnel",
 "COST": "cout couts cost costs charge charges depense opex",
 "PROD_EFFICIENCY": "efficacite efficiency productivite productivity rendement_ind",
 "LOAN": "credit credits pret prets loan loans encours",
 "DEPOSIT": "depot depots deposit deposits epargne",
 "NIM": "nim marge_interet interest interets nii",
 "AUM": "aum actifs assets gestion management encours_gere",
 "PREMIUM": "prime primes premium premiums cotisation cotisations souscription",
 "OCCUPANCY": "occupation occupancy taux_occupation vacance vacancy",
 "LEASESPREAD": "spread releasing renouvellement_bail reversion",
 "PATIENT": "patient patients lit lits hopital hospital admission admissions",
 "TRAFFIC": "trafic traffic frequentation visite visites passager passagers footfall",
 "CHURN": "",
 "SEGMENT": "segment segments division divisions branche branches activite activites metier metiers",
 "GEO": "geographique geographic region regions zone zones pays country countries marche_final",
 "ENDMARKET": "endmarket final finaux debouche debouches application applications",
 "BOOKTOBILL": "booktobill",
 "CONTENT": "contenu contenus content programme programmes catalogue",
 "CLOUD": "cloud saas nuage hebergement",
 "RECURRING": "abonnement abonnements subscription subscriptions recurring recurrent recurrents recurrente arr mrr",
 "SERVICE": "service services apresvente aftermarket maintenance entretien piece pieces consommable consommables reactif reactifs",
 "BACKLOGCONV": "",
 "QUALITY": "qualite quality defaut defauts rebut satisfaction nps",
 "TAX": "impot impots tax taxe effectif_impot",
 "WORKINGCAP": "bfr besoin roulement working",
 "PAYMENT": "paiement paiements payment payments transaction transactions gpv tpv",
 "TAKERATE": "takerate take commission commissions prelevement",
 "OCCUPANCY_HOTEL": "revpar adr chambre chambres",
 "FLEET": "flotte fleet vehicule vehicules avion avions navire navires wagon wagons",
 "MILES": "mile miles km kilometre kilometres passagerkm tonnekm rpk ask",
 "SUBSCRIBER_NET": "ajout ajouts add adds addition additions raccordement raccordements",
 "FIBER": "fibre fiber ftth broadband hautdebit",
 "WIRELESS": "mobile postpaid postpaye prepaid prepaye wireless sansfil",
}

SYN = {}
for canon, mots in GROUPES.items():
    for m in mots.split():
        SYN.setdefault(m, canon)

# expressions multi-mots traitees avant la tokenisation simple
EXPR = [
 (r"\br\s*&\s*d\b", "RD"),
 (r"\br\s*et\s*d\b", "RD"),
 (r"fonds\s+propres", "CAPITAL"),
 (r"funds?\s+from\s+operations?", "FFO"),
 (r"fonds?\s+(provenant|issus|generes)\s+de\s+l?\s*exploitation", "FFO"),
 (r"flux\s+de\s+tresorerie\s+(libre|disponible)", "CASHFLOW"),
 (r"free\s+cash\s+flow", "CASHFLOW"),
 (r"base\s+install\w*", "INSTALLEDBASE"),
 (r"install\w*\s+base", "INSTALLEDBASE"),
 (r"appareils?\s+actifs?", "INSTALLEDBASE"),
 (r"active\s+devices?", "INSTALLEDBASE"),
 (r"parc\s+(installe|actif)\w*", "INSTALLEDBASE"),
 (r"book\s*to\s*bill", "BOOKTOBILL"),
 (r"commandes?\s*(sur|/)\s*facturations?", "BOOKTOBILL"),
 (r"same\s*store", "SAMESTORE"),
 (r"like\s*for\s*like", "ORG"),
 (r"part\s+de\s+marche", "MKTSHARE SHARE"),
 (r"market\s+share", "MKTSHARE SHARE"),
 (r"marche\s+final", "ENDMARKET"),
 (r"end\s*market", "ENDMARKET"),
 (r"taux\s+d?\s*occupation", "OCCUPANCY UTIL"),
 (r"net\s+debt", "NETDEBT"),
 (r"dette\s+nette", "NETDEBT"),
 (r"free\s+cash\s+flow", "CASHFLOW"),
 (r"rate\s+base", "RATEBASE"),
 (r"base\s+tarifaire", "RATEBASE"),
 (r"design\s+wins?", "DESIGNWIN"),
 (r"net\s+adds?", "SUBSCRIBER_NET CUSTOMER"),
 (r"ajouts?\s+nets?", "SUBSCRIBER_NET CUSTOMER"),
 (r"take\s+rate", "TAKERATE"),
 (r"combined\s+ratio", "COMBINED LOSS"),
 (r"ratio\s+combine", "COMBINED LOSS"),
 (r"carnet\s+de\s+commandes?", "BACKLOG"),
 (r"chiffre\s+d?\s*affaires?", "REV"),
 (r"recherche\s+et\s+developpement", "RD"),
 (r"research\s+and\s+development", "RD"),
]

def canon_tokens(s):
    """Retourne l'ensemble des jetons canoniques d'un libelle."""
    if not s:
        return set()
    raw = strip_accents(str(s)).lower()
    raw = re.sub(r"[^a-z0-9]+", " ", raw)
    out = []
    for pat, rep in EXPR:
        if re.search(pat, raw):
            out.extend(rep.split())
            raw = re.sub(pat, " ", raw)
    for t in raw.split():
        if t in STOP:
            continue
        if t in SYN:
            out.append(SYN[t])
            continue
        # pluriel simple
        if t.endswith("s") and t[:-1] in SYN:
            out.append(SYN[t[:-1]])
            continue
        if len(t) <= 2:
            continue
        out.append(t[:-1] if t.endswith("s") and len(t) > 4 else t)
    return set(out)

def norm_code(s):
    if not s:
        return ""
    return re.sub(r"[^a-z0-9]", "", strip_accents(str(s)).lower())


# --- familles d'unites, pour penaliser les rapprochements incoherents ---
def famille_unite(u):
    if not u:
        return None
    x = strip_accents(str(u)).lower()
    if "%" in x or "point" in x or "pourcent" in x or "pb" == x.strip():
        return "pct"
    if "jour" in x or "day" in x or "annee" in x or "an " in x or "mois" in x:
        return "duree"
    if "ratio" in x or x.strip() in ("x", "x et %"):
        return "ratio"
    if re.search(r"[$€£]|usd|eur|chf|gbp|dollar|euro", x):
        return "monnaie"
    if "nombre" in x or "unite" in x or "unit" in x or "millier" in x or "million" in x or "salarie" in x or "employe" in x or "magasin" in x:
        return "compte"
    if re.search(r"\bt\b|kt|tonne|oz|mwh|gwh|twh|bep|boe|co2|barils?|km|litre", x):
        return "physique"
    if re.fullmatch(r"[a-z ']{3,}", x.strip()):
        return "compte"
    return None

def penalite_unite(u_attendu, u_fiche):
    a, b = famille_unite(u_attendu), famille_unite(u_fiche)
    if not a or not b or a == b:
        return 1.0
    fort = {("pct", "monnaie"), ("monnaie", "pct"), ("ratio", "monnaie"), ("monnaie", "ratio"),
            ("pct", "compte"), ("compte", "pct"), ("pct", "physique"), ("physique", "pct"),
            ("ratio", "compte"), ("compte", "ratio"), ("duree", "monnaie"), ("duree", "compte")}
    return 0.68 if (a, b) in fort else 0.85


# jetons de nature : un ecart sur l'un d'eux affaiblit fortement le rapprochement
NATURE = {"GROWTH", "SHARE", "INTENSITY", "RETENTION", "UTIL", "BACKLOG", "MARGIN"}

def penalite_nature(a, b):
    diff = (a & NATURE) ^ (b & NATURE)
    return 0.88 ** min(len(diff), 2)

def sous_libelles(s):
    """Decoupe un libelle compose (\"X et Y\", \"X ; Y\") en composantes."""
    if not s:
        return []
    parts = re.split(r"\s+et\s+|\s+and\s+|\s*;\s*|\s*,\s+", str(s))
    return [p for p in parts if len(p.strip()) > 3]


# concepts metier : deux libelles qui en portent chacun un doivent en partager un
CONCEPTS = {"REV","GROWTH","MARGIN","EBITDA","EBIT","ORDER","BACKLOG","BILL","UTIL","CAPACITY","INVENTORY",
"CAPEX","RD","INTENSITY","SHARE","CUSTOMER","RETENTION","PRICE","VOLUME","NETDEBT","CARBON","ENERGY","WATER",
"SAFETY","WASTE","RESERVE","PRODUCTION","YIELD","COMBINED","LOSS","CAPITAL","DIGITAL","STORE","SAMESTORE","FFO",
"NOI","RENT","MKTSHARE","ARPU","DESIGNWIN","PLANT","RECALL","SUPPLIER","AUDIT","RATEBASE","ROE","PIPELINE",
"CASHFLOW","PAYOUT","EMPLOYEE","DIVERSITY","COST","LOAN","DEPOSIT","NIM","AUM","PREMIUM","OCCUPANCY","PATIENT",
"TRAFFIC","CLOUD","RECURRING","SERVICE","QUALITY","TAX","PAYMENT","TAKERATE","FLEET","MILES","FIBER","INSTALLEDBASE","BOOKTOBILL"}

# concepts trop courants pour fonder a eux seuls un rapprochement
GENERIQUES = {"REV", "EBIT", "COST", "NETDEBT", "CASHFLOW", "CAPEX", "MARGIN"}

def penalite_concept(a, b):
    ca, cb = a & CONCEPTS, b & CONCEPTS
    if ca and cb and not (ca & cb):
        return 0.50
    inter = a & b
    if inter and inter <= GENERIQUES:
        return 0.55
    return 1.0


# ---------------------------------------------------------------------------
# Etape 1 : cache des indicateurs servis sur chaque fiche
# ---------------------------------------------------------------------------

DUMPER_TS = r"""
import * as dotenv from "DEPOT/node_modules/dotenv/lib/main.js";
dotenv.config({ path: "DEPOT/.env.local" });
import { promises as fs } from "fs";

const OUT = "CACHE";

function utilisable(k: any): boolean {
  if (!k) return false;
  const v = k.value;
  if (typeof v === "number") return Number.isFinite(v) && Math.abs(v) > 0;
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "" || s === "—") return false;
    const n = parseFloat(s.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) && Math.abs(n) > 0;
  }
  return false;
}

(async () => {
  const { loadV17Company } = await import("DEPOT/src/lib/company-core/load-company");
  const { orderKpis } = await import("DEPOT/src/lib/kpi-ordering");
  const uni = JSON.parse(await fs.readFile("DEPOT/src/data/v1-9-5-clean-all-tickers.json", "utf-8")) as { tickers: string[] };

  const deja = new Set<string>();
  try {
    const prev = await fs.readFile(OUT, "utf-8");
    for (const l of prev.split("\n")) {
      if (!l.trim()) continue;
      try { deja.add(JSON.parse(l).ticker); } catch {}
    }
  } catch {}

  let n = 0;
  for (const t of uni.tickers) {
    if (deja.has(t)) continue;
    let rec: any;
    try {
      const r: any = await loadV17Company(t, { mode: "v18", locale: "fr" });
      if (r.kind !== "ready") {
        rec = { ticker: t, erreur: "kind:" + r.kind };
      } else {
        const c: any = r.company;
        const cache = new Set<string>(c._kpis_hidden_by_history_rule ?? []);
        const req = (pt?: string) => (pt === "quarter" ? 4 : pt === "semester" ? 2 : 3);
        const kpis = orderKpis(c.kpis, c.hero_kpi).map((k: any) => {
          let servi = true;
          if (!utilisable(k)) servi = false;
          else if (k.short === c.hero_kpi) servi = true;
          else if (k.hors_document === true) servi = true;
          else if (cache.has(k.short)) servi = false;
          else servi = (Array.isArray(k.history) ? k.history.length : 0) >= req(k.period_type);
          return {
            short: k.short, short_raw: k._short_raw ?? null,
            name_fr: k.name_fr ?? null, name_en: k.name_en ?? null,
            tc_fr: k.type_comparable?.fr ?? null, tc_en: k.type_comparable?.en ?? null,
            unit: k.unit ?? null, servi,
          };
        });
        rec = { ticker: t, gics: c.gics_code ?? null, n_total: kpis.length,
                n_servis: kpis.filter((x: any) => x.servi).length, kpis };
      }
    } catch (e) {
      rec = { ticker: t, erreur: String(e).slice(0, 160) };
    }
    await fs.appendFile(OUT, JSON.stringify(rec) + "\n");
    n++;
    if (n % 25 === 0) console.error(`[${n}] ${t}`);
  }
  console.error("cache termine, " + n + " fiches ajoutees");
  process.exit(0);
})();
"""


def construire_cache():
    """Ecrit le cache des fiches ; reprend la ou il s'etait arrete."""
    src = DUMPER_TS.replace("DEPOT", ROOT).replace("CACHE", CACHE)
    chemin = "/tmp/build-kpi-industrie-dump.ts"
    with open(chemin, "w", encoding="utf-8") as f:
        f.write(src)
    subprocess.run(["npx", "tsx", chemin], cwd=ROOT, check=True)


ROOT = "/Users/yann/spx-app"
CACHE = "/tmp/fiches-kpi-cache.jsonl"
KPI_DIR = os.path.join(ROOT, "docs/cahier/kpi")
DONNEES_DIR = os.path.join(ROOT, "docs/cahier/donnees")

PRESENT_CAHIER = {"existe", "trouve"}
PARTIEL_CAHIER = {"trouve_partiel", "actuel_seulement", "partiel"}
NON_APPLICABLE_CAHIER = {"autre", "retire", "retire_par_proprietaire", "doublon_retire"}


def charger_fiches():
    fiches = {}
    with open(CACHE, encoding="utf-8") as f:
        for l in f:
            l = l.strip()
            if not l:
                continue
            d = json.loads(l)
            fiches[d["ticker"]] = d
    return fiches


def charger_referentiels():
    refs = {}
    for g in glob.glob(os.path.join(KPI_DIR, "*.json")):
        nom = os.path.basename(g)[:-5]
        if nom.startswith("_"):
            continue  # gabarit
        d = json.load(open(g, encoding="utf-8"))
        refs[nom] = d
    return refs


def charger_donnees():
    dons = {}
    for g in glob.glob(os.path.join(DONNEES_DIR, "*.json")):
        try:
            d = json.load(open(g, encoding="utf-8"))
        except Exception:
            continue
        dons[os.path.basename(g)[:-5]] = d
    return dons


def alias_corpus(dons):
    """Alias empiriques : short attendu -> libelles observes en ligne (campagne septembre)."""
    al = collections.defaultdict(set)
    for d in dons.values():
        for k in d.get("kpis", []):
            s, e = k.get("short"), k.get("short_en_ligne")
            if s and e:
                al[s].add(e)
    return al


def idf_table(fiches):
    df = collections.Counter()
    n = 0
    for f in fiches.values():
        if f.get("erreur"):
            continue
        n += 1
        vus = set()
        for k in f["kpis"]:
            vus |= canon_tokens(k.get("name_en")) | canon_tokens(k.get("name_fr"))
        for t in vus:
            df[t] += 1
    return {t: min(math.log((n + 1) / (c + 1)) + 1.0, 4.0) for t, c in df.items()}, n


def sim(a, b, idf):
    if not a or not b:
        return 0.0
    w = lambda s: sum(idf.get(t, 3.5) for t in s)
    inter = w(a & b)
    if inter <= 0:
        return 0.0
    p = inter / w(b)
    r = inter / w(a)
    d = 2 * p * r / (p + r)
    # une correspondance qui laisse de cote la moitie du concept attendu est affaiblie
    return d * (0.78 if r < 0.45 else 1.0)


def champs_fiche(k):
    return [
        ("libelle_en", canon_tokens(k.get("name_en")), 1.0),
        ("libelle_fr", canon_tokens(k.get("name_fr")), 1.0),
        ("type_comparable_en", canon_tokens(k.get("tc_en")), 0.97),
        ("type_comparable_fr", canon_tokens(k.get("tc_fr")), 0.97),
        ("code_fiche", canon_tokens(k.get("short_raw") or k.get("short")), 0.90),
    ]


def apparier(att, fiche_kpis, aliases_soc, aliases_corp, idf, seuil):
    """Retourne (meilleur_kpi, score, methode)."""
    e_short = norm_code(att.get("short"))
    e_tok_fr = canon_tokens(att.get("nom_fr"))
    e_tok_en = canon_tokens(att.get("nom_en"))
    e_tok_code = canon_tokens(att.get("short"))
    e_tok = e_tok_fr | e_tok_en | e_tok_code
    variantes = [(e_tok_en, "en", 1.0), (e_tok_fr, "fr", 1.0), (e_tok, "mixte", 1.0)]
    _C = CONCEPTS
    parts = sous_libelles(att.get("nom_fr"))
    if len(parts) > 1:
        for sp in parts:
            tk = canon_tokens(sp)
            if len(tk) >= 2 and (tk & _C):
                variantes.append((tk, "fr_partie", 0.95))

    meilleur = (None, 0.0, None)

    # 1. code identique
    for k in fiche_kpis:
        if e_short and (norm_code(k.get("short")) == e_short or norm_code(k.get("short_raw")) == e_short):
            return (k, 1.0, "code_identique")

    # 2. alias de la societe (short_en_ligne du cahier pour CE ticker)
    for a in aliases_soc:
        na = norm_code(a)
        for k in fiche_kpis:
            if na and na in (norm_code(k.get("short")), norm_code(k.get("short_raw")),
                             norm_code(k.get("name_en")), norm_code(k.get("name_fr"))):
                return (k, 0.99, "alias_societe")

    # 3. alias du corpus
    for a in aliases_corp:
        na = norm_code(a)
        for k in fiche_kpis:
            if na and na in (norm_code(k.get("short")), norm_code(k.get("short_raw")),
                             norm_code(k.get("name_en")), norm_code(k.get("name_fr"))):
                if 0.96 > meilleur[1]:
                    meilleur = (k, 0.96, "alias_corpus")

    # 4. similarite lexicale bilingue, ponderee par la coherence des unites
    for k in fiche_kpis:
        pen = penalite_unite(att.get("unite"), k.get("unit"))
        for nom_champ, tok, poids in champs_fiche(k):
            if not tok:
                continue
            for e_set, etq, pv in variantes:
                s = sim(e_set, tok, idf) * poids * pen * pv * penalite_nature(e_set, tok) * penalite_concept(e_set, tok)
                if s > meilleur[1]:
                    meilleur = (k, round(s, 3), nom_champ + "_" + etq)
    return meilleur


SEUIL = 0.60           # seuil de correspondance retenu apres verification manuelle
OUT_FILE = os.path.join(ROOT, "src/data/kpi-industrie-par-societe.json")


def main():
    etapes = set(a for a in sys.argv[1:] if a.startswith("--"))
    if not etapes or "--cache" in etapes:
        construire_cache()
        if etapes == {"--cache"}:
            return

    seuil = float(os.environ.get("SEUIL", str(SEUIL)))
    fiches = charger_fiches()
    refs = charger_referentiels()
    dons = charger_donnees()
    al_corp = alias_corpus(dons)
    idf, n_fiches = idf_table(fiches)
    tickers = json.load(open(os.path.join(ROOT, "src/data/v1-9-5-clean-all-tickers.json"), encoding="utf-8"))["tickers"]

    societes = {}
    for t in tickers:
        fiche = fiches.get(t)
        if not fiche:
            societes[t] = {"erreur": "fiche_non_chargee"}
            continue
        if fiche.get("erreur"):
            societes[t] = {"erreur": "fiche_" + fiche["erreur"]}
            continue
        dd = dons.get(t)
        code = (dd or {}).get("code") or fiche.get("gics")
        ref = refs.get(code)
        if not ref:
            societes[t] = {"erreur": "referentiel_absent", "code_gics": code}
            continue

        par_short = {k.get("short"): k for k in (dd or {}).get("kpis", []) if k.get("short")}
        servis = [k for k in fiche["kpis"] if k.get("servi")]

        inds = []
        n_pres = n_ex = n_inex = n_na = n_inc = 0
        for att in ref.get("kpis", []):
            d = par_short.get(att.get("short"))
            st_cahier = (d or {}).get("statut")
            al_soc = {d["short_en_ligne"]} if d and d.get("short_en_ligne") else set()
            k, score, methode = apparier(att, servis, al_soc, al_corp.get(att.get("short"), set()), idf, seuil)
            sur_fiche = bool(k) and score >= seuil

            if sur_fiche:
                statut = "present_sur_fiche"; n_pres += 1
            elif st_cahier in NON_APPLICABLE_CAHIER:
                statut = "non_applicable"; n_na += 1
            elif st_cahier in PRESENT_CAHIER or st_cahier in PARTIEL_CAHIER:
                statut = "absent_fiche_donnee_existe"; n_ex += 1
            elif st_cahier == "non_trouve":
                statut = "absent_donnee_inexistante"; n_inex += 1
            else:
                statut = "absent_non_evalue"; n_inc += 1

            e = {
                "short": att.get("short"),
                "nom_fr": att.get("nom_fr"),
                "nom_en": att.get("nom_en"),
                "distinctif": bool(att.get("wow")),
                "statut": statut,
                "sur_fiche": sur_fiche,
                "statut_cahier": st_cahier or "non_evalue",
            }
            if d and d.get("short_en_ligne"):
                e["nom_en_ligne_cahier"] = d["short_en_ligne"]
            if sur_fiche:
                e["nom_sur_fiche_fr"] = k.get("name_fr")
                e["nom_sur_fiche_en"] = k.get("name_en")
                e["code_sur_fiche"] = k.get("short")
                e["correspondance"] = {"methode": methode, "score": score}
            elif k and score > 0:
                e["correspondance_rejetee"] = {
                    "code_sur_fiche": k.get("short"),
                    "nom_sur_fiche_fr": k.get("name_fr"),
                    "methode": methode, "score": score,
                }
            inds.append(e)

        total = len(inds)
        applicables = total - n_na
        taux = round(n_pres / applicables, 3) if applicables > 0 else None
        societes[t] = {
            "code_gics": code,
            "sous_industrie_fr": ref.get("nom_fr"),
            "kpi_servis_sur_fiche": len(servis),
            "total_attendus": total,
            "presents": n_pres,
            "absents_donnee_existe": n_ex,
            "absents_donnee_inexistante": n_inex,
            "absents_non_evalues": n_inc,
            "non_applicables": n_na,
            "taux_couverture": taux,
            "indicateurs": inds,
        }

    # statistiques
    complet = partielle = aucune = 0
    buckets = {"0": 0, "1-24": 0, "25-49": 0, "50-74": 0, "75-99": 0, "100": 0}
    n_calc = 0
    for s in societes.values():
        if "erreur" in s or s.get("taux_couverture") is None:
            continue
        n_calc += 1
        pct = s["taux_couverture"] * 100
        if pct >= 100: complet += 1; buckets["100"] += 1
        elif pct <= 0: aucune += 1; buckets["0"] += 1
        else:
            partielle += 1
            buckets["1-24" if pct < 25 else "25-49" if pct < 50 else "50-74" if pct < 75 else "75-99"] += 1

    stats = {
        "societes_traitees": n_calc,
        "societes_couverture_complete": complet,
        "societes_couverture_partielle": partielle,
        "societes_couverture_nulle": aucune,
        "distribution_taux_couverture_pct": buckets,
        "seuil_correspondance": seuil,
    }
    out = {
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        "version": "2",
        "methode": "Comparaison des indicateurs attendus de la sous-industrie avec les indicateurs reellement servis sur la fiche (loadV17Company, mode v18). Correspondance par code court, alias observes, libelles francais et anglais et type comparable.",
        "stats": stats,
        "societes": societes,
    }
    json.dump(out, open(os.environ.get("OUT", OUT_FILE), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps(stats, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
