#!/usr/bin/env python3
"""
enrich-top-voting-capital.py — Audit + enrich governance.top_voting & top_capital
pour les 549 stés publishables (Yann checklist g).

Pipeline :
1. AUDIT pre-state des 549 publishable (top_voting >=3 + top_capital >=3 ?)
2. PASS A — yfinance institutional_holders pour top_capital (US/ADR/EU disponible)
3. PASS B — Cerebras Qwen-3 235B sur annual-text EU + DEF14A US pour top_voting
            ou pour stés où PASS A insuffisant
4. AUDIT post-state + écriture v2-pipeline-enrich/<ticker>.json

Type ∈ {institutionnel, particulier, insider, fondateur, fonds_souverain}

ENV : CEREBRAS_API_KEY, CEREBRAS2_API_KEY, CEREBRAS3_API_KEY (rotation 3 procs)
Multi-procs : 3 // (KEY_INDEX=0|1|2, NUM_PROCS=3)

Usage :
  python3 scripts/enrich-top-voting-capital.py --audit-only
  python3 scripts/enrich-top-voting-capital.py --pass-a   # yfinance
  python3 scripts/enrich-top-voting-capital.py --pass-b   # Cerebras
  python3 scripts/enrich-top-voting-capital.py --all
"""
import argparse
import gzip
import json
import os
import re
import ssl
import subprocess
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

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPELINE = PROJECT_ROOT / "src/data/v2-pipeline"
ENRICH = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
PUBLISHABLE = PROJECT_ROOT / "src/data/v1-9-publishable.json"
SEC_DEF14A = PROJECT_ROOT / "sec-data/cat1-us/DEF14A"
SEC_EU = PROJECT_ROOT / "sec-data/cat3-european"
SEC_CA = PROJECT_ROOT / "sec-data/cat-canadian"
AUDIT_PRE = PROJECT_ROOT / "src/data/_audit-top-voting-capital-pre.json"
AUDIT_POST = PROJECT_ROOT / "src/data/_audit-top-voting-capital-post.json"
LOG = PROJECT_ROOT / ".conv-state/CONV-CONCEPTS-top-voting-capital.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
MODEL_ID = "qwen-3-235b-a22b-instruct-2507"
SLEEP_BASE = float(os.environ.get("SLEEP_BASE", "5.0"))
CTX_LEN = int(os.environ.get("CTX_LEN", "3000"))

VALID_TYPES = {"institutionnel", "particulier", "insider", "fondateur", "fonds_souverain"}

# Known sovereign wealth funds (for type classification)
SOVEREIGN_KEYWORDS = [
    "norges bank", "norway government", "government of singapore",
    "gic private", "temasek", "kuwait investment authority", "kia",
    "qatar investment authority", "qia", "adia", "abu dhabi investment",
    "mubadala", "saudi public investment", "pif", "china investment corp",
    "cic", "korea investment corp", "kic", "future fund",
]

# Known dual-class stocks (top_voting differs from top_capital)
DUAL_CLASS = {
    "GOOG", "GOOGL", "META", "FB", "BRK.A", "BRK.B", "BRK-A", "BRK-B",
    "NWS", "NWSA", "FOX", "FOXA", "DIS", "LYV", "BF.A", "BF.B", "BF-A", "BF-B",
    "UA", "UAA", "PARA", "LBRDA", "LBRDK", "LSXMA", "LSXMK", "NYT",
    "SPOT", "SNAP", "ZG", "Z", "PINS", "RBLX", "DOCS", "ABNB",
    "PLTR", "U", "RIVN", "COIN", "DDOG", "CRWD", "ZS", "OKTA", "SHOP",
    "FERG", "EL", "TJX", "GME", "AMC",
}


def log_line(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG, "a") as f:
            f.write(line + "\n")
    except Exception:
        pass


def load_env():
    env = PROJECT_ROOT / ".env.local"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        if k.strip() and not os.environ.get(k.strip()):
            os.environ[k.strip()] = v.strip().strip('"').strip("'")


def get_api_key(idx_override=None):
    idx = idx_override if idx_override is not None else int(os.environ.get("KEY_INDEX", "0"))
    keys = [
        os.environ.get("CEREBRAS_API_KEY"),
        os.environ.get("CEREBRAS2_API_KEY"),
        os.environ.get("CEREBRAS3_API_KEY"),
    ]
    keys = [k for k in keys if k]
    if not keys:
        return None
    return keys[idx % len(keys)]


def ram_free_mb():
    try:
        out = subprocess.check_output(["vm_stat"], text=True, timeout=5)
        m = re.search(r"Pages free:\s+(\d+)", out)
        if not m:
            return None
        return int(m.group(1)) * 16 / 1024
    except Exception:
        return None


def is_eu_ticker(t):
    return any(s in t for s in ('.DE', '.PA', '.MI', '.SW', '.AS', '.MC', '.L', '.ST', '.OL', '.HE', '.CO', '.LS', '.BR', '.WA', '.IR', '.VI'))


def is_asian_ticker(t):
    return any(s in t for s in ('.HK', '.T', '.KS', '.SS', '.SZ', '.SI', '.AX'))


def load_pipeline(ticker):
    """Load merged data from v2-pipeline + v2-pipeline-enrich."""
    tl = ticker.lower()
    base = PIPELINE / f"{tl}.json"
    enr = ENRICH / f"{tl}.json"
    data = {}
    for f in (base, enr):
        if f.exists():
            try:
                d = json.loads(f.read_text())
                if isinstance(d, dict):
                    for k, v in d.items():
                        if k == "governance" and isinstance(v, dict):
                            data.setdefault("governance", {})
                            data["governance"].update(v)
                        else:
                            data[k] = v
            except Exception:
                pass
    return data


def get_gov_status(data):
    """Return (top_voting_count, top_capital_count, has_note)."""
    g = (data or {}).get("governance") or {}
    tv = g.get("top_voting") if isinstance(g.get("top_voting"), list) else []
    tc = g.get("top_capital") if isinstance(g.get("top_capital"), list) else []
    return len(tv), len(tc), bool(g.get("voting_structure_note") or g.get("voting_structure"))


def audit(label, tickers):
    counts = {
        "total": len(tickers),
        "voting_ok": 0,
        "capital_ok": 0,
        "both_ok": 0,
        "unavailable_adr": 0,
        "missing": [],
    }
    for t in tickers:
        d = load_pipeline(t)
        tv, tc, _ = get_gov_status(d)
        g = (d or {}).get("governance") or {}
        if g.get("top_disclosure") == "unavailable_adr":
            counts["unavailable_adr"] += 1
            continue
        if tv >= 3:
            counts["voting_ok"] += 1
        if tc >= 3:
            counts["capital_ok"] += 1
        if tv >= 3 and tc >= 3:
            counts["both_ok"] += 1
        else:
            counts["missing"].append({"t": t, "tv": tv, "tc": tc})
    pct_ko = 100.0 * (1 - counts["both_ok"] / max(counts["total"], 1))
    log_line(f"AUDIT {label}: total={counts['total']} both_ok={counts['both_ok']} voting_ok={counts['voting_ok']} capital_ok={counts['capital_ok']} unavail_adr={counts['unavailable_adr']} %KO={pct_ko:.1f}%")
    return counts


def classify_holder(name):
    """Heuristic type from name."""
    n = name.lower()
    for k in SOVEREIGN_KEYWORDS:
        if k in n:
            return "fonds_souverain"
    # Institutional indicators
    inst = ["blackrock", "vanguard", "state street", "fidelity", "fmr", "geode",
            "t. rowe", "t.rowe", "trowe", "northern trust", "jpmorgan", "jp morgan",
            "morgan stanley", "goldman sachs", "ubs", "credit suisse", "deutsche bank",
            "bank of america", "wellington", "capital research", "capital world",
            "capital group", "amundi", "axa", "allianz global", "invesco",
            "schroders", "schroeders", "legal & general", "l&g", "abrdn",
            "aberdeen", "standard life", "aviva", "natixis", "bnp paribas",
            "citi", "hsbc", "credit agricole", "rothschild", "lazard",
            "berkshire hathaway", "soros", "bridgewater", "renaissance",
            "two sigma", "millennium", "citadel", "point72", "elliott",
            "third point", "icahn", "pershing square", "trian", "starboard",
            "dodge & cox", "franklin", "templeton", "pimco", "blackstone",
            "kkr", "carlyle", "apollo", "tpg", "advent", "warburg",
            "silver lake", "general atlantic", "hellman", "thoma bravo",
            "permira", "cvc", "eqt", "bain capital", "ardian",
            ".inc", " inc", " ltd", " llc", " corp", " sa ", " sas",
            "trust", "asset management", "management llc", " mgmt",
            "investment", "fund", "capital", "partners", "advisors",
            "advisers", "holdings", "wealth", "securities", "bank",
            "pension", "retirement", "insurance"]
    for k in inst:
        if k in n:
            return "institutionnel"
    # If short name with comma / no entity keyword → likely a person (insider)
    if "," in name and len(name.split()) <= 4:
        return "insider"
    return "institutionnel"  # safe default


def normalize_holder_name(name):
    """Clean up yfinance holder names (dedupe Vanguard/Blackrock variations)."""
    n = name.strip()
    nl = n.lower()
    if "vanguard" in nl:
        return "The Vanguard Group"
    if "blackrock" in nl:
        return "BlackRock, Inc."
    if "state street" in nl:
        return "State Street Corporation"
    if "geode" in nl:
        return "Geode Capital Management"
    if "fmr" in nl or "fidelity" in nl:
        return "FMR LLC (Fidelity)"
    if "morgan stanley" in nl:
        return "Morgan Stanley"
    if "jpmorgan" in nl or "jp morgan" in nl or "jpmorgan chase" in nl:
        return "JPMorgan Chase & Co."
    if "t. rowe" in nl or "t.rowe" in nl or "trowe" in nl or "price (t.rowe)" in nl:
        return "T. Rowe Price"
    if "berkshire hathaway" in nl:
        return "Berkshire Hathaway"
    if "norges bank" in nl:
        return "Norges Bank Investment Management"
    return n


# ============================================================
# PASS A : yfinance enrichment
# ============================================================
def pass_a_yfinance(tickers):
    try:
        import yfinance as yf
    except ImportError:
        log_line("❌ yfinance not installed — pip install yfinance")
        return {}
    results = {"ok": [], "fail": [], "partial": []}
    for i, ticker in enumerate(tickers):
        if i and i % 25 == 0:
            log_line(f"  yfinance [{i}/{len(tickers)}] ok={len(results['ok'])} fail={len(results['fail'])} partial={len(results['partial'])}")
        try:
            t = yf.Ticker(ticker)
            ih = t.institutional_holders
        except Exception as e:
            results["fail"].append({"ticker": ticker, "err": f"ex_{type(e).__name__}"})
            continue
        if ih is None or ih.empty or "Holder" not in ih.columns:
            results["fail"].append({"ticker": ticker, "err": "no_inst_holders"})
            continue

        # Aggregate by normalized name
        agg = {}
        for _, row in ih.iterrows():
            name = normalize_holder_name(str(row["Holder"]))
            pct = float(row.get("pctHeld") or 0) * 100  # yf returns fraction
            if pct <= 0:
                continue
            agg[name] = agg.get(name, 0) + pct

        if not agg:
            results["fail"].append({"ticker": ticker, "err": "no_valid_pct"})
            continue

        sorted_h = sorted(agg.items(), key=lambda x: -x[1])[:3]
        top_capital = []
        for name, pct in sorted_h:
            entry = {
                "name": name,
                "type": classify_holder(name),
                "stake_pct": round(pct, 2),
            }
            top_capital.append(entry)

        # Voting : default to same as capital + 1-share-1-vote note
        # If dual-class, mark differently (Cerebras pass will refine if data avail)
        ticker_upper = ticker.upper().replace("-", ".")
        is_dual = ticker_upper in DUAL_CLASS or ticker_upper.replace(".", "-") in DUAL_CLASS

        top_voting = list(top_capital)  # by default
        if is_dual:
            voting_note = "Dual-class shares (classes différentes) — top_voting reflète stake économique ; vérifier DEF14A pour droits de vote réels."
        else:
            voting_note = "OK 1-share-1-vote"

        merge_enrich(ticker, {
            "governance": {
                "top_capital": top_capital,
                "top_voting": top_voting,
                "voting_structure_note": voting_note,
                "_top_source": "yfinance",
                "_top_enriched_at": datetime.now(timezone.utc).isoformat(),
                "_top_dual_class_flag": is_dual,
            }
        })

        if len(top_capital) >= 3:
            results["ok"].append(ticker)
        else:
            results["partial"].append({"ticker": ticker, "count": len(top_capital)})
        # Light rate-limit to avoid Yahoo blocks
        time.sleep(0.2)

    return results


def merge_enrich(ticker, addition):
    """Merge addition.governance into v2-pipeline-enrich/<ticker>.json."""
    tl = ticker.lower()
    f = ENRICH / f"{tl}.json"
    if f.exists():
        try:
            data = json.loads(f.read_text())
        except Exception:
            data = {}
    else:
        data = {}
    if not isinstance(data, dict):
        data = {}

    for k, v in addition.items():
        if k == "governance" and isinstance(v, dict):
            existing = data.get("governance") if isinstance(data.get("governance"), dict) else {}
            existing.update(v)
            data["governance"] = existing
        else:
            data[k] = v
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(data, indent=2, ensure_ascii=False))


# ============================================================
# PASS B : Cerebras LLM for EU + voting refinement
# ============================================================
PROMPT_TOP = """Analyste actionnariat. Société : {name} ({ticker}).
Extrais TOP 3 holders : (a) droits de vote (b) capital. JSON strict :
{{"top_voting":[{{"name":"X","stake_pct":12.5,"type":"institutionnel","role":null}}],"top_capital":[...],"voting_structure_note":"OK 1-share-1-vote"}}
Règles : stake_pct 0-100. type ∈ institutionnel|particulier|insider|fondateur|fonds_souverain. role = CEO/Fondateur uniquement pour insiders. JAMAIS inventer. Si dual-class : voting_structure_note décrit (ex "classes A/B").
Section :
---
{ctx}
---"""


def find_section_us_def14a(text):
    chunks = []
    def all_pos(pat):
        return [m.start() for m in re.finditer(pat, text, re.I)]
    pat = r"(?:beneficial\s+ownership|security\s+ownership\s+of\s+certain|principal\s+(?:stock)?holders?|five\s*%\s*holders|stock\s+ownership\s+of\s+(?:directors|management))"
    for p in all_pos(pat)[:1]:
        chunks.append((p, 3000))
    if not chunks:
        for p in all_pos(r"(?:directors?\s+and\s+(?:executive\s+)?officers|named\s+executive\s+officers)")[:1]:
            chunks.append((p, 3000))
    if not chunks:
        return text[:CTX_LEN]
    chunks.sort()
    parts = []
    for start, budget in chunks:
        parts.append(text[start:start + budget])
    return "\n\n".join(parts)[:CTX_LEN]


def find_section_eu(text):
    chunks = []
    def all_pos(pat):
        return [m.start() for m in re.finditer(pat, text, re.I)]
    pat = r"(?:shareholder\s+structure|principal\s+shareholders|major\s+shareholders|substantial\s+shareholders|ownership\s+structure|share\s+capital\s+and\s+shareholders|aktion[aä]r(?:s|en)|structure\s+(?:du\s+)?capital|actionnariat|azionariato|estructura\s+accionarial|aandeelhouders)"
    for p in all_pos(pat)[:1]:
        chunks.append((p, 3000))
    if not chunks:
        for p in all_pos(r"(?:voting\s+rights|droits\s+de\s+vote|stimmrechte)")[:1]:
            chunks.append((p, 3000))
    if not chunks:
        return text[:CTX_LEN]
    chunks.sort()
    parts = []
    for start, budget in chunks:
        parts.append(text[start:start + budget])
    return "\n\n".join(parts)[:CTX_LEN]


HTML_TAG = re.compile(r"<[^>]+>")
WS = re.compile(r"\s+")


def strip_html(html):
    text = HTML_TAG.sub(" ", html)
    text = re.sub(r"&nbsp;|&#160;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&#\d+;|&[a-z]+;", " ", text)
    return WS.sub(" ", text).strip()


def find_us_def14a(ticker):
    if not SEC_DEF14A.exists():
        return None
    cands = []
    for ydir in sorted([d for d in SEC_DEF14A.iterdir() if d.is_dir()], reverse=True):
        for f in ydir.glob(f"{ticker.upper()}_*.htm.gz"):
            cands.append((ydir.name, f.name, f))
    if not cands:
        return None
    cands.sort(reverse=True)
    return cands[0][2]


def find_eu_annual(ticker):
    d = SEC_EU / ticker / "annual-text"
    if not d.exists():
        return None
    cands = list(d.glob("*.txt"))
    if not cands:
        return None
    return max(cands, key=lambda f: f.stat().st_size)


def read_source(ticker):
    """Returns (text, kind)."""
    if is_eu_ticker(ticker) or is_asian_ticker(ticker):
        f = find_eu_annual(ticker)
        if f:
            try:
                return f.read_text(errors="ignore"), "eu"
            except Exception:
                return None, "read_err"
        return None, "no_eu_txt"
    # Try US DEF14A
    f = find_us_def14a(ticker)
    if f:
        try:
            with gzip.open(f, "rt", errors="ignore") as g:
                return strip_html(g.read()), "us"
        except Exception:
            return None, "read_err"
    return None, "no_def14a"


def call_cerebras(prompt, api_key, retries=2):
    body = json.dumps({
        "model": MODEL_ID,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 1200,
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
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=120) as r:
                resp = json.loads(r.read())
            content = resp["choices"][0]["message"]["content"]
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
            try:
                return json.loads(content), None
            except json.JSONDecodeError:
                m = re.search(r"\{.*\}", content, re.DOTALL)
                if m:
                    try:
                        return json.loads(m.group(0)), None
                    except json.JSONDecodeError:
                        pass
                return None, "json_parse"
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries:
                time.sleep(12 + attempt * 8)
                continue
            return None, f"http_{e.code}"
        except Exception as ex:
            if attempt < retries:
                time.sleep(5)
                continue
            return None, f"ex_{type(ex).__name__}"
    return None, "exhausted"


def sanitize_holders(holders, max_len=3):
    """Filter & validate holder entries."""
    if not isinstance(holders, list):
        return []
    out = []
    for h in holders[:max_len]:
        if not isinstance(h, dict):
            continue
        name = (h.get("name") or "").strip()
        pct = h.get("stake_pct")
        if not name or pct is None:
            continue
        try:
            pct = float(pct)
        except (ValueError, TypeError):
            continue
        if pct <= 0 or pct > 100:
            continue
        typ = (h.get("type") or "").lower().strip()
        if typ not in VALID_TYPES:
            typ = classify_holder(name)
        entry = {"name": name, "type": typ, "stake_pct": round(pct, 2)}
        role = h.get("role")
        if role and isinstance(role, str) and role.strip().lower() not in ("null", "none", ""):
            entry["role"] = role.strip()
        out.append(entry)
    return out


def pass_b_cerebras(tickers):
    api_key = get_api_key()
    if not api_key:
        log_line("❌ NO Cerebras key")
        return {}
    key_idx = int(os.environ.get("KEY_INDEX", "0"))
    nproc = int(os.environ.get("NUM_PROCS", "1"))
    # Split by KEY_INDEX
    mine = [t for i, t in enumerate(tickers) if i % nproc == key_idx]
    log_line(f"PASS B Cerebras key={key_idx}/{nproc} : {len(mine)} stés")

    results = {"ok": [], "partial": [], "fail_no_src": [], "fail_llm": [], "unavailable_adr": []}
    last_call = 0.0
    last_ram = 0.0
    sleep_mult = 1.0

    for i, ticker in enumerate(mine):
        now = time.time()
        if now - last_ram > 30:
            free = ram_free_mb()
            if free is not None:
                if free < 50:
                    sleep_mult = 3.0
                elif free < 100:
                    sleep_mult = 2.0
                else:
                    sleep_mult = 1.0
            last_ram = now

        sleep_needed = SLEEP_BASE * sleep_mult
        elapsed = time.time() - last_call
        if elapsed < sleep_needed:
            time.sleep(sleep_needed - elapsed)
        last_call = time.time()

        if i and i % 10 == 0:
            log_line(f"  cerebras k{key_idx} [{i}/{len(mine)}] ok={len(results['ok'])} fail_src={len(results['fail_no_src'])} fail_llm={len(results['fail_llm'])} adr={len(results['unavailable_adr'])}")

        text, kind = read_source(ticker)
        if not text:
            # Mark as ADR unavailable if asian/no source
            if is_asian_ticker(ticker) or kind in ("no_def14a", "no_eu_txt"):
                merge_enrich(ticker, {"governance": {"top_disclosure": "unavailable_adr", "_top_source": "unavailable"}})
                results["unavailable_adr"].append(ticker)
            else:
                results["fail_no_src"].append({"ticker": ticker, "reason": kind})
            continue

        if kind == "us":
            ctx = find_section_us_def14a(text)
        else:
            ctx = find_section_eu(text)

        data = load_pipeline(ticker)
        name = data.get("name") or data.get("companyName") or ticker
        prompt = PROMPT_TOP.format(name=name, ticker=ticker, ctx=ctx)

        result, err = call_cerebras(prompt, api_key)
        if not result or not isinstance(result, dict):
            results["fail_llm"].append({"ticker": ticker, "err": err or "no_result"})
            continue

        tv = sanitize_holders(result.get("top_voting"))
        tc = sanitize_holders(result.get("top_capital"))
        note = result.get("voting_structure_note") or ""
        if not isinstance(note, str):
            note = ""
        # If LLM only returned one block, mirror it for the other (single-class case)
        if tv and not tc:
            tc = list(tv)
        if tc and not tv:
            tv = list(tc)

        if not tv and not tc:
            results["fail_llm"].append({"ticker": ticker, "err": "empty_holders"})
            continue

        merge_enrich(ticker, {
            "governance": {
                "top_voting": tv,
                "top_capital": tc,
                "voting_structure_note": note or "OK 1-share-1-vote",
                "_top_source": f"cerebras_{kind}",
                "_top_enriched_at": datetime.now(timezone.utc).isoformat(),
            }
        })
        if len(tv) >= 3 and len(tc) >= 3:
            results["ok"].append(ticker)
        else:
            results["partial"].append({"ticker": ticker, "tv": len(tv), "tc": len(tc)})

    return results


# ============================================================
# Main entrypoint
# ============================================================
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit-only", action="store_true")
    parser.add_argument("--pass-a", action="store_true")
    parser.add_argument("--pass-b", action="store_true")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--only-missing", action="store_true",
                        help="Pass B : only run on tickers still missing tv/tc < 3")
    args = parser.parse_args()

    load_env()

    pub = json.loads(PUBLISHABLE.read_text())
    tickers = pub["tickers"]
    if args.limit:
        tickers = tickers[: args.limit]

    if args.audit_only:
        c = audit("audit_only", tickers)
        AUDIT_PRE.write_text(json.dumps(c, indent=2, ensure_ascii=False))
        return

    # Pre audit
    pre = audit("PRE", tickers)
    AUDIT_PRE.write_text(json.dumps(pre, indent=2, ensure_ascii=False))

    if args.pass_a or args.all:
        log_line(f"=== PASS A yfinance ({len(tickers)} stés) ===")
        ra = pass_a_yfinance(tickers)
        log_line(f"PASS A done : ok={len(ra.get('ok',[]))} partial={len(ra.get('partial',[]))} fail={len(ra.get('fail',[]))}")

    if args.pass_b or args.all:
        # Re-evaluate which tickers still need top_voting or top_capital
        targets = []
        for t in tickers:
            d = load_pipeline(t)
            g = (d or {}).get("governance") or {}
            if g.get("top_disclosure") == "unavailable_adr":
                continue
            tv, tc, _ = get_gov_status(d)
            if tv < 3 or tc < 3:
                targets.append(t)
        log_line(f"=== PASS B Cerebras ({len(targets)} stés still needing enrichment) ===")
        rb = pass_b_cerebras(targets)
        log_line(f"PASS B done : ok={len(rb.get('ok',[]))} partial={len(rb.get('partial',[]))} fail_src={len(rb.get('fail_no_src',[]))} fail_llm={len(rb.get('fail_llm',[]))} adr={len(rb.get('unavailable_adr',[]))}")

    post = audit("POST", tickers)
    AUDIT_POST.write_text(json.dumps(post, indent=2, ensure_ascii=False))
    log_line(f"IMPACT : {pre['both_ok']} → {post['both_ok']} both_ok ({pre['total']} total)")


if __name__ == "__main__":
    main()
