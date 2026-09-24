#!/usr/bin/env python3
"""Accents manquants dans les textes francais des fiches (25 sept 2026).

Un mot est corrige seulement si :
  - il n existe PAS tel quel en francais (lexique pyspellchecker fr),
  - une forme accentuee du meme mot existe (lexique ou textes deja accentues
    du depot) ; la forme la plus frequente du depot l emporte, puis le lexique.
Jamais touches : cles techniques (cle, short, slug, url, ticker, dates...),
citations et champs anglais, chaines qui ressemblent a de l anglais.

Usage : python3 scripts/accents-restaurer.py [--ecrit] [dossiers...]
Sans --ecrit : bilan et exemples seulement."""
import json, re, sys, unicodedata, collections, glob
from spellchecker import SpellChecker

DOSSIERS = ["src/data/v2-pipeline", "src/data/v2-pipeline-enrich", "src/data/these", "src/data/transcript-summaries",
            ".batches-drafts-safe/kpis-haut", "src/data/transcripts-kpi", "src/data/companies"]
CLES_EXCLUES = re.compile(r"(?i)^(cle|key|short|id|slug|url|href|ticker|date|source_url|citation|quote|verbatim|content|texte_source|name_en|title_en|.*_en|en|de|unit|unite|valeur|value|periode|theme|famille|type|kind|origine|source.*|statut|status|methode|moteur|model|modele|provenance|_.*)$")
FR_STOP = set("le la les des une un du et est pour dans par sur avec sont qui que pas plus au aux ce cette ses son".split())
EN_STOP = set("the and of to in for is are with that this on by from was were be as at an our we".split())
MOT = re.compile(r"[A-Za-zÀ-ſ]+")
AMBIGUS = set("uber hero heros equity materially derive derives derivee pre impacte impactes releve releves peche pechee a ou la des du sur mur cote marche peche pecher tache taches age ages eleve eleves interne internes forme formes pret prets retire retires cree crees role roles".split())

lex = SpellChecker(language="fr").word_frequency
lex_en = SpellChecker(language="en").word_frequency
NOMS_OK = {"etats", "etat", "amerique", "europeenne", "europeen", "societe", "resultat", "resultats"}


def sans_accent(w):
    return "".join(c for c in unicodedata.normalize("NFD", w) if unicodedata.category(c) != "Mn")


def textes(o, cle=""):
    if isinstance(o, dict):
        for k, v in o.items():
            yield from textes(v, k)
    elif isinstance(o, list):
        for v in o:
            yield from textes(v, cle)
    elif isinstance(o, str) and not CLES_EXCLUES.match(cle or ""):
        yield o


def est_francais(s):
    mots = [m.lower() for m in MOT.findall(s)]
    return sum(m in FR_STOP for m in mots) >= sum(m in EN_STOP for m in mots)


def fichiers(dossiers):
    for d in dossiers:
        for f in glob.glob(d + "/*.json"):
            if f.endswith("companies/wkl.as.json"):
                continue
            yield f


def main():
    ecrit = "--ecrit" in sys.argv
    dossiers = [a for a in sys.argv[1:] if not a.startswith("--")] or DOSSIERS
    # 1. frequences des formes accentuees deja presentes dans le depot
    corpus = collections.Counter()
    for f in fichiers(dossiers):
        try:
            d = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        for s in textes(d):
            if est_francais(s):
                for m in MOT.findall(s):
                    if m != sans_accent(m):
                        corpus[m.lower()] += 1
    variantes = collections.defaultdict(list)
    for w in set(corpus) | {w for w in lex.keys() if w != sans_accent(w)}:
        variantes[sans_accent(w)].append(w)

    def remplace(w, debut, pur_fr):
        lw = w.lower()
        if lw in AMBIGUS or len(lw) < 3 or lw in lex or lw != sans_accent(lw):
            return w
        # mot anglais : seulement dans une phrase purement francaise
        if lw in lex_en and lex_en[lw] > 0 and not pur_fr:
            return w
        anglais = lw in lex_en and lex_en[lw] > 0
        # majuscule en milieu de phrase : nom propre probable
        if w[0].isupper() and not debut and lw not in NOMS_OK:
            return w
        vs = variantes.get(lw)
        if not vs:
            return w
        best = max(vs, key=lambda v: (corpus.get(v, 0), lex[v] if v in lex else 0))
        if corpus.get(best, 0) == 0 and (best not in lex or lex[best] < 50):
            return w
        # un mot qui existe aussi en anglais : la forme accentuee doit deja
        # etre courante dans nos textes francais
        if anglais and corpus.get(best, 0) < 20:
            return w
        if w.isupper():
            return best.upper()
        if w[0].isupper():
            return best[0].upper() + best[1:]
        return best

    total, nfich, ex = 0, 0, collections.Counter()

    def corrige(o, cle=""):
        nonlocal total
        if isinstance(o, dict):
            return {k: corrige(v, k) for k, v in o.items()}
        if isinstance(o, list):
            return [corrige(v, cle) for v in o]
        if isinstance(o, str) and not CLES_EXCLUES.match(cle or "") and "_" not in o and "://" not in o:
            mots = [x.lower() for x in MOT.findall(o)]
            fr = sum(x in FR_STOP for x in mots); en = sum(x in EN_STOP for x in mots)
            if len(mots) >= 4 and not ((fr >= 2 and fr > 2 * en) or (fr >= 1 and en == 0)):
                return o
            if len(mots) < 4 and en:
                return o
            pur_fr = fr >= 3 and en == 0

            def f(m):
                nonlocal total
                avant = o[:m.start()].rstrip()
                debut = not avant or avant[-1] in ".!?:;«(\"-–" or len(mots) < 4
                r = remplace(m.group(0), debut, pur_fr)
                if r != m.group(0):
                    total += 1
                    ex[(m.group(0), r)] += 1
                return r
            return MOT.sub(f, o)
        return o

    for fp in fichiers(dossiers):
        try:
            d = json.load(open(fp, encoding="utf-8"))
        except Exception:
            continue
        avant = total
        n = corrige(d)
        if total > avant:
            nfich += 1
            if ecrit:
                brut = open(fp, encoding="utf-8").read()
                ind = 2 if "\n  \"" in brut[:200] else (1 if "\n \"" in brut[:200] else None)
                json.dump(n, open(fp, "w", encoding="utf-8"), ensure_ascii=False, indent=ind)
    print(f"{total} mots corriges dans {nfich} fichiers ({'ecrit' if ecrit else 'essai'})")
    for (a, b), k in ex.most_common(120):
        print(f"  {a} -> {b} ({k})")


if __name__ == "__main__":
    main()
