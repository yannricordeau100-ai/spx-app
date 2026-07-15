#!/usr/bin/env python3
"""Add English verbatim citations to score_rationale for 25 top-cap risks."""
import os, sys, json, gzip, re
from html.parser import HTMLParser

BASE_JSON = '/Users/yann/spx-app/src/data/v2-pipeline-enrich'
BASE_DL = '/Users/yann/spx-app/data-lake'

TICKERS = ['NVDA','AAPL','MSFT','GOOGL','AMZN','META','TSLA','V','JPM','BRK-B',
           'LLY','AVGO','ORCL','TSM','WMT','JNJ','XOM','MA','HD','PG',
           'ABBV','COST','KO','BAC','CVX']

class Stripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
    def handle_data(self, d):
        self.parts.append(d)

def strip_html(html):
    s = Stripper()
    try:
        s.feed(html)
    except Exception:
        pass
    return ' '.join(''.join(s.parts).split())

def load_item1a(ticker):
    """Return Item 1A text or None."""
    # Try _risks_src.txt first
    rsrc = os.path.join(BASE_DL, ticker, '_risks_src.txt')
    if os.path.exists(rsrc):
        with open(rsrc, encoding='utf-8', errors='ignore') as f:
            return f.read()
    # Fallback: gunzip latest 10-K and extract Item 1A → Item 1B/2
    dk = os.path.join(BASE_DL, ticker, '10K')
    if not os.path.isdir(dk):
        return None
    files = sorted([f for f in os.listdir(dk) if f.endswith('.htm.gz')])
    if not files:
        return None
    with gzip.open(os.path.join(dk, files[-1]), 'rt', encoding='utf-8', errors='ignore') as f:
        html = f.read()
    text = strip_html(html)
    lower = text.lower()
    starts = [m.start() for m in re.finditer(r'item\s*1a', lower)]
    ends = [m.start() for m in re.finditer(r'item\s*1b|item\s*2\.', lower)]
    if not starts:
        return text
    s = starts[1] if len(starts) > 1 else starts[0]
    e = next((x for x in ends if x > s), len(text))
    if e - s < 5000 and len(starts) > 2:
        s = starts[2]
        e = next((x for x in ends if x > s), len(text))
    return text[s:e]

# --------- extract existing citation ---------
QUOTE_PATTERNS = [
    re.compile(r'"([^"]{5,300})"'),
    re.compile(r'«\s*([^»]{5,300})\s*»'),
    re.compile(r"'([^']{20,300})'"),
    re.compile(r'“([^”]{5,300})”'),
]
ENGLISH_STOPWORDS = {'the','and','of','to','a','in','our','we','that','for','with','on','by','is','are','as','or','be','from','which','their','may','have','could','not','this','an','its','it','at'}

FR_SIGNAL = re.compile(r'\b(les|des|une|pour|dans|par|sur|avec|sans|est|sont|ont|été|être|ainsi|celui|celle|ceux|celles|elle|nous|vous|leur|leurs|risque|langage|prudentiel|générique|générale|standard|conditionnel|Note|Score|milieu|premier|dernier|tiers|section|début|debut|tête|tete|Bas|Haut|Boilerplate)\b', re.I)
def looks_english(s):
    words = re.findall(r"[A-Za-z']+", s.lower())
    if len(words) < 2:
        return False
    if FR_SIGNAL.search(s):
        return False
    hits = sum(1 for w in words if w in ENGLISH_STOPWORDS)
    if hits >= 1:
        return True
    # No stopwords: accept if pure ASCII (no accents) and looks technical
    return bool(re.match(r'^[\x00-\x7f]+$', s)) and len(words) >= 2

def extract_existing_quote(rationale):
    best = None
    for pat in QUOTE_PATTERNS:
        for m in pat.finditer(rationale):
            q = m.group(1).strip()
            if looks_english(q):
                if best is None or len(q) > len(best):
                    best = q
    return best

def truncate_15w(q):
    words = q.split()
    if len(words) <= 15:
        return q.rstrip(' ,;:.')
    return ' '.join(words[:15]).rstrip(' ,;:.')

# --------- position detection ---------
POS_KEYWORDS = [
    (re.compile(r'\b(tête|tete|début|debut|haut|premier tiers|first third|top)\b', re.I), 'haut'),
    (re.compile(r'\b(milieu|middle|section médiane|mediane)\b', re.I), 'milieu'),
    (re.compile(r'\b(bas|fin|dernier tiers|last third|end|tout dernier|bottom)\b', re.I), 'bas'),
]

def frac_to_pos(f):
    if f < 0.34: return 'haut'
    if f < 0.67: return 'milieu'
    return 'bas'

def detect_position(rationale, quote, item1a):
    # 1) explicit % or fraction
    m = re.search(r'(?:frac\s*[:=]?\s*)?(\d{1,3})\s*%', rationale)
    if m:
        p = int(m.group(1))
        if 0 <= p <= 100:
            return frac_to_pos(p/100)
    m = re.search(r'frac\s*[:=]?\s*0?\.(\d{1,3})', rationale)
    if m:
        f = float('0.'+m.group(1))
        return frac_to_pos(f)
    # 2) find quote in item1a
    if quote and item1a:
        # search first ~30 chars of quote
        needle = quote[:30]
        idx = item1a.lower().find(needle.lower())
        if idx >= 0:
            return frac_to_pos(idx / len(item1a))
    # 3) keywords
    for pat, pos in POS_KEYWORDS:
        if pat.search(rationale):
            return pos
    return 'milieu'  # default

# --------- fallback quote from Item 1A ---------
STOP_FR = set('les des une un de la le du et à au aux dans par pour sur avec sans sous ce cette ces son sa ses leur leurs qui que quoi comment est sont ont a été été être plus moins tout tous toute toutes très ou où en'.split())

def keywords_from_risk(risk):
    words = []
    for k in ('title','summary'):
        v = risk.get(k) or ''
        for w in re.findall(r"[A-Za-zÀ-ÿ]{4,}", v):
            wl = w.lower()
            if wl not in STOP_FR:
                words.append(wl)
    return words

# Rough FR→EN mapping for search
FR2EN = {
    'chine':'china','changes':'changes','concurrence':'competition','competition':'competition',
    'clients':'customers','client':'customer','cybersécurité':'cybersecurity','cybersecurity':'cybersecurity',
    'donnees':'data','données':'data','reglementation':'regulation','réglementation':'regulation',
    'litige':'litigation','litiges':'litigation','antitrust':'antitrust','fiscal':'tax','fiscalité':'tax',
    'change':'currency','devise':'currency','taux':'interest','interet':'interest','intérêt':'interest',
    'fournisseurs':'suppliers','fournisseur':'supplier','chaine':'supply','chaîne':'supply',
    'supply':'supply','geopolitique':'geopolitical','géopolitique':'geopolitical','tarifs':'tariffs',
    'douaniers':'tariffs','climat':'climate','climatique':'climate','concentration':'concentrated',
    'talents':'talent','recrutement':'talent','reputation':'reputation','réputation':'reputation',
    'marque':'brand','cloud':'cloud','ia':'AI','artificielle':'artificial','intelligence':'intelligence',
    'confidentialite':'privacy','confidentialité':'privacy','vie privee':'privacy',
    'produits':'products','produit':'product','marche':'market','marché':'market',
    'reglementaires':'regulatory','réglementaires':'regulatory','juridiques':'legal',
    'gouvernementales':'government','sanctions':'sanctions','export':'export','exportation':'export',
    'controle':'control','contrôle':'control','geographique':'geographic','géographique':'geographic',
    'macroeconomique':'macroeconomic','recession':'recession','récession':'recession',
    'inflation':'inflation','matieres':'commodity','matières':'commodity','premieres':'raw',
    'premières':'raw','prix':'prices','petrole':'oil','pétrole':'oil','gaz':'gas','naturel':'natural',
    'pipeline':'pipeline','biosimilaires':'biosimilar','brevets':'patent','brevet':'patent',
    'medicaments':'drug','médicaments':'drug','sante':'health','santé':'health',
    'assurance':'insurance','sinistres':'losses','catastrophes':'catastrophic','naturelles':'natural',
    'banques':'bank','banque':'bank','credit':'credit','crédit':'credit','defauts':'defaults',
    'défauts':'defaults','liquidite':'liquidity','liquidité':'liquidity','capital':'capital',
    'reserves':'reserves','réserves':'reserves','loi':'law','conformite':'compliance',
    'conformité':'compliance','fraude':'fraud','paiement':'payment','paiements':'payments',
    'reseau':'network','réseau':'network','carte':'card','cartes':'cards',
    'digital':'digital','plateforme':'platform','plateformes':'platforms','apple':'Apple',
    'google':'Google','amazon':'Amazon','microsoft':'Microsoft','nvidia':'NVIDIA',
    'tesla':'Tesla','hyperscalers':'hyperscale','fabless':'foundries','tsmc':'foundries',
    'foundry':'foundries','conducteurs':'semiconductor','semi':'semiconductor',
    'operations':'operations','operationnel':'operational','opérationnel':'operational',
    'operationnels':'operational','disruption':'disruption','perturbation':'disruption',
    'strategie':'strategy','stratégie':'strategy','execution':'execution','exécution':'execution',
    'capex':'capital','investissement':'investment','investissements':'investment',
    'produits':'products','continuite':'continuity','continuité':'continuity',
    'chaîne':'supply','manufacturiere':'manufacturing','manufacturière':'manufacturing',
    'fabrication':'manufacturing','puces':'chip','puce':'chip','gpu':'GPU','asic':'ASIC',
    'systemes':'systems','systèmes':'systems','information':'information','informations':'information',
    'attaques':'attacks','attaque':'attack','breach':'breach','violation':'breach',
    'violations':'breach','impact':'impact','materiel':'material','matériel':'material',
    'materielle':'material','matérielle':'material','impact':'impact','financier':'financial',
    'financiere':'financial','financière':'financial','financiers':'financial','financières':'financial',
    'reforme':'reform','réforme':'reform','environnement':'environment','environnementaux':'environmental',
    'transition':'transition','energetique':'energy','énergétique':'energy','energie':'energy',
    'énergie':'energy','commerce':'trade','commerciaux':'trade','distributeur':'distributor',
    'distributeurs':'distributor','emballages':'packaging','emballage':'packaging','plastique':'plastic',
    'plastiques':'plastic','ingredients':'ingredients','ingrédients':'ingredients',
    'consommation':'consumer','consommateurs':'consumer','consommateur':'consumer',
    'retail':'retail','walmart':'Walmart','costco':'Costco','marges':'margins','marge':'margin',
    'digestion':'demand','cyclicite':'cyclical','cyclicité':'cyclical','surinvestissement':'overcapacity',
    'openai':'customer','oci':'cloud','oracle':'Oracle','amd':'AMD','intel':'Intel',
    'consommateurs':'consumer','changes':'foreign','strateg':'strategy',
    'ip':'intellectual property','propriete':'intellectual property','propriété':'intellectual property',
    'intellectuelle':'intellectual','pipeline':'pipeline','clinique':'clinical','cliniques':'clinical',
    'essais':'clinical','fda':'FDA','ema':'EMA','regulateur':'regulator','régulateur':'regulator',
    'concentration':'concentration','biotechnologie':'biopharmaceutical','pharmaceutique':'pharmaceutical',
    'humira':'Humira','skyrizi':'Skyrizi','rinvoq':'Rinvoq','ozempic':'GLP','glp':'GLP',
    'obesite':'obesity','obésité':'obesity','diabete':'diabetes','diabète':'diabetes',
    'cancer':'oncology','oncologie':'oncology','vaccins':'vaccine','vaccine':'vaccine',
    'talc':'talc','opioides':'opioid','opioïdes':'opioid','baby':'baby','powder':'powder',
    'reserves':'reserves','pertes':'losses','environmentales':'environmental',
    'geopolitiques':'geopolitical','tensions':'geopolitical','war':'war','guerre':'war',
    'ukraine':'Russia','russie':'Russia','iran':'Iran','moyen orient':'Middle East',
    'moyen-orient':'Middle East','extremes':'extreme','extrêmes':'extreme','sinistre':'catastrophic',
    'transitoire':'transition','transitoires':'transition','stockage':'storage','energy':'energy',
    'renouvelable':'renewable','solaire':'solar','eolienne':'wind','électrique':'electric',
    'vehicules':'vehicles','véhicules':'vehicles','autonome':'autonomous','conduite':'driving',
    'batterie':'battery','batteries':'battery','musk':'CEO','dirigeant':'CEO',
    'employes':'employees','employees':'employees','salaries':'employees','sociales':'labor',
    'travail':'labor','syndicats':'union','autonomie':'autonomous','logiciel':'software',
    'defense':'defense','military':'military','armes':'defense','antitrust':'antitrust',
    'pouvoir':'market power','position dominante':'dominant','deregulation':'deregulation',
    'financement':'financing','pret':'loan','prêt':'loan','depots':'deposits','dépôts':'deposits',
    'fed':'Federal Reserve','banques':'bank','conformite':'compliance','regulateurs':'regulators',
    'basel':'capital','bale':'capital','stress':'stress test','pension':'pension','retraite':'pension',
    'hypothecaire':'mortgage','hypothécaire':'mortgage','immobilier':'real estate',
    'commercial':'commercial','residentiel':'residential','résidentiel':'residential',
    'oleoducs':'pipeline','oléoducs':'pipeline','raffinage':'refining','chimie':'chemicals',
    'petrochimie':'petrochemical','pétrochimie':'petrochemical','exploration':'exploration',
    'production':'production','offshore':'offshore','deepwater':'deepwater','gulf':'Gulf',
    'permian':'Permian','guyana':'Guyana',
}

def find_quote_in_item1a(item1a, risk):
    """Fallback: find short English quote in item1a matching risk keywords."""
    if not item1a:
        return None
    kws = keywords_from_risk(risk)
    en_terms = set()
    for k in kws:
        if k in FR2EN:
            en_terms.add(FR2EN[k].lower())
        # also try raw word if English-looking
        if re.match(r'^[A-Za-z]+$', k):
            en_terms.add(k)
    if not en_terms:
        return None
    # split item1a into sentences (rough)
    sentences = re.split(r'(?<=[.;])\s+(?=[A-Z])', item1a)
    best = None
    best_score = 0
    for s in sentences:
        if not (30 < len(s) < 300):
            continue
        sl = s.lower()
        score = sum(1 for t in en_terms if t in sl)
        if score > best_score:
            best_score = score
            best = s
    if best is None:
        return None
    # extract a short substring: first 15 words containing at least one keyword
    words = best.split()
    if len(words) <= 15:
        return best.strip(' ,;.:')
    # slide window of 15 words to maximize keyword hits
    best_win = None
    best_win_score = 0
    for i in range(0, len(words) - 15 + 1):
        win = ' '.join(words[i:i+15])
        wl = win.lower()
        score = sum(1 for t in en_terms if t in wl)
        if score > best_win_score:
            best_win_score = score
            best_win = win
    return (best_win or ' '.join(words[:15])).strip(' ,;.:')

# --------- justification cleaning ---------
def clean_justification(rationale):
    """Remove existing quote markers, %, position hints; keep FR analysis."""
    r = rationale
    # remove all quoted spans
    for pat in QUOTE_PATTERNS:
        r = pat.sub('', r)
    # remove position markers like "Item 1A (...%)", "(debut Item 1A, X%)", "premier tiers", etc.
    r = re.sub(r'\(?(?:d[eé]but|milieu|fin|haut|bas|t[eê]te|premier tiers|dernier tiers)\s*Item\s*1A[^)]*\)?', '', r, flags=re.I)
    r = re.sub(r'Item\s*1A[^.:;]*\(?[~≈]?\s*\d{1,3}\s*%[^)]*\)?', '', r, flags=re.I)
    r = re.sub(r'\(?\s*frac\s*[:=]?\s*0?\.?\d+[^)]*\)?', '', r, flags=re.I)
    r = re.sub(r'\(?\s*\d{1,3}\s*%[^)]*\)?', '', r)
    r = re.sub(r'premier tiers|dernier tiers|tête|tete|début|debut Item 1A|milieu Item 1A|haut Item 1A|bas Item 1A|section médiane', '', r, flags=re.I)
    r = re.sub(r'Item\s*1A\s*[:,]?', '', r, flags=re.I)
    r = re.sub(r'\bCitation\s*[:=][^.]*', '', r, flags=re.I)
    r = re.sub(r'\bPosition\s*[:=][^.]*', '', r, flags=re.I)
    # cleanup punctuation and spaces
    r = re.sub(r'\s+', ' ', r)
    r = re.sub(r'\s*[,;:]\s*[,;:]', ',', r)
    r = re.sub(r'\s+\.', '.', r)
    r = re.sub(r'\.{2,}', '.', r)
    r = r.strip(' ,;:.-—–')
    if r and not r.endswith('.'):
        r += '.'
    return r

def build_rationale(risk, item1a):
    orig = risk.get('score_rationale','') or ''
    quote = extract_existing_quote(orig)
    if not quote:
        quote = find_quote_in_item1a(item1a, risk)
    if not quote:
        return None, False
    quote = truncate_15w(quote)
    pos = detect_position(orig, quote, item1a)
    justif = clean_justification(orig)
    if not justif:
        justif = f"Risque {risk.get('category','')} note {risk.get('score','')}/5."
    # Ensure em-dash never in output
    justif = justif.replace('—','-').replace('–','-')
    quote = quote.replace('—','-').replace('–','-').replace('"', "'")
    new = f'{justif} Citation: "{quote}". Position: {pos} Item 1A.'
    return new, True

def process_ticker(t):
    fname = t.lower() + '.json'
    p = os.path.join(BASE_JSON, fname)
    if not os.path.exists(p):
        return {'n_risks': 0, 'n_updated': 0, 'OK': False, 'err':'file missing'}
    with open(p) as f:
        d = json.load(f)
    risks = d.get('risks', [])
    if not isinstance(risks, list) or not risks:
        return {'n_risks': 0, 'n_updated': 0, 'OK': False, 'err':'no risks'}
    dl_ticker = t
    item1a = load_item1a(dl_ticker)
    if item1a is None and t == 'BRK-B':
        item1a = load_item1a('BRK-B') or load_item1a('BRK.B')
    n_updated = 0
    for r in risks:
        new, ok = build_rationale(r, item1a)
        if ok:
            r['score_rationale'] = new
            n_updated += 1
    with open(p, 'w') as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
    return {'n_risks': len(risks), 'n_updated': n_updated, 'OK': n_updated == len(risks)}

def main():
    out = {}
    for t in TICKERS:
        try:
            out[t] = process_ticker(t)
        except Exception as e:
            out[t] = {'n_risks':0,'n_updated':0,'OK':False,'err':str(e)}
    print(json.dumps(out, indent=2))

if __name__ == '__main__':
    main()
