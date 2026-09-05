#!/usr/bin/env python3
"""Met a jour la ligne 'Derniere mise a jour' du handoff (compteurs calcules sur les fichiers)."""
import re, glob, os, json, datetime, subprocess
R = os.path.dirname(os.path.abspath(__file__))
n = len(glob.glob(os.path.join(R, "[A-Z]*.json")))
faits = {json.load(open(f))["ticker"] for f in glob.glob(os.path.join(R, "[A-Z]*.json"))}
ORDRE = ["45", "20", "40", "35", "25", "30", "15", "55", "60", "50", "10"]
NOMS = {"45": "Technologie", "20": "Industrie", "40": "Finance", "35": "Santé", "25": "Consommation discrétionnaire", "30": "Consommation de base", "15": "Matériaux", "55": "Collectivités", "60": "Immobilier", "50": "Communication", "10": "Énergie"}
parts = []
for sec in ORDRE:
    tk = [r["ticker"] for f in glob.glob(os.path.join(R, "_lots", sec + "-*.json")) for r in json.load(open(f))]
    ok = sum(1 for t in tk if t in faits)
    if ok: parts.append(f"{NOMS[sec]} ({sec}) : {ok} / {len(tk)}" + (" terminée" if ok == len(tk) else " en cours"))
ligne = f"Dernière mise à jour : {datetime.datetime.now().strftime('%d/%m/%Y %H:%M')}. Sociétés faites : {n} / 666. " + " ; ".join(parts) + ". Contre-vérification : technologie lancée le 05/09 19h15 (livrable `donnees/_VERIFICATION-45.md`). Ordre des secteurs : 45, 20, 40, 35, 25, 30, 15, 55, 60, 50, 10.\n"
p = os.path.join(R, "..", "HANDOFF-DONNEES-KPI.md"); s = open(p).read()
s = re.sub(r"Dernière mise à jour : .*?\n", ligne, s, count=1); open(p, "w").write(s)
print(ligne.strip()[:160])
