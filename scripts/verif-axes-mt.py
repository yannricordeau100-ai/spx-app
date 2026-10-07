#!/usr/bin/env python3
"""
Detecteur de chevauchement des libelles de l axe X des graphiques moyen terme
(Yann, 7 oct 2026 : « les libelles de l axe X ne se chevauchent JAMAIS »).

Pour chaque SVG de public/findings (gabarit finding-svg.py), on releve tous les
<text>, on calcule la boite englobante de chacun (position, ancre, taille,
rotation, largeur de police) et on signale :
  - axe/axe     : deux libelles voisins de l axe X se touchent ou sont a moins
                  de MARGE_MIN pixels l un de l autre ;
  - axe/valeur  : un libelle d axe X touche une etiquette de valeur ;
  - axe/legende : un libelle d axe X touche la legende ;
  - debordement : un libelle d axe X sort du cadre (viewBox) ;
  - option --rendu : refait le meme controle avec les largeurs REELLES mesurees
                  par resvg avec les polices embarquees (--use-font-file, aucune
                  police systeme) au lieu de la mesure par tables ; defauts
                  prefixes « rendu: ».

Largeur des textes : jamais sous-estimee. Police a chasse fixe : 0,62 em
(SF Mono / Menlo mesurent 0,60). Police proportionnelle : maximum entre la
mesure reelle de Helvetica (PIL, si presente), majoree de 8 %, et le tableau de
largeurs prudent du generateur.

Usage :
  python3 scripts/verif-axes-mt.py                 tous les SVG de public/findings
  python3 scripts/verif-axes-mt.py a.svg b.svg     fichiers precis
  python3 scripts/verif-axes-mt.py --json          sortie JSON
Code de retour : 1 s il y a au moins un fichier en defaut.
Module importable : verifie_svg(texte_svg) -> liste de defauts.
"""
from __future__ import annotations
import html, json, math, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mt_police as POLICE   # police embarquee (Manrope + JetBrains Mono), meme mesure que le rendu
MARGE_MIN = 5.0      # ecart minimal exige entre deux libelles voisins (px, viewBox 800)
MARGE_CADRE = 2.0    # un libelle doit rester a au moins 2 px du bord

_police = {}


def _pil(taille_ref=100):
    if "p" in _police:
        return _police["p"]
    f = None
    try:
        from PIL import ImageFont
        for chemin in ("/System/Library/Fonts/Helvetica.ttc", "/Library/Fonts/Arial.ttf",
                       "/System/Library/Fonts/Supplemental/Arial.ttf",
                       "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
            if Path(chemin).exists():
                f = ImageFont.truetype(chemin, taille_ref)
                break
    except Exception:
        f = None
    _police["p"] = f
    return f


def largeur_prudente(t: str, taille: float) -> float:
    """Largeur proportionnelle jamais sous-estimee."""
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
    est = total * taille
    f = _pil()
    if f is not None:
        try:
            reel = f.getlength(t) * taille / 100.0 * 1.08
            return max(reel, est)
        except Exception:
            pass
    return est * 1.1


def largeur(t: str, taille: float, mono: bool) -> float:
    """Largeur lue dans la police EMBARQUEE (identique sur tous les systemes).
    Chasse fixe : 0,62 em (la police fait 0,60, marge conservee)."""
    if mono:
        return len(t) * taille * 0.62
    return POLICE.largeur(t, taille, False)


def _attr(bloc: str, nom: str, defaut=None):
    m = re.search(r'(?<![\w-])' + re.escape(nom) + r'="([^"]*)"', bloc)
    return m.group(1) if m else defaut


def releve_textes(svg: str) -> list[dict]:
    out = []
    # famille heritee de l element racine ou d un <g>
    for m in re.finditer(r"<text\b([^>]*)>(.*?)</text>", svg, re.S):
        a, contenu = m.group(1), m.group(2)
        texte = html.unescape(re.sub(r"<[^>]+>", "", contenu))
        try:
            x = float(_attr(a, "x", "0"))
            y = float(_attr(a, "y", "0"))
            taille = float(_attr(a, "font-size", "11"))
        except ValueError:
            continue
        mono = "monospace" in (_attr(a, "font-family", "") or "")
        ancre = _attr(a, "text-anchor", "start")
        rot = 0.0
        rx, ry = x, y
        tr = _attr(a, "transform", "") or ""
        mr = re.search(r"rotate\(\s*(-?[\d.]+)(?:[ ,]+(-?[\d.]+)[ ,]+(-?[\d.]+))?\s*\)", tr)
        if mr:
            rot = float(mr.group(1))
            if mr.group(2) is not None:
                rx, ry = float(mr.group(2)), float(mr.group(3))
        # <g transform="translate(0,Y)"> : on cherche le groupe englobant
        dy = 0.0
        avant = svg[: m.start()]
        mg = list(re.finditer(r'<g transform="translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*\)">|</g>', avant))
        pile = []
        for g in mg:
            if g.group(0) == "</g>":
                if pile:
                    pile.pop()
            else:
                pile.append((float(g.group(1)), float(g.group(2))))
        dx_g = sum(p[0] for p in pile)
        dy = sum(p[1] for p in pile)
        out.append({"t": texte, "x": x + dx_g, "y": y + dy, "taille": taille, "mono": mono,
                    "ancre": ancre, "rot": rot, "rx": rx + dx_g, "ry": ry + dy,
                    "fill": _attr(a, "fill", ""), "data_axe": _attr(a, "data-axe") == "x"})
    return out


def boite(tx: dict, wf=None) -> tuple[float, float, float, float]:
    """Boite englobante (x0, y0, x1, y1) du texte, rotation comprise.
    wf : fonction de largeur (par defaut l estimation prudente ; en mode rendu, la mesure resvg)."""
    w = (wf or largeur)(tx["t"], tx["taille"], tx["mono"])
    h_haut, h_bas = tx["taille"] * 0.80, tx["taille"] * 0.22
    if tx["ancre"] == "middle":
        x0 = tx["x"] - w / 2
    elif tx["ancre"] == "end":
        x0 = tx["x"] - w
    else:
        x0 = tx["x"]
    coins = [(x0, tx["y"] - h_haut), (x0 + w, tx["y"] - h_haut), (x0 + w, tx["y"] + h_bas), (x0, tx["y"] + h_bas)]
    if tx["rot"]:
        a = math.radians(tx["rot"])
        c, s = math.cos(a), math.sin(a)
        rx, ry = tx["rx"], tx["ry"]
        coins = [(rx + (px - rx) * c - (py - ry) * s, ry + (px - rx) * s + (py - ry) * c) for px, py in coins]
    xs = [p[0] for p in coins]
    ys = [p[1] for p in coins]
    return min(xs), min(ys), max(xs), max(ys)


def _inter(b1, b2, marge=0.0) -> bool:
    return not (b1[2] + marge <= b2[0] or b2[2] + marge <= b1[0] or b1[3] <= b2[1] or b2[3] <= b1[1])


def _dim_vue(svg: str) -> tuple[float, float]:
    m = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg)
    return (float(m.group(1)), float(m.group(2))) if m else (800.0, 450.0)


def classe(svg: str):
    """(axe_x, valeurs, legende, graduations) : classement des textes du gabarit.
    Axe X : texte marque data-axe="x", ou (anciens fichiers) texte proportionnel
    pose sur la ligne y = 402 (la legende, elle, est plus bas). Legende : texte proportionnel de couleur « legende »."""
    axe, valeurs, legende, graduations = [], [], [], []
    for tx in releve_textes(svg):
        fill = (tx["fill"] or "").lower()
        if not tx["mono"] and (tx.get("data_axe") or (abs(tx["y"] - 402) < 0.5 and tx["taille"] >= 8)):
            axe.append(tx)
        elif not tx["mono"] and fill in ("#ccc", "#333"):
            legende.append(tx)
        elif tx["mono"] and tx["ancre"] == "end" and abs(tx["x"] - 72) < 1 and tx["rot"] == 0:
            graduations.append(tx)
        else:
            valeurs.append(tx)
    return axe, valeurs, legende, graduations


# --- Mesure par rendu reel (resvg, polices du systeme) -----------------------
import hashlib, shutil, subprocess, tempfile
_cache_rendu: dict = {}


def _resvg():
    return shutil.which("resvg") or "/opt/homebrew/bin/resvg"


def cmd_resvg(opts) -> list:
    """resvg avec les polices EMBARQUEES seules (aucune police systeme)."""
    cmd = [_resvg(), "--skip-system-fonts"]
    for f in POLICE.FICHIERS_POLICE.values():
        cmd += ["--use-font-file", str(f)]
    return cmd + list(opts)


def precharge_rendu(items) -> None:
    """Mesure par lots, en un seul appel resvg par lot, la largeur d encre reelle
    de chaque (texte, taille, mono) pas encore connu."""
    from PIL import Image
    from xml.sax.saxutils import escape
    manque = sorted({i for i in items if i not in _cache_rendu})
    for k in range(0, len(manque), 60):
        lot = manque[k:k + 60]
        ZOOM, LIGNE = 2, 40
        lignes = []
        for n, (t, taille, mono) in enumerate(lot):
            fam = POLICE.FAMILLE_MONO if mono else POLICE.FAMILLE_SANS
            lignes.append(f'<text x="20" y="{n * LIGNE + 28}" font-size="{taille:g}" font-family="{fam}">{escape(t)}</text>')
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 {len(lot) * LIGNE}" '
               f'font-family="{POLICE.FAMILLE_SANS}"><rect width="1000" height="{len(lot) * LIGNE}" fill="white"/>'
               + "".join(lignes) + "</svg>")
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "m.svg").write_text(svg)
            subprocess.run(cmd_resvg(["-z", str(ZOOM)]) + [str(Path(d) / "m.svg"), str(Path(d) / "m.png")],
                           check=True, capture_output=True)
            im = Image.open(Path(d) / "m.png").convert("L")
        W2 = im.width
        for n, cle in enumerate(lot):
            bande = im.crop((0, n * LIGNE * ZOOM, W2, (n + 1) * LIGNE * ZOOM))
            bbox = bande.point(lambda v: 255 if v < 160 else 0).getbbox()
            _cache_rendu[cle] = ((bbox[2] - bbox[0]) / ZOOM + 1.0) if bbox else 0.0


def largeur_rendu(t: str, taille: float, mono: bool) -> float:
    cle = (t, taille, mono)
    if cle not in _cache_rendu:
        precharge_rendu([cle])
    return _cache_rendu[cle]


def verifie_svg(svg: str, rendu: bool = False) -> list[dict]:
    W, H = _dim_vue(svg)
    axe, valeurs, legende, grad = classe(svg)
    defauts = []
    axe = sorted(axe, key=lambda t: boite(t)[0])
    wf = largeur_rendu if rendu else None
    if rendu:
        precharge_rendu([(t['t'], t['taille'], t['mono']) for t in axe + valeurs + legende])
    boites = [boite(t, wf) for t in axe]
    for i, (t, b) in enumerate(zip(axe, boites)):
        if b[0] < MARGE_CADRE or b[2] > W - MARGE_CADRE or b[3] > H - 1:
            defauts.append({"type": ("rendu:" if rendu else "") + "debordement", "texte": t["t"], "boite": [round(v, 1) for v in b]})
    for i in range(len(axe) - 1):
        b1, b2 = boites[i], boites[i + 1]
        if b2[0] - b1[2] < MARGE_MIN and not (b1[3] <= b2[1] or b2[3] <= b1[1]):
            defauts.append({"type": ("rendu:" if rendu else "") + "axe/axe", "texte": f'{axe[i]["t"]} | {axe[i + 1]["t"]}',
                            "ecart": round(b2[0] - b1[2], 1)})
    # un libelle large peut aussi toucher le suivant du suivant
    for i in range(len(axe)):
        for j in range(i + 2, len(axe)):
            if _inter(boites[i], boites[j], MARGE_MIN):
                defauts.append({"type": ("rendu:" if rendu else "") + "axe/axe", "texte": f'{axe[i]["t"]} | {axe[j]["t"]}'})
    for t, b in zip(axe, boites):
        for v in valeurs:
            if _inter(b, boite(v, wf), 2.0):
                defauts.append({"type": ("rendu:" if rendu else "") + "axe/valeur", "texte": f'{t["t"]} | {v["t"]}'})
        for l in legende:
            if _inter(b, boite(l, wf), 2.0):
                defauts.append({"type": ("rendu:" if rendu else "") + "axe/legende", "texte": f'{t["t"]} | {l["t"]}'})
    return defauts


def est_graphique_mt(svg: str) -> bool:
    return 'viewBox="0 0 800 450"' in svg and ('font-family="MtSans, Manrope, sans-serif"' in svg or 'font-family="ui-sans-serif, system-ui"' in svg)


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    sortie_json = "--json" in sys.argv
    rendu = "--rendu" in sys.argv
    if args:
        fichiers = [Path(a) for a in args]
    else:
        fichiers = sorted((ROOT / "public" / "findings").rglob("*.svg"))
    en_defaut, total = {}, 0
    for f in fichiers:
        try:
            svg = f.read_text()
        except Exception:
            continue
        if not est_graphique_mt(svg):
            continue
        total += 1
        d = verifie_svg(svg) + (verifie_svg(svg, rendu=True) if rendu else [])
        if d:
            en_defaut[str(f.relative_to(ROOT)) if f.is_absolute() and ROOT in f.parents else str(f)] = d
    if sortie_json:
        print(json.dumps({"total": total, "en_defaut": en_defaut}, ensure_ascii=False, indent=1))
    else:
        for f, d in en_defaut.items():
            print(f"{f}  ->  " + " ; ".join(f'{x["type"]} [{x["texte"]}]' for x in d[:3]))
        print(f"\n{len(en_defaut)} graphique(s) en defaut sur {total} controle(s)")
    return 1 if en_defaut else 0


if __name__ == "__main__":
    sys.exit(main())
