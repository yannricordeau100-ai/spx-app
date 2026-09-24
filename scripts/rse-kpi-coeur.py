#!/usr/bin/env python3
"""KPI RSE « coeur investisseur » : une ligne par indicateur canonique, valeur
du dernier exercice et du premier, choisie parmi les extractions (/tmp/rse).
Liste canonique fermee (pas de cibles, pas de parts d un total)."""
import json, os, re, sys, unicodedata
def norm(s): return unicodedata.normalize('NFKD', (s or '').lower()).encode('ascii', 'ignore').decode()
COEUR = [
 ('Emissions scope 1', r'scope ?1\b(?!.*(?:et|and|\+|,) ?2)', r'cible|objectif|target|reduction|part |%'),
 ('Emissions scope 1 et 2', r'scope ?1 ?(?:et|and|\+|,) ?2', r'cible|objectif|target|part |couvert|reduction'),
 ('Emissions scope 3', r'scope ?3', r'cible|objectif|target|part |couvert|reduction|categorie'),
 ('Intensite carbone', r'intensit.*(carbon|co2|ges|ghg)|(carbon|co2|ges|ghg).*intensit', r'cible|objectif|target'),
 ('Consommation d energie', r'consommation.*energ|energ.*consomm|energy consumption', r'cible|objectif|target|part '),
 ('Part d energie renouvelable', r'renouvelable|renewable', r'cible|objectif|target|2030|2040|2050'),
 ('Prelevement d eau', r'(prelevement|consommation|withdraw|consumption).*eau|water (withdraw|consumption)|eau prelev', r'cible|objectif|target'),
 ('Dechets generes', r'dechets? (total|gener|produit)|total waste|waste generated', r'cible|objectif|target|part '),
 ('Taux d accidents (LTIR ou TRIR)', r'ltir|trir|ltif|taux d.accident|accident.*frequence|lost.time|injury rate', r'cible|objectif|target'),
 ('Deces au travail', r'deces|fatalit|fatal', r'cible|objectif|target'),
 ('Effectif', r'^effectif|nombre (total )?d.(employe|salarie|collaborateur)|headcount|total employees', r'cible|objectif|target|part |%'),
 ('Rotation du personnel', r'rotation|turnover|attrition', r'cible|objectif|target'),
 ('Femmes dans l encadrement', r'femmes? .*(encadrement|management|dirigeant|cadres?|leadership)|women in (management|leadership)', r'cible|objectif|target|conseil|board'),
 ('Femmes au conseil', r'femmes? .*(conseil|board)|women .*board', r'cible|objectif|target'),
 ('Heures de formation', r'heures? de formation|training hours', r'cible|objectif|target'),
 ('Independance du conseil', r'independ.*(conseil|board|administrateur)|(conseil|board).*independ', r'cible|objectif|target'),
 ('Fournisseurs audites', r'fournisseurs?.*(audit|evalu)|supplier.*(audit|assess)', r'cible|objectif|target'),
]
def choisit(kpis, motif, exclu):
    cands = [k for k in kpis.values() if re.search(motif, norm(k['nom'])) and not re.search(exclu, norm(k['nom']))]
    # on prefere un nombre avec unite physique, puis le libelle le plus court
    cands.sort(key=lambda k: (0 if re.search(r'\d', str(k['valeur'])) else 1, len(k['nom'])))
    return cands[0] if cands else None
for t in sys.argv[1:]:
    p = f'/tmp/rse/{t}.json'
    if not os.path.exists(p): continue
    d = json.load(open(p)); annees = sorted(int(a) for a in d); rec, anc = d[str(annees[-1])]['kpis'], d[str(annees[0])]['kpis']
    print(f"\n### {t} ({annees[0]} -> {annees[-1]})\n| Indicateur | {annees[-1]} | {annees[0]} |\n|---|---|---|")
    trouves = 0; communs = 0
    for lib, motif, exclu in COEUR:
        a, b = choisit(rec, motif, exclu), choisit(anc, motif, exclu)
        if not a and not b: continue
        trouves += 1; communs += 1 if (a and b) else 0
        fmt = lambda k: f"{k['valeur']} {k.get('unite') or ''}".strip()[:28] if k else 'non trouve'
        print(f"| {lib} | {fmt(a)} | {fmt(b)} |")
    print(f"\n{trouves} indicateurs coeur trouves sur {len(COEUR)}, {communs} presents aux deux exercices")
