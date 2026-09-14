#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Recuperation des logos de societes depuis MarketBeat.

Etape 1 (recuperation) : telecharge le logo de chaque societe de l univers dans
public/logos-marketbeat/<TICKER>.png (PNG, fond transparent conserve, 512 px max)
sans toucher aux logos actuels, et tient a jour src/data/logos-marketbeat.json.

Etape 2 (remplacement) : --remplacer copie les logos verifies vers
public/logos/<TICKER>.png apres sauvegarde de l ancien dans
public/logos-avant-marketbeat/, et inscrit le ticker dans logo-tickers.json.

Usage :
  python3 scripts/logos-marketbeat.py --non-us-d-abord
  python3 scripts/logos-marketbeat.py --tickers AI.PA,VOW3.DE --limit 5
  python3 scripts/logos-marketbeat.py --remplacer --non-us

Journal : .conv-state/logos-marketbeat.log
"""

import argparse
import html as htmllib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import time
import unicodedata
from urllib.parse import quote
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNIVERS = os.path.join(ROOT, "src", "data", "v1-9-5-clean-all-tickers.json")
PIPELINE = os.path.join(ROOT, "src", "data", "v2-pipeline")
SORTIE_DIR = os.path.join(ROOT, "public", "logos-marketbeat")
LOGOS_DIR = os.path.join(ROOT, "public", "logos")
BACKUP_DIR = os.path.join(ROOT, "public", "logos-avant-marketbeat")
ETAT_PATH = os.path.join(ROOT, "src", "data", "logos-marketbeat.json")
LOGO_TICKERS = os.path.join(ROOT, "src", "data", "logo-tickers.json")
STATE_DIR = os.path.join(ROOT, ".conv-state")
LOG_PATH = os.path.join(STATE_DIR, "logos-marketbeat.log")

BASE = "https://www.marketbeat.com"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
PAUSE = 1.5
TAILLE_MAX = 512

# Places testees directement, par suffixe de ticker. Les suffixes absents
# (.AS Amsterdam, .SW Zurich) n ont pas de place dediee chez MarketBeat :
# on passe par la recherche, qui renvoie la fiche OTC de la meme societe.
PLACES_US = ["NASDAQ", "NYSE", "NYSEAMERICAN", "NYSEARCA", "BATS", "OTCMKTS"]
PLACES_SUFFIXE = {
    "PA": ["EPA"],
    "DE": ["ETR"],
    "L": ["LON"],
    "AS": [],
    "SW": [],
}

# Noms de recherche forces, quand la place locale renvoie la fiche d une autre
# societe du meme groupe (ETR/P911 redirige vers Porsche Automobil Holding).
ALIAS_RECHERCHE = {
    "P911.DE": "Dr. Ing. h.c. F. Porsche AG",
    "SGSN.SW": "SGS SA",
}

MOTS_GENERIQUES = {
    "inc", "incorporated", "corp", "corporation", "company", "co", "the", "and",
    "group", "groupe", "holding", "holdings", "sa", "se", "ag", "nv", "n", "v",
    "plc", "ltd", "limited", "llc", "lp", "sas", "spa", "ab", "as", "asa", "oyj",
    "class", "cl", "a", "b", "international", "intl", "technologies", "technology",
    "tech", "industries", "industrial", "systems", "solutions", "services",
    "financial", "finance", "bank", "banking", "energy", "capital", "partners",
    "global", "worldwide", "new", "de", "du", "des", "la", "le", "les", "of",
    "trust", "reit", "properties", "pharmaceuticals", "pharma", "health",
    "healthcare", "resources", "materials", "products", "brands", "stores",
    "communications", "media", "motors", "electric", "electronics", "sciences",
    "s", "cie", "et", "ord", "shares", "adr", "ads", "company's",
    "groep", "koninklijke", "sca", "kgaa", "gmbh", "bv", "srl", "oy", "oyj",
    "aktiengesellschaft", "anonyme", "societe", "maatschappij", "unsponsored",
    "sponsored", "sp", "spa", "nfc", "vz", "st", "residential", "apartment",
}

_log_file = None
DERNIERE_URL = ""


def log(msg):
    line = "[%s] %s" % (datetime.now().strftime("%H:%M:%S"), msg)
    print(line, flush=True)
    if _log_file:
        _log_file.write(line + "\n")
        _log_file.flush()


# ---------------------------------------------------------------- reseau

def fetch(url, binaire=False, timeout=45, essais=3):
    """Retourne (code, contenu). code 0 = erreur reseau. Passe par curl.

    L URL finale (apres redirections) est deposee dans DERNIERE_URL.
    """
    global DERNIERE_URL
    DERNIERE_URL = url
    dernier = (0, b"" if binaire else "")
    for essai in range(essais):
        try:
            p = subprocess.run(
                ["curl", "-sS", "-L", "--max-time", str(timeout),
                 "-A", UA,
                 "-H", "Accept: text/html,application/xhtml+xml,image/*",
                 "-H", "Accept-Language: en-US,en;q=0.9",
                 "-w", "\n@@HTTP@@%{http_code} %{url_effective}", url],
                capture_output=True, timeout=timeout + 15)
            out = p.stdout
            i = out.rfind(b"\n@@HTTP@@")
            if i < 0:
                dernier = (0, b"" if binaire else "")
            else:
                queue = out[i + 9:].decode("utf-8", errors="replace").strip().split(" ", 1)
                code = int(queue[0] or 0)
                if len(queue) > 1:
                    DERNIERE_URL = queue[1].strip()
                corps = out[:i]
                if code in (200, 404):
                    return code, (corps if binaire else corps.decode("utf-8", errors="replace"))
                dernier = (code, corps if binaire else corps.decode("utf-8", errors="replace"))
                if code == 429:
                    time.sleep(20)
        except Exception as e:
            dernier = (0, b"" if binaire else "%s: %s" % (type(e).__name__, e))
        if essai < essais - 1:
            time.sleep(5)
    return dernier


# ---------------------------------------------------------------- noms

def normalise(s):
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.lower()


def translittere(s):
    """Rapproche les graphies allemandes : muenchener -> munchener."""
    s = normalise(s)
    for a, b in (("ue", "u"), ("oe", "o"), ("ae", "a"), ("ss", "s")):
        s = s.replace(a, b)
    return s


def compact(s):
    """Chaine reduite aux caracteres significatifs, pour l egalite stricte."""
    return re.sub(r"[^a-z0-9&]+", "", translittere(s))


_GENERIQUES_TR = None


def mots_distinctifs(nom):
    global _GENERIQUES_TR
    if _GENERIQUES_TR is None:
        _GENERIQUES_TR = {translittere(x) for x in MOTS_GENERIQUES} | MOTS_GENERIQUES
    mots = re.findall(r"[a-z0-9]+", translittere(nom))
    return {m for m in mots if m not in _GENERIQUES_TR and len(m) >= 2}


def noms_concordent(attendu, trouve):
    """Au moins un mot distinctif commun (hors mots generiques)."""
    ca, cb = compact(attendu), compact(trouve)
    if ca and cb and (ca == cb or (len(ca) >= 6 and ca in cb) or (len(cb) >= 6 and cb in ca)):
        return True
    a, b = mots_distinctifs(attendu), mots_distinctifs(trouve)
    if not a or not b:
        return False
    if a & b:
        return True
    # tolerance : un nom colle a l autre (ex. "C3.ai" vs "c3ai")
    ja, jb = "".join(sorted(a)), "".join(sorted(b))
    for m in a:
        if len(m) >= 5 and m in jb:
            return True
    for m in b:
        if len(m) >= 5 and m in ja:
            return True
    # tolerance : mot tronque (munich / munchener)
    for x in a:
        for y in b:
            if len(x) >= 5 and len(y) >= 5 and (x.startswith(y) or y.startswith(x)):
                return True
    # tolerance : sigle contre raison sociale (BMW = Bayerische Motoren Werke)
    if _sigle_concorde(attendu, trouve) or _sigle_concorde(trouve, attendu):
        return True
    return False


def _sigle_concorde(court, long_):
    """"BMW" contre "Bayerische Motoren Werke Aktiengesellschaft"."""
    jetons = re.findall(r"[a-z0-9]+", normalise(court))
    if len(jetons) != 1 or not 2 <= len(jetons[0]) <= 6:
        return False
    sigle = jetons[0]
    mots = re.findall(r"[a-z0-9&]+", normalise(long_))
    if len(mots) < 2:
        return False
    initiales = "".join(m[0] for m in mots)
    return len(sigle) >= 2 and initiales.startswith(sigle)


def nom_depuis_logo(url):
    """"roche-holding-ag-logo.png" -> "roche holding ag"."""
    fichier = (url or "").split("/")[-1].split("?")[0]
    fichier = re.sub(r"(?i)\.(png|gif|jpe?g|webp|svg)$", "", fichier)
    fichier = re.sub(r"(?i)(^|-)logo(-|$)", " ", fichier)
    return re.sub(r"[-_]+", " ", fichier).strip()


RE_TITRE = re.compile(r"(?is)<title[^>]*>(.*?)</title>")
RE_LOGO = re.compile(r"https?://(?:www\.)?marketbeat\.com/logos/([^\"'\s)>]+)")


def titre_page(body):
    m = RE_TITRE.search(body or "")
    if not m:
        return "", ""
    t = htmllib.unescape(re.sub(r"\s+", " ", m.group(1))).strip()
    # "Apple (AAPL) Stock Price, News & Analysis"
    m2 = re.match(r"^(.*?)\s*\(([^)]+)\)", t)
    if m2:
        return m2.group(1).strip(), m2.group(2).strip().upper()
    return t, ""


def logo_de_page(body):
    for m in RE_LOGO.finditer(body or ""):
        chemin = m.group(1)
        if chemin.lower().startswith("articles/"):
            continue
        # image passe-partout de MarketBeat : ce n est pas le logo de la societe
        if "generic" in chemin.lower():
            continue
        if not re.search(r"(?i)\.(png|gif|jpe?g|webp|svg)(\?|$)", chemin):
            continue
        return "%s/logos/%s" % (BASE, chemin)
    return ""


# ---------------------------------------------------------------- recherche

def candidats_url(ticker):
    """URL de fiche a tester en direct, dans l ordre."""
    if "." in ticker and ticker.split(".")[-1] in PLACES_SUFFIXE:
        racine, suf = ticker.rsplit(".", 1)
        places = PLACES_SUFFIXE[suf]
        symboles = [racine.upper()]
    else:
        places = PLACES_US
        symboles = [ticker.upper()]
    return ["%s/stocks/%s/%s/" % (BASE, p, s) for s in symboles for p in places]


def fiches_recherche(nom, ticker):
    """Fiches proposees par la recherche MarketBeat, nom concordant d abord.

    Retourne une liste de (url_fiche, nom_marketbeat, url_logo_devine).
    """
    requetes = []
    if nom:
        requetes.append(nom)
        court = re.sub(r"(?i)\b(ag|sa|se|nv|plc|ltd|group|holding|holdings|inc|s\.a\.|kgaa)\b", " ", nom)
        court = re.sub(r"\s+", " ", court).strip()
        if court and court.lower() != nom.lower():
            requetes.append(court)
    requetes.append(ticker.split(".")[0])
    concordants, autres, vus = [], [], set()
    for q in requetes:
        url = "%s/pages/search.aspx?query=%s" % (BASE, quote(q))
        code, body = fetch(url)
        time.sleep(PAUSE)
        if code != 200 or not body:
            continue
        for ligne in re.findall(
                r"(?is)<tr[^>]*class=['\"][^'\"]*result company[^'\"]*['\"].*?</tr>", body):
            m = re.search(r"href=\"(/stocks/[A-Z]+/[A-Z0-9.\-]+/)\"", ligne)
            if not m:
                continue
            fiche = BASE + m.group(1)
            if fiche in vus:
                continue
            vus.add(fiche)
            mt = re.search(r"(?is)class=\"title-area\">(.*?)</div>", ligne)
            nom_mb = htmllib.unescape(re.sub(r"<[^>]+>", " ", mt.group(1))).strip() if mt else ""
            mv = re.search(r"(?i)https?://[^\"']*marketbeat\.com/logos/thumbnail/([^\"'\s>]+)", ligne)
            logo = "%s/logos/%s" % (BASE, mv.group(1)) if mv else ""
            entree = (fiche, nom_mb, logo)
            (concordants if noms_concordent(nom or ticker, nom_mb) else autres).append(entree)
        if concordants:
            break
    return concordants[:3] + autres[:1]


def trouve_logo(ticker, nom):
    """Retourne dict {url, nom_marketbeat, page, verifie_nom, erreur}."""
    nom = ALIAS_RECHERCHE.get(ticker.upper(), nom)
    essais = []
    replis = []
    for url in candidats_url(ticker):
        code, body = fetch(url)
        finale = DERNIERE_URL
        time.sleep(PAUSE)
        if code != 200 or not body:
            continue
        nom_mb, sym = titre_page(body)
        if not nom_mb or "error 404" in nom_mb.lower():
            continue
        attendu = url.rstrip("/").rsplit("/", 1)[-1]
        if sym and sym != attendu:
            continue
        # une redirection vers une autre fiche (ex EPA/EL -> NYSE/EL) invalide
        # la correspondance place + symbole : on ne garde pas ce repli.
        meme_fiche = finale.rstrip("/").lower() == url.rstrip("/").lower()
        if not noms_concordent(nom, nom_mb):
            lien_repli = logo_de_page(body)
            if lien_repli and noms_concordent(nom, nom_depuis_logo(lien_repli)):
                return {"url": lien_repli, "nom_marketbeat": nom_mb or nom_depuis_logo(lien_repli),
                        "page": url, "verifie_nom": True, "erreur": ""}
            essais.append("nom different (%s)" % nom_mb[:40])
            if meme_fiche and lien_repli:
                replis.append({"url": lien_repli, "nom_marketbeat": nom_mb,
                               "page": url, "verifie_nom": False,
                               "erreur": "nom non verifie (MarketBeat : %s)" % nom_mb[:60]})
            continue
        if not meme_fiche:
            essais.append("redirection vers %s" % finale)
            continue
        lien = logo_de_page(body)
        if not lien:
            essais.append("page sans logo (%s)" % url)
            continue
        return {"url": lien, "nom_marketbeat": nom_mb, "page": url,
                "verifie_nom": True, "erreur": ""}

    for url, nom_liste, logo_liste in fiches_recherche(nom, ticker):
        code, body = fetch(url)
        time.sleep(PAUSE)
        if code != 200 or not body:
            continue
        nom_mb, _sym = titre_page(body)
        lien = logo_de_page(body) or logo_liste
        concorde = (noms_concordent(nom, nom_mb) or noms_concordent(nom, nom_liste)
                    or (lien and noms_concordent(nom, nom_depuis_logo(lien))))
        if not concorde:
            essais.append("recherche : nom different (%s)" % (nom_mb or nom_liste)[:40])
            continue
        if not lien:
            essais.append("recherche : page sans logo")
            continue
        return {"url": lien, "nom_marketbeat": nom_mb or nom_liste, "page": url,
                "verifie_nom": True, "erreur": ""}

    if replis:
        return replis[0]
    return {"url": "", "nom_marketbeat": "", "page": "", "verifie_nom": False,
            "erreur": "; ".join(essais[:2]) or "aucune fiche trouvee"}


# ---------------------------------------------------------------- image

def enregistre_png(donnees, chemin):
    """Convertit en PNG (transparence conservee, 512 px max). Retourne erreur."""
    from PIL import Image
    try:
        im = Image.open(io.BytesIO(donnees))
        im.load()
    except Exception as e:
        return "image illisible (%s)" % type(e).__name__
    if im.mode not in ("RGBA", "LA"):
        if im.mode == "P" and "transparency" in im.info:
            im = im.convert("RGBA")
        elif im.mode in ("RGB", "L", "CMYK", "P"):
            im = im.convert("RGB").convert("RGBA")
        else:
            im = im.convert("RGBA")
    else:
        im = im.convert("RGBA")
    if im.width < 16 or im.height < 16:
        return "image trop petite (%dx%d)" % (im.width, im.height)
    if max(im.size) > TAILLE_MAX:
        r = TAILLE_MAX / float(max(im.size))
        im = im.resize((max(1, int(im.width * r)), max(1, int(im.height * r))),
                       Image.LANCZOS)
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    im.save(chemin, "PNG", optimize=True)
    return ""


# ---------------------------------------------------------------- controle image

# Logos dont le texte ne reprend pas le nom (slogan, sigle stylise) mais qui
# ont ete regardes un par un et sont bien ceux de la societe.
IMAGES_VALIDEES = {
    "ABBN.SW", "AGN.AS", "DHL.DE", "FGR.PA", "G1A.DE", "LONN.SW", "RHM.DE",
    "SIKA.SW", "STLAP.PA", "SY1.DE", "UNA.AS",
}


# Logos regardes un par un et qui montrent une autre societe : MarketBeat sert
# une image sans rapport avec l adresse demandee. Jamais poses sur les pages.
IMAGES_REJETEES = {
    "ABN.AS", "CA.PA", "DBK.DE", "DG.PA", "ENGI.PA", "HO.PA", "MBG.DE",
    "P911.DE", "PAH3.DE", "PRX.AS", "PUM.DE", "RMS.PA", "RXL.PA", "SBMO.AS",
    "WKL.AS", "ZAL.DE",
}


def texte_image(chemin):
    """Texte lu dans l image (OCR tesseract). Chaine vide si outil absent."""
    try:
        p = subprocess.run(["tesseract", chemin, "-"], capture_output=True, timeout=60)
    except Exception:
        return ""
    return re.sub(r"\s+", " ", p.stdout.decode("utf-8", errors="replace")).strip()


def image_suspecte(chemin, nom, nom_mb, ticker=""):
    """True si le texte du logo designe visiblement une autre societe.

    MarketBeat sert parfois une image sans rapport avec le slug demande
    (le logo Invesco derriere l adresse de Porsche AG, par exemple). Le texte
    lu par l OCR est souvent bruite : on ne retient que des mots propres, et
    on tolere une lecture approximative du nom attendu.
    """
    txt = texte_image(chemin)
    if ticker.upper() in IMAGES_REJETEES:
        return True, txt
    if ticker.upper() in IMAGES_VALIDEES:
        return False, txt
    mots = [x for x in re.findall(r"[A-Za-z]{4,}", txt)
            if not re.fullmatch(r"(?i)inc|corp|ltd|the|and|group|holdings?", x)]
    if not mots:
        return False, txt
    if noms_concordent(nom, txt) or noms_concordent(nom_mb or "", txt):
        return False, txt
    # lecture approximative : "QUuALCOMW" contre "Qualcomm"
    import difflib
    cibles = [compact(x) for x in (nom, nom_mb or "") if x]
    for mot in mots:
        m = compact(mot)
        for cible in cibles:
            if not cible:
                continue
            if m in cible or cible in m:
                return False, txt
            if difflib.SequenceMatcher(None, m, cible).ratio() >= 0.6:
                return False, txt
            for bout in re.findall(r"[a-z0-9]+", cible):
                if len(bout) >= 4 and difflib.SequenceMatcher(None, m, bout).ratio() >= 0.7:
                    return False, txt
    return True, txt


def safe_ticker(t):
    return t.upper().replace(".", "-")


# ---------------------------------------------------------------- etat

def charge_etat():
    if os.path.exists(ETAT_PATH):
        try:
            with open(ETAT_PATH, encoding="utf-8") as f:
                d = json.load(f)
            d.setdefault("par_ticker", {})
            return d
        except Exception:
            pass
    return {"maj": "", "par_ticker": {}}


def sauve_etat(etat):
    etat["maj"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    os.makedirs(os.path.dirname(ETAT_PATH), exist_ok=True)
    tmp = ETAT_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(etat, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")
    os.replace(tmp, ETAT_PATH)


def nom_societe(ticker):
    p = os.path.join(PIPELINE, "%s.json" % ticker)
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f).get("name") or ""
    except Exception:
        return ""


def univers():
    with open(UNIVERS, encoding="utf-8") as f:
        return list(json.load(f)["tickers"])


def est_non_us(t):
    return "." in t and t.rsplit(".", 1)[-1].upper() in {"PA", "DE", "AS", "SW", "L", "MI", "MC", "BR", "ST", "CO", "HE", "LS", "VI", "OL", "IR", "T", "HK", "KS"}


# ---------------------------------------------------------------- etapes

def recupere(args):
    etat = charge_etat()
    tickers = univers()
    if args.tickers:
        voulus = {t.strip().upper() for t in args.tickers.split(",") if t.strip()}
        tickers = [t for t in tickers if t.upper() in voulus]
    if args.non_us_d_abord:
        tickers = [t for t in tickers if est_non_us(t)] + [t for t in tickers if not est_non_us(t)]
    a_faire = []
    for t in tickers:
        e = etat["par_ticker"].get(t)
        fichier = os.path.join(SORTIE_DIR, "%s.png" % safe_ticker(t))
        if e and e.get("ok") and os.path.exists(fichier):
            continue
        a_faire.append(t)
    if args.limit:
        a_faire = a_faire[:args.limit]
    log("recuperation : %d ticker(s) a traiter (univers %d)" % (len(a_faire), len(tickers)))

    ok = ko = 0
    for i, t in enumerate(a_faire, 1):
        nom = nom_societe(t)
        ancien = etat["par_ticker"].get(t, {})
        res = trouve_logo(t, nom)
        fiche = {
            "url": res["url"], "fichier": "", "nom_marketbeat": res["nom_marketbeat"],
            "ok": False, "verifie_nom": res["verifie_nom"],
            "remplace": bool(ancien.get("remplace")), "erreur": res["erreur"],
            "nom": nom, "page": res.get("page", ""),
        }
        if res["url"]:
            code, donnees = fetch(res["url"], binaire=True)
            time.sleep(PAUSE)
            if code != 200 or not donnees:
                fiche["erreur"] = "telechargement du logo impossible (HTTP %s)" % code
            else:
                rel = "logos-marketbeat/%s.png" % safe_ticker(t)
                err = enregistre_png(donnees, os.path.join(ROOT, "public", rel))
                if err:
                    fiche["erreur"] = err
                else:
                    chemin = os.path.join(ROOT, "public", rel)
                    suspecte, txt = image_suspecte(chemin, nom,
                                                   res["nom_marketbeat"], t)
                    fiche["texte_image"] = txt[:80]
                    fiche["image_suspecte"] = suspecte
                    fiche["fichier"] = "/" + rel
                    fiche["ok"] = True
                    if suspecte:
                        fiche["erreur"] = ("image a verifier : elle semble montrer "
                                           "autre chose (texte lu : %s)" % txt[:40])
        etat["par_ticker"][t] = fiche
        if fiche["ok"]:
            ok += 1
        else:
            ko += 1
        if i % 5 == 0 or not fiche["ok"]:
            sauve_etat(etat)
        log("%d/%d %s %s %s" % (i, len(a_faire), t,
                                "ok" if fiche["ok"] else "ECHEC",
                                fiche["nom_marketbeat"] or fiche["erreur"]))
    sauve_etat(etat)
    log("recuperation terminee : %d ok, %d echecs" % (ok, ko))


def remplace(args):
    etat = charge_etat()
    with open(LOGO_TICKERS, encoding="utf-8") as f:
        liste = json.load(f)
    connus = set(liste)
    cibles = []
    for t in univers():
        if args.tickers and t.upper() not in {x.strip().upper() for x in args.tickers.split(",")}:
            continue
        if args.non_us and not est_non_us(t):
            continue
        e = etat["par_ticker"].get(t)
        if not e or not e.get("ok") or not e.get("verifie_nom"):
            continue
        if e.get("image_suspecte"):
            continue
        cibles.append(t)
    log("remplacement : %d logo(s) candidat(s)" % len(cibles))
    n = 0
    for t in cibles:
        st = safe_ticker(t)
        src = os.path.join(SORTIE_DIR, "%s.png" % st)
        if not os.path.exists(src):
            continue
        dst = os.path.join(LOGOS_DIR, "%s.png" % st)
        if os.path.exists(dst):
            os.makedirs(BACKUP_DIR, exist_ok=True)
            sauve = os.path.join(BACKUP_DIR, "%s.png" % st)
            if not os.path.exists(sauve):
                shutil.copy2(dst, sauve)
        os.makedirs(LOGOS_DIR, exist_ok=True)
        shutil.copy2(src, dst)
        for variante in {st, t.upper()}:
            if variante not in connus:
                connus.add(variante)
                liste.append(variante)
        etat["par_ticker"][t]["remplace"] = True
        n += 1
    with open(LOGO_TICKERS, "w", encoding="utf-8") as f:
        json.dump(sorted(connus), f, ensure_ascii=False, indent=2)
        f.write("\n")
    sauve_etat(etat)
    log("remplacement termine : %d logo(s) copie(s) dans public/logos" % n)


def verifie_images(args):
    """Repasse le controle OCR sur les logos deja recuperes.

    Un logo dont le texte designe une autre societe est retire : le fichier
    est marque suspect et, s il avait ete pose sur les pages, l ancien logo
    est restaure depuis public/logos-avant-marketbeat/.
    """
    etat = charge_etat()
    tickers = univers()
    if args.tickers:
        voulus = {t.strip().upper() for t in args.tickers.split(",") if t.strip()}
        tickers = [t for t in tickers if t.upper() in voulus]
    n_suspects = n_restaures = 0
    for t in tickers:
        e = etat["par_ticker"].get(t)
        if not e:
            continue
        st = safe_ticker(t)
        src = os.path.join(SORTIE_DIR, "%s.png" % st)
        if not os.path.exists(src):
            continue
        suspecte, txt = image_suspecte(src, e.get("nom") or "",
                                       e.get("nom_marketbeat") or "", t)
        e["texte_image"] = txt[:80]
        e["image_suspecte"] = suspecte
        if not suspecte:
            e["erreur"] = ""
            continue
        n_suspects += 1
        e["erreur"] = ("image a verifier : elle semble montrer autre chose "
                       "(texte lu : %s)" % txt[:40])
        if e.get("remplace"):
            sauve = os.path.join(BACKUP_DIR, "%s.png" % st)
            dst = os.path.join(LOGOS_DIR, "%s.png" % st)
            if os.path.exists(sauve):
                shutil.copy2(sauve, dst)
                n_restaures += 1
            elif os.path.exists(dst):
                os.remove(dst)
                n_restaures += 1
            e["remplace"] = False
        log("suspect %s : %s" % (t, txt[:50]))
    sauve_etat(etat)
    log("controle des images termine : %d suspect(s), %d logo(s) restaure(s)"
        % (n_suspects, n_restaures))


def main():
    global _log_file
    p = argparse.ArgumentParser()
    p.add_argument("--tickers")
    p.add_argument("--limit", type=int)
    p.add_argument("--non-us-d-abord", action="store_true", dest="non_us_d_abord")
    p.add_argument("--remplacer", action="store_true")
    p.add_argument("--non-us", action="store_true", dest="non_us")
    p.add_argument("--verif-images", action="store_true", dest="verif_images")
    args = p.parse_args()

    os.makedirs(STATE_DIR, exist_ok=True)
    os.makedirs(SORTIE_DIR, exist_ok=True)
    _log_file = open(LOG_PATH, "a", encoding="utf-8")
    if args.verif_images:
        verifie_images(args)
    elif args.remplacer:
        remplace(args)
    else:
        recupere(args)


if __name__ == "__main__":
    main()
