#!/usr/bin/env python3
"""
Police embarquee des graphiques moyen terme (7 oct 2026).

Probleme : les SVG utilisaient la police du systeme (ui-sans-serif, ui-monospace),
donc la largeur des libelles changeait entre macOS, Windows et Android, et la
garantie de non-chevauchement n etait valable que sur un seul systeme.

Solution : chaque SVG porte SA police, en sous-ensemble (seulement les glyphes
utilises), WOFF2 encode en base64 dans un @font-face. Les polices sont celles du
site (layout.tsx) : Manrope (texte) et JetBrains Mono (chiffres), licence OFL
(textes dans scripts/fonts). Familles nommees MtSans et MtMono, pour qu une
police du meme nom installee sur la machine ne puisse jamais les remplacer.

  - largeur(t, taille, mono) : largeur exacte lue dans la police (somme des
    chasses, +1,5 % de marge) ; sert au generateur ET au detecteur ;
  - integre(svg)            : insere le @font-face (sous-ensemble) dans un SVG ;
  - FICHIERS_POLICE         : chemins des TTF complets, pour resvg (--use-font-file).
"""
from __future__ import annotations
import base64, html, io, re
from functools import lru_cache
from pathlib import Path

DOSSIER = Path(__file__).resolve().parent / "fonts"
FICHIERS_POLICE = {"MtSans": DOSSIER / "Manrope-Regular.ttf", "MtMono": DOSSIER / "JetBrainsMono-Regular.ttf"}
FAMILLE_SANS = "MtSans, Manrope, sans-serif"
FAMILLE_MONO = "MtMono, 'JetBrains Mono', monospace"
MARGE_LARGEUR = 1.015


@lru_cache(maxsize=None)
def _police(nom: str):
    from fontTools.ttLib import TTFont
    f = TTFont(FICHIERS_POLICE[nom])
    return f, f.getBestCmap(), f["hmtx"], f["head"].unitsPerEm


def largeur(t: str, taille: float, mono: bool) -> float:
    """Largeur reelle du texte dans la police embarquee (jamais sous-estimee)."""
    _, cmap, hmtx, upem = _police("MtMono" if mono else "MtSans")
    total = 0
    for ch in t:
        g = cmap.get(ord(ch))
        total += hmtx[g][0] if g else upem * 0.6
    return total / upem * taille * MARGE_LARGEUR


def _jeu_caracteres(svg: str):
    sans, mono = set(), set()
    for m in re.finditer(r"<text\b([^>]*)>(.*?)</text>", svg, re.S):
        txt = html.unescape(re.sub(r"<[^>]+>", "", m.group(2)))
        (mono if "monospace" in m.group(1) else sans).update(txt)
    return sans, mono


def _sous_ensemble(nom: str, caracteres: set) -> str:
    from fontTools import subset
    from fontTools.ttLib import TTFont
    o = subset.Options()
    o.flavor = "woff2"
    o.layout_features = ["kern"]       # crenage conserve : meme rendu que resvg / navigateurs
    o.hinting = False
    o.desubroutinize = True
    o.name_IDs = []
    o.notdef_outline = False
    o.glyph_names = False
    f = TTFont(FICHIERS_POLICE[nom])
    s = subset.Subsetter(o)
    s.populate(text="".join(sorted(caracteres)) or " ")
    s.subset(f)
    buf = io.BytesIO()
    f.flavor = "woff2"
    f.save(buf)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def bloc_style(svg: str) -> str:
    sans, mono = _jeu_caracteres(svg)
    regles = []
    for nom, jeu in (("MtSans", sans), ("MtMono", mono)):
        if jeu:
            b64 = _sous_ensemble(nom, jeu)
            regles.append(f'@font-face{{font-family:{nom};font-weight:400;font-style:normal;'
                          f'src:url(data:font/woff2;base64,{b64}) format("woff2")}}')
    return "<style>" + "".join(regles) + "</style>" if regles else ""


def integre(svg: str) -> str:
    """Insere le @font-face (sous-ensemble) juste apres la balise <svg ...>."""
    if "@font-face" in svg:
        return svg
    st = bloc_style(svg)
    i = svg.index(">") + 1
    return svg[:i] + "\n" + st + svg[i:]


def migre(svg: str) -> str:
    """Passe un ancien SVG (police systeme) a la police embarquee, sans toucher
    aux positions : seules les familles de police changent (et l italique,
    synthetise differemment selon les systemes, est retire)."""
    svg = svg.replace('font-family="MtSans, sans-serif"', f'font-family="{FAMILLE_SANS}"')
    svg = svg.replace('font-family="MtMono, monospace"', f'font-family="{FAMILLE_MONO}"')
    if "@font-face" in svg:
        return svg
    svg = svg.replace('font-family="ui-sans-serif, system-ui"', f'font-family="{FAMILLE_SANS}"')
    svg = svg.replace('font-family="ui-monospace"', f'font-family="{FAMILLE_MONO}"')
    svg = svg.replace(' font-style="italic"', "")
    return integre(svg)


if __name__ == "__main__":
    import sys
    n = 0
    for chemin in sys.argv[1:]:
        p = Path(chemin)
        s = p.read_text()
        if 'viewBox="0 0 800 450"' in s and ('font-family="ui-sans-serif, system-ui"' in s or 'font-family="MtSans, sans-serif"' in s):
            p.write_text(migre(s))
            n += 1
    print(f"{n} SVG migres vers la police embarquee")
