#!/usr/bin/env python3
"""revenue_history (segment, geo) des fiches du niveau 1 (vague sp5001000), 12 oct 2026.

Format de l univers principal (modele NVDA, docs/CONSIGNES-NOUVELLES-SOCIETES.md) :
  revenue_history = {segment: [{fiscal_year, date, total, unit, slices:[{name, label,
  label_en, value, share_pct, pct, unit}]}], geo: [...]}
Le script de l univers principal n est plus dans le depot. Celui-ci lit les
chiffres PUBLIES dans les 10-K deja telecharges (data-lake/<T>/10K, XBRL en
ligne) : chiffre d affaires (us-gaap Revenues ou RevenueFromContractWithCustomer...)
ventile sur un seul axe, StatementBusinessSegmentsAxis (segment, a defaut
ProductOrServiceAxis) ou StatementGeographicalAxis (geo), par exercice de 330 a 380 jours.

Garde-fous (regle de la repartition : somme des parts = CA consolide) :
  - un exercice n est garde que si la somme des parts est a +/- 2 % du CA
    consolide publie dans le meme document, avec au moins 2 parts ;
  - au moins 2 exercices, sinon rien n est ecrit ;
  - libelle : nom francais de la part du bloc actuel quand la valeur du dernier
    exercice coincide (a 0,5 % pres), sinon nom du membre XBRL (anglais).
  - si la fiche a deja un bloc de repartition, l historique n est garde que
    s il a le meme decoupage (au moins 2 parts du dernier exercice retrouvees).
Rien n est estime ni recalcule hors des parts en pourcentage.

Ecrit la cle revenue_history dans src/data/v2-pipeline-enrich/<t>.json
(fusionnee par le chargeur si le PL n en a pas ; conservee par sp5001000-onboard.py).

Usage : python3 scripts/sp5001000-revenue-history-ixbrl.py --tickers-file src/data/univers-sp5001000.json [--force] [--limit N]
"""
import argparse
import datetime as dt
import glob
import gzip
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONCEPTS = ["us-gaap:Revenues", "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax",
            "us-gaap:RevenueFromContractWithCustomerIncludingAssessedTax", "us-gaap:SalesRevenueNet"]
AXES = {"segment": "StatementBusinessSegmentsAxis", "geo": "StatementGeographicalAxis"}

R_CTX = re.compile(r"<xbrli:context\b[^>]*\bid=\"([^\"]+)\"[^>]*>(.*?)</xbrli:context>", re.S | re.I)
R_MEM = re.compile(r"<xbrldi:explicitMember\b[^>]*dimension=\"([^\"]+)\"[^>]*>\s*([^<\s]+)\s*</xbrldi:explicitMember>", re.I)
R_TYP = re.compile(r"<xbrldi:typedMember", re.I)
R_START = re.compile(r"<xbrli:startDate>\s*([\d-]+)\s*</xbrli:startDate>", re.I)
R_END = re.compile(r"<xbrli:endDate>\s*([\d-]+)\s*</xbrli:endDate>", re.I)
R_NF = re.compile(r"<ix:nonFraction\b([^>]*)>(.*?)</ix:nonFraction>", re.S | re.I)
R_ATTR = re.compile(r"([\w:]+)=\"([^\"]*)\"")


def contextes(doc):
    out = {}
    for cid, corps in R_CTX.findall(doc):
        if R_TYP.search(corps):
            continue
        s, e = R_START.search(corps), R_END.search(corps)
        if not s or not e:
            continue
        mem = R_MEM.findall(corps)
        # depuis l ASU 2023-07, les ventilations par segment portent aussi
        # ConsolidationItemsAxis = OperatingSegmentsMember : axe neutre ici
        mem = [(d, m) for d, m in mem if not (d.endswith("ConsolidationItemsAxis") and m.endswith("OperatingSegmentsMember"))]
        out[cid] = (s.group(1), e.group(1), tuple((d.split(":")[-1], m) for d, m in mem))
    return out


def valeur(attrs, inner):
    txt = html.unescape(re.sub(r"<[^>]+>", "", inner)).strip()
    fmt = attrs.get("format", "")
    if "zero" in fmt or txt in ("-", "—", "–", ""):
        return 0.0
    if "comma-decimal" in fmt or "numcommadecimal" in fmt:
        txt = txt.replace(".", "").replace(" ", "").replace(",", ".")
    else:
        txt = txt.replace(",", "").replace(" ", "")
    try:
        v = float(txt)
    except ValueError:
        return None
    v *= 10 ** int(attrs.get("scale") or 0)
    if attrs.get("sign") == "-":
        v = -v
    return v


R_DEI = re.compile(r"<ix:nonNumeric\b[^>]*name=\"dei:(DocumentFiscalYearFocus|DocumentPeriodEndDate)\"[^>]*>(.*?)</ix:nonNumeric>", re.S | re.I)


def decalage_exercice(doc):
    """Exercice nomme par la societe moins annee civile de cloture (ex. SNOW : clos fin janvier 2026 = exercice 2026).
    Cloture = fin la plus recente des contextes annuels du document."""
    v = {k: html.unescape(re.sub(r"<[^>]+>", "", x)).strip() for k, x in R_DEI.findall(doc)}
    fy = re.search(r"(19|20)\d\d", v.get("DocumentFiscalYearFocus", ""))
    fins = [e for s, e, _ in contextes(doc).values()
            if re.match(r"\d{4}-\d\d-\d\d$", s) and re.match(r"\d{4}-\d\d-\d\d$", e)
            and 330 <= (dt.date.fromisoformat(e) - dt.date.fromisoformat(s)).days <= 380]
    if fy and fins:
        d = int(fy.group(0)) - int(max(fins)[:4])
        if d in (-1, 0, 1):
            return d
    return None


def faits(doc):
    ctx = contextes(doc)
    res = {}  # (concept, start, end, members) -> value
    for a, inner in R_NF.findall(doc):
        attrs = dict(R_ATTR.findall(a))
        nom = attrs.get("name")
        if nom not in CONCEPTS:
            continue
        c = ctx.get(attrs.get("contextRef"))
        if not c:
            continue
        v = valeur(attrs, inner)
        if v is None:
            continue
        res.setdefault((nom, c[0], c[1], c[2]), v)
    return res


PAYS = {"US": "États-Unis", "CN": "Chine", "JP": "Japon", "GB": "Royaume-Uni", "DE": "Allemagne", "FR": "France",
        "CA": "Canada", "MX": "Mexique", "BR": "Brésil", "IN": "Inde", "KR": "Corée du Sud", "TW": "Taïwan",
        "AU": "Australie", "NL": "Pays-Bas", "IE": "Irlande", "CH": "Suisse", "IT": "Italie", "ES": "Espagne",
        "SG": "Singapour", "OtherCountries": "Autres pays", "HK": "Hong Kong", "IL": "Israël", "SE": "Suède", "BE": "Belgique", "PR": "Porto Rico"}


def libelle_membre(m):
    if m.startswith("country:"):
        return PAYS.get(m.split(":")[1], m.split(":")[1])
    loc = m.split(":")[-1]
    loc = re.sub(r"Member$", "", loc)
    if loc in ("NonUs", "NonUS", "OtherCountries", "Other"):
        return {"NonUs": "Hors États-Unis", "NonUS": "Hors États-Unis", "OtherCountries": "Autres pays", "Other": "Autres"}[loc]
    loc = re.sub(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])", " ", loc)
    loc = re.sub(r"\s+Segment$", "", loc).strip()
    return loc or m


def series(docs_faits, axe):
    """Par exercice : {end: (start, total, {membre: valeur})} pour le meilleur concept."""
    meilleur = {}
    for concept in CONCEPTS:
        par_an = {}
        for f in docs_faits:  # du plus recent au plus ancien : le plus recent prime
            for (nom, s, e, mem), v in f.items():
                if nom != concept:
                    continue
                try:
                    jours = (dt.date.fromisoformat(e) - dt.date.fromisoformat(s)).days
                except ValueError:
                    continue
                if not 330 <= jours <= 380:
                    continue
                an = par_an.setdefault(e, {"start": s, "total": None, "parts": {}})
                if not mem:
                    if an["total"] is None:
                        an["total"] = v
                elif len(mem) == 1 and mem[0][0] == axe:
                    an["parts"].setdefault(mem[0][1], v)
        ok = {}
        for e, an in par_an.items():
            parts = {m: v for m, v in an["parts"].items() if v and v > 0}
            if an["total"] and an["total"] > 0 and len(parts) >= 2 and abs(sum(parts.values()) - an["total"]) <= 0.02 * an["total"]:
                ok[e] = (an["total"], parts)
        if len(ok) > len(meilleur):
            meilleur = ok
    return meilleur


def bloc_actuel(t, nom):
    try:
        d = json.load(open(f"{ROOT}/data-lake/{t}/{nom}.json"))
        return (d.get("data") or {}).get("slices") or []
    except Exception:
        return []


def en_unite(v, unite):
    return round(v / 1e9, 3) if unite == "Mds $" else round(v / 1e6, 1)


def construit(t, ann, slices_bloc, decal=None):
    if len(ann) < 2:
        return None
    fins = sorted(ann, reverse=True)
    unite = "Mds $" if ann[fins[0]][0] >= 1e10 else "M $"
    # noms francais du bloc actuel, apparies par valeur sur le dernier exercice
    noms_fr = {}
    tot0, parts0 = ann[fins[0]]
    for m, v in parts0.items():
        for s in slices_bloc:
            sv, su = s.get("value"), str(s.get("unit") or "")
            if not isinstance(sv, (int, float)):
                continue
            mult = 1e9 if "Md" in su or su.endswith("B") else 1e6 if ("M" in su) else None
            if mult and abs(sv * mult - v) <= 0.005 * v:
                noms_fr[m] = s.get("name")
                break
    # meme decoupage que le bloc affiche (sinon la bascule « Historique » montrerait
    # une autre ventilation) : au moins 2 parts du dernier exercice retrouvees dans le bloc
    if slices_bloc and len(noms_fr) < 2:
        return None
    out = []
    for e in fins:
        tot, parts = ann[e]
        sl = []
        for m, v in sorted(parts.items(), key=lambda x: -x[1]):
            en = libelle_membre(m)
            nom = noms_fr.get(m) or en
            pct = round(100 * v / tot, 1)
            sl.append({"name": nom, "label": nom, "label_en": en, "value": en_unite(v, unite), "share_pct": pct, "pct": pct, "unit": unite})
        fy = int(e[:4]) + decal if decal is not None else (int(e[:4]) if int(e[5:7]) >= 6 else int(e[:4]) - 1)
        out.append({"fiscal_year": fy, "date": e,
                    "total": en_unite(tot, unite), "unit": unite, "slices": sl})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers-file", required=True)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    d = json.load(open(a.tickers_file))
    tickers = d["tickers"] if isinstance(d, dict) else d
    if a.limit:
        tickers = tickers[: a.limit]
    bilan = {"ecrit": 0, "segment": 0, "geo": 0, "deja": 0, "sans_10k": 0, "rien": 0}
    for t in tickers:
        pe = f"{ROOT}/src/data/v2-pipeline-enrich/{t.lower()}.json"
        en = json.load(open(pe)) if os.path.exists(pe) else {"ticker": t}
        if en.get("revenue_history") and not a.force:
            bilan["deja"] += 1
            continue
        fs = [f for f in sorted(glob.glob(f"{ROOT}/data-lake/{t}/10K/{t}_*.htm.gz")) if "_ER_" not in f and "ex99" not in f.lower()]
        fs = fs[-3:][::-1]
        if not fs:
            bilan["sans_10k"] += 1
            continue
        docs, decal = [], None
        for f in fs:
            try:
                brut = gzip.open(f, "rt", encoding="utf-8", errors="ignore").read()
            except Exception:
                continue
            docs.append(faits(brut))
            if decal is None:
                decal = decalage_exercice(brut)
        rh = {}
        for cle, axe in AXES.items():
            ser = series(docs, axe)
            if len(ser) < 2 and cle == "segment":
                ser = series(docs, "ProductOrServiceAxis")  # a defaut : ventilation par produit ou service
            v = construit(t, ser, bloc_actuel(t, "segments_fr" if cle == "segment" else "geo_fr"), decal)
            if v:
                rh[cle] = v
                bilan[cle] += 1
        if not rh:
            bilan["rien"] += 1
            continue
        en = json.load(open(pe)) if os.path.exists(pe) else {"ticker": t}
        en["_revenue_history_source"] = "XBRL en ligne des 10-K (data-lake/%s/10K : %s)" % (t, ", ".join(os.path.basename(f) for f in fs))
        en["revenue_history"] = rh
        with open(pe, "w", encoding="utf-8") as f:
            json.dump(en, f, ensure_ascii=False, indent=2)
        bilan["ecrit"] += 1
    print(json.dumps(bilan, ensure_ascii=False))


if __name__ == "__main__":
    main()
