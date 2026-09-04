#!/usr/bin/env python3
"""
Prepare les PASSAGES des 10-K ou figure l effectif (Yann 3 sept 2026).

Les effectifs ne sont pas dans le XBRL : ils vivent dans le texte du rapport
annuel, section "Human Capital" ou Item 1. Ce script ne fait AUCUN appel a un
modele : il decoupe, pour chaque societe et chaque annee, un extrait court
autour des mentions d effectif. C est ce petit extrait qui sera lu ensuite,
au lieu du rapport entier (4900 documents, plusieurs Go).

Sortie : .conv-state/effectifs-extraits/<TICKER>.json
  { "ticker": "...", "annees": [ {"annee": 2025, "depot": "2025-10-31",
    "extraits": ["...", "..."] } ] }
"""
from __future__ import annotations
import argparse, gzip, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SORTIE = ROOT / ".conv-state/effectifs-extraits"
FENETRE = 900          # caracteres de part et d autre de la mention
MAX_EXTRAITS = 5       # par annee

# Un effectif s ecrit toujours "un nombre + un mot de personnel". On exige les
# DEUX, sinon on ramasse n importe quel paragraphe contenant le mot employee.
PERSONNEL = r"(?:full[- ]time |part[- ]time |regular |global |total |equivalent |permanent |salaried )*(?:employees|associates|colleagues|team members|people|workers)"
CHIFFRE = r"(?:approximately |about |over |more than |nearly |around )?([\d]{1,3}(?:,\d{3})+|[\d]{4,}|[\d]{1,3}(?:\.\d)? ?(?:thousand|million))"
# Trois formulations couvrent la quasi-totalite des 10-K :
#   "approximately 166,000 employees"        -> nombre puis mot de personnel
#   "we employed approximately 61,000"       -> verbe puis nombre
#   "total workforce was approximately 182,000" (Boeing) -> nom puis nombre,
#     sans mot de personnel derriere : c est ce cas qui manquait.
EFFECTIF = re.compile(
    rf"{CHIFFRE}\s+{PERSONNEL}|"
    rf"(?:employed|employs|employ|had|have|with|totaling|totalling)\s+{CHIFFRE}\s*{PERSONNEL}?|"
    rf"(?:workforce|headcount|employee count|number of employees|total employment)"
    rf"[^.\d]{{0,60}}{CHIFFRE}",
    re.I,
)
TITRE = re.compile(r"human capital|our (?:people|employees|workforce)|employees\b", re.I)
# Ces contextes parlent d autre chose (plans d actions, retraites, actionnaires).
PARASITES = re.compile(r"(stock plan|401\(k\)|pension|espp|equity incentive|option grants|"
                       r"shareholders of record|holders of record|capital employed|"
                       r"collective bargaining agreement expir)", re.I)
# En-tete technique du document XBRL : suite de jetons "us-gaap:XxxMember" qui
# contient le mot workforce (AssembledWorkforceMember) sans aucun rapport avec
# l effectif. Un extrait qui en contient est ecarte.
BRUIT_XBRL = re.compile(r"(us-gaap:|srt:|dei:|[a-z]{2,6}:[A-Z][A-Za-z]*Member)")

# Un intitule de section est le meilleur point d entree : le paragraphe qui
# suit annonce presque toujours l effectif total (cas Boeing, ExxonMobil, ou
# la mention chiffree isolee tombait sur un tableau syndical ou sur
# "capital employed").
INTITULES = re.compile(r"(human capital(?: management| resources)?|our people|"
                       r"our employees|employees and human capital|workforce)\b", re.I)


def texte_du_depot(f: Path) -> str:
    ouvre = gzip.open if f.suffix == ".gz" else open
    brut = ouvre(f, "rb").read().decode("utf-8", "ignore")
    brut = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", brut)
    brut = re.sub(r"<[^>]+>", " ", brut)
    brut = (brut.replace("&nbsp;", " ").replace("&#160;", " ")
                .replace("&amp;", "&").replace("&#8217;", "'").replace("&rsquo;", "'"))
    return re.sub(r"\s+", " ", brut)


def extraits_du_depot(f: Path) -> list[str]:
    t = texte_du_depot(f)
    # On ne coupe PAS le document : selon la mise en page, le texte de l Item 1
    # arrive apres un long en-tete XBRL (cas Apple, ou couper a 55 % faisait
    # perdre les 166 000 salaries). Les faux positifs sont ecartes par les
    # contextes parasites et par la note de pertinence.
    candidats = []
    for m in INTITULES.finditer(t):
        bout = t[m.start(): min(len(t), m.start() + 2600)].strip()
        if EFFECTIF.search(bout) and not PARASITES.search(bout[:400]) and not BRUIT_XBRL.search(bout):
            candidats.append((10, m.start(), bout))
    for m in EFFECTIF.finditer(t):
        d = max(0, m.start() - FENETRE)
        fin = min(len(t), m.end() + FENETRE)
        bout = t[d:fin].strip()
        if PARASITES.search(bout) or BRUIT_XBRL.search(bout):
            continue
        # Note de pertinence : un intitule "Human Capital" a proximite, et une
        # formulation "approximately N employees" valent mieux qu une mention
        # isolee au detour d une phrase.
        note = 0
        if re.search(r"human capital", bout, re.I):
            note += 3
        if TITRE.search(bout):
            note += 1
        if re.search(r"(approximately|about|nearly)\s+[\d,]{4,}", bout, re.I):
            note += 2
        if re.search(r"worldwide|globally|in total|company[- ]wide", bout, re.I):
            note += 1
        candidats.append((note, m.start(), bout))
    candidats.sort(key=lambda c: (-c[0], c[1]))
    out, vus = [], set()
    for _, _, bout in candidats:
        cle = bout[:120]
        if cle in vus:
            continue
        vus.add(cle)
        out.append(bout)
        if len(out) >= MAX_EXTRAITS:
            break
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    SORTIE.mkdir(parents=True, exist_ok=True)
    if a.tickers:
        liste = [t.strip().upper() for t in a.tickers.split(",") if t.strip()]
    else:
        univers = json.load(open(ROOT / "src/data/v1-9-5-clean-all-tickers.json"))["tickers"]
        liste = [t for t in univers if "." not in t]
    faits = vides = 0
    for i, t in enumerate(liste, 1):
        dest = SORTIE / f"{t}.json"
        if dest.exists() and not a.force:
            faits += 1
            continue
        dossier = ROOT / "data-lake" / t / "10K"
        if not dossier.is_dir():
            vides += 1
            continue
        annees = []
        for f in sorted(dossier.iterdir()):
            m = re.search(r"(\d{4})-(\d{2})-(\d{2})", f.name)
            if not m:
                continue
            try:
                ex = extraits_du_depot(f)
            except Exception:
                continue
            if not ex:
                continue
            annees.append({"depot": m.group(0), "fichier": f.name, "extraits": ex})
        if not annees:
            vides += 1
            print(f"[{i}/{len(liste)}] {t} : aucun passage trouve", flush=True)
            continue
        dest.write_text(json.dumps({"ticker": t, "annees": annees}, ensure_ascii=False, indent=1))
        faits += 1
        print(f"[{i}/{len(liste)}] {t} : {len(annees)} annees, "
              f"{sum(len(x['extraits']) for x in annees)} extraits", flush=True)
    print(f"FINI faits={faits} vides={vides}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
