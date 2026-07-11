#!/usr/bin/env python3
"""Valide une (ou toutes les) synthèse(s) Earning Call générée(s).

Usage : python3 scripts/ts-sp500-validate.py TICKER [TICKER...]
        python3 scripts/ts-sp500-validate.py --all-new   (tous les status=gen du state)
Affiche 'OK <ticker>' ou 'FAIL <ticker>: raisons'. Exit 1 si au moins un FAIL.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SUMM = ROOT / "src/data/transcript-summaries"
BULLET_TYPES = {"synthesis", "tonalite", "driver", "vigilance", "guidance", "strategy", "citation"}
SENTIMENTS = {"bullish", "neutral", "cautious"}

def check(ticker: str):
    errs = []
    f = SUMM / f"{ticker.lower()}.json"
    if not f.exists():
        return [f"fichier absent {f.name}"]
    try:
        d = json.load(open(f))
    except Exception as e:
        return [f"JSON invalide: {e}"]
    if d.get("ticker") != ticker.upper():
        errs.append(f"ticker={d.get('ticker')}")
    if not re.match(r"^20\d\dQ[1-4]$", d.get("quarter", "")):
        errs.append(f"quarter={d.get('quarter')}")
    s = d.get("summary") or {}
    if s.get("sentiment") not in SENTIMENTS:
        errs.append(f"sentiment={s.get('sentiment')}")
    ton = s.get("tonalite_management") or ""
    if not (30 <= len(ton) <= 300):
        errs.append(f"tonalite len={len(ton)}")
    bullets = s.get("bullets") or []
    if not (6 <= len(bullets) <= 12):
        errs.append(f"nb bullets={len(bullets)}")
    types_seen = set()
    for i, b in enumerate(bullets):
        t = b.get("type")
        types_seen.add(t)
        if t not in BULLET_TYPES:
            errs.append(f"bullet{i} type={t}")
        txt = b.get("text") or ""
        if not (40 <= len(txt) <= 300):
            errs.append(f"bullet{i} len={len(txt)}")
    for needed in ("synthesis", "guidance"):
        if needed not in types_seen:
            errs.append(f"manque bullet type={needed}")
    blob = json.dumps(d, ensure_ascii=False)
    if "—" in blob:
        errs.append("em-dash present")
    if re.search(r"\d\.\d", ton + " ".join((b.get("text") or "") for b in bullets)):
        # décimales anglaises probables (non bloquant si version/valeur technique)
        errs.append("decimales avec point (verifier virgule francaise)")
    if "comparison" in d:
        errs.append("comparison present (interdit sur ce chantier)")
    return errs

def main():
    args = sys.argv[1:]
    if not args:
        sys.exit("usage: ts-sp500-validate.py TICKER... | --all-new")
    if args == ["--all-new"]:
        state = json.load(open(ROOT / ".conv-state/ts-summ-state.json"))
        args = [t for t, v in state["tickers"].items() if v.get("status") == "gen"]
    bad = 0
    for t in args:
        errs = check(t)
        if errs:
            bad += 1
            print(f"FAIL {t}: " + "; ".join(errs))
        else:
            print(f"OK {t}")
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    main()
