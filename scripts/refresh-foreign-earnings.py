#!/usr/bin/env python3
"""
refresh-foreign-earnings.py — Source CONTINUE et GRATUITE de next_earnings_date
pour les stes foreign sans ADR couvert par FMP.

Integre dans daily-earnings-refresh.yml (cron quotidien), au meme titre que
SEC EDGAR / FMP pour les autres stes. Pour chaque ticker de
src/data/foreign-earnings-sources.json :
  - mode=http : curl la page calendrier financier officielle (IR).
  - mode=js   : rend la page via Playwright headless (sites JS).
Extrait la PROCHAINE date d'earnings (proximite mots-cles resultats) et
ecrit next_earnings_date + next_earnings_source dans v2-pipeline/<t>.json.

Repli gracieux : si extraction echoue, on NE TOUCHE PAS la valeur existante
(aucune regression, aucune date inventee).

Usage:
  python3 scripts/refresh-foreign-earnings.py --mode http --apply
  python3 scripts/refresh-foreign-earnings.py --mode js --apply
  python3 scripts/refresh-foreign-earnings.py --mode all --apply   (cron)
  (sans --apply = dry-run)
"""
import json, os, re, sys, subprocess, argparse, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = os.path.join(ROOT, "src/data/foreign-earnings-sources.json")
PIPE = os.path.join(ROOT, "src/data/v2-pipeline")
TODAY = datetime.date.today().isoformat()
HORIZON = (datetime.date.today() + datetime.timedelta(days=400)).isoformat()

MONTHS = {m.lower(): i for i, m in enumerate(
    ["January","February","March","April","May","June","July","August",
     "September","October","November","December"], 1)}
for full, ab in [("January","Jan"),("February","Feb"),("March","Mar"),
    ("April","Apr"),("June","Jun"),("July","Jul"),("August","Aug"),
    ("September","Sep"),("October","Oct"),("November","Nov"),("December","Dec")]:
    MONTHS[ab.lower()] = MONTHS[full.lower()]

# Mots-cles PUBLICATION DE RESULTATS (multi-langue) — la date doit en avoir un proche.
KW_POS = re.compile(r"(results|r[ée]sultats?|risultati|half[- ]?year(?:ly)? report|"
                r"interim (?:results|report|statement)|full[- ]?year results|"
                r"annual results|preliminary results|trading (?:update|statement)|"
                r"quarter(?:ly)? (?:results|report|statement)|q[1-4]\b|first quarter|"
                r"third quarter|nine[- ]?month|half[- ]?year financial|earnings|"
                r"halbjahr|quartalsmitteilung|gesch[äa]ftsbericht|jahresbericht|"
                r"relazione finanziaria|resoconto intermedio|bilancio|"
                r"kvartalsrapport|del[åa]rsrapport|halv[åa]rsrapport|regnskap|"
                r"(?:half|full|annual|quarter|interim|nine|year)[a-z ]{0,14}report)", re.I)
# Evenements a EXCLURE (pas une publication de resultats)
KW_NEG = re.compile(r"(general meeting|\bAGM\b|annual general|hauptversammlung|"
                r"assembl[ée]e|assemblea|generalforsamling|conference|conf[ée]rence|"
                r"capital markets|investor day|roadshow|ex[- ]?dividend|ex[- ]?date|"
                r"dividend payment|payment date|record date|teach[- ]?in|"
                r"ZKB|equity conference|fireside|seminar|webcast invitation)", re.I)

def to_iso(token):
    t = token.strip().replace("\xa0", " ")
    m = re.match(r"^(20\d{2})-(\d{2})-(\d{2})$", t)
    if m: return t
    m = re.match(r"^(\d{1,2})[./](\d{1,2})[./](20\d{2})$", t)  # dd/mm/yyyy
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), m.group(3)
        if 1 <= mo <= 12 and 1 <= d <= 31: return f"{y}-{mo:02d}-{d:02d}"
        return None
    m = re.match(r"^(\d{1,2})\s+([A-Za-z]+)\.?\s+(20\d{2})$", t)  # 29 July 2026
    if m:
        mo = MONTHS.get(m.group(2).lower())
        if mo: return f"{m.group(3)}-{mo:02d}-{int(m.group(1)):02d}"
        return None
    m = re.match(r"^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(20\d{2})$", t)  # July 29, 2026
    if m:
        mo = MONTHS.get(m.group(1).lower())
        if mo: return f"{m.group(3)}-{mo:02d}-{int(m.group(2)):02d}"
        return None
    return None

DATE_RX = re.compile(
    r"(20\d{2}-\d{2}-\d{2}"
    r"|\d{1,2}[./]\d{1,2}[./]20\d{2}"
    r"|\d{1,2}\s+[A-Za-z]+\.?\s+20\d{2}"
    r"|[A-Za-z]+\.?\s+\d{1,2},?\s+20\d{2})")

def extract_next(text):
    """Renvoie (iso_date, contexte) de la prochaine PUBLICATION DE RESULTATS.
    Exige un mot-cle resultats proche ET aucun mot-cle exclu (AGM, conference,
    dividende...). Precision > rappel : mieux vaut aucune date qu'une AGM."""
    text = text.replace("\xa0", " ")
    cands = []
    for m in DATE_RX.finditer(text):
        iso = to_iso(m.group(0))
        if not iso or iso < TODAY or iso > HORIZON:
            continue
        ctx = text[max(0, m.start()-90): m.end()+90]
        ctxn = re.sub(r"[-/_]", " ", ctx)  # normalise separateurs (Half-Yearly-Report)
        if KW_POS.search(ctxn) and not KW_NEG.search(ctxn):
            cands.append((iso, re.sub(r"\s+", " ", ctx)[:120]))
    if not cands: return None, None
    cands.sort(key=lambda x: x[0])
    return cands[0]

def fetch_http(url):
    try:
        r = subprocess.run(["/usr/bin/curl", "-sL", "-A",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "--max-time", "15", url],
            capture_output=True, text=True, timeout=20)
        return re.sub(r"<[^>]+>", " ", r.stdout)  # strip tags -> texte
    except Exception:
        return ""

def fetch_js(url):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return None  # signale: tier js non dispo (local) -> skip propre
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(headless=True)
            pg = b.new_page(user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
            pg.goto(url, wait_until="networkidle", timeout=30000)
            txt = pg.inner_text("body")
            b.close()
            return txt
    except Exception:
        return ""

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["http", "js", "all"], default="all")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    cfg = json.load(open(CFG))["sources"]
    updated, skipped, failed = [], [], []
    for tk, conf in cfg.items():
        mode = conf.get("mode", "http")
        if args.mode != "all" and args.mode != mode:
            continue
        text, used = "", None
        for url in conf["urls"]:
            text = fetch_js(url) if mode == "js" else fetch_http(url)
            if text is None:  # playwright absent
                skipped.append(f"{tk} (js tier non dispo ici)"); text = ""; break
            if text and len(text) > 300:
                used = url; break
        if not text:
            failed.append(tk); continue
        iso, ctx = extract_next(text)
        if not iso:
            failed.append(tk); continue
        f = os.path.join(PIPE, f"{tk.lower()}.json")
        if not os.path.exists(f):
            failed.append(f"{tk} (no file)"); continue
        d = json.load(open(f))
        old = d.get("next_earnings_date")
        if args.apply:
            d["next_earnings_date"] = iso
            d["next_earnings_source"] = f"IR officiel {used}"
            d.pop("next_earnings_estimated", None)
            d["_earnings_refreshed"] = f"{TODAY} IR-calendar ({mode})"
            json.dump(d, open(f, "w"), indent=2, ensure_ascii=False)
        updated.append(f"{tk}: {old} -> {iso}  [{ctx[:60]}]")
    print(f"=== refresh-foreign-earnings ({args.mode}, {'APPLY' if args.apply else 'dry'}) ===")
    for u in updated: print("  OK  ", u)
    if skipped: print("  SKIP", skipped)
    if failed: print("  FAIL", failed)
    print(f"total: {len(updated)} maj / {len(failed)} echec / {len(skipped)} skip")

if __name__ == "__main__":
    main()
