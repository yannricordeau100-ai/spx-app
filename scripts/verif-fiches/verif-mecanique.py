#!/usr/bin/env python3
"""Controles mecaniques sur les 662 fiches servies (copies JSON du chargeur reel).
Sortie : detecteurs/mecanique.json (findings par ticker) + resume par code,
et extraits/<T>.txt : texte visible compact par societe pour la relecture par agents."""
import json, os, re, glob, unicodedata, datetime
from collections import Counter, defaultdict

S = '/private/tmp/claude-501/-Users-yann/f9760fc2-7eac-4e41-821a-262ae5427645/scratchpad'
import sys
F = S + '/' + (sys.argv[1] if len(sys.argv) > 1 else 'fiches')
OUT = S + '/detecteurs/mecanique' + ('-' + sys.argv[1] if len(sys.argv) > 1 else '') + '.json'
EXT = S + '/extraits' + ('-' + sys.argv[1] if len(sys.argv) > 1 else '')
os.makedirs(EXT, exist_ok=True)
TODAY = datetime.date(2026, 9, 29)

findings = defaultdict(list)  # ticker -> [ {code, champ, detail, gravite, auto} ]
def add(t, code, champ, detail, gravite='moyenne', auto=False):
    findings[t].append({'code': code, 'champ': champ, 'detail': str(detail)[:300], 'gravite': gravite, 'auto': auto})

def strip_acc(s):
    return unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode()

# --- motifs texte ---
RX_TIRET = re.compile(r'[—–]')
RX_DOC = re.compile(r'\b(10-?K|10-?Q|20-?F|8-?K|DEF ?14A|Form S-1|6-?K|form(ulaire)? (10|20|8)|URD|document d.enregistrement universel|annual report|rapport annuel|proxy statement)\b', re.I)
RX_SOURCE = re.compile(r"(\bsource\s*:|\(source\b|\btable\s*['\"«]|\bExercice \d{4}, (table|tableau)|https?://|\bp\.\s?\d{2,3}\b|\bpage \d{2,3}\b|\bnote \d{1,2}\b)", re.I)
RX_EN = re.compile(r'\b(the|and|with|from|which|revenue|growth|increase|decrease|year-over-year|compared to|as of|billion|million|quarter|fiscal|company|customers|driven by)\b', re.I)
RX_FR_MARK = re.compile(r'\b(le|la|les|des|du|une|un|et|sur|par|avec|pour|dans|en)\b', re.I)
RX_DECPOINT = re.compile(r'\b\d+\.\d+\s?(%|Mds|M\b|Md|k\b|milliards|millions|\$|€)')
RX_INTERNE = re.compile(r'(\[object|\bundefined\b|\bNaN\b|\bnull\b|\bTODO\b|\bTBD\b|lorem ipsum|placeholder|\bkpis-haut\b|\bCahier\b|\bextracted\b|\bFable\b|\bClaude\b|\bLLM\b|\bGPT-|\bCerebras\b|\bGroq\b|_derived|\bbatch\d|\bJSON\b|\bXBRL\b|\bverbatim\b|\bnon trouv[ée] verbatim|\b_src|\bkpis_haut|\bv2-pipeline|\benrich\b|\bhaiku\b|\bsonnet\b|\bopus\b|\bpipeline d.extraction)', re.I)
RX_MODELE = re.compile(r"(en tant qu.IA|as an AI|je ne peux pas (vous|fournir|acc)|I cannot|I don.t have access|voici (un|le) r[ée]sum[ée]|\bhere is (a|the) summary|\bci-dessous\b|\bNote\s*:\s*(ce r[ée]sum[ée]|this summary)|je n.ai pas (acc[èe]s|trouv[ée])|en tant que mod[èe]le|\bmod[èe]le de langage\b)", re.I)
RX_YEAR = re.compile(r'\b(20[12][0-9])\b')
RX_APOS = re.compile(r"(?<![A-Za-zÀ-ÿ&'’])[dDlLsScCjJnN] (un|une|autre|autres|abord|ailleurs|entreprise|entreprises|exercice|activit[ée]s?|actions?|ann[ée]es?|environ|origine|accord|achat|achats|acier|affaires|ordre|eau|[ée]nergie|espace|essai|effet|[ée]tat|Europe|Asie|Am[ée]rique|Afrique|Inde|Italie|Espagne|Allemagne|Apple|Amazon|IA|investissements?|utilisateurs?|usines?|unit[ée]s?|obligations?|options?|objectifs?|op[ée]rations?|infrastructures?|innovations?|intelligence|assurances?|analyses?|abonn[ée]s|actifs?|acquisitions?|augmenter|atteindre|il|elle|ils|elles|on|est|[ée]tait|y|a|à|en|au|aux|ici|hier|aujourd|hui|habitude|histoire|horizon|[ée]conomie|[ée]lectricit[ée]|[ée]quipements?|[ée]missions?|[ée]chelle|indice|impact|int[ée]r[êe]ts?|exposition|expansion|exploitation|offre|offres|outil|outils|or|ordre|arr[êe]t|ouverture|ensemble|encours|effectifs?|emplois?|entr[ée]es?|[ée]cart|[ée]volution|utilisation|usage|ann[ée]e|automobile|avion|avions|avantage|avantages|acc[èe]s|adoption|application|applications|approche|approvisionnement|augmentation|abonnement|abonnements|Internet|iPhone|Airbus|Alphabet|Oracle|Intel|Uber|Nvidia|Adobe|Airbnb|Allianz|AXA|ING|UBS|Hermès|Hermes|Air Liquide|Orange|Eni|Enel|Iberdrola|Unilever|EssilorLuxottica|Ahold)(?![A-Za-z])")
SANS_ACCENT = re.compile(r"(?<![A-Za-zÀ-ÿ'’])(societe|societes|resultat|resultats|annee|annees|apres|tres|premiere|derniere|benefice|benefices|activite|activites|strategie|strategies|capacite|capacites|quantite|periode|periodes|deja|generale|numerique|numeriques|systeme|systemes|electrique|electriques|energie|energies|region|regions|americain|americaine|europeen|europeenne|reseau|reseaux|developpement|different|differente|differents|prevu|prevue|marche|marches|donnees|creation|operationnel|operationnelle|generation|degradation|realite|specialise|specialisee|dependance|independant|reglementaire|reglementation|securite|sante|medicaments|medical|medicale|hopitaux|equipements|telephonie|vehicules|electricite|petrole|pieces|matieres|premieres|numero|meme|memes|etre|etait|etaient|ete|cree|creee|clientele|fidelite|qualite|rentabilite|volatilite|liquidite|visibilite|competitivite|proprietaire|propriete|proprietes|frequence|recurrent|recurrente|recurrents|recurrentes|reguliere|regulier|coherent|coherence|experience|integration|verticale|acces|succes|proces|congres|interet|interets|etranger|etrangere|hotel|hotels|cout|couts|controle|controlee|role|reelle|reel|reels|ecart|ecarts|element|elements|evolution|evenement|evenements|efficacite|epargne|equilibre|etude|etudes|hebergement|heritage|independance|ingenierie|inegal|integralite|materiel|materiels|mecanique|methode|metier|metiers|modele|modeles|negatif|negative|negociation|neutralite|operation|operations|pediatrique|penetration|perimetre|phenomene|precision|preference|preferences|prevision|previsions|procedure|procedures|progres|prevention|reduction|reference|references|regime|regle|regles|remuneration|renouvele|reparti|repartie|repartition|reserve|reserves|residentiel|resilience|retablissement|reussite|schema|semi-conducteur|semi-conducteurs|serie|series|siecle|specifique|specifiques|stabilite|superieur|superieure|telecommunications|television|temperature|theme|theorie|therapie|therapies|tresorerie|utilite|vehicule)(?![A-Za-zÀ-ÿ'’])")

def visible_strings(o, path='', acc=None):
    if acc is None: acc = []
    if isinstance(o, dict):
        for k, v in o.items():
            if k.startswith('_'): continue
            if k in ('history', 'history_periods', 'source_url', 'url', 'image_url', 'logo', 'id', 'ticker', 'cik', 'lei', 'isin', 'source_file', 'sources', 'source', 'preuve', 'source_note', 'evidence', 'evidence_fr', 'quote', 'sources_fr', 'source_titre', 'hero_kpi_replaced_reason', 'hero_kpi_rationale'): continue
            visible_strings(v, f'{path}.{k}' if path else k, acc)
    elif isinstance(o, list):
        for i, v in enumerate(o): visible_strings(v, f'{path}[{i}]', acc)
    elif isinstance(o, str):
        if len(o) >= 12: acc.append((path, o))
    return acc

CHAMPS_FR = ('name_fr', 'signal', 'description_fr', 'summary', 'hook', 'texte', 'text', 'title', 'titre', 'justification', 'rationale', 'simple', 'avancee', 'commentaire', 'label', 'lecture', 'analysis', 'description')

def norm_name(s):
    return re.sub(r'[^a-z0-9]', '', strip_acc(str(s or '')).lower())

def hist_vals(h):
    out = []
    for x in (h or []):
        v = x.get('v') if isinstance(x, dict) else x
        out.append(v if isinstance(v, (int, float)) and not isinstance(v, bool) else None)
    return out

def hist_periods(k):
    hp = k.get('history_periods')
    if isinstance(hp, list) and hp: return [str(x) for x in hp]
    h = k.get('history') or []
    if h and isinstance(h[0], dict) and 'q' in h[0]: return [str(x.get('q')) for x in h]
    return None

stats = Counter()
for path in sorted(glob.glob(F + '/*.json')):
    t = os.path.basename(path)[:-5]
    if t.startswith('_'): continue
    d = json.load(open(path))
    stats['fiches'] += 1
    lignes = [f"# {t} | {d.get('name')} | {d.get('sector')} > {d.get('subsector')} | GICS {d.get('gics_code')}", f"tagline: {d.get('tagline')}", f"hero: {d.get('hero_kpi')} | prochaine publication: {d.get('next_earnings_date')}"]

    # ---- nom ----
    name = str(d.get('name') or '')
    if re.search(r'\.(com|net|org)\b', name, re.I): add(t, 'N1', 'name', f'nom avec domaine : {name}', 'haute', True)
    if re.search(r'\b(Inc\.?|Corp\.?|Corporation|Co\.|Ltd\.?|plc|PLC|N\.V\.|NV|SE|SA|S\.A\.|AG|SCA|Holding|Holdings|Group|Limited)\s*$', name):
        stats['nom_forme_juridique'] += 1; add(t, 'N2', 'name', f'forme juridique dans le nom : {name}', 'basse')

    # ---- blocs ----
    def nonvide(v):
        if v is None: return False
        if isinstance(v, str): return v.strip() != ''
        if isinstance(v, (list, dict)): return len(v) > 0
        return True
    blocs = {'company_description': nonvide((d.get('mettrik_description') or {}).get('simple')) or nonvide(d.get('company_description')),
             'kpis': nonvide(d.get('kpis')), 'risks': nonvide(d.get('risks')), 'governance': nonvide(d.get('governance')),
             'revenue_by_segment': nonvide(d.get('revenue_by_segment')), 'revenue_by_geography': nonvide(d.get('revenue_by_geography')),
             'ai_positioning': nonvide((d.get('ai_positioning') or {}).get('summary')), 'these': nonvide(d.get('these')), 'att': nonvide(d.get('att')),
             'moat': nonvide(d.get('moat')), 'market_positions': nonvide(d.get('market_positions')), 'clients_concentration': nonvide(d.get('clients_concentration')),
             'mettrik_description': nonvide(d.get('mettrik_description')), 'hero_kpi': nonvide(d.get('hero_kpi')), 'next_earnings_date': nonvide(d.get('next_earnings_date'))}
    for b, ok in blocs.items():
        if not ok: add(t, 'B0', b, 'bloc absent', 'haute' if b in ('kpis', 'hero_kpi', 'these', 'att') else 'moyenne'); stats['bloc_absent_' + b] += 1
    if not blocs['mettrik_description'] and blocs['company_description']:
        add(t, 'B10', 'company_description', 'description Mettrik absente : description anglaise brute affichee ?', 'moyenne')

    # prochaine publication
    ne = d.get('next_earnings_date')
    if ne:
        try:
            dd = datetime.date.fromisoformat(str(ne)[:10])
            if dd < TODAY - datetime.timedelta(days=2): add(t, 'B9', 'next_earnings_date', f'date passee : {ne}', 'moyenne')
        except Exception: add(t, 'B9', 'next_earnings_date', f'date illisible : {ne}', 'basse')

    # gouvernance
    g = d.get('governance') or {}
    gy = None
    for key in ('fiscal_year', 'proxy_year', 'year', 'exercice', 'annee', 'as_of', 'date', 'source_date'):
        v = g.get(key)
        if v:
            m = RX_YEAR.search(str(v))
            if m: gy = int(m.group(1)); break
    if gy and gy <= 2024: add(t, 'B2', 'governance', f'gouvernance de {gy}', 'moyenne'); stats['gouv_2024_ou_avant'] += 1
    lignes.append(f"gouvernance: annee {gy} | dirigeant {g.get('ceo_name') or g.get('ceo')} | remuneration {g.get('ceo_total_comp') or g.get('ceo_compensation')}")

    # risques
    risks = d.get('risks') or []
    if risks and len(risks) < 5: add(t, 'B3', 'risks', f'{len(risks)} risques', 'basse')
    scores = set()
    for r in risks:
        sc = r.get('score') if isinstance(r, dict) else None
        scores.add(sc if isinstance(sc, (int, float)) and sc > 0 else (r.get('severity') if isinstance(r, dict) else 3))
    if risks and len(scores) <= 1: add(t, 'B3', 'risks', 'score identique sur tous les risques', 'basse')
    for i, r in enumerate(risks):
        if isinstance(r, dict): lignes.append(f"risque {i+1}: {r.get('title')} :: {(r.get('description') or r.get('text') or '')[:260]}")

    # repartition
    for bloc in ('revenue_by_segment', 'revenue_by_geography'):
        rb = d.get(bloc) or {}
        sl = rb.get('slices') if isinstance(rb, dict) else None
        if isinstance(sl, list) and sl:
            tot = sum(x.get('pct') or x.get('share') or x.get('percent') or 0 for x in sl if isinstance(x, dict))
            if tot and not (95 <= tot <= 105): add(t, 'B4', bloc, f'somme des parts {tot:.1f} %', 'moyenne')
            y = rb.get('fiscal_year') or rb.get('year') or rb.get('period')
            m = RX_YEAR.search(str(y or ''))
            if m and int(m.group(1)) <= 2024: add(t, 'B4', bloc, f'repartition de {m.group(1)}', 'moyenne'); stats['repartition_2024'] += 1
            lignes.append(f"{bloc} ({y}): " + ' ; '.join(f"{x.get('name') or x.get('label')} {x.get('pct') or x.get('share') or x.get('percent')}" for x in sl if isinstance(x, dict)))
        elif isinstance(rb, dict) and rb:
            lignes.append(f"{bloc}: cles {list(rb.keys())[:6]}")

    # positionnement IA
    ai = d.get('ai_positioning') or {}
    su = str(ai.get('summary') or '')
    if su:
        if RX_MODELE.search(su): add(t, 'B5', 'ai_positioning.summary', 'texte de modele : ' + su[:80], 'haute')
        en = len(RX_EN.findall(su)); fr = len(RX_FR_MARK.findall(su))
        if en >= 4 and en > fr: add(t, 'B5', 'ai_positioning.summary', 'resume en anglais', 'haute')
        lignes.append(f"positionnement IA ({ai.get('stance') or ai.get('date')}): {su[:400]}")

    # these / att
    for bloc in ('these', 'att'):
        x = d.get(bloc) or {}
        if isinstance(x, dict) and x:
            conv = x.get('conviction') or x.get('intensite')
            if conv and strip_acc(str(conv)).lower() not in ('faible', 'moyenne', 'forte', 'elevee', 'basse', 'modere', 'moderee', 'haute'):
                add(t, 'B6', bloc, f'niveau inconnu : {conv}', 'moyenne')
            hook = x.get('hook') or x.get('accroche')
            if not hook: add(t, 'B6', bloc, 'sans accroche', 'basse')
            lignes.append(f"{bloc} ({conv}): {hook} :: {str(x.get('texte') or x.get('text') or x.get('resume') or '')[:300]}")

    # moat
    mo = d.get('moat') or {}
    if isinstance(mo, dict) and mo:
        lignes.append(f"moat: {mo.get('rating') or mo.get('note')} / tendance {mo.get('trend') or mo.get('tendance') or mo.get('tendance_mettrik')} :: {str(mo.get('justification') or mo.get('justification_mettrik') or mo.get('summary') or '')[:300]}")
    # clients / TAM
    cc = d.get('clients_concentration') or {}
    if isinstance(cc, dict) and cc:
        m = RX_YEAR.findall(json.dumps(cc, ensure_ascii=False))
        if m and max(int(y) for y in m) <= 2024: add(t, 'B8', 'clients_concentration', f'derniere annee citee {max(m)}', 'basse'); stats['clients_2024'] += 1
        lignes.append(f"clients: {str(cc.get('commentaire') or cc.get('summary') or cc)[:300]}")
    mp = d.get('market_positions') or []
    for i, p in enumerate(mp if isinstance(mp, list) else []):
        if isinstance(p, dict):
            m = RX_YEAR.findall(json.dumps(p, ensure_ascii=False))
            if m and max(int(y) for y in m) <= 2024: add(t, 'B8', f'market_positions[{i}]', f'derniere annee citee {max(m)} : {p.get("label") or p.get("market") or p.get("name")}', 'basse'); stats['tam_2024'] += 1
            lignes.append(f"position de marche {i+1}: {p.get('label') or p.get('market') or p.get('name')} | taille {p.get('tam') or p.get('size') or p.get('value')} {p.get('unit') or ''} | part {p.get('share') or p.get('part')} | {str(p.get('commentaire') or p.get('summary') or p.get('description') or '')[:200]}")

    # ---- KPI ----
    kpis = d.get('kpis') or []
    stats['kpis'] += len(kpis)
    if len(kpis) < 5: add(t, 'K9', 'kpis', f'{len(kpis)} KPI seulement', 'haute')
    names = defaultdict(list); hists = defaultdict(list)
    hero = str(d.get('hero_kpi') or '')
    hero_found = False
    for i, k in enumerate(kpis):
        if not isinstance(k, dict): continue
        sh = str(k.get('short') or ''); nf = str(k.get('name_fr') or ''); ne_ = str(k.get('name_en') or ''); u = str(k.get('unit') or '')
        vals = hist_vals(k.get('history'))
        per = hist_periods(k)
        pt = k.get('period_type') or k.get('frequency')
        if sh.lower() == hero.lower(): hero_found = True
        champ = f'kpis[{i}] {sh}'
        if not nf: add(t, 'K5', champ, 'sans nom francais', 'haute')
        ACRO = {'EBITDA','EBITDAX','EBIT','EPS','BPA','ROE','ROIC','ROA','FCF','CAPEX','ARR','AUM','AUC','NOI','FFO','AFFO','DPS','TAM','ARPU','ARPA','ARPPU','NPS','CAC','LTV','GMV','NRR','GRR','MAU','DAU','WAU','MRR','RPO','TCV','ACV','ASP','OPEX','PIB','R&D','SG&A','NAV','ANR','BNPA','CET1','SCR','RWA','LCR','NSFR','CA','TTM','ETP','MW','GW','TWH','GWH','MWH','AOM','RevPAR','ADR','ASK','RPK','CASK','RASK','FTE','ESG','IFRS','GAAP','US GAAP','LNG','GNL','EUV','DUV','HBM','DRAM','NAND','AWS','AI','IA','GPU','CPU','TPU','PC','TV','OTT','SVOD','AVOD','NII','NIM','ROTE','ROTCE','CTI','COR','SIR','NPE','NPL','LCR','TSR','WACC','EV','P/E','PER','PEG','ROCE','ROI','ANC','SIIC','REIT','FFO/action','AFFO/action','GLA','ABR','NOI/m2'}
        if nf and (('_' in nf) or (nf.isupper() and len(nf) > 3 and nf.strip() not in ACRO and not re.match(r'^[A-Z&/ .-]{2,8}$', nf.strip()))): add(t, 'K5', champ, f'nom = code technique : {nf}', 'haute')
        if nf and RX_EN.search(nf) and not RX_FR_MARK.search(nf) and len(RX_EN.findall(nf)) >= 1 and re.search(r'\b(revenue|growth|customers|net income|margin|sales)\b', nf, re.I):
            add(t, 'K5', champ, f'nom francais en anglais : {nf}', 'moyenne')
        if not u.strip() or u.strip().lower() in ('none', 'null', 'nan'): add(t, 'K6', champ, f'unite vide ou invalide : {u!r}', 'moyenne')
        nums = [v for v in vals if v is not None]
        if not nums:
            if not sh.startswith('WEB_'): add(t, 'K4', champ, 'historique vide', 'basse')
            continue
        if any(v is None for v in vals) and len(vals) - len(nums) > 2: add(t, 'K3', champ, f'{len(vals)-len(nums)} trous dans la serie', 'basse')
        if len(nums) >= 3 and len(set(nums)) == 1: add(t, 'K12', champ, f'serie plate : {nums[0]} x{len(nums)}', 'basse')
        # rupture d echelle
        for a, b in zip(nums, nums[1:]):
            if a and b and a > 0 and b > 0 and (b / a > 60 or a / b > 60):
                add(t, 'K11', champ, f'saut x{max(b/a, a/b):.0f} dans la serie ({a} -> {b})', 'haute'); break
        if u.strip() == '%' and (max(abs(v) for v in nums) > 1000): add(t, 'K13', champ, f'pourcentage aberrant : {max(nums)}', 'haute')
        if re.search(r'^(Mds|Md|B)\b', u) and max(abs(v) for v in nums) > 5000: add(t, 'K13', champ, f'valeur en Mds > 5000 : {max(nums)}', 'moyenne')
        if re.search(r'^(M)\s', u) and max(abs(v) for v in nums) > 5_000_000: add(t, 'K13', champ, f'valeur en M > 5 000 000 : {max(nums)}', 'moyenne')
        val = k.get('value')
        if isinstance(val, (int, float)) and not isinstance(val, bool) and nums and abs(val) > 0 and abs(nums[-1]) > 0:
            r = abs(val) / abs(nums[-1])
            if r > 900 or r < 1 / 900: add(t, 'K1', champ, f'value {val} vs dernier point {nums[-1]} (x1000 ?)', 'haute')
        # dates
        ld = str(k.get('last_data_date') or '')
        m = re.match(r'(\d{4})-(\d{2})', ld)
        if m:
            y = int(m.group(1))
            if y > 2026 or (y == 2026 and int(m.group(2)) > 9): add(t, 'K14', champ, f'date dans le futur : {ld}', 'haute')
            if y <= 2024: stats['kpi_arrete_2024'] += 1
        elif pt in ('quarter', 'quarterly'): add(t, 'K1b', champ, 'trimestriel sans last_data_date', 'moyenne')
        if per and len(per) != len(vals): add(t, 'K2', champ, f'{len(per)} periodes pour {len(vals)} points', 'haute')
        if per:
            last = per[-1]; m2 = RX_YEAR.search(last)
            if m2 and int(m2.group(1)) <= 2024: stats['kpi_derniere_periode_2024'] += 1
        # texte du KPI
        sig = str(k.get('signal') or ''); desc = str(k.get('description_fr') or '')
        for lab, txt in (('signal', sig), ('description_fr', desc)):
            if not txt: continue
            if RX_TIRET.search(txt): add(t, 'T1', champ + '.' + lab, 'tiret long', 'basse', True)
            if RX_DOC.search(txt): add(t, 'T2', champ + '.' + lab, 'nom de document : ' + RX_DOC.search(txt).group(0), 'moyenne', True)
            if RX_SOURCE.search(txt): add(t, 'T3', champ + '.' + lab, 'mention de source : ' + RX_SOURCE.search(txt).group(0), 'moyenne', True)
            if RX_DECPOINT.search(txt): add(t, 'T5', champ + '.' + lab, 'point decimal : ' + RX_DECPOINT.search(txt).group(0), 'basse', True)
            if RX_INTERNE.search(txt): add(t, 'T7', champ + '.' + lab, 'marque interne : ' + RX_INTERNE.search(txt).group(0), 'haute')
            en = len(RX_EN.findall(txt)); fr = len(RX_FR_MARK.findall(txt))
            if en >= 3 and en > fr: add(t, 'T4', champ + '.' + lab, 'texte en anglais : ' + txt[:80], 'moyenne')
            if SANS_ACCENT.search(txt): add(t, 'T9', champ + '.' + lab, 'accent manquant : ' + SANS_ACCENT.search(txt).group(0), 'basse', True)
            if RX_APOS.search(txt): add(t, 'T10', champ + '.' + lab, 'apostrophe manquante : ' + RX_APOS.search(txt).group(0), 'basse', True)
            ys = [int(y) for y in RX_YEAR.findall(txt)]
            if lab == 'signal' and ys and m and max(ys) < int(m.group(1)) - 1: add(t, 'T8', champ + '.signal', f'signal date de {max(ys)} alors que la serie va a {ld[:7]}', 'moyenne')
        names[norm_name(nf)].append(sh)
        if len(nums) >= 4: hists[tuple(round(v, 6) for v in nums[-4:])].append(sh)
        serie = ', '.join(f"{p}={v}" for p, v in zip((per or [''] * len(vals))[-8:], vals[-8:])) if per else ', '.join(str(v) for v in vals[-8:])
        lignes.append(f"KPI {sh} | {nf} | {ne_} | {u} | {pt} | dernier {ld[:10]} | n={len(nums)} | val={val} | yoy={k.get('yoy')} | serie: {serie} :: {sig[:200]} :: {desc[:160]}")
    if hero and not hero_found: add(t, 'H1', 'hero_kpi', f'{hero} ne correspond a aucun KPI', 'haute')
    for n, l in names.items():
        if n and len(l) > 1: add(t, 'K4d', 'kpis', f'meme nom francais : {l}', 'moyenne'); stats['doublon_nom'] += 1
    for h, l in hists.items():
        if len(l) > 1: add(t, 'K4d', 'kpis', f'memes 4 derniers points : {l}', 'moyenne'); stats['doublon_valeurs'] += 1

    # ---- textes de tous les blocs (hors KPI, deja traites) ----
    for pth, s in visible_strings({k: v for k, v in d.items() if k not in ('kpis', 'company_description', 'events', 'latest_filing', 'revenue_history', 'financial_snapshot', 'key_facts', 'dividend_meta', 'tagline_i18n')}):
        if RX_TIRET.search(s): add(t, 'T1', pth, 'tiret long', 'basse', True)
        if RX_DOC.search(s): add(t, 'T2', pth, 'nom de document : ' + RX_DOC.search(s).group(0), 'moyenne', True)
        if RX_SOURCE.search(s): add(t, 'T3', pth, 'mention de source : ' + RX_SOURCE.search(s).group(0), 'moyenne', True)
        if RX_INTERNE.search(s): add(t, 'T7', pth, 'marque interne : ' + RX_INTERNE.search(s).group(0), 'haute')
        if RX_MODELE.search(s): add(t, 'T7m', pth, 'texte de modele : ' + s[:80], 'haute')
        if SANS_ACCENT.search(s): add(t, 'T9', pth, 'accent manquant : ' + SANS_ACCENT.search(s).group(0), 'basse', True)
        if RX_APOS.search(s): add(t, 'T10', pth, 'apostrophe manquante : ' + RX_APOS.search(s).group(0), 'basse', True)
        if RX_DECPOINT.search(s): add(t, 'T5', pth, 'point decimal : ' + RX_DECPOINT.search(s).group(0), 'basse', True)
        if len(s) > 60:
            en = len(RX_EN.findall(s)); fr = len(RX_FR_MARK.findall(s))
            if en >= 4 and en > fr * 1.5: add(t, 'T4', pth, 'texte en anglais : ' + s[:80], 'moyenne')
    lignes.append(f"description Mettrik simple: {str((d.get('mettrik_description') or {}).get('simple') or '')[:500]}")
    meca = [f for f in findings.get(t, []) if f['code'] not in ('T9', 'T10', 'T5', 'T1', 'N2')]
    lignes.append('')
    lignes.append('## Points deja detectes mecaniquement (ne pas repeter) : ' + '; '.join(f"{f['code']} {f['champ'][:30]} {f['detail'][:60]}" for f in meca[:40]))
    open(f'{EXT}/{t}.txt', 'w').write('\n'.join(lignes))

json.dump(findings, open(OUT, 'w'), ensure_ascii=False, indent=1)
codes = Counter(); autos = Counter(); graves = Counter()
for t, l in findings.items():
    for f in l:
        codes[f['code']] += 1
        if f['auto']: autos[f['code']] += 1
        if f['gravite'] == 'haute': graves[f['code']] += 1
print('stats', dict(stats))
print('fiches avec au moins un point :', len(findings))
for c, n in codes.most_common(): print(f'{c:5} {n:6}  auto {autos[c]:5}  haute {graves[c]:5}')
