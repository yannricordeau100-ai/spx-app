#!/usr/bin/env python3
"""
extract_quarterly.py - Couche TRIMESTRIELLE 0-token (pour le toggle Annuel/Trim).
Lit les 10-Q LOCAUX, prend la colonne du TRIMESTRE COURANT (vals[0], pas le cumul
YTD), reconstruit un historique trimestriel par segment. Validé sur AAPL
(saisonnalité Products + croissance Services correctes). 0 reseau, 0 token, lxml.
Ecrit data-lake/<T>/kpis_q/extracted.json (separe de l'annuel). Resumable.
"""
import importlib.util, glob, gzip, os, re, sys, json, datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from bs4 import BeautifulSoup
import warnings
warnings.filterwarnings("ignore")

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("ex", os.path.join(HERE, "extract_specific.py"))
ex = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ex)
ROOT, LAKE = ex.ROOT, ex.LAKE


def q_period_end(filing_date):
    # un 10-Q est depose ~35j apres la fin du trimestre -> approx de la fin de periode
    d = datetime.date.fromisoformat(filing_date) - datetime.timedelta(days=35)
    return d.isoformat()


def extract_quarterly(ticker, n=12):
    files = sorted(glob.glob(os.path.join(ROOT, f"sec-data/cat1-us/10Q/*/{ticker}_*.htm.gz")))[-n:]
    if not files:
        return None
    series = {}
    for f in files:
        try:
            html = gzip.open(f, "rt", errors="ignore").read()
        except Exception:
            continue
        m = re.search(r"(\d{4}-\d{2}-\d{2})", os.path.basename(f))
        if not m:
            continue
        pe = q_period_end(m.group(1))
        src = "local:" + os.path.basename(f)
        soup = BeautifulSoup(html, "lxml")
        for table in soup.find_all("table"):
            rows = []
            for tr in table.find_all("tr"):
                cells = [td.get_text(" ", strip=True).replace("\xa0", " ") for td in tr.find_all(["td", "th"])]
                cells = [c for c in cells if c not in ("", "$", "%")]
                if cells:
                    rows.append(cells)
            tot = next((i for i, r in enumerate(rows) if r and ex.TOTAL_RX.match(r[0])), None)
            if tot is None or tot < 2 or tot > 14:
                continue
            got = False
            for r in rows[:tot]:
                if len(r) < 3:
                    continue
                lb = r[0].strip()
                if not lb or lb[0].isdigit() or len(lb) < 3 or lb.startswith("("):
                    continue
                ll = lb.lower()
                if ll.startswith(ex.SKIP_LABEL) or "dollars)" in ll or ll.endswith(", net") or "/(" in ll \
                        or any(s in ll for s in ("growth from", "growth in", "declines", "decline",
                                                 "increase in", "decrease", "favorable", "unfavorable",
                                                 "impact of", "due to", "net of", "change in",
                                                 "operational", "foreign exchange", "currency")):
                    continue
                vals = [c for c in r[1:] if ex.is_val(c)]
                if vals:
                    series.setdefault(lb, []).append(
                        {"period_end": pe, "value": ex.to_num(vals[0]), "accession": src, "quote": vals[0]})
                    got = True
            if got:
                break  # 1re table de desagregation seulement
    kpis = []
    for lb, hist in series.items():
        seen, h = set(), []
        for pt in hist:
            if pt["period_end"] in seen:
                continue
            seen.add(pt["period_end"])
            h.append(pt)
        if len(h) >= 3:  # au moins 3 trimestres pour etre utile
            kpis.append({"short": lb[:40], "name_fr": lb[:70], "unit": "M $",
                         "period_type": "quarter", "history": sorted(h, key=lambda x: x["period_end"])})
    if not kpis:
        return None
    return {"ticker": ticker, "kpis": kpis, "_extracted_by": "deterministic-bs4-10q-quarterly"}


def process(ticker):
    out = os.path.join(LAKE, ticker, "kpis_q", "extracted.json")
    if os.path.exists(out):
        return -1
    q = extract_quarterly(ticker)
    if not q:
        return 0
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(q, open(out, "w"), ensure_ascii=False, indent=1)
    return len(q["kpis"])


def main():
    workers = 8
    if "--workers" in sys.argv:
        workers = int(sys.argv[sys.argv.index("--workers") + 1])
    scope, _ = ex.load_scope()
    targets = [t for t in scope if t and glob.glob(os.path.join(ROOT, f"sec-data/cat1-us/10Q/*/{t}_*.htm.gz"))]
    print(f"stes avec 10-Q local: {len(targets)}")
    done = ok = 0
    with ThreadPoolExecutor(max_workers=workers) as exx:
        futs = {exx.submit(process, t): t for t in targets}
        for fu in as_completed(futs):
            try:
                if fu.result() > 0:
                    ok += 1
            except Exception:
                pass
            done += 1
            if done % 50 == 0:
                print(f"  {done}/{len(targets)} | trimestriel+:{ok}", flush=True)
    print(f"FINI: {done} traitees, {ok} avec trimestriel")


if __name__ == "__main__":
    main()
