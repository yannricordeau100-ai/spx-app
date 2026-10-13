#!/usr/bin/env python3
"""
Ecriture de l axe Y des graphiques moyen terme (13 oct 2026).

Jumeau Python de src/lib/style-axe-y.ts : le style actif se lit dans le MEME
fichier, src/lib/style-axe-y.json (champ « actif »). Tant qu il vaut « actuel »,
scripts/finding-svg.py ecrit les graduations et l unite exactement comme avant.

Polices des styles A, B, C : instances statiques (axes variables figes, chiffres
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
}

# Instances a construire : famille -> (nom de la police source, axes figes, fichier italique ?)
INSTANCES = {
    "MtAxeAG": ("Bricolage Grotesque", {"wdth": 75, "opsz": 14, "wght": 560}, False),
    "MtAxeAE": ("Bricolage Grotesque", {"wdth": 88, "opsz": 12, "wght": 620}, False),
    "MtAxeBG": ("Alegreya", {"wght": 520}, False),
    "MtAxeBE": ("Alegreya", {"wght": 480}, True),
    "MtAxeCG": ("Recursive", {"CASL": 1, "MONO": 0, "CRSV": 0, "slnt": 0, "wght": 520}, False),
    "MtAxeCE": ("Recursive", {"CASL": 1, "MONO": 0, "CRSV": 1, "slnt": -9, "wght": 600}, False),
}


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
    return t.replace(" %", " %").replace(" %", " %")


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
        return [f'<text x="{x:.0f}" y="{y + 4:.0f}" text-anchor="end" fill="{c["gris"]}" font-size="11" font-family="{famille_mono}">{texte}</text>']
    st = STYLES[style]
    out = []
    dx = 0
    if st["trait"]:
        out.append(f'<line x1="{marge_g}" y1="{y:.0f}" x2="{marge_g - st["trait"]}" y2="{y:.0f}" stroke="{c["axe"]}" stroke-opacity="0.7" stroke-width="1.1" stroke-linecap="round"/>')
        dx = -4
    taille = round(11 * st["taille_g"], 2)
    esp = f' letter-spacing="{st["espacement_g"]}"' if st["espacement_g"] else ""
    out.append(
        f'<text x="{x + dx:.0f}" y="{y + 4:.0f}" text-anchor="end" fill="{c["axe"]}" font-size="{taille:g}"{esp} '
        f'font-family="{st["famille_g"]}, monospace">{_echappe(texte_graduation(style, texte))}</text>'
    )
    return out


def axe_vertical(style: str, marge_g: float, haut: float, bas: float, c: dict) -> list[str]:
    """Filet vertical de l axe (style B seulement)."""
    if style == "actuel" or not STYLES[style]["trait"]:
        return []
    return [f'<line x1="{marge_g}" y1="{haut:.0f}" x2="{marge_g}" y2="{bas:.0f}" stroke="{c["axe"]}" stroke-opacity="0.35" stroke-width="0.8"/>']


def entete(style: str, marque: str, c: dict, marge_g: float, haut: float, largeur_grads: float,
           largeur_mono, famille_mono: str) -> list[str]:
    """Unite de l axe Y. En style actuel : code d avant le 13 oct, a l identique."""
    if style == "actuel":
        taille_axe = 12 if marque == "%" else 11
        while taille_axe > 8.5 and largeur_mono(marque, taille_axe) > 180:
            taille_axe -= 0.5
        y_unite = haut - 11
        if largeur_mono(marque, taille_axe) <= marge_g - 10:
            x_unite, ancre = marge_g - 8, "end"
        else:
            x_unite, ancre = 6, "start"
        return [
            f'<text x="{x_unite:.0f}" y="{y_unite:.0f}" text-anchor="{ancre}" fill="{c["axe"]}" '
            f'font-size="{taille_axe:g}" font-family="{famille_mono}">{_echappe(marque)}</text>'
        ]
    st = STYLES[style]
    t = texte_entete(style, marque)
    taille = round((12 if marque == "%" else 11) * st["taille_e"], 2)
    esp = f' letter-spacing="{st["espacement_e"]}"' if st["espacement_e"] else ""
    fam = f'{st["famille_e"]}, sans-serif'
    if st["disposition"] == "vertical":
        # Debout le long de l axe, a gauche des graduations, fin du mot au niveau du haut du trace.
        x = max(taille + 2, marge_g - 8 - largeur_grads - 9)
        return [
            f'<text x="{x:.0f}" y="{haut:.0f}" transform="rotate(-90 {x:.0f} {haut:.0f})" text-anchor="end" '
            f'fill="{c["legende"]}" font-size="{taille:g}"{esp} font-family="{fam}">{_echappe(t)}</text>'
        ]
    y = haut - 12
    out = [
        f'<text x="6" y="{y:.0f}" text-anchor="start" fill="{c["legende"]}" font-size="{taille:g}"{esp} '
        f'font-family="{fam}">{_echappe(t)}</text>'
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
        cands += glob.glob(str(d / "*.p.woff2"))
    for f in sorted(cands, key=os.path.getmtime, reverse=True):
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


def prepare() -> None:
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer
    DOSSIER_POLICES.mkdir(parents=True, exist_ok=True)
    corps_ofl = (Path(__file__).resolve().parent / "fonts" / "OFL-Manrope.txt").read_text().split("\n", 1)[1]
    for fam, (nom, axes, ital) in INSTANCES.items():
        src = _source(nom, ital)
        f = TTFont(src)
        axes_ok = {k: v for k, v in axes.items() if k in [a.axisTag for a in f["fvar"].axes]}
        inst = instancer.instantiateVariableFont(f, axes_ok)
        _fige_tnum(inst)
        inst.flavor = None
        cible = DOSSIER_POLICES / f"{fam}.ttf"
        inst.save(cible)
        lic = DOSSIER_POLICES / f"OFL-{nom.replace(' ', '')}.txt"
        if not lic.exists():
            lic.write_text((f["name"].getDebugName(0) or "") + "\n" + corps_ofl)
        print(cible, "depuis", src.name, axes_ok)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "prepare":
        prepare()
    else:
        print("style actif :", style_actif())
