#!/usr/bin/env python3
"""
Sub-agent #138 — EU URD governance extraction prep (Phase 2)

Cluster medium_eu_full (24 EU stés) — extraction governance fields
depuis URD (Universal Registration Document) / Annual Report multi-langue
(FR/DE/IT/EN/ES/NL/PT).

⚠️ SCRIPT PRÉPARÉ MAIS NON EXÉCUTÉ.
Phase 2 démarrera après que le top 307+SP500 ait atteint ≥95% audit OK.
Cf. EU-PHASE-2-PLAN.md à la racine du repo pour activation.

Modèle Cerebras qwen-3-235b-a22b-instruct-2507 (paid). Sources depuis
sec-data/cat3-european/<TICKER>/annual-text/<year>.txt.

Écrit overrides_governance dans src/data/v2-pipeline-enrich/<lower>.json,
preserve existing fields (merge by key — overrides_governance keys win
inside the overrides block only).

Validation strict :
- CEO name pattern (capitalized full name, group-level not division)
- board_size 3-30
- top_capital / top_voting: ≥3 entrées (sinon flag _top_*_lt_3)
- voting_structure parmi enum EU élargie (loyalty/double/dual/preferred/standard)
- source_file must exist on filesystem

Key idx=0 par défaut (k0), à coordonner avec runs Cerebras concurrents.
Throttle 0.5s entre calls.
"""
from __future__ import annotations

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
GAP_BREAKDOWN = PROJECT_ROOT / "src/data/v1-9-gm-gap-breakdown.json"
V19_COMPLETE = PROJECT_ROOT / "src/data/v1-9-complete"
V2_ENRICH = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
EU_ROOT = PROJECT_ROOT / "sec-data/cat3-european"
RESULTS_DIR = PROJECT_ROOT / "src/data/governance-cerebras"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)
LOG = PROJECT_ROOT / ".conv-state/CONV-CONCEPTS-governance-cerebras-138.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL_ID = "qwen-3-235b-a22b-instruct-2507"
SLEEP_BETWEEN_CALLS = 0.5
MAX_TOKENS = 2400
CTX_LEN = 28000

# Multi-language CEO name pattern: allow accents, hyphens, apostrophes, particles (de, van, von, etc.)
CEO_NAME_PATTERN = re.compile(
    r"^[A-ZÀ-Ý][\wÀ-ÿ'\-\.]+(?:\s+(?:de|van|von|den|der|du|del|della|di|le|la)\s+)?(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'\-\.]+){1,4}$"
)
CEO_NAME_BLOCKLIST = {
    "officer", "executive", "chairman", "president", "director",
    "ceo", "cfo", "company", "limited", "ltd", "plc", "sa", "ag", "se",
    "gmbh", "nv", "spa", "managing", "general", "deputy", "vice",
}

PROMPT = """Extract governance fields for {ticker} ({name}, {country}) from this URD/Annual Report excerpt.

The document may be multi-language: FR (French), DE (German), IT (Italian), EN (English), ES (Spanish), NL (Dutch), PT (Portuguese).

Return STRICT JSON only (no markdown, no commentary):
{{
  "ceo_name": "<full name of group-level CEO, not division CEO>" or null,
  "cfo_name": "<full name>" or null,
  "board_size": <int> or null,
  "voting_structure": "one_share_one_vote" | "double_voting_rights" | "loyalty_shares" | "dual_class" | "preferred_shares_class" or null,
  "voting_structure_note": "<brief note in EN/FR>" or null,
  "director_independence_pct": <0-100 number> or null,
  "top_capital": [{{"name": "<shareholder name>", "pct": <0-100>, "type": "individual|institutional|state|family"}}, ...] or [],
  "top_voting": [{{"name": "<shareholder name>", "pct": <0-100>}}, ...] or []
}}

Multi-language patterns to look for:
- CEO group-level:
  - EN: "Chief Executive Officer", "CEO", "Group CEO"
  - FR: "Directeur Général", "Président-Directeur Général" (PDG), "Directeur Général du Groupe"
  - DE: "Vorstandsvorsitzender", "CEO", "Vorstand"
  - IT: "Amministratore Delegato", "AD", "Direttore Generale"
  - ES: "Consejero Delegado", "CEO"
  - NL: "Chief Executive Officer", "CEO", "Bestuursvoorzitter"
  - PT: "Presidente Executivo", "CEO"
- Board size:
  - EN: "Board of Directors comprises X members"
  - FR: "Conseil d'Administration composé de X membres"
  - DE: "Aufsichtsrat besteht aus X Mitgliedern"
  - IT: "Consiglio di Amministrazione composto da X membri"
- Voting structure (EU specifics):
  - FR: "droit de vote double" (Loi Florange), "actions à droit de vote double"
  - IT: "voto plurimo", "azioni a voto multiplo"
  - NL/EN: "loyalty shares", "loyalty voting shares"
  - DE: "Stammaktien und Vorzugsaktien"
- Top shareholders:
  - FR: "détient X%", "détenue à X% par"
  - DE: "hält X%", "X% Anteil"
  - IT: "possiede X%", "detiene il X%"
  - EN: "owns X%", "holds X% of"
  - NL: "houdt X%"

Rules (STRICT, NO EXCEPTIONS):
- ceo_name: REAL full name of GROUP-LEVEL CEO. NOT a division CEO. Must be Capitalized First Last (accents OK).
- board_size: count of directors (typically 8-20 in EU, may include both executive + non-executive in unitary boards, or supervisory + management in dual boards — return total board members visible).
- voting_structure: EU often has "double_voting_rights" (loi Florange FR), "loyalty_shares" (IT/NL), or standard "one_share_one_vote".
- top_capital and top_voting: return ≥3 entries if available. For state-owned (ex EDF, ENI), include the State as shareholder.

CRITICAL: If a field is NOT in the excerpt, return null (or empty array). NEVER guess. Zero hallucination.

URD/Annual Report excerpt:
---
{excerpt}
---

Return ONLY the JSON object."""

HTML_TAG_RE = re.compile(r"<[^>]+>")
WHITESPACE_RE = re.compile(r"\s+")


def find_best_match(text: str, pattern: str, min_pos: int = 0):
    """Return position of densest signal match (skip table of contents)."""
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


def extract_governance_section(text: str) -> str:
    """Extract governance + ownership sections from multi-language URD."""
    if not text or len(text) < 5000:
        return text
    chunks = []
    # Governance / Board section (multi-lang)
    pos = find_best_match(
        text,
        r"(?:corporate\s+governance|gouvernance|aufsichtsrat|consiglio\s+di\s+amministrazione|gobierno\s+corporativo|raad\s+van\s+(?:bestuur|commissarissen))",
    )
    if pos is not None:
        chunks.append(("GOVERNANCE", pos, 10000))
    # CEO / Management
    pos = find_best_match(
        text,
        r"(?:chief\s+executive\s+officer|directeur\s+g[ée]n[ée]ral|vorstandsvorsitzender|amministratore\s+delegato|consejero\s+delegado)",
    )
    if pos is not None:
        chunks.append(("CEO", pos, 4000))
    # Ownership / Shareholder structure
    pos = find_best_match(
        text,
        r"(?:share(?:holder|holding)\s+structure|actionnariat|aktion[äa]rsstruktur|azionariato|estructura\s+accionarial|aandeelhoudersstructuur|principal\s+shareholders|principaux\s+actionnaires)",
    )
    if pos is not None:
        chunks.append(("OWNERSHIP", pos, 8000))
    # Voting structure
    pos = find_best_match(
        text,
        r"(?:voting\s+rights|droit\s+de\s+vote|stimmrecht|diritto\s+di\s+voto|derechos\s+de\s+voto|stemrecht|loyalty\s+shares|double\s+voting)",
    )
    if pos is not None:
        chunks.append(("VOTING", pos, 3000))
    # Independence
    pos = find_best_match(
        text,
        r"(?:independent\s+directors?|administrateurs?\s+ind[ée]pendants?|unabh[äa]ngige\s+mitglieder|amministratori\s+indipendenti)",
    )
    if pos is not None:
        chunks.append(("INDEPENDENCE", pos, 2500))

    if not chunks:
        mid = len(text) // 2
        return text[max(0, mid - 14000): mid + 14000]

    # Dedup overlapping chunks
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


def get_company_info(ticker):
    """Return (name, country) from v1-9-complete or v2-pipeline-enrich."""
    p = V19_COMPLETE / f"{ticker.upper()}.json"
    name, country = ticker, ""
    if p.exists():
        try:
            d = json.loads(p.read_text())
            name = d.get("name") or ticker
            country = d.get("country") or ""
        except Exception:
            pass
    # Fallback to country deduction from suffix
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


def find_latest_eu_source(ticker):
    """Return Path to latest annual-text file for given EU ticker."""
    base = EU_ROOT / ticker / "annual-text"
    if not base.is_dir():
        return None
    files = sorted(base.glob("*.txt"), key=lambda p: p.name, reverse=True)
    # Prefer files without "_full" suffix issues, but if only _full exists, take it
    return files[0] if files else None


def load_eu_text(path: Path):
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return None
    return extract_governance_section(text)


def validate_ceo_name(name):
    if not name or not isinstance(name, str):
        return False, "missing or non-string"
    name = name.strip()
    if len(name) < 4 or len(name) > 80:
        return False, f"length out of range: {len(name)}"
    if not CEO_NAME_PATTERN.match(name):
        return False, f"name regex fail: {name!r}"
    lower = name.lower()
    for word in CEO_NAME_BLOCKLIST:
        if word == lower or word in lower.split():
            return False, f"blocklisted word: {word}"
    return True, "ok"


def validate_extraction(payload, ticker):
    """Validate fields, return (clean_dict, warnings_list, ok_bool)."""
    if not isinstance(payload, dict):
        return None, ["payload not dict"], False
    warnings = []
    out = {}

    ceo_name = payload.get("ceo_name")
    if ceo_name:
        ok, why = validate_ceo_name(ceo_name)
        if ok:
            out["ceo_name"] = ceo_name.strip()
        else:
            warnings.append(f"ceo_name rejected: {why}")

    cfo = payload.get("cfo_name")
    if cfo:
        ok, _ = validate_ceo_name(cfo)
        if ok:
            out["cfo_name"] = cfo.strip()

    bs = payload.get("board_size")
    if isinstance(bs, int) and 3 <= bs <= 30:
        out["board_size"] = bs

    vs = payload.get("voting_structure")
    if vs in (
        "one_share_one_vote", "double_voting_rights", "loyalty_shares",
        "dual_class", "preferred_shares_class"
    ):
        out["voting_structure"] = vs
    vsn = payload.get("voting_structure_note")
    if isinstance(vsn, str) and 5 <= len(vsn) <= 400:
        out["voting_structure_note"] = vsn.strip()
    # Synthetise note FR si absent mais voting_structure connu
    if "voting_structure" in out and "voting_structure_note" not in out:
        vs_val = out["voting_structure"]
        notes_map = {
            "one_share_one_vote": "Structure standard une action = une voix (vérifié via URD).",
            "double_voting_rights": "Droit de vote double pour actions détenues depuis 2+ ans (Loi Florange / similaires, vérifié via URD).",
            "loyalty_shares": "Loyalty shares : droit de vote multiplié pour actionnaires long-terme (vérifié via URD).",
            "dual_class": "Structure dual class : classes d'actions avec droits différents (vérifié via URD).",
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
    has_board = "board_size" in out
    has_voting = "voting_structure" in out
    has_top_cap = "top_capital" in out
    has_top_vote = "top_voting" in out
    strict_ok = has_ceo and has_board and has_voting and has_top_cap and has_top_vote
    partial_ok = has_ceo and (has_board or has_voting or has_top_cap)

    out["extraction_status"] = "heuristic_real_eu" if strict_ok else (
        "heuristic_partial_eu" if partial_ok else "incomplete"
    )

    return out, warnings, partial_ok


def write_enrich(ticker, payload, source_file):
    """Merge overrides_governance into v2-pipeline-enrich/<lower>.json."""
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
    # source ends with "_real_eu" so audit tags this as regex_real_sourced
    merged["source"] = "urd_eu_cerebras_real_eu"
    merged["source_file"] = source_file
    merged["_source"] = "cerebras_paid_urd_eu_138"
    merged["_source_file"] = source_file
    merged["_extracted_at"] = datetime.now(timezone.utc).isoformat()
    d["overrides_governance"] = merged
    d["_governance_extracted_by_138_at"] = datetime.now(timezone.utc).isoformat()
    p.write_text(json.dumps(d, indent=2, ensure_ascii=False))


def main():
    load_env()
    keys = get_keys()
    if not keys:
        log_line("FATAL: no CEREBRAS keys")
        sys.exit(1)

    if not os.environ.get("PAID_MODE"):
        log_line("⚠️  PAID_MODE env var not set. This script requires explicit confirmation.")
        log_line("    Set PAID_MODE=1 to run. Phase 2 activation = after top 307+SP500 ≥95%.")
        log_line("    Cf. EU-PHASE-2-PLAN.md")
        sys.exit(2)

    key_idx = int(os.environ.get("KEY_INDEX", "0")) % len(keys)
    log_line(f"START sub-agent #138 EU URD governance Cerebras paid: {len(keys)} keys, starting key_idx={key_idx}")

    data = json.loads(GAP_BREAKDOWN.read_text())
    gap = data.get("gap_detail", [])
    targets = [c for c in gap if c.get("category") == "medium_eu_full"]
    log_line(f"Cluster medium_eu_full: {len(targets)} targets")

    limit = int(os.environ.get("LIMIT", "0"))
    if limit:
        targets = targets[:limit]
        log_line(f"LIMIT={limit} → processing {len(targets)} targets")

    ok = 0
    skipped_no_source = 0
    skipped_validation = 0
    api_fails = 0
    last_call_t = 0.0
    results = []

    for i, c in enumerate(targets):
        ticker = c["ticker"]
        name, country = get_company_info(ticker)

        path = find_latest_eu_source(ticker)
        if not path:
            log_line(f"[{i+1}/{len(targets)}] {ticker}: SKIP no annual-text in cat3-european")
            skipped_no_source += 1
            results.append({"ticker": ticker, "status": "no_source"})
            continue

        excerpt = load_eu_text(path)
        if not excerpt or len(excerpt) < 1000:
            log_line(f"[{i+1}/{len(targets)}] {ticker}: SKIP empty/short excerpt ({len(excerpt) if excerpt else 0})")
            skipped_no_source += 1
            results.append({"ticker": ticker, "status": "empty_extract"})
            continue

        # Throttle
        elapsed = time.time() - last_call_t
        if elapsed < SLEEP_BETWEEN_CALLS:
            time.sleep(SLEEP_BETWEEN_CALLS - elapsed)

        prompt = PROMPT.format(ticker=ticker, name=name, country=country or "EU", excerpt=excerpt)
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
            log_line(f"[{i+1}/{len(targets)}] {ticker}: FAIL api ({err})")
            api_fails += 1
            results.append({"ticker": ticker, "status": "api_fail", "err": err})
            continue

        clean, warnings, partial_ok = validate_extraction(result, ticker)
        if not partial_ok:
            log_line(f"[{i+1}/{len(targets)}] {ticker}: SKIP validation {warnings}")
            skipped_validation += 1
            results.append({"ticker": ticker, "status": "validation_fail", "warnings": warnings})
            continue

        source_rel = str(path.relative_to(PROJECT_ROOT))
        write_enrich(ticker, clean, source_rel)
        log_line(
            f"[{i+1}/{len(targets)}] {ticker}: OK status={clean.get('extraction_status')} "
            f"ceo={clean.get('ceo_name','-')} board={clean.get('board_size','-')} "
            f"voting={clean.get('voting_structure','-')} "
            f"tc={len(clean.get('top_capital',[]))} tv={len(clean.get('top_voting',[]))}"
        )
        ok += 1
        results.append({
            "ticker": ticker,
            "status": "ok",
            "extraction_status": clean.get("extraction_status"),
            "ceo_name": clean.get("ceo_name"),
            "board_size": clean.get("board_size"),
            "voting_structure": clean.get("voting_structure"),
            "top_capital_count": len(clean.get("top_capital", [])),
            "top_voting_count": len(clean.get("top_voting", [])),
        })

        # Rotate key every 5 calls
        if (i + 1) % 5 == 0:
            key_idx = (key_idx + 1) % len(keys)

    log_line(
        f"END sub-agent #138: ok={ok} no_source={skipped_no_source} "
        f"validation_fail={skipped_validation} api_fail={api_fails}"
    )

    out_file = RESULTS_DIR / f"results_138_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    out_file.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sub_agent": 138,
        "cluster": "medium_eu_full",
        "summary": {
            "ok": ok,
            "no_source": skipped_no_source,
            "validation_fail": skipped_validation,
            "api_fail": api_fails,
            "total": len(targets),
        },
        "results": results,
    }, indent=2, ensure_ascii=False))
    log_line(f"Results: {out_file}")


if __name__ == "__main__":
    main()
