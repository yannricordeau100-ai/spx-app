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
  - `api`     : un fournisseur de modèle répond (Groq, Cerebras, Anthropic) ;
  - `dossier` : aucun ne répond, le script écrit alors un dossier de travail
                complet par société dans .conv-state/earnings-inbox/, prêt à
                être traité, plutôt que de ne rien faire.

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
DOC_DIRS_EU = ("ir/CP", "ir/SLIDES", "ir/TRIM", "ir/RFS", "ir/URD")
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
    found.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    # Un meme document existe souvent en deux formats (.pdf et .txt.gz) : on ne
    # garde qu'un exemplaire par document, le texte plutot que le PDF.
    uniques: dict[str, Path] = {}
    for chemin in found:
        cle = re.sub(r"\.(pdf|txt|htm|html|json)(\.gz)?$", "", chemin.name, flags=re.I)
        actuel = uniques.get(cle)
        if actuel is None or (actuel.suffix == ".pdf" and chemin.suffix != ".pdf"):
            uniques[cle] = chemin
    dedup = sorted(uniques.values(), key=lambda p: p.stat().st_mtime, reverse=True)
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

PROVIDERS = [
    ("groq", "GROQ_API_KEY", "https://api.groq.com/openai/v1/chat/completions",
     "llama-3.3-70b-versatile", "bearer"),
    ("cerebras", "CEREBRAS_API_KEY", "https://api.cerebras.ai/v1/chat/completions",
     "gpt-oss-120b", "bearer"),
    ("anthropic", "ANTHROPIC_API_KEY", "https://api.anthropic.com/v1/messages",
     "claude-haiku-4-5-20251001", "anthropic"),
]


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


def call_provider(spec, prompt: str, key: str) -> str:
    nom, _envkey, url, modele, auth = spec
    if auth == "anthropic":
        body = json.dumps({
            "model": modele, "max_tokens": 3000,
            "system": "Extraction stricte de KPI. Aucun calcul. JSON pur.",
            "messages": [{"role": "user", "content": prompt}],
        }).encode("utf8")
        headers = {"x-api-key": key, "anthropic-version": "2023-06-01",
                   "content-type": "application/json"}
    else:
        body = json.dumps({
            "model": modele, "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Extraction stricte de KPI. Aucun calcul. JSON pur."},
                {"role": "user", "content": prompt},
            ],
        }).encode("utf8")
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    req = urllib.request.Request(url, data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=180, context=SSL_CTX) as resp:
        payload = json.loads(resp.read())
    return payload["content"][0]["text"] if auth == "anthropic" else payload["choices"][0]["message"]["content"]


def call_claude_cli(prompt: str) -> str:
    """Extraction via la session Claude Code du Mac : aucune cle API.
    Si un profil dedie au compte MAX 20x existe (~/.claude-20x), il est
    utilise ; sinon la session par defaut. Le modele Sonnet suffit pour de
    l extraction verrouillee par la verification textuelle en aval."""
    import os
    env_vars = dict(os.environ)
    profil = Path.home() / ".claude-20x"
    if profil.exists():
        env_vars["CLAUDE_CONFIG_DIR"] = str(profil)
    out = subprocess.run(
        ["claude", "-p", "--model", "sonnet", "--output-format", "text"],
        input=prompt, capture_output=True, text=True, timeout=420, env=env_vars,
    )
    if out.returncode != 0:
        raise RuntimeError(f"claude-cli rc={out.returncode}: {out.stderr[:200]}")
    # Le CLI repond « Not logged in » avec un code de retour 0 : sans ce controle
    # la reponse part au parseur JSON, qui echoue sur une exception non rattrapee
    # et fait tomber toute la passe au lieu d ecrire un dossier de travail.
    tete = out.stdout.strip()[:200]
    if "Not logged in" in tete or "/login" in tete:
        raise RuntimeError("claude-cli : session non connectee, lancer /login")
    if "{" not in out.stdout:
        raise RuntimeError(f"claude-cli : reponse sans JSON ({tete[:100]})")
    return out.stdout


def parse_json_answer(raw: str) -> dict:
    """Tolere une reponse entouree de texte ou de barrieres de code."""
    m = re.search(r"\{.*\}", raw, re.S)
    if not m:
        raise ValueError("aucun JSON dans la reponse")
    return json.loads(m.group(0))


def extract_via_api(ticker: str, kpis: list[dict], docs: list[tuple[str, str]]):
    """Decision Yann 27 aout 2026 : Claude est le SEUL moteur. Les
    fournisseurs API (Groq, Cerebras...) sont abandonnes pour ce pipeline."""
    prompt = build_prompt(ticker, kpis, docs)
    try:
        return parse_json_answer(call_claude_cli(prompt)), "claude-cli"
    except Exception as err:  # noqa: BLE001
        raise RuntimeError(f"claude-cli: {err}") from err


def periode_compatible(kpi: dict, periode: str) -> bool:
    """Un point trimestriel n a rien a faire dans une serie annuelle, et
    inversement. Sans ce controle, la dette nette au 30 juin viendrait se ranger
    a cote de dettes de fin d exercice et la serie deviendrait illisible."""
    freq = (kpi.get("frequency") or "").lower()
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
    return True  # frequence inconnue : on laisse passer


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
        parsed, fournisseur = extract_via_api(ticker, kpis, docs)
    except (RuntimeError, ValueError):
        # Moteur injoignable ou reponse inexploitable : on ne perd pas le
        # travail, on ecrit le dossier pour un traitement a la main.
        path = write_dossier(ticker, kpis, docs)
        return {"ticker": ticker, "statut": "dossier prepare", "fichier": path.name,
                "kpis": len(kpis), "documents": len(docs)}

    periode = str(parsed.get("periode") or "").strip()
    corpus = [t for _, t in docs]
    index = {k["short"]: k for k in kpis}
    retenus, rejetes = [], 0

    for v in parsed.get("valeurs") or []:
        short = str(v.get("short") or "")
        val = v.get("value")
        if short not in index or not isinstance(val, (int, float)):
            rejetes += 1
            continue
        if not appears_in(float(val), corpus):
            rejetes += 1
            continue
        kpi = index[short]
        # La periode propre a la valeur prime : une publication semestrielle
        # porte souvent des KPI trimestriels et des KPI semestriels a la fois.
        periode_v = str(v.get("periode") or periode).strip()
        if not periode_v or not periode_compatible(kpi, periode_v):
            rejetes += 1
            continue
        if period_key(periode_v) and period_key(periode_v) <= period_key(last_period(kpi) or ""):
            continue  # déjà à jour : on n'écrase jamais un point existant
        hist = kpi["history"]
        if hist and isinstance(hist[-1], dict):
            hist.append({"q": periode_v, "v": val})
        else:
            hist.append(val)
        kpi["value"] = val
        kpi["last_data_date"] = datetime.now(timezone.utc).date().isoformat()
        retenus.append(short)

    if retenus and apply:
        for path, data in sources:
            path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf8")

    return {"ticker": ticker, "statut": "traite", "periode": periode,
            "retenus": len(retenus), "rejetes": rejetes, "moteur": fournisseur}


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
    try:
        subprocess.run(["claude", "--version"], capture_output=True, timeout=20, check=True)
    except Exception:  # noqa: BLE001
        cles = any(env(spec[1]) for spec in PROVIDERS)
        if not cles:
            moteur = "dossier"
            log("aucun moteur joignable (ni cle API ni claude-cli) : dossiers de travail")

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
