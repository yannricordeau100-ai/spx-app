#!/usr/bin/env python3
"""Corrections mecaniques sures des textes servis (29 sept 2026), en simulation par defaut.
  --ecrit : applique.
Regles : uniquement des valeurs texte d au moins 25 caracteres, jamais les cles ni les
champs courts (enumerations), jamais les champs source/preuve/evidence/URL.
  1. accents manquants : liste fermee de mots sans ambiguite (societe -> société ...), casse conservee ;
  2. apostrophes manquantes : d un -> d'un, l entreprise -> l'entreprise ... (liste fermee) ;
  3. point decimal dans un nombre suivi d une unite ou d un % : 3.4 % -> 3,4 % ;
  4. codes de documents : (10-K), (10-Q), 20-F, 8-K, DEF 14A, Form 10-K, Item 1A, URD -> retires ou remplaces ;
  5. tirets longs -> virgule ou deux points selon le contexte.
"""
import json, glob, re, sys, os, unicodedata
from collections import Counter
os.chdir('/Users/yann/spx-app')
ECRIT = '--ecrit' in sys.argv

ACCENTS = {'societe': 'société', 'societes': 'sociétés', 'resultat': 'résultat', 'resultats': 'résultats', 'annee': 'année', 'annees': 'années', 'apres': 'après', 'tres': 'très', 'premiere': 'première', 'derniere': 'dernière', 'benefice': 'bénéfice', 'benefices': 'bénéfices', 'activite': 'activité', 'activites': 'activités', 'strategie': 'stratégie', 'strategies': 'stratégies', 'capacite': 'capacité', 'capacites': 'capacités', 'quantite': 'quantité', 'periode': 'période', 'periodes': 'périodes', 'deja': 'déjà', 'generale': 'générale', 'numerique': 'numérique', 'numeriques': 'numériques', 'systeme': 'système', 'systemes': 'systèmes', 'electrique': 'électrique', 'electriques': 'électriques', 'energie': 'énergie', 'energies': 'énergies', 'americain': 'américain', 'americaine': 'américaine', 'europeen': 'européen', 'europeenne': 'européenne', 'reseau': 'réseau', 'reseaux': 'réseaux', 'developpement': 'développement', 'different': 'différent', 'differente': 'différente', 'differents': 'différents', 'prevu': 'prévu', 'prevue': 'prévue', 'marche': 'marché', 'marches': 'marchés', 'donnees': 'données', 'operationnel': 'opérationnel', 'operationnelle': 'opérationnelle', 'realite': 'réalité', 'dependance': 'dépendance', 'independant': 'indépendant', 'reglementaire': 'réglementaire', 'reglementation': 'réglementation', 'securite': 'sécurité', 'sante': 'santé', 'medicaments': 'médicaments', 'hopitaux': 'hôpitaux', 'equipements': 'équipements', 'telephonie': 'téléphonie', 'electricite': 'électricité', 'petrole': 'pétrole', 'pieces': 'pièces', 'matieres': 'matières', 'premieres': 'premières', 'numero': 'numéro', 'meme': 'même', 'memes': 'mêmes', 'etre': 'être', 'etait': 'était', 'etaient': 'étaient', 'ete': 'été', 'cree': 'créé', 'creee': 'créée', 'clientele': 'clientèle', 'fidelite': 'fidélité', 'qualite': 'qualité', 'rentabilite': 'rentabilité', 'volatilite': 'volatilité', 'liquidite': 'liquidité', 'visibilite': 'visibilité', 'competitivite': 'compétitivité', 'proprietaire': 'propriétaire', 'propriete': 'propriété', 'proprietes': 'propriétés', 'recurrent': 'récurrent', 'recurrente': 'récurrente', 'recurrents': 'récurrents', 'recurrentes': 'récurrentes', 'reguliere': 'régulière', 'regulier': 'régulier', 'acces': 'accès', 'succes': 'succès', 'proces': 'procès', 'congres': 'congrès', 'interet': 'intérêt', 'interets': 'intérêts', 'etranger': 'étranger', 'etrangere': 'étrangère', 'hotel': 'hôtel', 'hotels': 'hôtels', 'cout': 'coût', 'couts': 'coûts', 'controle': 'contrôle', 'reelle': 'réelle', 'reel': 'réel', 'reels': 'réels', 'ecart': 'écart', 'ecarts': 'écarts', 'evenement': 'événement', 'evenements': 'événements', 'efficacite': 'efficacité', 'epargne': 'épargne', 'equilibre': 'équilibre', 'etude': 'étude', 'etudes': 'études', 'independance': 'indépendance', 'ingenierie': 'ingénierie', 'progres': 'progrès', 'regle': 'règle', 'regles': 'règles', 'remuneration': 'rémunération', 'repartition': 'répartition', 'retablissement': 'rétablissement', 'reussite': 'réussite', 'specifique': 'spécifique', 'specifiques': 'spécifiques', 'tresorerie': 'trésorerie'}
RX_ACC = re.compile(r"(?<![A-Za-zÀ-ÿ'’])(" + '|'.join(sorted(ACCENTS, key=len, reverse=True)) + r")(?![A-Za-zÀ-ÿ'’])", re.I)
def acc_sub(m):
    w = m.group(1); rep = ACCENTS[w.lower()]
    if w.isupper(): return rep.upper()
    if w[0].isupper(): return rep[0].upper() + rep[1:]
    return rep

APOS_SUITE = r"(un|une|autre|autres|abord|ailleurs|entreprise|entreprises|exercice|activit[ée]s?|actions?|ann[ée]es?|environ|origine|accord|achat|achats|affaires|ordre|eau|[ée]nergie|espace|effet|[ée]tat|Europe|Asie|Am[ée]rique|Afrique|Inde|Italie|Espagne|Allemagne|investissements?|utilisateurs?|usines?|unit[ée]s?|obligations?|options?|objectifs?|op[ée]rations?|infrastructures?|innovations?|intelligence|assurances?|analyses?|abonn[ée]s|actifs?|acquisitions?|augmenter|atteindre|il|elle|ils|elles|on|est|[ée]tait|y|a|à|en|au|aux|ici|hier|aujourd|habitude|histoire|horizon|[ée]conomie|[ée]lectricit[ée]|[ée]quipements?|[ée]missions?|[ée]chelle|indice|impact|int[ée]r[êe]ts?|exposition|expansion|exploitation|offre|offres|outil|outils|or|arr[êe]t|ouverture|ensemble|encours|effectifs?|emplois?|entr[ée]es?|[ée]cart|[ée]volution|utilisation|usage|automobile|avion|avions|avantage|avantages|acc[èe]s|adoption|application|applications|approche|approvisionnement|augmentation|abonnement|abonnements|Internet|iPhone|Airbus|Alphabet|Oracle|Intel|Uber|Nvidia|Adobe|Airbnb|Allianz|AXA|ING|UBS|Herm[èe]s|Air Liquide|Orange|Eni|Enel|Iberdrola|Unilever|EssilorLuxottica|Ahold|IA)"
RX_APOS = re.compile(r"(?<![A-Za-zÀ-ÿ&'’])([dDlLsScCjJnN]|[Qq]u) " + APOS_SUITE + r"(?![A-Za-zÀ-ÿ])")
def apos_sub(m):
    return m.group(1) + "'" + m.group(2)

RX_DEC = re.compile(r"(?<![\d.])(\d{1,3})\.(\d{1,2})(?=\s?(%|Mds|Md\b|M\b|M\$|M€|k\b|milliards|millions|\$|€|£|CHF|pts|points|x\b|-\d))")
RX_TIRET = re.compile(r"\s*[—–]\s*")
DOC_PAREN = re.compile(r"\s*\((?=(?:[^()]|\([^()]*\))*\b(?:10-?K|10-?Q|20-?F|8-?K|6-?K|DEF ?14A|Form 10|Formulaire 10|Item \d[A-Z]?|URD|verbatim|tableau|table)\b)(?:[^()]|\([^()]*\))*\)")
PHRASE_TABLEAU = re.compile(r",?\s*(?:issus?|issues?|tir[ée]e?s?|extraits?|publi[ée]e?s?|repris|lus?|releve[ée]?s?|tel(?:le)?s? que publi[ée]e?s?)\s+(?:du|de la|des|dans le|dans la|dans les|au)\s+(?:tableau|table|note|section|page|supplement|suppl[ée]ment)\b[^.;]*", re.I)
DOC_CODE = re.compile(r"\b(?:formulaire |form |Form |rapport )?(10-?K/20-?F|10-?K|10-?Q|20-?F|8-?K|6-?K|DEF ?14A)\b(?: \d{4})?(?: de l.exercice \d{4}| \(exercice \d{4}\))?")
RX_ITEM_PAREN = re.compile(r"\s*\((?:Item|Section) \d+[A-Z]?(?!\.\d)[^()]*\)", re.I)
RX_ITEM_POS = re.compile(r"\b(haut|milieu|bas|d[ée]but|fin|premier tiers|dernier tiers|premi[èe]re moiti[ée]|seconde moiti[ée]) (?:de )?(?:l['’]\s?)?Item 1A\b", re.I)
RX_ITEM1A = re.compile(r"(?:dans |de |du |à |sur )?l['’]\s?Item 1A\b|\bItem 1A\b", re.I)
RX_ITEM_AUTRE = re.compile(r",?\s*\(?\bItem \d+[A-Z]?\b(?!\.\d)(?: du (?:10-K|10-Q|20-F))?\)?", re.I)
RX_PLURIEL = re.compile(r"\b(des|les|aux|ses|nos|leurs) (10-?Q et 10-?K|10-?K et 10-?Q|10-?Q|10-?K|20-?F|8-?K)\b(?! \d{4})")
RX_NOM_ADJ = re.compile(r"\b(bilans?|comptes?|tableaux?|[ée]tats?|r[ée]sultats?|chiffres?|donn[ée]es) (10-?Q|10-?K|20-?F)\b(?! \d{4})")

EXCLUS_CLES = {'source', 'sources', 'preuve', 'evidence', 'evidence_fr', 'quote', 'source_note', 'source_url', 'url', 'image_url', 'titre_source', 'source_titre', 'citation', 'verbatim', '_sources', 'glossaire', 'name_en', 'title_en', 'description_en', 'summary_en', 'company_description'}

def acc_sub_min(m):
    w = m.group(1)
    if w[0].isupper(): return w  # jamais un nom propre ou un debut de phrase en anglais (Coherent, Precision)
    return ACCENTS[w.lower()]
def corrige(v, stats, anglais=False):
    n = v
    if not anglais:
        n2 = RX_ACC.sub(acc_sub_min, n)
        if n2 != n: stats['accents'] += 1; n = n2
        n2 = RX_APOS.sub(apos_sub, n)
        if n2 != n: stats['apostrophes'] += 1; n = n2
    n2 = re.sub(r"(?<![\d.,])(\d{1,3}),(\d{3})\.(\d{1,2})(?=\s?(%|Mds|Md\b|M\b|M\$|M€|k\b|milliards|millions|\$|€|£|CHF))", lambda m: m.group(1) + '\u202f' + m.group(2) + ',' + m.group(3), n)
    n2 = RX_DEC.sub(lambda m: m.group(1) + ',' + m.group(2), n2)
    if n2 != n: stats['decimales'] += 1; n = n2
    n2 = DOC_PAREN.sub('', n)
    n2 = PHRASE_TABLEAU.sub('', n2)
    n2 = RX_ITEM_PAREN.sub('', n2)
    n2 = RX_ITEM_POS.sub(lambda m: m.group(1) + ' de la section des risques', n2)
    n2 = RX_ITEM1A.sub(lambda m: 'dans la section des risques' if m.group(0).lower().startswith(('dans', 'de ', 'du ', 'à ', 'sur ')) else 'la section des risques', n2)
    n2 = RX_ITEM_AUTRE.sub('', n2)
    def pluriel(m):
        c = m.group(2).replace('-', '').upper()
        if 'Q' in c and 'K' in c: f = 'rapports trimestriels et annuels'
        elif 'Q' in c: f = 'rapports trimestriels'
        elif '8K' in c: f = 'communiqués'
        else: f = 'rapports annuels'
        return m.group(1) + ' ' + f
    n2 = RX_PLURIEL.sub(pluriel, n2)
    n2 = RX_NOM_ADJ.sub(lambda m: m.group(1) + (' trimestriels' if 'Q' in m.group(2).upper() else ' annuels') if m.group(1).endswith('s') else m.group(1) + (' trimestriel' if 'Q' in m.group(2).upper() else ' annuel'), n2)
    n2 = DOC_CODE.sub(lambda m: 'rapport annuel' if re.search(r'10-?K|20-?F', m.group(1)) else ('rapport trimestriel' if re.search(r'10-?Q|6-?K', m.group(1)) else ('communiqué' if '8' in m.group(1) else 'document de référence')), n2)
    n2 = n2.replace('rapport rapport', 'rapport').replace('formulaire rapport', 'rapport')
    if n2 != n: stats['documents'] += 1; n = n2
    n2 = re.sub(r"\s*\(_derived\)|\s+_derived\b|\b_derived\s*", '', n)
    if n2 != n: stats['derived'] += 1; n = n2
    n2 = RX_TIRET.sub(', ', n)
    if n2 != n: stats['tirets'] += 1; n = n2
    n = re.sub(r'\s+([.,;:])', r'\1', n) if False else n  # espace avant : conservee (typographie francaise)
    n = re.sub(r'\s{2,}', ' ', n).strip()
    n = re.sub(r'\(\s*\)', '', n)
    return n

VISIBLES = {'name_fr', 'signal', 'signal_fr', 'description_fr', 'description', 'summary', 'title', 'titre', 'hook', 'resume', 'argument', 'texte', 'text', 'justification', 'justification_mettrik', 'commentaire', 'simple', 'preambule', 'element_additionnel', 'score_rationale', 'lecture', 'explanation', 'explanation_fr', 'label', 'question', 'reponse', 'analyse', 'conclusion', 'contexte', 'impact', 'mitigation', 'why_it_matters', 'interpretation', 'interpretation_fr', 'stance_rationale', 'moat_rationale', 'trend_rationale', 'rationale', 'caption', 'note_fr', 'evidence_fr_text'}
RX_EN_TXT = re.compile(r'\b(the|and|with|from|which|revenue|growth|increase|decrease|compared to|as of|billion|million|company|customers|driven by|our|we|of the)\b', re.I)
RX_FR_TXT = re.compile(r'\b(le|la|les|des|du|une|un|et|sur|par|avec|pour|dans|en|est|sont|ce|cette|ces|au|aux)\b', re.I)
def est_visible(chemin, k):
    ch = chemin.lower()
    if 'i18n' in ch or '.en.' in ch + '.' or ch.endswith('.en') or '_en' in ch or 'notes' in ch or 'source' in ch or 'company_description' in ch or 'exhaustive' in ch or 'tagline' in ch: return False
    if k in VISIBLES: return True
    if '.fr.' in ch + '.': return True
    return False
def corrige_si(v, stats, chemin, k):
    anglais = len(RX_EN_TXT.findall(v)) >= 3 and len(RX_EN_TXT.findall(v)) > len(RX_FR_TXT.findall(v))
    return corrige(v, stats, anglais)
def walk(o, stats, exemples, chemin=''):
    if isinstance(o, dict):
        for k, v in o.items():
            if k.startswith('_') or k in EXCLUS_CLES: continue
            if isinstance(v, str):
                if len(v) >= 25 and not v.startswith('http') and est_visible(chemin + '.' + k, k):
                    n = corrige_si(v, stats, chemin, k)
                    if n != v:
                        o[k] = n
                        exemples.append((chemin + '.' + k, v[:130], n[:130]))
            else: walk(v, stats, exemples, chemin + '.' + k)
    elif isinstance(o, list):
        for i, v in enumerate(o):
            if isinstance(v, str):
                if len(v) >= 25 and not v.startswith('http') and est_visible(chemin, chemin.rsplit('.', 1)[-1].split('[')[0]):
                    n = corrige_si(v, stats, chemin, '')
                    if n != v:
                        o[i] = n
                        exemples.append((f'{chemin}[{i}]', v[:130], n[:130]))
            else: walk(v, stats, exemples, f'{chemin}[{i}]')

def indent_de(raw):
    return 2 if raw.startswith('{\n  "') or raw.startswith('[\n  ') else (1 if raw.startswith('{\n "') or raw.startswith('[\n {') else None)

fichiers = (glob.glob('.batches-drafts-safe/kpis-haut/*.json') + glob.glob('src/data/v2-pipeline/*.json') + glob.glob('src/data/v2-pipeline-enrich/*.json')
            + glob.glob('src/data/v2-pipeline-specific-kpis/*.json') + glob.glob('src/data/these/*.json') + glob.glob('src/data/att/*.json')
            + glob.glob('docs/cahier/clients/*.json') + glob.glob('docs/cahier/tam/*.json') + ['docs/cahier/moat.json', 'docs/cahier/moat-tendance-mettrik.json']
            + glob.glob('src/data/kpi-annuel-fiche/*.json') + glob.glob('src/data/transcript-summaries/*.json'))
UNIVERS = set(l.strip() for l in open('/private/tmp/claude-501/-Users-yann/f9760fc2-7eac-4e41-821a-262ae5427645/scratchpad/tickers.txt'))
UNIV_L = {t.lower() for t in UNIVERS}
def dans_univers(f):
    b = os.path.basename(f)
    if b in ('moat.json', 'moat-tendance-mettrik.json'): return True
    racine = re.split(r'\.(?:json|gemini|risks|i18n|governance|tam|clients|ranks|calls|suivi)', b)[0]
    return racine in UNIVERS or racine in UNIV_L
total = Counter(); nf = 0; exemples = []
for f in fichiers:
    if 'bak' in f or '_merged' in f or 'wkl.as' in f.lower() or not dans_univers(f): continue
    try: raw = open(f).read(); d = json.loads(raw)
    except Exception: continue
    stats = Counter()
    walk(d, stats, exemples, os.path.basename(f))
    if stats:
        nf += 1; total.update(stats)
        if ECRIT:
            ind = indent_de(raw)
            out = json.dumps(d, ensure_ascii=False, indent=ind)
            open(f, 'w').write(out + ('\n' if raw.endswith('\n') else ''))
print('fichiers touches', nf, dict(total))
import random
random.seed(11)
for e in random.sample(exemples, min(45, len(exemples))): print(' -', e[0][:60], '|', e[1], '=>', e[2])
json.dump(exemples, open('/private/tmp/claude-501/-Users-yann/f9760fc2-7eac-4e41-821a-262ae5427645/scratchpad/detecteurs/textes-diff.json', 'w'), ensure_ascii=False)
