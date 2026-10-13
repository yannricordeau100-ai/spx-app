#!/usr/bin/env python3
"""Doublons de CONCEPT sur une fiche (13 oct 2026, verif n0 : JPM « Ratio CET1 » 14,2 % T2 2026
et « Ratio de fonds propres de base de categorie 1 » 14,6 % T4 2025 ; CAT « Carnet de commandes
ferme » / « Carnet de commandes »).

Complete scripts/scan-kpi-doublons.py (meme libelle normalise) : ici deux KPI d une meme fiche
sont le meme concept quand leurs series concordent sur les periodes communes (valeur annuelle
= T4 pour un stock ou un ratio, = somme des 4 trimestres pour un flux, tolerance 3 %), avec un
nom ou un type comparable voisin. Cause principale : scripts/cahier-pose.py posait une serie
annuelle CAHIER_* a cote d une serie trimestrielle deja en ligne (statut « existe »).

Regle de garde (consigne Yann) : on garde la serie la plus recente, puis la plus longue.
Rien n est perdu : la serie retiree est archivee dans le KPI garde, champ
`_doublon_retire_13oct` (non affiche), avec sa note de source.

Univers : src/data/v1-9-5-clean-all-tickers.json uniquement.
Usage : python3 scripts/scan-kpi-doublons-concept.py            (simulation, rapport)
        python3 scripts/scan-kpi-doublons-concept.py --apply    (ecrit les fiches)
Sortie : .conv-state/kpi-doublons-concept.json
"""
import collections, datetime, json, os, re, sys, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
APPLY = "--apply" in sys.argv
STOP = {"de", "du", "des", "d", "le", "la", "les", "l", "en", "the", "of", "total", "et", "and", "a", "au",
        "aux", "par", "sur", "ratio", "taux", "rate", "annuel", "annuelle", "trimestriel", "trimestrielle"}


def toks(s):
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return {w for w in re.sub(r"[^a-z0-9 ]", " ", s).split() if w not in STOP and len(w) > 1}


def fam(u):
    u = str(u or "").lower()
    if "%" in u or re.search(r"\b(pts?|pb|bps?)\b", u):
        return "pct"
    if any(c in u for c in ["$", "eur", "€", "usd", "chf", "£", "gbp", "sek", "dkk"]):
        return "money"
    return "autre"


def yr(q):
    m = re.search(r"(19|20)\d{2}", str(q))
    return int(m.group(0)) if m else None


def qn(q):
    m = re.match(r"^Q([1-4])", str(q))
    return int(m.group(1)) if m else None


def points(k):
    return [x for x in (k.get("history") or []) if isinstance(x, dict) and isinstance(x.get("v"), (int, float))]


def cle(q):
    return (yr(q) or 0) * 10 + (qn(q) or 5)


def annuel(k):
    """annee -> valeurs annuelles candidates (T4, somme, moyenne pour une serie trimestrielle)."""
    h = points(k)
    out = collections.defaultdict(list)
    if all(qn(x["q"]) is None for x in h):
        for x in h:
            if yr(x["q"]):
                out[yr(x["q"])].append(x["v"])
        return out
    par = collections.defaultdict(dict)
    for x in h:
        if yr(x["q"]) and qn(x["q"]):
            par[yr(x["q"])][qn(x["q"])] = x["v"]
    for y, d in par.items():
        if 4 in d:
            out[y].append(d[4])
        if len(d) == 4:
            out[y] += [sum(d.values()), sum(d.values()) / 4]
    return out


def proche(a, b, pct, tol):
    for f in ((1,) if pct else (1, 1000, 0.001)):
        bb = b * f
        # un taux se compare en points (0,3 pt d arrondi ou de moyenne), jamais en relatif
        if pct:
            if abs(a - bb) <= (0.3 if tol >= 0.03 else 0.051):
                return True
        elif abs(a - bb) <= max(tol * max(abs(a), abs(bb)), 1e-9):
            return True
    return False


def trimestriel(k):
    return any(qn(x["q"]) for x in points(k))


def accord(K, T, tol=0.03):
    """Nombre de periodes concordantes / periodes communes. Deux series trimestrielles :
    memes libelles compares un a un. Sinon la serie annuelle sert de reference."""
    pct = fam(K.get("unit")) == "pct"
    if trimestriel(K) and trimestriel(T):
        a = {x["q"]: x["v"] for x in points(K) if qn(x["q"])}
        b = {x["q"]: x["v"] for x in points(T) if qn(x["q"])}
        qs = [q for q in a if q in b]
        return sum(1 for q in qs if proche(a[q], b[q], pct, tol)), len(qs)
    if trimestriel(K):
        K, T = T, K
    a, b = annuel(K), annuel(T)
    ys = [y for y in a if y in b]
    return sum(1 for y in ys if any(proche(a[y][0], v, pct, tol) for v in b[y])), len(ys)


DISCR = {"ajuste", "ajustee", "adjusted", "non", "gaap", "moyen", "moyenne", "moyens", "average", "avg", "net",
         "nette", "nets", "perimetre", "constant", "comparable", "comparables", "same", "organique", "organic",
         "libre", "free", "brut", "brute", "gross", "core", "sous", "hors", "ex", "excluding", "segment", "part",
         "croissance", "growth", "variation", "marge", "margin", "par", "per", "cumule", "9m", "s1", "h1"}


def recence(k):
    """Date du dernier point (un exercice FY vaut son T4), puis nombre de points."""
    h = points(k)
    return (max(((yr(x["q"]) or 0) * 10 + (qn(x["q"]) or 4) for x in h), default=0), len(h))


def tc(k):
    return ((k.get("type_comparable") or {}).get("fr") or "").strip().lower()


# Paires hors Cahier ou deux perimetres differents portent la meme serie : copie probable
# d une serie dans l autre (erreur de source), a reprendre a la source, jamais retiree ici.
COPIES_A_VERIFIER = {("BAX", "INJANEST_REV_US"), ("LITE", "TEL_DAT"), ("SRE", "SRE electric revenues"),
                     ("SYY", "specialty_produce_protein"), ("TEL", "data_devices_rev_q"),
                     ("UHS", "BH_lic_beds_q"), ("HEIA.AS", "NET_REV_IFRS_FY")}


def heros():
    """KPI hero par societe : v2-pipeline, kpis-haut, et instantane des overrides Supabase
    (desk_hero_kpi_overrides) passe par --heros <fichier.json> (liste {ticker, hero_kpi_short})."""
    h = collections.defaultdict(set)
    if "--heros" in sys.argv:
        for x in json.load(open(sys.argv[sys.argv.index("--heros") + 1])):
            h[str(x.get("ticker", "")).upper()].add(str(x.get("hero_kpi_short")))
    return h


def main():
    U = json.load(open("src/data/v1-9-5-clean-all-tickers.json"))["tickers"]
    H = heros()
    IND = "src/data/kpi-industrie-par-societe.json"
    ind = json.load(open(IND))
    repointes = 0
    paires, a_verifier, modifs = [], [], collections.Counter()
    for t in U:
        p = f".batches-drafts-safe/kpis-haut/{t}.json"
        if not os.path.exists(p):
            continue
        raw = open(p).read()
        j = json.loads(raw)
        ks = j.get("kpis", [])
        cah = {}
        cp = f"docs/cahier/donnees/{t}.json"
        if os.path.exists(cp):
            cah = {c["short"]: c for c in json.load(open(cp)).get("kpis", [])}
        vus, retirer = set(), {}
        hero_t = set(H.get(t.upper(), set()))
        for hp in (f"src/data/v2-pipeline/{t}.json", f"src/data/v2-pipeline/{t.lower()}.json"):
            if os.path.exists(hp):
                try:
                    hero_t.add(str(json.load(open(hp)).get("hero_kpi")))
                except Exception:
                    pass
        hero_t.add(str(j.get("hero_kpi")))
        for i, K in enumerate(ks):
            for T in ks[i + 1:]:
                sK, sT = str(K.get("short")), str(T.get("short"))
                if sK in retirer or sT in retirer or fam(K.get("unit")) != fam(T.get("unit")):
                    continue
                un_cahier = sK.startswith("CAHIER_") != sT.startswith("CAHIER_")
                ok, n = accord(K, T, 0.03 if un_cahier else 0.005)
                nK = toks(K.get("name_fr")) | toks(K.get("name_en"))
                nT = toks(T.get("name_fr")) | toks(T.get("name_en"))
                c = cah.get(sK.replace("CAHIER_", ""), {}) if sK.startswith("CAHIER_") else cah.get(sT.replace("CAHIER_", ""), {})
                sel = c.get("short_en_ligne")
                if sel:
                    nK |= toks(sel) if sK.startswith("CAHIER_") else set()
                    nT |= toks(sel) if sT.startswith("CAHIER_") else set()
                jac = len(nK & nT) / max(1, len(nK | nT))
                meme_type = bool(tc(K)) and tc(K) == tc(T)
                exact = bool(sel) and sel in (K.get("short"), K.get("name_en"), K.get("name_fr"), T.get("short"), T.get("name_en"), T.get("name_fr"))
                # concept identique : series concordantes ; si les noms ne se ressemblent pas,
                # il faut au moins 5 exercices concordants (evite les coincidences, ex GLW).
                lien_nom = jac >= 0.2 or meme_type or exact
                # « hors carburant » / « avec carburant » : deux concepts voisins, pas un doublon
                if un_cahier and ({"hors", "avec", "ex", "excluding", "including"} & (nK ^ nT)):
                    lien_nom = False
                    if ok < n or n < 5:
                        n = 0
                if n and ((lien_nom and ok >= 2 and ok / n >= 0.75) or (not lien_nom and ok >= 5 and ok / n >= 0.9)):
                    # Hors Cahier (deux KPI poses par les pipelines) : exigence forte, sinon signale
                    # seulement (segment / total, ajuste / publie, moyen / fin de periode...).
                    if not un_cahier:
                        tk = toks(K.get("name_fr")) | toks(K.get("name_en"))
                        tt = toks(T.get("name_fr")) | toks(T.get("name_en"))
                        # Hors Cahier, seul le vrai double est retire : meme frequence, memes
                        # valeurs aux memes periodes. Trimestriel + annuel (deux horizons) et copies
                        # de serie sous deux noms differents (erreur de source) : signales.
                        if not (trimestriel(K) == trimestriel(T) and ok >= 4 and ok / n >= 0.9
                                and (jac >= 0.5 or meme_type) and not ((tk ^ tt) & DISCR)):
                            a_verifier.append({"ticker": t, "a": sK, "b": sT, "accord": f"{ok}/{n}", "motif": "hors Cahier, concept a confirmer"})
                            continue
                    garde, retire = (K, T) if recence(K) >= recence(T) else (T, K)
                    if str(retire.get("short")) in hero_t:
                        # le hero de la fiche ne disparait jamais : il garde la place, l autre est archive
                        garde, retire = retire, garde
                    if (t, str(retire.get("short"))) in COPIES_A_VERIFIER or (t, str(garde.get("short"))) in COPIES_A_VERIFIER:
                        a_verifier.append({"ticker": t, "a": sK, "b": sT, "accord": f"{ok}/{n}", "motif": "copie de serie probable entre deux perimetres, a reprendre a la source"})
                        continue
                    retirer[str(retire.get("short"))] = garde
                    paires.append({"ticker": t, "garde": garde.get("short"), "garde_nom": garde.get("name_fr"),
                                   "retire": retire.get("short"), "retire_nom": retire.get("name_fr"),
                                   "accord": f"{ok}/{n}", "jaccard": round(jac, 2), "meme_type": meme_type})
                elif un_cahier and (exact or meme_type or jac >= 0.5):
                    a_verifier.append({"ticker": t, "a": sK, "b": sT, "accord": f"{ok}/{n}", "motif": "nom voisin, valeurs non concordantes ou absentes"})
        if APPLY and retirer:
            for s, garde in retirer.items():
                r = next(k for k in ks if str(k.get("short")) == s)
                garde.setdefault("_doublon_retire_13oct", []).append({k: v for k, v in r.items() if k in (
                    "short", "name_fr", "name_en", "value", "unit", "frequency", "history", "_src_note", "_source", "_cahier_note", "last_data_date")})
            j["kpis"] = [k for k in ks if str(k.get("short")) not in retirer]
            for i in (ind.get("societes", {}).get(t) or {}).get("indicateurs", []):
                g = retirer.get(str(i.get("code_sur_fiche")))
                if g is not None:
                    i["code_sur_fiche"] = g.get("short")
                    i["nom_sur_fiche_fr"] = g.get("name_fr")
                    i["nom_sur_fiche_en"] = g.get("name_en")
                    i["_repointe_13oct"] = "doublon de concept retire, voir scripts/scan-kpi-doublons-concept.py"
                    repointes += 1
            indent = 2 if raw.startswith("{\n  ") else (1 if raw.startswith("{\n ") else None)
            json.dump(j, open(p, "w"), ensure_ascii=False, indent=indent)
            modifs[t] += len(retirer)
    if APPLY and repointes:
        json.dump(ind, open(IND, "w"), ensure_ascii=False, indent=1)
    rap = {"maj": datetime.date.today().isoformat(), "mode": "apply" if APPLY else "simulation",
           "paires": paires, "a_verifier": a_verifier,
           "regle": "series concordantes (>= 2 exercices, >= 75 %) + nom/type voisin (ou >= 5 exercices) ; garde la plus recente puis la plus longue ; serie retiree archivee dans _doublon_retire_13oct"}
    os.makedirs(".conv-state", exist_ok=True)
    json.dump(rap, open(".conv-state/kpi-doublons-concept.json", "w"), ensure_ascii=False, indent=1)
    print(f"doublons de concept : {len(paires)} sur {len({p['ticker'] for p in paires})} fiches ; a verifier : {len(a_verifier)} ; "
          f"KPI retires : {sum(modifs.values())} ; institutionnels repointes : {repointes} ({'apply' if APPLY else 'simulation'})")


if __name__ == "__main__":
    main()
