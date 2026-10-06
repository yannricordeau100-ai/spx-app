#!/usr/bin/env python3
"""Veille hebdomadaire des journees investisseurs et conferences produits.

Cadre : docs/EVENEMENTS-INVESTISSEURS.md, section 6 (Renouvellement).

Trois modes (un seul passage par appel) :
  (defaut)     detection : cherche un NOUVEL evenement posterieur au dernier connu
               et alimente .conv-state/evenements-a-traiter.json
  --extraire   traite la file : extraction a J+2 avec les moteurs GRATUITS
               (scripts/moteur_gratuit.py, jamais Claude), verification de 3
               valeurs, depot dans data-lake/<T>/evenement/dernier.json.
               RIEN n est ecrit dans src/data/evenements : feu vert de Yann requis.
  --perimer    masque les fichiers src/data/evenements/<t>.json dont l evenement
               a plus de 24 mois (sauf objectif encore dans sa periode).

Options : --dry (aucune ecriture, lectures reseau seulement), --limit N,
          --tickers A,B.
Etat : .conv-state/evenements-etat.json (meme forme que post-earnings-etat.json :
{maj, stes{T:{statut, ...}}}), alerte rouge a J+7 sans extraction.
"""
from __future__ import annotations

import argparse
import gzip
import json
import re
import ssl
import subprocess
import sys
import time
import urllib.request
from datetime import date, datetime, timedelta
from html import unescape
from pathlib import Path
from urllib.parse import urljoin

ROOT = Path("/Users/yann/spx-app")
sys.path.insert(0, str(ROOT / "scripts"))
UNIVERS = ROOT / "src/data/v1-9-5-clean-all-tickers.json"
ANNUAIRE = ROOT / "src/data/ir-directory.json"
EVT_DIR = ROOT / "src/data/evenements"
FILE = ROOT / ".conv-state/evenements-a-traiter.json"
ETAT = ROOT / ".conv-state/evenements-etat.json"
CIK_CACHE = ROOT / ".conv-state/sec-company-tickers.json"
LAKE = ROOT / "data-lake"
PDFTOTEXT = "/opt/homebrew/bin/pdftotext"

UA_SEC = "Mettrik research ricordeauyann@gmail.com"
UA_WEB = "Mozilla/5.0 (compatible; Mettrik research ricordeauyann@gmail.com)"
PAUSE_SEC = 0.35
PAUSE_WEB = 1.5
FENETRE_MOIS = 24
ALERTE_JOURS = 7
EXTRACTION_APRES_JOURS = 2

SUFFIXES_HORS_US = {"PA", "DE", "AS", "BR", "SW", "MC", "MI", "LS", "L", "ST", "OL", "CO", "HE", "KS", "T",
                    "TO", "HK", "AX", "VI", "IR", "WA", "SI", "NS", "BO", "SA", "MX", "TW", "SS", "SZ"}

TERMES_US = [
    "investor day", "analyst day", "capital markets day", "capital markets update", "capital markets event",
    "strategy update", "investor update", "investor and analyst day", "investor & analyst day",
    "analyst and investor day", "analyst & investor day", "developer conference",
    "developers conference", "product event", "innovation day", "technology day",
]
TERMES_WEB = TERMES_US + [
    "journee investisseurs", "journée investisseurs", "journee analystes", "journée analystes",
    "capital market day", "cmd ", "kapitalmarkttag", "capital markets", "tag der investoren",
    "investorentag", "analystentag", "dia del inversor", "día del inversor", "investor presentation day",
    "giornata degli investitori", "investerdag", "kapitalmarknadsdag", "kapitalmarkedsdag", "pääomamarkkinapäivä",
]
MOIS = {"january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6, "july": 7, "august": 8,
        "september": 9, "october": 10, "november": 11, "december": 12,
        "janvier": 1, "fevrier": 2, "février": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6, "juillet": 7,
        "aout": 8, "août": 8, "septembre": 9, "octobre": 10, "novembre": 11, "decembre": 12, "décembre": 12,
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "sept": 9, "oct": 10,
        "nov": 11, "dec": 12}

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE


def log(m: str) -> None:
    print(f"[evenements-veille] {datetime.now():%F %T} {m}", flush=True)


def lire(p: Path, defaut=None):
    try:
        return json.loads(p.read_text(encoding="utf8"))
    except Exception:
        return defaut


def ecrire(p: Path, data, dry: bool) -> None:
    if dry:
        return
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf8")
    tmp.replace(p)


def http(url: str, ua: str, timeout: int = 25, maxb: int = 600_000) -> bytes | None:
    req = urllib.request.Request(url, headers={"User-Agent": ua, "Accept-Encoding": "gzip", "Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
            b = r.read(maxb)
            if r.headers.get("Content-Encoding") == "gzip":
                try:
                    b = gzip.decompress(b)
                except Exception:
                    pass
            return b
    except Exception:
        return None


def texte_html(b: bytes) -> str:
    s = b.decode("utf8", "ignore")
    s = re.sub(r"(?is)<(script|style).*?</\1>", " ", s)
    s = re.sub(r"(?s)<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", unescape(s))


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", s.lower())


# ---------- dates ----------

def parse_date(s: str | None) -> date | None:
    if not s:
        return None
    s = str(s).strip()
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        try:
            return date(int(m[1]), int(m[2]), int(m[3]))
        except ValueError:
            return None
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", s)
    if m:
        try:
            return date(int(m[3]), int(m[2]), int(m[1]))
        except ValueError:
            return None
    return None


def dates_dans_texte(t: str) -> list[date]:
    out = []
    low = t.lower()
    for m in re.finditer(r"\b(\d{1,2})(?:st|nd|rd|th|er)?\s+(?:of\s+)?([a-zéûô]{3,9})\.?,?\s+(20\d{2})\b", low):
        mo = MOIS.get(m[2])
        if mo:
            try:
                out.append(date(int(m[3]), mo, int(m[1])))
            except ValueError:
                pass
    for m in re.finditer(r"\b([a-zéûô]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b", low):
        mo = MOIS.get(m[1])
        if mo:
            try:
                out.append(date(int(m[3]), mo, int(m[2])))
            except ValueError:
                pass
    for m in re.finditer(r"\b(20\d{2})-(\d{2})-(\d{2})\b", low):
        d = parse_date(m[0])
        if d:
            out.append(d)
    return out


# ---------- univers, references ----------

def univers() -> list[str]:
    d = lire(UNIVERS, {}) or {}
    return list(d.get("tickers", []))


def est_us(t: str) -> bool:
    if "." not in t:
        return True
    return t.rsplit(".", 1)[1].upper() not in SUFFIXES_HORS_US


def dernier_evenement_connu() -> dict[str, date]:
    """Date du dernier evenement connu par ticker (fichiers valides + registres)."""
    ref: dict[str, date] = {}
    if EVT_DIR.exists():
        for p in EVT_DIR.glob("*.json"):
            if p.name.startswith("_registre-"):
                reg = lire(p, {}) or {}
                for t, v in (reg.get("tickers", reg) or {}).items():
                    if not isinstance(v, dict):
                        continue
                    d = parse_date(v.get("derniere_date") or v.get("date") or v.get("verifie_le"))
                    if d:
                        ref[t.upper()] = max(ref.get(t.upper(), d), d)
            else:
                j = lire(p, {}) or {}
                d = parse_date((j.get("evenement") or {}).get("date"))
                t = (j.get("ticker") or p.stem).upper()
                if d:
                    ref[t] = max(ref.get(t, d), d)
    return ref


def charge_cik() -> dict[str, str]:
    d = lire(CIK_CACHE)
    if not d:
        b = http("https://www.sec.gov/files/company_tickers.json", UA_SEC)
        time.sleep(PAUSE_SEC)
        if not b:
            return {}
        try:
            d = json.loads(b)
        except Exception:
            return {}
        try:
            CIK_CACHE.write_text(json.dumps(d), encoding="utf8")
        except Exception:
            pass
    return {str(v["ticker"]).upper(): str(v["cik_str"]) for v in d.values()}


# ---------- detection US ----------

def detecte_us(t: str, cik: str, plancher: date) -> tuple[list[dict], str]:
    b = http(f"https://data.sec.gov/submissions/CIK{int(cik):010d}.json", UA_SEC)
    time.sleep(PAUSE_SEC)
    if not b:
        return [], "sec_inaccessible"
    try:
        rec = json.loads(b)["filings"]["recent"]
    except Exception:
        return [], "sec_illisible"
    trouves = []
    n = len(rec.get("form", []))
    for i in range(n):
        if rec["form"][i] not in ("8-K", "8-K/A"):
            continue
        fd = parse_date(rec["filingDate"][i])
        if not fd or fd <= plancher:
            continue
        items = str(rec["items"][i]) if rec.get("items") else ""
        if "7.01" not in items and "8.01" not in items:
            continue
        acc = rec["accessionNumber"][i]
        doc = rec["primaryDocument"][i]
        url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc.replace('-', '')}/{doc}"
        b2 = http(url, UA_SEC, maxb=400_000)
        time.sleep(PAUSE_SEC)
        if not b2:
            continue
        txt = texte_html(b2).lower()
        hit = next((x for x in TERMES_US if x in txt), None)
        if not hit:
            continue
        # un 8-K de resultats qui cite « investor day » en passant est un bruit : on exige le
        # terme dans les 3000 premiers caracteres utiles (titre, objet) ou plus de 2 occurrences
        debut = txt[:3500]
        if "2.02" in items:  # 8-K de resultats : seulement si le terme est dans l en-tete
            if not any(x in debut for x in TERMES_US):
                continue
        elif not (any(x in debut for x in TERMES_US) or sum(txt.count(x) for x in TERMES_US) >= 3):
            continue
        trouves.append({"ticker": t, "date": fd.isoformat(), "url": url, "type": f"8-K {items} : {hit}"})
    return trouves, "ok"


# ---------- detection hors US ----------

def detecte_web(t: str, entree: dict, plancher: date) -> tuple[list[dict], str]:
    ir = entree.get("ir_url") or entree.get("ir_hint")
    if not ir:
        return [], "sans_url_ir"
    b = http(ir, UA_WEB)
    time.sleep(PAUSE_WEB)
    if not b:
        return [], "ir_inaccessible"
    html = b.decode("utf8", "ignore")
    trouves, vus = [], set()
    for m in re.finditer(r'(?is)<a\b[^>]*?href\s*=\s*["\']([^"\']+)["\'][^>]*>(.*?)</a>', html):
        href, inner = m[1], texte_html(m[2].encode())
        blob = (inner + " " + href.replace("-", " ").replace("_", " ")).lower()
        hit = next((x for x in TERMES_WEB if x in blob), None)
        if not hit:
            continue
        url = urljoin(ir, href)
        if url in vus or url.startswith(("mailto:", "javascript:")):
            continue
        vus.add(url)
        ctx = html[max(0, m.start() - 300): m.end() + 300]
        ds = dates_dans_texte(inner + " " + texte_html(ctx.encode()))
        ds = [d for d in ds if d > plancher and d <= date.today() + timedelta(days=400)]
        if not ds:
            continue
        trouves.append({"ticker": t, "date": max(ds).isoformat(), "url": url, "type": f"page IR : {hit.strip()}"})
    return trouves[:3], "ok"


# ---------- etat et file ----------

def maj_etat_et_file(file_: dict, resume: dict, dry: bool) -> dict:
    today = date.today()
    stes: dict[str, dict] = {}
    rouges = []
    for e in file_["elements"]:
        det = parse_date(e.get("detecte_le")) or today
        age = (today - det).days
        statut = e.get("statut", "a_extraire")
        alerte = None
        if statut == "a_extraire" and age >= ALERTE_JOURS:
            alerte = f"rouge : detecte le {det.isoformat()}, aucune extraction apres {age} jours"
            rouges.append(e["ticker"])
        stes[e["ticker"]] = {
            "evenement": e.get("date"), "url": e.get("url"), "statut": statut,
            "detecte_le": e.get("detecte_le"), "extraction": e.get("extraction"), "alerte": alerte,
        }
    etat = {"maj": datetime.now().isoformat(timespec="seconds"), "resume": resume,
            "rouges": rouges, "stes": stes,
            "regles": {"extraction_apres_jours": EXTRACTION_APRES_JOURS, "alerte_jours": ALERTE_JOURS,
                       "peremption_mois": FENETRE_MOIS}}
    ecrire(ETAT, etat, dry)
    return etat


def charge_file() -> dict:
    f = lire(FILE, None)
    if not isinstance(f, dict) or "elements" not in f:
        f = {"maj": None, "elements": []}
    return f


# ---------- mode detection ----------

def mode_detection(args) -> int:
    tickers = univers()
    if args.tickers:
        tickers = [x.strip().upper() for x in args.tickers.split(",") if x.strip()]
    if args.limit:
        tickers = tickers[: args.limit]
    ann = (lire(ANNUAIRE, {}) or {}).get("entries", {})
    ref = dernier_evenement_connu()
    cik = charge_cik()
    fen = date.today() - timedelta(days=FENETRE_MOIS * 30)
    file_ = charge_file()
    connus = {(e["ticker"], e["url"]) for e in file_["elements"]}
    resume = {"tickers": len(tickers), "us": 0, "hors_us": 0, "nouveaux": 0, "erreurs": {}}
    nouveaux = []
    for i, t in enumerate(tickers, 1):
        plancher = max(ref.get(t, fen), fen)
        try:
            if est_us(t):
                resume["us"] += 1
                c = cik.get(t.replace(".", "-")) or cik.get(t)
                if not c:
                    trouves, st = [], "cik_inconnu"
                else:
                    trouves, st = detecte_us(t, c, plancher)
            else:
                resume["hors_us"] += 1
                trouves, st = detecte_web(t, ann.get(t, {}), plancher)
        except Exception as e:  # une societe en defaut ne doit pas arreter la passe
            trouves, st = [], f"exception:{type(e).__name__}"
        if st != "ok":
            resume["erreurs"][st] = resume["erreurs"].get(st, 0) + 1
        for ev in trouves:
            if (ev["ticker"], ev["url"]) in connus:
                continue
            ev.update({"detecte_le": date.today().isoformat(), "statut": "a_extraire"})
            nouveaux.append(ev)
            connus.add((ev["ticker"], ev["url"]))
            log(f"NOUVEAU {t} {ev['date']} {ev['type']} {ev['url']}")
        if i % 10 == 0:
            log(f"{i}/{len(tickers)} traites")
    resume["nouveaux"] = len(nouveaux)
    # un ticker deja en file avec le meme evenement ne reste pas en double
    file_["elements"].extend(nouveaux)
    file_["maj"] = datetime.now().isoformat(timespec="seconds")
    ecrire(FILE, file_, args.dry)
    etat = maj_etat_et_file(file_, resume, args.dry)
    log(f"RESUME {json.dumps(resume, ensure_ascii=False)} rouges={etat['rouges']}"
        + (" (simulation : rien ecrit)" if args.dry else ""))
    return 0


# ---------- mode extraction (moteurs gratuits seulement) ----------

def lit_source(url: str) -> str:
    b = http(url, UA_WEB, timeout=40, maxb=8_000_000)
    if not b:
        return ""
    if b[:4] == b"%PDF":
        try:
            p = subprocess.run([PDFTOTEXT, "-layout", "-", "-"], input=b, capture_output=True, timeout=90)
            return p.stdout.decode("utf8", "ignore")
        except Exception:
            return ""
    return texte_html(b)


PROMPT = """Tu extrais les chiffres d un evenement investisseurs de la societe {ticker} a partir du texte source.
Regles strictes : n utilise QUE des chiffres presents dans le texte ; pas de calcul ni d interpolation ;
chaque element porte une `citation` COPIEE MOT POUR MOT du texte (une phrase) ; tout chiffre futur est un
`objectif` de la societe ; la guidance annuelle est ignoree ; opinions et benchmarks internes ignores.
Reponds en JSON : {{"evenement": {{"nom": "", "type": "journee investisseurs|conference produits", "date": "JJ/MM/AAAA", "lieu": ""}},
"stories": [{{"short": "", "name_fr": "", "value": nombre ou null, "value_texte": "" ou null, "unit": "Mds $|M|%|GW|...",
"period": "", "nature": "realise|usage|capacite|objectif", "story_fr": "2 phrases max en francais", "story_category": "Adoption|Capacite|Objectifs|Capital|Clients|Innovation|Perspectives", "citation": ""}}],
"tam_candidats": [{{"texte": "", "citation": ""}}], "ignores": [""]}}
Maximum 8 stories.

TEXTE SOURCE :
{texte}"""


def chiffres(s: str) -> set[str]:
    return set(re.findall(r"\d+(?:[.,]\d+)?", s))


def verifie(donnees: dict, source: str) -> tuple[list[dict], list[dict]]:
    """Garde les stories dont la citation est retrouvee mot pour mot et dont la valeur figure dans la citation."""
    src = norm(source)
    bonnes, rejetees = [], []
    for s in donnees.get("stories", []) or []:
        cit = norm(s.get("citation", ""))
        ok_cit = len(cit) > 20 and cit in src
        v = s.get("value")
        ok_val = True
        if v is not None:
            cand = {str(v), str(v).rstrip("0").rstrip("."), str(int(v)) if float(v) == int(float(v)) else str(v)}
            cand |= {c.replace(".", ",") for c in cand}
            ok_val = any(c and c in chiffres(s.get("citation", "")) for c in cand)
        (bonnes if (ok_cit and ok_val) else rejetees).append({**s, "_citation_verifiee": bool(ok_cit and ok_val)})
    return bonnes, rejetees


def mode_extraction(args) -> int:
    from moteur_gratuit import MoteurIndisponible, appelle  # noqa: E402
    file_ = charge_file()
    today = date.today()
    traites = 0
    for e in file_["elements"]:
        if e.get("statut") != "a_extraire":
            continue
        det = parse_date(e.get("detecte_le")) or today
        if (today - det).days < EXTRACTION_APRES_JOURS:
            continue
        if args.tickers and e["ticker"] not in args.tickers.upper().split(","):
            continue
        if args.limit and traites >= args.limit:
            break
        src = lit_source(e["url"])[:30000]  # regle _30k
        if len(src) < 500:
            e["extraction"] = {"le": today.isoformat(), "resultat": "source illisible", "tentatives": e.get("extraction", {}).get("tentatives", 0) + 1}
            continue
        try:
            donnees, moteur = appelle(PROMPT.format(ticker=e["ticker"], texte=src), json_attendu=True)
        except MoteurIndisponible as ex:
            log(f"MOTEUR INDISPONIBLE {e['ticker']} : file laissee en l etat ({ex})")
            e["extraction"] = {"le": today.isoformat(), "resultat": "moteur indisponible"}
            break
        bonnes, rej = verifie(donnees, src)
        sondes = bonnes[:3]
        if len(sondes) < min(3, len(donnees.get("stories", []) or [])) or not bonnes:
            e["extraction"] = {"le": today.isoformat(), "resultat": "verification insuffisante", "bonnes": len(bonnes), "rejetees": len(rej), "moteur": moteur}
            traites += 1
            continue
        sortie = {"ticker": e["ticker"], "evenement": donnees.get("evenement"), "source_principale": e["url"],
                  "stories": bonnes, "tam_candidats": donnees.get("tam_candidats", []), "ignores": donnees.get("ignores", []) + [r.get("short", "") for r in rej],
                  "sondes": [{"short": s.get("short"), "value": s.get("value"), "citation": s.get("citation")} for s in sondes],
                  "extrait_le": today.isoformat(), "statut": "extrait_en_attente_feu_vert", "moteur": moteur}
        ecrire(LAKE / e["ticker"] / "evenement" / "dernier.json", sortie, args.dry)
        e["statut"] = "extrait"
        e["extraction"] = {"le": today.isoformat(), "resultat": "ok", "stories": len(bonnes), "moteur": moteur}
        traites += 1
        log(f"EXTRAIT {e['ticker']} : {len(bonnes)} stories verifiees, {len(rej)} rejetees ({moteur})")
    ecrire(FILE, file_, args.dry)
    maj_etat_et_file(file_, {"extraits": traites}, args.dry)
    return 0


# ---------- peremption ----------

def mode_peremption(args) -> int:
    if not EVT_DIR.exists():
        return 0
    limite = date.today() - timedelta(days=FENETRE_MOIS * 30)
    n = 0
    for p in EVT_DIR.glob("*.json"):
        if p.name.startswith("_registre-"):
            continue
        j = lire(p, {}) or {}
        d = parse_date((j.get("evenement") or {}).get("date"))
        if not d or d >= limite or j.get("masque"):
            continue
        # objectif encore dans sa periode : une annee de periode >= annee courante le garde visible
        annee = date.today().year
        if any(s.get("nature") == "objectif" and any(int(y) >= annee for y in re.findall(r"20\d{2}", str(s.get("period", "")))) for s in j.get("stories", [])):
            continue
        j["masque"] = True
        j["masque_le"] = date.today().isoformat()
        j["masque_motif"] = f"evenement de plus de {FENETRE_MOIS} mois"
        ecrire(p, j, args.dry)
        n += 1
        log(f"MASQUE {p.stem}")
    log(f"peremption : {n} fichier(s) masque(s)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--tickers", default="")
    ap.add_argument("--extraire", action="store_true")
    ap.add_argument("--perimer", action="store_true")
    args = ap.parse_args()
    if args.extraire:
        return mode_extraction(args)
    if args.perimer:
        return mode_peremption(args)
    rc = mode_detection(args)
    if not args.dry:
        mode_peremption(args)
    return rc


if __name__ == "__main__":
    sys.exit(main())
