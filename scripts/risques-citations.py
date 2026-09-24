#!/usr/bin/env python3
"""Remet la citation d origine (verbatim) sur les facteurs de risque.

Yann 23 septembre 2026. Le composant risk-stack.tsx coupe le depliant quand
`quote` est vide : sans la phrase du document, le risque n est pas verifiable.

Chaine :
 1. source servie = src/data/v2-pipeline/<t>.json, sauf si l enrich
    src/data/v2-pipeline-enrich/<t>.json fournit les risques (meme regle que
    load-company.ts : enrich gagne si base vide ou _risks_reextracted_at).
 2. texte du document = data-lake/<T>/_risks_src_30k.txt (ou repli).
 3. recuperation gratuite : la citation deja recopiee dans score_rationale.
 4. sinon moteur GRATUIT (Groq puis Gemini, jamais Claude) qui propose une
    phrase par risque.
 5. VERIFICATION MECANIQUE, sans modele : toute citation proposee doit etre
    retrouvee par recherche exacte dans le texte normalise du document, sinon
    elle est REJETEE et le risque est marque `_citation_non_etayee`.

Sauvegarde : chaque fichier est copie dans .conv-state/citations-risques/backup
avant la premiere ecriture. Reprise : .conv-state/citations-risques/etat.json
"""
from __future__ import annotations

import json
import os
import re
import shutil
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from moteur_gratuit import appelle, MoteurIndisponible  # noqa: E402

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ETAT_DIR = os.path.join(RACINE, ".conv-state", "citations-risques")
BACKUP_DIR = os.path.join(ETAT_DIR, "backup")
ETAT = os.path.join(ETAT_DIR, "etat.json")
MAX_CITATION = 320
SOURCE_BRUITEE = {"valeur": False}
MIN_CITATION = 45


# ---------------------------------------------------------------- normalisation
_REMPLACE = {
    "‘": "'", "’": "'", "‚": "'", "‛": "'",
    "“": '"', "”": '"', "„": '"', "«": '"', "»": '"',
    "–": "-", "—": "-", "−": "-", "‐": "-", "‑": "-",
    " ": " ", " ": " ", " ": " ", "​": "",
    "…": "...",
}


def normalise(txt: str) -> str:
    txt = unicodedata.normalize("NFC", txt or "")
    for a, b in _REMPLACE.items():
        txt = txt.replace(a, b)
    return re.sub(r"\s+", " ", txt).strip()


FIN_PHRASE = re.compile(r"(?<=[.!?])\s|\|\|\|")
MARQUEURS = (
    "risk", "risks", "could ", "may ", "might ", "adverse", "adversely", "fail",
    "failure", "uncertain", "disrupt", "decline", "loss", "losses", "liabilit",
    "exposure", "exposed", "threat", "volatil", "shortage", "penalt", "litigat",
    "risque", "risques", "pourrait", "pourraient", "peut ", "peuvent",
    "susceptible", "defaillance", "defaillances", "menace", "perte", "pertes",
    "impact", "incertitude", "sanction", "amende", "vulnerab",
)


def sans_accents(txt: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", txt.lower())
        if unicodedata.category(c) != "Mn"
    )


def debut_propre(phrase: str) -> bool:
    """Une citation commence au debut d une phrase, jamais au milieu d un mot
    ni sur un bout de phrase sans sujet."""
    p = phrase.lstrip()
    if not p:
        return False
    return p[0].isupper() or p[0].isdigit() or p[0] in "•\"'("


def porte_un_marqueur(phrase: str) -> bool:
    p = sans_accents(phrase)
    return any(m in p for m in MARQUEURS)


BRUIT_MISE_EN_PAGE = re.compile(
    r"(?:\b[A-Z][A-Z&/\-']{2,}\b[ ,]*){2,}|"      # suites de mots en capitales (entetes de tableau)
    r"\b(?:Annual Report|Rapport annuel|Universal Registration Document)\b[^.]{0,40}|"
    r"(?<= )\d{1,3}(?= [A-Z])"                      # numero de page colle au texte
)


def nettoie_bruit(phrase: str, ancre: str, source_bruitee: bool) -> str:
    """Retire les entetes de section et numeros de page colles au texte par
    l extraction. Ne fait que COUPER : le texte garde reste celui du document."""
    reperes = [(m.start(), m.end()) for m in BRUIT_MISE_EN_PAGE.finditer(phrase)]
    if reperes:
        bornes = [0]
        for a, b in reperes:
            bornes.extend([a, b])
        bornes.append(len(phrase))
        morceaux = [phrase[bornes[i]:bornes[i + 1]] for i in range(0, len(bornes) - 1, 2)]
        cle = ancre[:40]
        gardes = [m for m in morceaux if cle in m] or [max(morceaux, key=len)]
        phrase = gardes[0].strip(" ,;:-")
    if not source_bruitee:
        return phrase.strip()
    # coupure de ligne PDF : "mot Majuscule" juste avant l ancre = deux textes colles
    i = phrase.find(ancre[:40])
    if i > 0:
        avant = phrase[:i]
        if not re.search(r"[.!?]\s*$", avant):
            coupes = list(re.finditer(r"(?<=[a-z0-9,]) (?=[A-Z])", avant))
            if coupes:
                phrase = phrase[coupes[-1].end():]
    # source bruitee sans ponctuation finale : on ne garde que la tranche verifiee,
    # sinon on ramasse la ligne suivante du tableau.
    if not re.search(r"[.!?][\"']?$", phrase.strip()) and ancre in phrase:
        j = phrase.find(ancre)
        phrase = phrase[j:j + len(ancre)]
    return phrase.strip()


def etend_en_phrase(doc: str, debut: int, fin: int) -> str:
    """Remonte au debut de la phrase et descend jusqu a sa fin, dans le document.

    Evite les citations qui commencent ou finissent au milieu d une phrase.
    """
    gauche = max(0, debut - 700)
    amont = doc[gauche:debut]
    coupes = list(FIN_PHRASE.finditer(amont))
    d = gauche + coupes[-1].end() if coupes else (gauche if gauche == 0 else debut)
    droite = min(len(doc), fin + 700)
    aval = doc[fin:droite]
    m = FIN_PHRASE.search(aval)
    f = fin + m.start() + 1 if m else fin
    phrase = doc[d:f].strip()
    # une phrase qui commence par une minuscule = coupe mal detectee : on garde
    # la tranche verifiee elle meme plutot qu un debut faux.
    if len(phrase) > 900 or len(phrase) < (fin - debut):
        return doc[debut:fin].strip()
    return phrase


def termine_proprement(citation: str) -> str:
    """Une citation se termine sur une ponctuation, sinon la coupe est marquee."""
    c = citation.strip()
    if re.search(r"[.!?][\"')]?$", c):
        return c
    virgule = c.rfind(",")
    if virgule > MIN_CITATION:
        c = c[:virgule]
    return c.rstrip(" ,;:-") + "..."


def tronque_proprement(citation: str) -> str:
    """Coupe a MAX_CITATION sans jamais couper au milieu d un mot."""
    if len(citation) <= MAX_CITATION:
        return termine_proprement(citation)
    coupe = citation[:MAX_CITATION]
    espace = coupe.rfind(" ")
    if espace > MIN_CITATION:
        coupe = coupe[:espace]
    return coupe.rstrip(" ,;:.-") + "..."


# ---------------------------------------------------------------- fichiers
def lis_json(chemin):
    try:
        with open(chemin, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def dossier_data_lake(ticker: str):
    for nom in (ticker, ticker.upper(), ticker.lower()):
        d = os.path.join(RACINE, "data-lake", nom)
        if os.path.isdir(d):
            return d
    base = os.path.join(RACINE, "data-lake")
    if os.path.isdir(base):
        for nom in os.listdir(base):
            if nom.lower() == ticker.lower():
                return os.path.join(base, nom)
    return None


def texte_document(ticker: str):
    """Renvoie (texte normalise, chemin) ou (None, None)."""
    d = dossier_data_lake(ticker)
    if not d:
        return None, None
    for nom in ("_risks_src_30k.txt", "_risks_src.txt", "_srctext_60k.txt", "_srctext.txt"):
        p = os.path.join(d, nom)
        if os.path.exists(p):
            try:
                with open(p, encoding="utf-8", errors="ignore") as f:
                    brut = f.read()
            except Exception:
                continue
            if len(brut) > 500:
                t = normalise(brut)
                SOURCE_BRUITEE["valeur"] = nom.startswith("_srctext")
                if nom.startswith("_srctext"):
                    t = garde_section_risques(t)
                return t, os.path.relpath(p, RACINE)
    # repli : PDF du rapport annuel deja telecharge
    pdfs = []
    for rep, _, fichiers in os.walk(d):
        for f in fichiers:
            if f.lower().endswith(".pdf"):
                pdfs.append(os.path.join(rep, f))
    if pdfs and shutil.which("pdftotext"):
        pdfs.sort(key=lambda p: os.path.getsize(p), reverse=True)
        p = pdfs[0]
        cache = os.path.join(ETAT_DIR, "textes", f"{ticker}.txt")
        os.makedirs(os.path.dirname(cache), exist_ok=True)
        if not os.path.exists(cache):
            os.system(f'pdftotext -q "{p}" "{cache}" 2>/dev/null')
        if os.path.exists(cache):
            with open(cache, encoding="utf-8", errors="ignore") as f:
                brut = f.read()
            if len(brut) > 500:
                SOURCE_BRUITEE["valeur"] = True
                return garde_section_risques(normalise(brut)), os.path.relpath(p, RACINE)
    return None, None


def garde_section_risques(txt: str) -> str:
    """Ne conserve que les zones du document ou les facteurs de risque sont
    reellement traites. Sans ce filtre, une phrase du rapport du conseil ou
    d un entretien du dirigeant peut etre retenue a la place du risque."""
    fenetre = 2000
    morceaux = [txt[i:i + fenetre] for i in range(0, len(txt), fenetre)]
    gardes = []
    for m in morceaux:
        bas = sans_accents(m)
        densite = bas.count("risk") + bas.count("risque")
        if densite >= 3:
            gardes.append(m.strip())
    if not gardes:
        return txt
    joint = " ||| ".join(gardes)
    return joint if len(joint) > 4000 else txt


def source_risques(ticker: str):
    """Renvoie (chemin du fichier servi, donnees, liste des risques) ou None."""
    l = ticker.lower()
    pb = os.path.join(RACINE, "src/data/v2-pipeline", f"{l}.json")
    pe = os.path.join(RACINE, "src/data/v2-pipeline-enrich", f"{l}.json")
    base, enr = lis_json(pb), lis_json(pe)
    br = (base or {}).get("risks") or []
    er = (enr or {}).get("risks") or []
    if er and (not br or isinstance((enr or {}).get("_risks_reextracted_at"), str)):
        return pe, enr, er
    if br:
        return pb, base, br
    return None, None, []


# ---------------------------------------------------------------- verification
def verifie(propose: str, doc: str):
    """Recherche EXACTE dans le document normalise. Renvoie la tranche du
    document (donc le texte reel) ou None si la proposition est inventee."""
    cand = normalise(propose).strip(' "\'')
    if len(cand) < MIN_CITATION:
        return None
    if cand in doc:
        i = doc.index(cand)
        return nettoie_bruit(etend_en_phrase(doc, i, i + len(cand)), cand,
                             SOURCE_BRUITEE["valeur"])
    # tolerance de bord uniquement : on rogne la fin ou le debut d un mot
    mots = cand.split(" ")
    for retire in range(1, 6):
        if len(mots) - retire < 8:
            break
        court = " ".join(mots[:-retire])
        if len(court) >= MIN_CITATION and court in doc:
            i = doc.index(court)
            return nettoie_bruit(etend_en_phrase(doc, i, i + len(court)), court,
                                 SOURCE_BRUITEE["valeur"])
        court2 = " ".join(mots[retire:])
        if len(court2) >= MIN_CITATION and court2 in doc:
            i = doc.index(court2)
            return nettoie_bruit(etend_en_phrase(doc, i, i + len(court2)), court2,
                                 SOURCE_BRUITEE["valeur"])
    return None


def citation_du_rationale(risque):
    """Citation deja recopiee dans score_rationale : Citation: "..." """
    r = risque.get("score_rationale") or ""
    trouves = re.findall(r'[Cc]itation\s*:?\s*["“«]\s*(.+?)\s*["”»]', r, re.S)
    trouves += re.findall(r'["“]([^"”]{50,400})["”]', r)
    return trouves


# ---------------------------------------------------------------- moteur
PROMPT = """Tu recois la section des facteurs de risque du rapport annuel de {nom} ({ticker}),
puis une liste de risques deja titres. Pour CHAQUE risque, retrouve dans le document la
phrase qui le fonde et recopie la ENTIERE et MOT POUR MOT, de sa majuscule initiale a son
point final, sans rien changer, sans traduire, sans resumer, sans couper au milieu.
La phrase doit porter sur CE risque precis, pas sur un risque voisin, et elle doit
enoncer un risque (une menace, une consequence negative possible), pas une opportunite
ni un commentaire de gestion.
Si aucune phrase du document ne fonde vraiment le risque, renvoie une chaine vide.

Reponds en JSON strict : {{"citations": [{{"i": 0, "phrase": "..."}}, ...]}}
Une entree par risque, dans l ordre, "i" = numero du risque.

RISQUES :
{risques}

DOCUMENT :
{doc}
"""


def demande_moteur(nom, ticker, risques, doc, indices):
    liste = "\n".join(
        f'{i}. [{risques[i].get("category","")}] {risques[i].get("title","")} — '
        f'{(risques[i].get("summary") or risques[i].get("summary_fr") or risques[i].get("description") or "")[:260]}'
        for i in indices
    )
    prompt = PROMPT.format(nom=nom, ticker=ticker, risques=liste, doc=doc[:60000])
    donnees, moteur = appelle(prompt, json_attendu=True, temperature=0.0)
    sortie = {}
    items = donnees.get("citations") if isinstance(donnees, dict) else donnees
    if isinstance(items, list):
        for it in items:
            if not isinstance(it, dict):
                continue
            try:
                i = int(it.get("i"))
            except Exception:
                continue
            phrase = it.get("phrase") or it.get("quote") or ""
            if isinstance(phrase, str) and phrase.strip():
                sortie[i] = phrase
    return sortie, moteur


CONTROLE = """Voici des couples risque / citation tires du rapport annuel de {nom}.
Pour chaque couple, dis si la citation FONDE VRAIMENT ce risque precis : elle doit
parler du meme sujet et enoncer une menace, pas un risque voisin ni un propos de
gestion. En cas de doute, reponds non.

Reponds en JSON strict : {{"controles": [{{"i": 0, "correspond": true}}, ...]}}

COUPLES :
{couples}
"""


def controle_correspondance(nom, risques, retenues):
    """Seconde lecture du moteur gratuit. Elle ne peut que RETIRER une citation,
    jamais en creer une : le texte retenu vient toujours du document."""
    if not retenues:
        return set(), None
    couples = "\n\n".join(
        f'{i}. RISQUE : {risques[i].get("title","")} — '
        f'{(risques[i].get("summary") or risques[i].get("summary_fr") or risques[i].get("description") or "")[:200]}\n'
        f'   CITATION : {retenues[i][:400]}'
        for i in sorted(retenues)
    )
    try:
        donnees, moteur = appelle(CONTROLE.format(nom=nom, couples=couples),
                                  json_attendu=True, temperature=0.0)
    except MoteurIndisponible:
        return set(), None
    refuses = set()
    items = donnees.get("controles") if isinstance(donnees, dict) else donnees
    if not isinstance(items, list):
        return set(), moteur
    vus = set()
    for it in items:
        if not isinstance(it, dict):
            continue
        try:
            i = int(it.get("i"))
        except Exception:
            continue
        vus.add(i)
        ok = it.get("correspond")
        if ok is False or str(ok).lower() in ("false", "non", "no"):
            refuses.add(i)
    return refuses, moteur



# ---------------------------------------------------------------- decoupage
DEBRIS = re.compile(
    r"\b(?:taxonomy|taxonomie|CCM|CCA|WTR|PPC|BIO|CapEx table|Annual Report|"
    r"Rapport annuel|Universal Registration|GRI|see page|cf\. page|voir page)\b", re.I)
MODAUX = (
    "could", "may ", "might ", "can result", "can lead", "would ", "risk of",
    "risks of", "exposes", "exposed to", "subject to", "failure to", "if we fail",
    "adversely", "materially", "no assurance", "unable to",
    "pourrait", "pourraient", "peut ", "peuvent", "risque de", "risques de",
    "susceptible", "expose", "en cas de", "defaut de", "echec de",
)
ENUMERATION = re.compile(
    r"(?:\b(?:risk|risks|risque|risques)\b[^.]{0,60}){3,}", re.I)
ANNONCE = re.compile(
    r"\b(?:the following|as a result of our risk assessment|we identified the following|"
    r"are as follows|listed below|comme suit|les risques suivants|sont les suivants|"
    r"se decomposent en)\b", re.I)
AUDITEUR = re.compile(
    r"\b(?:auditor|auditors|audit report|independent audit|our audit|key audit matter|"
    r"audit procedures|materiality|misstatement|assurance engagement|commissaire aux comptes|"
    r"rapport d audit|nos travaux|override of controls|inherent risk|journal entries|"
    r"fraud risk|we have identified the|going concern assumption|internal control over "
    r"financial reporting|nos diligences|anomalies significatives)\b", re.I)
RECIT = (
    "remains high on the agenda", "we had some", "in line with the", "our ambition",
    "we are proud", "we continue to work", "stakeholder dialogue", "we believe that our",
    "nous sommes fiers", "notre ambition", "engagement de la direction",
)


def phrases_du_document(doc: str):
    """Decoupe mecanique en phrases, puis retrait des lignes de tableau et des
    passages de recit qui ne fondent aucun risque."""
    brut = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\u00c0-\u00dc])", doc)
    gardees = []
    for ph in brut:
        if "|||" in ph:
            continue
        ph = ph.strip()
        if not (70 <= len(ph) <= 700):
            continue
        if not (ph[0].isupper() or ph[0].isdigit()):
            continue
        if not re.search(r"[.!?][\"')]?$", ph):
            continue
        bas = sans_accents(ph)
        if not any(m in bas for m in MODAUX):
            continue
        if DEBRIS.search(ph) or any(r in bas for r in RECIT):
            continue
        # chapeau de section ou enumeration de familles de risques : cela ne fonde rien
        if ANNONCE.search(ph) or AUDITEUR.search(ph):
            continue
        if ph.count(",") >= 3 and len(re.findall(r"\brisks?\b|\brisques?\b", bas)) >= 2:
            continue
        if ph.count(",") >= 4:
            segments = [m.strip() for m in ph.split(",")]
            courts = sum(1 for m in segments if 0 < len(m.split()) <= 4)
            if courts >= 4:
                continue
        # reliquat de tableau : trop de chiffres, de pourcentages ou de capitales
        chiffres = sum(c.isdigit() for c in ph)
        if chiffres / len(ph) > 0.08 or ph.count("%") > 2:
            continue
        if len(re.findall(r"\b[A-Z][A-Z&/\-']{2,}\b", ph)) > 2:
            continue
        mots = ph.split()
        if len(mots) < 12:
            continue
        if sum(1 for m in mots if m[:1].islower()) / len(mots) < 0.5:
            continue
        gardees.append(ph)
    # dedoublonnage en gardant l ordre du document
    vues, sortie = set(), []
    for ph in gardees:
        cle = ph[:80].lower()
        if cle in vues:
            continue
        vues.add(cle)
        sortie.append(ph)
    return sortie


# lexique FR -> EN, pour rapprocher un titre francais d un document anglais
LEXIQUE = {
    "cyber": ("cyber", "security", "breach", "hacking", "ransomware", "information system", "data"),
    "donnee": ("data", "privacy", "personal information", "gdpr"),
    "change": ("currency", "exchange rate", "foreign currency"),
    "taux": ("interest rate", "rates"),
    "credit": ("credit", "counterparty", "default", "borrower"),
    "liquidite": ("liquidity", "funding", "refinanc"),
    "reglementaire": ("regulat", "law", "legal", "compliance", "government"),
    "fiscal": ("tax", "taxation"),
    "concurrence": ("competit", "pricing pressure", "market share"),
    "approvisionnement": ("supply chain", "supplier", "logistic", "shortage", "component"),
    "production": ("manufactur", "production", "facilit", "capacity"),
    "climat": ("climate", "environmental", "emission", "weather", "carbon"),
    "talent": ("personnel", "employee", "talent", "workforce", "key employees"),
    "acquisition": ("acquisition", "integration", "strategic transaction"),
    "propriete": ("intellectual property", "patent", "trademark", "infringe"),
    "litige": ("litigation", "lawsuit", "claims", "proceeding"),
    "reputation": ("reputation", "brand"),
    "geopolitique": ("geopolitic", "tariff", "trade", "conflict", "sanction", "war"),
    "macro": ("macroeconomic", "economic conditions", "inflation", "recession", "demand"),
    "innovation": ("technolog", "innovation", "new products", "obsolescence"),
    "intelligence": ("artificial intelligence", " ai ", "machine learning"),
    "client": ("customer", "client", "concentration"),
    "sante": ("clinical", "product liability", "safety", "recall", "patient"),
    "brevet": ("patent", "exclusivity", "generic", "biosimilar"),
    "energie": ("energy", "commodity", "oil", "gas", "electricity"),
    "immobilier": ("real estate", "property", "lease", "tenant"),
    "gouvernance": ("governance", "internal control", "board"),
    "assurance": ("catastrophe", "underwriting", "claims", "reserves"),
    "personnel": ("employee", "labor", "union", "strike"),
    "prix": ("pricing", "price", "reimbursement"),
    "distribution": ("distribution", "retail", "store", "channel"),
    "dette": ("indebtedness", "debt", "leverage", "covenant"),
    "cloud": ("cloud", "service interruption", "outage", "platform"),
}


def mots_cles(risque):
    txt = sans_accents(" ".join([
        str(risque.get("title") or ""),
        str(risque.get("category") or ""),
        str(risque.get("summary") or risque.get("summary_fr") or risque.get("description") or ""),
    ]))
    cles = set()
    for racine, equivalents in LEXIQUE.items():
        if racine in txt:
            cles.update(equivalents)
    for mot in re.findall(r"[a-z]{6,}", txt):
        cles.add(mot[:6])
    return cles


def preselection(risque, phrases, maxi=25):
    cles = mots_cles(risque)
    notes = []
    for i, ph in enumerate(phrases):
        bas = sans_accents(ph)
        note = sum(1 for c in cles if c in bas)
        if note:
            notes.append((note, -len(ph), i))
    notes.sort(reverse=True)
    retenus = [i for _, _, i in notes[:maxi]]
    if len(retenus) < 8:
        retenus = list(range(min(len(phrases), maxi)))
    return sorted(set(retenus))


DESIGNE = """Voici un facteur de risque de {nom}, puis des phrases NUMEROTEES tirees de son
rapport annuel. Designe le NUMERO de la phrase qui fonde le mieux CE risque precis.
La phrase doit enoncer une menace pour la societe et porter sur le meme sujet que le risque.
Si aucune phrase ne convient, reponds 0. Ne recopie rien, ne reformule rien.

Reponds en JSON strict : {{"numero": N}}

RISQUE : {titre}
PRECISION : {precision}

PHRASES :
{phrases}
"""


def designe_phrase(nom, risque, phrases, indices):
    liste = "\n".join(f"{i}. {phrases[i]}" for i in indices)
    prompt = DESIGNE.format(
        nom=nom,
        titre=risque.get("title") or "",
        precision=(risque.get("summary") or risque.get("summary_fr")
                   or risque.get("description") or "")[:300],
        phrases=liste,
    )
    donnees, moteur = appelle(prompt, json_attendu=True, temperature=0.0)
    numero = None
    if isinstance(donnees, dict):
        for cle in ("numero", "number", "n", "index"):
            if cle in donnees:
                try:
                    numero = int(donnees[cle])
                except Exception:
                    numero = None
                break
    return numero, moteur


# ---------------------------------------------------------------- traitement
def sauvegarde(chemin):
    os.makedirs(BACKUP_DIR, exist_ok=True)
    cible = os.path.join(BACKUP_DIR, os.path.relpath(chemin, RACINE).replace("/", "__"))
    if not os.path.exists(cible):
        shutil.copy2(chemin, cible)


def traite(ticker, nom, ecrire=True):
    res = {"ticker": ticker, "risques": 0, "etayes": 0, "rejets": 0, "propositions": 0,
           "rationale": 0, "non_etayes": 0, "moteur": None, "doc": None, "erreur": None,
           "hors_liste": 0, "sans_phrase": 0}
    chemin, donnees, risques = source_risques(ticker)
    if not risques:
        res["erreur"] = "aucun risque"
        return res
    doc, src = texte_document(ticker)
    if not doc:
        res["erreur"] = "document absent"
        return res
    res["doc"] = src
    res["risques"] = len(risques)
    phrases = phrases_du_document(doc)
    res["phrases_candidates"] = len(phrases)
    if len(phrases) < 5:
        res["erreur"] = "decoupage insuffisant"
        return res

    retenues = {}
    for i, r in enumerate(risques):
        indices = preselection(r, phrases)
        try:
            numero, moteur = designe_phrase(nom, r, phrases, indices)
        except MoteurIndisponible as e:
            res["erreur"] = f"moteur indisponible: {e}"
            break
        res["moteur"] = moteur or res["moteur"]
        res["propositions"] += 1
        if numero is None or numero == 0:
            res["sans_phrase"] += 1
            continue
        if numero not in indices:
            res["hors_liste"] += 1
            res["rejets"] += 1
            continue
        phrase = phrases[numero]
        # filet : la phrase designee doit se retrouver telle quelle dans le document
        if phrase not in doc:
            res["rejets"] += 1
            res["decoupage_fautif"] = res.get("decoupage_fautif", 0) + 1
            continue
        retenues[i] = phrase

    refuses, moteur_ctrl = controle_correspondance(nom, risques, retenues)
    res["rejets_correspondance"] = len(refuses)
    res["rejets"] += len(refuses)
    for i in refuses:
        retenues.pop(i, None)
    res["moteur_controle"] = moteur_ctrl

    for i, r in enumerate(risques):
        if i in retenues:
            r["quote"] = tronque_proprement(retenues[i])
            r.pop("_citation_non_etayee", None)
            res["etayes"] += 1
        elif (r.get("quote") or "").strip():
            res["etayes"] += 1
        else:
            r["_citation_non_etayee"] = True
            res["non_etayes"] += 1

    if ecrire and retenues:
        sauvegarde(chemin)
        donnees["_citations_risques_at"] = "2026-09-23"
        with open(chemin, "w", encoding="utf-8") as f:
            json.dump(donnees, f, ensure_ascii=False, indent=1)
    res["fichier"] = os.path.relpath(chemin, RACINE)
    return res


def charge_etat():
    e = lis_json(ETAT) or {"faits": {}, "totaux": {}}
    e.setdefault("faits", {})
    return e


def ecris_etat(e):
    os.makedirs(ETAT_DIR, exist_ok=True)
    with open(ETAT, "w", encoding="utf-8") as f:
        json.dump(e, f, ensure_ascii=False, indent=1)


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--lot", type=int, default=20)
    ap.add_argument("--essai", action="store_true", help="n ecrit rien")
    ap.add_argument("--tickers", default="")
    ap.add_argument("--etat", default="")
    ap.add_argument("--part", default="", help="i/n : traite la part i sur n")
    args = ap.parse_args()

    univers = lis_json(os.path.join(RACINE, "src/data/v1-9-5-clean-all-tickers.json"))
    if isinstance(univers, dict):
        univers = univers.get("tickers") or list(univers.keys())
    noms = lis_json(os.path.join(RACINE, "src/data/v1-9-5-names.json")) or {}

    global ETAT
    if args.etat:
        ETAT = os.path.join(ETAT_DIR, args.etat)
    etat = charge_etat()
    faits_ailleurs = set()
    for f in os.listdir(ETAT_DIR) if os.path.isdir(ETAT_DIR) else []:
        if f.startswith("etat") and f.endswith(".json"):
            autre = lis_json(os.path.join(ETAT_DIR, f)) or {}
            faits_ailleurs.update((autre.get("faits") or {}).keys())
    if args.tickers:
        a_faire = [t.strip() for t in args.tickers.split(",") if t.strip()]
    else:
        restants = [t for t in univers if t not in faits_ailleurs]
        if args.part:
            i, n = (int(x) for x in args.part.split("/"))
            restants = [t for k, t in enumerate(restants) if k % n == i]
        a_faire = restants[:args.lot]

    for t in a_faire:
        nom = noms.get(t) or noms.get(t.upper()) or t
        if isinstance(nom, dict):
            nom = nom.get("name") or t
        try:
            r = traite(t, nom, ecrire=not args.essai)
        except Exception as exc:
            r = {"ticker": t, "erreur": f"{type(exc).__name__}: {exc}"}
        if not args.essai:
            etat["faits"][t] = r
            ecris_etat(etat)
        print(json.dumps(r, ensure_ascii=False))


if __name__ == "__main__":
    main()
