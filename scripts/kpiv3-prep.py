#!/usr/bin/env python3
"""
kpiv3-prep.py — pre-extraction XBRL compacte pour la chaine KPI v3.

But : economiser les tokens des sub-agents. Au lieu que chaque agent explore
companyfacts.json (3 a 50 Mo) a coups de greps et de lectures partielles, ce
script sort UN fichier TSV dense contenant deja toutes les series
trimestrielles reconstruites, T4 derive inclus (T4 = FY moins cumul 9 mois).

Aucune invention : uniquement des faits tagues par la societe elle-meme.

Usage :
    python3 scripts/kpiv3-prep.py TICKER [--min-points 6] [--out /tmp/kpiv3-TICKER/xbrl.tsv]

Sortie TSV : tag<TAB>unite<TAB>periode<TAB>valeur<TAB>source
  periode = "T1 2025" ... ; source = "reported" ou "derived_Q4"
"""
import json
import os
import sys
import urllib.request
from collections import defaultdict

UA = "Mettrik research yannricordeau100@gmail.com"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_facts(ticker: str) -> dict:
    """companyfacts local si present, sinon EDGAR (et on sauvegarde au lake)."""
    lake = os.path.join(ROOT, "data-lake", ticker, "xbrl", "companyfacts.json")
    if os.path.exists(lake):
        with open(lake) as fh:
            return json.load(fh)
    cik = resolve_cik(ticker)
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"
    os.makedirs(os.path.dirname(lake), exist_ok=True)
    data = fetch_json(url, lake)
    return data


def fetch_json(url: str, save_to: str | None = None) -> dict:
    """urllib puis repli curl : les certificats systeme font echouer urllib
    sur certains Mac (constate 26 juil 2026 sur KDP)."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=90) as resp:
            raw = resp.read().decode()
    except Exception:
        import subprocess

        raw = subprocess.run(
            ["curl", "-sS", "--compressed", "-H", f"User-Agent: {UA}", url],
            capture_output=True, text=True, timeout=180,
        ).stdout
        if not raw.strip():
            raise SystemExit(f"telechargement impossible : {url}")
    data = json.loads(raw)
    if save_to:
        with open(save_to, "w") as fh:
            json.dump(data, fh)
    return data


def resolve_cik(ticker: str) -> int:
    path = os.path.join(ROOT, "data-lake", "_meta", "company_tickers.json")
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        data = fetch_json("https://www.sec.gov/files/company_tickers.json", path)
    else:
        with open(path) as fh:
            data = json.load(fh)
    want = ticker.replace("-", "").replace(".", "").upper()
    for row in data.values():
        if row["ticker"].replace("-", "").replace(".", "").upper() == want:
            return int(row["cik_str"])
    raise SystemExit(f"CIK introuvable pour {ticker}")


def quarter_label(end: str) -> str:
    y, m = int(end[:4]), int(end[5:7])
    return f"T{(m - 1) // 3 + 1} {y}"


def span_days(start: str, end: str) -> int:
    from datetime import date

    a = date(int(start[:4]), int(start[5:7]), int(start[8:10]))
    b = date(int(end[:4]), int(end[5:7]), int(end[8:10]))
    return (b - a).days


def collect(facts: dict, min_points: int):
    """Retourne {(tag, unit): {periode: (valeur, source)}}."""
    out = {}
    for taxo, tags in facts.get("facts", {}).items():
        if taxo not in ("us-gaap", "ifrs-full", "dei"):
            continue
        for tag, body in tags.items():
            for unit, rows in body.get("units", {}).items():
                # instant (bilan) : une valeur par date de cloture.
                # duree : on groupe les cumuls par date de DEBUT, car les
                # cumuls YTD d'un meme exercice partagent le meme start.
                # Ca gere aussi les exercices fiscaux decales.
                inst = {}
                ytd = defaultdict(dict)  # start -> {mois_cumules: (end, val)}
                for r in rows:
                    end, val, start = r.get("end"), r.get("val"), r.get("start")
                    if end is None or val is None:
                        continue
                    if start is None:
                        inst[end] = val
                        continue
                    d = span_days(start, end)
                    if d <= 100:
                        ytd[start][3] = (end, val)
                    elif d <= 200:
                        ytd[start][6] = (end, val)
                    elif d <= 290:
                        ytd[start][9] = (end, val)
                    elif d <= 400:
                        ytd[start][12] = (end, val)

                series = {}
                if inst:
                    for end, val in inst.items():
                        series[quarter_label(end)] = (val, "reported")
                else:
                    # 1. trimestres publies tels quels
                    for start, spans in ytd.items():
                        if 3 in spans:
                            end, val = spans[3]
                            series[quarter_label(end)] = (val, "reported")
                    # 2. differences de cumuls YTD : T2 = 6M-3M, T3 = 9M-6M,
                    #    T4 = FY-9M. Methode standard de la mission.
                    for start, spans in ytd.items():
                        for cur, prev in ((6, 3), (9, 6), (12, 9)):
                            if cur not in spans or prev not in spans:
                                continue
                            end, val = spans[cur]
                            lab = quarter_label(end)
                            if lab in series:
                                continue
                            series[lab] = (
                                round(val - spans[prev][1], 4),
                                f"derived_{cur}M_moins_{prev}M",
                            )

                if len(series) >= min_points:
                    out[(tag, unit)] = series
    return out


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    ticker = sys.argv[1].upper()
    min_points = 6
    out_path = f"/tmp/kpiv3-{ticker}/xbrl.tsv"
    args = sys.argv[2:]
    for i, a in enumerate(args):
        if a == "--min-points":
            min_points = int(args[i + 1])
        elif a == "--out":
            out_path = args[i + 1]

    facts = load_facts(ticker)
    data = collect(facts, min_points)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    def qkey(lab):
        t, y = lab.split(" ")
        return (int(y), int(t[1]))

    n = 0
    index = []
    with open(out_path, "w") as fh:
        fh.write("tag\tunite\tperiode\tvaleur\tsource\n")
        for (tag, unit), series in sorted(data.items()):
            labs = sorted(series, key=qkey)
            for lab in labs:
                val, src = series[lab]
                fh.write(f"{tag}\t{unit}\t{lab}\t{val}\t{src}\n")
                n += 1
            last = labs[-1]
            index.append((tag, unit, len(labs), labs[0], last, series[last][0]))

    idx_path = os.path.join(os.path.dirname(out_path), "xbrl-index.tsv")
    with open(idx_path, "w") as fh:
        fh.write("tag\tunite\tnb_points\tdebut\tfin\tderniere_valeur\n")
        for row in sorted(index, key=lambda r: -r[2]):
            fh.write("\t".join(str(x) for x in row) + "\n")

    print(f"{ticker}: {len(data)} series, {n} points")
    print(f"  index (a lire en entier) : {idx_path}")
    print(f"  detail (a grepper par tag) : {out_path}")


if __name__ == "__main__":
    main()
