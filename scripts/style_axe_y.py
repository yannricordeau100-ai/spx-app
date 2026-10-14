#!/usr/bin/env python3
"""
Ecriture de l axe Y des graphiques moyen terme (13 oct 2026).

Jumeau Python de src/lib/style-axe-y.ts : le style actif se lit dans le MEME
fichier, src/lib/style-axe-y.json (champ « actif »). Tant qu il vaut « actuel »,
scripts/finding-svg.py ecrit les graduations et l unite exactement comme avant.

14 oct 2026 : styles D, E, F, G (A, B, C refuses par Yann). Echelle des textes
reglable (ECHELLE_TEXTE) pour la version mobile des graphiques (finding-svg.py
--mobile) : 11 unites deviennent 13, soit au moins 11 px reels sur telephone.

Polices des styles A a G : instances statiques (axes variables figes, chiffres
tabulaires figes dans la table des caracteres) dans scripts/fonts/axe-y/, tirees
des fichiers que next/font a deja telecharges pour /concepts/axe-y :

    python3 scripts/style_axe_y.py prepare      # construit les TTF (une fois)

Licences : SIL Open Font License 1.1 (fichiers OFL-*.txt a cote des TTF).
"""
from __future__ import annotations
import glob
import json
import os
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
# Multiplicateur de toutes les tailles de texte de l axe Y (1 = ordinateur).
ECHELLE_TEXTE = 1.0
REGLAGE = RACINE / "src/lib/style-axe-y.json"
DOSSIER_POLICES = Path(__file__).resolve().parent / "fonts" / "axe-y"


def style_actif() -> str:
    try:
        a = json.loads(REGLAGE.read_text()).get("actif", "actuel")
    except Exception:
        a = "actuel"
    return a if a in STYLES else "actuel"


# Chaque police : famille SVG (nom unique, jamais une police installee), fichier.
# « taille » multiplie la taille d origine (11 px graduations, 11-12 px unite).
STYLES: dict[str, dict] = {
    "actuel": {"famille_g": None, "famille_e": None},
    "A": {
        "famille_g": "MtAxeAG", "fichier_g": "MtAxeAG.ttf", "taille_g": 1.08, "espacement_g": 0.1,
        "famille_e": "MtAxeAE", "fichier_e": "MtAxeAE.ttf", "taille_e": 0.86, "espacement_e": 1.6,
        "disposition": "vertical", "capitales": True, "developpe": False, "souligne": False, "trait": None,
    },
    "B": {
        "famille_g": "MtAxeBG", "fichier_g": "MtAxeBG.ttf", "taille_g": 1.15, "espacement_g": 0,
        "famille_e": "MtAxeBE", "fichier_e": "MtAxeBE.ttf", "taille_e": 1.12, "espacement_e": 0,
        "disposition": "haut", "capitales": False, "developpe": True, "souligne": False, "trait": 6,
    },
    "C": {
        "famille_g": "MtAxeCG", "fichier_g": "MtAxeCG.ttf", "taille_g": 1.04, "espacement_g": 0,
        "famille_e": "MtAxeCE", "fichier_e": "MtAxeCE.ttf", "taille_e": 1.05, "espacement_e": 0,
        "disposition": "haut", "capitales": False, "developpe": False, "souligne": True, "trait": None,
    },
    # 14 oct 2026
    "D": {
        "famille_g": "MtAxeDG", "fichier_g": "MtAxeDG.ttf", "taille_g": 1.04, "espacement_g": 0,
        "famille_e": "MtAxeDE", "fichier_e": "MtAxeDE.ttf", "taille_e": 0.96, "espacement_e": 0.3,
        "disposition": "cartouche", "capitales": False, "developpe": False, "souligne": False, "trait": None,
    },
    "E": {
        "famille_g": "MtAxeEG", "fichier_g": "MtAxeEG.ttf", "taille_g": 1.0, "espacement_g": 0,
        "famille_e": "MtAxeEE", "fichier_e": "MtAxeEE.ttf", "taille_e": 1.0, "espacement_e": 0,
        "disposition": "integre", "capitales": False, "developpe": False, "souligne": False, "trait": 8,
        "placement": "trace",
    },
    "F": {
        "famille_g": "MtAxeFG", "fichier_g": "MtAxeFG.ttf", "taille_g": 1.06, "espacement_g": 0,
        "famille_e": "MtAxeFE", "fichier_e": "MtAxeFE.ttf", "taille_e": 0.98, "espacement_e": 0,
        "disposition": "haut", "capitales": False, "developpe": False, "souligne": False, "trait": 8,
        "placement": "regle",
    },
    "G": {
        "famille_g": "MtAxeGG", "fichier_g": "MtAxeGG.ttf", "taille_g": 1.0, "espacement_g": 0,
        "famille_e": "MtAxeGE", "fichier_e": "MtAxeGE.ttf", "taille_e": 1.02, "espacement_e": 0,
        "disposition": "haut", "capitales": False, "developpe": False, "souligne": False, "trait": None,
        "repere": True,
    },
    # 14 oct 2026 : style retenu par Yann (meme disposition que « actuel », seule la police change).
    "sobre": {
        "famille_g": "MtAxeSG", "fichier_g": "MtAxeSG.ttf", "taille_g": 1.0, "espacement_g": 0,
        "famille_e": "MtAxeSE", "fichier_e": "MtAxeSE.ttf", "taille_e": 1.0, "espacement_e": 0,
        "disposition": "haut", "capitales": False, "developpe": False, "souligne": False, "trait": None,
    },
}

# Instances a construire : famille -> (nom de la police source, axes figes, fichier italique ?)
INSTANCES = {
    "MtAxeAG": ("Bricolage Grotesque", {"wdth": 75, "opsz": 14, "wght": 560}, False),
    "MtAxeAE": ("Bricolage Grotesque", {"wdth": 88, "opsz": 12, "wght": 620}, False),
    "MtAxeBG": ("Alegreya", {"wght": 520}, False),
    "MtAxeBE": ("Alegreya", {"wght": 480}, True),
    "MtAxeCG": ("Recursive", {"CASL": 1, "MONO": 0, "CRSV": 0, "slnt": 0, "wght": 520}, False),
    "MtAxeCE": ("Recursive", {"CASL": 1, "MONO": 0, "CRSV": 1, "slnt": -9, "wght": 600}, False),
    # 14 oct 2026
    "MtAxeDG": ("National Park", {"wght": 560}, False),
    "MtAxeDE": ("National Park", {"wght": 660}, False),
    "MtAxeEG": ("Signika", {"wght": 520, "GRAD": -24}, False),
    "MtAxeEE": ("Signika", {"wght": 400, "GRAD": -24}, False),
    "MtAxeFG": ("Commissioner", {"wght": 480, "FLAR": 100, "VOLM": 0, "slnt": 0}, False),
    "MtAxeFE": ("Commissioner", {"wght": 520, "FLAR": 100, "VOLM": 0, "slnt": 0}, False),
    "MtAxeGG": ("Sono", {"wght": 440, "MONO": 1}, False),
    "MtAxeGE": ("Sono", {"wght": 520, "MONO": 0}, False),
    "MtAxeSG": ("Public Sans", {"wght": 500}, False),
    "MtAxeSE": ("Public Sans", {"wght": 600}, False),
}

VIOLET_SOMBRE, VIOLET_CLAIR = "#a78bfa", "#7c3aed"


def fichiers_polices() -> dict[str, Path]:
    """Familles disponibles (TTF construits) pour mt_police."""
    out = {}
    for fam in INSTANCES:
        f = DOSSIER_POLICES / f"{fam}.ttf"
        if f.exists():
            out[fam] = f
    return out


# ---------------------------------------------------------------- rendu SVG

def _echappe(t: str) -> str:
    return str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def texte_graduation(style: str, t: str) -> str:
    """Vrai signe moins et espace fine insecable avant %, sauf style actuel."""
    if style == "actuel":
        return t
    if t.startswith("-"):
        t = "−" + t[1:]
    t = t.replace(" %", "\u202f%").replace("\u00a0%", "\u202f%")
    if style in ("D", "E", "F", "G", "sobre"):
        # Espace fine insecable des milliers (glyphe ajoute aux polices par prepare).
        import re as _re
        t = _re.sub(r"(\d)[ \u00a0](?=\d{3}\b)", "\\1\u202f", t)
    return t


def texte_entete(style: str, marque: str) -> str:
    st = STYLES[style]
    if style == "actuel":
        return marque
    if st.get("capitales"):
        return marque.upper()
    if st.get("developpe"):
        mots = {"Mds": "milliards", "M": "millions", "Md": "milliards", "k": "milliers", "K": "milliers"}
        tete, _, reste = marque.partition(" ")
        if tete in mots:
            return f"en {mots[tete]}" + (f" de {reste}" if reste else "")
        if marque.startswith("%"):
            return f"en {marque}"
        return f"en {marque[:1].lower()}{marque[1:]}"
    return marque


def graduation(style: str, x: float, y: float, texte: str, c: dict, famille_mono: str, marge_g: float) -> list[str]:
    """Une graduation de l axe Y (texte + trait eventuel)."""
    if style == "actuel":
        return [f'<text x="{x:.0f}" y="{y + 4:.0f}" text-anchor="end" fill="{c["gris"]}" font-size="{11 * ECHELLE_TEXTE:g}" font-family="{famille_mono}">{texte}</text>']
    st = STYLES[style]
    out = []
    dx = 0
    if st["trait"]:
        out.append(f'<line x1="{marge_g}" y1="{y:.0f}" x2="{marge_g - st["trait"]}" y2="{y:.0f}" stroke="{c["axe"]}" stroke-opacity="0.7" stroke-width="1.1" stroke-linecap="round"/>')
        dx = -4
    taille = round(11 * st["taille_g"] * ECHELLE_TEXTE, 2)
    esp = f' letter-spacing="{st["espacement_g"]}"' if st["espacement_g"] else ""
    out.append(
        f'<text x="{x + dx:.0f}" y="{y + 4 * ECHELLE_TEXTE:.0f}" text-anchor="end" fill="{c["axe"]}" font-size="{taille:g}"{esp} '
        f'{_attrs_export(style, st["famille_g"])}font-family="{st["famille_g"]}, monospace">{_echappe(texte_graduation(style, texte))}</text>'
    )
    return out


def _attrs_export(style: str, famille: str) -> str:
    """Marques lues par l export PNG (src/lib/style-axe-y-export.ts) : la police
    embarquee du SVG est gardee au lieu d etre remplacee par Avenir."""
    return f'data-axe-y="graduation" data-axe-y-style="{style}" data-axe-y-famille="{famille}" '


def placement(style: str) -> str:
    return STYLES.get(style, {}).get("placement", "gauche")


def graduations_speciales(style: str, ticks: list, c: dict, marge_g: float, x_droite: float, marque: str,
                          largeur) -> tuple[list[str], list[str]]:
    """Styles E (chiffres dans le trace) et F (regle) : rendu de toutes les
    graduations d un coup. ticks = [(y, texte)] du bas vers le haut. Renvoie
    (avant les barres, apres les barres)."""
    st = STYLES[style]
    taille = round(11 * st["taille_g"] * ECHELLE_TEXTE, 2)
    L = st["trait"] * ECHELLE_TEXTE
    fam = st["famille_g"]
    avant, apres = [], []
    if st.get("placement") == "trace":
        # E : la ligne de grille se prolonge jusqu au bord en trait plein (trait de
        # rappel) et le chiffre est pose dessus ; l unite suit le chiffre du haut.
        haut = ticks[-1] if ticks else None
        u = marque or ""
        if u and haut and haut[1].endswith("%") and u.startswith("%"):
            u = u.lstrip("%").strip().strip("()")
        bord = 6
        for y, t in ticks:
            avant.append(f'<line x1="{bord}" y1="{y:.1f}" x2="{marge_g}" y2="{y:.1f}" stroke="{c["axe"]}" stroke-opacity="0.75" stroke-width="1.1"/>')
            unite = ""
            if u and (y, t) == haut:
                te = round(11 * STYLES[style]["taille_e"] * ECHELLE_TEXTE, 2)
                unite = (f'<tspan fill="{c["gris"]}" font-size="{te:g}" font-family="{st["famille_e"]}, sans-serif" '
                         f'data-axe-y-famille="{st["famille_e"]}">\u202f{_echappe(u)}</tspan>')
            avant.append(
                f'<text x="{bord}" y="{y - taille * 0.32:.1f}" text-anchor="start" fill="{c["axe"]}" font-size="{taille:g}" '
                f'{_attrs_export(style, fam)}font-family="{fam}, sans-serif">{_echappe(texte_graduation(style, t))}{unite}</text>'
            )
        return avant, apres
    # Regle : trait par graduation, 4 traits fins entre deux, 3 valeurs ecrites.
    ys = [y for y, _ in ticks]
    if ys:
        avant.append(f'<line x1="{marge_g}" y1="{min(ys):.1f}" x2="{marge_g}" y2="{max(ys):.1f}" stroke="{c["axe"]}" stroke-opacity="0.7" stroke-width="0.9"/>')
    n = len(ticks)
    ecrites = set(range(n)) if n <= 3 else {0, round((n - 1) / 2), n - 1}
    for j, (y, t) in enumerate(ticks):
        avant.append(f'<line x1="{marge_g}" y1="{y:.1f}" x2="{marge_g - L:.1f}" y2="{y:.1f}" stroke="{c["axe"]}" stroke-width="1.1" stroke-linecap="round"/>')
        if j < n - 1:
            for m in range(1, 5):
                ym = y + (ticks[j + 1][0] - y) * m / 5
                avant.append(f'<line x1="{marge_g}" y1="{ym:.1f}" x2="{marge_g - L * 0.5:.1f}" y2="{ym:.1f}" stroke="{c["axe"]}" stroke-opacity="0.75" stroke-width="0.8"/>')
        if j in ecrites:
            avant.append(
                f'<text x="{marge_g - L - 4:.1f}" y="{y + taille * 0.34:.1f}" text-anchor="end" fill="{c["axe"]}" font-size="{taille:g}" '
                f'{_attrs_export(style, fam)}font-family="{fam}, sans-serif">{_echappe(texte_graduation(style, t))}</text>'
            )
    return avant, apres


def axe_vertical(style: str, marge_g: float, haut: float, bas: float, c: dict) -> list[str]:
    """Filet vertical de l axe (style B seulement)."""
    if style == "actuel" or not STYLES[style]["trait"]:
        return []
    return [f'<line x1="{marge_g}" y1="{haut:.0f}" x2="{marge_g}" y2="{bas:.0f}" stroke="{c["axe"]}" stroke-opacity="0.35" stroke-width="0.8"/>']


def entete(style: str, marque: str, c: dict, marge_g: float, haut: float, largeur_grads: float,
           largeur_mono, famille_mono: str) -> list[str]:
    """Unite de l axe Y. En style actuel : code d avant le 13 oct, a l identique."""
    if style == "actuel":
        taille_axe = (12 if marque == "%" else 11) * ECHELLE_TEXTE
        while taille_axe > 8.5 * ECHELLE_TEXTE and largeur_mono(marque, taille_axe) > 180:
            taille_axe -= 0.5
        y_unite = haut - 11 * ECHELLE_TEXTE
        if largeur_mono(marque, taille_axe) <= marge_g - 10:
            x_unite, ancre = marge_g - 8, "end"
        else:
            x_unite, ancre = 6, "start"
        return [
            f'<text x="{x_unite:.0f}" y="{y_unite:.0f}" text-anchor="{ancre}" fill="{c["axe"]}" '
            f'font-size="{taille_axe:g}" font-family="{famille_mono}">{_echappe(marque)}</text>'
        ]
    st = STYLES[style]
    if st["disposition"] == "integre":
        return []  # E : l unite est ecrite avec la plus haute graduation
    t = texte_entete(style, marque)
    taille = round((12 if marque == "%" else 11) * st["taille_e"] * ECHELLE_TEXTE, 2)
    esp = f' letter-spacing="{st["espacement_e"]}"' if st["espacement_e"] else ""
    fam = f'{st["famille_e"]}, sans-serif'
    if st["disposition"] == "vertical":
        # Debout le long de l axe, a gauche des graduations, fin du mot au niveau du haut du trace.
        x = max(taille + 2, marge_g - 8 - largeur_grads - 9)
        return [
            f'<text x="{x:.0f}" y="{haut:.0f}" transform="rotate(-90 {x:.0f} {haut:.0f})" text-anchor="end" '
            f'fill="{c["legende"]}" font-size="{taille:g}"{esp} font-family="{fam}">{_echappe(t)}</text>'
        ]
    y = haut - 12 * ECHELLE_TEXTE
    try:
        import mt_police as POLICE
        w_txt = POLICE.largeur_famille(t, taille, st["famille_e"]) + (len(t) - 1) * (st["espacement_e"] or 0)
    except Exception:
        w_txt = len(t) * taille * 0.56
    marque_exp = f'data-axe-y="entete" data-axe-y-style="{style}" data-axe-y-famille="{st["famille_e"]}" '
    if st["disposition"] == "cartouche":
        # D : plaque de signaletique, alignee a droite sur les graduations si elle tient.
        px, py = taille * 0.5, taille * 0.3
        x1 = marge_g - 8 - w_txt if w_txt + 2 * px <= marge_g - 10 else 6 + px
        y -= 5 * ECHELLE_TEXTE  # la plaque ne touche pas la plus haute graduation
        return [
            f'<rect x="{x1 - px:.1f}" y="{y - taille * 0.82 - py:.1f}" width="{w_txt + 2 * px:.1f}" height="{taille * 1.08 + 2 * py:.1f}" '
            f'rx="{taille * 0.22:.1f}" fill="{c["legende"]}" fill-opacity="0.08" stroke="{c["legende"]}" stroke-opacity="0.5" stroke-width="1"/>',
            f'<text x="{x1:.1f}" y="{y:.1f}" text-anchor="start" fill="{c["titre"]}" font-size="{taille:g}"{esp} '
            f'{marque_exp}font-family="{fam}">{_echappe(t)}</text>',
        ]
    if st.get("repere"):
        # G : repere violet de Mettrik devant l unite.
        violet = VIOLET_SOMBRE if c["fond"].lower() != "#ffffff" else VIOLET_CLAIR
        x1 = 6 + taille * 0.62
        return [
            f'<rect x="6" y="{y - taille * 0.66:.1f}" width="{max(2.5, taille * 0.26):.1f}" height="{taille * 0.72:.1f}" rx="1" fill="{violet}"/>',
            f'<text x="{x1:.1f}" y="{y:.1f}" text-anchor="start" fill="{c["legende"]}" font-size="{taille:g}"{esp} '
            f'{marque_exp}font-family="{fam}">{_echappe(t)}</text>',
        ]
    out = [
        f'<text x="6" y="{y:.0f}" text-anchor="start" fill="{c["legende"]}" font-size="{taille:g}"{esp} '
        f'{marque_exp}font-family="{fam}">{_echappe(t)}</text>'
    ]
    if st["souligne"]:
        try:
            import mt_police as POLICE
            w = POLICE.largeur_famille(t, taille, st["famille_e"])
        except Exception:
            w = len(t) * taille * 0.56
        yb = y + taille * 0.42
        violet = "#a78bfa" if c["fond"].lower() != "#ffffff" else "#7c3aed"
        out.append(
            f'<path d="M 5,{yb + 1.5:.1f} C {6 + w * 0.3:.1f},{yb + 3.6:.1f} {6 + w * 0.7:.1f},{yb - 0.6:.1f} {10 + w:.1f},{yb + 0.8:.1f}" '
            f'fill="none" stroke="{violet}" stroke-opacity="0.85" stroke-width="1.4" stroke-linecap="round"/>'
        )
    return out


# ------------------------------------------------------- construction polices

def _source(nom: str, italique: bool) -> Path:
    """Fichier variable latin telecharge par next/font (dev ou build)."""
    from fontTools.ttLib import TTFont
    cands = []
    for d in (RACINE / ".next/dev/static/media", RACINE / ".next/static/media"):
        cands += glob.glob(str(d / "*.woff2"))
    for f in sorted(cands, key=lambda f: (".p." in os.path.basename(f), os.path.getmtime(f)), reverse=True):
        t = TTFont(f, lazy=True)
        fam = t["name"].getDebugName(1) or ""
        if fam.startswith(nom) and "fvar" in t and bool(t["head"].macStyle & 2) == italique:
            if nom == "Bricolage Grotesque" and "wdth" not in [a.axisTag for a in t["fvar"].axes]:
                continue
            return Path(f)
    raise SystemExit(f"Police source introuvable pour {nom} (ouvrir /concepts/axe-y une fois en local).")


def _fige_tnum(font) -> None:
    """Chiffres tabulaires figes : la table des caracteres pointe vers les glyphes tnum."""
    if "GSUB" not in font:
        return
    g = font["GSUB"].table
    idx = [i for i, fr in enumerate(g.FeatureList.FeatureRecord) if fr.FeatureTag == "tnum"]
    rempl = {}
    for i in idx:
        for li in g.FeatureList.FeatureRecord[i].Feature.LookupListIndex:
            lk = g.LookupList.Lookup[li]
            for st in lk.SubTable:
                m = getattr(st, "mapping", None)
                if st.__class__.__name__ == "ExtensionSubst":
                    m = getattr(st.ExtSubTable, "mapping", None)
                if m:
                    rempl.update(m)
    if not rempl:
        return
    for table in font["cmap"].tables:
        for cp, gl in list(table.cmap.items()):
            if gl in rempl and chr(cp).isdigit():
                table.cmap[cp] = rempl[gl]


def _ajoute_espace_fine(font) -> None:
    """Glyphe d espace fine insecable (U+202F), absent des polices servies en
    sous-ensemble latin : deux tiers de l espace normale, sans contour."""
    cmap = font.getBestCmap()
    if 0x202F in cmap or 0x20 not in cmap:
        return
    nom = "uni202F"
    larg = int(font["hmtx"][cmap[0x20]][0] * 0.66)
    ordre = font.getGlyphOrder()
    if nom in ordre:
        return
    font.setGlyphOrder(ordre + [nom])
    if "glyf" in font:
        from fontTools.ttLib.tables._g_l_y_f import Glyph
        font["glyf"].glyphs[nom] = Glyph()
        font["glyf"].glyphOrder = font.getGlyphOrder()
    elif "CFF " in font:
        return
    font["hmtx"].metrics[nom] = (larg, 0)
    font["maxp"].numGlyphs = len(font.getGlyphOrder())
    for t in font["cmap"].tables:
        if t.isUnicode():
            t.cmap[0x202F] = nom


def prepare(seulement: list[str] | None = None) -> None:
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer
    DOSSIER_POLICES.mkdir(parents=True, exist_ok=True)
    corps_ofl = (Path(__file__).resolve().parent / "fonts" / "OFL-Manrope.txt").read_text().split("\n", 1)[1]
    for fam, (nom, axes, ital) in INSTANCES.items():
        if seulement and fam not in seulement:
            continue
        src = _source(nom, ital)
        f = TTFont(src)
        axes_ok = {k: v for k, v in axes.items() if k in [a.axisTag for a in f["fvar"].axes]}
        inst = instancer.instantiateVariableFont(f, axes_ok)
        _fige_tnum(inst)
        _ajoute_espace_fine(inst)
        inst.flavor = None
        cible = DOSSIER_POLICES / f"{fam}.ttf"
        inst.save(cible)
        lic = DOSSIER_POLICES / f"OFL-{nom.replace(' ', '')}.txt"
        if not lic.exists():
            lic.write_text((f["name"].getDebugName(0) or "") + "\n" + corps_ofl)
        print(cible, "depuis", src.name, axes_ok)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "prepare":
        prepare(sys.argv[2:] or None)
    else:
        print("style actif :", style_actif())
