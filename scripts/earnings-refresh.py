#!/usr/bin/env python3
"""
scripts/earnings-refresh.py — mise à jour de TOUS les KPI à chaque publication
de résultats, pour les 656 sociétés de l'app, US comme non US.

Spécification Yann (26 août 2026) : « à chaque publication de résultats, pour
chaque société, tous les documents fournis sont analysés et chaque KPI reçoit
son nouveau point, trimestre ou semestre. »

Ce script est le chef d'orchestre. Il ne devine rien lui-même : il assemble
le dossier de travail d'une publication, puis confie l'extraction au moteur
disponible.

  1. DÉTECTION   quels documents sont plus récents que le dernier point connu
  2. DOSSIER     communiqué, présentation, transcript, rapport : tout est pris
  3. EXTRACTION  une valeur par KPI suivi, pour la période publiée
  4. VÉRIFICATION le chiffre doit figurer littéralement dans un des documents
  5. ÉCRITURE    le point est ajouté à l'historique, jamais en remplacement

Deux moteurs d'extraction, choisis automatiquement :
  - `api`     : un moteur GRATUIT répond (Cerebras, puis Groq, puis Gemini,
                via scripts/moteur_gratuit.py) ;
  - `dossier` : aucun ne répond, le script écrit alors un dossier de travail
                complet par société dans .conv-state/earnings-inbox/, prêt à
                être traité, plutôt que de ne rien faire.

23 septembre 2026 : ce script n'appelle PLUS Claude, sous aucune condition.
Une tâche automatique qui appelle Claude est facturée au compte connecté au
hasard du moment : c'est ainsi que 864 millions de jetons ont été facturés au
mauvais compte entre le 20 et le 22 septembre. Comme le moteur gratuit se
trompe davantage qu'un grand modèle, les vérifications ont été RENFORCÉES :
la phrase de preuve doit se retrouver mot pour mot dans un document, et elle
doit contenir le chiffre annoncé.

Usage :
  python3 scripts/earnings-refresh.py --scan                 # que faut-il traiter
  python3 scripts/earnings-refresh.py --tickers=ADS.DE --dry-run
  python3 scripts/earnings-refresh.py --apply --limit=20
"""
from __future__ import annotations

import argparse
import gzip
import json
import re
import ssl
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from moteur_gratuit import MoteurIndisponible, appelle as appelle_moteur_gratuit, charge_env  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
PIPE = ROOT / "src" / "data" / "v2-pipeline"
HAUT = ROOT / ".batches-drafts-safe" / "kpis-haut"
LAKE = ROOT / "data-lake"
UNIVERSE = ROOT / "src" / "data" / "v1-9-5-clean-all-tickers.json"
INBOX = ROOT / ".conv-state" / "earnings-inbox"
STATE = ROOT / ".conv-state" / "earnings-refresh-state.json"
ENV = ROOT / ".env.local"

# Dossiers de documents porteurs de chiffres trimestriels ou semestriels.
# US : 8-K (communiqué), ER (exhibit résultats), EP (présentation), 10-Q/10-K.
# Hors US : CP (communiqué), SLIDES (présentation), TRIM, RFS (semestriel), URD.
DOC_DIRS_US = ("ER", "8K", "EP", "10Q", "10K")
# ir/SEMESTRIEL, ir/PRESENTATION et ir/S1 sont les dossiers ou la chaine
# post-resultats depose les documents depuis le 18 sept 2026 : sans eux,
# les semestriels europeens restaient invisibles et l extraction relisait
# de vieux URD (Yann, 21 sept 2026).
DOC_DIRS_EU = ("ir/CP", "ir/SLIDES", "ir/TRIM", "ir/RFS", "ir/URD",
               "ir/SEMESTRIEL", "ir/PRESENTATION", "ir/S1", "ir/COMMUNIQUES",
               "ir/COMMUNIQUE", "ir/PRES")
MAX_DOCS = 4
MAX_CHARS_PER_DOC = 60000

# Suffixes de place hors Etats-Unis. Les dossiers SEC (10-Q, 10-K, 8-K...) de ces
# societes contiennent en realite les depots d'une societe americaine homonyme :
# le collecteur SEC a interroge le ticker de base (MC -> Moelis pour MC.PA,
# AI -> C3.ai pour AI.PA, HEI -> HEICO pour HEI.DE...). Les lire injecterait les
# chiffres d'une autre societe. On ne les ouvre jamais, sauf allowlist ci-dessous.
SUFFIXES_HORS_US = (".PA", ".DE", ".AS", ".SW", ".MI", ".MC", ".BR", ".LS", ".VI", ".CO", ".ST", ".HE", ".OL")
# Societes cotees hors Etats-Unis qui deposent reellement aupres de la SEC.
DEPOSANTS_SEC_LEGITIMES = {"AMRZ.SW"}


def depose_a_la_sec(ticker: str) -> bool:
    """Vrai si les dossiers de type americain de ce ticker lui appartiennent."""
    t = ticker.upper()
    if t in DEPOSANTS_SEC_LEGITIMES:
        return True
    return not t.endswith(SUFFIXES_HORS_US)


def log(msg: str) -> None:
    print(f"[earnings-refresh] {datetime.now(timezone.utc).isoformat()} {msg}", flush=True)


def env(key: str) -> str | None:
    if not ENV.exists():
        return None
    for line in ENV.read_text(encoding="utf8").splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip().strip('"')
    return None


def ssl_ctx() -> ssl.SSLContext:
    try:
        import certifi  # type: ignore
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:  # noqa: BLE001
        return ssl.create_default_context()


SSL_CTX = ssl_ctx()


# ── 1. Univers et KPI suivis ────────────────────────────────────────────────

def universe() -> list[str]:
    return json.loads(UNIVERSE.read_text(encoding="utf8")).get("tickers", [])


def kpi_sources(ticker: str) -> list[tuple[Path, dict]]:
    """Les deux fichiers qui portent les KPI d'une société, dans l'ordre de
    priorité de l'app : kpis-haut d'abord, v2-pipeline ensuite."""
    out = []
    for path in (HAUT / f"{ticker.upper()}.json", PIPE / f"{ticker.lower()}.json"):
        if not path.exists():
            continue
        try:
            data = json.loads(path.read_text(encoding="utf8"))
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict) and isinstance(data.get("kpis"), list):
            out.append((path, data))
    return out


def last_period(kpi: dict) -> str | None:
    hist = kpi.get("history") or []
    if hist and isinstance(hist[-1], dict):
        return str(hist[-1].get("q") or "") or None
    periods = kpi.get("history_periods")
    if isinstance(periods, list) and periods:
        return str(periods[-1])
    return None


def index_periode(label: str) -> int | None:
    """Position absolue d une periode, en trimestres depuis l an zero.
    Permet de mesurer un ECART reel : Q4-2025 et Q1-2026 sont contigus,
    alors que period_key() ferait un bond de 6 entre les deux."""
    m = re.match(r"^[QT]([1-4])[- ](?:FY)?(\d{4})$", label or "", re.I)
    if m:
        return int(m.group(2)) * 4 + int(m.group(1)) - 1
    m = re.match(r"^[HS]([12])[- ](\d{4})$", label or "", re.I)
    if m:
        return int(m.group(2)) * 4 + (int(m.group(1)) - 1) * 2
    m = re.match(r"^(?:FY)?(\d{4})$", label or "", re.I)
    if m:
        return int(m.group(1)) * 4
    return None


def period_key(label: str) -> int:
    """Ordonne Q1-2026 < Q2-2026 < H1-2026 < FY2026. Inconnu = 0."""
    m = re.match(r"^Q([1-4])[- ](?:FY)?(\d{4})$", label or "", re.I)
    if m:
        return int(m.group(2)) * 10 + int(m.group(1))
    m = re.match(r"^[HS]([12])[- ](\d{4})$", label or "", re.I)
    if m:
        return int(m.group(2)) * 10 + (2 if m.group(1) == "1" else 4)
    m = re.match(r"^FY(\d{4})$", label or "", re.I)
    if m:
        return int(m.group(1)) * 10 + 5
    return 0


# ── 2. Documents de la publication ──────────────────────────────────────────

def date_doc(chemin: Path) -> tuple:
    """Date du document, lue dans son nom de fichier plutot que dans le mtime :
    un vieux depot retelecharge recemment prenait la tete du classement et
    l extraction relisait 2014 au lieu de la publication du mois
    (Yann, 21 sept 2026). Le mtime ne sert plus que de departage."""
    m = re.search(r"(20\d{2})-(\d{2})-(\d{2})", chemin.name)
    d = m.group(0) if m else ""
    # Une date posterieure a aujourd hui vient d un nom de fichier errone
    # (vu sur NTAP, un trimestre de l an dernier date en 2026) : on ne la
    # laisse pas prendre la tete du classement.
    if d > datetime.now(timezone.utc).date().isoformat():
        d = ""
    return (d, chemin.stat().st_mtime)


def documents(ticker: str) -> list[Path]:
    """Tous les documents récents, US et hors US confondus, les plus récents
    d'abord. On prend plusieurs types : un chiffre absent du communiqué se
    trouve souvent dans la présentation."""
    base = LAKE / ticker
    if not base.exists():
        return []
    dirs = (DOC_DIRS_US + DOC_DIRS_EU) if depose_a_la_sec(ticker) else DOC_DIRS_EU
    found: list[Path] = []
    for rel in dirs:
        d = base / rel
        if not d.exists():
            continue
        for pattern in ("*.pdf", "*.htm.gz", "*.html.gz", "*.txt.gz", "*.htm"):
            found.extend(d.glob(pattern))
    found.sort(key=date_doc, reverse=True)
    # Un meme document existe souvent en deux formats (.pdf et .txt.gz) : on ne
    # garde qu'un exemplaire par document, le texte plutot que le PDF.
    uniques: dict[str, Path] = {}
    for chemin in found:
        cle = re.sub(r"\.(pdf|txt|htm|html|json)(\.gz)?$", "", chemin.name, flags=re.I)
        actuel = uniques.get(cle)
        if actuel is None or (actuel.suffix == ".pdf" and chemin.suffix != ".pdf"):
            uniques[cle] = chemin
    dedup = sorted(uniques.values(), key=date_doc, reverse=True)
    return dedup[:MAX_DOCS]


def read_document(path: Path) -> str:
    """Texte brut d'un document, quel que soit son format."""
    try:
        if path.suffix == ".pdf":
            out = subprocess.run(
                ["pdftotext", "-l", "30", "-nopgbrk", str(path), "-"],
                capture_output=True, text=True, timeout=120,
            )
            raw = out.stdout
        elif path.name.endswith(".gz"):
            raw = gzip.open(path, "rb").read().decode("utf8", "ignore")
            raw = re.sub(r"<[^>]+>", " ", raw)
        else:
            raw = path.read_text(encoding="utf8", errors="ignore")
            raw = re.sub(r"<[^>]+>", " ", raw)
    except (subprocess.SubprocessError, OSError, EOFError):
        return ""
    raw = re.sub(r"&#(\d+);", lambda m: chr(int(m.group(1))), raw)
    return re.sub(r"\s+", " ", raw)


# ── 3. Vérification ─────────────────────────────────────────────────────────

def appears_in(value: float, sources: list[str]) -> bool:
    """Le chiffre doit se lire tel quel dans au moins un document, à la
    ponctuation près. Sans cette preuve, la valeur est rejetée."""
    digits = re.sub(r"\D", "", f"{value}")
    if len(digits) < 2:
        return False
    needle = digits[:4] if len(digits) >= 4 else digits
    for text in sources:
        if needle in re.sub(r"[\s,. ']", "", text):
            return True
    return False


# ── 4. Moteur d'extraction ──────────────────────────────────────────────────

# Les moteurs, leurs cles et leur ordre sont desormais tenus par
# scripts/moteur_gratuit.py, partage avec les autres taches automatiques.
# Aucune cle Anthropic ici : une tache automatique n appelle jamais Claude.
CLES_MOTEURS = ("CEREBRAS_API_KEY", "CEREBRAS2_API_KEY", "CEREBRAS3_API_KEY",
                "GROQ_API_KEY", "GEMINI_API_KEY")


def build_prompt(ticker: str, kpis: list[dict], docs: list[tuple[str, str]]) -> str:
    lignes = []
    for k in kpis[:20]:
        lignes.append(
            f'- "{k["short"]}" | {k.get("name_fr") or k.get("name_en")} '
            f'| unite {k.get("unit")} | cadence {k.get("frequency") or "?"} '
            f'| derniere periode connue {last_period(k) or "?"}'
        )
    corpus = "\n\n".join(
        f"--- DOCUMENT {i + 1} : {nom} ---\n{txt[:MAX_CHARS_PER_DOC]}"
        for i, (nom, txt) in enumerate(docs)
    )
    return "\n".join([
        f"Societe : {ticker}",
        "",
        "KPI SUIVIS (n en ajoute aucun autre) :",
        *lignes,
        "",
        "REGLES",
        "- Une valeur n est retenue que si elle est ECRITE telle quelle dans un document.",
        "- Aucun calcul, aucune conversion, aucune estimation.",
        "- Indique la periode publiee au format Q2-2026, H1-2026 ou FY2026.",
        "- La periode doit respecter la cadence du KPI : un KPI semestriel recoit",
        "  H1-2026 ou H2-2026, jamais Q2-2026. Un chiffre de six mois n est pas un",
        "  chiffre de trimestre. Mets la periode reelle de chaque valeur dans son",
        "  champ `periode`.",
        "- `evidence` = la phrase exacte contenant le chiffre.",
        "- Un KPI absent des documents n est pas mentionne.",
        "",
        '{"periode":"Q2-2026","valeurs":[{"short":"...","value":123.4,"periode":"H1-2026","evidence":"..."}]}',
        "",
        corpus,
    ])


def appelle_moteur(ticker: str, prompt: str):
    """Extraction par les moteurs GRATUITS (Cerebras, Groq, Gemini).

    23 sept 2026 : remplace l ancien appel `claude -p`. Une tache automatique
    ne doit jamais appeler Claude, la facturation tombant sur le compte
    connecte au hasard du moment. Si aucun moteur ne repond, MoteurIndisponible
    remonte jusqu a `process`, qui ecrit un dossier de travail dans
    .conv-state et n ecrit RIEN dans src/data.
    """
    donnees, moteur = appelle_moteur_gratuit(prompt, json_attendu=True, temperature=0.0)
    if not isinstance(donnees, dict):
        raise ValueError(f"{moteur} : reponse hors format (pas un objet JSON)")
    return donnees, moteur


def parse_json_answer(raw: str) -> dict:
    """Tolere une reponse entouree de texte ou de barrieres de code."""
    m = re.search(r"\{.*\}", raw, re.S)
    if not m:
        raise ValueError("aucun JSON dans la reponse")
    return json.loads(m.group(0))


def _mots_normalises(texte: str) -> list[str]:
    return re.sub(r"[^a-z0-9]+", " ", (texte or "").lower()).split()


def preuve_fiable(evidence: str, valeur: float, corpus_mots: list[list[str]]) -> bool:
    """Garde-fou ajoute le 23 sept 2026, parce que le moteur gratuit invente
    plus volontiers qu un grand modele.

    La phrase de preuve doit satisfaire DEUX conditions :
      1. contenir elle-meme le chiffre annonce, sinon elle ne prouve rien ;
      2. partager une suite de six mots consecutifs avec un document reel,
         ce qui interdit une phrase reecrite de memoire par le modele.
    Une tolerance de forme est laissee (ponctuation, espaces, majuscules),
    aucune tolerance de fond.
    """
    if not isinstance(evidence, str) or len(evidence.strip()) < 20:
        return False
    chiffres = re.sub(r"\D", "", f"{valeur}")
    if len(chiffres) < 2:
        return False
    tete = chiffres[:4] if len(chiffres) >= 4 else chiffres
    if tete not in re.sub(r"[\s,.\u00a0\u202f\']", "", evidence):
        return False
    mots = _mots_normalises(evidence)
    if len(mots) < 6:
        return False
    fenetres = {" ".join(mots[i:i + 6]) for i in range(len(mots) - 5)}
    for doc_mots in corpus_mots:
        plat = " ".join(doc_mots)
        for f in fenetres:
            if f in plat:
                return True
    return False


def source_compatible(kpi: dict) -> bool:
    """Vigilance sur les KPI dont l historique ne vient PAS des documents de
    resultats (recherche manuelle, presse, cabinets d etudes, posts X...).

    Regle posee par Yann le 27 aout 2026 : pour ces KPI, un chiffre trouve dans
    un document de resultats n est PAS forcement le meme indicateur, meme quand
    le libelle se ressemble. Changer de source en cours de serie produit une
    rupture invisible et un graphique faux. On ne les met donc jamais a jour
    automatiquement : ils restent pilotes depuis l outil KPI speciaux.
    """
    if kpi.get("hors_document") is True:
        return False
    if kpi.get("source_officielle") is False:
        return False
    return True


def periode_compatible(kpi: dict, periode: str) -> bool:
    """Un point trimestriel n a rien a faire dans une serie annuelle, et
    inversement. Sans ce controle, la dette nette au 30 juin viendrait se ranger
    a cote de dettes de fin d exercice et la serie deviendrait illisible."""
    freq = (kpi.get("frequency") or "").lower()
    if not freq:
        # Les fiches ne portent pas "frequency" mais "period_type"
        # (year / quarter / semester). Sans cette lecture, la fonction
        # rendait True pour tout et un trimestre atterrissait dans une
        # serie annuelle.
        freq = {
            "year": "annual", "annual": "annual", "yearly": "annual", "fy": "annual",
            "quarter": "quarterly", "quarterly": "quarterly",
            "semester": "semiannual", "semiannual": "semiannual", "half": "semiannual",
        }.get((kpi.get("period_type") or "").lower(), "")
    if not freq:
        # Un KPI sur six ne porte aucune indication de periode. Quand la serie
        # est etiquetee, l etiquette suffit a trancher : "2025" est un exercice,
        # "Q2-2026" un trimestre.
        etiquette = (last_period(kpi) or "").upper()
        if re.fullmatch(r"(?:FY)?\d{4}", etiquette):
            freq = "annual"
        elif etiquette.startswith(("Q", "T")):
            freq = "quarterly"
        elif etiquette.startswith(("H", "S")):
            freq = "semiannual"
    p = periode.upper()
    if p.startswith("FY"):
        type_periode = "annual"
    elif p.startswith(("H1", "H2", "S1", "S2")):
        type_periode = "semiannual"
    elif p.startswith("Q") or p.startswith("T"):
        type_periode = "quarterly"
    else:
        return False
    if freq in ("annual", "yearly"):
        return type_periode == "annual"
    if freq == "semiannual":
        return type_periode == "semiannual"
    if freq == "quarterly":
        return type_periode == "quarterly"
    # Frequence toujours inconnue : on refuse. Refuser une mise a jour se
    # rattrape a la main ; un point mal range corrompt la courbe en silence.
    return False


def points_numeriques(kpi: dict) -> list[float]:
    """La serie en nombres, que l historique soit une liste de nombres ou de
    points {"q","v"}."""
    out = []
    for x in kpi.get("history") or []:
        if isinstance(x, dict):
            x = x.get("v")
        if isinstance(x, (int, float)):
            out.append(float(x))
    return out


def echelle_compatible(kpi: dict, val: float) -> bool:
    """Refuse un point qui n a pas l ordre de grandeur de sa propre serie.

    C est le filet qui rattrape les deux accidents constates le 28 aout 2026 :
    un chiffre trimestriel colle a la fin d une serie annuelle (AJG, AMT) et
    un chiffre en millions ajoute a une serie en milliards. Les seuils sont
    larges a dessein : on ne cherche pas a juger la croissance, seulement a
    ecarter les ruptures d un facteur trois ou plus.
    """
    serie = [abs(x) for x in points_numeriques(kpi)[-4:] if x]
    if len(serie) < 2:
        return True  # trop peu de recul pour juger
    plancher, plafond = min(serie), max(serie)
    a = abs(val)
    if a == 0:
        return plancher == 0 or plancher < 1e-9
    return plancher / 3.0 <= a <= plafond * 3.0


def deja_present(kpi: dict, val: float) -> bool:
    """Le dernier point de la serie vaut deja cette valeur : republier le meme
    chiffre allongerait la courbe d un palier fictif. Necessaire parce que
    `last_period` rend None des que l historique est une liste de nombres, ce
    qui neutralise la garde par periode."""
    serie = points_numeriques(kpi)
    if not serie:
        return False
    dernier = serie[-1]
    return abs(dernier - float(val)) <= max(abs(dernier), 1.0) * 1e-6


def write_dossier(ticker: str, kpis: list[dict], docs: list[tuple[str, str]]) -> Path:
    """Dossier de travail complet quand aucun moteur n'est joignable : les
    documents et la liste des KPI attendus, prêts à être traités."""
    INBOX.mkdir(parents=True, exist_ok=True)
    path = INBOX / f"{ticker}.md"
    lignes = [
        f"# {ticker} — nouvelle publication",
        "",
        "## KPI à mettre à jour",
        *[f'- `{k["short"]}` — {k.get("name_fr") or k.get("name_en")} '
          f'({k.get("unit")}), dernière période connue {last_period(k) or "?"}'
          for k in kpis[:25]],
        "",
        "## Règle",
        "Une valeur n'est retenue que si elle est écrite telle quelle dans un des",
        "documents ci-dessous. Aucun calcul, aucune conversion.",
        "",
    ]
    for nom, txt in docs:
        lignes += [f"## Document : {nom}", "", txt[:MAX_CHARS_PER_DOC], ""]
    path.write_text("\n".join(lignes), encoding="utf8")
    return path


# ── 5. Traitement d'une société ─────────────────────────────────────────────

def process(ticker: str, apply: bool, moteur: str) -> dict:
    sources = kpi_sources(ticker)
    if not sources:
        return {"ticker": ticker, "statut": "aucune fiche"}
    kpis = [k for _, data in sources for k in data["kpis"]
            if k.get("short") and isinstance(k.get("history"), list) and k["history"]]
    if not kpis:
        return {"ticker": ticker, "statut": "aucun KPI suivi"}

    paths = documents(ticker)
    if not paths:
        return {"ticker": ticker, "statut": "aucun document"}
    docs = [(p.name, read_document(p)) for p in paths]
    docs = [(n, t) for n, t in docs if len(t) > 400]
    if not docs:
        return {"ticker": ticker, "statut": "documents illisibles"}

    if moteur == "dossier":
        path = write_dossier(ticker, kpis, docs)
        return {"ticker": ticker, "statut": "dossier prepare", "fichier": path.name,
                "kpis": len(kpis), "documents": len(docs)}

    try:
        parsed, fournisseur = appelle_moteur(ticker, build_prompt(ticker, kpis, docs))
    except (RuntimeError, ValueError) as err:
        # MoteurIndisponible descend de RuntimeError : aucun moteur gratuit n a
        # repondu. On ecrit le brouillon et on n ecrit RIEN dans src/data.
        # Moteur injoignable ou reponse inexploitable : on ne perd pas le
        # travail, on ecrit le dossier pour un traitement a la main.
        # Fix 2 sept 2026 : le MOTIF est logge. Sans lui, 6 nuits de
        # "0 traite / 641 dossiers" sont passees sans qu on sache pourquoi.
        path = write_dossier(ticker, kpis, docs)
        return {"ticker": ticker, "statut": "dossier prepare", "fichier": path.name,
                "kpis": len(kpis), "documents": len(docs),
                "motif": str(err)[:180]}

    periode = str(parsed.get("periode") or "").strip()
    corpus = [t for _, t in docs]
    corpus_mots = [_mots_normalises(t) for t in corpus]
    index = {k["short"]: k for k in kpis}
    vus: set[str] = set()
    retenus, rejetes = [], 0
    motifs: dict[str, int] = {}

    def rejeter(motif: str) -> None:
        """Un rejet muet empeche de distinguer un garde-fou utile d un
        garde-fou trop serre. On compte donc les motifs."""
        nonlocal rejetes
        rejetes += 1
        motifs[motif] = motifs.get(motif, 0) + 1

    for v in parsed.get("valeurs") or []:
        short = str(v.get("short") or "")
        val = v.get("value")
        if short not in index or not isinstance(val, (int, float)):
            rejeter("KPI inconnu ou valeur non chiffree")
            continue
        # 23 sept 2026 : un moteur gratuit renvoie parfois deux fois le meme
        # KPI avec deux valeurs. On ne garde aucune des deux, faute de savoir
        # laquelle est la bonne.
        if short in vus:
            rejeter("KPI annonce plusieurs fois dans la meme reponse")
            continue
        vus.add(short)
        if not appears_in(float(val), corpus):
            rejeter("chiffre absent des documents")
            continue
        # 23 sept 2026 : la phrase de preuve doit venir d un document reel et
        # contenir le chiffre. Sans ce controle, une valeur inventee accompagnee
        # d une phrase inventee passait des lors que quatre chiffres se
        # retrouvaient quelque part dans le corpus.
        if not preuve_fiable(v.get("evidence"), float(val), corpus_mots):
            rejeter("phrase de preuve absente des documents ou sans le chiffre")
            continue
        kpi = index[short]
        if not source_compatible(kpi):
            rejeter("KPI hors documents de resultats")
            continue
        # La periode propre a la valeur prime : une publication semestrielle
        # porte souvent des KPI trimestriels et des KPI semestriels a la fois.
        periode_v = str(v.get("periode") or periode).strip()
        if not periode_v or not periode_compatible(kpi, periode_v):
            rejeter(f"periode {periode_v or '?'} incompatible avec {kpi.get('period_type') or '?'}")
            continue
        if period_key(periode_v) and period_key(periode_v) <= period_key(last_period(kpi) or ""):
            continue  # déjà à jour : on n'écrase jamais un point existant
        if deja_present(kpi, float(val)):
            continue  # même chiffre que le dernier point : rien de nouveau
        if not echelle_compatible(kpi, float(val)):
            rejeter("ordre de grandeur etranger a la serie")
            continue
        hist = kpi["history"]
        # Yann 4 sept 2026 : ne JAMAIS ajouter un point qui laisserait un trou.
        # La passe du 4 sept avait ajoute Q2-2026 apres Q2-2025 chez Marsh, et
        # H1-2026 apres H1-2025 chez Renault : le graphique posait les barres
        # cote a cote et faisait croire a une continuite. Mieux vaut ne rien
        # ajouter et attendre le trimestre manquant.
        if hist and isinstance(hist[-1], dict):
            precedent = index_periode(str(hist[-1].get("q") or ""))
            suivant = index_periode(periode_v)
            if precedent and suivant:
                pas = 1 if str(periode_v).upper().startswith(("Q", "T")) else 2
                if suivant - precedent > pas:
                    rejeter(f"laisserait un trou entre {hist[-1].get('q')} et {periode_v}")
                    continue
            hist.append({"q": periode_v, "v": val})
        else:
            hist.append(val)
        kpi["value"] = val
        kpi["last_data_date"] = datetime.now(timezone.utc).date().isoformat()
        retenus.append(short)

    if retenus and apply:
        for path, data in sources:
            # 3 sept 2026 : ecriture sure. Sauvegarde de l original, ecriture dans un
            # fichier temporaire, relecture JSON, puis remplacement atomique.
            texte = json.dumps(data, ensure_ascii=False)
            json.loads(texte)
            bk = ROOT / ".conv-state" / "quarterly-refresh-backups"
            bk.mkdir(parents=True, exist_ok=True)
            if path.exists():
                (bk / f"{path.name}.{datetime.now(timezone.utc).strftime('%Y%m%d')}.bak").write_text(path.read_text(encoding="utf8"), encoding="utf8")
            tmp = path.with_suffix(path.suffix + ".tmp")
            tmp.write_text(texte, encoding="utf8")
            tmp.replace(path)

    # 23 sept 2026 : un moteur gratuit peut repondre et n avoir que des valeurs
    # refusees par les garde-fous. Sans ce filet, la publication disparaissait
    # en silence. On depose alors le dossier de travail, sans rien ecrire dans
    # src/data, pour qu un humain le reprenne.
    brouillon = None
    if not retenus and rejetes:
        brouillon = write_dossier(ticker, kpis, docs).name

    return {"ticker": ticker, "statut": "traite", "periode": periode,
            "retenus": len(retenus), "rejetes": rejetes, "motifs": motifs,
            "moteur": fournisseur,
            **({"brouillon a traiter": brouillon} if brouillon else {})}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--scan", action="store_true", help="inventaire sans extraction")
    args = ap.parse_args()

    cibles = [t.strip().upper() for t in args.tickers.split(",")] if args.tickers else universe()
    if args.limit:
        cibles = cibles[: args.limit]

    if args.scan:
        sans_kpi = pauvres = ok = 0
        for t in cibles:
            kpis = [k for _, d in kpi_sources(t) for k in d["kpis"] if k.get("short")]
            if not kpis:
                sans_kpi += 1
            elif len(kpis) < 5:
                pauvres += 1
            else:
                ok += 1
        log(f"inventaire : {ok} societes fournies, {pauvres} a moins de 5 KPI, {sans_kpi} sans KPI")
        return 0

    moteur = "api"
    charge_env(str(ENV))
    if not any(env(k) for k in CLES_MOTEURS):
        moteur = "dossier"
        log("aucune cle de moteur gratuit dans .env.local : dossiers de travail")
    else:
        try:
            appelle_moteur_gratuit("Reponds exactement : SONDE-OK")
        except MoteurIndisponible as err:
            moteur = "dossier"
            log(f"aucun moteur gratuit ne repond ({str(err)[:80]}) : dossiers de travail")

    log(f"{len(cibles)} societe(s), moteur={moteur}")
    state = json.loads(STATE.read_text(encoding="utf8")) if STATE.exists() else {}
    compte = {"traite": 0, "dossier prepare": 0}
    for t in cibles:
        r = process(t, args.apply and not args.dry_run, moteur)
        log(" ".join(f"{k}={str(v)[:160]}" for k, v in r.items()))
        if r["statut"] in compte:
            compte[r["statut"]] += 1
            state[t] = {**r, "at": datetime.now(timezone.utc).isoformat()}
    if args.apply and not args.dry_run:
        STATE.parent.mkdir(parents=True, exist_ok=True)
        STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf8")
    log(f"FINI {compte}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
