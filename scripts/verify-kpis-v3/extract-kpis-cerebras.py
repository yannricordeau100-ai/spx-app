#!/usr/bin/env python3
"""
CONV-VERIF-KPIS-V3 — Phase 2 extraction Cerebras Qwen-3 235B
Lit /tmp/kpis-v3-candidates-dedup.json, extrait via LLM avec anti-hallucination strict.

Output : src/data/v2-pipeline-enrich/<ticker>.kpis-v3.json (append-only, dédup short)
Sources : sec-data/_manifests/<TICKER>.json puis sec-data/<latest_path>

Rate limit : 3 keys Cerebras free rotation, sleep 3s. Si 429/402 sur 3 keys → SKIP sté.
"""

from __future__ import annotations

import gzip
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import ssl
import urllib.request
import urllib.error

_SSL_CTX = ssl.create_default_context()
try:
    import certifi  # noqa
    _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    _SSL_CTX.check_hostname = False
    _SSL_CTX.verify_mode = ssl.CERT_NONE

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SEC = PROJECT_ROOT / "sec-data"
MANIFESTS = SEC / "_manifests"
ENRICH = PROJECT_ROOT / "src" / "data" / "v2-pipeline-enrich"
V2_PIPELINE = PROJECT_ROOT / "src" / "data" / "v2-pipeline"
CANDIDATES = Path("/tmp/kpis-v3-candidates-dedup.json")

SIGNED_BY = "CONV-VERIF-KPIS-V3"
LOG_PATH = Path("/tmp/conv-verif-kpis-v3/extraction.log")
LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

CEREBRAS_KEYS = [
    os.environ.get("CEREBRAS_API_KEY", ""),
    os.environ.get("CEREBRAS2_API_KEY", ""),
    os.environ.get("CEREBRAS3_API_KEY", ""),
]
CEREBRAS_KEYS = [k for k in CEREBRAS_KEYS if k]
CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
CEREBRAS_MODEL = "qwen-3-235b-a22b-instruct-2507"

MAX_SOURCE_CHARS = 30_000  # cap context per source (Cerebras rate-limit sensitive to large prompts)

current_key_idx = 0
quota_exhausted_keys: set[int] = set()
key_cooldown_until: dict[int, float] = {}  # key_idx -> unix ts when can retry
KEY_COOLDOWN_SEC = 1800  # 30 minutes


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG_PATH, "a") as f:
        f.write(line + "\n")


def load_manifest(ticker: str) -> dict | None:
    p = MANIFESTS / f"{ticker.upper()}.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


def read_source_text(rel_path: str, max_chars: int = MAX_SOURCE_CHARS) -> str:
    full = SEC / rel_path
    if not full.exists():
        return ""
    try:
        if str(full).endswith(".gz"):
            with gzip.open(full, "rt", encoding="utf-8", errors="ignore") as f:
                txt = f.read(max_chars * 4)
        else:
            with open(full, "r", encoding="utf-8", errors="ignore") as f:
                txt = f.read(max_chars * 4)
        txt = re.sub(r"<[^>]+>", " ", txt)
        txt = re.sub(r"\s+", " ", txt)
        return txt[:max_chars]
    except Exception:
        return ""


def gather_sources(ticker: str, manifest: dict, cand_sources_hit: list[str]) -> list[tuple[str, str]]:
    """Returns list of (rel_path, text). Combines scan hits + 2 annual N-1/N-2."""
    paths: list[str] = []
    for p in cand_sources_hit or []:
        if p and p not in paths:
            paths.append(p)

    present = (manifest or {}).get("present", {}) or {}
    # Add annual N-1/N-2 paths
    annual = present.get("annual_report", {}) or {}
    for p in annual.get("paths", []) or []:
        if p and p not in paths:
            paths.append(p)
    latest = annual.get("latest_path")
    if isinstance(latest, str) and latest not in paths:
        paths.append(latest)

    # Half-year for EU
    hy = present.get("half_year_report", {}) or {}
    for p in hy.get("paths", []) or []:
        if p and p not in paths:
            paths.append(p)

    paths = paths[:5]
    out: list[tuple[str, str]] = []
    for rp in paths:
        txt = read_source_text(rp)
        if txt and len(txt) > 1000:
            out.append((rp, txt))
    return out


def get_company_names(ticker: str) -> list[str]:
    """Get canonical company names for mention count check."""
    names = [ticker.upper()]
    vfile = V2_PIPELINE / f"{ticker.lower()}.json"
    if vfile.exists():
        try:
            d = json.loads(vfile.read_text())
            for k in ("name", "name_fr", "name_en", "company_name"):
                v = d.get(k)
                if isinstance(v, str) and len(v) > 2:
                    names.append(v)
        except Exception:
            pass
    return names


def cerebras_call(prompt_system: str, prompt_user: str) -> tuple[Optional[str], Optional[str]]:
    """Returns (content, error_kind). error_kind in {'quota','transient','fatal',None}."""
    global current_key_idx
    now = time.time()
    # Expire cooldowns
    for k_idx in list(key_cooldown_until.keys()):
        if key_cooldown_until[k_idx] <= now:
            del key_cooldown_until[k_idx]
            quota_exhausted_keys.discard(k_idx)
    if len(quota_exhausted_keys) >= len(CEREBRAS_KEYS):
        return None, "quota"
    # Try up to N times rotating keys
    for _ in range(len(CEREBRAS_KEYS)):
        if current_key_idx in quota_exhausted_keys:
            current_key_idx = (current_key_idx + 1) % len(CEREBRAS_KEYS)
            continue
        key = CEREBRAS_KEYS[current_key_idx]
        payload = {
            "model": CEREBRAS_MODEL,
            "messages": [
                {"role": "system", "content": prompt_system},
                {"role": "user", "content": prompt_user},
            ],
            "temperature": 0.0,
            "max_tokens": 800,
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            CEREBRAS_URL,
            data=data,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "User-Agent": "curl/7.79.1",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60, context=_SSL_CTX) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            content = body.get("choices", [{}])[0].get("message", {}).get("content", "")
            return content, None
        except urllib.error.HTTPError as e:
            code = e.code
            if code in (429, 402):
                log(f"  HTTP {code} on key idx={current_key_idx} → cooldown {KEY_COOLDOWN_SEC}s")
                quota_exhausted_keys.add(current_key_idx)
                key_cooldown_until[current_key_idx] = time.time() + KEY_COOLDOWN_SEC
                current_key_idx = (current_key_idx + 1) % len(CEREBRAS_KEYS)
                time.sleep(5)
                continue
            if code in (500, 502, 503, 504):
                log(f"  HTTP {code} transient, sleep 10s")
                time.sleep(10)
                continue
            try:
                err_body = e.read().decode("utf-8")[:200]
            except Exception:
                err_body = ""
            log(f"  HTTP {code} fatal: {err_body}")
            return None, "fatal"
        except (urllib.error.URLError, TimeoutError) as e:
            log(f"  Network error: {e}, sleep 10s")
            time.sleep(10)
            continue
        except Exception as e:
            log(f"  Unexpected: {type(e).__name__}: {e}")
            return None, "fatal"
    return None, "quota"


PROMPT_SYSTEM = (
    "Tu es analyste financier rigoureux. Tu n'inventes JAMAIS. "
    "Si le KPI demandé n'est pas chiffré explicitement dans le filing fourni, "
    "tu réponds found=false. Tu cites mot-à-mot."
)


def build_user_prompt(ticker: str, kpi_short: str, source_excerpts: list[tuple[str, str]]) -> str:
    excerpts_blob = ""
    # Cap total context ~ 25k chars across sources (Cerebras free tier sensitive)
    budget = 25_000
    for rp, txt in source_excerpts:
        if budget <= 0:
            break
        chunk = txt[:budget]
        excerpts_blob += f"\n\n=== SOURCE: {rp} ===\n{chunk}"
        budget -= len(chunk)

    return f"""Société : {ticker}
KPI à extraire : "{kpi_short}"

Retourne JSON STRICT (aucun texte autour) :
{{
  "found": true|false,
  "value": <number ou null>,
  "unit": "<chaîne ex '$', 'Mds $', '%', 'k', 'unités'>",
  "history": [<3 à 5 valeurs annuelles ascendantes>],
  "source_quote": "<phrase EXACTE du filing, 20 mots max>"
}}

RÈGLES :
- Si valeur PAS chiffrée explicitement dans le filing → found=false
- Si doute → found=false (jamais inventer)
- history : MAX 5 valeurs annuelles ascendantes (plus ancien -> plus récent)
- source_quote : MOT À MOT depuis le filing (recopie exacte)
- value DOIT apparaître textuellement dans source_quote

FILING(S) :
{excerpts_blob}
"""


def parse_json_lenient(s: str) -> dict | None:
    if not s:
        return None
    # Strip code fences
    s = s.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s)
        s = re.sub(r"\s*```\s*$", "", s)
    # Find first { and last }
    i = s.find("{")
    j = s.rfind("}")
    if i < 0 or j < 0 or j <= i:
        return None
    try:
        return json.loads(s[i : j + 1])
    except Exception:
        return None


def validate_extraction(
    parsed: dict,
    ticker: str,
    canonical_names: list[str],
    full_source_text: str,
) -> tuple[bool, str]:
    """Returns (ok, reason_if_reject)."""
    if not isinstance(parsed, dict):
        return False, "_extraction_invalid_json"
    found = parsed.get("found")
    if found is False:
        return False, "_not_found_silent"  # silent skip
    if found is not True:
        return False, "_extraction_invalid_found"
    value = parsed.get("value")
    if value is None:
        return False, "_value_null"
    source_quote = parsed.get("source_quote", "") or ""
    if not isinstance(source_quote, str):
        return False, "_quote_invalid"
    quote_words = source_quote.split()
    if len(quote_words) < 5:
        return False, "_quote_too_short"
    # value must appear in source_quote (string form, tolerate comma/dot)
    val_str = str(value)
    val_clean = val_str.replace(",", ".").rstrip("0").rstrip(".")
    quote_clean = source_quote.replace(",", ".")
    if val_str not in source_quote and val_clean not in quote_clean:
        return False, "_value_not_in_quote"
    # mention count canonical name >= 3
    text_lower = full_source_text.lower()
    max_mentions = 0
    for n in canonical_names:
        n_lower = n.lower().strip()
        if len(n_lower) < 2:
            continue
        c = text_lower.count(n_lower)
        if c > max_mentions:
            max_mentions = c
    if max_mentions < 3:
        return False, "_no_company_mention"
    return True, ""


def main() -> int:
    if not CEREBRAS_KEYS:
        log("FATAL: no CEREBRAS keys in env")
        return 2
    if not CANDIDATES.exists():
        log(f"FATAL: candidates file not found: {CANDIDATES}")
        return 2

    data = json.loads(CANDIDATES.read_text())
    stes = data.get("candidates", [])
    log(f"Loaded {len(stes)} stés, {data.get('total')} candidates total")

    stats = {
        "ok": 0,
        "rejected_quote_too_short": 0,
        "rejected_value_not_in_quote": 0,
        "rejected_no_company_mention": 0,
        "rejected_value_null": 0,
        "rejected_invalid": 0,
        "not_found_silent": 0,
        "skipped_no_manifest": 0,
        "skipped_no_source": 0,
        "skipped_quota_exhausted": 0,
        "calls": 0,
    }

    ENRICH.mkdir(parents=True, exist_ok=True)

    # Optional CLI: --start N --end M (slice)
    start = 0
    end = len(stes)
    args = sys.argv[1:]
    if "--start" in args:
        start = int(args[args.index("--start") + 1])
    if "--end" in args:
        end = int(args[args.index("--end") + 1])
    if "--limit" in args:
        end = start + int(args[args.index("--limit") + 1])
    log(f"Processing slice [{start}:{end}]")

    for ste_idx, ste in enumerate(stes[start:end], start=start):
        ticker = ste["ticker"]
        cands = ste["candidates"]

        if len(quota_exhausted_keys) >= len(CEREBRAS_KEYS):
            log(f"[{ste_idx}/{end}] {ticker}: QUOTA EXHAUSTED all keys → SKIP")
            stats["skipped_quota_exhausted"] += 1
            # Write skip marker
            out_path = ENRICH / f"{ticker.lower()}.kpis-v3.json"
            existing = {}
            if out_path.exists():
                try:
                    existing = json.loads(out_path.read_text())
                except Exception:
                    existing = {}
            existing.setdefault("_skipped_reasons", []).append({
                "reason": "_quota_exhausted",
                "at": datetime.now(timezone.utc).isoformat(),
            })
            out_path.write_text(json.dumps(existing, indent=2, ensure_ascii=False))
            continue

        manifest = load_manifest(ticker)
        if not manifest:
            log(f"[{ste_idx}/{end}] {ticker}: no manifest → skip")
            stats["skipped_no_manifest"] += 1
            continue

        canonical_names = get_company_names(ticker)
        log(f"[{ste_idx}/{end}] {ticker}: {len(cands)} candidates, names={canonical_names[:2]}")

        # Load all sources once, reused per KPI
        # Use first candidate's sources_hit as primary, then add annuals
        sources_hit_union: list[str] = []
        for c in cands:
            for p in c.get("sources_hit") or []:
                if p not in sources_hit_union:
                    sources_hit_union.append(p)

        sources = gather_sources(ticker, manifest, sources_hit_union)
        if not sources:
            log(f"  {ticker}: no readable sources → skip")
            stats["skipped_no_source"] += 1
            continue

        full_text = " ".join(t for _, t in sources)

        out_path = ENRICH / f"{ticker.lower()}.kpis-v3.json"
        existing = {}
        if out_path.exists():
            try:
                existing = json.loads(out_path.read_text())
            except Exception:
                existing = {}

        existing_shorts = {k["short"] for k in (existing.get("kpis_v3", []) or []) if isinstance(k, dict)}
        rejected_log = existing.get("_rejected", [])
        kpis_out = existing.get("kpis_v3", [])

        for c in cands:
            kpi_short = c["name"]
            if kpi_short in existing_shorts:
                continue

            stats["calls"] += 1
            content, err = cerebras_call(
                PROMPT_SYSTEM,
                build_user_prompt(ticker, kpi_short, sources),
            )
            time.sleep(5)

            if err == "quota":
                log(f"  {ticker}/{kpi_short}: quota exhausted")
                break  # break inner, will skip remaining at top of next iter
            if err == "fatal" or content is None:
                rejected_log.append({"short": kpi_short, "reason": "_extraction_failed", "at": datetime.now(timezone.utc).isoformat()})
                continue

            parsed = parse_json_lenient(content)
            if not parsed:
                rejected_log.append({"short": kpi_short, "reason": "_invalid_json", "at": datetime.now(timezone.utc).isoformat()})
                stats["rejected_invalid"] += 1
                continue

            ok, reason = validate_extraction(parsed, ticker, canonical_names, full_text)
            if not ok:
                if reason == "_not_found_silent":
                    stats["not_found_silent"] += 1
                else:
                    rejected_log.append({
                        "short": kpi_short,
                        "reason": reason,
                        "at": datetime.now(timezone.utc).isoformat(),
                        "quote": parsed.get("source_quote", "")[:200],
                        "value": parsed.get("value"),
                    })
                    if reason in stats:
                        stats[reason.lstrip("_").replace("rejected_", "")] += 1
                    if reason == "_quote_too_short":
                        stats["rejected_quote_too_short"] += 1
                    elif reason == "_value_not_in_quote":
                        stats["rejected_value_not_in_quote"] += 1
                    elif reason == "_no_company_mention":
                        stats["rejected_no_company_mention"] += 1
                    elif reason == "_value_null":
                        stats["rejected_value_null"] += 1
                    else:
                        stats["rejected_invalid"] += 1
                continue

            history = parsed.get("history") or []
            if not isinstance(history, list):
                history = []
            history = [h for h in history if isinstance(h, (int, float))][:5]

            src_quote = parsed.get("source_quote", "")[:300]
            doc_path = sources[0][0]
            kpis_out.append({
                "short": kpi_short,
                "name_fr": kpi_short,
                "name_en": kpi_short,
                "value": parsed.get("value"),
                "unit": parsed.get("unit", ""),
                "history": history,
                "period_type": "annual",
                "source": f"{doc_path} :: {src_quote}",
                "_verified_at": datetime.now(timezone.utc).isoformat(),
                "_extraction_method": "cerebras-qwen-3-235b",
            })
            existing_shorts.add(kpi_short)
            stats["ok"] += 1
            log(f"  ✓ {ticker}/{kpi_short} = {parsed.get('value')} {parsed.get('unit','')}")

        # Save per-sté
        out = {
            "ticker": ticker.upper(),
            "_extracted_at": datetime.now(timezone.utc).isoformat(),
            "_signed_by": SIGNED_BY,
            "kpis_v3": kpis_out,
        }
        if rejected_log:
            out["_rejected"] = rejected_log
        if "_skipped_reasons" in existing:
            out["_skipped_reasons"] = existing["_skipped_reasons"]
        out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False))

    log(f"DONE. Stats: {json.dumps(stats, indent=2)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
