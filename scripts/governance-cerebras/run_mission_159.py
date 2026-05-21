#!/usr/bin/env python3
"""
Mission #159 Phase 1 — EU URD governance extraction on top307+SP500 g_governance KO

Wrapper that targets a specific list of 26 EU stés (computed from current audit)
and runs the existing extract_urd_eu_paid.py logic on them with yfinance CEO
cross-check (anti-hallucination Sampo/AGS pattern).

Usage:
  PAID_MODE=1 KEY_INDEX=0 python3 scripts/governance-cerebras/run_mission_159.py
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
V2_ENRICH = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
EU_ROOT = PROJECT_ROOT / "sec-data/cat3-european"
RESULTS_DIR = PROJECT_ROOT / "src/data/governance-cerebras"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)
LOG = PROJECT_ROOT / ".conv-state/CONV-CONCEPTS-mission-159.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL_ID = "qwen-3-235b-a22b-instruct-2507"
SLEEP_BETWEEN_CALLS = 0.5
MAX_TOKENS = 2400
CTX_LEN = 28000

TARGETS = [
    "ABF.L", "AMUN.PA", "ANA.MC", "AV.L", "BCP.LS", "BESI.AS",
    "CA.PA", "CNA.L", "DANSKE.CO", "FRE.DE", "HLN.L", "III.L",
    "KESKOB.HE", "MB.MI", "MRK.DE", "REL.L", "RI.PA", "RXL.PA",
    "SAND.ST", "SBRY.L", "SIE.DE", "SOON.SW", "UNI.MI", "UPM.HE",
    "URW.PA", "VOW.DE",
]

CEO_NAME_PATTERN = re.compile(
    r"^[A-ZÀ-Ý][\wÀ-ÿ'\-\.]+(?:\s+(?:de|van|von|den|der|du|del|della|di|le|la)\s+)?(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'\-\.]+){1,4}$"
)
CEO_NAME_BLOCKLIST = {
    "officer", "executive", "chairman", "president", "director",
    "ceo", "cfo", "company", "limited", "ltd", "plc", "sa", "ag", "se",
    "gmbh", "nv", "spa", "managing", "general", "deputy", "vice",
}

PROMPT = """Extract governance fields for {ticker} ({name}, {country}) from this URD/Annual Report excerpt.

The document may be multi-language: FR (French), DE (German), IT (Italian), EN (English), ES (Spanish), NL (Dutch), PT (Portuguese), FI (Finnish), SV (Swedish), DA (Danish).

Return STRICT JSON only (no markdown, no commentary):
{{
  "ceo_name": "<full name of group-level CEO, not division CEO>" or null,
  "cfo_name": "<full name>" or null,
  "board_size": <int> or null,
  "voting_structure": "one_share_one_vote" | "double_voting_rights" | "loyalty_shares" | "dual_class" | "preferred_shares_class" or null,
  "voting_structure_note": "<brief note>" or null,
  "director_independence_pct": <0-100 number> or null,
  "top_capital": [{{"name": "<shareholder name>", "pct": <0-100>, "type": "individual|institutional|state|family"}}, ...] or [],
  "top_voting": [{{"name": "<shareholder name>", "pct": <0-100>}}, ...] or []
}}

Multi-language patterns:
- CEO group-level: "Chief Executive Officer", "CEO", "Directeur Général", "Président-Directeur Général" (PDG), "Vorstandsvorsitzender", "Amministratore Delegato", "Consejero Delegado", "Bestuursvoorzitter", "toimitusjohtaja", "verkställande direktör"
- Board: "Board of Directors", "Conseil d'Administration", "Aufsichtsrat", "Consiglio di Amministrazione", "hallitus", "styrelse"
- Voting: "droit de vote double" (Loi Florange), "voto plurimo", "loyalty shares", "Stammaktien"
- Top shareholders: "détient X%", "hält X%", "possiede X%", "owns X%", "houdt X%"

Rules (STRICT):
- ceo_name: REAL full name of GROUP-LEVEL CEO. Must be Capitalized First Last (accents OK).
- board_size: count of directors (typically 8-20 in EU).
- top_capital and top_voting: ≥3 entries if available. Include the State for state-owned.
- If a field is NOT in the excerpt, return null. NEVER guess. Zero hallucination.

URD/Annual Report excerpt:
---
{excerpt}
---

Return ONLY the JSON object."""


def find_best_match(text, pattern, min_pos=0):
    matches = list(re.finditer(pattern, text, re.I))
    if not matches:
        return None
    skip_until = max(min_pos, int(len(text) * 0.05))
    later = [m for m in matches if m.start() >= skip_until]
    if not later:
        return matches[-1].start()
    def density(pos):
        window = text[pos:pos + 3000]
        return sum(1 for ch in window if ch.isdigit())
    later.sort(key=lambda m: density(m.start()), reverse=True)
    return later[0].start()


def extract_governance_section(text):
    if not text or len(text) < 5000:
        return text
    chunks = []
    pos = find_best_match(text, r"(?:corporate\s+governance|gouvernance|aufsichtsrat|consiglio\s+di\s+amministrazione|gobierno\s+corporativo|raad\s+van\s+(?:bestuur|commissarissen))")
    if pos is not None:
        chunks.append(("GOVERNANCE", pos, 10000))
    pos = find_best_match(text, r"(?:chief\s+executive\s+officer|directeur\s+g[ée]n[ée]ral|vorstandsvorsitzender|amministratore\s+delegato|consejero\s+delegado|toimitusjohtaja)")
    if pos is not None:
        chunks.append(("CEO", pos, 4000))
    pos = find_best_match(text, r"(?:share(?:holder|holding)\s+structure|actionnariat|aktion[äa]rsstruktur|azionariato|estructura\s+accionarial|aandeelhoudersstructuur|principal\s+shareholders|principaux\s+actionnaires|suurimmat\s+omistajat)")
    if pos is not None:
        chunks.append(("OWNERSHIP", pos, 8000))
    pos = find_best_match(text, r"(?:voting\s+rights|droit\s+de\s+vote|stimmrecht|diritto\s+di\s+voto|derechos\s+de\s+voto|stemrecht|loyalty\s+shares|double\s+voting)")
    if pos is not None:
        chunks.append(("VOTING", pos, 3000))
    pos = find_best_match(text, r"(?:independent\s+directors?|administrateurs?\s+ind[ée]pendants?|unabh[äa]ngige\s+mitglieder|amministratori\s+indipendenti)")
    if pos is not None:
        chunks.append(("INDEPENDENCE", pos, 2500))
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
    cands = [
        os.environ.get("CEREBRAS_API_KEY"),
        os.environ.get("CEREBRAS2_API_KEY"),
        os.environ.get("CEREBRAS3_API_KEY"),
    ]
    return [k for k in cands if k]


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
                    log_line(f"  HTTP 429 backoff 8s")
                    time.sleep(8)
                    continue
                return None, "HTTP 429"
            if code == 402:
                return None, "HTTP 402 payment"
            return None, f"HTTP {code}"
        except Exception as ex:
            if attempt < retries:
                time.sleep(3)
                continue
            return None, f"Ex {type(ex).__name__}"
    return None, "exhausted retries"


def get_company_info(ticker):
    p = V2_ENRICH / f"{ticker.lower()}.json"
    name = ticker
    country = ""
    if p.exists():
        try:
            d = json.loads(p.read_text())
            name = d.get("company_description", {}).get("title") or d.get("name") or ticker
            country = d.get("country") or ""
        except Exception:
            pass
    if not country:
        suffix_map = {
            ".DE": "Germany", ".PA": "France", ".L": "UK",
            ".MI": "Italy", ".AS": "Netherlands", ".BR": "Belgium",
            ".MC": "Spain", ".ST": "Sweden", ".CO": "Denmark",
            ".HE": "Finland", ".OL": "Norway", ".SW": "Switzerland",
            ".LS": "Portugal", ".VI": "Austria",
        }
        for suf, c in suffix_map.items():
            if ticker.endswith(suf):
                country = c
                break
    return name, country


def find_latest_eu_source(ticker):
    base = EU_ROOT / ticker / "annual-text"
    if not base.is_dir():
        return None
    files = sorted(base.glob("*.txt"), key=lambda p: p.stat().st_size, reverse=True)
    return files[0] if files else None


def yfinance_ceo(ticker):
    """Return CEO full name from yfinance.info if available, else None."""
    try:
        import yfinance as yf
        t = yf.Ticker(ticker)
        info = t.info or {}
        officers = info.get("companyOfficers") or []
        for o in officers:
            title = (o.get("title") or "").lower()
            if "chief executive" in title or title.strip() == "ceo" or "group ceo" in title:
                name = o.get("name")
                if name:
                    return name.strip()
        # fallback: first officer if title contains "managing director" or similar
        for o in officers:
            title = (o.get("title") or "").lower()
            if "managing director" in title or "président" in title or "directeur général" in title.lower():
                name = o.get("name")
                if name:
                    return name.strip()
    except Exception as e:
        log_line(f"  yfinance err {ticker}: {e}")
    return None


def normalize_name_for_compare(n):
    if not n:
        return ""
    n = n.lower()
    n = re.sub(r"[.,'’\-]", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    # Drop common titles
    for t in ("mr ", "mrs ", "ms ", "dr ", "prof ", "sir ", "phd"):
        n = n.replace(t, "")
    return n.strip()


def names_match(a, b):
    """Loose match: at least last token matches and one other token matches."""
    if not a or not b:
        return False
    na = normalize_name_for_compare(a).split()
    nb = normalize_name_for_compare(b).split()
    if not na or not nb:
        return False
    # last name match
    if na[-1] != nb[-1]:
        return False
    # at least one other token matches
    overlap = set(na[:-1]) & set(nb[:-1])
    return len(overlap) >= 1 or (len(na) == 1 and len(nb) == 1)


def validate_ceo_name(name):
    if not name or not isinstance(name, str):
        return False, "missing"
    name = name.strip()
    if len(name) < 4 or len(name) > 80:
        return False, f"length {len(name)}"
    if not CEO_NAME_PATTERN.match(name):
        return False, "regex fail"
    lower = name.lower()
    for word in CEO_NAME_BLOCKLIST:
        if word == lower or word in lower.split():
            return False, f"blocklist:{word}"
    return True, "ok"


def validate_extraction(payload, ticker, yf_ceo=None):
    if not isinstance(payload, dict):
        return None, ["not dict"], False
    warnings = []
    out = {}

    ceo_name = payload.get("ceo_name")
    if ceo_name:
        ok, why = validate_ceo_name(ceo_name)
        if ok:
            # Anti-hallucination cross-check with yfinance
            if yf_ceo and not names_match(ceo_name, yf_ceo):
                warnings.append(f"ceo_name mismatch yfinance: extracted={ceo_name!r} yf={yf_ceo!r} — REJECTED")
            else:
                out["ceo_name"] = ceo_name.strip()
                if yf_ceo:
                    out["_ceo_yfinance_match"] = True
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
    if vs in ("one_share_one_vote", "double_voting_rights", "loyalty_shares", "dual_class", "preferred_shares_class"):
        out["voting_structure"] = vs
    vsn = payload.get("voting_structure_note")
    if isinstance(vsn, str) and 5 <= len(vsn) <= 400:
        out["voting_structure_note"] = vsn.strip()
    if "voting_structure" in out and "voting_structure_note" not in out:
        notes_map = {
            "one_share_one_vote": "Structure standard une action = une voix (vérifié via URD).",
            "double_voting_rights": "Droit de vote double pour actions détenues depuis 2+ ans (Loi Florange / similaires, vérifié via URD).",
            "loyalty_shares": "Loyalty shares : droit de vote multiplié pour actionnaires long-terme (vérifié via URD).",
            "dual_class": "Structure dual class : classes d'actions avec droits différents (vérifié via URD).",
            "preferred_shares_class": "Actions ordinaires + actions préférentielles avec droits distincts (vérifié via URD).",
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
                dedup = nm_clean.lower()
                if dedup in seen:
                    continue
                seen.add(dedup)
                clean_entry = {"name": nm_clean, "pct": round(float(pct), 2)}
                if key == "top_capital" and isinstance(entry.get("type"), str):
                    t = entry["type"].lower().strip()
                    if t in ("individual", "institutional", "state", "family"):
                        clean_entry["type"] = t
                clean.append(clean_entry)
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

    out["extraction_status"] = "heuristic_real_eu" if strict_ok else ("heuristic_partial_eu" if partial_ok else "incomplete")
    return out, warnings, partial_ok


def write_enrich(ticker, payload, source_file):
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
    merged["source"] = "urd_eu_cerebras_real_eu"
    merged["source_file"] = source_file
    merged["_source"] = "cerebras_paid_urd_eu_159"
    merged["_source_file"] = source_file
    merged["_extracted_at"] = datetime.now(timezone.utc).isoformat()
    d["overrides_governance"] = merged
    d["_governance_extracted_by_159_at"] = datetime.now(timezone.utc).isoformat()
    p.write_text(json.dumps(d, indent=2, ensure_ascii=False))


def main():
    load_env()
    keys = get_keys()
    if not keys:
        log_line("FATAL: no CEREBRAS keys")
        sys.exit(1)
    if not os.environ.get("PAID_MODE"):
        log_line("PAID_MODE not set. Refusing to run.")
        sys.exit(2)

    key_idx = int(os.environ.get("KEY_INDEX", "0")) % len(keys)
    log_line(f"START mission #159 Phase 1 EU URD governance: {len(TARGETS)} targets, key_idx={key_idx}")

    ok = 0
    no_source = 0
    valid_fail = 0
    api_fails = 0
    yf_rejected = 0
    results = []
    last_t = 0.0

    for i, ticker in enumerate(TARGETS):
        name, country = get_company_info(ticker)
        path = find_latest_eu_source(ticker)
        if not path:
            log_line(f"[{i+1}/{len(TARGETS)}] {ticker}: NO SOURCE")
            no_source += 1
            results.append({"ticker": ticker, "status": "no_source"})
            continue

        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except Exception as e:
            log_line(f"[{i+1}/{len(TARGETS)}] {ticker}: read fail {e}")
            no_source += 1
            results.append({"ticker": ticker, "status": "read_fail"})
            continue

        excerpt = extract_governance_section(text)
        if not excerpt or len(excerpt) < 1000:
            log_line(f"[{i+1}/{len(TARGETS)}] {ticker}: SHORT EXCERPT")
            no_source += 1
            results.append({"ticker": ticker, "status": "short_excerpt"})
            continue

        # yfinance CEO lookup (anti-hallucination)
        yf_ceo = yfinance_ceo(ticker)
        if yf_ceo:
            log_line(f"  {ticker} yfinance CEO: {yf_ceo}")

        elapsed = time.time() - last_t
        if elapsed < SLEEP_BETWEEN_CALLS:
            time.sleep(SLEEP_BETWEEN_CALLS - elapsed)

        prompt = PROMPT.format(ticker=ticker, name=name, country=country or "EU", excerpt=excerpt)
        last_t = time.time()
        result, err = call_cerebras(prompt, keys[key_idx])
        if not result and err and "429" in err:
            for _ in range(len(keys) - 1):
                key_idx = (key_idx + 1) % len(keys)
                time.sleep(2)
                result, err = call_cerebras(prompt, keys[key_idx])
                if result or (err and "429" not in err):
                    break

        if not result:
            log_line(f"[{i+1}/{len(TARGETS)}] {ticker}: API FAIL ({err})")
            api_fails += 1
            results.append({"ticker": ticker, "status": "api_fail", "err": err})
            continue

        clean, warnings, partial_ok = validate_extraction(result, ticker, yf_ceo=yf_ceo)
        had_yf_rejection = any("mismatch yfinance" in w for w in warnings)
        if had_yf_rejection:
            yf_rejected += 1

        if not partial_ok:
            log_line(f"[{i+1}/{len(TARGETS)}] {ticker}: VALIDATION FAIL {warnings}")
            valid_fail += 1
            results.append({"ticker": ticker, "status": "validation_fail", "warnings": warnings})
            continue

        source_rel = str(path.relative_to(PROJECT_ROOT))
        write_enrich(ticker, clean, source_rel)
        log_line(
            f"[{i+1}/{len(TARGETS)}] {ticker}: OK status={clean.get('extraction_status')} "
            f"ceo={clean.get('ceo_name','-')} board={clean.get('board_size','-')} "
            f"vs={clean.get('voting_structure','-')} "
            f"tc={len(clean.get('top_capital',[]))} tv={len(clean.get('top_voting',[]))} "
            f"yf_match={clean.get('_ceo_yfinance_match', False)}"
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
            "yfinance_match": clean.get("_ceo_yfinance_match", False),
        })

        if (i + 1) % 5 == 0:
            key_idx = (key_idx + 1) % len(keys)

    log_line(
        f"END Phase 1 mission #159: ok={ok} no_source={no_source} "
        f"validation_fail={valid_fail} api_fail={api_fails} yf_rejected={yf_rejected}"
    )

    out_file = RESULTS_DIR / f"mission_159_phase1_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    out_file.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mission": 159,
        "phase": 1,
        "summary": {
            "ok": ok,
            "no_source": no_source,
            "validation_fail": valid_fail,
            "api_fail": api_fails,
            "yfinance_rejected": yf_rejected,
            "total": len(TARGETS),
        },
        "results": results,
    }, indent=2, ensure_ascii=False))
    log_line(f"Results: {out_file}")


if __name__ == "__main__":
    main()
