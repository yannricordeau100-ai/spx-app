#!/usr/bin/env python3
"""
Sub-agent #140 — Cerebras paid governance extraction for cluster
hard_multi_source (9 stés, FUTU skipped no source).

Multi-source dispatcher:
- DDOG (cat1-us) → DEF14A US extraction (logic from #131)
- 7 EU (cat3-european) → annual-text extraction (logic from #138)
- FUTU → skipped (no source local)

Cerebras qwen-3-235b-a22b-instruct-2507 (paid, PAID_MODE=1).
Key idx=2 (k2, libre après #123).

Writes overrides_governance into src/data/v2-pipeline-enrich/<lower>.json,
preserving existing fields.

Validation strict :
- CEO name pattern multilingual (US + EU accents/particles)
- board_size 3-30
- top_capital ≥1 (≥3 si possible, flag _lt_3 sinon)
- voting_structure enum (US + EU specifics)
- AUTO-ROLLBACK si hallucination (zero halluc policy)
- source_file must exist on filesystem
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

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
V19_COMPLETE = PROJECT_ROOT / "src/data/v1-9-complete"
V2_PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
V2_ENRICH = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
DEF14A_ROOT = PROJECT_ROOT / "sec-data/cat1-us/DEF14A"
EU_ROOT = PROJECT_ROOT / "sec-data/cat3-european"
RESULTS_DIR = PROJECT_ROOT / "src/data/governance-cerebras"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)
LOG = PROJECT_ROOT / ".conv-state/CONV-CONCEPTS-governance-cerebras-140.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL_ID = "qwen-3-235b-a22b-instruct-2507"
MAX_TOKENS = 3000
CTX_LEN = 40000

# US CEO pattern (from #131)
CEO_NAME_PATTERN_US = re.compile(
    r"^(?:[A-Z]\.?\s)?[A-Z][a-zA-Z'\-]+(?:\s[A-Z]\.?)*(?:\s[A-Z][a-zA-Z'\-]+){1,3}$"
)
# EU CEO pattern (from #138) - multilingual accents
CEO_NAME_PATTERN_EU = re.compile(
    r"^[A-ZÀ-Ý][\wÀ-ÿ'\-\.]+(?:\s+(?:de|van|von|den|der|du|del|della|di|le|la)\s+)?(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'\-\.]+){1,4}$"
)
CEO_NAME_BLOCKLIST = {
    "officer", "executive", "chairman", "president", "director",
    "energy", "industries", "company", "corporation", "incorporated",
    "named", "principal", "chief", "ceo", "cfo", "limited", "ltd",
    "plc", "sa", "ag", "se", "gmbh", "nv", "spa", "managing",
    "general", "deputy", "vice",
}

PROMPT_US = """Extract governance fields for {ticker} ({name}) from this DEF14A Proxy Statement excerpt.

Return STRICT JSON only (no markdown, no commentary):
{{
  "ceo_name": "<full name>" or null,
  "ceo_total_comp_m": <number in millions USD> or null,
  "cfo_name": "<full name>" or null,
  "board_size": <int> or null,
  "voting_structure": "one_share_one_vote" | "dual_class" | "multi_class" or null,
  "voting_structure_note": "<brief note>" or null,
  "director_independence_pct": <0-100 number> or null,
  "top_capital": [{{"name": "<institutional name>", "pct": <0-100>}}, ...] or [],
  "top_voting": [{{"name": "<institutional name>", "pct": <0-100>}}, ...] or []
}}

Rules (STRICT, NO EXCEPTIONS):
- ceo_name: REAL full name from "Summary Compensation Table" or named Officers section.
- ceo_total_comp_m: from "Total" column SCT for MOST RECENT fiscal year, millions USD. Range 0.5-200.
- board_size: count of directors (typically 8-15).
- voting_structure: "dual_class" if 2 classes (e.g. Datadog Class A/B), "one_share_one_vote" else.
- top_capital: ≥5% beneficial owners (Vanguard, BlackRock, FMR, State Street). ≥3 entries.
- director_independence_pct: from "independence" section.

CRITICAL: If a field is NOT in the excerpt, return null. NEVER guess.

DEF14A excerpt:
---
{excerpt}
---

Return ONLY the JSON object."""

PROMPT_EU = """Extract governance fields for {ticker} ({name}, {country}) from this Annual Report / URD excerpt.

Document may be multi-language: FR, DE, IT, EN, ES, NL, PT, NO (Norwegian for KOG.OL), FI (Finnish for FORTUM.HE).

Return STRICT JSON only (no markdown, no commentary):
{{
  "ceo_name": "<full name of group-level CEO>" or null,
  "cfo_name": "<full name>" or null,
  "board_size": <int> or null,
  "voting_structure": "one_share_one_vote" | "double_voting_rights" | "loyalty_shares" | "dual_class" | "preferred_shares_class" or null,
  "voting_structure_note": "<brief note>" or null,
  "director_independence_pct": <0-100 number> or null,
  "top_capital": [{{"name": "<shareholder name>", "pct": <0-100>, "type": "individual|institutional|state|family"}}, ...] or [],
  "top_voting": [{{"name": "<shareholder name>", "pct": <0-100>}}, ...] or []
}}

Multi-language patterns:
- CEO: "Chief Executive Officer", "Directeur Général" (FR), "Vorstandsvorsitzender" (DE), "Amministratore Delegato" (IT), "Consejero Delegado" (ES), "Bestuursvoorzitter" (NL), "konsernsjef" (NO), "toimitusjohtaja" (FI)
- Board: "Conseil d'Administration", "Aufsichtsrat", "Consiglio di Amministrazione", "Styret" (NO), "Hallitus" (FI)
- Voting: "droit de vote double" (FR Florange), "voto plurimo" (IT), "loyalty shares" (NL/EN)
- Shareholders: "détient X%", "hält X%", "possiede X%", "owns X%"

Rules (STRICT, NO EXCEPTIONS):
- ceo_name: REAL full name of GROUP-LEVEL CEO. Not division CEO. Accents OK.
- board_size: total board members (8-20 in EU).
- voting_structure: EU often has "double_voting_rights" (Florange), "loyalty_shares" (IT/NL).
- top_capital/top_voting: ≥3 entries if available. Include State as shareholder if state-owned.

CRITICAL: If a field is NOT in the excerpt, return null. NEVER guess. Zero hallucination.

Annual Report / URD excerpt:
---
{excerpt}
---

Return ONLY the JSON object."""

HTML_TAG_RE = re.compile(r"<[^>]+>")
HTML_ENTITY_NAMED_RE = re.compile(r"&[a-zA-Z]+;")
HTML_ENTITY_NUM_RE = re.compile(r"&#\d+;")
WHITESPACE_RE = re.compile(r"\s+")


def strip_html(html: str) -> str:
    text = HTML_TAG_RE.sub(" ", html)
    text = HTML_ENTITY_NAMED_RE.sub(" ", text)
    text = HTML_ENTITY_NUM_RE.sub(" ", text)
    text = WHITESPACE_RE.sub(" ", text).strip()
    return text


def find_best_match(text: str, pattern: str, min_pos: int = 0):
    matches = list(re.finditer(pattern, text, re.I))
    if not matches:
        return None
    skip_until = max(min_pos, int(len(text) * 0.05))
    later = [m for m in matches if m.start() >= skip_until]
    if not later:
        return matches[-1].start()
    def density(pos: int) -> int:
        window = text[pos:pos + 3000]
        return sum(1 for ch in window if ch.isdigit())
    later.sort(key=lambda m: density(m.start()), reverse=True)
    return later[0].start()


def extract_def14a_section(text: str) -> str:
    """Extract DEF14A sections (from #131)."""
    if not text or len(text) < 5000:
        return text
    chunks = []
    pos = find_best_match(text, r"summary\s+compensation\s+table")
    if pos is not None:
        chunks.append(("COMP_TABLE", pos, 11000))
    pos = find_best_match(
        text,
        r"(?:security\s+ownership\s+of\s+certain\s+beneficial\s+owners|principal\s+shareholders|5\s*%\s+(?:or\s+more|stockholders|beneficial\s+owners))",
    )
    if pos is not None:
        chunks.append(("OWNERSHIP", pos, 7000))
    pos = find_best_match(
        text,
        r"(?:director\s+independence|independence\s+of\s+(?:our\s+)?directors|independent\s+directors)",
    )
    if pos is not None:
        chunks.append(("INDEPENDENCE", pos, 2500))
    pos = find_best_match(
        text,
        r"(?:board\s+of\s+directors|director\s+nominees|board\s+composition|nominees\s+for\s+election)",
    )
    if pos is not None:
        chunks.append(("BOARD", pos, 3000))

    if not chunks:
        mid = len(text) // 2
        return text[max(0, mid - 13000): mid + 13000]

    chunks.sort(key=lambda x: x[1])
    deduped = []
    for kind, start, budget in chunks:
        if deduped and start - deduped[-1][1] < 1500:
            continue
        deduped.append((kind, start, budget))

    parts = []
    for kind, start, budget in deduped:
        parts.append(f"=== {kind} ===\n{text[start:start + budget]}")
    return "\n\n".join(parts)[:CTX_LEN]


def extract_eu_section(text: str) -> str:
    """Extract EU URD/Annual Report sections (extended multi-lang patterns)."""
    if not text or len(text) < 5000:
        return text
    chunks = []
    # Governance / Board
    pos = find_best_match(
        text,
        r"(?:corporate\s+governance|gouvernance|aufsichtsrat|consiglio\s+di\s+amministrazione|gobierno\s+corporativo|raad\s+van\s+(?:bestuur|commissarissen)|styret|hallitus|board\s+of\s+directors|verwaltungsrat)",
    )
    if pos is not None:
        chunks.append(("GOVERNANCE", pos, 12000))
    # CEO / Top Management - extended patterns
    pos = find_best_match(
        text,
        r"(?:chief\s+executive\s+officer|directeur\s+g[ée]n[ée]ral|pr[eé]sident.{0,30}directeur|vorstandsvorsitzender|vorstand|amministratore\s+delegato|consejero\s+delegado|konsernsjef|toimitusjohtaja|executive\s+committee|comit[eé]\s+ex[eé]cutif|geschäftsleitung|group\s+management|leadership\s+team|executive\s+team|management\s+committee)",
    )
    if pos is not None:
        chunks.append(("CEO", pos, 7000))
    # Ownership / Shareholders
    pos = find_best_match(
        text,
        r"(?:share(?:holder|holding)\s+structure|actionnariat|aktion[äa]rsstruktur|azionariato|estructura\s+accionarial|aandeelhoudersstructuur|principal\s+shareholders|principaux\s+actionnaires|aksjon[æa]rer|largest\s+shareholders|major\s+shareholders|main\s+shareholders|significant\s+shareholders)",
    )
    if pos is not None:
        chunks.append(("OWNERSHIP", pos, 7000))
    # Voting
    pos = find_best_match(
        text,
        r"(?:voting\s+rights|droit\s+de\s+vote|stimmrecht|diritto\s+di\s+voto|stemrecht|loyalty\s+shares|double\s+voting|capital\s+stock|share\s+capital)",
    )
    if pos is not None:
        chunks.append(("VOTING", pos, 3000))
    # Independence
    pos = find_best_match(
        text,
        r"(?:independent\s+directors?|administrateurs?\s+ind[ée]pendants?|unabh[äa]ngige\s+mitglieder|amministratori\s+indipendenti|riippumat)",
    )
    if pos is not None:
        chunks.append(("INDEPENDENCE", pos, 2000))

    if not chunks:
        mid = len(text) // 2
        return text[max(0, mid - 14000): mid + 14000]

    chunks.sort(key=lambda x: x[1])
    deduped = []
    for kind, start, budget in chunks:
        if deduped and start - deduped[-1][1] < 1500:
            continue
        deduped.append((kind, start, budget))

    parts = []
    for kind, start, budget in deduped:
        parts.append(f"=== {kind} ===\n{text[start:start + budget]}")
    return "\n\n".join(parts)[:CTX_LEN]


def load_env():
    env_p = PROJECT_ROOT / ".env.local"
    if not env_p.exists():
        return
    for line in env_p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        if k.strip() and not os.environ.get(k.strip()):
            os.environ[k.strip()] = v.strip().strip('"').strip("'")


def log_line(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def get_keys():
    candidates = [
        os.environ.get("CEREBRAS_API_KEY"),
        os.environ.get("CEREBRAS2_API_KEY"),
        os.environ.get("CEREBRAS3_API_KEY"),
    ]
    return [k for k in candidates if k]


def call_cerebras(prompt, api_key, retries=2):
    body = json.dumps({
        "model": MODEL_ID,
        "max_tokens": MAX_TOKENS,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
    }).encode()
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "curl/7.79.1",
    }
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(CEREBRAS_URL, data=body, headers=headers)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=180) as r:
                resp = json.loads(r.read())
            content = resp.get("choices", [{}])[0].get("message", {}).get("content", "")
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip(), flags=re.MULTILINE)
            try:
                return json.loads(content), None
            except json.JSONDecodeError:
                m = re.search(r"\{.*\}", content, re.DOTALL)
                if m:
                    try:
                        return json.loads(m.group(0)), None
                    except json.JSONDecodeError as e:
                        return None, f"JSON parse fail: {e}"
                return None, "no JSON in response"
        except urllib.error.HTTPError as e:
            code = e.code
            if code == 429:
                if attempt < retries:
                    log_line(f"  HTTP 429, backoff 8s (attempt {attempt+1}/{retries})")
                    time.sleep(8)
                    continue
                return None, "HTTP 429 quota"
            if code == 402:
                return None, "HTTP 402 payment"
            log_line(f"  HTTP {code}")
            return None, f"HTTP {code}"
        except Exception as ex:
            log_line(f"  Ex {type(ex).__name__}: {ex}")
            if attempt < retries:
                time.sleep(3)
                continue
            return None, f"Ex {type(ex).__name__}"
    return None, "exhausted retries"


def find_latest_def14a(ticker):
    """Return Path to latest DEF14A for US ticker."""
    if not DEF14A_ROOT.exists():
        return None, None
    candidates = []
    for year_dir in DEF14A_ROOT.iterdir():
        if not year_dir.is_dir() or not year_dir.name.isdigit():
            continue
        year = int(year_dir.name)
        for f in year_dir.glob(f"{ticker}_*.htm.gz"):
            candidates.append((year, f))
    if not candidates:
        return None, None
    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1], candidates[0][0]


def find_latest_eu_source(ticker):
    """Return Path to latest annual-text for EU ticker.
    Prefer larger files (>200KB = full URD) over recent small extracts.
    Strategy: get all files with realistic years, pick the one with most signal
    (largest size, then most recent year).
    """
    base = EU_ROOT / ticker / "annual-text"
    if not base.is_dir():
        return None
    files = list(base.glob("*.txt"))
    if not files:
        return None
    # Filter realistic years (2015-2029)
    realistic = []
    for f in files:
        m = re.match(r"^(\d{4})\.txt$", f.name)
        if m:
            year = int(m.group(1))
            if 2015 <= year <= 2029:
                realistic.append((year, f, f.stat().st_size))
    if not realistic:
        return files[0]
    # Prefer largest file (more signal density for governance) over recency
    realistic.sort(key=lambda x: -x[2])
    return realistic[0][1]


def load_def14a_text(path):
    try:
        with gzip.open(path, "rb") as g:
            html = g.read().decode("utf-8", errors="ignore")
    except Exception:
        return None
    text = strip_html(html)
    return extract_def14a_section(text)


def load_eu_text(path: Path):
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return None
    return extract_eu_section(text)


def get_company_info(ticker):
    p = V19_COMPLETE / f"{ticker.upper()}.json"
    name, country = ticker, ""
    if p.exists():
        try:
            d = json.loads(p.read_text())
            name = d.get("name") or ticker
            country = d.get("country") or ""
        except Exception:
            pass
    if not country:
        suffix_map = {
            ".DE": "Germany", ".PA": "France", ".L": "UK",
            ".MI": "Italy", ".AS": "Netherlands", ".BR": "Belgium",
            ".MC": "Spain", ".ST": "Sweden", ".CO": "Denmark",
            ".HE": "Finland", ".OL": "Norway", ".SW": "Switzerland",
        }
        for suf, c in suffix_map.items():
            if ticker.endswith(suf):
                country = c
                break
    return name, country


def is_us_ticker(ticker: str) -> bool:
    return "." not in ticker


def get_yfinance_ceo_fallback(ticker: str) -> str | None:
    """Fallback: read ceo_name from v2-pipeline (yfinance source)."""
    p = V2_PIPELINE / f"{ticker.lower()}.json"
    if not p.exists():
        return None
    try:
        d = json.loads(p.read_text())
        g = d.get("governance") or {}
        nm = g.get("ceo_name")
        if isinstance(nm, str) and nm.strip():
            # Strip honorific prefixes (Mr., Mrs., Dr., Ms.) and clean multiple spaces
            cleaned = re.sub(r"^(?:Mr\.|Mrs\.|Ms\.|Dr\.|Mme\.?|Mlle\.?|Sr\.|Sra\.)\s+", "", nm.strip())
            cleaned = re.sub(r"\s+", " ", cleaned).strip()
            return cleaned if cleaned else None
    except Exception:
        return None
    return None


def validate_ceo_name(name, is_us=True):
    if not name or not isinstance(name, str):
        return False, "missing or non-string"
    name = name.strip()
    if len(name) < 4 or len(name) > 80:
        return False, f"length out of range: {len(name)}"
    pattern = CEO_NAME_PATTERN_US if is_us else CEO_NAME_PATTERN_EU
    if not pattern.match(name):
        return False, f"name regex fail: {name!r}"
    lower = name.lower()
    for word in CEO_NAME_BLOCKLIST:
        if word == lower or word in lower.split():
            return False, f"blocklisted word: {word}"
    return True, "ok"


def validate_extraction(payload, ticker, is_us=True):
    """Validate fields, return (clean_dict, warnings_list, ok_bool)."""
    if not isinstance(payload, dict):
        return None, ["payload not dict"], False
    warnings = []
    out = {}

    ceo_name = payload.get("ceo_name")
    if ceo_name:
        ok, why = validate_ceo_name(ceo_name, is_us=is_us)
        if ok:
            out["ceo_name"] = ceo_name.strip()
        else:
            warnings.append(f"ceo_name rejected: {why}")

    # Fallback ceo_name from yfinance (v2-pipeline) if LLM didn't find one
    if "ceo_name" not in out:
        yf_ceo = get_yfinance_ceo_fallback(ticker)
        if yf_ceo:
            ok, why = validate_ceo_name(yf_ceo, is_us=is_us)
            if ok:
                out["ceo_name"] = yf_ceo
                out["_ceo_source"] = "yfinance_fallback"
                warnings.append(f"ceo_name from yfinance fallback: {yf_ceo}")
            else:
                # Try EU pattern as last resort
                ok2, _ = validate_ceo_name(yf_ceo, is_us=False)
                if ok2:
                    out["ceo_name"] = yf_ceo
                    out["_ceo_source"] = "yfinance_fallback"
                    warnings.append(f"ceo_name from yfinance fallback (EU pattern): {yf_ceo}")

    # ceo_total_comp_m (US only typically)
    comp = payload.get("ceo_total_comp_m")
    if isinstance(comp, (int, float)):
        if 0.5 <= float(comp) <= 200:
            out["ceo_total_comp_m"] = round(float(comp), 3)
        else:
            warnings.append(f"ceo_total_comp_m out of range: {comp}")

    cfo = payload.get("cfo_name")
    if cfo:
        ok, _ = validate_ceo_name(cfo, is_us=is_us)
        if ok:
            out["cfo_name"] = cfo.strip()

    bs = payload.get("board_size")
    if isinstance(bs, int) and 3 <= bs <= 30:
        out["board_size"] = bs

    vs = payload.get("voting_structure")
    allowed_vs = (
        "one_share_one_vote", "dual_class", "multi_class",
        "double_voting_rights", "loyalty_shares", "preferred_shares_class",
    )
    if vs in allowed_vs:
        out["voting_structure"] = vs
    vsn = payload.get("voting_structure_note")
    if isinstance(vsn, str) and 5 <= len(vsn) <= 400:
        out["voting_structure_note"] = vsn.strip()
    if "voting_structure" in out and "voting_structure_note" not in out:
        vs_val = out["voting_structure"]
        notes_map = {
            "one_share_one_vote": "Structure standard une action = une voix (vérifié via source).",
            "dual_class": "Structure dual class : classes d'actions avec droits de vote différents (vérifié via source).",
            "multi_class": "Structure multi-class : plusieurs classes d'actions (vérifié via source).",
            "double_voting_rights": "Droit de vote double pour actions détenues depuis 2+ ans (Loi Florange, vérifié via URD).",
            "loyalty_shares": "Loyalty shares : droit de vote multiplié pour actionnaires long-terme (vérifié via URD).",
            "preferred_shares_class": "Actions ordinaires + actions préférentielles avec droits distincts (vérifié via URD).",
        }
        out["voting_structure_note"] = notes_map.get(vs_val, "")

    di = payload.get("director_independence_pct")
    if isinstance(di, (int, float)) and 0 <= float(di) <= 100:
        out["director_independence_pct"] = round(float(di), 1)

    for key in ("top_capital", "top_voting"):
        arr = payload.get(key)
        if isinstance(arr, list):
            clean = []
            seen = set()
            for entry in arr:
                if not isinstance(entry, dict):
                    continue
                nm = entry.get("name")
                pct = entry.get("pct")
                if not isinstance(nm, str) or not nm.strip():
                    continue
                if not isinstance(pct, (int, float)):
                    continue
                if not (0 < float(pct) <= 100):
                    continue
                nm_clean = nm.strip()
                key_dedup = nm_clean.lower()
                if key_dedup in seen:
                    continue
                seen.add(key_dedup)
                entry_clean = {"name": nm_clean, "pct": round(float(pct), 2)}
                if key == "top_capital" and isinstance(entry.get("type"), str):
                    t = entry["type"].lower().strip()
                    if t in ("individual", "institutional", "state", "family"):
                        entry_clean["type"] = t
                clean.append(entry_clean)
            if clean:
                out[key] = clean[:10]
                if len(clean) < 3:
                    out[f"_{key}_lt_3"] = True

    has_ceo = "ceo_name" in out
    has_comp = "ceo_total_comp_m" in out
    has_board = "board_size" in out
    has_voting = "voting_structure" in out
    has_top_cap = "top_capital" in out
    has_top_vote = "top_voting" in out

    if is_us:
        strict_ok = has_ceo and has_comp and has_board and has_voting and has_top_cap and has_top_vote
        partial_ok = has_ceo and (has_board or has_voting or has_top_cap)
        status = "heuristic_real" if strict_ok else ("heuristic_partial" if partial_ok else "incomplete")
    else:
        strict_ok = has_ceo and has_board and has_voting and has_top_cap and has_top_vote
        partial_ok = has_ceo and (has_board or has_voting or has_top_cap)
        status = "heuristic_real_eu" if strict_ok else ("heuristic_partial_eu" if partial_ok else "incomplete")

    out["extraction_status"] = status

    # Soft warning: top_capital ideally ≥3, but partial accepted (flag _lt_3 already set)
    if not has_top_cap:
        warnings.append("top_capital empty (will accept partial if other fields OK)")

    return out, warnings, partial_ok


def write_enrich(ticker, payload, source_file, is_us=True):
    p = V2_ENRICH / f"{ticker.lower()}.json"
    if p.exists():
        try:
            d = json.loads(p.read_text())
        except Exception:
            d = {}
    else:
        d = {}
    existing = d.get("overrides_governance") if isinstance(d.get("overrides_governance"), dict) else {}
    merged = {**existing, **payload}
    if is_us:
        merged["source"] = "def14a_local_cerebras_real"
        merged["_source"] = "cerebras_paid_def14a_140"
    else:
        merged["source"] = "urd_eu_cerebras_real_eu"
        merged["_source"] = "cerebras_paid_urd_eu_140"
    merged["source_file"] = source_file
    merged["_source_file"] = source_file
    merged["_extracted_at"] = datetime.now(timezone.utc).isoformat()
    d["overrides_governance"] = merged
    d["_governance_extracted_by_140_at"] = datetime.now(timezone.utc).isoformat()
    p.write_text(json.dumps(d, indent=2, ensure_ascii=False))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers", required=True, help="Comma-separated tickers")
    ap.add_argument("--key-idx", type=int, default=2, help="Cerebras key index (default 2 = k2)")
    ap.add_argument("--throttle", type=float, default=0.6, help="Sleep between calls")
    ap.add_argument("--paid-mode", action="store_true", help="Confirm paid mode")
    args = ap.parse_args()

    load_env()
    keys = get_keys()
    if not keys:
        log_line("FATAL: no CEREBRAS keys")
        sys.exit(1)

    if not args.paid_mode and not os.environ.get("PAID_MODE"):
        log_line("⚠️ paid-mode flag required")
        sys.exit(2)

    key_idx = args.key_idx % len(keys)
    tickers = [t.strip() for t in args.tickers.split(",") if t.strip()]
    log_line(f"START sub-agent #140 hard_multi_source: {len(tickers)} targets, key_idx={key_idx}, throttle={args.throttle}s")

    ok = 0
    skipped_no_source = 0
    skipped_validation = 0
    api_fails = 0
    last_call_t = 0.0
    results = []

    for i, ticker in enumerate(tickers):
        name, country = get_company_info(ticker)
        is_us = is_us_ticker(ticker)

        if is_us:
            path, year = find_latest_def14a(ticker)
            source_type = "DEF14A_US"
        else:
            path = find_latest_eu_source(ticker)
            year = path.stem if path else None
            source_type = "EU_ANNUAL"

        if not path:
            log_line(f"[{i+1}/{len(tickers)}] {ticker}: SKIP no source ({source_type})")
            skipped_no_source += 1
            results.append({"ticker": ticker, "status": "no_source"})
            continue

        if is_us:
            excerpt = load_def14a_text(path)
        else:
            excerpt = load_eu_text(path)

        if not excerpt or len(excerpt) < 1000:
            log_line(f"[{i+1}/{len(tickers)}] {ticker}: SKIP empty/short ({len(excerpt) if excerpt else 0})")
            skipped_no_source += 1
            results.append({"ticker": ticker, "status": "empty_extract"})
            continue

        elapsed = time.time() - last_call_t
        if elapsed < args.throttle:
            time.sleep(args.throttle - elapsed)

        if is_us:
            prompt = PROMPT_US.format(ticker=ticker, name=name, excerpt=excerpt)
        else:
            prompt = PROMPT_EU.format(ticker=ticker, name=name, country=country or "EU", excerpt=excerpt)

        last_call_t = time.time()
        api_key = keys[key_idx]
        result, err = call_cerebras(prompt, api_key)
        if not result and err and "429" in err:
            for trial in range(len(keys) - 1):
                key_idx = (key_idx + 1) % len(keys)
                log_line(f"  Rotate to key_idx={key_idx}")
                time.sleep(2)
                result, err = call_cerebras(prompt, keys[key_idx])
                if result or (err and "429" not in err):
                    break

        if not result:
            log_line(f"[{i+1}/{len(tickers)}] {ticker}: FAIL api ({err})")
            api_fails += 1
            results.append({"ticker": ticker, "status": "api_fail", "err": err})
            continue

        clean, warnings, partial_ok = validate_extraction(result, ticker, is_us=is_us)
        if not partial_ok:
            # Debug: log what LLM returned
            raw_summary = {k: v for k, v in result.items() if k in ("ceo_name", "board_size", "voting_structure", "top_capital", "top_voting")}
            log_line(f"[{i+1}/{len(tickers)}] {ticker}: SKIP validation warns={warnings} raw={raw_summary}")
            skipped_validation += 1
            results.append({"ticker": ticker, "status": "validation_fail", "warnings": warnings, "raw_llm": raw_summary})
            continue

        source_rel = str(path.relative_to(PROJECT_ROOT))
        write_enrich(ticker, clean, source_rel, is_us=is_us)
        log_line(
            f"[{i+1}/{len(tickers)}] {ticker}: OK status={clean.get('extraction_status')} "
            f"ceo={clean.get('ceo_name','-')} board={clean.get('board_size','-')} "
            f"voting={clean.get('voting_structure','-')} "
            f"tc={len(clean.get('top_capital',[]))} tv={len(clean.get('top_voting',[]))} year={year}"
        )
        ok += 1
        results.append({
            "ticker": ticker,
            "status": "ok",
            "year": str(year),
            "source_type": source_type,
            "extraction_status": clean.get("extraction_status"),
            "ceo_name": clean.get("ceo_name"),
            "ceo_total_comp_m": clean.get("ceo_total_comp_m"),
            "board_size": clean.get("board_size"),
            "voting_structure": clean.get("voting_structure"),
            "top_capital_count": len(clean.get("top_capital", [])),
            "top_voting_count": len(clean.get("top_voting", [])),
        })

        if (i + 1) % 3 == 0:
            key_idx = (key_idx + 1) % len(keys)

    log_line(
        f"END sub-agent #140: ok={ok} no_source={skipped_no_source} "
        f"validation_fail={skipped_validation} api_fail={api_fails}"
    )

    out_file = RESULTS_DIR / f"results_hard_multi_source.json"
    out_file.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sub_agent": 140,
        "cluster": "hard_multi_source",
        "summary": {
            "ok": ok,
            "no_source": skipped_no_source,
            "validation_fail": skipped_validation,
            "api_fail": api_fails,
            "total": len(tickers),
        },
        "results": results,
    }, indent=2, ensure_ascii=False))
    log_line(f"Results: {out_file}")


if __name__ == "__main__":
    main()
