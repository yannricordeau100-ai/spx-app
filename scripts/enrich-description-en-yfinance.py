#!/usr/bin/env python3
"""
enrich-description-en-yfinance.py

Fetch yfinance `longBusinessSummary` (native English) for the 68 V1.9
publishable companies without description_en, and write structured
description.json files in src/data/v2-pipeline-enrich/.

Non-LLM approach: yfinance longBusinessSummary is a curated EN paragraph
from Yahoo's reference data (sourced from filings). We split it into the
4 advanced sections (positioning / tech_products / moat / risks) using
sentence chunking, and use the first paragraph (200-400 chars) for the 4
simple sections.

Constraints (Yann):
- Non-LLM
- yfinance rate-limited (~10 req/s, we use sleep 1.5s)
- 1 single Python process (RAM-fragile Mac)
- vm_stat check every 30s
"""
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

try:
    import yfinance as yf
except ImportError:
    print("ERR: yfinance missing. pip install yfinance", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
ENRICH = ROOT / "src" / "data" / "v2-pipeline-enrich"
MISSING_FILE = Path("/tmp/desc-en-missing.json")


def check_ram():
    """Return free pages count. Cap throttle if low."""
    try:
        out = subprocess.check_output(["vm_stat"], text=True, timeout=5)
        m = re.search(r"Pages free:\s+(\d+)", out)
        if m:
            free_pages = int(m.group(1))
            free_mb = free_pages * 16 // 1024  # 16 KB pages
            return free_mb
    except Exception:
        return None
    return None


def yf_ticker_for(t):
    """Map our internal ticker to yfinance symbol.
    Most match directly; suffixes (.PA / .L / .SW / .DE / .HK / .AX / .MI / .BR)
    are passed as-is. BF.B -> BF-B. NWSA -> NWSA.
    """
    # yfinance uses '-' for class-B shares
    if "." in t and len(t) <= 6 and t.split(".")[-1] in {"A", "B"}:
        # e.g. BF.B -> BF-B
        return t.replace(".", "-")
    return t


def split_sentences(text):
    """Naive sentence split that preserves abbreviations reasonably."""
    # Protect common abbreviations
    s = text
    s = re.sub(r"\b([A-Z])\.", r"\1__DOT__", s)
    s = re.sub(r"\bInc\.", "Inc__DOT__", s)
    s = re.sub(r"\bCorp\.", "Corp__DOT__", s)
    s = re.sub(r"\bLtd\.", "Ltd__DOT__", s)
    s = re.sub(r"\bCo\.", "Co__DOT__", s)
    s = re.sub(r"\bplc\.", "plc__DOT__", s)
    s = re.sub(r"\bU\.S\.", "U_S_", s)
    parts = re.split(r"(?<=[.!?])\s+", s)
    out = []
    for p in parts:
        p = p.replace("__DOT__", ".").replace("U_S_", "U.S.")
        p = p.strip()
        if p:
            out.append(p)
    return out


def truncate_to_range(text, min_chars=200, max_chars=420):
    """Truncate text to approx range, ending at sentence boundary."""
    if len(text) <= max_chars:
        return text
    # Find last sentence end before max_chars
    cut = text[:max_chars]
    last_period = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "))
    if last_period > min_chars:
        return cut[: last_period + 1].strip()
    return cut.strip()


def make_sections(summary, name, sector, subsector):
    """Build the 4 simple + 4 advanced sections from longBusinessSummary.

    Strategy:
    - simple.activity = first 1-2 sentences (what the company does)
    - simple.products = sentences mentioning products / services / solutions
    - simple.customers = sentences mentioning customers / clients / markets
    - simple.edge = sentence mentioning leader / largest / leading / founded
    - advanced.positioning = first half of summary (positioning context)
    - advanced.tech_products = full summary truncated (products in depth)
    - advanced.moat = derived from competitive language
    - advanced.risks = a generic placeholder phrasing if no risk text found
    """
    sentences = split_sentences(summary)
    if not sentences:
        return None

    text_lower = summary.lower()
    name_clean = name or "The company"

    # SIMPLE
    activity = " ".join(sentences[:2])
    activity = truncate_to_range(activity, 150, 400)

    product_sents = [s for s in sentences if re.search(r"\b(product|service|solution|platform|offer|provide|sell|manufactur|develop|design)", s, re.I)]
    products = " ".join(product_sents[:2]) if product_sents else " ".join(sentences[1:3])
    products = truncate_to_range(products or activity, 150, 400)

    customer_sents = [s for s in sentences if re.search(r"\b(customer|client|consumer|business|enterprise|government|retail|industry|market|user|serves|sold to|distribut)", s, re.I)]
    customers = " ".join(customer_sents[:2]) if customer_sents else f"{name_clean} serves clients in the {subsector or sector or 'global market'} segment."
    customers = truncate_to_range(customers, 100, 400)

    edge_sents = [s for s in sentences if re.search(r"\b(leader|largest|leading|world|global|founded|headquart|specializ|pioneer|premium|unique|patent)", s, re.I)]
    if edge_sents:
        edge = edge_sents[0]
    else:
        edge = f"{name_clean} operates within the {sector or 'global'} sector with established positioning."
    edge = truncate_to_range(edge, 100, 400)

    # ADVANCED
    half = len(summary) // 2
    positioning = truncate_to_range(summary[:half] if half > 200 else summary, 200, 500)

    tech_products = truncate_to_range(summary, 300, 600)

    moat_sents = [s for s in sentences if re.search(r"\b(leader|largest|leading|patent|brand|network|scale|propriet|trademark|exclusiv|distribution)", s, re.I)]
    if moat_sents:
        moat = " ".join(moat_sents[:2])
    else:
        moat = f"{name_clean} benefits from its established presence in {subsector or sector or 'its sector'} and brand recognition."
    moat = truncate_to_range(moat, 150, 500)

    # Risks: yfinance summaries rarely include risks; use sector-aware generic
    risks = f"As a {subsector or sector or 'public'} company, {name_clean} is exposed to competitive pressure, regulatory changes in its operating regions, macroeconomic cycles, and shifts in consumer or enterprise demand affecting its core segments."
    risks = truncate_to_range(risks, 150, 400)

    return {
        "simple": {
            "en": {
                "activity": activity,
                "products": products,
                "customers": customers,
                "edge": edge,
            }
        },
        "advanced": {
            "en": {
                "positioning": positioning,
                "tech_products": tech_products,
                "moat": moat,
                "risks": risks,
            }
        },
    }


def main():
    if not MISSING_FILE.exists():
        print("ERR: /tmp/desc-en-missing.json not found", file=sys.stderr)
        sys.exit(1)
    data = json.loads(MISSING_FILE.read_text())
    missing = data.get("missing", [])
    print(f"Targets: {len(missing)} stés")

    success = 0
    failed = []
    short = []
    last_ram_check = time.time()

    for i, ticker in enumerate(missing, 1):
        # RAM check every 30s
        if time.time() - last_ram_check > 30:
            free_mb = check_ram()
            if free_mb is not None:
                print(f"  [RAM check] free={free_mb} MB")
                if free_mb < 80:
                    print(f"  RAM low ({free_mb} MB) -> sleep 10s")
                    time.sleep(10)
            last_ram_check = time.time()

        yf_sym = yf_ticker_for(ticker)
        print(f"[{i}/{len(missing)}] {ticker} -> {yf_sym} ...", end=" ", flush=True)

        try:
            tk = yf.Ticker(yf_sym)
            info = tk.info or {}
        except Exception as e:
            print(f"FAIL yfinance: {e}")
            failed.append({"ticker": ticker, "reason": f"yfinance error: {e}"})
            time.sleep(1.5)
            continue

        summary = (info.get("longBusinessSummary") or "").strip()
        name = info.get("longName") or info.get("shortName") or ticker
        sector = info.get("sector") or ""
        industry = info.get("industry") or ""

        if not summary or len(summary) < 200:
            print(f"FAIL short summary ({len(summary)} chars)")
            short.append({"ticker": ticker, "len": len(summary)})
            time.sleep(1.5)
            continue

        sections = make_sections(summary, name, sector, industry)
        if not sections:
            print("FAIL no sections")
            failed.append({"ticker": ticker, "reason": "no sections built"})
            time.sleep(1.5)
            continue

        out = {
            "ticker": ticker,
            **sections,
            "_generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "_source": "yfinance.longBusinessSummary",
            "_method": "non-llm-heuristic-split",
            "_source_summary_len": len(summary),
        }

        out_path = ENRICH / f"{ticker.lower()}.description.json"
        out_path.write_text(
            json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"OK ({len(summary)} chars)")
        success += 1
        time.sleep(1.5)  # rate limit

    print()
    print(f"=== DONE ===")
    print(f"Success: {success}/{len(missing)}")
    print(f"Short summary: {len(short)}")
    print(f"Failed: {len(failed)}")
    if failed:
        print(f"Failed list: {failed}")
    if short:
        print(f"Short list: {short}")

    # Write report
    report = {
        "total": len(missing),
        "success": success,
        "short_summary": short,
        "failed": failed,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    Path("/tmp/desc-en-yfinance-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2)
    )


if __name__ == "__main__":
    main()
