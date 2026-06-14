#!/usr/bin/env python3
"""digest-eser.py — pour chaque sté résidu (sans kpis_wow), extrait les
fragments porteurs de chiffres (KPI candidats) en gardant l'en-tête de doc
(= attribution trimestre). Sortie data-lake/<t>/_digest.txt (~1.4K chars).
Permet de lire ~15 stés/tour pour extraction Opus rapide."""
import os, re, glob

KW = re.compile(r"(revenue|sales|orders|backlog|volume|subscriber|member|segment|growth|grew|increase|deliver|RPO|booking|premium|loan|deposit|AUM|ratio|comparable|unit|ARPU|production|capacity|net add|paid|cloud|data center|\bAI\b|occupancy|same-store|attach|churn|active|monetiz|gross merchandise|GMV|store|warehouse|client|customer|tonn|barrel|MW|GW)", re.I)
NUM = re.compile(r"\$[\d.,]+|\d+(\.\d+)?\s*%|\d+(\.\d+)?\s*(billion|million|bn|B\b)")

def digest(txt):
    parts = re.split(r"(=== \[[^\]]+\][^\n]*===)", txt)
    out = []
    i = 1
    while i < len(parts):
        header = parts[i].strip()
        body = parts[i + 1] if i + 1 < len(parts) else ""
        frags = []
        seen = set()
        for f in re.split(r"(?<=[.;])\s+|•|•|·", body):
            f = re.sub(r"\s+", " ", f).strip()
            key = f[:40]
            if 12 < len(f) < 230 and NUM.search(f) and KW.search(f) and key not in seen:
                frags.append(f); seen.add(key)
            if sum(len(x) for x in frags) > 550:
                break
        if frags:
            out.append(header + "\n" + " | ".join(frags))
        i += 2
    return "\n".join(out)[:1400]

residual = [f.split("/")[1] for f in glob.glob("data-lake/*/_srctext.txt")
            if not os.path.exists("data-lake/" + f.split("/")[1] + "/kpis_wow/extracted.json")]
n = 0
for t in residual:
    d = digest(open(f"data-lake/{t}/_srctext.txt").read())
    if len(d) > 50:
        open(f"data-lake/{t}/_digest.txt", "w").write(d); n += 1
print(f"digests écrits: {n}/{len(residual)}")
