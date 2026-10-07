#!/usr/bin/env python3
"""
Generateur systematique des graphiques du bloc "Indicateurs varies - Moyen terme".

Regle Yann (16 sept 2026) : un graphique repris d une source exterieure n est
JAMAIS copie-colle. On garde le fond (les valeurs publiees, citees avec leur
source) et on refait la forme au gabarit Mettrik, en deux versions (sombre et
claire), comme les graphiques ASML et Google.

Regles Yann (21 sept 2026) :
  - une unite en pourcentage ne s ecrit plus au dessus des barres (18,7 et non
    18,7 %) ;
  - le signe pourcent apparait une seule fois, au milieu de l axe vertical,
    legerement decale a gauche des graduations, sans les chevaucher ;
  - la legende separe les series par un espace franc, et passe sur deux lignes
    plutot que de deborder.

Usage :
    python3 scripts/finding-svg.py specs/mon-graphique.json
    python3 scripts/finding-svg.py specs/*.json

Format de la spec (JSON) :
{
  "slug": "nvda-unites-generation",        # nom de fichier
  "dossier": "public/findings/demande-0",  # dossier de sortie
  "titre": "...",
  "sous_titre": "en milliers d unites. Source : ... - 27 aout 2026",
  "type": "bars" | "grouped",
  "unite_suffixe": "",                     # ajoute apres chaque valeur
  "categories": ["2022", "2023"],          # axe X
  "series": [{"nom": "A100", "couleur": "violet", "valeurs": [768, 194]}],
  "legende": true
}
Couleurs disponibles : violet, vert, cyan, ambre, rose, gris.
"""
import json, re
import sys
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
import mt_police as POLICE
import importlib.util
from pathlib import Path

# 7 oct 2026 : le detecteur scripts/verif-axes-mt.py fournit la MEME mesure de
# texte que le generateur (largeur jamais sous-estimee) et le controle final :
# un graphique dont deux libelles de l axe X se chevauchent n est pas ecrit.
_sp = importlib.util.spec_from_file_location("verif_axes_mt", Path(__file__).with_name("verif-axes-mt.py"))
VERIF = importlib.util.module_from_spec(_sp)
_sp.loader.exec_module(VERIF)

W, H = 800, 450
MARGE_G, MARGE_D = 80, 30
HAUT, BAS = 32, 380  # Yann 18 sept 2026 : plus de titre dans le SVG, marge haute reduite

PALETTE = {
    "violet": "#a78bfa",
    "vert": "#10b981",
    "cyan": "#22d3ee",
    "ambre": "#f59e0b",
    "rose": "#fb7185",
    "gris": "#94a3b8",
    # 26 sept 2026 : noms courants acceptes (une couleur inconnue sortait en noir).
    "bleu": "#60a5fa",
    "orange": "#fb923c",
    "rouge": "#f87171",
    "jaune": "#facc15",
}
ORDRE = ["violet", "cyan", "vert", "ambre", "rose", "gris"]

THEMES = {
    "dark": {"fond": "#0a0a0e", "titre": "#fafafa", "gris": "#888", "grille": "#1f1f24", "axe": "#bbb", "legende": "#ccc"},
    "light": {"fond": "#ffffff", "titre": "#0a0a0e", "gris": "#666", "grille": "#e5e5ea", "axe": "#444", "legende": "#333"},
}

# Etiquette posee dans la barre quand il n y a plus de place au dessus :
# les couleurs de la palette sont toutes claires, ce ton tres sombre reste lisible.
ENCRE_SUR_BARRE = "#0a0a0e"


def echappe(t: str) -> str:
    return (str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def largeur_texte(t: str, taille: float, mono: bool = False) -> float:
    """Largeur approchee d un texte, en pixels, pour eviter les chevauchements."""
    if mono:
        return len(t) * taille * 0.60
    return POLICE.largeur(t, taille, False)
    total = 0.0
    for ch in t:
        if ch in " .,;:'!|()[]ijltfIr":
            total += 0.34
        elif ch in "mwMW":
            total += 0.88
        elif ch.isupper() or ch.isdigit():
            total += 0.66
        else:
            total += 0.55
    return total * taille


# 7 oct 2026 : etiquettes de valeur obliques (40 degres) quand l horizontale ne tient pas.
import math
ANGLE_OBL = 40
SIN_OBL = math.sin(math.radians(ANGLE_OBL))
COS_OBL = math.cos(math.radians(ANGLE_OBL))


def largeur_oblique(t: str, taille: float) -> float:
    """Emprise horizontale d un texte mono penche de ANGLE_OBL degres."""
    return largeur_texte(t, taille, mono=True) * COS_OBL + taille * 0.7 * SIN_OBL


def unite_pourcent(suffixe: str) -> bool:
    """Le suffixe est-il un pourcentage ( %, %, ...) ?"""
    return suffixe.strip() == "%"


def format_valeur(v: float, suffixe: str = "") -> str:
    if v == int(v):
        t = f"{int(v):,}".replace(",", " ")
    elif abs(v) >= 10:
        t = f"{v:,.1f}".replace(",", " ").replace(".", ",")
    else:
        # 25 sept 2026 : pas de zero inutile (« 2,5 » et non « 2,50 »).
        t = f"{v:.2f}".rstrip("0").replace(".", ",")
    return t + suffixe


def graduations(maxi: float) -> list[float]:
    """5 lignes de grille sur un pas rond."""
    if maxi <= 0:
        return [0]
    # 26 sept 2026 : on choisit le plafond rond le plus proche du maximum
    # (4 a 6 intervalles), pour ne plus laisser de grand vide en haut
    # (axe a 80 000 pour un maximum a 44 924).
    import math
    meilleur = None
    for n in (4, 5, 6):
        brut = maxi / n
        exp = 10 ** math.floor(math.log10(brut)) if brut > 0 else 1
        for mult in (1, 2, 2.5, 5, 10):
            pas = exp * mult
            if maxi >= 5 and pas != int(pas):
                continue  # graduations entieres des que l echelle le permet
            if pas * n >= maxi * 1.03:
                cand = (pas * n, n, pas)
                if meilleur is None or cand[0] < meilleur[0] - 1e-9:
                    meilleur = cand
                break
    _, n, pas = meilleur
    return [round(pas * i, 10) for i in range(n + 1)]



# Yann 24 sept 2026 : TOUS les graphiques portent leur echelle sur l axe
# vertical. Sans champ « unite_axe », on la deduit du suffixe des valeurs puis
# du sous titre (« en milliers d emplois », « Milliards de dollars »...).
ABREGES = {"M": "millions", "Mds": "milliards", "Md": "milliards", "k": "milliers", "K": "milliers", "B": "milliards"}


def unite_axe_deduite(spec: dict) -> str:
    u = str(spec.get("unite_axe") or "").strip()
    if u:
        return u
    suf = str(spec.get("unite_suffixe") or "").strip()
    if suf:
        return ABREGES.get(suf, suf)
    st = str(spec.get("sous_titre") or "")
    m = re.search(r"(?i)\b(milliers|millions|milliards)(\s+d(?:e|es|\u2019|')\s?[\w\u00c0-\u017f$\u20ac%/\u2019' -]{1,28}?)?(?=[,.;(]|\s+(?:en|de|du|par|fin|au|a|\u00e0|entre|sur|dans|pour)\b|$)", st)
    if m:
        txt = (m.group(1).lower() + (m.group(2) or "")).strip()
        txt = re.sub(r"(?i)^milliards de dollars$", "Mds $", txt)
        txt = re.sub(r"(?i)^millions de dollars$", "M$", txt)
        txt = re.sub(r"(?i)^milliards d'euros$|^milliards d\u2019euros$", "Mds \u20ac", txt)
        return txt
    m = re.search(r"(Mds ?\$|Mds ?\u20ac|M ?\$|M ?\u20ac|Bcf/j|\$/t|\$/kg|MW|GW|TWh)", st)
    if m:
        return m.group(1)
    if re.search(r"(?i)m\u00e9gabits par seconde", st):
        return "Mb/s"
    if re.search(r"(?i)pour 100\s?000", st):
        return "pour 100 000"
    if re.search(r"(?i)\bindice\b", st):
        return "indice"
    m = re.search(r"(?i)barils par jour", st)
    if m:
        return "barils/j"
    m = re.search(r"(?i)^(?:hausse du )?nombre (?:moyen |total )?d(?:e |es |\u2019|')([\w\u00c0-\u017f-]+)", st.strip())
    if m:
        return m.group(1).lower()
    m = re.match(r"\s*([A-Za-z\u00c0-\u017f-]+[sx])\b", st)
    if m and m.group(1).lower() not in ("dans", "sous", "vers", "plus", "moins", "taux", "prix", "ventes"):
        return m.group(1).lower()
    return ""


# ---------------------------------------------------------------------------
# Axe X (7 oct 2026) : jamais de chevauchement. Strategies, dans l ordre :
#   1. toutes les etiquettes, une ligne, taille 11 puis 10 puis 9,5 ;
#   2. toutes les etiquettes, retour a la ligne (3 lignes au plus), 11 a 9 ;
#   3. mois ecrits en toutes lettres abreges (septembre -> sept.) ;
#   4. une etiquette sur deux, trois... (la derniere reste toujours visible),
#      avec les memes essais d ecriture.
# La largeur vient du detecteur : elle n est jamais sous-estimee.
# ---------------------------------------------------------------------------
Y_AXE_DERNIERE = 402          # ligne de base de la derniere ligne d etiquettes (inchange)
ECART_AXE = 8                 # espace libre exige entre deux etiquettes voisines
LIGNES_MAX = 3
MOIS_ABREGES = {
    "janvier": "janv.", "fevrier": "fevr.", "f\u00e9vrier": "f\u00e9vr.", "mars": "mars", "avril": "avr.",
    "juin": "juin", "juillet": "juil.", "aout": "ao\u00fbt", "ao\u00fbt": "ao\u00fbt", "septembre": "sept.",
    "octobre": "oct.", "novembre": "nov.", "decembre": "d\u00e9c.", "d\u00e9cembre": "d\u00e9c.",
}


def abrege_mois(t: str) -> str:
    return " ".join(MOIS_ABREGES.get(w.lower(), w) for w in str(t).split(" "))


def coupe_lignes(t: str, taille: float, dispo: float):
    """Retour a la ligne glouton sur les espaces. None si un mot depasse seul."""
    mots = str(t).split(" ")
    lignes, cour = [], ""
    for mot in mots:
        essai = (cour + " " + mot) if cour else mot
        if VERIF.largeur(essai, taille, False) <= dispo:
            cour = essai
        else:
            if not cour:
                return None
            lignes.append(cour)
            cour = mot
            if VERIF.largeur(cour, taille, False) > dispo:
                return None
    lignes.append(cour)
    return lignes


def plan_axe(cats: list) -> dict:
    n = len(cats)
    zone = (W - MARGE_G - MARGE_D) / max(1, n)
    pas_min = max(1, -(-n // 12))
    variantes = [[str(c) for c in cats]]
    abr = [abrege_mois(c) for c in cats]
    if abr != variantes[0]:
        variantes.append(abr)
    # (lignes_max, taille) : une ligne d abord, puis retour a la ligne
    essais = [(1, t) for t in (11.0, 10.0, 9.5)] + [(LIGNES_MAX, t) for t in (11.0, 10.0, 9.5, 9.0)]
    for pas in range(pas_min, n + 1):
        visibles = [i for i in range(n) if (n - 1 - i) % pas == 0]
        dispo = zone * pas - ECART_AXE
        for textes in variantes:
            for lmax, taille in essais:
                lignes = {}
                ok = True
                for i in visibles:
                    l = coupe_lignes(textes[i], taille, dispo)
                    if l is None or len(l) > lmax:
                        ok = False
                        break
                    cx = MARGE_G + zone * (i + 0.5)
                    wmax = max(VERIF.largeur(x, taille, False) for x in l)
                    if cx - wmax / 2 < 6 or cx + wmax / 2 > W - 6:
                        ok = False
                        break
                    lignes[i] = l
                if ok:
                    nl = max(len(l) for l in lignes.values())
                    inter = taille + 1.5
                    return {"taille": taille, "lignes": lignes, "nb": nl, "inter": inter,
                            "bas": Y_AXE_DERNIERE - 22 - inter * (nl - 1), "pas": pas}
    # inatteignable en pratique (un seul libelle, tres court) : on garde l ancien comportement
    return {"taille": 9.0, "lignes": {n - 1: [str(cats[-1])]}, "nb": 1, "inter": 10.5, "bas": BAS, "pas": n}


def construit(spec: dict, theme: str) -> str:
    c = THEMES[theme]
    cats = spec["categories"]
    series = spec["series"]
    suffixe = spec.get("unite_suffixe", "")
    # Yann 21 sept 2026 : un pourcentage ne se repete pas sur chaque barre,
    # il est porte une seule fois par l axe vertical.
    pourcent = unite_pourcent(suffixe)
    # 7 oct 2026 : meme regle pour toute unite deja portee par l axe vertical
    # (Mds $, M$, milliers...) : elle ne se repete pas sur chaque barre.
    marque_axe = "%" if pourcent else unite_axe_deduite(spec)
    suffixe_barres = "" if (pourcent or marque_axe) else suffixe
    for i, s in enumerate(series):
        s.setdefault("couleur", ORDRE[i % len(ORDRE)])

    vals = [v for s in series for v in s["valeurs"] if isinstance(v, (int, float))]
    maxi = max(vals)
    mini = min(0, min(vals))
    if mini >= 0:
        grads = graduations(maxi)
        plafond = grads[-1] or maxi
        plancher = 0
    else:
        # 25 sept 2026 : valeurs negatives (croissance organique...). L axe
        # descend sous zero et les barres negatives partent vers le bas.
        base = graduations(max(maxi, -mini))
        pas = base[1] if len(base) > 1 else 1
        import math
        plafond = math.ceil(maxi / pas) * pas if maxi > 0 else 0
        plancher = math.floor(mini / pas) * pas
        grads = [plancher + pas * k for k in range(int(round((plafond - plancher) / pas)) + 1)]
    axe = plan_axe(cats)
    bas = axe["bas"]  # ligne de base du graphique : remonte si l axe X prend plusieurs lignes
    ech = (bas - HAUT) / (plafond - plancher) if plafond - plancher else 0
    if mini < 0 and plafond - plancher:
        # 7 oct 2026 : l etiquette d une barre negative se pose sous la barre ;
        # on garde 18 px libres sous la barre la plus basse pour qu elle ne
        # touche jamais les libelles de l axe X.
        while (mini - plancher) * ech < 18:
            plancher -= pas
            grads = [plancher + pas * k for k in range(int(round((plafond - plancher) / pas)) + 1)]
            ech = (bas - HAUT) / (plafond - plancher)
    y0 = bas - (0 - plancher) * ech  # ligne du zero

    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="{POLICE.FAMILLE_SANS}">',
        f'<rect width="{W}" height="{H}" fill="{c["fond"]}"/>',
    ]
    # Yann 18 sept 2026 : le titre et le sous-titre ne sont plus dessines dans le SVG ;
    # la fiche les affiche en HTML, centres et a la ligne (export PNG : titre ajoute par chart-export).
    if False and spec.get("sous_titre"):
        # Sous-titre long : coupe en deux lignes sur un espace (jamais tronque).
        st = spec["sous_titre"]
        if len(st) > 105:
            i = st.rfind(" ", 0, 105)
            l1, l2 = st[:i], st[i + 1:]
            out.append(f'<text x="40" y="52" fill="{c["gris"]}" font-size="11">{echappe(l1)}</text>')
            out.append(f'<text x="40" y="66" fill="{c["gris"]}" font-size="11">{echappe(l2)}</text>')
        else:
            out.append(f'<text x="40" y="54" fill="{c["gris"]}" font-size="11">{echappe(st)}</text>')

    for g in grads:
        y = y0 - g * ech
        out.append(f'<line x1="{MARGE_G}" y1="{y:.0f}" x2="{W - MARGE_D}" y2="{y:.0f}" stroke="{c["grille"]}" stroke-width="1"/>')
        out.append(f'<text x="{MARGE_G - 8}" y="{y + 4:.0f}" text-anchor="end" fill="{c["gris"]}" font-size="11" font-family="{POLICE.FAMILLE_MONO}">{format_valeur(g, "")}</text>')

    # Yann 21 sept 2026 : l unite doit se lire en une seconde. Le signe pourcent,
    # ou le libelle d unite de la spec (champ « unite_axe », par exemple
    # « milliers » ou « M$ »), est ecrit une seule fois au milieu de l axe
    # vertical, a gauche des graduations, sans jamais les toucher.
    if marque_axe:
        # Yann 25 sept 2026 : l unite se lit en haut de l axe vertical, juste
        # au dessus de la graduation la plus haute, sans la toucher, a
        # l horizontale, alignee a droite sur les graduations.
        taille_axe = 12 if marque_axe == "%" else 11
        while taille_axe > 8.5 and largeur_texte(marque_axe, taille_axe, mono=True) > 180:
            taille_axe -= 0.5
        y_unite = HAUT - 11  # la graduation haute s ecrit a HAUT + 4 (hauteur ~9 px)
        if largeur_texte(marque_axe, taille_axe, mono=True) <= MARGE_G - 10:
            x_unite, ancre = MARGE_G - 8, "end"
        else:
            x_unite, ancre = 6, "start"
        out.append(
            f'<text x="{x_unite:.0f}" y="{y_unite:.0f}" text-anchor="{ancre}" fill="{c["axe"]}" '
            f'font-size="{taille_axe:g}" font-family="{POLICE.FAMILLE_MONO}">{echappe(marque_axe)}</text>'
        )

    largeur_zone = (W - MARGE_D - MARGE_G) / len(cats)
    n = len(series)
    barre_w = min(70, (largeur_zone * 0.72) / n)
    # 7 oct 2026 : les PROJECTIONS se distinguent des donnees observees. Une
    # categorie ou une serie dont le libelle contient « (proj.) », « (prevision) »
    # ou « projection » (ou listee dans les champs « proj_categories » et
    # « proj_series » de la spec, ou toute la spec si « projection » vaut true)
    # est dessinee en pointilles, plus claire, avec une mention en haut a droite.
    re_proj = re.compile(r"(?i)\((?:proj|pr[e\u00e9]v)[^)]*\)|projection|pr[e\u00e9]vision")
    proj_cats = {i for i, c_ in enumerate(cats) if re_proj.search(str(c_))} | set(spec.get("proj_categories", []))
    proj_series = {j for j, s_ in enumerate(series) if re_proj.search(str(s_["nom"]))} | set(spec.get("proj_series", []))
    if spec.get("projection") is True:
        proj_series = set(range(len(series)))
    if proj_cats or proj_series:
        out.append(
            f'<text x="{W - MARGE_D}" y="{HAUT - 11}" text-anchor="end" fill="{c["gris"]}" '
            f'font-size="10.5">Pointill\u00e9s : projections</text>'
        )
    for i, cat in enumerate(cats):
        centre = MARGE_G + largeur_zone * (i + 0.5)
        depart = centre - (barre_w * n) / 2
        for j, s in enumerate(series):
            v = s["valeurs"][i]
            if v is None or v == 0:
                continue  # une valeur nulle ne merite pas de barre ni d etiquette
            h = max(1.0, abs(v) * ech)
            x = depart + barre_w * j
            couleur = PALETTE.get(s["couleur"], s["couleur"])
            haut_barre = y0 - h if v > 0 else y0
            if i in proj_cats or j in proj_series:
                out.append(
                    f'<rect x="{x:.0f}" y="{haut_barre:.0f}" width="{barre_w - 4:.0f}" height="{h:.0f}" '
                    f'fill="{couleur}" fill-opacity="0.35" stroke="{couleur}" stroke-width="1.5" '
                    f'stroke-dasharray="4 3" rx="3"/>'
                )
            else:
                out.append(f'<rect x="{x:.0f}" y="{haut_barre:.0f}" width="{barre_w - 4:.0f}" height="{h:.0f}" fill="{couleur}" rx="3"/>')
            cx = x + (barre_w - 4) / 2
            etiquette = format_valeur(v, suffixe_barres)
            if v < 0:
                # Valeur negative : etiquette sous la barre, a l horizontale.
                taille_n = next((e for e in (11.0, 10.0, 9.0, 8.0) if largeur_texte(etiquette, e, mono=True) <= barre_w + 6), 8.0)
                out.append(
                    f'<text x="{cx:.0f}" y="{y0 + h + 14:.0f}" text-anchor="middle" fill="{c["titre"]}" '
                    f'font-size="{taille_n:g}" font-family="{POLICE.FAMILLE_MONO}">{echappe(etiquette)}</text>'
                )
                continue
            sommet = y0 - h
            # Yann 21 sept 2026 : les valeurs doivent etre ecrites NORMALEMENT,
            # a l horizontale. On ne bascule a la verticale que si aucune taille
            # lisible ne tient dans la largeur de la barre.
            taille_h = 0.0
            for essai in (11.0, 10.0, 9.5, 9.0, 8.5, 8.0):
                if largeur_texte(etiquette, essai, mono=True) <= barre_w + 2:
                    taille_h = essai
                    break
            if taille_h:
                if sommet - 6 >= 12:
                    out.append(
                        f'<text x="{cx:.0f}" y="{sommet - 6:.0f}" text-anchor="middle" fill="{c["titre"]}" '
                        f'font-size="{taille_h:g}" font-family="{POLICE.FAMILLE_MONO}">{echappe(etiquette)}</text>'
                    )
                else:
                    # Barre qui touche le haut du cadre : l etiquette passe dedans,
                    # elle reste entiere et lisible (encre sombre sur couleur claire).
                    y_lab = max(sommet + 15, 15)
                    out.append(
                        f'<text x="{cx:.0f}" y="{y_lab:.0f}" text-anchor="middle" fill="{ENCRE_SUR_BARRE}" '
                        f'font-size="{taille_h:g}" font-family="{POLICE.FAMILLE_MONO}">{echappe(etiquette)}</text>'
                    )
            else:
                # Barres serrees : 7 oct 2026, etiquette oblique (environ 40 degres)
                # au lieu de verticale, contenue dans la largeur de la barre.
                taille = 8.5
                for essai in (10.0, 9.5, 9.0, 8.5, 8.0):
                    if largeur_oblique(etiquette, essai) <= barre_w - 2:
                        taille = essai
                        break
                longueur = largeur_texte(etiquette, taille, mono=True)
                montee = longueur * SIN_OBL + taille * COS_OBL * 0.7  # hauteur occupee
                x_lab = cx - largeur_oblique(etiquette, taille) / 2 + taille * 0.6
                if sommet - 5 - montee >= 2:
                    out.append(
                        f'<text x="{x_lab:.0f}" y="{sommet - 5:.0f}" text-anchor="start" fill="{c["titre"]}" '
                        f'font-size="{taille:g}" font-family="{POLICE.FAMILLE_MONO}" '
                        f'transform="rotate(-{ANGLE_OBL} {x_lab:.0f} {sommet - 5:.0f})">{echappe(etiquette)}</text>'
                    )
                else:
                    # Barre trop haute : l etiquette descend dans la barre plutot
                    # que de sortir du cadre (jamais tronquee).
                    y_lab = max(sommet, 0.0) + montee + 3
                    out.append(
                        f'<text x="{x_lab:.0f}" y="{y_lab:.0f}" text-anchor="start" fill="{ENCRE_SUR_BARRE}" '
                        f'font-size="{taille:g}" font-family="{POLICE.FAMILLE_MONO}" '
                        f'transform="rotate(-{ANGLE_OBL} {x_lab:.0f} {y_lab:.0f})">{echappe(etiquette)}</text>'
                    )
        if i in axe["lignes"]:
            for k, ligne in enumerate(axe["lignes"][i]):
                out.append(
                    f'<text data-axe="x" x="{centre:.0f}" y="{bas + 22 + axe["inter"] * k:g}" text-anchor="middle" '
                    f'fill="{c["axe"]}" font-size="{axe["taille"]:g}">{echappe(ligne)}</text>'
                )

    if spec.get("legende", True) and n > 1:
        out.extend(legende(series, c))

    out.append("</svg>")
    # 7 oct 2026 : la police voyage avec le fichier (sous-ensemble WOFF2 en base64).
    return POLICE.integre("\n".join(out))


def legende(series: list[dict], c: dict) -> list[str]:
    """Legende sur une ou deux lignes, espace franc entre deux series."""
    debut = MARGE_G + 35
    dispo = (W - MARGE_D) - debut
    for taille, ecart, cote in ((11, 30, 14), (10, 22, 12), (9.5, 16, 11)):
        elements = [(s, cote + 6 + largeur_texte(s["nom"], taille)) for s in series]
        lignes: list[list] = [[]]
        courant = 0.0
        for s, w in elements:
            if lignes[-1] and courant + ecart + w > dispo:
                lignes.append([])
                courant = 0.0
            courant += (ecart if lignes[-1] else 0) + w
            lignes[-1].append((s, w))
        if len(lignes) <= 2 and all(
            sum(w for _, w in li) + ecart * (len(li) - 1) <= dispo for li in lignes
        ):
            break
    out = []
    haut = 424 if len(lignes) == 1 else 414
    for k, ligne in enumerate(lignes):
        out.append(f'<g transform="translate(0,{haut + k * 20})">')
        x = float(debut)
        for s, w in ligne:
            couleur = PALETTE.get(s["couleur"], s["couleur"])
            out.append(f'<rect x="{x:.0f}" y="0" width="{cote}" height="{cote}" fill="{couleur}" rx="2"/>')
            out.append(
                f'<text x="{x + cote + 6:.0f}" y="{cote - 3}" fill="{c["legende"]}" '
                f'font-size="{taille:g}">{echappe(s["nom"])}</text>'
            )
            x += w + ecart
        out.append("</g>")
    return out


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    refuses = []
    for chemin in sys.argv[1:]:
        spec = json.loads(Path(chemin).read_text())
        dossier = Path(spec.get("dossier", "public/findings/divers"))
        dossier.mkdir(parents=True, exist_ok=True)
        rendus = {theme: construit(json.loads(json.dumps(spec)), theme) for theme in ("dark", "light")}
        # Garde : refus d ecrire un graphique dont l axe X est en defaut.
        defauts = {t: VERIF.verifie_svg(svg) for t, svg in rendus.items()}
        if any(defauts.values()):
            for t, d in defauts.items():
                for x in d[:4]:
                    print(f"REFUSE {spec['slug']} ({t}) : {x['type']} [{x['texte']}]", file=sys.stderr)
            refuses.append(spec["slug"])
            continue
        for theme, svg in rendus.items():
            cible = dossier / f"{spec['slug']}-{theme}.svg"
            cible.write_text(svg)
            print(cible)
    if refuses:
        print(f"{len(refuses)} graphique(s) refuse(s) car libelles de l axe X en defaut : {', '.join(refuses)}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
