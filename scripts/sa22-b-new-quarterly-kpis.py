#!/usr/bin/env python3
"""
SA22-B : extraction de NOUVEAUX KPIs sectoriels QUARTERLY via Cerebras free
+ 10-Q HTML, écriture DIRECTE dans v2-pipeline-enrich/<slug>.json (kpis[]).

Batches /tmp/quart-batch-08.json .. /tmp/quart-batch-15.json (~165 stés).

Sources :
- US : ~/Mettrik/sec-data/cat1-us/10Q/{YEAR}/{TICKER}_*.htm.gz (8-12 derniers)
- 10-K FY24/FY25 si dispo (contexte)
- EU/FPI : annual only → skip si pas de quarterly granulaire

Cerebras free tier rotation : CEREBRAS_API_KEY / CEREBRAS2_API_KEY / CEREBRAS3_API_KEY
Sleep 4s, modèle gpt-oss-120b.

Anti-invention strict :
- NULL si non chiffré dans le filing
- Pas d'estimation, pas d'interpolation
- Min 4 trims, idéal 8-16
- Inclut SEULEMENT KPIs sectoriels NOUVEAUX (absents du v2-pipeline/<slug>.json kpis[].short)
"""
import argparse
import gzip
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parent.parent
ENRICH_DIR = ROOT / "src/data/v2-pipeline-enrich"
BASE_DIR = ROOT / "src/data/v2-pipeline"
SEC_DIR = Path("/Users/yann/Mettrik/sec-data")
LOG_PATH = ROOT / "sec-data/_meta/sa22-b-new-quarterly.log"

CEREBRAS_KEYS = [k for k in [
    os.environ.get("CEREBRAS_API_KEY", ""),
    os.environ.get("CEREBRAS2_API_KEY", ""),
    os.environ.get("CEREBRAS3_API_KEY", ""),
] if k]
CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL = "gpt-oss-120b"


def log(msg, fh=None):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    if fh:
        fh.write(line + "\n")
        fh.flush()


def slug_for_ticker(tk: str) -> str:
    """Convert ticker -> slug filename used by spx-app pipeline."""
    return tk.lower().replace(" ", "_")


def load_enrich(tk: str) -> tuple[Path, dict] | tuple[None, None]:
    slug = slug_for_ticker(tk)
    p = ENRICH_DIR / f"{slug}.json"
    if not p.exists():
        return None, None
    try:
        return p, json.loads(p.read_text())
    except Exception:
        return None, None


def load_base_kpis_shorts(tk: str) -> set[str]:
    slug = slug_for_ticker(tk)
    p = BASE_DIR / f"{slug}.json"
    if not p.exists():
        return set()
    try:
        d = json.loads(p.read_text())
        return {k.get("short", "").strip() for k in d.get("kpis", []) if k.get("short")}
    except Exception:
        return set()


def find_us_filings(ticker: str) -> list[Path]:
    """10-Q + 10-K récents (US) dans cat1-us."""
    out = []
    for ftype in ("10Q", "10K"):
        for year in [2022, 2023, 2024, 2025, 2026]:
            d = SEC_DIR / "cat1-us" / ftype / str(year)
            if not d.exists():
                continue
            for f in d.glob(f"{ticker.upper()}_*.htm.gz"):
                out.append(f)
    return sorted(out)


def extract_text(htm_gz: Path, max_chars: int = 12000) -> str:
    try:
        with gzip.open(htm_gz, "rt", errors="ignore") as f:
            html = f.read()
    except Exception:
        return ""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&[a-z]+;", " ", text)
    text = re.sub(r"\s+", " ", text)
    # Try to grab MD&A section (most info-dense for sectoral KPIs)
    low = text.lower()
    for kw in ("management's discussion and analysis", "results of operations", "financial highlights", "selected operating"):
        idx = low.find(kw)
        if idx > 0:
            return text[idx : idx + max_chars]
    return text[:max_chars]


_key_idx = [0]
def next_key() -> str:
    if not CEREBRAS_KEYS:
        return ""
    k = CEREBRAS_KEYS[_key_idx[0] % len(CEREBRAS_KEYS)]
    _key_idx[0] += 1
    return k


def call_llm(system: str, user: str, retries: int = 2) -> dict | None:
    for attempt in range(retries + 1):
        key = next_key()
        if not key:
            return None
        body = {
            "model": MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
            "max_tokens": 4000,
        }
        try:
            r = requests.post(
                CEREBRAS_URL,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json=body,
                timeout=120,
            )
            if r.status_code == 429:
                time.sleep(8)
                continue
            if r.status_code != 200:
                if attempt < retries:
                    time.sleep(4)
                    continue
                return None
            content = r.json()["choices"][0]["message"]["content"]
            return json.loads(content)
        except Exception:
            if attempt < retries:
                time.sleep(4)
                continue
            return None
    return None


SYSTEM_PROMPT = """Tu es un analyste financier sectoriel. Tu reçois plusieurs 10-Q et 10-K consécutifs.
Mission : identifier 1 à 4 KPIs sectoriels SPÉCIFIQUES au business (PAS revenue, EPS, gross margin, op margin, capex, R&D, FCF, debt — déjà couverts) ET extraire leur historique TRIMESTRIEL ligne par ligne.

EXEMPLES DE KPIs SECTORIELS à chercher (selon secteur de la société) :
- SaaS / Tech : ARR, NRR, RPO, Billings, Customers >$100K, DBNR
- Streaming : Paid memberships, ARM (average revenue per member), Hours viewed
- Retail / e-commerce : GMV, Active customers, Orders, AOV, Same-store sales growth
- Restaurants : Same-store sales %, Units opened, Transactions
- Banques : NIM, NII, Provisions for credit losses, Tier 1 ratio, Loans, Deposits
- Assurance : Combined ratio, Loss ratio, Premiums written, Catastrophe losses
- Pharma / Biotech : Revenue par molécule key (si pas déjà couvert), R&D pipeline phases
- Telco : ARPU, Postpaid net adds, Churn, Subscribers
- Energy : Production (boe/d, mcf/d), Realized price, Reserves
- REIT : FFO, AFFO, Occupancy %, Same-property NOI
- Semi / Hardware : Units shipped, ASP, Backlog, Book-to-bill
- Airlines : RASM, CASM, Load factor, ASMs, Yield
- Hôtels : RevPAR, ADR, Occupancy
- Industriels : Orders, Backlog, Book-to-bill
- Media / Pub : Ad revenue par segment, MAUs, DAUs

RÈGLES STRICTES anti-invention :
- N'inclure un KPI que si tu trouves au MOINS 4 valeurs trimestrielles chiffrées explicites.
- Si la valeur n'est pas chiffrée dans le texte → ne pas l'inventer. Mieux vaut 0 KPI nouveau que des chiffres bidons.
- Pas d'estimation, pas d'interpolation, pas de moyenne.
- Period_type DOIT être "quarter".
- history = liste des valeurs ordre chronologique ascendant.
- history_periods = liste de labels "QX YYYY" alignés sur history.

Format JSON strict :
{
  "new_kpis": [
    {
      "short": "ARR",
      "name_fr": "Revenus annuels récurrents",
      "name_en": "Annual Recurring Revenue",
      "value": 12.3,
      "unit": "$B",
      "period_type": "quarter",
      "history": [10.1, 10.8, 11.4, 12.0, 12.3],
      "history_periods": ["Q1 2024", "Q2 2024", "Q3 2024", "Q4 2024", "Q1 2025"],
      "source": "10-Q Q1 2025 (page MD&A)",
      "explanation": "Revenus contractuels récurrents extrapolés sur 12 mois."
    }
  ]
}

Si AUCUN KPI sectoriel nouveau n'est extractible avec >=4 trims chiffrés → renvoyer {"new_kpis": []}.
Réponse UNIQUEMENT JSON valide, pas de markdown."""


def process_ticker(ticker: str, fh=None) -> str:
    enrich_path, enrich = load_enrich(ticker)
    if not enrich_path:
        return "no-enrich"

    existing_shorts = load_base_kpis_shorts(ticker)
    enrich_shorts = {k.get("short", "").strip() for k in enrich.get("kpis", []) if k.get("short")}
    all_existing = existing_shorts | enrich_shorts

    filings = find_us_filings(ticker)
    if len(filings) < 4:
        return "no-us-filings"

    # Take last 10 10-Qs (skip 10-Ks—too large, redundant) ; ~3500 chars each
    only_10q = [f for f in filings if "/10Q/" in str(f)]
    sel = only_10q[-10:] if only_10q else filings[-8:]
    docs_text = []
    for f in sel:
        txt = extract_text(f, max_chars=3500)
        if txt:
            docs_text.append(f"=== {f.name} ===\n{txt}")
    full = "\n\n".join(docs_text)[:35000]
    if len(full) < 3000:
        return "no-text"

    name = enrich.get("name") or enrich.get("ticker") or ticker
    user = (
        f"Société : {name} ({ticker})\n"
        f"KPIs DÉJÀ couverts (ne pas redoubler) : {sorted(all_existing)}\n\n"
        f"DOCS SEC :\n{full}\n\n"
        f"Renvoie le JSON avec 1-4 nouveaux KPIs sectoriels quarterly (ou tableau vide)."
    )

    result = call_llm(SYSTEM_PROMPT, user)
    if result is None:
        return "llm-fail"
    new_kpis = result.get("new_kpis") or []
    if not isinstance(new_kpis, list) or not new_kpis:
        return "no-new-kpis"

    # Validate + filter
    valid = []
    for k in new_kpis:
        if not isinstance(k, dict):
            continue
        short = (k.get("short") or "").strip()
        if not short or short in all_existing:
            continue
        history = k.get("history") or []
        if not isinstance(history, list):
            continue
        # Filter null / non-numeric
        history_clean = [v for v in history if isinstance(v, (int, float))]
        if len(history_clean) < 4:
            continue
        periods = k.get("history_periods") or []
        if not isinstance(periods, list):
            periods = []
        # Align periods to history_clean length if mismatch
        if len(periods) != len(history):
            periods = periods[: len(history_clean)]
        else:
            # Filter periods aligned with nulls
            periods = [p for p, v in zip(periods, history) if isinstance(v, (int, float))]

        entry = {
            "short": short,
            "name_fr": k.get("name_fr") or short,
            "name_en": k.get("name_en") or short,
            "value": history_clean[-1],
            "unit": k.get("unit") or "",
            "period_type": "quarter",
            "history": history_clean,
            "history_periods": periods,
            "source": k.get("source") or f"10-Q {ticker}",
            "explanation": k.get("explanation") or "",
            "_fix_log": [f"SA22-B new quarterly KPI {short} via Cerebras gpt-oss-120b"],
        }
        valid.append(entry)
        all_existing.add(short)

    if not valid:
        return "no-valid-after-filter"

    # Merge in enrich
    enrich.setdefault("kpis", [])
    enrich["kpis"].extend(valid)
    enrich.setdefault("_sa22_b_extracted_at", {})
    enrich["_sa22_b_extracted_at"] = {
        "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "n_new_kpis": len(valid),
        "model": "cerebras-gpt-oss-120b",
    }

    enrich_path.write_text(json.dumps(enrich, ensure_ascii=False, indent=2))
    return f"ok-{len(valid)}kpi"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--batches", nargs="+", required=True, help="Paths to batch JSON files")
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--sleep", type=float, default=4.0)
    args = p.parse_args()

    if not CEREBRAS_KEYS:
        print("[fatal] No CEREBRAS_API_KEY in env", file=sys.stderr)
        sys.exit(1)

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    fh = open(LOG_PATH, "a")

    all_tickers = []
    for b in args.batches:
        try:
            tks = json.loads(Path(b).read_text())
            if isinstance(tks, dict):
                tks = tks.get("tickers", [])
            all_tickers.extend(tks)
        except Exception as e:
            log(f"[ERR] batch {b}: {e}", fh)

    if args.limit:
        all_tickers = all_tickers[: args.limit]

    log(f"=== SA22-B START : {len(all_tickers)} tickers, {len(CEREBRAS_KEYS)} keys ===", fh)

    counts = {}
    for i, tk in enumerate(all_tickers, 1):
        try:
            r = process_ticker(tk, fh)
        except Exception as e:
            r = f"err-{type(e).__name__}"
        counts[r] = counts.get(r, 0) + 1
        marker = "OK" if r.startswith("ok") else "--"
        log(f"  [{i}/{len(all_tickers)}] {marker} {tk} : {r}", fh)
        time.sleep(args.sleep)

    log(f"=== TOTAL : {counts} ===", fh)
    fh.close()


if __name__ == "__main__":
    main()
