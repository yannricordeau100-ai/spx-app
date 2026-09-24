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
from pathlib import Path

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


def unite_pourcent(suffixe: str) -> bool:
    """Le suffixe est-il un pourcentage ( %, %, ...) ?"""
    return suffixe.strip() == "%"


def format_valeur(v: float, suffixe: str = "") -> str:
    if v == int(v):
        t = f"{int(v):,}".replace(",", " ")
    elif v >= 10:
        t = f"{v:,.1f}".replace(",", " ").replace(".", ",")
    else:
        t = f"{v:.2f}".replace(".", ",")
    return t + suffixe


def graduations(maxi: float) -> list[float]:
    """5 lignes de grille sur un pas rond."""
    if maxi <= 0:
        return [0]
    brut = maxi / 4
    exp = 10 ** (len(str(int(brut))) - 1) if brut >= 1 else 0.1
    for mult in (1, 2, 2.5, 5, 10):
        pas = exp * mult
        if pas * 4 >= maxi:
            break
    return [pas * i for i in range(5)]



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

def construit(spec: dict, theme: str) -> str:
    c = THEMES[theme]
    cats = spec["categories"]
    series = spec["series"]
    suffixe = spec.get("unite_suffixe", "")
    # Yann 21 sept 2026 : un pourcentage ne se repete pas sur chaque barre,
    # il est porte une seule fois par l axe vertical.
    pourcent = unite_pourcent(suffixe)
    suffixe_barres = "" if pourcent else suffixe
    for i, s in enumerate(series):
        s.setdefault("couleur", ORDRE[i % len(ORDRE)])

    maxi = max(v for s in series for v in s["valeurs"] if isinstance(v, (int, float)))
    grads = graduations(maxi)
    plafond = grads[-1] or maxi
    ech = (BAS - HAUT) / plafond if plafond else 0

    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="ui-sans-serif, system-ui">',
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
        y = BAS - g * ech
        out.append(f'<line x1="{MARGE_G}" y1="{y:.0f}" x2="{W - MARGE_D}" y2="{y:.0f}" stroke="{c["grille"]}" stroke-width="1"/>')
        out.append(f'<text x="{MARGE_G - 8}" y="{y + 4:.0f}" text-anchor="end" fill="{c["gris"]}" font-size="11" font-family="ui-monospace">{format_valeur(g, "")}</text>')

    # Yann 21 sept 2026 : l unite doit se lire en une seconde. Le signe pourcent,
    # ou le libelle d unite de la spec (champ « unite_axe », par exemple
    # « milliers » ou « M$ »), est ecrit une seule fois au milieu de l axe
    # vertical, a gauche des graduations, sans jamais les toucher.
    marque_axe = "%" if pourcent else unite_axe_deduite(spec)
    if marque_axe:
        large = max(largeur_texte(format_valeur(g, ""), 11, mono=True) for g in grads)
        taille_axe = 13 if marque_axe == "%" else 11
        # Un libelle long se dresse a la verticale pour ne pas manger la place.
        vertical = largeur_texte(marque_axe, taille_axe) > MARGE_G - 8 - large - 6
        x_pct = max(10.0, (MARGE_G - 8) - large - (8 if vertical else 11))
        pas_y = (BAS - HAUT) / (len(grads) - 1) if len(grads) > 1 else 0
        y_pct = (HAUT + BAS) / 2 - pas_y / 2
        rotation = f' transform="rotate(-90 {x_pct:.0f} {y_pct:.0f})"' if vertical else ""
        out.append(
            f'<text x="{x_pct:.0f}" y="{y_pct:.0f}" text-anchor="middle" fill="{c["axe"]}" '
            f'font-size="{taille_axe}" font-family="ui-monospace"{rotation}>{echappe(marque_axe)}</text>'
        )

    largeur_zone = (W - MARGE_D - MARGE_G) / len(cats)
    n = len(series)
    barre_w = min(70, (largeur_zone * 0.72) / n)
    for i, cat in enumerate(cats):
        centre = MARGE_G + largeur_zone * (i + 0.5)
        depart = centre - (barre_w * n) / 2
        for j, s in enumerate(series):
            v = s["valeurs"][i]
            if v is None or v == 0:
                continue  # une valeur nulle ne merite pas de barre ni d etiquette
            h = max(1.0, v * ech)
            x = depart + barre_w * j
            couleur = PALETTE.get(s["couleur"], s["couleur"])
            out.append(f'<rect x="{x:.0f}" y="{BAS - h:.0f}" width="{barre_w - 4:.0f}" height="{h:.0f}" fill="{couleur}" rx="3"/>')
            cx = x + (barre_w - 4) / 2
            etiquette = format_valeur(v, suffixe_barres)
            sommet = BAS - h
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
                        f'font-size="{taille_h:g}" font-family="ui-monospace">{echappe(etiquette)}</text>'
                    )
                else:
                    # Barre qui touche le haut du cadre : l etiquette passe dedans,
                    # elle reste entiere et lisible (encre sombre sur couleur claire).
                    y_lab = max(sommet + 15, 15)
                    out.append(
                        f'<text x="{cx:.0f}" y="{y_lab:.0f}" text-anchor="middle" fill="{ENCRE_SUR_BARRE}" '
                        f'font-size="{taille_h:g}" font-family="ui-monospace">{echappe(etiquette)}</text>'
                    )
            else:
                # Barres serrees : etiquette verticale, sinon les valeurs se chevauchent.
                taille = max(8.5, min(10.5, barre_w - 1.5))
                longueur = largeur_texte(etiquette, taille, mono=True)
                x_lab = cx + taille * 0.34  # centre le texte tourne dans la barre
                if sommet - 6 - longueur >= 4:
                    out.append(
                        f'<text x="{x_lab:.0f}" y="{sommet - 6:.0f}" text-anchor="start" fill="{c["titre"]}" '
                        f'font-size="{taille:g}" font-family="ui-monospace" '
                        f'transform="rotate(-90 {x_lab:.0f} {sommet - 6:.0f})">{echappe(etiquette)}</text>'
                    )
                else:
                    # Barre trop haute : l etiquette descend dans la barre plutot
                    # que de sortir du cadre (jamais tronquee).
                    y_lab = max(sommet + 8, 8.0)
                    out.append(
                        f'<text x="{x_lab:.0f}" y="{y_lab:.0f}" text-anchor="end" fill="{ENCRE_SUR_BARRE}" '
                        f'font-size="{taille:g}" font-family="ui-monospace" '
                        f'transform="rotate(-90 {x_lab:.0f} {y_lab:.0f})">{echappe(etiquette)}</text>'
                    )
        # Beaucoup de periodes : une etiquette sur n, sinon elles se chevauchent.
        pas = max(1, -(-len(cats) // 12))
        if i % pas == 0 or i == len(cats) - 1:
            out.append(f'<text x="{centre:.0f}" y="{BAS + 22}" text-anchor="middle" fill="{c["axe"]}" font-size="11">{echappe(cat)}</text>')

    if spec.get("legende", True) and n > 1:
        out.extend(legende(series, c))

    out.append("</svg>")
    return "\n".join(out)


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
    for chemin in sys.argv[1:]:
        spec = json.loads(Path(chemin).read_text())
        dossier = Path(spec.get("dossier", "public/findings/divers"))
        dossier.mkdir(parents=True, exist_ok=True)
        for theme in ("dark", "light"):
            cible = dossier / f"{spec['slug']}-{theme}.svg"
            cible.write_text(construit(json.loads(json.dumps(spec)), theme))
            print(cible)


if __name__ == "__main__":
    main()
