#!/usr/bin/env python3
"""Controle de conformite des KPI du Cahier poses en couche kpis-haut (07/09/2026).

Conditions du proprietaire avant publication (simulation obligatoire) :
 1. signal : environ 150 caracteres (accepte 60 a 280), AUCUNE URL, aucune
    mention de pose (« Allonge le », « Pose depuis le Cahier », nom de fichier),
    francais accentue (heuristique), pas de tiret long, apostrophes d elision
    presentes (pas de « l or », « d abonnes »).
 2. titres name_fr / name_en : aucune mention (serie annuelle) ou equivalent.
 3. stories (is_short_history) : derniere donnee en 2025 ou apres.
 4. JSON valide.
Sortie : liste des problemes, code retour 1 si au moins un.
Usage : python3 scripts/scan-cahier-conformite.py [TICKER...]
"""
import json, glob, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RE_URL = re.compile(r"https?://|www\.")
RE_POSE = re.compile(r"allong[eé] le|pos[eé] depuis|docs/cahier|\.json|cahier le \d", re.I)
RE_SERIE = re.compile(r"\((?:s[ée]rie annuelle|annual series|semi-annual series|s[ée]rie semestrielle|s[ée]rie trimestrielle)\)", re.I)
RE_ELISION = re.compile(r"\b[ldnjcLDNJC] (?=[aeiouyhéèêàâîôûAEIOUYH])")
RE_ACCENT = re.compile(r"[éèêàçùûôî]")


def problemes_kpi(t, k):
    pb = []
    sig = k.get("signal") or ""
    nom = k.get("name_fr") or ""
    if not sig.strip():
        pb.append(f"{t} {k.get('short')} : signal vide")
        return pb
    if len(sig) < 60 or len(sig) > 280:
        pb.append(f"{t} {k.get('short')} : signal {len(sig)} caracteres (attendu ~150)")
    if RE_URL.search(sig):
        pb.append(f"{t} {k.get('short')} : URL dans le signal")
    if RE_POSE.search(sig):
        pb.append(f"{t} {k.get('short')} : mention de pose dans le signal")
    if "—" in sig or "—" in nom:
        pb.append(f"{t} {k.get('short')} : tiret long")
    if RE_SERIE.search(nom) or RE_SERIE.search(k.get("name_en") or ""):
        pb.append(f"{t} {k.get('short')} : mention serie annuelle dans le titre")
    if RE_ELISION.search(sig):
        pb.append(f"{t} {k.get('short')} : elision manquante ({RE_ELISION.search(sig).group(0)!r}...)")
    # accents : un texte francais de 100+ caracteres sans aucun accent est suspect
    if len(sig) >= 100 and not RE_ACCENT.search(sig):
        pb.append(f"{t} {k.get('short')} : signal sans aucun accent (suspect)")
    if k.get("is_short_history"):
        ldd = str(k.get("last_data_date") or "")
        if ldd[:4] < "2025":
            pb.append(f"{t} {k.get('short')} : story avec derniere donnee {ldd[:4]}")
    return pb


def main():
    seuls = {a.upper() for a in sys.argv[1:]}
    pbs = []
    n = 0
    for p in sorted(glob.glob(os.path.join(ROOT, ".batches-drafts-safe/kpis-haut/*.json"))):
        t = os.path.basename(p)[:-5]
        if seuls and t.upper() not in seuls:
            continue
        try:
            d = json.load(open(p))
        except Exception as e:
            pbs.append(f"{t} : JSON invalide ({e})")
            continue
        ks = d if isinstance(d, list) else d.get("kpis", []) or []
        for k in ks:
            if isinstance(k, dict) and k.get("_cahier"):
                n += 1
                pbs.extend(problemes_kpi(t, k))
    for x in pbs:
        print(x)
    print(f"controle : {n} KPI cahier, {len(pbs)} problemes")
    sys.exit(1 if pbs else 0)


if __name__ == "__main__":
    main()
