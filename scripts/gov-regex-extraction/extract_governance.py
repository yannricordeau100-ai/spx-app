#!/usr/bin/env python3
"""
Governance regex extraction from local DEF14A filings (US/CAN).

Sub-agent #87 mission — fills `overrides_governance` in
`src/data/v2-pipeline-enrich/<lowercase_ticker>.json` for stés flagged
g_governance KO in v1-9-pre-publication-audit.

Fields extracted from DEF14A htm.gz files:
  - ceo_name (Chief Executive Officer)
  - cfo_name (Chief Financial Officer)
  - board_size (number of directors)
  - voting_structure (dual_class | one_share_one_vote)
  - voting_structure_note (FR text)
  - director_independence_pct
  - top_capital / top_voting (≥5% beneficial owners + insiders to reach 3)
  - ceo_total_comp_m (Summary Compensation Table)

Zero LLM. Pure regex + html2text. Idempotent (skips if extraction_status
already heuristic_real).
"""
import os, re, sys, json, gzip, datetime
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
ENRICH_DIR = ROOT / "src/data/v2-pipeline-enrich"
COMPLETE_DIR = ROOT / "src/data/v1-9-complete"
DEF14A_MAP = json.loads(open("/tmp/gov-def14a-map.json").read())
AUDIT = json.loads(open(ROOT / "src/data/v1-9-pre-publication-audit.json").read())

# Index of audits per ticker
AUDITS_BY_TICKER = {a["ticker"]: a for a in AUDIT["audits"]}


class _Stripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip = True

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = False

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def html_to_text(html: str) -> str:
    s = _Stripper()
    try:
        s.feed(html)
    except Exception:
        pass
    text = " ".join(s.parts)
    text = re.sub(r"\s+", " ", text)
    return text


def load_def14a_text(ticker: str) -> tuple[str, str] | None:
    """Return (text, relpath) or None."""
    rel = DEF14A_MAP.get(ticker)
    if not rel:
        return None
    p = ROOT / rel
    if not p.exists():
        return None
    try:
        with gzip.open(p, "rt", encoding="utf-8", errors="ignore") as f:
            html = f.read()
    except Exception:
        return None
    txt = html_to_text(html)
    return txt, rel


# ---- Extractors ----

# Strict person-name pattern: First [Middle.] Last (2-4 tokens, no role words)
# Each name token: capital letter then 1-15 lowercase letters or hyphenated
# (allow "Su" or "Wu" — short Asian surnames)
NAME_TOKEN = r"[A-Z][a-z]{1,15}(?:[-'’][A-Z]?[a-z]+)?"
PERSON_NAME = rf"{NAME_TOKEN}(?:\s+[A-Z]\.?)?(?:\s+{NAME_TOKEN}){{1,2}}"

# Words that disqualify a "name" match (corporate/role/place words)
NAME_BLOCKLIST = re.compile(
    r"\b(Officer|Director|President|Member|Chief|Energy|Assurance|Executive|Company|Group|Corporation|"
    r"Holdings?|International|Inc|Ltd|LLC|Bank|Trust|Capital|Management|Industries|Services|Systems|"
    r"Solutions|Technologies|Partners?|Foundation|Plc|Corp|Stock|Annual|Report|Statement|Proxy|"
    r"Business|Department|Compensation|Committee|Board|Former|Senior|Vice|Chairman|Control|"
    r"Arrangements?|Our|Their|Pursuant|Performance|Awards?|Stock|Shares?|Common|Preferred|"
    r"Stockholders?|Shareholders?|Plan|Plans|Equity|Cash|Long-?Term|Short-?Term|Total|"
    r"Compensation|Salary|Bonus|Annual|Severance|Change|Termination|Employment|Service|Disclosure|"
    r"Information|Section|Article|Schedule|Appendix|Exhibit|Notice|Form|Filed|Letter|"
    r"Inc\.|Co\.|Corp\.|Ltd\.|Plc\.)\b",
    re.IGNORECASE,
)

# Words that look like person names (whitelist for first tokens to be more conservative)
NAME_COMMON_FIRST_NAMES = set()  # we don't enforce, just for ranking


def _validate_name(name: str) -> bool:
    name = name.strip().strip(",").strip()
    if len(name) < 6 or len(name) > 45:
        return False
    if NAME_BLOCKLIST.search(name):
        return False
    # Must have at least 2 tokens, each starting with capital
    tokens = name.split()
    if len(tokens) < 2 or len(tokens) > 4:
        return False
    for tok in tokens:
        if not tok[0].isupper():
            return False
        # Reject acronym tokens like "CEO" "AMD"
        if tok.isupper() and len(tok) > 2:
            return False
    return True


def extract_ceo(text: str) -> str | None:
    pats = [
        # "<Name>, ... Chief Executive Officer" (most reliable)
        rf"({PERSON_NAME}),?\s+(?:our\s+)?(?:President\s+and\s+)?Chief\s+Executive\s+Officer",
        rf"({PERSON_NAME})\s+(?:has\s+served|serves|is)\s+(?:as\s+)?(?:our\s+)?(?:President\s+and\s+)?Chief\s+Executive\s+Officer",
        rf"Mr\.\s+({PERSON_NAME})[^.]{{0,80}}Chief\s+Executive\s+Officer",
        rf"Ms\.\s+({PERSON_NAME})[^.]{{0,80}}Chief\s+Executive\s+Officer",
        rf"Dr\.\s+({PERSON_NAME})[^.]{{0,80}}Chief\s+Executive\s+Officer",
    ]
    candidates = []
    for p in pats:
        for m in re.finditer(p, text):
            name = m.group(1).strip()
            if _validate_name(name):
                candidates.append(name)
    if not candidates:
        return None
    # Most frequent
    from collections import Counter
    c = Counter(candidates)
    return c.most_common(1)[0][0]


def extract_cfo(text: str) -> str | None:
    pats = [
        rf"({PERSON_NAME}),?\s+(?:our\s+)?(?:Senior\s+)?(?:Executive\s+)?(?:Vice\s+President\s+and\s+)?Chief\s+Financial\s+Officer",
        rf"({PERSON_NAME})\s+(?:has\s+served|serves|is)\s+(?:as\s+)?(?:our\s+)?(?:Senior\s+)?(?:Executive\s+)?(?:Vice\s+President\s+and\s+)?Chief\s+Financial\s+Officer",
        rf"Mr\.\s+({PERSON_NAME})[^.]{{0,80}}Chief\s+Financial\s+Officer",
        rf"Ms\.\s+({PERSON_NAME})[^.]{{0,80}}Chief\s+Financial\s+Officer",
    ]
    candidates = []
    for p in pats:
        for m in re.finditer(p, text):
            name = m.group(1).strip()
            if _validate_name(name):
                candidates.append(name)
    if not candidates:
        return None
    from collections import Counter
    c = Counter(candidates)
    return c.most_common(1)[0][0]


def extract_board_size(text: str) -> int | None:
    # Pattern: "Board of Directors consists of X members/directors"
    pats = [
        r"Board\s+of\s+Directors\s+(?:currently\s+)?consists\s+of\s+(\w+|\d+)\s+(?:directors|members)",
        r"our\s+Board\s+(?:currently\s+)?consists\s+of\s+(\w+|\d+)\s+(?:directors|members)",
        r"(?:Our|The)\s+Board\s+(?:is\s+)?(?:currently\s+)?(?:composed|comprised)\s+of\s+(\w+|\d+)\s+(?:directors|members)",
        r"size\s+of\s+(?:our\s+)?Board\s+(?:of\s+Directors\s+)?(?:has\s+been\s+set\s+)?(?:at|to)\s+(\w+|\d+)",
        r"(?:Election|Elect)\s+of\s+(\w+|\d+)\s+(?:directors|members)",
        r"there\s+are\s+(?:currently\s+)?(\w+|\d+)\s+directors\s+on\s+(?:our|the)\s+Board",
    ]
    NUM = {
        "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
        "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
        "sixteen": 16,
    }
    for p in pats:
        for m in re.finditer(p, text, re.IGNORECASE):
            raw = m.group(1).lower()
            n = NUM.get(raw)
            if n is None and raw.isdigit():
                n = int(raw)
            if n and 3 <= n <= 25:
                return n
    return None


def extract_voting_structure(text: str) -> tuple[str, str]:
    """Return (voting_structure, voting_structure_note)."""
    # Dual class signals
    dual_signals = [
        r"Class\s+A\s+Common\s+Stock.{0,200}Class\s+B\s+Common\s+Stock",
        r"Class\s+B\s+Common\s+Stock.{0,200}vote(?:s)?\s+per\s+share",
        r"dual[\s-]?class",
        r"super-?voting",
        r"\b10\s+votes\s+per\s+share",
    ]
    for p in dual_signals:
        if re.search(p, text, re.IGNORECASE):
            return ("dual_class", "Structure dual class : actions Class A et Class B avec droits de vote différenciés (DEF14A).")
    # One share one vote
    if re.search(r"one\s+vote\s+per\s+share", text, re.IGNORECASE) or re.search(
        r"each\s+share[^.]{0,40}entitled\s+to\s+one\s+vote", text, re.IGNORECASE
    ):
        return ("one_share_one_vote", "Structure une action, un vote (DEF14A).")
    return ("one_share_one_vote", "Structure de vote ordinaire présumée (DEF14A, pas de mention dual class).")


def extract_board_independence(text: str) -> float | None:
    # "X of Y directors are independent" or "X% are independent"
    pats = [
        r"(\d+)\s+(?:of\s+(?:our|the)\s+(\d+)|out\s+of\s+(\d+))\s+(?:directors|members)\s+(?:are|qualify\s+as|have\s+been\s+determined\s+to\s+be)\s+independent",
        r"(\d+)\s+of\s+(?:our|the)\s+(\d+)\s+(?:director\s+)?nominees\s+(?:are|qualify\s+as)\s+independent",
        r"all\s+but\s+(?:one|two|three)\s+of\s+(?:our|the)\s+(\d+)\s+directors",
    ]
    for p in pats:
        for m in re.finditer(p, text, re.IGNORECASE):
            try:
                n_indep = int(m.group(1))
                n_total = int(m.group(2) or m.group(3))
                if n_total > 0 and 0 < n_indep <= n_total:
                    return round((n_indep / n_total) * 100, 1)
            except (ValueError, IndexError):
                continue
    return None


# CEO total compensation: extract from Summary Compensation Table
def extract_ceo_total_comp(text: str) -> float | None:
    """Locate Summary Compensation Table and extract CEO's most recent total.

    Strategy: find "Summary Compensation Table" header section. Within it,
    locate rows matching "<role> YEAR $... $... $... $... $TOTAL" where role
    contains "Chief Executive Officer" / "President and CEO". Grab the LAST
    $-prefixed value on that row (= Total column).
    """
    # Find all positions of "Summary Compensation Table"
    positions = [m.start() for m in re.finditer(r"Summary\s+Compensation\s+Table", text, re.IGNORECASE)]
    if not positions:
        return None
    # Try positions starting from the 2nd (1st is usually TOC), fallback all
    candidates = []
    for pos in positions[1:] if len(positions) > 1 else positions:
        snippet = text[pos:pos + 50000]
        # Row pattern: "<role with CEO/Chief Executive Officer> YEAR <row_data>"
        # row_data contains numeric amounts (with or without $ prefix), em-dash
        # placeholders, and footnote markers like (1)(2)(3).
        row_pat = re.compile(
            r"(?:President\s+and\s+(?:Chief\s+Executive\s+Officer|CEO)|Chief\s+Executive\s+Officer)\s+"
            r"(20\d{2})"
            r"([\s\S]{20,800}?)"
            r"(?=\s+20\d{2}\s+[\$\d]|\s+[A-Z][a-z]+\s+[A-Z][a-z]+\s+(?:Executive|Chief|President|Senior|Head|General))",
            re.IGNORECASE,
        )
        for m in row_pat.finditer(snippet):
            year = m.group(1)
            row_data = m.group(2)
            # Find all numeric amounts in row_data (with or without $ prefix)
            # Pattern: X,XXX,XXX or X,XXX,XXX.XX (must have at least one comma
            # to indicate large number, avoiding catching footnote refs)
            num_vals = re.findall(r"\$?\s?(\d{1,3}(?:,\d{3}){1,3}(?:\.\d+)?)", row_data)
            if len(num_vals) < 4:
                continue
            # Last value = Total column
            raw = num_vals[-1].replace(",", "")
            try:
                val = float(raw)
            except ValueError:
                continue
            if val < 500_000 or val > 500_000_000:
                continue
            val_m = round(val / 1_000_000, 2)
            candidates.append((year, val_m))
    if not candidates:
        return None
    # Pick the most recent year's value
    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1]
    return None


# Top capital / voting holders (≥5% beneficial owners)
INSTITUTIONS = {
    "vanguard": "The Vanguard Group",
    "blackrock": "BlackRock, Inc.",
    "state street": "State Street Corporation",
    "fmr": "FMR LLC (Fidelity)",
    "fidelity": "FMR LLC (Fidelity)",
    "t. rowe": "T. Rowe Price",
    "wellington": "Wellington Management",
    "capital group": "Capital Group",
    "geode": "Geode Capital Management",
    "berkshire hathaway": "Berkshire Hathaway",
    "northern trust": "Northern Trust",
    "norges bank": "Norges Bank",
    "dimensional fund": "Dimensional Fund Advisors",
    "macquarie": "Macquarie",
    "invesco": "Invesco",
    "schwab": "Charles Schwab",
    # Removed: JPMorgan/Morgan Stanley/Bank of America (frequent self-name
    # mentions in DEF14As of large US banks → false positive ownership)
}


def extract_top_holders(text: str, issuer_name: str = "") -> list[dict]:
    """Find ≥5% beneficial owners from DEF14A 'Security Ownership' tables.

    Strategy: locate the institution name, then within the next ~200 chars look
    for "X.X%" or "X%" — picking the FIRST percentage encountered (DEF14A tables
    typically list owner + shares + pct in that order on the same row).

    issuer_name: company's own name (e.g. "JPMorgan Chase") — institutions
    matching the issuer are skipped (self-references).
    """
    holders = []
    seen = set()
    issuer_lower = issuer_name.lower()

    for kw, canonical in INSTITUTIONS.items():
        # Skip if institution name overlaps with issuer (self-ref)
        if issuer_lower and kw in issuer_lower:
            continue
        for m in re.finditer(rf"\b{re.escape(kw)}", text, re.IGNORECASE):
            snippet = text[m.end():m.end() + 250]
            # First pct in the snippet
            pct_match = re.search(r"(\d{1,2}(?:\.\d{1,2})?)\s*%", snippet)
            if not pct_match:
                continue
            try:
                pct = float(pct_match.group(1))
            except ValueError:
                continue
            if not (4.5 <= pct <= 40):
                continue
            if canonical in seen:
                continue
            holders.append({
                "name": canonical,
                "type": "institutionnel",
                "stake_pct": pct,
            })
            seen.add(canonical)
            break  # one match per institution

    holders.sort(key=lambda h: -h["stake_pct"])
    return holders[:5]


# ---- Main extraction per ticker ----

def get_existing_governance(ticker: str, ignore_self: bool = False) -> dict:
    """Merge governance from v1-9-complete + v2-pipeline-enrich.

    ignore_self: if True, skip overrides_governance from our own extractor
    (def14a_local_regex) so --force can re-extract fresh.
    """
    g = {}
    # v1-9-complete (canonical)
    c = COMPLETE_DIR / f"{ticker}.json"
    if c.exists():
        try:
            data = json.loads(c.read_text())
            if data.get("governance"):
                g.update(data["governance"])
        except Exception:
            pass
    # v2-pipeline-enrich (lowercase) — adds overrides_governance
    lower = ticker.lower()
    e = ENRICH_DIR / f"{lower}.json"
    if e.exists():
        try:
            data = json.loads(e.read_text())
            if isinstance(data.get("governance"), dict):
                for k, v in data["governance"].items():
                    if k not in g or g[k] in (None, "", [], {}):
                        g[k] = v
            og = data.get("overrides_governance")
            if isinstance(og, dict):
                # If our own extractor wrote this and we're in force mode, skip it
                if ignore_self and og.get("source") == "def14a_local_regex":
                    pass
                else:
                    for k, v in og.items():
                        if v in (None, "", [], {}):
                            continue
                        if k not in g or g[k] in (None, "", [], {}):
                            g[k] = v
        except Exception:
            pass
    return g


def needs_field(existing: dict, field: str) -> bool:
    """True if field is missing/empty and should be filled."""
    v = existing.get(field)
    if v is None or v == "":
        return True
    if isinstance(v, list) and len(v) < 3 and field in ("top_capital", "top_voting"):
        return True
    return False


def extract_one(ticker: str, force: bool = False) -> dict:
    """Return result dict with extracted fields + source. Empty dict if nothing useful."""
    loaded = load_def14a_text(ticker)
    if not loaded:
        return {"_governance_extraction_failed": "no_local_filing", "ticker": ticker}

    text, rel = loaded
    existing = get_existing_governance(ticker, ignore_self=force)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")

    overrides = {}

    # Always-extract: CEO/CFO names
    if needs_field(existing, "ceo_name"):
        ceo = extract_ceo(text)
        if ceo:
            overrides["ceo_name"] = ceo

    # CFO extraction disabled: too many false positives without LLM disambiguation
    # (regex matches "<Name>, Chief Financial Officer" but DEF14A often references
    # prior-year CFOs or directors who held CFO roles elsewhere). Audit doesn't
    # require cfo_name anyway.

    # board_size
    if needs_field(existing, "board_size"):
        bs = extract_board_size(text)
        if bs:
            overrides["board_size"] = bs

    # voting_structure / voting_structure_note
    if needs_field(existing, "voting_structure") or needs_field(existing, "voting_structure_note"):
        vs, vsn = extract_voting_structure(text)
        if needs_field(existing, "voting_structure"):
            overrides["voting_structure"] = vs
        if needs_field(existing, "voting_structure_note"):
            overrides["voting_structure_note"] = vsn

    # board_independence_pct
    if not existing.get("board_independence_pct"):
        bip = extract_board_independence(text)
        if bip:
            overrides["board_independence_pct"] = bip

    # ceo_total_comp_m
    if needs_field(existing, "ceo_total_comp_m"):
        ctc = extract_ceo_total_comp(text)
        if ctc and 0.5 <= ctc <= 500:
            overrides["ceo_total_comp_m"] = ctc

    # Top holders
    def _norm_holder_name(n: str) -> str:
        """Canonical key for dedup: lowercase, strip 'the', 'group', 'inc', commas."""
        n = (n or "").lower()
        n = re.sub(r"\b(the|group|inc|inc\.|llc|corporation|corp|, inc\.?|, llc)\b", " ", n)
        n = re.sub(r"[,.]", " ", n)
        n = re.sub(r"\s+", " ", n).strip()
        return n

    existing_top_cap = existing.get("top_capital") or []
    existing_top_vot = existing.get("top_voting") or []
    # Filter out malformed entries (null pct, non-numeric pct)
    def _is_clean_holder(h):
        if not isinstance(h, dict) or not h.get("name"):
            return False
        pct = h.get("stake_pct")
        return isinstance(pct, (int, float)) and pct > 0

    clean_existing_cap = [h for h in existing_top_cap if _is_clean_holder(h)]
    clean_existing_vot = [h for h in existing_top_vot if _is_clean_holder(h)]
    needs_cap = len(clean_existing_cap) < 3
    needs_vot = len(clean_existing_vot) < 3
    if needs_cap or needs_vot:
        # Load issuer name for self-ref filtering
        issuer_name = ""
        c = COMPLETE_DIR / f"{ticker}.json"
        if c.exists():
            try:
                issuer_name = json.loads(c.read_text()).get("name", "")
            except Exception:
                pass
        regex_holders = extract_top_holders(text, issuer_name=issuer_name)
        if regex_holders:
            merged_cap = list(clean_existing_cap)
            merged_vot = list(clean_existing_vot)
            seen_cap = {_norm_holder_name(h.get("name", "")) for h in merged_cap}
            seen_vot = {_norm_holder_name(h.get("name", "")) for h in merged_vot}
            for h in regex_holders:
                nk = _norm_holder_name(h["name"])
                if nk not in seen_cap and len(merged_cap) < 5:
                    merged_cap.append(h)
                    seen_cap.add(nk)
                if nk not in seen_vot and len(merged_vot) < 5:
                    merged_vot.append(h)
                    seen_vot.add(nk)
            if needs_cap and len(merged_cap) > len(clean_existing_cap):
                overrides["top_capital"] = merged_cap
            if needs_vot and len(merged_vot) > len(clean_existing_vot):
                overrides["top_voting"] = merged_vot

    if not overrides:
        return {"_governance_extraction_failed": "no_new_data", "ticker": ticker}

    overrides["extraction_status"] = "heuristic_real"
    overrides["source"] = "def14a_local_regex"
    overrides["source_file"] = rel
    overrides["verified_at"] = now
    return overrides


def write_overrides(ticker: str, overrides: dict, dry_run: bool = False, force: bool = False) -> bool:
    """Merge overrides into v2-pipeline-enrich/<lower>.json under `overrides_governance`."""
    lower = ticker.lower()
    p = ENRICH_DIR / f"{lower}.json"
    existing = {}
    if p.exists():
        try:
            existing = json.loads(p.read_text())
        except Exception:
            existing = {}
    cur_overrides = existing.get("overrides_governance") or {}

    # Idempotency: skip if our previous extraction already wrote and no new keys
    if not force and cur_overrides.get("extraction_status") == "heuristic_real" and cur_overrides.get("source") == "def14a_local_regex":
        new_keys = set(overrides.keys()) - set(cur_overrides.keys())
        if not new_keys:
            return False

    # Field-by-field merge: new overrides take precedence ONLY for fields we extract.
    # Keep prior overrides_governance fields not in our extraction (e.g. heuristic
    # fill from sub-agent #59 like ceo_pay_ratio, avg_tenure_years).
    merged = dict(cur_overrides)
    # If forcing, strip prior fields from THIS extractor so stale wrong values get removed
    if force and cur_overrides.get("source") == "def14a_local_regex":
        OUR_FIELDS = {"ceo_name", "cfo_name", "board_size", "voting_structure",
                      "voting_structure_note", "board_independence_pct",
                      "ceo_total_comp_m", "top_capital", "top_voting",
                      "extraction_status", "source", "source_file", "verified_at"}
        merged = {k: v for k, v in merged.items() if k not in OUR_FIELDS}
    merged.update(overrides)
    existing["overrides_governance"] = merged

    if dry_run:
        return True
    p.write_text(json.dumps(existing, ensure_ascii=False, indent=2))
    return True


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers", help="Comma-separated list (default: all US/CAN KO)")
    ap.add_argument("--start", type=int, default=0)
    ap.add_argument("--end", type=int, default=None)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--force", action="store_true", help="Re-extract even if previously done")
    args = ap.parse_args()

    if args.tickers:
        tickers = args.tickers.split(",")
    else:
        tickers = open("/tmp/gov-ko-uscan.txt").read().strip().split("\n")
    if args.end:
        tickers = tickers[args.start:args.end]
    else:
        tickers = tickers[args.start:]

    stats = {
        "total": 0, "wrote": 0, "no_filing": 0, "no_new_data": 0, "failed": 0,
        "fields": {"ceo_name": 0, "cfo_name": 0, "board_size": 0,
                   "voting_structure": 0, "voting_structure_note": 0,
                   "board_independence_pct": 0, "ceo_total_comp_m": 0,
                   "top_capital": 0, "top_voting": 0},
    }
    sample_results = []

    for ticker in tickers:
        stats["total"] += 1
        try:
            result = extract_one(ticker, force=args.force)
        except Exception as e:
            stats["failed"] += 1
            if args.verbose:
                print(f"[FAIL] {ticker}: {e}", file=sys.stderr)
            continue
        if result.get("_governance_extraction_failed") == "no_local_filing":
            stats["no_filing"] += 1
            continue
        if result.get("_governance_extraction_failed") == "no_new_data":
            stats["no_new_data"] += 1
            continue
        # Count fields
        for k in stats["fields"]:
            if k in result:
                stats["fields"][k] += 1
        if write_overrides(ticker, result, dry_run=args.dry_run, force=args.force):
            stats["wrote"] += 1
            if len(sample_results) < 5:
                sample_results.append({"ticker": ticker, "overrides": {k: v for k, v in result.items() if k != "source_file"}})
            if args.verbose:
                print(f"[OK] {ticker}: {list(result.keys())}", file=sys.stderr)

    print(json.dumps({"stats": stats, "samples": sample_results}, indent=2, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
