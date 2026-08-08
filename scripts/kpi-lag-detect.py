#!/usr/bin/env python3
"""Détecteur de retard d'intégration KPI, correct sur les exercices décalés.

Yann 8 août 2026, après le cas V (Visa) : le 10-Q du 29 juillet (trimestre clos
30 juin 2026) était au data-lake mais les séries s'arrêtaient à Q2-FY2026
(clos 31 mars). L'ancien détecteur mappait les trimestres FISCAUX sur le
calendrier CIVIL, donc les stés à exercice décalé passaient sous le radar.

Méthode :
 1. Calendrier fiscal par sté : src/data/fiscal-audit.json, sinon parse du
    dernier 10-K local ("fiscal year ended <date>").
 2. Période couverte par le dernier filing local : parse "period ended <date>"
    dans les 200 premiers Ko du 10-Q/10-K le plus récent.
 3. Clôture réelle du dernier point intégré : label Qn-FY?yyyy -> date via le
    calendrier fiscal.
 4. Retard si (2) > (3) + 5 jours.

Sortie : JSON {ticker: {last_label, last_close, filing_period_end, filing}} sur
stdout + resume stderr.
"""
import json, glob, gzip, os, re, sys, datetime, calendar

ROOT = os.path.expanduser("~/spx-app")
KPIS = os.path.join(ROOT, ".batches-drafts-safe/kpis-haut")
LAKE = os.path.join(ROOT, "data-lake")

MONTHS = {m.lower(): i for i, m in enumerate(calendar.month_name) if m}
QLAB = re.compile(r"^Q\s*([1-4])\s*-?\s*(?:FY)?[\s-]*(\d{4})$", re.I)
PERIOD_RE = re.compile(
    r"period\s+ended\s*:?\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})", re.I)
FYE_RE = re.compile(
    r"fiscal\s+year\s+ended\s*:?\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})", re.I)

def month_end(y, m):
    return datetime.date(y, m, calendar.monthrange(y, m)[1])

def read_head_text(path, nbytes=400_000):
    try:
        with gzip.open(path, "rt", errors="ignore") as f:
            raw = f.read(nbytes)
    except Exception:
        return ""
    txt = re.sub(r"<[^>]*>", " ", raw)
    return re.sub(r"\s+", " ", txt)

def newest_filing(t):
    files = []
    for sub in ("10Q", "10K"):
        for p in glob.glob(f"{LAKE}/{t}/{sub}/*.gz"):
            m = re.search(r"(\d{4}-\d{2}-\d{2})", os.path.basename(p))
            if m:
                files.append((m.group(1), sub, p))
    if not files:
        return None
    return max(files)

def fiscal_year_end_month(t, audit):
    a = audit.get(t)
    if a and a.get("fiscalYearEndMonth"):
        return int(a["fiscalYearEndMonth"])
    ks = sorted(glob.glob(f"{LAKE}/{t}/10K/*.gz"))
    if ks:
        txt = read_head_text(ks[-1])
        m = FYE_RE.search(txt)
        if m and m.group(1).lower() in MONTHS:
            return MONTHS[m.group(1).lower()]
    return 12

def close_of_label(q, fy, fye_month):
    """Clôture réelle du trimestre fiscal q de l'exercice fy."""
    # fin d'exercice fy : month_end(fy, fye_month) si le label FY porte
    # l'année de clôture (convention de l'app).
    end = month_end(fy, fye_month)
    months_back = (4 - q) * 3
    m = fye_month - months_back
    y = fy
    while m <= 0:
        m += 12
        y -= 1
    return month_end(y, m)

def last_label_of_file(path):
    try:
        d = json.load(open(path))
    except Exception:
        return None
    best = None  # (fy, q, label)
    def walk(o):
        nonlocal best
        if isinstance(o, dict):
            h = o.get("history")
            if isinstance(h, list):
                for pt in h:
                    if isinstance(pt, dict):
                        m = QLAB.match(str(pt.get("q", "")).strip())
                        if m:
                            k = (int(m.group(2)), int(m.group(1)))
                            if best is None or k > best[:2]:
                                best = (k[0], k[1], str(pt.get("q")))
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    walk(d)
    return best

def main():
    audit = json.load(open(os.path.join(ROOT, "src/data/fiscal-audit.json")))
    lag = {}
    scanned = 0
    for f in sorted(glob.glob(f"{KPIS}/*.json")):
        t = os.path.basename(f)[:-5]
        if "." in t:  # EU (.PA/.SW) : autre cadence, hors scope de ce détecteur
            continue
        nf = newest_filing(t)
        if not nf:
            continue
        fdate, form, fpath = nf
        best = last_label_of_file(f)
        if not best:
            continue
        scanned += 1
        fy, q, label = best
        fye = fiscal_year_end_month(t, audit)
        # Deux conventions de nommage coexistent dans l'univers :
        #  - "clôture" : FY2026 = exercice qui se CLÔT en 2026 (AAPL, V)
        #  - "début"   : FY2026 = exercice qui COMMENCE en 2026 (KR, HD, DG...)
        # On teste les deux : si l'une colle à la période du dernier filing,
        # la sté est à jour (et la convention est calibrée au passage).
        c1 = close_of_label(q, fy, fye)        # convention clôture
        c2 = close_of_label(q, fy + 1, fye)    # convention début
        txt = read_head_text(fpath)
        pm = PERIOD_RE.search(txt) or FYE_RE.search(txt)
        if pm and pm.group(1).lower() in MONTHS:
            pend = datetime.date(int(pm.group(3)), MONTHS[pm.group(1).lower()],
                                 int(pm.group(2)))
        else:
            # fallback : un filing couvre une période close ~35 j avant dépôt
            fd = datetime.date(*map(int, fdate.split("-")))
            pend = fd - datetime.timedelta(days=35)
        d1, d2 = abs((pend - c1).days), abs((pend - c2).days)
        if d1 <= 40 or d2 <= 40:
            continue  # à jour (l'une des conventions colle)
        close = c2 if d2 < d1 else c1
        if (pend - close).days > 40:
            lag[t] = {
                "last_label": label, "fye_month": fye,
                "last_close": close.isoformat(),
                "filing_period_end": pend.isoformat(),
                "filing": os.path.relpath(fpath, ROOT), "form": form,
                "quarters_late": round((pend - close).days / 91, 1),
            }
    print(json.dumps(lag, indent=1))
    print(f"scanned={scanned} lagging={len(lag)}", file=sys.stderr)

if __name__ == "__main__":
    main()
