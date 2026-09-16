#!/usr/bin/env python3
"""
Generateur systematique des graphiques du bloc "Indicateurs varies - Moyen terme".

Regle Yann (16 sept 2026) : un graphique repris d une source exterieure n est
JAMAIS copie-colle. On garde le fond (les valeurs publiees, citees avec leur
source) et on refait la forme au gabarit Mettrik, en deux versions (sombre et
claire), comme les graphiques ASML et Google.

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
import json
import sys
from pathlib import Path

W, H = 800, 450
MARGE_G, MARGE_D = 80, 30
HAUT, BAS = 100, 380

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


def echappe(t: str) -> str:
    return (str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


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


def construit(spec: dict, theme: str) -> str:
    c = THEMES[theme]
    cats = spec["categories"]
    series = spec["series"]
    suffixe = spec.get("unite_suffixe", "")
    for i, s in enumerate(series):
        s.setdefault("couleur", ORDRE[i % len(ORDRE)])

    maxi = max(max(s["valeurs"]) for s in series)
    grads = graduations(maxi)
    plafond = grads[-1] or maxi
    ech = (BAS - HAUT) / plafond if plafond else 0

    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="ui-sans-serif, system-ui">',
        f'<rect width="{W}" height="{H}" fill="{c["fond"]}"/>',
        f'<text x="40" y="34" fill="{c["titre"]}" font-size="16" font-weight="700">{echappe(spec["titre"])}</text>',
    ]
    if spec.get("sous_titre"):
        out.append(f'<text x="40" y="54" fill="{c["gris"]}" font-size="11">{echappe(spec["sous_titre"])}</text>')

    for g in grads:
        y = BAS - g * ech
        out.append(f'<line x1="{MARGE_G}" y1="{y:.0f}" x2="{W - MARGE_D}" y2="{y:.0f}" stroke="{c["grille"]}" stroke-width="1"/>')
        out.append(f'<text x="{MARGE_G - 8}" y="{y + 4:.0f}" text-anchor="end" fill="{c["gris"]}" font-size="11" font-family="ui-monospace">{format_valeur(g, "")}</text>')

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
            if barre_w >= 30:
                out.append(
                    f'<text x="{cx:.0f}" y="{BAS - h - 6:.0f}" text-anchor="middle" fill="{c["titre"]}" '
                    f'font-size="10.5" font-family="ui-monospace">{format_valeur(v, suffixe)}</text>'
                )
            else:
                # Barres serrees : etiquette verticale, sinon les valeurs se chevauchent.
                out.append(
                    f'<text x="{cx:.0f}" y="{BAS - h - 6:.0f}" text-anchor="start" fill="{c["titre"]}" '
                    f'font-size="10" font-family="ui-monospace" transform="rotate(-90 {cx:.0f} {BAS - h - 6:.0f})">'
                    f'{format_valeur(v, suffixe)}</text>'
                )
        out.append(f'<text x="{centre:.0f}" y="{BAS + 22}" text-anchor="middle" fill="{c["axe"]}" font-size="11">{echappe(cat)}</text>')

    if spec.get("legende", True) and n > 1:
        out.append('<g transform="translate(0,424)">')
        x = MARGE_G + 35
        for s in series:
            couleur = PALETTE.get(s["couleur"], s["couleur"])
            out.append(f'<rect x="{x}" y="0" width="14" height="14" fill="{couleur}" rx="2"/>')
            out.append(f'<text x="{x + 20}" y="11" fill="{c["legende"]}" font-size="11">{echappe(s["nom"])}</text>')
            x += 28 + int(len(s["nom"]) * 6.2)
        out.append("</g>")

    out.append("</svg>")
    return "\n".join(out)


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
