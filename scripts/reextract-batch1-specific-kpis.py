#!/usr/bin/env python3
"""reextract-batch1-specific-kpis.py — extraction supplémentaire KPIs spécifiques V2.

Mission REEXTRACT-29MAY-batch1 :
Pour chaque sté du batch /tmp/reextract-batches-v2/batch1.json, extraire N=needed
KPIs SPÉCIFIQUES additionnels (history ≥3 ans) via Cerebras Qwen-3 235B free tier.

Output : src/data/v2-pipeline-specific-kpis/<TICKER>.json (append au kpis[]).
RÈGLES STRICTES :
- KPIs SPÉCIFIQUES (cf kpi-generic-library.json : Revenue/Op Margin/EPS/etc INTERDITS)
- history ≥3 valeurs réelles sourcées. JAMAIS inventer.
- Pas d'em-dash (—) dans textes.
- Vocabulaire FR strict.
- Skip si pas de source → marquer _no_source:true.
"""
from __future__ import annotations
import argparse
import gzip
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

ROOT = Path(__file__).resolve().parent.parent
KPIS_DIR = ROOT / "src/data/v2-pipeline-specific-kpis"
GENERIC_LIB = ROOT / "src/data/kpi-generic-library.json"
CAT1 = ROOT / "sec-data/cat1-us/10K"
CAT2_20F = ROOT / "sec-data/cat2-foreign-adr/20F"
CAT3 = ROOT / "sec-data/cat3-european"

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL_ID = "gpt-oss-120b"
SLEEP = 1.0
BACKOFF_429 = 10.0
MAX_CTX = 20000

SIGNATURE = "REEXTRACT-29MAY-batch1"
EXTRACTOR = f"{SIGNATURE} (Cerebras gpt-oss-120b)"


def load_env():
    env_file = ROOT / ".env.local"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        if k.strip() and not os.environ.get(k.strip()):
            os.environ[k.strip()] = v.strip().strip('"').strip("'")


def strip_html(html: str) -> str:
    txt = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    txt = re.sub(r"<style[^>]*>.*?</style>", " ", txt, flags=re.DOTALL | re.IGNORECASE)
    txt = re.sub(r"<[^>]+>", " ", txt)
    txt = re.sub(r"&nbsp;", " ", txt)
    txt = re.sub(r"&amp;", "&", txt)
    txt = re.sub(r"\s+", " ", txt)
    return txt


def find_source(ticker: str) -> tuple[str | None, str | None]:
    """Return (source_path_str, full_text) or (None, None)."""
    # US 10-K
    if "." not in ticker:
        if CAT1.exists():
            for yr in sorted(os.listdir(CAT1), reverse=True):
                d = CAT1 / yr
                if not d.is_dir():
                    continue
                for f in sorted(d.glob(f"{ticker}_*.htm.gz"), reverse=True):
                    try:
                        with gzip.open(f, "rt", errors="ignore") as g:
                            return f"10-K {yr} ({f.name})", strip_html(g.read())
                    except Exception:
                        continue
        # FPI 20-F
        if CAT2_20F.exists():
            for yr in sorted(os.listdir(CAT2_20F), reverse=True):
                d = CAT2_20F / yr
                if not d.is_dir():
                    continue
                for f in sorted(d.glob(f"{ticker}_*.htm.gz"), reverse=True):
                    try:
                        with gzip.open(f, "rt", errors="ignore") as g:
                            return f"20-F {yr} ({f.name})", strip_html(g.read())
                    except Exception:
                        continue
    # EU annual-text
    eu_dir = CAT3 / ticker / "annual-text"
    if eu_dir.exists():
        files = sorted(eu_dir.glob("*.txt"), reverse=True)
        if files:
            try:
                return f"annual-text {files[0].name}", files[0].read_text(errors="ignore")
            except Exception:
                pass
    return None, None


def find_section(text: str) -> str:
    """Find best section : prefer tables with segment revenue numbers.

    Strategy : look for patterns where a segment keyword is followed shortly
    by multiple dollar values (= a real revenue table), not just narrative.
    """
    # Pattern: keyword followed within 300 chars by at least 2 dollar values
    table_patterns = [
        r"(net revenue (?:by|in)\s*\w+\s*segment.{0,400}\$\s*[\d,.]+.{0,200}\$\s*[\d,.]+)",
        r"(revenue (?:by|in)\s*\w+\s*segment.{0,400}\$\s*[\d,.]+.{0,200}\$\s*[\d,.]+)",
        r"(net sales by.{0,300}\$\s*[\d,.]+.{0,200}\$\s*[\d,.]+)",
        r"(disaggregation of revenue.{0,500}\$\s*[\d,.]+.{0,200}\$\s*[\d,.]+)",
        r"(segment.{0,50}revenue.{0,400}\$\s*[\d,.]+.{0,200}\$\s*[\d,.]+)",
    ]
    for pat in table_patterns:
        matches = list(re.finditer(pat, text, re.IGNORECASE | re.DOTALL))
        if matches:
            m = matches[0]  # earliest substantive match
            start = max(0, m.start() - 800)
            return text[start:start + MAX_CTX]

    # Fall back to keyword-only LAST occurrence
    strong_keywords = [
        r"net sales by reportable segment",
        r"revenue by segment",
        r"revenues by segment",
        r"revenue by reportable segment",
        r"disaggregation of revenue",
        r"segment information",
        r"operating segments",
        r"segment results",
        r"revenue by product",
        r"revenue by geography",
        r"revenue by region",
    ]
    best_offset = None
    for pat in strong_keywords:
        matches = list(re.finditer(pat, text, re.IGNORECASE))
        if matches:
            cand = matches[-1].start()
            if best_offset is None or cand > best_offset:
                best_offset = cand
    if best_offset is not None:
        start = max(0, best_offset - 1500)
        return text[start:start + MAX_CTX]

    # Item 7 MD&A
    m_item7 = list(re.finditer(r"item\s+7\b", text, re.IGNORECASE))
    if m_item7:
        start = max(0, m_item7[-1].start() - 500)
        return text[start:start + MAX_CTX]

    mid = len(text) // 3
    return text[mid:mid + MAX_CTX]


PROMPT = """Tu es un analyste financier expert qui extrait des KPIs SPÉCIFIQUES (non-génériques) à partir de filings publics.

SOCIÉTÉ : {name} (ticker {ticker})
SOURCE : {source_label}

KPIs DÉJÀ EXTRAITS (à NE PAS reproduire) :
{existing_shorts}

KPIs GÉNÉRIQUES INTERDITS — NE JAMAIS INCLURE NI LEUR VARIANTES :
Revenue, Total Revenue, Net Revenue, Operating Margin, Op Margin, Operating Income, EPS, Diluted EPS, Net Income, EBITDA, EBITDA Margin, FCF, Free Cash Flow, Headcount, Capex, R&D, R&D Expense, Gross Margin, Cap Return, DPS, Payout Ratio, Total Assets, Total Debt, Cash, Cash & Equivalents, Net Debt, Buybacks, Market Cap, Leverage Ratio, Interest Expense, Interest Income, Tax Rate, Effective Tax Rate, Inventory, Inventory Charges, SG&A, Selling Expenses, Receivables, Goodwill, Working Capital.

MISSION : extraire {n_needed} KPIs SPÉCIFIQUES à cette société ou à son sous-secteur (= métriques que SEULE cette société publie ou qui caractérisent son business model), avec history sur ≥3 ans (idéalement 5 ans).

EXTRAIT SOURCE :
{source_excerpt}

EXEMPLES de KPIs spécifiques par secteur (à imiter, pas copier) :
- Pharma : ventes médicament phare en M$, vaccins en M$, pipeline phase 3 (nombre de molécules)
- Tech logiciel : Cloud Revenue, Data Center Revenue, Active Users, ARR, Net Revenue Retention
- Banques : Tier 1 ratio %, Net Interest Margin %, Loan Book Mds$, RoTE %
- Conso : Comparable Sales Growth %, Units Sold (millions), Store Count, ARPU
- Industrie : Backlog Mds$, Bookings, Orders, Book-to-bill, Production volume
- REITs : Same Store NOI Growth %, Occupancy %, FFO per share $
- Énergie : Production kboe/d, Réserves prouvées, LNG volume, Refining margins
- Semi-conducteurs : Wafer shipments, ASP, Foundry capacity, Tools shipped
- Assurance : Combined Ratio %, Premiums earned, Loss Ratio %
- Compagnies aériennes : ASMs, RPMs, Load Factor %, Yield, RASM, CASM
- Healthcare instruments : Life Sciences Revenue, Diagnostics Revenue, Mass Spec Revenue, Liquid Chromatography Revenue
- Packaging : Flexibles Revenue, Rigid Revenue, Recycled Content %, Volume Mtons
- Restauration : Comparable Sales, Units Opened, System-wide Sales, Average Unit Volume
- Boissons : Unit Case Volume, Concentrate Sales, Sparkling Volume, Still Volume

IMPORTANT : adapte les KPIs au secteur RÉEL de la sté. Cherche dans la source les SEGMENTS de revenu, les VOLUMES OPÉRATIONNELS, les MÉTRIQUES PROPRES de cette sté. Évite les lignes comptables banales (intérêts, taxes, inventaire pur).

FORMAT JSON STRICT :
{{
  "kpis": [
    {{
      "short": "<acronyme court, ex 'Top Drug', 'Backlog'>",
      "name_fr": "<nom FR strict, sans em-dash>",
      "name_en": "<nom EN>",
      "value": <nombre dernière période>,
      "unit": "<$, Mds $, M $, %, etc>",
      "yoy": "<+X.X%> ou null",
      "type": "Revenue|Margin|Volume|Ratio|Operational",
      "history": [<v1>, <v2>, <v3>, <v4>, <v5>],
      "period_type": "year",
      "last_data_date": "<YYYY-MM-DD>",
      "signal": "<1 phrase FR>",
      "description": "<1-2 phrases FR sourcées>"
    }}
  ]
}}

RÈGLES ABSOLUES :
1. history doit avoir AU MOINS 3 valeurs réelles trouvées dans le texte. Si tu n'en trouves pas 3, n'inclus PAS ce KPI.
2. JAMAIS inventer une valeur. JAMAIS extrapoler. Si pas chiffré → skip.
3. JAMAIS de KPI générique (cf liste interdite).
4. JAMAIS d'em-dash (—) ni de tiret long. Utiliser ":" ou découper en 2 phrases.
5. JAMAIS de KPI déjà extrait (cf liste).
6. Vocabulaire FR strict. Pas d'anglicismes inutiles.
7. Si tu ne trouves pas {n_needed} KPIs spécifiques valides, retourne moins (vide acceptable).

RETOURNE UNIQUEMENT LE JSON, pas de markdown, pas de texte autour."""


def call_cerebras(prompt: str, api_key: str, retries: int = 2) -> dict | None:
    body = json.dumps({
        "model": MODEL_ID,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 8000,
        "response_format": {"type": "json_object"},
    }).encode()
    headers = {
        "Authorization": f"Bearer {api_key}",
        "content-type": "application/json",
        "User-Agent": "curl/7.79.1",
    }
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(CEREBRAS_URL, data=body, headers=headers)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=180) as r:
                resp = json.loads(r.read())
            content = resp["choices"][0]["message"]["content"]
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
            # Remove <think>...</think> if model added it
            content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                m = re.search(r"\{.*\}", content, re.DOTALL)
                if m:
                    try:
                        return json.loads(m.group(0))
                    except json.JSONDecodeError:
                        pass
                return None
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries:
                time.sleep(BACKOFF_429)
                continue
            print(f"  HTTP {e.code}: {e.reason}", file=sys.stderr)
            return None
        except Exception as e:
            print(f"  Err: {e}", file=sys.stderr)
            time.sleep(3)
    return None


def get_api_keys():
    keys = [
        os.environ.get("CEREBRAS_API_KEY"),
        os.environ.get("CEREBRAS2_API_KEY"),
        os.environ.get("CEREBRAS3_API_KEY"),
    ]
    return [k for k in keys if k]


def load_generic_set() -> set[str]:
    """Load generic KPI shorts (lowercase) from kpi-generic-library.json."""
    try:
        entries = json.loads(GENERIC_LIB.read_text())
        return {e.get("short", "").lower().strip() for e in entries if e.get("short")}
    except Exception:
        return set()


def is_generic(short: str, generic_set: set[str]) -> bool:
    if not short:
        return True
    s = short.lower().strip()
    if s in generic_set:
        return True
    # Common variants
    aliases = {
        "total revenue", "net revenue", "revenue", "op margin", "operating margin",
        "operating income", "eps", "diluted eps", "net income", "ebitda", "ebitda margin", "fcf",
        "free cash flow", "headcount", "capex", "r&d", "r&d expense",
        "gross margin", "cap return", "dps", "payout ratio", "total assets",
        "total debt", "cash", "cash & equivalents", "net debt", "buybacks",
        "market cap", "leverage ratio", "interest expense", "interest income",
        "int exp", "int inc", "tax rate", "effective tax rate", "tax expense",
        "inventory", "inventory charges", "inv charges", "invcharges",
        "sg&a", "sga", "selling expenses", "receivables", "goodwill",
        "working capital", "stock-based comp", "sbc",
    }
    return s in aliases


def has_em_dash(s) -> bool:
    if not isinstance(s, str):
        return False
    return "—" in s or "–" in s


def sanitize_em_dash(s: str) -> str:
    return s.replace("—", " : ").replace("–", "-")


def process_ticker(ticker: str, needed: int, api_key: str, generic_set: set[str], dry_run: bool = False) -> dict:
    """Process one ticker. Returns stats."""
    p = KPIS_DIR / f"{ticker}.json"
    if not p.exists():
        # Create stub
        data = {"ticker": ticker, "kpis": []}
    else:
        try:
            data = json.loads(p.read_text())
        except Exception:
            return {"status": "parse_error", "ticker": ticker}

    existing_kpis = data.get("kpis", []) or []
    existing_shorts = {k.get("short", "").lower().strip() for k in existing_kpis if k.get("short")}

    source_label, source_text = find_source(ticker)
    if not source_text:
        # Mark no source
        data.setdefault("_no_source_batches", []).append(SIGNATURE)
        data["_no_source"] = True
        data["_no_source_reason"] = "Pas de filing local (cat1/cat2/cat3)"
        if not dry_run:
            p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        return {"status": "no_source", "ticker": ticker, "added": 0}

    excerpt = find_section(source_text)

    existing_list_str = ", ".join(sorted(existing_shorts)) if existing_shorts else "(aucun)"
    prompt = PROMPT.format(
        name=data.get("name", ticker),
        ticker=ticker,
        source_label=source_label,
        existing_shorts=existing_list_str,
        n_needed=needed,
        source_excerpt=excerpt,
    )

    result = call_cerebras(prompt, api_key)
    if not result or "kpis" not in result:
        return {"status": "llm_fail", "ticker": ticker, "added": 0}

    new_kpis_raw = result.get("kpis", []) or []
    added = []
    rejected = []
    for k in new_kpis_raw:
        short = (k.get("short") or "").strip()
        if not short:
            rejected.append(("no_short", k))
            continue
        if short.lower() in existing_shorts:
            rejected.append(("duplicate", short))
            continue
        if is_generic(short, generic_set):
            rejected.append(("generic", short))
            continue
        hist = k.get("history") or []
        if not isinstance(hist, list) or len(hist) < 3:
            rejected.append(("history_too_short", short))
            continue
        # Sanitize text fields for em-dash
        for fld in ("name_fr", "name_en", "signal", "description"):
            if fld in k and isinstance(k[fld], str):
                k[fld] = sanitize_em_dash(k[fld])
        # Tag
        k["_extracted_by"] = SIGNATURE
        added.append(k)
        existing_shorts.add(short.lower())

    if not added:
        # Still mark as attempted
        data["_last_reextract_attempt"] = datetime.now(timezone.utc).isoformat()
        data["_last_reextract_signature"] = SIGNATURE
        data["_last_reextract_result"] = f"0 added (rejected: {len(rejected)})"
        if not dry_run:
            p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        return {"status": "no_valid_kpi", "ticker": ticker, "added": 0, "rejected": rejected}

    # Append
    data["kpis"] = existing_kpis + added
    data["_kpis_supplementary_signed_by"] = SIGNATURE
    data["_kpis_supplementary_extracted_at"] = datetime.now(timezone.utc).isoformat()
    data["_kpis_supplementary_source"] = f"{source_label} (Cerebras gpt-oss-120b)"

    if not dry_run:
        p.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    return {"status": "ok", "ticker": ticker, "added": len(added), "shorts": [k["short"] for k in added], "rejected": len(rejected)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-file", default="/tmp/reextract-batches-v2/batch1.json")
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--end", type=int, default=None)
    parser.add_argument("--key-index", type=int, default=0)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--only", help="comma separated tickers")
    args = parser.parse_args()

    load_env()
    keys = get_api_keys()
    if not keys:
        print("ERR: no Cerebras API keys", file=sys.stderr)
        sys.exit(1)
    api_key = keys[args.key_index % len(keys)]

    generic_set = load_generic_set()
    print(f"Generic library loaded: {len(generic_set)} entries", file=sys.stderr)

    batch = json.loads(Path(args.batch_file).read_text())
    if args.only:
        only = {t.strip() for t in args.only.split(",")}
        batch = [x for x in batch if x["ticker"] in only]
    end = args.end if args.end is not None else len(batch)
    batch = batch[args.start:end]

    print(f"Processing {len(batch)} tickers (key index {args.key_index})", file=sys.stderr)

    summary = {"ok": 0, "no_source": 0, "no_valid_kpi": 0, "llm_fail": 0, "parse_error": 0, "total_added": 0}
    results = []

    for i, item in enumerate(batch, 1):
        ticker = item["ticker"]
        needed = item["needed"]
        print(f"[{i}/{len(batch)}] {ticker} needed={needed} ... ", end="", file=sys.stderr, flush=True)
        try:
            r = process_ticker(ticker, needed, api_key, generic_set, dry_run=args.dry_run)
        except Exception as e:
            print(f"EXC {e}", file=sys.stderr)
            r = {"status": "exception", "ticker": ticker, "error": str(e)}
        results.append(r)
        status = r.get("status", "?")
        added = r.get("added", 0)
        print(f"{status} added={added}", file=sys.stderr)
        summary[status] = summary.get(status, 0) + 1
        summary["total_added"] += added
        time.sleep(SLEEP)

    print("\n=== SUMMARY ===", file=sys.stderr)
    print(json.dumps(summary, indent=2), file=sys.stderr)

    # Save run log
    log_dir = ROOT / "logs/reextract-29may"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / f"batch1-key{args.key_index}-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}.json"
    log_file.write_text(json.dumps({"summary": summary, "results": results}, indent=2, ensure_ascii=False))
    print(f"Log saved: {log_file}", file=sys.stderr)


if __name__ == "__main__":
    main()
