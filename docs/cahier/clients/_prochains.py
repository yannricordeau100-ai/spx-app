#!/usr/bin/env python3
"""Prochains lots clients a lancer (reutilise les lots de donnees/_lots).
Usage : python3 docs/cahier/clients/_prochains.py --prochains N
"""
import argparse, glob, json, os

ROOT = os.path.dirname(os.path.abspath(__file__))
LOTS = os.path.join(ROOT, "..", "donnees", "_lots")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prochains", type=int, default=3)
    a = ap.parse_args()
    faits = {os.path.basename(p)[:-5] for p in glob.glob(os.path.join(ROOT, "[A-Z0-9]*.json"))}
    total = 0
    restants = []
    for lp in sorted(glob.glob(os.path.join(LOTS, "*.json"))):
        lot = os.path.basename(lp)[:-5]
        tickers = json.load(open(lp))
        if isinstance(tickers, dict):
            tickers = tickers.get("tickers")
        tickers = [t["ticker"] if isinstance(t, dict) else t for t in tickers]
        total += len(tickers)
        manq = [t for t in tickers if t not in faits]
        if manq:
            restants.append((lot, manq))
    print(f"CLIENTS : societes faites {len(faits)} / {total} | lots restants {len(restants)}")
    for lot, manq in restants[: a.prochains]:
        print(f"LOT {lot} restants {manq}")


if __name__ == "__main__":
    main()
