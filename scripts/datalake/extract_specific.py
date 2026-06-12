#!/usr/bin/env python3
"""
extract_specific.py - Couche 0-token : KPIs SPECIFIQUES (segments/produits/geo)
depuis le 10-K + gouvernance (remu CEO + actionnariat) depuis la DEF 14A.
100% deterministe (BeautifulSoup), VERBATIM, 0 hallucination, 0 token, resumable.
Ecrit data-lake/<T>/kpis/extracted.json + governance/extracted.json
(schemas attendus par ingest_drafts.py).

Usage:
  python3 extract_specific.py AAPL JPM CAT --test    # 3 stes, verbeux
  python3 extract_specific.py --workers 10            # tout le scope non traite
"""
import json, os, re, subprocess, sys, glob, gzip, warnings
from concurrent.futures import ThreadPoolExecutor, as_completed
warnings.filterwarnings("ignore")

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LAKE = os.path.join(ROOT, "data-lake")
UA = "Mettrik research contact@mettrik.ai"

try:
    from bs4 import BeautifulSoup
except ImportError:
    sys.exit("pip install beautifulsoup4")


def curl(u, t=60):
    try:
        return subprocess.run(["/usr/bin/curl", "-s", "-A", UA, "--max-time", str(t), u],
                              capture_output=True, text=True, timeout=t + 15).stdout
    except Exception:
        return ""


def ticker_cik_map():
    try:
        j = json.loads(curl("https://www.sec.gov/files/company_tickers.json"))
        return {v["ticker"]: str(v["cik_str"]).zfill(10) for v in j.values()}
    except Exception:
        return {}


def latest_filing(cik, form):
    try:
        s = json.loads(curl(f"https://data.sec.gov/submissions/CIK{cik}.json"))
    except Exception:
        return None, None, None
    r = s.get("filings", {}).get("recent", {})
    forms = r.get("form", [])
    for i, f in enumerate(forms):
        if f == form:
            accn = r["accessionNumber"][i].replace("-", "")
            doc = r["primaryDocument"][i]
            rep = r.get("reportDate", [None] * len(forms))[i]
            return f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accn}/{doc}", r["accessionNumber"][i], rep
    return None, None, None


TOTAL_RX = re.compile(r'^total (net sales|revenues?|sales and revenues|net revenue|sales|consolidated)', re.I)
VAL_RX = re.compile(r'^\(?\$?\s*[\d,]+(\.\d+)?\)?$')
SKIP_LABEL = ("total", "net sales", "revenue", "three months", "year ended", "fiscal",
              "twelve months", "for the", "in millions", "millions of", "(in", "(millions",
              "(dollars", "external sales", "inter-segment", "intersegment", "eliminations",
              "corporate", "reconciling", "unallocated", "subtotal", "sub-total", "consolidated")


def is_val(c):
    cc = c.replace(" ", "")
    if not VAL_RX.match(cc):
        return False
    n = cc.replace("$", "").replace("(", "-").replace(")", "").replace(",", "")
    try:
        v = abs(float(n))
    except Exception:
        return False
    return ("," in cc) or v >= 100  # exclut les colonnes YoY % (petits entiers sans virgule)


def to_num(c):
    n = c.replace("$", "").replace(" ", "").replace("(", "-").replace(")", "").replace(",", "")
    return float(n)


def years_from(rep):
    if not rep or len(rep) != 10:
        return [None] * 5
    y, m, d = rep.split("-")
    return [f"{int(y)-k}-{m}-{d}" for k in range(5)]


def local_html(ticker, subdir):
    """Lit le doc local le plus récent (archive Mac), gunzip si besoin. 0 reseau."""
    files = []
    for p in (f"sec-data/{subdir}/*/{ticker}_*.htm.gz", f"sec-data/{subdir}/*/{ticker}_*.htm"):
        files += glob.glob(os.path.join(ROOT, p))
    if not files:
        return None, None, None
    f = sorted(files)[-1]
    try:
        html = gzip.open(f, "rt", errors="ignore").read() if f.endswith(".gz") else open(f, errors="ignore").read()
    except Exception:
        return None, None, None
    base = os.path.basename(f)
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})", base)
    rep = None
    if m:
        y, mo = int(m.group(1)), int(m.group(2))
        fy = y - 1 if mo <= 4 else y  # 10-K depose janv-avril couvre l'exercice precedent
        rep = f"{fy}-12-31"
    return html, f"local:{base}", rep


def extract_segments(ticker, cik):
    html, accn, rep = local_html(ticker, "cat1-us/10K")
    if not html:
        url, accn, rep = latest_filing(cik, "10-K")
        if not url:
            return None
        html = curl(url, 70)
    if not html or len(html) < 5000:
        return None
    soup = BeautifulSoup(html, "lxml")
    yrs = years_from(rep)
    kpis, seen = [], set()
    for table in soup.find_all("table"):
        rows = []
        for tr in table.find_all("tr"):
            cells = [td.get_text(" ", strip=True).replace("\xa0", " ") for td in tr.find_all(["td", "th"])]
            cells = [c for c in cells if c not in ("", "$", "%")]
            if cells:
                rows.append(cells)
        tot_idx = next((i for i, r in enumerate(rows) if r and TOTAL_RX.match(r[0])), None)
        if tot_idx is None or tot_idx < 2 or tot_idx > 14:
            continue
        comps = []
        for r in rows[:tot_idx]:
            if len(r) < 3:
                continue
            label = r[0].strip()
            if not label or label[0].isdigit() or len(label) < 3 or label.startswith("("):
                continue
            ll = label.lower()
            if ll.startswith(SKIP_LABEL) or "dollars)" in ll or "in millions" in ll or "in thousands" in ll:
                continue
            # exclut les tableaux de VARIATION / bridge (pas des segments)
            if (ll.endswith(", net") or "/(" in ll or any(s in ll for s in (
                    "growth from", "growth in", "declines", "decline", "increase in",
                    "decrease", "favorable", "unfavorable", "impact of", "due to",
                    "net of", "change in", "operational", "foreign exchange", "currency"))):
                continue
            vals = [c for c in r[1:] if is_val(c)]
            if len(vals) >= 2:
                comps.append((label, vals[:3]))
        if not (2 <= len(comps) <= 12):
            continue
        for label, vals in comps:
            key = re.sub(r'\s+', ' ', label.lower()).strip()
            if key in seen:
                continue
            seen.add(key)
            hist = []
            for k, v in enumerate(vals):
                try:
                    num = to_num(v)
                except Exception:
                    continue
                hist.append({"period_end": yrs[k] if k < len(yrs) else None,
                             "value": num, "accession": accn, "quote": v})
            if len(hist) >= 2 and not all(1990 <= h["value"] <= 2035 for h in hist):
                kpis.append({"short": label[:40], "name_fr": label[:70], "unit": "M $",
                             "period_type": "year", "history": hist})
    if not kpis:
        return None
    return {"kpis": kpis, "_extracted_by": "deterministic-bs4-10k", "_accession": accn}


PCT_RX = re.compile(r'(\d{1,2}(\.\d+)?)\s*%')


def extract_gov(ticker, cik):
    html, accn, rep = local_html(ticker, "cat1-us/DEF14A")
    if not html:
        url, accn, rep = latest_filing(cik, "DEF 14A")
        if not url:
            return None
        html = curl(url, 70)
    if not html or len(html) < 5000:
        return None
    soup = BeautifulSoup(html, "lxml")
    gov, cites = {}, []
    # actionnariat : table "beneficial ownership" -> noms + % (>=5% = 5% holders)
    for table in soup.find_all("table"):
        ttxt = table.get_text(" ", strip=True).lower()
        if "beneficial" not in ttxt or "%" not in table.get_text():
            continue
        holders = []
        for tr in table.find_all("tr"):
            cells = [td.get_text(" ", strip=True) for td in tr.find_all(["td", "th"])]
            if len(cells) < 2:
                continue
            name = re.split(r'\s+\d', cells[0].strip())[0].strip()  # coupe l'adresse parasite
            pct = None
            for c in cells[1:]:
                mm = PCT_RX.search(c)
                if mm:
                    pct = float(mm.group(1))
                    break
            if (name and pct is not None and 5.0 <= pct <= 100 and len(name) > 4
                    and not name[0].isdigit() and "%" not in name):
                holders.append({"name": name[:60], "pct": pct})
        if holders:
            gov["top_holders"] = holders[:8]
            cites.append({"field": "top_holders", "accession": accn, "quote": "Security Ownership table"})
            break
    if not gov:
        return None
    return {"governance": gov, "citations": cites, "_extracted_by": "deterministic-bs4-def14a"}


def process(ticker, cik, do_gov=True, verbose=False):
    kfile = os.path.join(LAKE, ticker, "kpis", "extracted.json")
    gfile = os.path.join(LAKE, ticker, "governance", "extracted.json")
    res = {"ticker": ticker, "seg": 0, "gov": 0}
    # segments (skip si deja present)
    if not os.path.exists(kfile):
        seg = extract_segments(ticker, cik)
        if seg:
            seg["ticker"] = ticker
            os.makedirs(os.path.dirname(kfile), exist_ok=True)
            json.dump(seg, open(kfile, "w"), ensure_ascii=False, indent=1)
            res["seg"] = len(seg["kpis"])
    else:
        res["seg"] = -1  # deja fait
    # gouvernance (skip si deja present)
    if do_gov and not os.path.exists(gfile):
        gov = extract_gov(ticker, cik)
        if gov:
            gov["ticker"] = ticker
            os.makedirs(os.path.dirname(gfile), exist_ok=True)
            json.dump(gov, open(gfile, "w"), ensure_ascii=False, indent=1)
            res["gov"] = len(gov["governance"].get("top_holders", []))
    if verbose:
        print(f"  {ticker:8s} segments={res['seg']} holders={res['gov']}")
        if res["seg"] > 0:
            for k in seg["kpis"][:8]:
                print(f"      KPI {k['short'][:34]:34s} {[h['value'] for h in k['history']]}")
        if res["gov"] > 0:
            for h in gov["governance"]["top_holders"][:5]:
                print(f"      holder {h['name'][:40]:40s} {h['pct']}%")
    return res


def load_scope():
    for p in ["src/data/v1-9-5-clean-all-tickers.json", "src/data/v195-clean-all.json",
              "src/data/sp500-tickers.json"]:
        fp = os.path.join(ROOT, p)
        if os.path.exists(fp):
            d = json.load(open(fp))
            if isinstance(d, dict):
                items = d.get("tickers") or d.get("clean_all") or list(d.keys())
            else:
                items = d
            out = [(t if isinstance(t, str) else t.get("ticker")) for t in items if isinstance(t, (str, dict))]
            return [t for t in out if t], p
    return [], None


def main():
    args = sys.argv[1:]
    test = "--test" in args
    workers = 10
    if "--workers" in args:
        workers = int(args[args.index("--workers") + 1])
    explicit = [a for a in args if not a.startswith("--") and a not in (str(workers),)]
    cmap = ticker_cik_map()
    if not cmap:
        sys.exit("echec map ticker->CIK SEC")
    if explicit:
        targets = [(t, cmap[t]) for t in explicit if t in cmap]
    else:
        scope, src = load_scope()
        print(f"scope: {len(scope)} stes ({src})")
        # resumable : ne garde que celles sans fichier kpis ET sans fichier gov
        targets = []
        for t in scope:
            if not t or t not in cmap:
                continue
            kf = os.path.join(LAKE, t, "kpis", "extracted.json")
            gf = os.path.join(LAKE, t, "governance", "extracted.json")
            if os.path.exists(kf) and os.path.exists(gf):
                continue
            targets.append((t, cmap[t]))
        print(f"a traiter (non faites): {len(targets)}")
    seg_ok = gov_ok = done = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(process, t, c, True, test): t for t, c in targets}
        for f in as_completed(futs):
            try:
                r = f.result()
                if r["seg"] > 0:
                    seg_ok += 1
                if r["gov"] > 0:
                    gov_ok += 1
            except Exception:
                pass
            done += 1
            if not test and done % 25 == 0:
                print(f"  {done}/{len(targets)} | segments+:{seg_ok} gov+:{gov_ok}", flush=True)
    print(f"FINI: {done} traitees, {seg_ok} avec segments, {gov_ok} avec actionnariat")


if __name__ == "__main__":
    main()
