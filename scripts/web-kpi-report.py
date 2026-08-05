#!/usr/bin/env python3
"""Compile les fiches .conv-state/web-kpi/<T>.json en tableaux markdown.

Usage : python3 scripts/web-kpi-report.py [cac|smi|all]
Sortie : .conv-state/web-kpi-rapport.md
"""
import json, glob, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / ".conv-state/web-kpi"
OUT = ROOT / ".conv-state/web-kpi-rapport.md"

CAC = ["AC.PA","AI.PA","AIR.PA","MT.AS","CS.PA","BNP.PA","EN.PA","BVI.PA","CAP.PA","CA.PA",
       "ACA.PA","BN.PA","DSY.PA","FGR.PA","ENGI.PA","EL.PA","ERF.PA","ENX.PA","RMS.PA","KER.PA",
       "LR.PA","OR.PA","MC.PA","ML.PA","ORA.PA","RI.PA","PUB.PA","RNO.PA","SAF.PA","SGO.PA",
       "SAN.PA","SU.PA","GLE.PA","STLAP.PA","STMPA.PA","HO.PA","TTE.PA","URW.PA","VIE.PA","DG.PA"]
SMI = ["ABBN.SW","ALC.SW","AMRZ.SW","GEBN.SW","GIVN.SW","HOLN.SW","KNIN.SW","LOGN.SW","LONN.SW",
       "NESN.SW","NOVN.SW","PGHN.SW","CFR.SW","ROG.SW","SIKA.SW","SLHN.SW","SREN.SW","SCMN.SW",
       "UBSG.SW","ZURN.SW"]


def load(t):
    p = SRC / f"{t}.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except Exception as e:
        return {"ticker": t, "nom": t, "kpis": [], "particularite": f"FICHIER ILLISIBLE: {e}",
                "pages_visitees": 0, "blocage": "erreur"}


def fmt_kpi(k):
    v = k.get("value")
    if isinstance(v, float) and v == int(v):
        v = int(v)
    u = k.get("unit") or ""
    per = k.get("periode") or "?"
    return f"{k.get('label_fr','?')} : {v} {u}".strip() + f" ({per})"


def section(title, tickers):
    rows, detail = [], []
    tot = new = 0
    for t in tickers:
        d = load(t)
        if d is None:
            rows.append(f"| {t} | (en cours) | | | |")
            continue
        ks = d.get("kpis", [])
        n = len(ks)
        m = sum(1 for k in ks if not k.get("already_known"))
        tot += n; new += m
        blk = d.get("blocage")
        part = (d.get("particularite") or "").replace("|", "/")
        if blk:
            part = f"[{blk}] {part}"
        rows.append(f"| {d.get('nom', t)} ({t}) | {n} | {m} | {d.get('pages_visitees', '?')} | {part} |")
        if ks:
            detail.append(f"\n**{d.get('nom', t)}**\n")
            for k in ks:
                mark = "" if not k.get("already_known") else " _(déjà connu)_"
                detail.append(f"- {fmt_kpi(k)}{mark}")
    head = (f"\n## {title}\n\n"
            f"| Société | KPI | Nouveaux | Pages | Particularité |\n|---|---|---|---|---|\n")
    tail = f"| **Total** | **{tot}** | **{new}** | | |\n"
    return head + "\n".join(rows) + "\n" + tail + "\n### Détail des KPI\n" + "\n".join(detail) + "\n"


scope = (sys.argv[1] if len(sys.argv) > 1 else "all").lower()
parts = ["# Prospection KPI sites web (relevé 2026)\n"]
if scope in ("cac", "all"):
    parts.append(section("CAC 40", CAC))
if scope in ("smi", "all"):
    parts.append(section("SMI 20 (Suisse)", SMI))
OUT.write_text("\n".join(parts))
print(f"Écrit : {OUT}")
print(f"Fiches présentes : {len(list(SRC.glob('*.json')))}/60")
