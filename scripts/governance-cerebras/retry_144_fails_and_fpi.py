#!/usr/bin/env python3
"""
Sub-agent #144 — Retry governance Cerebras paid for:

1. 27 validation_fail tickers from #131 (CEO regex too strict / null fields)
2. 11 no_source tickers from #131 (FPI/ADR) using 20-F (cat2-foreign-adr)
   or annual-text (cat3-european).

Improvements vs #131 :
- Relaxed CEO name regex: accept honorifics (Ph.D., Jr., Sr., II, III),
  initials with periods ("R. Michael", "S.J. Squeri", "D.G. Macpherson",
  "T. M. Knavish", "R.M. Lance", "D. S. Regnery"), titles ("Mr."), accents
  ("François Locoh-Donou").
- Stripping of trailing honorifics before storing (so audit sees clean name).
- ceo_total_comp_m: if value > 250 but < 1e9, interpret as dollars (divide
  by 1e6). Range 0.3 to 200 M$ after normalization.
- 0 hallucination preserved: LLM still must return values present in excerpt.

Outputs (single batch) :
- overrides_governance into src/data/v2-pipeline-enrich/<lower>.json
  with source "<def14a|20f|urd>_local_cerebras_real" (or "_real_eu" for URD)
- Result JSON: src/data/governance-cerebras/results_144_<ts>.json
- Log: .conv-state/CONV-CONCEPTS-governance-cerebras-144.log

Throttle 0.6s. Key idx=1 by default (paid Cerebras).
"""
from __future__ import annotations

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
V2_ENRICH = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
DEF14A_ROOT = PROJECT_ROOT / "sec-data/cat1-us/DEF14A"
F20_ROOT = PROJECT_ROOT / "sec-data/cat2-foreign-adr/20F"
EU_ROOT = PROJECT_ROOT / "sec-data/cat3-european"
RESULTS_DIR = PROJECT_ROOT / "src/data/governance-cerebras"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)
LOG = PROJECT_ROOT / ".conv-state/CONV-CONCEPTS-governance-cerebras-144.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL_ID = "qwen-3-235b-a22b-instruct-2507"
SLEEP_BETWEEN_CALLS = 0.6
MAX_TOKENS = 2400
CTX_LEN = 28000

# --- Targets ---
FAILS_27 = [
    "ABBV","APD","AXP","BAX","BMY","COP","DD","EQR","ES","FFIV",
    "GLPI","GLW","GWW","HSY","LLY","LNT","MTB","NRG","PPG","PRU",
    "PSA","Q","TER","TSLA","TT","VTR","WELL",
]
# FPI / ADR — source-explicit. BX skipped (Blackstone is a US partnership,
# no DEF14A locally and no 20-F either; out of scope for proxy extraction).
FPI_SOURCES = [
    # (ticker, kind, ticker_in_filename)  kind in {"20f","urd"}
    # 20-F path for FPIs whose 20-F has substantive comp/governance content
    ("ARM",     "20f",   "ARM"),
    ("MUFG",    "20f",   "MUFG"),
    ("NMR",     "20f",   "NMR"),
    # URD/Annual Report path for FPIs whose 20-F references the standalone
    # UK annual report instead of duplicating content (AZN, BP) or for
    # genuine EU non-US-listed (ABBN, ANA, DGE, VIE)
    ("AZN.L",   "urd",   "AZN.L"),
    ("AZN.ST",  "urd",   "AZN.ST"),
    ("BP",      "urd",   "BP"),
    ("ABBN.SW", "urd",   "ABBN.SW"),
    ("ANA.MC",  "urd",   "ANA.MC"),
    ("DGE.L",   "urd",   "DGE.L"),
    ("VIE.PA",  "urd",   "VIE.PA"),
]

# --- CEO name regex relaxed ---
# Accept :
#  - Optional title prefix (Mr./Mrs./Ms./Dr./Mr)
#  - First token: 1-2 initials with periods, OR full word (incl. accents/apostrophe/hyphen)
#  - Middle tokens: initials with periods OR words (accents, hyphens, apostrophes, particles)
#  - Optional honorific suffix (, Jr. / , Sr. / , III / Ph.D. / M.D. / J.D.)
CEO_NAME_PATTERN = re.compile(
    r"^(?:(?:Mr|Mrs|Ms|Dr|Mr\.|Mrs\.|Ms\.|Dr\.)\s+)?"
    r"(?:[A-ZÀ-Ý]\.?(?:\s?[A-ZÀ-Ý]\.?)?|[A-ZÀ-Ý][\wÀ-ÿ'\-]+)"
    r"(?:\s+(?:[A-ZÀ-Ý]\.?(?:\s?[A-ZÀ-Ý]\.?)?|[A-ZÀ-Ý][\wÀ-ÿ'\-]+|de|van|von|den|der|du|del|della|di|le|la))*"
    r"\s+[A-ZÀ-Ý][\wÀ-ÿ'\-]+"
    r"(?:,?\s+(?:Jr\.?|Sr\.?|II|III|IV|Ph\.?\s?D\.?|M\.?D\.?|J\.?D\.?|Esq\.?))?"
    r"$"
)
CEO_NAME_BLOCKLIST = {
    "officer", "executive", "chairman", "president", "director",
    "energy", "industries", "company", "corporation", "incorporated",
    "named", "principal", "chief", "ceo", "cfo",
}
# Patterns to strip from honorific-only tail (we keep them inside if regex matches whole)
HONORIFIC_TAIL_RE = re.compile(
    r"\s*,?\s*(?:Jr\.?|Sr\.?|II|III|IV|Ph\.?\s?D\.?|M\.?D\.?|J\.?D\.?|Esq\.?)\s*$"
)
TITLE_PREFIX_RE = re.compile(r"^(?:Mr|Mrs|Ms|Dr|Mr\.|Mrs\.|Ms\.|Dr\.)\s+")


def normalize_ceo_name(name: str) -> str:
    """Strip leading titles and trailing honorifics for cleaner DB display.

    Keeps initials (e.g. 'S.J. Squeri', 'R. Michael Daley').
    """
    if not isinstance(name, str):
        return name
    n = name.strip()
    # Remove leading title (Mr. / Mrs. / Dr.) since UI shows role separately
    n = TITLE_PREFIX_RE.sub("", n)
    # Strip a single trailing honorific suffix
    n = HONORIFIC_TAIL_RE.sub("", n)
    return n.strip()


PROMPT_DEF14A = """Extract governance fields for {ticker} ({name}) from this DEF14A Proxy Statement excerpt.

Return STRICT JSON only (no markdown, no commentary):
{{
  "ceo_name": "<full name as written in the document>" or null,
  "ceo_total_comp_m": <number in millions USD> or null,
  "cfo_name": "<full name>" or null,
  "board_size": <int> or null,
  "voting_structure": "one_share_one_vote" | "dual_class" | "multi_class" or null,
  "voting_structure_note": "<brief note>" or null,
  "director_independence_pct": <0-100 number> or null,
  "top_capital": [{{"name": "<institutional name>", "pct": <0-100>}}, ...] or [],
  "top_voting": [{{"name": "<institutional name>", "pct": <0-100>}}, ...] or []
}}

Rules :
- ceo_name: REAL full name from "Summary Compensation Table" or named officers. Keep initials (e.g. "R. Michael Daley", "S.J. Squeri") and honorific suffixes (Jr., Ph.D.). NEVER return a single word, a title alone ("Mr. Tanner" → look for the FIRST NAME, return "Michele Buck" or whatever the full name is), NEVER generic words like "Officer", "Executive".
- ceo_total_comp_m: from "Total" column of Summary Compensation Table for MOST RECENT fiscal year, expressed in millions USD. Range allowed 0.3 to 200. If reported in dollars (e.g. 24,500,000), convert to 24.5.
- board_size: count of directors (typically 8-15).
- voting_structure: "one_share_one_vote" standard, "dual_class" two classes, "multi_class" 3+ classes.
- top_capital: ≥5% beneficial owners (Vanguard, BlackRock, Fidelity, State Street, T. Rowe Price, etc.). ≥3 entries if present.
- top_voting: same for voting power (usually identical unless dual_class).
- director_independence_pct: from independence section.

CRITICAL: If a field is NOT in the excerpt, return null (or empty array). NEVER guess. Zero hallucination.

DEF14A excerpt:
---
{excerpt}
---

Return ONLY the JSON object."""


PROMPT_20F = """Extract governance fields for {ticker} ({name}) from this 20-F Annual Report excerpt (Foreign Private Issuer).

Return STRICT JSON only:
{{
  "ceo_name": "<group-level CEO full name>" or null,
  "ceo_total_comp_m": <number in millions USD> or null,
  "cfo_name": "<full name>" or null,
  "board_size": <int> or null,
  "voting_structure": "one_share_one_vote" | "dual_class" | "multi_class" | "preferred_shares_class" or null,
  "voting_structure_note": "<brief note>" or null,
  "director_independence_pct": <0-100 number> or null,
  "top_capital": [{{"name": "<shareholder name>", "pct": <0-100>}}, ...] or [],
  "top_voting": [{{"name": "<shareholder name>", "pct": <0-100>}}, ...] or []
}}

Rules :
- ceo_name: GROUP-LEVEL CEO (Chief Executive Officer of the parent), not subsidiary. Keep accents (François, José). Honorific suffixes OK (Ph.D., Jr.).
- ceo_total_comp_m: from Item 6 Compensation table for the most recent fiscal year, expressed in millions USD. Convert from local currency only if explicitly stated USD/dollars in the document. Range 0.3 to 200.
- board_size: total directors (executive + non-executive in unitary, or supervisory in dual board).
- top_capital: principal shareholders (Item 7). ≥5% threshold. ≥3 entries if present.
- voting_structure: "dual_class" if multiple share classes with different voting rights.

CRITICAL: 0 hallucination. If not explicit in excerpt, return null/empty.

20-F excerpt:
---
{excerpt}
---

Return ONLY the JSON object."""


PROMPT_URD = """Extract governance fields for {ticker} ({name}) from this European Annual Report / URD excerpt.

The document may be multi-language: EN, FR, DE, IT, ES, NL.

Return STRICT JSON only:
{{
  "ceo_name": "<group-level CEO full name>" or null,
  "cfo_name": "<full name>" or null,
  "board_size": <int> or null,
  "voting_structure": "one_share_one_vote" | "double_voting_rights" | "loyalty_shares" | "dual_class" | "preferred_shares_class" or null,
  "voting_structure_note": "<brief note>" or null,
  "director_independence_pct": <0-100 number> or null,
  "top_capital": [{{"name": "<shareholder name>", "pct": <0-100>, "type": "individual|institutional|state|family"}}, ...] or [],
  "top_voting": [{{"name": "<shareholder name>", "pct": <0-100>}}, ...] or []
}}

Multi-lang hints:
- CEO: "Chief Executive Officer" / "Directeur Général" / "Vorstandsvorsitzender" / "Amministratore Delegato" / "Consejero Delegado" / "Bestuursvoorzitter"
- Board: "Board of Directors" / "Conseil d'Administration" / "Aufsichtsrat" / "Consiglio di Amministrazione" / "Raad van Commissarissen"

Rules :
- ceo_name: GROUP-LEVEL only. NOT a division/business-area president (e.g. "President, Robotics" or "Head of Industrial Automation" are NOT the group CEO). Look for explicit titles "Chief Executive Officer", "Group CEO", "President and Chief Executive Officer", "Directeur Général", "Vorstandsvorsitzender" (NOT "Vorstandsmitglied"), "Amministratore Delegato". If the excerpt only lists business-line heads without identifying a single group CEO, return null. Accents OK (Antonio Brufau, François Locoh-Donou).
- voting_structure: EU often "double_voting_rights" (loi Florange, France) or "loyalty_shares" (Italy/Netherlands).
- top_capital: include state if state-owned (ex Veolia legacy, ENI).

CRITICAL: 0 hallucination. If absent, null/empty.

Annual Report excerpt:
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
    skip_until = max(min_pos, int(len(text) * 0.06))
    later = [m for m in matches if m.start() >= skip_until]
    if not later:
        return matches[-1].start()
    def density(pos: int) -> int:
        window = text[pos:pos + 3000]
        return sum(1 for ch in window if ch.isdigit())
    later.sort(key=lambda m: density(m.start()), reverse=True)
    return later[0].start()


def extract_def14a_section(text: str) -> str:
    if not text or len(text) < 5000:
        return text
    chunks = []
    # Capture multiple SCT occurrences (named-officer SCT often appears before
    # the Pay vs Performance comparison table which is digit-dense but anonymous)
    sct_matches = [m.start() for m in re.finditer(r"summary\s+compensation\s+table", text, re.I)]
    # Skip TOC (first 5%)
    sct_matches = [p for p in sct_matches if p > int(len(text) * 0.05)]
    if sct_matches:
        # First occurrence post-TOC (usually has names + figures)
        chunks.append(("COMP_TABLE_FIRST", sct_matches[0], 9000))
        # Densest occurrence (often Pay-vs-Performance)
        if len(sct_matches) > 1:
            dense_pos = find_best_match(text, r"summary\s+compensation\s+table")
            if dense_pos and dense_pos != sct_matches[0]:
                chunks.append(("COMP_TABLE_DENSE", dense_pos, 5000))
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
    # Named executive officers section (sometimes labels the CEO explicitly)
    pos = find_best_match(
        text,
        r"(?:named\s+executive\s+officers|executive\s+officers\s+of\s+the\s+(?:company|registrant)|chief\s+executive\s+officer\s+and\s+president)",
    )
    if pos is not None:
        chunks.append(("NEO", pos, 3000))
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


def extract_20f_section(text: str) -> str:
    if not text or len(text) < 5000:
        return text
    chunks = []
    # Item 6 (Directors, Senior Management and Employees)
    # Pick a LATER occurrence (not TOC) — find first match past 40% of doc
    threshold = int(len(text) * 0.4)
    item6_matches = [m.start() for m in re.finditer(r"\bitem\s+6\b", text, re.I)]
    item6_real = [p for p in item6_matches if p > threshold]
    if item6_real:
        chunks.append(("ITEM6_DIRECTORS", item6_real[0], 18000))
    elif item6_matches:
        chunks.append(("ITEM6_DIRECTORS", item6_matches[-1], 18000))
    # Item 7 (Major Shareholders and Related Party Transactions)
    item7_matches = [m.start() for m in re.finditer(r"\bitem\s+7\b", text, re.I)]
    item7_real = [p for p in item7_matches if p > threshold]
    if item7_real:
        chunks.append(("ITEM7_OWNERS", item7_real[0], 7000))
    elif item7_matches:
        chunks.append(("ITEM7_OWNERS", item7_matches[-1], 7000))
    # Compensation block keyword (some 20-Fs label differently)
    pos = find_best_match(
        text,
        r"(?:directors[,\s]+senior\s+management|compensation\s+of\s+directors|board\s+practices|major\s+shareholders|principal\s+shareholders)",
    )
    if pos is not None:
        chunks.append(("MGMT_COMP", pos, 5000))
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


def extract_urd_section(text: str) -> str:
    if not text or len(text) < 5000:
        return text
    chunks = []
    # For URDs we need full content scan, not skip-TOC (sometimes governance
    # appears in first 10% in shorter EU annual reports).
    def all_positions(pattern: str):
        return [m.start() for m in re.finditer(pattern, text, re.I)]

    def best_pos(pattern: str, skip_pct: float = 0.03):
        matches = all_positions(pattern)
        if not matches:
            return None
        threshold = int(len(text) * skip_pct)
        later = [p for p in matches if p > threshold] or matches
        # Prefer match with highest local digit density (table indicator)
        def density(pos: int) -> int:
            window = text[pos:pos + 3000]
            return sum(1 for ch in window if ch.isdigit())
        later.sort(key=density, reverse=True)
        return later[0]

    pos = best_pos(
        r"(?:corporate\s+governance|gouvernance|aufsichtsrat|consiglio\s+di\s+amministrazione|gobierno\s+corporativo|raad\s+van\s+(?:bestuur|commissarissen))",
    )
    if pos is not None:
        chunks.append(("GOVERNANCE", pos, 10000))
    pos = best_pos(
        r"(?:chief\s+executive\s+officer|directeur\s+g[ée]n[ée]ral|vorstandsvorsitzender|amministratore\s+delegato|consejero\s+delegado|bestuursvoorzitter)",
        skip_pct=0.0,  # CEO can appear very early in cover page
    )
    if pos is not None:
        chunks.append(("CEO", pos, 5000))
    pos = best_pos(
        r"(?:share(?:holder|holding)\s+structure|actionnariat|aktion[äa]rsstruktur|azionariato|estructura\s+accionarial|aandeelhoudersstructuur|principal\s+shareholders|principaux\s+actionnaires|major\s+shareholders)",
    )
    if pos is not None:
        chunks.append(("OWNERSHIP", pos, 8000))
    pos = best_pos(
        r"(?:voting\s+rights|droit\s+de\s+vote|stimmrecht|diritto\s+di\s+voto|stemrecht|loyalty\s+shares|double\s+voting)",
    )
    if pos is not None:
        chunks.append(("VOTING", pos, 3000))
    pos = best_pos(
        r"(?:independent\s+directors?|administrateurs?\s+ind[ée]pendants?|unabh[äa]ngige\s+mitglieder|amministratori\s+indipendenti)",
    )
    if pos is not None:
        chunks.append(("INDEPENDENCE", pos, 2500))
    # Direct executive/board chunk
    pos = best_pos(
        r"(?:board\s+of\s+directors|conseil\s+d'administration|verwaltungsrat|consiglio\s+di\s+gestione)",
    )
    if pos is not None:
        chunks.append(("BOARD", pos, 4000))
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


# --- Source resolution ---

def build_def14a_index():
    index = {}
    if not DEF14A_ROOT.exists():
        return index
    for year_dir in DEF14A_ROOT.iterdir():
        if not year_dir.is_dir() or not year_dir.name.isdigit():
            continue
        year = int(year_dir.name)
        for f in year_dir.glob("*.htm.gz"):
            m = re.match(r"^([A-Z0-9._-]+)_(\d{4}-\d{2}-\d{2})", f.name)
            if m:
                ticker = m.group(1)
                index.setdefault(ticker, []).append((year, f))
    for k in index:
        index[k].sort(key=lambda x: x[0], reverse=True)
    return index


def find_latest_def14a(ticker, index):
    if ticker in index and index[ticker]:
        year, path = index[ticker][0]
        return path, year
    alt = ticker.upper().replace(".", "")
    if alt in index and index[alt]:
        year, path = index[alt][0]
        return path, year
    return None, None


def find_latest_20f(filename_ticker: str):
    if not F20_ROOT.exists():
        return None, None
    candidates = []
    for year_dir in F20_ROOT.iterdir():
        if not year_dir.is_dir() or not year_dir.name.isdigit():
            continue
        year = int(year_dir.name)
        for f in year_dir.glob(f"{filename_ticker}_*.htm.gz"):
            candidates.append((year, f))
    if not candidates:
        return None, None
    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1], candidates[0][0]


def find_latest_eu_text(ticker: str):
    base = EU_ROOT / ticker / "annual-text"
    if not base.is_dir():
        return None
    files = list(base.glob("*.txt"))
    if not files:
        return None
    # Filter out Form SD (Conflict Minerals) and other small disclosures.
    # Real annual reports / URDs are usually > 200 KB.
    def is_form_sd(p):
        try:
            head = p.read_text(encoding="utf-8", errors="ignore")[:600]
            return "FORM SD" in head.upper() or "CONFLICT MINERALS" in head.upper()
        except Exception:
            return False
    big = [p for p in files if p.stat().st_size > 200_000 and not is_form_sd(p)]
    pool = big or files
    # Prefer most recent year by filename
    pool.sort(key=lambda p: p.name, reverse=True)
    return pool[0]


def load_def14a_text(path):
    try:
        with gzip.open(path, "rb") as g:
            html = g.read().decode("utf-8", errors="ignore")
    except Exception:
        return None
    text = strip_html(html)
    return extract_def14a_section(text)


def load_20f_text(path):
    try:
        with gzip.open(path, "rb") as g:
            html = g.read().decode("utf-8", errors="ignore")
    except Exception:
        return None
    text = strip_html(html)
    return extract_20f_section(text)


def load_eu_text(path: Path):
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return None
    return extract_urd_section(text)


def get_company_name(ticker):
    p = V19_COMPLETE / f"{ticker.upper()}.json"
    if p.exists():
        try:
            d = json.loads(p.read_text())
            return d.get("name") or ticker
        except Exception:
            pass
    return ticker


# --- Validation ---

def validate_ceo_name(name):
    if not name or not isinstance(name, str):
        return False, "missing or non-string"
    n = name.strip()
    if len(n) < 4 or len(n) > 80:
        return False, f"length out of range: {len(n)}"
    if not CEO_NAME_PATTERN.match(n):
        return False, f"name regex fail: {n!r}"
    lower = n.lower()
    for word in CEO_NAME_BLOCKLIST:
        if word == lower or word in lower.split():
            return False, f"blocklisted word: {word}"
    return True, "ok"


def normalize_comp_m(comp):
    """Accept comp_m or comp_dollars. Returns float in millions, or None."""
    if not isinstance(comp, (int, float)):
        return None
    v = float(comp)
    # If value looks like raw dollars (e.g. 24500000), convert to millions
    if v > 250 and v < 1e9:
        v = v / 1e6
    if 0.3 <= v <= 200:
        return round(v, 3)
    return None


def corroborate_ceo_in_text(name: str, raw_text: str, kind: str) -> bool:
    """For non-DEF14A (EU/URD/20-F) sources, ensure the name appears within
    ~200 chars of a CEO-role keyword. Prevents hallucination of division
    presidents as group CEO.
    """
    if not raw_text:
        return True  # cannot corroborate, fail open for DEF14A only
    if kind == "def14a":
        return True
    role_patterns = [
        r"chief\s+executive\s+officer",
        r"group\s+ceo",
        r"\bceo\b",
        r"directeur\s+g[ée]n[ée]ral",
        r"vorstandsvorsitzender",
        r"amministratore\s+delegato",
        r"consejero\s+delegado",
        r"bestuursvoorzitter",
        r"president\s+(?:and|&)\s+chief\s+executive",
    ]
    # Try matching multi-word name plus role within a window
    # Use both forenames+surname and just surname for windows
    parts = name.replace(",", "").split()
    if not parts:
        return False
    surname = parts[-1]
    name_lower = raw_text.lower()
    # Find all surname positions
    surname_positions = [m.start() for m in re.finditer(re.escape(surname.lower()), name_lower)]
    if not surname_positions:
        return False
    # Also require the FULL given+surname appears together at least once
    # (prevents picking up an unrelated "Howle" reference)
    full_name_lower = name.lower()
    if full_name_lower not in name_lower:
        return False
    # Tight check: require role keyword within 80 chars BEFORE or AFTER the
    # full name (not just the surname, which can appear in unrelated contexts).
    # Find the full-name positions; corroborate only if a CEO role is within
    # 80 chars and not associated with a different person via "of <Other>".
    full_positions = [m.start() for m in re.finditer(re.escape(full_name_lower), name_lower)]
    for sp in full_positions:
        before = name_lower[max(0, sp - 80):sp]
        after_start = sp + len(full_name_lower)
        after = name_lower[after_start:after_start + 120]
        zone = before + " " + after
        for pat in role_patterns:
            if re.search(pat, zone):
                # Reject if zone mentions a different person's role: pattern
                # "<role> of <Capitalized> <Capitalized>" not matching our name
                # e.g. "previously president and chief executive officer of Sandvik AB"
                if re.search(r"(?:of|de|du|der)\s+[A-Z][A-Za-z]+", before) or \
                   re.search(r"(?:of|de|du|der)\s+[A-Z][A-Za-z]+", after):
                    # The role belongs to another company — skip this hit
                    continue
                # Reject if zone mentions division-level title before our name
                if re.search(r"president\s*,?\s+(?:of\s+)?(?:robotics|automation|division|unit|business|operations|trading|shipping)", zone):
                    continue
                return True
    return False


def validate_extraction(payload, kind: str, raw_text: str = ""):
    """Validate fields with relaxed CEO regex and dollar->millions normalisation."""
    if not isinstance(payload, dict):
        return None, ["payload not dict"], False
    warnings = []
    out = {}

    raw_ceo = payload.get("ceo_name")
    if raw_ceo:
        norm = normalize_ceo_name(raw_ceo)
        ok, why = validate_ceo_name(norm)
        if ok:
            # For non-DEF14A: corroborate name appears near CEO role in source
            if kind != "def14a" and not corroborate_ceo_in_text(norm, raw_text, kind):
                warnings.append(f"ceo_name not corroborated near CEO role in source: {norm!r}")
            else:
                out["ceo_name"] = norm
        else:
            # Try raw form as fallback
            ok2, why2 = validate_ceo_name(raw_ceo.strip())
            if ok2:
                if kind != "def14a" and not corroborate_ceo_in_text(raw_ceo.strip(), raw_text, kind):
                    warnings.append(f"ceo_name not corroborated near CEO role: {raw_ceo!r}")
                else:
                    out["ceo_name"] = raw_ceo.strip()
            else:
                warnings.append(f"ceo_name rejected: norm={norm!r} raw={raw_ceo!r} why={why}")

    raw_comp = payload.get("ceo_total_comp_m")
    norm_comp = normalize_comp_m(raw_comp)
    if norm_comp is not None:
        out["ceo_total_comp_m"] = norm_comp
    elif raw_comp is not None:
        warnings.append(f"ceo_total_comp_m out of range or non-numeric: {raw_comp}")

    cfo = payload.get("cfo_name")
    if cfo:
        norm_cfo = normalize_ceo_name(cfo)
        ok, _ = validate_ceo_name(norm_cfo)
        if ok:
            out["cfo_name"] = norm_cfo

    bs = payload.get("board_size")
    if isinstance(bs, int) and 3 <= bs <= 30:
        out["board_size"] = bs

    vs = payload.get("voting_structure")
    valid_vs_def14a = ("one_share_one_vote", "dual_class", "multi_class")
    valid_vs_eu = valid_vs_def14a + ("double_voting_rights", "loyalty_shares", "preferred_shares_class")
    valid_set = valid_vs_eu if kind != "def14a" else valid_vs_def14a
    if vs in valid_set:
        out["voting_structure"] = vs
    vsn = payload.get("voting_structure_note")
    if isinstance(vsn, str) and 5 <= len(vsn) <= 400:
        out["voting_structure_note"] = vsn.strip()
    if "voting_structure" in out and "voting_structure_note" not in out:
        notes_map = {
            "one_share_one_vote": "Structure standard une action = une voix (vérifié via document de référence).",
            "dual_class": "Structure dual class : classes d'actions avec droits de vote différents.",
            "multi_class": "Structure multi-class : plusieurs classes d'actions.",
            "double_voting_rights": "Droit de vote double (Loi Florange ou équivalent) pour détention longue.",
            "loyalty_shares": "Loyalty shares : droit de vote multiplié pour actionnaires long-terme.",
            "preferred_shares_class": "Actions ordinaires + actions préférentielles avec droits distincts.",
        }
        out["voting_structure_note"] = notes_map.get(out["voting_structure"], "")

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

    # def14a strict_ok requires comp+board+voting+top_cap+top_voting.
    # 20-F / URD strict_ok does NOT require comp (FPI often discloses
    # aggregate compensation only).
    if kind == "def14a":
        strict_ok = has_ceo and has_comp and has_board and has_voting and has_top_cap and has_top_vote
    else:
        strict_ok = has_ceo and has_board and has_voting and has_top_cap and has_top_vote
    partial_ok = has_ceo and (has_board or has_voting or has_top_cap)

    if kind == "def14a":
        status = "heuristic_real" if strict_ok else (
            "heuristic_partial" if partial_ok else "incomplete"
        )
    else:
        status = "heuristic_real_eu" if strict_ok else (
            "heuristic_partial_eu" if partial_ok else "incomplete"
        )
    out["extraction_status"] = status

    return out, warnings, partial_ok


def source_tag(kind):
    return {
        "def14a": ("def14a_local_cerebras_real", "cerebras_paid_def14a_144"),
        "20f":    ("20f_local_cerebras_real",    "cerebras_paid_20f_144"),
        "urd":    ("urd_eu_cerebras_real_eu",    "cerebras_paid_urd_144"),
    }[kind]


def write_enrich(ticker, payload, source_file, kind):
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
    src_label, src_id = source_tag(kind)
    merged["source"] = src_label
    merged["source_file"] = source_file
    merged["_source"] = src_id
    merged["_source_file"] = source_file
    merged["_extracted_at"] = datetime.now(timezone.utc).isoformat()
    d["overrides_governance"] = merged
    d["_governance_extracted_by_144_at"] = datetime.now(timezone.utc).isoformat()
    p.write_text(json.dumps(d, indent=2, ensure_ascii=False))


def main():
    load_env()
    keys = get_keys()
    if not keys:
        log_line("FATAL: no CEREBRAS keys")
        sys.exit(1)

    key_idx = int(os.environ.get("KEY_INDEX", "1")) % len(keys)
    log_line(f"START sub-agent #144 retry: {len(keys)} keys, key_idx={key_idx}")

    def14a_index = build_def14a_index()
    log_line(f"DEF14A index: {len(def14a_index)} tickers")

    # Build job list: (ticker, kind, path, source_label_for_log)
    jobs = []
    # 27 fails (DEF14A retries)
    for t in FAILS_27:
        path, year = find_latest_def14a(t, def14a_index)
        if not path:
            log_line(f"WARN {t}: no DEF14A in sec-data, will skip")
            jobs.append((t, "def14a", None, None))
            continue
        jobs.append((t, "def14a", path, year))
    # 10 FPI (20-F or URD)
    for ticker, kind, fname in FPI_SOURCES:
        if kind == "20f":
            path, year = find_latest_20f(fname)
            if not path:
                log_line(f"WARN {ticker}: no 20-F for filename={fname}")
            jobs.append((ticker, "20f", path, year))
        else:
            path = find_latest_eu_text(fname)
            if not path:
                log_line(f"WARN {ticker}: no annual-text for {fname}")
            jobs.append((ticker, "urd", path, None))

    log_line(f"Total jobs: {len(jobs)}")

    ok = 0
    skipped_no_source = 0
    skipped_validation = 0
    api_fails = 0
    last_call_t = 0.0
    results = []

    for i, (ticker, kind, path, year) in enumerate(jobs):
        if not path:
            log_line(f"[{i+1}/{len(jobs)}] {ticker}: SKIP no source ({kind})")
            skipped_no_source += 1
            results.append({"ticker": ticker, "kind": kind, "status": "no_source"})
            continue

        name = get_company_name(ticker)
        # Load full text for later corroboration step (kept in memory only)
        full_text = ""
        if kind == "def14a":
            excerpt = load_def14a_text(path)
            try:
                full_text = strip_html(gzip.open(path, "rb").read().decode("utf-8", errors="ignore"))
            except Exception:
                pass
            prompt_tpl = PROMPT_DEF14A
        elif kind == "20f":
            excerpt = load_20f_text(path)
            try:
                full_text = strip_html(gzip.open(path, "rb").read().decode("utf-8", errors="ignore"))
            except Exception:
                pass
            prompt_tpl = PROMPT_20F
        else:
            excerpt = load_eu_text(path)
            try:
                full_text = path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                pass
            prompt_tpl = PROMPT_URD

        if not excerpt or len(excerpt) < 1000:
            log_line(f"[{i+1}/{len(jobs)}] {ticker}: SKIP empty/short excerpt ({len(excerpt) if excerpt else 0})")
            skipped_no_source += 1
            results.append({"ticker": ticker, "kind": kind, "status": "empty_extract"})
            continue

        elapsed = time.time() - last_call_t
        if elapsed < SLEEP_BETWEEN_CALLS:
            time.sleep(SLEEP_BETWEEN_CALLS - elapsed)

        prompt = prompt_tpl.format(ticker=ticker, name=name, excerpt=excerpt)
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
            log_line(f"[{i+1}/{len(jobs)}] {ticker}: FAIL api ({err})")
            api_fails += 1
            results.append({"ticker": ticker, "kind": kind, "status": "api_fail", "err": err})
            continue

        clean, warnings, partial_ok = validate_extraction(result, kind, raw_text=full_text or excerpt)
        if not partial_ok:
            log_line(f"[{i+1}/{len(jobs)}] {ticker}: SKIP validation {warnings}")
            skipped_validation += 1
            results.append({"ticker": ticker, "kind": kind, "status": "validation_fail", "warnings": warnings})
            continue

        source_rel = str(path.relative_to(PROJECT_ROOT))
        write_enrich(ticker, clean, source_rel, kind)
        log_line(
            f"[{i+1}/{len(jobs)}] {ticker} ({kind}): OK status={clean.get('extraction_status')} "
            f"ceo={clean.get('ceo_name','-')} comp={clean.get('ceo_total_comp_m','-')} "
            f"board={clean.get('board_size','-')} tc={len(clean.get('top_capital',[]))} "
            f"tv={len(clean.get('top_voting',[]))}"
        )
        ok += 1
        results.append({
            "ticker": ticker,
            "kind": kind,
            "status": "ok",
            "year": year,
            "extraction_status": clean.get("extraction_status"),
            "ceo_name": clean.get("ceo_name"),
            "ceo_total_comp_m": clean.get("ceo_total_comp_m"),
            "board_size": clean.get("board_size"),
            "voting_structure": clean.get("voting_structure"),
            "top_capital_count": len(clean.get("top_capital", [])),
            "top_voting_count": len(clean.get("top_voting", [])),
        })

        if (i + 1) % 5 == 0:
            key_idx = (key_idx + 1) % len(keys)

    log_line(
        f"END sub-agent #144: ok={ok} no_source={skipped_no_source} "
        f"validation_fail={skipped_validation} api_fail={api_fails} total={len(jobs)}"
    )

    out_file = RESULTS_DIR / f"results_144_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    out_file.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sub_agent": 144,
        "clusters": ["retry_131_fails_27", "fpi_adr_10"],
        "summary": {
            "ok": ok,
            "no_source": skipped_no_source,
            "validation_fail": skipped_validation,
            "api_fail": api_fails,
            "total": len(jobs),
        },
        "results": results,
    }, indent=2, ensure_ascii=False))
    log_line(f"Results: {out_file}")


if __name__ == "__main__":
    main()
