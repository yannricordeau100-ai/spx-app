#!/usr/bin/env python3
"""Validation des fichiers concentration clients (07 sept 2026).
Usage : python3 docs/cahier/clients/_valide.py TICKER [TICKER...]
Affiche : OK n  problemes m
"""
import json, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))


def pct_ok(v):
    return v is None or v == "<1" or isinstance(v, (int, float))


def valide(t):
    pb = []
    p = os.path.join(ROOT, f"{t}.json")
    if not os.path.exists(p):
        return [f"{t} : fichier absent"]
    try:
        d = json.load(open(p))
    except Exception as e:
        return [f"{t} : JSON invalide ({e})"]
    raw = open(p).read()
    if "—" in raw:
        pb.append(f"{t} : tiret long")
    if d.get("ticker") != t:
        pb.append(f"{t} : champ ticker {d.get('ticker')!r}")
    top = d.get("top")
    if not isinstance(top, dict):
        pb.append(f"{t} : bloc top manquant")
    else:
        if not (isinstance(top.get("n"), int) and 1 <= top["n"] <= 3):
            pb.append(f"{t} : top.n invalide ({top.get('n')})")
        if not pct_ok(top.get("pct")):
            pb.append(f"{t} : top.pct invalide")
        if top.get("pct") is not None and not (top.get("source") or {}).get("url") and not d.get("diffus"):
            pb.append(f"{t} : top.pct sans source")
    t10 = d.get("top10")
    if t10 is not None:
        if not isinstance(t10, dict):
            pb.append(f"{t} : top10 invalide")
        else:
            if not (isinstance(t10.get("n"), int) and 6 <= t10["n"] <= 10):
                pb.append(f"{t} : top10.n invalide ({t10.get('n')})")
            if not pct_ok(t10.get("pct")):
                pb.append(f"{t} : top10.pct invalide")
            if t10.get("pct") is not None and not (t10.get("source") or {}).get("url"):
                pb.append(f"{t} : top10.pct sans source")
    return pb


def main():
    tickers = sys.argv[1:]
    pbs = []
    ok = 0
    for t in tickers:
        r = valide(t)
        if r:
            pbs.extend(r)
        else:
            ok += 1
    for x in pbs:
        print(x)
    print(f"OK {ok}  problemes {len(pbs)}")
    sys.exit(1 if pbs else 0)


if __name__ == "__main__":
    main()
