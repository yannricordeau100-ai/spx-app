#!/usr/bin/env python3
"""SA22-C — Extract NEW sectoral quarterly KPIs via Cerebras free (gpt-oss-120b).

Reads 10-Q (US) / annual-text / 20-F for each ticker in /tmp/quart-batch-{16..23}.json
Asks Cerebras to extract 1-3 NEW sectoral KPIs DIRECTLY in quarterly format.
APPENDS to src/data/v2-pipeline-enrich/<slug>.json field kpis[] (additive).

Each KPI MUST have:
  - period_type: "quarter"
  - history: list of >=4 quarterly values (ideal 8-16)
  - history_periods: list ["Q4 2023","Q1 2024",...]
  - source: explicit text
  - _fix_log: ["SA22-C ..."]

Anti-invention: strict prompt, refuse fabrication.

ZERO Anthropic. Cerebras free 3 keys rotation. Sleep 4s.
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
ENRICH_DIR = ROOT / "src/data/v2-pipeline-enrich"
SEC_DATA = Path("/Users/yann/Mettrik/sec-data")
CAT1_10Q = SEC_DATA / "cat1-us/10Q"
CAT1_10K = SEC_DATA / "cat1-us/10K"
CAT2_20F = SEC_DATA / "cat2-foreign-adr/20F"
CAT3_EU = SEC_DATA / "cat3-european"

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL_ID = os.environ.get("CEREBRAS_MODEL", "gpt-oss-120b")
SLEEP = float(os.environ.get("SA22C_SLEEP", "7.0"))
BACKOFF_429 = float(os.environ.get("SA22C_BACKOFF", "20.0"))
MAX_CTX = 14000

MARKER = "SA22-C"


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


def get_api_keys() -> list[str]:
    order = os.environ.get("CEREBRAS_KEY_ORDER", "1,2,3")
    name_map = {"1": "CEREBRAS_API_KEY", "2": "CEREBRAS2_API_KEY", "3": "CEREBRAS3_API_KEY"}
    keys = []
    for n in order.split(","):
        env = name_map.get(n.strip())
        if env:
            v = os.environ.get(env)
            if v:
                keys.append(v)
    return keys


def strip_html(html: str) -> str:
    txt = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    txt = re.sub(r"<style[^>]*>.*?</style>", " ", txt, flags=re.DOTALL | re.IGNORECASE)
    txt = re.sub(r"<[^>]+>", " ", txt)
    # remove XBRL/iXBRL namespace blobs (CIK 0001234567 dates members) that look like noise
    txt = re.sub(r"\b\d{10}\s+\d{4}-\d{2}-\d{2}\s+\d{4}-\d{2}-\d{2}\b", " ", txt)
    txt = re.sub(r"\b(us-gaap|ifrs-full|dei|cmcsa|xbrli)[:\w-]+(Member|Axis|Domain)?\b", " ", txt)
    txt = re.sub(r"&[a-z]+;", " ", txt)
    txt = re.sub(r"&#\d+;", " ", txt)
    # skip leading XBRL preamble: find first plain English sentence-like content
    m = re.search(r"(UNITED STATES|SECURITIES AND EXCHANGE|FORM 10|FORM 20|Item\s+[12])", txt)
    if m:
        txt = txt[m.start():]
    txt = re.sub(r"\s+", " ", txt)
    return txt


def extract_segment_table(text: str) -> str:
    """Within a single filing, grab the densest segment/results-of-ops chunks.

    Skips the table of contents (~first 4000 chars) where every term appears once.
    """
    # Skip TOC + cover. Use the SECOND occurrence of "Management's Discussion" or
    # any segment phrase past 1/4 of the document to land in the actual body.
    candidates: list[int] = []
    for pat in (
        r"Management.{0,40}Discussion\s+and\s+Analysis",
        r"Segment\s+Information",
        r"Net\s+Revenue\s+by",
        r"Revenue\s+by\s+(segment|reportable|business|end\s+market)",
        r"Results\s+of\s+Operations\b",
        r"Reportable\s+Segments?\b",
    ):
        occurs = list(re.finditer(pat, text, re.IGNORECASE))
        if len(occurs) >= 2:
            candidates.append(occurs[1].start())
        elif occurs and occurs[0].start() > len(text) // 5:
            candidates.append(occurs[0].start())
    if candidates:
        start_search = min(candidates)
    else:
        start_search = len(text) // 4
    body = text[start_search:]
    patterns = [
        r"segment\s+(net\s+)?revenue",
        r"segment\s+results",
        r"segment\s+net\s+sales",
        r"net\s+revenue\s+by\s+",
        r"revenue\s+by\s+(segment|end\s+market|reportable|operating|business|product)",
        r"net\s+sales\s+by\s+(segment|reportable|operating|business|product|end\s+market)",
        r"reportable\s+segment",
        r"\bend\s+market\b",
        r"adjusted\s+EBITDA\s+by",
        r"results\s+of\s+operations",
    ]
    spans: list[tuple[int, int]] = []
    for pat in patterns:
        for m in re.finditer(pat, body, re.IGNORECASE):
            s = max(0, m.start() - 300)
            e = min(len(body), m.start() + 2500)
            spans.append((s, e))
    if not spans:
        return body[:6000]
    spans.sort()
    merged: list[tuple[int, int]] = []
    for s, e in spans:
        if merged and s <= merged[-1][1] + 200:
            merged[-1] = (merged[-1][0], max(merged[-1][1], e))
        else:
            merged.append((s, e))
    out = []
    total = 0
    for s, e in merged:
        chunk = body[s:e]
        if total + len(chunk) > 8000:
            chunk = chunk[: 8000 - total]
        out.append(chunk)
        total += len(chunk)
        if total >= 8000:
            break
    return "\n...\n".join(out)


def gather_sources(ticker: str) -> tuple[str, str]:
    """Return (text, source_label) — concatenates up to 3 recent quarterly + 1 annual."""
    chunks: list[tuple[str, str]] = []
    upper = ticker.upper()

    # EU pure (suffix .XX)
    if "." in upper and not upper.endswith(".B"):
        # cat3-european
        eu_dir = CAT3_EU / upper
        if not eu_dir.exists():
            # try without suffix mapping
            pass
        if eu_dir.exists():
            for sub in ("half-year", "annual-text"):
                d = eu_dir / sub
                if d.exists():
                    files = sorted(d.glob("*.txt"), reverse=True)[:3]
                    for f in files:
                        try:
                            chunks.append((f.read_text(errors="ignore")[:6000], f"{sub}/{f.name}"))
                        except Exception:
                            continue
        if chunks:
            text = "\n\n===\n\n".join(c[0] for c in chunks)
            label = "EU: " + ", ".join(c[1] for c in chunks)
            return text, label

    # FPI (cat2 20-F) — try simple ticker match
    if CAT2_20F.exists():
        years = sorted(os.listdir(CAT2_20F), reverse=True)
        for year in years[:3]:
            d = CAT2_20F / year
            if not d.is_dir():
                continue
            files = list(d.glob(f"{upper}_*.htm.gz")) + list(d.glob(f"{upper.replace('.','-')}_*.htm.gz"))
            if files:
                try:
                    with gzip.open(files[0], "rt", errors="ignore") as g:
                        chunks.append((strip_html(g.read())[:8000], f"20-F {year}"))
                    break
                except Exception:
                    continue

    # US: many recent 10-Q (8) + 2 most recent 10-K
    seen_files: set[str] = set()
    if CAT1_10Q.exists():
        all_qfiles = []
        for year in sorted(os.listdir(CAT1_10Q), reverse=True)[:5]:
            d = CAT1_10Q / year
            if not d.is_dir():
                continue
            for pat in (f"{upper}_*.htm.gz", f"{upper.replace('.','-')}_*.htm.gz"):
                for f in d.glob(pat):
                    if f.name in seen_files:
                        continue
                    seen_files.add(f.name)
                    all_qfiles.append((year, f.name, f))
        all_qfiles.sort(reverse=True)
        for year, name, f in all_qfiles[:8]:
            try:
                with gzip.open(f, "rt", errors="ignore") as g:
                    stripped = strip_html(g.read())
                    section = extract_segment_table(stripped)
                    chunks.append((section[:4500], f"10-Q {name[:30]}"))
            except Exception:
                continue

    if CAT1_10K.exists():
        added_k = 0
        for year in sorted(os.listdir(CAT1_10K), reverse=True)[:3]:
            d = CAT1_10K / year
            if not d.is_dir():
                continue
            for pat in (f"{upper}_*.htm.gz", f"{upper.replace('.','-')}_*.htm.gz"):
                files = list(d.glob(pat))
                if files:
                    try:
                        with gzip.open(files[0], "rt", errors="ignore") as g:
                            stripped = strip_html(g.read())
                            section = extract_segment_table(stripped)
                            chunks.append((section[:5500], f"10-K {year}"))
                        added_k += 1
                    except Exception:
                        continue
            if added_k >= 2:
                break

    if not chunks:
        return "", ""

    text = "\n\n===\n\n".join(c[0] for c in chunks)
    label = ", ".join(c[1] for c in chunks)
    return text[:MAX_CTX * 2], label


def find_kpi_section(text: str) -> str:
    """Concatenate the densest segment/MD&A/operational sections found."""
    patterns = [
        r"revenue\s+by\s+(segment|operating|reportable|category|product|end\s+market|geograph)",
        r"net\s+revenue\s+by\s+",
        r"net\s+sales\s+by\s+",
        r"segment\s+(results|information|reporting|net|revenue|operating)",
        r"reportable\s+segment",
        r"end\s+market",
        r"key\s+(business|operating|performance)\s+metric",
        r"selected\s+operating\s+data",
        r"operating\s+statistics",
        r"results\s+of\s+operations",
        r"three\s+months\s+ended",
    ]
    spans: list[tuple[int, int]] = []
    for pat in patterns:
        for m in re.finditer(pat, text, re.IGNORECASE):
            start = max(0, m.start() - 400)
            end = min(len(text), m.start() + 3500)
            spans.append((start, end))
    if not spans:
        n = len(text)
        return text[n // 4:n // 4 + MAX_CTX]
    spans.sort()
    merged: list[tuple[int, int]] = []
    for s, e in spans:
        if merged and s <= merged[-1][1] + 200:
            merged[-1] = (merged[-1][0], max(merged[-1][1], e))
        else:
            merged.append((s, e))
    out_parts = []
    total = 0
    for s, e in merged:
        chunk = text[s:e]
        if total + len(chunk) > MAX_CTX:
            chunk = chunk[: MAX_CTX - total]
        out_parts.append(chunk)
        total += len(chunk)
        if total >= MAX_CTX:
            break
    return "\n...\n".join(out_parts)


PROMPT = """Tu es un analyste financier rigoureux. Extrais 1 à 3 NOUVEAUX KPIs SECTORIELS SPECIFIQUES en QUARTERLY a partir des filings ci-dessous.

Ticker : {ticker}
Source : {source}

KPIs deja extraits (NE PAS dupliquer, choisir des KPIs differents) : {existing_shorts}

EXTRAIT du filing :
{excerpt}

REGLES STRICTES :
1. JAMAIS inventer. Chaque trimestre listé doit etre chiffré explicitement dans le texte (ou calculable sans ambiguite a partir de chiffres listés).
2. Periode : period_type DOIT etre "quarter". history_periods doit lister ["Q4 2023","Q1 2024","Q2 2024",...] en ordre chronologique croissant.
3. Minimum 4 trimestres reels, ideal 8-16.
4. SPECIFIQUE au secteur/sous-secteur de la sté. Exemples acceptables :
   - semi-conducteurs : revenu par end-market (Industrial, Automotive, Communications, Consumer), wafer shipments
   - banque : Net Interest Margin, Tier 1 ratio, Loans
   - pharma : ventes produit phare, ventes par classe therapeutique
   - energie : Production Mboe/j, prix realise, reserves
   - SaaS : ARR, NRR, MAU/DAU
   - retail : Comparable Sales, store count, ticket moyen
   - media : MAU/DAU/ARPU
   - segment revenue (revenu par segment metier ou geographie) en quarterly est ACCEPTABLE et FORTEMENT ENCOURAGE
5. INTERDIT GENERIQUES top-line : Total Revenue (consolide), Net Income, EPS, Op Margin global, FCF, EBITDA global, R&D total, Capex total, Headcount, Cash & Equivalents, Net Debt.
6. Pas d'em-dash. Vocabulaire FR strict (pas d'anglicismes purs).
7. value = derniere valeur (la plus recente).
8. unit en FR (Mds $, M $, Mds €, M €, %, units, kboe/j, Mt, MW, GWh, etc).
9. yoy = "+X.X%" ou "-X.X%" calcule sur 4 trimestres si possible, sinon null.
10. Si tu trouves un tableau de revenus par segment trimestriel : EXTRAIRE chaque segment comme un KPI distinct (max 3).

RETOURNE STRICTEMENT ce JSON (pas de markdown) :
{{
  "new_kpis": [
    {{
      "short": "Nom_Concis",
      "name_fr": "Nom francais court",
      "name_en": "English short name",
      "value": <number>,
      "unit": "<Mds $ / % / ...>",
      "yoy": "<+X.X% ou null>",
      "period_type": "quarter",
      "history": [<liste de valeurs reelles en ordre chronologique>],
      "history_periods": ["Q4 2023", "Q1 2024", "Q2 2024", ...],
      "source": "<filing court ex 10-Q Q3 2025 + 10-K 2024>",
      "description": "<courte description FR, 1 phrase, sans em-dash>",
      "signal": "<ce que la valeur signifie, sans em-dash>"
    }}
  ]
}}

Si tu ne trouves AUCUN KPI sectoriel avec au moins 4 trimestres reels : retourne {{"new_kpis": []}}.
"""


GENERIC_SHORTS = {
    "revenue", "totalrevenue", "netincome", "eps", "epsdilue", "epsdiluted",
    "opmargin", "operatingmargin", "fcf", "freecashflow", "ebitda", "ebitdamargin",
    "rd", "research", "capex", "capexs", "headcount", "cash", "netdebt", "totaldebt",
    "grossmargin", "marketcap", "buybacks", "leverageratio", "dps", "payoutratio",
    "capreturn",
}


def is_generic(short: str, name_fr: str = "", name_en: str = "") -> bool:
    s = re.sub(r"[^a-z]", "", (short or "").lower())
    if s in GENERIC_SHORTS:
        return True
    blob = (name_fr + " " + name_en).lower()
    for kw in ("total revenue", "net income", "ebitda margin", "free cash flow",
               "operating margin", "operating income", "headcount", "research and dev",
               "capital expenditure"):
        if kw in blob:
            return True
    return False


def call_cerebras(prompt: str, keys: list[str], retries: int = 5) -> dict | None:
    body = json.dumps({
        "model": MODEL_ID,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 6000,
        "response_format": {"type": "json_object"},
    }).encode()
    for attempt in range(retries + 1):
        api_key = keys[attempt % len(keys)]
        headers = {
            "Authorization": f"Bearer {api_key}",
            "content-type": "application/json",
            "User-Agent": "curl/7.79.1",
        }
        try:
            req = urllib.request.Request(CEREBRAS_URL, data=body, headers=headers)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=120) as r:
                resp = json.loads(r.read())
            msg = resp["choices"][0]["message"]
            content = (msg.get("content") or "").strip()
            if not content:
                content = (msg.get("reasoning") or "").strip()
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content)
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                m = re.search(r"\{[\s\S]*\}", content)
                if m:
                    try:
                        return json.loads(m.group(0))
                    except Exception:
                        pass
                return None
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries:
                wait = BACKOFF_429 + 3 * attempt
                print(f"   HTTP 429 (key {attempt % len(keys)}), wait {wait}s", file=sys.stderr)
                time.sleep(wait)
                continue
            print(f"   HTTP {e.code}: {e.reason}", file=sys.stderr)
            if e.code in (401, 402, 403):
                return None
            time.sleep(5)
        except Exception as e:
            print(f"   exc({attempt}): {e}", file=sys.stderr)
            time.sleep(5)
    return None


def slug_for_ticker(ticker: str) -> str:
    return ticker.lower()


def validate_kpi(k: dict) -> tuple[bool, str]:
    if not isinstance(k, dict):
        return False, "not dict"
    short = k.get("short")
    if not short or not isinstance(short, str):
        return False, "no short"
    if is_generic(short, k.get("name_fr", ""), k.get("name_en", "")):
        return False, "generic"
    if k.get("period_type") != "quarter":
        return False, "not quarter"
    hist = k.get("history") or []
    if not isinstance(hist, list) or len(hist) < 4:
        return False, "history<4"
    periods = k.get("history_periods") or []
    if not isinstance(periods, list) or len(periods) != len(hist):
        return False, "periods mismatch"
    # check periods look like Qx YYYY
    if not all(re.match(r"^(Q[1-4]|H[12]|S[12])\s+\d{4}", str(p)) for p in periods):
        return False, "periods format"
    # ensure numeric
    try:
        for v in hist:
            float(v)
    except Exception:
        return False, "history not num"
    # sanitize em-dashes
    for fld in ("description", "signal", "name_fr", "name_en", "source"):
        v = k.get(fld)
        if isinstance(v, str) and "—" in v:
            k[fld] = v.replace("—", " : ")
    return True, "ok"


def process_ticker(ticker: str, keys: list[str], force: bool = False) -> str:
    slug = slug_for_ticker(ticker)
    fpath = ENRICH_DIR / f"{slug}.json"

    if not fpath.exists():
        data = {"ticker": ticker, "kpis": []}
    else:
        try:
            data = json.loads(fpath.read_text())
        except Exception:
            return "parse_error"

    existing_kpis = data.get("kpis") or []
    if not isinstance(existing_kpis, list):
        existing_kpis = []

    # idempotence: skip if already SA22-C ran
    already = any(
        isinstance(k, dict) and isinstance(k.get("_fix_log"), list)
        and any(MARKER in str(x) for x in k.get("_fix_log", []))
        for k in existing_kpis
    )
    if already and not force:
        return "skip_signed"

    text, source_label = gather_sources(ticker)
    if not text or len(text) < 3000:
        return "no_source"

    # text already focused on segment/results sections per source
    excerpt = text[:MAX_CTX]
    if len(excerpt) < 1500:
        return "short_excerpt"

    existing_shorts = [k.get("short") for k in existing_kpis if isinstance(k, dict) and k.get("short")]
    existing_str = ", ".join(existing_shorts[:30]) if existing_shorts else "(aucun)"

    prompt = PROMPT.format(
        ticker=ticker,
        source=source_label[:200],
        existing_shorts=existing_str[:600],
        excerpt=excerpt[:MAX_CTX],
    )

    result = call_cerebras(prompt, keys)
    if not result:
        return "llm_fail"

    new_kpis_raw = result.get("new_kpis") or []
    if not isinstance(new_kpis_raw, list):
        return "no_valid"

    appended = 0
    seen = {k.get("short") for k in existing_kpis if isinstance(k, dict)}
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for k in new_kpis_raw:
        ok, reason = validate_kpi(k)
        if not ok:
            continue
        if k["short"] in seen:
            continue
        k.setdefault("type", "Sectoriel")
        k.setdefault("nature", "Structurel")
        k.setdefault("comparable", "Sous-secteur")
        k.setdefault("last_data_date", ts)
        k["_fix_log"] = [f"{MARKER} Cerebras gpt-oss-120b {ts} source: {source_label[:120]}"]
        existing_kpis.append(k)
        seen.add(k["short"])
        appended += 1

    if appended == 0:
        return "no_valid_kpis"

    data["kpis"] = existing_kpis
    data["_sa22c_signed_at"] = datetime.now(timezone.utc).isoformat()
    data["_sa22c_source"] = source_label[:300]
    data["_sa22c_appended"] = data.get("_sa22c_appended", 0) + appended

    fpath.parent.mkdir(parents=True, exist_ok=True)
    fpath.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    return f"ok+{appended}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--batches", default="16-23", help="e.g. 16-23 or 16,17,18")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--start", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    load_env()
    keys = get_api_keys()
    if not keys:
        print("No CEREBRAS keys.", file=sys.stderr)
        sys.exit(1)
    print(f"Loaded {len(keys)} Cerebras key(s).")

    # parse batches
    batch_nums: list[int] = []
    if "-" in args.batches:
        a, b = args.batches.split("-")
        batch_nums = list(range(int(a), int(b) + 1))
    else:
        batch_nums = [int(x) for x in args.batches.split(",")]

    tickers: list[str] = []
    seen = set()
    for n in batch_nums:
        p = Path(f"/tmp/quart-batch-{n:02d}.json")
        if not p.exists():
            print(f"missing {p}", file=sys.stderr)
            continue
        try:
            arr = json.loads(p.read_text())
            for t in arr:
                if t not in seen:
                    tickers.append(t)
                    seen.add(t)
        except Exception as e:
            print(f"parse error {p}: {e}", file=sys.stderr)

    print(f"Total {len(tickers)} unique tickers across batches {batch_nums}")

    if args.start:
        tickers = tickers[args.start:]
    if args.limit:
        tickers = tickers[:args.limit]

    print(f"Processing {len(tickers)} tickers.")

    from collections import Counter
    results: dict[str, str] = {}
    counter: Counter = Counter()

    for i, ticker in enumerate(tickers):
        print(f"[{i+1}/{len(tickers)}] {ticker:14} ", end="", flush=True)
        try:
            status = process_ticker(ticker, keys, force=args.force)
        except Exception as e:
            status = f"exc:{e}"
        results[ticker] = status
        kind = status.split("+")[0] if status.startswith("ok") else status
        counter[kind] += 1
        print(f"-> {status}")
        if not status.startswith("skip"):
            time.sleep(SLEEP)

    print("\n=== SUMMARY ===")
    for k, v in counter.most_common():
        print(f"  {k}: {v}")

    out = Path("/tmp/sa22c-results.json")
    out.write_text(json.dumps(results, indent=2))
    print(f"\nResults: {out}")


if __name__ == "__main__":
    main()
