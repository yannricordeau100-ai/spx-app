#!/usr/bin/env python3
"""Tableau des KPI RSE de niveau investisseur (test RSE, Yann 24 sept 2026).
Lit /tmp/rse/<T>.json (dernier exercice) et ne garde que les indicateurs qui
comptent pour un investisseur : emissions et intensite carbone, energie et part
renouvelable, eau, dechets et recyclage, securite (taux d accidents), effectifs
et rotation, femmes dans l encadrement, formation, independance du conseil,
ecart de remuneration, fournisseurs audites. Sortie : tableau Markdown."""
import json, os, re, sys, unicodedata
MOTIFS = [
 ('Climat', r'scope ?[123]|ghg|gaz a effet de serre|co2|carbon|emission'),
 ('Energie', r'energ|renouvelable|electricit|kwh|mwh|gwh|twh'),
 ('Eau', r'\beau\b|water|m3'),
 ('Dechets', r'dechet|waste|recycl|circulaire'),
 ('Securite', r'accident|ltif|ltir|trir|securite|safety|deces|fatal|blessure|injur'),
 ('Effectifs', r'effectif|salarie|employe|headcount|rotation|turnover|attrition'),
 ('Diversite', r'femme|women|female|parite|diversit|genre|gender'),
 ('Formation', r'formation|training|heures'),
 ('Gouvernance', r'conseil|board|independ|administrateur|remuneration|ratio de remuneration|pay ratio'),
 ('Fournisseurs', r'fournisseur|supplier|audit'),
]
def norm(s): return unicodedata.normalize('NFKD', (s or '').lower()).encode('ascii', 'ignore').decode()
def theme_de(nom):
    n = norm(nom)
    for th, rx in MOTIFS:
        if re.search(rx, n): return th
    return None
for t in sys.argv[1:]:
    p = f'/tmp/rse/{t}.json'
    if not os.path.exists(p): print(t, 'absent'); continue
    d = json.load(open(p)); annees = sorted(int(a) for a in d); rec = d[str(annees[-1])]['kpis']; anc = d[str(annees[0])]['kpis']
    lignes = []
    for cle, k in rec.items():
        th = theme_de(k['nom'])
        if not th: continue
        # meme cle presente dans l exercice ancien ?
        av = anc.get(cle)
        lignes.append((th, k['nom'], k['valeur'], k.get('unite') or '', (av['valeur'] if av else '')))
    lignes.sort(key=lambda x: (x[0], x[1]))
    print(f"\n### {t} : {len(lignes)} KPI de niveau investisseur sur {len(rec)} extraits ({annees[-1]}), {sum(1 for l in lignes if l[4])} deja presents en {annees[0]} sous le meme libelle\n")
    print(f"| Theme | Indicateur | Valeur {annees[-1]} | Unite | Valeur {annees[0]} |"); print('|---|---|---|---|---|')
    for l in lignes[:60]: print(f"| {l[0]} | {l[1][:60]} | {l[2][:25]} | {l[3][:14]} | {l[4][:25]} |")
