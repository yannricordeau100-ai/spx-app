#!/usr/bin/env python3
"""Doublons de CONCEPT sur la fiche TELLE QUE SERVIE (13 oct 2026).

Etend scripts/scan-kpi-doublons-concept.py (qui ne lit que .batches-drafts-safe/kpis-haut) a
tous les KPI apres fusion par le vrai chargeur : kpis-haut, src/data/v2-pipeline/<t>.json,
src/data/v2-pipeline-enrich/ (specific-kpis, kpis_supplementary, kpi-star, stories...),
reperes annuels. Exemple : ASML « Montant annuel des prises de commandes nettes » (kpis-haut,
exercice) et « Montant trimestriel des prises de commandes nettes » (kpi-star, trimestre) :
somme des 4 trimestres 2025 = 28 034 M EUR = exercice 2025 28,035 Mds EUR.

Entree : dump du chargeur (npx tsx --env-file=.env.local scripts/verif-fiches/dump-kpis-servis.ts
<fichier>), seuls les KPI affiches au tableau (groupes avances / standards / arretes) comptent.

Regles (consigne Yann 13 oct) :
1. Meme mesure a deux frequences (exercice + trimestre) : la trimestrielle reste la ligne
   principale ; l annuelle est retiree de l affichage UNIQUEMENT si, pour chaque exercice commun
   complet, la somme des 4 trimestres (flux) ou le T4 (stock, taux) egale l annuel publie a
   moins de 0,5 % (0,05 pt pour un taux). Sinon les deux restent, avec des libelles explicites
   (« (exercice) » / « (trimestre) » ajoutes quand le nom ne le dit pas).
2. Autres doublons de concept : regle de scan-kpi-doublons-concept.py (series concordantes, nom
   ou type voisin, hors Cahier vrai double seulement) ; garde la plus recente puis la plus longue.
3. Jamais le hero (servi, v2-pipeline, kpis-haut, overrides Supabase via le dump) ; un KPI
   institutionnel (jaune) retire voit son rattachement rebranche sur la ligne gardee.

Retrait sans perte :
- KPI de kpis-haut : sorti de la liste, archive dans le meme fichier (`_doublons_retires_13oct`).
- KPI d une autre couche (v2-pipeline, enrich) : identifiant ajoute a
  src/data/disabled-kpis-per-ste.json (filtre du chargeur, avant la couche kpis-haut),
  donnees intactes ; trace dans `_doublons_concept_13oct` du meme fichier.

Univers : src/data/v1-9-5-clean-all-tickers.json uniquement.
Usage : python3 scripts/scan-kpi-doublons-servis.py <dump.json>            (simulation)
        python3 scripts/scan-kpi-doublons-servis.py <dump.json> --apply    (ecriture)
Sortie : .conv-state/kpi-doublons-servis.json
"""
import collections, datetime, importlib.util, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
spec = importlib.util.spec_from_file_location("sdc", os.path.join(ROOT, "scripts/scan-kpi-doublons-concept.py"))
sdc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sdc)
toks, fam, yr, qn, points, accord, trimestriel, recence, tc, DISCR = (
    sdc.toks, sdc.fam, sdc.yr, sdc.qn, sdc.points, sdc.accord, sdc.trimestriel, sdc.recence, sdc.tc, sdc.DISCR)

APPLY = "--apply" in sys.argv
DUMP = next((a for a in sys.argv[1:] if not a.startswith("--")), None)
# Deux frequences : seuls les mots qui changent vraiment la mesure separent deux noms (les
# synonymes libre / disponible / free, net, total ne comptent pas : la preuve chiffree a 0,5 %
# sur chaque exercice tranche).
DISCR_FREQ = {"ajuste", "ajustee", "adjusted", "non", "core", "organique", "organic", "comparable",
              "comparables", "constant", "perimetre", "hors", "ex", "excluding", "avec", "including", "moyen",
              "moyenne", "average", "avg", "long", "court", "terme", "term", "par", "per", "croissance",
              "growth", "variation", "marge", "margin", "cumule", "9m", "s1", "h1"}
MOTS_AN = {"annuel", "annuelle", "annuels", "annuelles", "exercice", "annual", "fy", "an"}
MOTS_TRI = {"trimestriel", "trimestrielle", "trimestriels", "trimestrielles", "trimestre", "quarterly", "quarter"}


def periode(q):
    """Libelle servi -> Q<n>-<aaaa> ou FY<aaaa> ; None si non exploitable (semestre, vide)."""
    s = str(q or "").strip()
    m = re.match(r"^(?:Q|T)([1-4])[- ](?:FY)?\s?(\d{4})$", s, re.I) or re.match(r"^(\d{4})-Q([1-4])$", s)
    if m:
        a, b = m.groups()
        return f"Q{b}-{a}" if len(a) == 4 else f"Q{a}-{b}"
    m = re.match(r"^(?:FY\s?)?(\d{4})$", s, re.I)
    if m:
        return f"FY{m.group(1)}"
    m = re.match(r"^FY(\d{2})$", s, re.I)
    if m:
        return f"FY20{m.group(1)}"
    return None


OPPOSES = [({"exploitation", "operating", "operationnel", "operationnels", "operations"}, {"libre", "free", "disponible"}),
           ({"brut", "brute", "gross"}, {"net", "nette", "nets"})]


def mesures_opposees(a, b):
    return any((a & x and b & y and not (a & y)) or (b & x and a & y and not (b & y)) for x, y in OPPOSES)


def normalise(k):
    h = [{"q": periode(x["q"]), "v": x["v"]} for x in k["history"] if isinstance(x.get("v"), (int, float))]
    if not h or any(x["q"] is None for x in h):
        return None
    k = dict(k)
    k["history"] = h
    return k


def complets(k):
    par = collections.defaultdict(dict)
    for x in points(k):
        if qn(x["q"]):
            par[yr(x["q"])][qn(x["q"])] = x["v"]
    return {y: d for y, d in par.items() if len(d) == 4}


def preuve_frequence(A, Q):
    """Exercices communs complets : (annee, annuel, somme 4T, T4, ecart retenu %, mode)."""
    pct = fam(A.get("unit")) == "pct"
    an = {yr(x["q"]): x["v"] for x in points(A)}
    out = []
    for y, d in sorted(complets(Q).items()):
        if y not in an:
            continue
        a = an[y]
        best = None
        for mode, v in (("somme", sum(d.values())), ("T4", d[4])) if not pct else (("T4", d[4]), ("moyenne", sum(d.values()) / 4)):
            for f in ((1,) if pct else (1, 1000, 0.001)):
                e = abs(a - v * f) if pct else abs(a - v * f) / max(abs(a), 1e-9) * 100
                if best is None or e < best[0]:
                    best = (e, mode, v * f)
        out.append({"annee": y, "annuel": a, "somme_4T": round(sum(d.values()), 4), "T4": d[4],
                    "ecart": round(best[0], 3), "unite_ecart": "pt" if pct else "%", "mode": best[1]})
    return out


def origine(t, short, haut_shorts, reperes):
    if short in haut_shorts:
        return "kpis-haut"
    if short in reperes:
        return "reperes-annuels"
    return "base"


def main():
    if not DUMP:
        sys.exit("usage : scan-kpi-doublons-servis.py <dump.json> [--apply]")
    D = json.load(open(DUMP))
    U = json.load(open("src/data/v1-9-5-clean-all-tickers.json"))["tickers"]
    H = sdc.heros()
    paires, garder_deux, a_verifier, ignores = [], [], [], collections.Counter()
    for t in U:
        f = D.get(t) or {}
        if f.get("etat") != "ready":
            continue
        hp = f".batches-drafts-safe/kpis-haut/{t}.json"
        haut = json.load(open(hp)) if os.path.exists(hp) else {}
        haut_shorts = {str(k.get("short")) for k in haut.get("kpis", [])}
        rp = f"src/data/kpi-annuel-fiche/{t.upper()}.json"
        reperes = {str(k.get("short")) for k in (json.load(open(rp)).get("kpis", []) if os.path.exists(rp) else [])}
        hero_t = set(H.get(t.upper(), set())) | {str(f.get("hero")), str(haut.get("hero_kpi"))}
        for p in (f"src/data/v2-pipeline/{t}.json", f"src/data/v2-pipeline/{t.lower()}.json"):
            if os.path.exists(p):
                try:
                    hero_t.add(str(json.load(open(p)).get("hero_kpi")))
                except Exception:
                    pass
        instit = {x["short"] for x in f.get("instit", [])}
        ks = []
        for k in f["kpis"]:
            if k["groupe"] == "non":
                continue
            n = normalise(k)
            if n is None:
                ignores["periodes non exploitables (semestre, vides)"] += 1
                continue
            n["_origine"] = origine(t, str(k["short"]), haut_shorts, reperes)
            ks.append(n)
        retirer = {}
        for i, K in enumerate(ks):
            for T in ks[i + 1:]:
                sK, sT = str(K["short"]), str(T["short"])
                if sK == sT or sK in retirer or sT in retirer or fam(K.get("unit")) != fam(T.get("unit")):
                    continue
                # paires deja traitees par scan-kpi-doublons-concept.py (deux KPI kpis-haut)
                deux_haut = K["_origine"] == T["_origine"] == "kpis-haut"
                un_cahier = sK.startswith("CAHIER_") != sT.startswith("CAHIER_")
                nK = toks(K.get("name_fr")) | toks(K.get("name_en"))
                nT = toks(T.get("name_fr")) | toks(T.get("name_en"))
                jac = len(nK & nT) / max(1, len(nK | nT))
                meme_type = bool(tc(K)) and tc(K) == tc(T)
                lien_nom = jac >= 0.2 or meme_type
                discr = bool((nK ^ nT) & (DISCR | {"hors", "avec", "including", "long", "terme", "court", "term"}))
                freq = trimestriel(K) != trimestriel(T)
                base = {"ticker": t, "a": sK, "a_nom": K.get("name_fr"), "a_origine": K["_origine"],
                        "b": sT, "b_nom": T.get("name_fr"), "b_origine": T["_origine"],
                        "jaccard": round(jac, 2), "meme_type": meme_type}
                if freq:
                    A, Q = (T, K) if trimestriel(K) else (K, T)
                    ok, n = accord(K, T, 0.03)
                    if not (n and lien_nom and ok >= 1 and ok / n >= 0.75):
                        continue
                    # mot propre a un nom francais et absent de TOUS les noms de l autre (fr + en)
                    fK, fT = toks(K.get("name_fr")), toks(T.get("name_fr"))
                    if ((fK - nT) | (fT - nK)) & DISCR_FREQ:
                        a_verifier.append(dict(base, accord=f"{ok}/{n}", motif="deux frequences, noms avec un mot discriminant (long terme, ajuste, net...)"))
                        continue
                    if mesures_opposees(nK, nT):
                        a_verifier.append(dict(base, accord=f"{ok}/{n}", motif="deux mesures de noms differents (exploitation / libre...), meme valeur : libelle a corriger a la source"))
                        continue
                    pv = preuve_frequence(A, Q)
                    rec = dict(base, type="frequence", annuel=A["short"], trimestriel=Q["short"],
                               accord_3pct=f"{ok}/{n}", preuve=pv)
                    seuil = 0.05 if fam(A.get("unit")) == "pct" else 0.5
                    un_mode = len({x["mode"] for x in pv}) == 1
                    # un seul exercice ne prouve rien pour un stock ou un taux (T4 ou moyenne) ;
                    # il suffit pour un flux dont la somme tombe juste
                    assez = len(pv) >= 2 or (len(pv) == 1 and pv[0]["mode"] == "somme" and fam(A.get("unit")) != "pct")
                    if pv and un_mode and assez and all(x["ecart"] < seuil for x in pv) and str(A["short"]) not in hero_t:
                        retirer[str(A["short"])] = Q
                        paires.append(dict(rec, garde=Q["short"], garde_nom=Q.get("name_fr"), retire=A["short"],
                                           retire_nom=A.get("name_fr"), retire_origine=A["_origine"],
                                           decision="annuelle retiree (somme ou T4 des trimestres = annuel < 0,5 %)"))
                    else:
                        motif = ("annuelle = hero, gardee" if str(A["short"]) in hero_t else
                                 "aucun exercice complet commun" if not pv else
                                 "ecart >= 0,5 % sur au moins un exercice" if any(x["ecart"] >= seuil for x in pv) else
                                 "un seul exercice commun, stock ou taux : preuve insuffisante" if not assez else
                                 "somme des trimestres certaines annees, T4 d autres")
                        garder_deux.append(dict(rec, decision="garder les deux, libelles explicites", motif=motif))
                    continue
                if deux_haut:
                    continue
                # Fiche servie : meme une paire Cahier exige la concordance a 0,5 % (HST : FFO NAREIT
                # et AFFO ajuste a 1,6 % pres sont deux mesures, pas un doublon).
                ok, n = accord(K, T, 0.005)
                if mesures_opposees(nK, nT):
                    continue
                if not (n and ((lien_nom and ok >= 2 and ok / n >= 0.75) or (not lien_nom and ok >= 5 and ok / n >= 0.9))):
                    continue
                if not un_cahier and not (ok >= 4 and ok / n >= 0.9 and (jac >= 0.5 or meme_type) and not discr):
                    a_verifier.append(dict(base, accord=f"{ok}/{n}", motif="concept a confirmer (meme frequence, hors vrai double)"))
                    continue
                garde, retire = (K, T) if recence(K) >= recence(T) else (T, K)
                if str(retire["short"]) in hero_t:
                    garde, retire = retire, garde
                if str(retire["short"]) in hero_t:
                    a_verifier.append(dict(base, accord=f"{ok}/{n}", motif="les deux sont hero (sources differentes)"))
                    continue
                if (t, str(retire["short"])) in sdc.COPIES_A_VERIFIER or (t, str(garde["short"])) in sdc.COPIES_A_VERIFIER:
                    a_verifier.append(dict(base, accord=f"{ok}/{n}", motif="copie de serie probable, a reprendre a la source"))
                    continue
                retirer[str(retire["short"])] = garde
                paires.append(dict(base, type="concept", accord=f"{ok}/{n}", garde=garde["short"], garde_nom=garde.get("name_fr"),
                                   retire=retire["short"], retire_nom=retire.get("name_fr"), retire_origine=retire["_origine"],
                                   decision="serie la plus recente puis la plus longue gardee"))
        for p in paires:
            if p["ticker"] == t:
                p["retire_instit"] = p["retire"] in instit
    retires = {(p["ticker"], str(p["retire"])) for p in paires}
    garder_deux = [g for g in garder_deux if (g["ticker"], str(g["annuel"])) not in retires
                   and (g["ticker"], str(g["trimestriel"])) not in retires]
    rap = {"maj": datetime.date.today().isoformat(), "mode": "apply" if APPLY else "simulation", "dump": DUMP,
           "paires": paires, "garder_les_deux": garder_deux, "a_verifier": a_verifier, "ignores": dict(ignores)}
    if APPLY:
        rap["application"] = appliquer(paires, garder_deux, D)
    os.makedirs(".conv-state", exist_ok=True)
    json.dump(rap, open(".conv-state/kpi-doublons-servis.json", "w"), ensure_ascii=False, indent=1)
    print(f"retraits : {len(paires)} sur {len({p['ticker'] for p in paires})} fiches "
          f"(frequence {sum(p['type'] == 'frequence' for p in paires)}, concept {sum(p['type'] == 'concept' for p in paires)}) ; "
          f"garder les deux : {len(garder_deux)} ; a verifier : {len(a_verifier)} ; ignores : {dict(ignores)} "
          f"({'apply' if APPLY else 'simulation'})")


def toks_brut(s):
    import unicodedata
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return set(re.sub(r"[^a-z0-9 ]", " ", s).split())


def libelle(nom, mots, suffixe):
    """Ajoute « (exercice) » ou « (trimestre) » quand le nom ne dit pas sa frequence."""
    if not nom or toks_brut(nom) & mots:
        return nom
    return f"{nom} ({suffixe})"


def ecrire(p, j, raw):
    indent = 2 if raw.startswith("{\n  ") else (1 if raw.startswith("{\n ") else None)
    json.dump(j, open(p, "w"), ensure_ascii=False, indent=indent)


class Fichier:
    """Lecture unique, ecriture a la fin, indentation d origine conservee."""
    cache = {}

    @classmethod
    def get(cls, p):
        if p not in cls.cache:
            raw = open(p).read()
            cls.cache[p] = [json.loads(raw), raw, False]
        return cls.cache[p]

    @classmethod
    def sale(cls, p):
        cls.cache[p][2] = True

    @classmethod
    def flush(cls):
        for p, (j, raw, sale) in cls.cache.items():
            if sale:
                ecrire(p, j, raw)


def fichiers_base(t):
    out = []
    for d in ("src/data/v2-pipeline", "src/data/v2-pipeline-enrich"):
        for nom in sorted(os.listdir(d)):
            if nom.lower() == f"{t.lower()}.json" or (d.endswith("enrich") and nom.lower().startswith(f"{t.lower()}.") and nom.endswith(".json")):
                out.append(os.path.join(d, nom))
    return out


def objets_kpi(x, short, out):
    if isinstance(x, dict):
        if str(x.get("short")) == str(short) and "name_fr" in x:
            out.append(x)
        for v in x.values():
            objets_kpi(v, short, out)
    elif isinstance(x, list):
        for v in x:
            objets_kpi(v, short, out)
    return out


def renomme(t, short, origine, mots, suf, stats):
    if origine == "kpis-haut":
        chemins = [f".batches-drafts-safe/kpis-haut/{t}.json"]
    elif origine == "reperes-annuels":
        chemins = [f"src/data/kpi-annuel-fiche/{t.upper()}.json"]
    else:
        chemins = fichiers_base(t)
    fait = False
    for c in chemins:
        if not os.path.exists(c):
            continue
        j = Fichier.get(c)[0]
        for k in objets_kpi(j.get("kpis", []) if origine != "base" else j, short, []):
            nv = libelle(k.get("name_fr"), mots, suf)
            if nv != k.get("name_fr"):
                k.setdefault("_nom_avant_13oct", k.get("name_fr"))
                k["name_fr"] = nv
                fait = True
                if origine == "reperes-annuels":
                    j.setdefault("_libelles_13oct", {})[short] = nv
                Fichier.sale(c)
    stats["libelles precises (" + origine + ")" if fait else "libelles deja explicites"] += 1


def rebrancher_instit(paires, D, stats):
    """Ligne jaune (KPI suivi par les institutionnels, src/lib/kpi-instit-fiche.ts) portee par un KPI
    retire : le KPI garde est ajoute a shorts_fiche[ticker] du meme KPI d industrie dans
    src/data/kpi-industries-etat.json (rattachement explicite), sauf s il est deja jaune pour lui."""
    ETAT = "src/data/kpi-industries-etat.json"
    etat = json.load(open(ETAT))
    for p in paires:
        f = D.get(p["ticker"]) or {}
        inst = collections.defaultdict(set)
        for x in f.get("instit", []):
            inst[x["short"]].add(x["fr"])
        # tous les rattachements possibles du retire (pas seulement la premiere ligne jaune servie)
        frs = set(inst.get(str(p["retire"]), set()))
        for ind in etat.get("industries", []):
            for k in ind.get("kpis", []):
                if str(p["retire"]) in (k.get("shorts_fiche") or {}).get(p["ticker"], []):
                    frs.add(k["fr"])
        for fr in frs:
            if fr in inst.get(str(p["garde"]), set()):
                continue
            ind = next((i for i in etat["industries"] if p["ticker"].upper() in [s.upper() for s in i["stes"]]), None)
            k = next((k for k in (ind or {}).get("kpis", []) if k["fr"] == fr), None)
            if k is None:
                stats["institutionnels non rebranches (referentiel introuvable)"] += 1
                continue
            l = k.setdefault("shorts_fiche", {}).setdefault(p["ticker"], [])
            if str(p["garde"]) not in l:
                l.append(str(p["garde"]))
                k.setdefault("_rebranche_13oct", []).append({"ticker": p["ticker"], "retire": p["retire"], "garde": p["garde"]})
                stats["institutionnels rebranches (shorts_fiche)"] += 1
    raw = open(ETAT).read()
    ecrire(ETAT, etat, raw)


def appliquer(paires, garder_deux, D=None):
    stats = collections.Counter()
    IND = "src/data/kpi-industrie-par-societe.json"
    ind = json.load(open(IND))
    DIS = "src/data/disabled-kpis-per-ste.json"
    dis = json.load(open(DIS))
    for p in paires:
        t = p["ticker"]
        trace = {"retire": p["retire"], "garde": p["garde"], "type": p["type"], "decision": p["decision"],
                 "preuve": p.get("preuve") or p.get("accord"), "script": "scripts/scan-kpi-doublons-servis.py"}
        if p["retire_origine"] in ("kpis-haut", "reperes-annuels"):
            c = (f".batches-drafts-safe/kpis-haut/{t}.json" if p["retire_origine"] == "kpis-haut"
                 else f"src/data/kpi-annuel-fiche/{t.upper()}.json")
            j = Fichier.get(c)[0]
            r = next(k for k in j["kpis"] if str(k.get("short")) == str(p["retire"]))
            j["kpis"] = [k for k in j["kpis"] if k is not r]
            j.setdefault("_doublons_retires_13oct", []).append(dict(trace, kpi=r))
            Fichier.sale(c)
            stats["retires " + p["retire_origine"]] += 1
        else:
            lst = dis["overrides"].setdefault(t, [])
            if p["retire"] not in lst:
                lst.append(p["retire"])
            dis.setdefault("_doublons_concept_13oct", {}).setdefault(t, []).append(trace)
            stats["masques base (disabled-kpis-per-ste)"] += 1
        for i in (ind.get("societes", {}).get(t) or {}).get("indicateurs", []):
            if str(i.get("code_sur_fiche")) == str(p["retire"]):
                i["code_sur_fiche"] = p["garde"]
                i["nom_sur_fiche_fr"] = p["garde_nom"]
                i["_repointe_13oct"] = "doublon retire de la fiche servie, voir scripts/scan-kpi-doublons-servis.py"
                stats["institutionnels repointes"] += 1
    for g in garder_deux:
        ann_o = g["a_origine"] if g["a"] == g["annuel"] else g["b_origine"]
        tri_o = g["a_origine"] if g["a"] == g["trimestriel"] else g["b_origine"]
        # le hero n est jamais renomme : son nom sert au dedoublonnage du chargeur (AEP : le hero
        # renomme laissait ressortir son jumeau v2-pipeline, qui l absorbait)
        if g["motif"] != "annuelle = hero, gardee":
            renomme(g["ticker"], g["annuel"], ann_o, MOTS_AN, "exercice", stats)
        renomme(g["ticker"], g["trimestriel"], tri_o, MOTS_TRI, "trimestre", stats)
    if D is not None:
        rebrancher_instit(paires, D, stats)
    Fichier.flush()
    dis["updated_at"] = datetime.datetime.now().isoformat(timespec="seconds")
    json.dump(dis, open(DIS, "w"), ensure_ascii=False, indent=2)
    json.dump(ind, open(IND, "w"), ensure_ascii=False, indent=1)
    return dict(stats)


def ressortis(avant, apres):
    """Apres application : un KPI absent du tableau AVANT et visible APRES est un jumeau que le
    chargeur masquait (dedoublonnage par nom face a kpis-haut, absorption des series recouvrantes,
    jumeau annuel des reperes) et que le retrait ou le libelle precise a fait ressortir. Il est
    masque a son tour, par le meme moyen que les retraits (archive ou disabled-kpis-per-ste)."""
    A, P = json.load(open(avant)), json.load(open(apres))
    DIS = "src/data/disabled-kpis-per-ste.json"
    dis = json.load(open(DIS))
    stats, liste = collections.Counter(), []
    for t in P:
        va = {str(k["short"]) for k in (A.get(t) or {}).get("kpis", []) if k["groupe"] != "non"}
        hp = f".batches-drafts-safe/kpis-haut/{t}.json"
        haut = {str(k.get("short")) for k in (json.load(open(hp)).get("kpis", []) if os.path.exists(hp) else [])}
        rp = f"src/data/kpi-annuel-fiche/{t.upper()}.json"
        rep = {str(k.get("short")) for k in (json.load(open(rp)).get("kpis", []) if os.path.exists(rp) else [])}
        for k in P[t].get("kpis", []):
            s = str(k["short"])
            if k["groupe"] == "non" or s in va or s == str(P[t].get("hero")):
                continue
            o = origine(t, s, haut, rep)
            trace = {"retire": s, "garde": None, "type": "jumeau ressorti",
                     "decision": "masque avant par le chargeur, ressorti apres le retrait de son jumeau",
                     "script": "scripts/scan-kpi-doublons-servis.py --ressortis"}
            liste.append({"ticker": t, "short": s, "nom": k.get("name_fr"), "origine": o})
            if o in ("kpis-haut", "reperes-annuels"):
                c = hp if o == "kpis-haut" else rp
                j = Fichier.get(c)[0]
                r = next(x for x in j["kpis"] if str(x.get("short")) == s)
                j["kpis"] = [x for x in j["kpis"] if x is not r]
                j.setdefault("_doublons_retires_13oct", []).append(dict(trace, kpi=r))
                Fichier.sale(c)
            else:
                l = dis["overrides"].setdefault(t, [])
                if s not in l:
                    l.append(s)
                dis.setdefault("_doublons_concept_13oct", {}).setdefault(t, []).append(trace)
            stats[o] += 1
    Fichier.flush()
    json.dump(dis, open(DIS, "w"), ensure_ascii=False, indent=2)
    return stats, liste


if __name__ == "__main__":
    if "--ressortis" in sys.argv:
        i = sys.argv.index("--ressortis")
        st, li = ressortis(sys.argv[i + 1], sys.argv[i + 2])
        rp = ".conv-state/kpi-doublons-servis-apply-13oct.json"
        r = json.load(open(rp))
        r.setdefault("jumeaux_ressortis", []).extend(li)
        json.dump(r, open(rp, "w"), ensure_ascii=False, indent=1)
        print("jumeaux ressortis masques :", dict(st))
    else:
        main()
