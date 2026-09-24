#!/usr/bin/env python3
"""Test d extraction des KPI RSE (Yann 24 sept 2026) : pour chaque societe et
chaque exercice, on isole la partie durabilite du rapport annuel du lac, on la
decoupe, et le moteur gratuit liste les indicateurs chiffres (nom, valeur,
unite). Le script ne garde qu une valeur presente mot pour mot dans le morceau.
Puis il compare les indicateurs de l exercice le plus ancien a ceux du plus
recent (noms normalises). Sortie : /tmp/rse/<T>.json et un bilan."""
import json, os, re, sys, glob, gzip, time, unicodedata
sys.path.insert(0, os.path.dirname(__file__))
from moteur_gratuit import appelle, MoteurIndisponible
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEBUT = re.compile(r'(?i)(sustainability statement|non-financial (statement|report|information)|d[ée]claration de performance extra-financi[èe]re|ESRS 2|environmental, social and governance|sustainability report|corporate responsibility|nachhaltigkeitsbericht|nichtfinanzielle erkl)')
SCHEMA = {"type": "OBJECT", "properties": {"kpis": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {"nom": {"type": "STRING"}, "valeur": {"type": "STRING"}, "unite": {"type": "STRING"}, "theme": {"type": "STRING"}}, "required": ["nom", "valeur"]}}}, "required": ["kpis"]}
PROMPT = """Liste TOUS les indicateurs chiffrés de durabilité (environnement, social, gouvernance, sécurité, formation, diversité, énergie, émissions, eau, déchets, fournisseurs...) présents dans cet extrait du rapport annuel {annee} de {nom}. Pour chacun : "nom" (libellé court en français), "valeur" (recopiée telle quelle, exactement comme écrite dans le texte), "unite", "theme" (E, S ou G). Ignore les chiffres financiers (chiffre d'affaires, résultat) et les numéros de page. Réponds en JSON.
EXTRAIT :
{txt}"""
def norm(s): return re.sub(r'[^a-z0-9 ]', '', unicodedata.normalize('NFKD', s.lower()).encode('ascii', 'ignore').decode()).strip()
def section(txt):
    m = DEBUT.search(txt[100000:]) or DEBUT.search(txt)
    deb = (m.start() + 100000) if m and m.start() + 100000 < len(txt) and DEBUT.search(txt[100000:]) else (m.start() if m else 0)
    return txt[deb:deb + 260000]
def extrait(t, annee, path):
    txt = re.sub(r'\s+', ' ', gzip.open(path, 'rt', errors='replace').read()); sec = section(txt)
    kpis = {}; appels = 0; rejets = 0
    for i in range(0, len(sec), 24000):
        morceau = sec[i:i + 26000]
        if len(re.findall(r'\d', morceau)) < 40: continue
        try: rep, moteur = appelle(PROMPT.format(annee=annee, nom=t, txt=morceau), json_attendu=True, schema=SCHEMA)
        except MoteurIndisponible: print('  moteur indisponible, pause 60 s', flush=True); time.sleep(60); continue
        appels += 1
        liste = rep.get('kpis') if isinstance(rep, dict) else rep
        for k in (liste or []):
            if not isinstance(k, dict): continue
            v = str(k.get('valeur', '')).strip(); n = norm(k.get('nom', ''))
            if not n or not v or v.replace(',', '.').replace(' ', '') not in morceau.replace(',', '.').replace(' ', '').replace(' ', ''): rejets += 1; continue
            kpis.setdefault(n, {'nom': k.get('nom'), 'valeur': v, 'unite': k.get('unite'), 'theme': k.get('theme')})
    return kpis, appels, rejets, len(sec)
if __name__ == '__main__':
    os.makedirs('/tmp/rse', exist_ok=True); bilan = {}
    for t in sys.argv[1:]:
        if os.path.exists(f'/tmp/rse/{t}.json'): print(t, 'deja fait', flush=True); continue
        docs = {}
        for f in glob.glob(f'{ROOT}/data-lake/{t}/ir/URD/*.txt.gz'):
            if 'remuneration' in f.lower() or 'SFCR' in f: continue
            m = re.search(r'FY(20\d\d)', f)
            if m: docs[int(m.group(1))] = f
        annees = sorted(a for a in docs if a >= 2021)[-5:]
        res = {}; t0 = time.time()
        for a in annees:
            k, appels, rejets, taille = extrait(t, a, docs[a]); res[a] = {'kpis': k, 'appels': appels, 'rejets': rejets, 'taille_section': taille}
            print(f'{t} {a}: {len(k)} KPI, {appels} appels, {rejets} rejets, section {taille//1000}k car', flush=True)
        json.dump(res, open(f'/tmp/rse/{t}.json', 'w'), ensure_ascii=False, indent=1)
        if len(annees) >= 2:
            anc, rec = set(res[annees[0]]['kpis']), set(res[annees[-1]]['kpis'])
            communs = {n for n in anc if n in rec or any(n in r or r in n for r in rec)}
            bilan[t] = {'annees': annees, 'kpi_ancien': len(anc), 'kpi_recent': len(rec), 'encore_presents_pct': round(100 * len(communs) / max(1, len(anc)), 1), 'minutes': round((time.time() - t0) / 60, 1)}
            print('BILAN', t, bilan[t], flush=True)
    json.dump(bilan, open('/tmp/rse/bilan.json', 'w'), ensure_ascii=False, indent=1)
