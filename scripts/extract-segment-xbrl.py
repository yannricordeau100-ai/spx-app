#!/usr/bin/env python3
"""
extract-segment-xbrl.py — extraction QUARTERLY pour KPIs SEGMENT/PRODUIT
via parsing iXBRL inline des 10-K/10-Q locaux SEC EDGAR.

Yann 15 mai 2026 — règle d'or : aucun LLM, aucune interpolation.
Les KPIs "segment" (Google Cloud Revenue, iPhone Revenue, etc.) ne sont
PAS dans `companyfacts` (qui agrège). Ils sont dans l'iXBRL inline du
filing original avec dimension `us-gaap:StatementBusinessSegmentsAxis`
ou `srt:ProductOrServiceAxis`.

Approche :
  1. Pour chaque ticker, lit tous les 10-Q + 10-K locaux 2021-2026
  2. Parse chaque filing iXBRL (regex sur contexts + facts)
  3. Indexe les contexts {id: {start, end, member}}
  4. Extrait les facts numériques (ix:nonFraction) référençant ces contexts
  5. Pour les revenue tags (Revenues / RevenueFromContract...) avec un
     `goog:GoogleCloudMember` ou similaire → série quarterly par segment
  6. Mapping segment member → KPI short (heuristique nom)
  7. Output : ajoute aux .quarterly-history.json (append KPIs)

Mapping heuristique (à enrichir par ticker) :
  GoogleCloud   → "Google Cloud Revenue", "Cloud Rev", "Cloud"
  iPhone        → "iPhone Revenue", "iPhone"
  Services      → "Services Revenue"
  Datacenter    → "Data Center Revenue", "Datacenter"
  Mac           → "Mac Revenue"
  iPad          → "iPad Revenue"
  Wearables     → "Wearables Revenue"
  ...

Usage : python3 scripts/extract-segment-xbrl.py --universe top307 [--workers 4]
"""
import argparse
import gzip
import json
import multiprocessing as mp
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PIPELINE = ROOT / "src/data/v2-pipeline"
ENRICH = ROOT / "src/data/v2-pipeline-enrich"
SEC = ROOT / "sec-data"
LOG = ROOT / ".conv-state/segment-xbrl.log"

REV_TAGS = (
    "Revenues",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "SalesRevenueNet",
    "SalesRevenueGoodsNet",
)

# Member → mots-clés à matcher contre les KPI shorts/names CONV-DATA
SEGMENT_HINTS = {
    "GoogleCloud": ["cloud", "google cloud", "gcp"],
    "GoogleServices": ["services rev", "google services"],
    "GoogleAdvertising": ["advertising", "ads rev", "google ads"],
    "GoogleSearch": ["search", "google search"],
    "Youtube": ["youtube"],
    "iPhone": ["iphone"],
    "iPad": ["ipad"],
    "Mac": ["mac revenue", "mac product"],
    "Wearables": ["wearables", "watch revenue", "airpods"],
    "Services": ["services revenue", "services rev"],
    "DataCenter": ["data center", "datacenter", "data centre"],
    "Networking": ["networking"],
    "Gaming": ["gaming"],
    "ProfessionalVisualization": ["professional visual", "viz"],
    "Automotive": ["automotive"],
    "Energy": ["energy"],
}


def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG, "a") as fh:
            fh.write(line + "\n")
    except Exception:
        pass


def read_filing(path: Path) -> str:
    try:
        with gzip.open(path, "rt", errors="ignore") as f:
            return f.read()
    except Exception:
        return ""


# Regex iXBRL : contexts avec segment + facts avec contextRef
CONTEXT_RE = re.compile(
    r'<xbrli:context\b[^>]*\bid="([^"]+)"[^>]*>(.*?)</xbrli:context>',
    re.DOTALL,
)
SEGMENT_MEMBER_RE = re.compile(
    r'<xbrldi:explicitMember\b[^>]*\bdimension="[^"]*(?:Segments|ProductOrService)Axis"[^>]*>([^<]+)</xbrldi:explicitMember>',
)
PERIOD_START_RE = re.compile(r"<xbrli:startDate>([\d-]+)</xbrli:startDate>")
PERIOD_END_RE = re.compile(r"<xbrli:endDate>([\d-]+)</xbrli:endDate>")
INSTANT_RE = re.compile(r"<xbrli:instant>([\d-]+)</xbrli:instant>")
FACT_RE = re.compile(
    r'<ix:nonFraction\b([^>]*)>([^<]*)</ix:nonFraction>',
)
ATTR_RE = re.compile(r'([\w-]+)="([^"]*)"')


def parse_contexts(text: str) -> dict[str, dict]:
    """Indexe les contexts : id → {member?, start?, end?, instant?}.
    Ne garde que les contexts AVEC dimension segment/product."""
    out = {}
    for m in CONTEXT_RE.finditer(text):
        ctx_id = m.group(1)
        body = m.group(2)
        mem_match = SEGMENT_MEMBER_RE.search(body)
        if not mem_match:
            continue
        member = mem_match.group(1).strip()
        start_m = PERIOD_START_RE.search(body)
        end_m = PERIOD_END_RE.search(body)
        instant_m = INSTANT_RE.search(body)
        out[ctx_id] = {
            "member": member,
            "start": start_m.group(1) if start_m else None,
            "end": end_m.group(1) if end_m else None,
            "instant": instant_m.group(1) if instant_m else None,
        }
    return out


def parse_facts(text: str) -> list[dict]:
    """Extrait tous les facts ix:nonFraction avec attrs + valeur."""
    out = []
    for m in FACT_RE.finditer(text):
        attrs_str = m.group(1)
        val_raw = m.group(2).strip()
        if not val_raw:
            continue
        attrs = dict(ATTR_RE.findall(attrs_str))
        name = attrs.get("name", "")
        if not name:
            continue
        # Strip taxonomy prefix (us-gaap:, goog:, etc.) for matching
        local = name.split(":", 1)[-1] if ":" in name else name
        ctx = attrs.get("contextRef")
        if not ctx:
            continue
        # Convert numeric value (handle scale, comma stripping)
        clean = val_raw.replace(",", "").replace(" ", "")
        try:
            val = float(clean)
        except Exception:
            continue
        try:
            scale = int(attrs.get("scale", "0"))
        except Exception:
            scale = 0
        try:
            sign = -1 if attrs.get("sign") == "-" else 1
        except Exception:
            sign = 1
        val = sign * val * (10 ** scale)
        out.append({
            "name_local": local,
            "name_full": name,
            "context": ctx,
            "value": val,
            "unit": attrs.get("unitRef", ""),
        })
    return out


def normalize_member(member: str) -> str:
    """goog:GoogleCloudMember → GoogleCloud (strip namespace + 'Member' suffix)."""
    if ":" in member:
        member = member.split(":", 1)[1]
    if member.endswith("Member"):
        member = member[:-6]
    return member


def find_filings(ticker: str) -> list[Path]:
    out = []
    for ftype in ("10K", "10Q"):
        for year in range(2021, 2027):
            d = SEC / "cat1-us" / ftype / str(year)
            if not d.exists():
                continue
            for f in d.glob(f"{ticker}_*.htm.gz"):
                out.append(f)
    return sorted(out)


def date_to_quarter(end_date: str) -> str | None:
    """2025-03-31 → 'Q1 2025'. 2025-06-30 → 'Q2 2025'. etc."""
    try:
        y, m, d = end_date.split("-")
        m = int(m)
        if m <= 3: return f"Q1 {y}"
        if m <= 6: return f"Q2 {y}"
        if m <= 9: return f"Q3 {y}"
        return f"Q4 {y}"
    except Exception:
        return None


def is_quarterly_period(start: str | None, end: str | None) -> bool:
    """Période ~3 mois (89-95 jours)."""
    if not start or not end:
        return False
    try:
        sd = datetime.strptime(start, "%Y-%m-%d")
        ed = datetime.strptime(end, "%Y-%m-%d")
        days = (ed - sd).days
        return 80 <= days <= 100
    except Exception:
        return False


def is_annual_period(start: str | None, end: str | None) -> bool:
    if not start or not end:
        return False
    try:
        sd = datetime.strptime(start, "%Y-%m-%d")
        ed = datetime.strptime(end, "%Y-%m-%d")
        days = (ed - sd).days
        return 360 <= days <= 370
    except Exception:
        return False


def process_ticker(ticker: str) -> dict | None:
    filings = find_filings(ticker)
    if len(filings) < 3:
        return None

    # Aggregate : member → period → value (last filing wins for same period)
    # Structure quarterly :    { "GoogleCloud": { "Q1 2025": {value, end_date, source} } }
    # Structure annuel : annual_agg { "GoogleCloud": { 2025: {value, end_date, source} } }
    agg: dict[str, dict[str, dict]] = {}
    annual_agg: dict[str, dict[int, dict]] = {}

    for f in filings:
        text = read_filing(f)
        if not text:
            continue
        contexts = parse_contexts(text)
        if not contexts:
            continue
        facts = parse_facts(text)
        if not facts:
            continue

        for fact in facts:
            if fact["name_local"] not in REV_TAGS:
                continue
            ctx_id = fact["context"]
            ctx = contexts.get(ctx_id)
            if not ctx:
                continue
            member_norm = normalize_member(ctx["member"])
            start = ctx.get("start")
            end = ctx.get("end")
            if is_quarterly_period(start, end):
                period = date_to_quarter(end)
                if not period:
                    continue
                agg.setdefault(member_norm, {})
                cur = agg[member_norm].get(period)
                if not cur or end > cur["end"]:
                    agg[member_norm][period] = {
                        "value": fact["value"],
                        "end": end,
                        "source": f.name,
                        "tag": fact["name_full"],
                    }
            elif is_annual_period(start, end):
                # FY context (Jan 1 - Dec 31, ~365 days)
                try:
                    fy = int(end.split("-")[0])
                except Exception:
                    continue
                annual_agg.setdefault(member_norm, {})
                cur = annual_agg[member_norm].get(fy)
                if not cur or end > cur["end"]:
                    annual_agg[member_norm][fy] = {
                        "value": fact["value"],
                        "end": end,
                        "source": f.name,
                        "tag": fact["name_full"],
                    }

    # Yann 15 mai 2026 : calcule Q4 = FY − (Q1 + Q2 + Q3) si tous dispo
    for member, fy_dict in annual_agg.items():
        for fy, ann in fy_dict.items():
            q1 = agg.get(member, {}).get(f"Q1 {fy}")
            q2 = agg.get(member, {}).get(f"Q2 {fy}")
            q3 = agg.get(member, {}).get(f"Q3 {fy}")
            if not (q1 and q2 and q3):
                continue
            q4_val = ann["value"] - q1["value"] - q2["value"] - q3["value"]
            if q4_val <= 0:  # safety : valeur négative = pas un Q4 valide
                continue
            agg.setdefault(member, {})
            existing_q4 = agg[member].get(f"Q4 {fy}")
            # N'override pas si Q4 trouvé dans iXBRL direct (rare mais possible)
            if existing_q4:
                continue
            agg[member][f"Q4 {fy}"] = {
                "value": q4_val,
                "end": f"{fy}-12-31",
                "source": f"calc-{ann['source']}",
                "tag": ann["tag"],
            }

    if not agg:
        return None

    # Charge KPIs CONV-DATA pour mapper member → short
    p = PIPELINE / f"{ticker.lower()}.json"
    if not p.exists():
        return None
    d = json.loads(p.read_text())
    kpis = d.get("kpis") or []
    if not isinstance(kpis, list):
        return None

    out_kpis = []
    for member_norm, periods in agg.items():
        if len(periods) < 4:
            continue
        # Match member to KPI short via heuristic
        hints = SEGMENT_HINTS.get(member_norm, [member_norm.lower()])
        matched_kpi = None
        for k in kpis:
            short = (k.get("short") or "").lower()
            name = (k.get("name_fr") or "").lower() + " " + (k.get("name_en") or "").lower()
            text = f"{short} {name}"
            if any(h in text for h in hints):
                matched_kpi = k
                break
        if not matched_kpi:
            # Fallback : match member word in any KPI
            member_lower = member_norm.lower()
            for k in kpis:
                if member_lower in ((k.get("short") or "") + " " + (k.get("name_en") or "")).lower():
                    matched_kpi = k
                    break
        if not matched_kpi:
            continue

        # Trie périodes ascendant
        sorted_periods = sorted(periods.keys(), key=lambda p: (int(p[3:]), p[1]))
        history = []
        history_periods = []
        citations = []
        last_end = ""
        for per in sorted_periods:
            entry = periods[per]
            val_b = entry["value"] / 1e9
            history.append(round(val_b, 4))
            history_periods.append(per)
            if entry["end"] > last_end:
                last_end = entry["end"]
            citations.append({
                "period": per,
                "value": round(val_b, 4),
                "source": entry["source"],
                "tag": entry["tag"],
            })
        # Limit to last 22 quarters
        if len(history) > 22:
            history = history[-22:]
            history_periods = history_periods[-22:]
            citations = citations[-22:]

        out_kpis.append({
            "short": matched_kpi.get("short"),
            "period_type": "quarter",
            "history": history,
            "history_periods": history_periods,
            "last_data_date": last_end,
            "unit": "Mds $",
            "_source": "SEC EDGAR iXBRL inline (segment)",
            "_segment_member": member_norm,
            "_citations": citations[-4:],
        })

    if not out_kpis:
        return None
    return {
        "ticker": ticker,
        "extracted_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "method": "xbrl-segment-inline",
        "n_kpis": len(out_kpis),
        "kpis": out_kpis,
    }


def merge_into_existing(ticker: str, segment_data: dict):
    """Append segment KPIs au fichier existant .quarterly-history.json
    (créé par extract-quarterly-xbrl.py companyfacts). Si pas de fichier
    existant, crée un nouveau."""
    out_path = ENRICH / f"{ticker.lower()}.quarterly-history.json"
    if out_path.exists():
        try:
            existing = json.loads(out_path.read_text())
        except Exception:
            existing = {}
    else:
        existing = {}

    existing_kpis = existing.get("kpis") or []
    # Yann 15 mai 2026 : si segment KPI déjà présent, REMPLACE par la nouvelle
    # extraction (qui peut avoir + de quarters via Q4 calculé).
    new_by_short = {k.get("short"): k for k in segment_data["kpis"]}
    merged_kpis = []
    updated_count = 0
    seen_shorts = set()
    for k in existing_kpis:
        s = k.get("short")
        if s in new_by_short:
            new_k = new_by_short[s]
            new_len = len(new_k.get("history") or [])
            old_len = len(k.get("history") or [])
            if new_len > old_len:
                merged_kpis.append(new_k)
                updated_count += 1
            else:
                merged_kpis.append(k)
            seen_shorts.add(s)
        else:
            merged_kpis.append(k)
    # Ajoute les nouveaux KPIs segment pas encore présents
    added_count = 0
    for s, new_k in new_by_short.items():
        if s not in seen_shorts:
            merged_kpis.append(new_k)
            added_count += 1

    if updated_count == 0 and added_count == 0:
        return False

    merged = {
        **existing,
        "ticker": ticker,
        "extracted_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "method": existing.get("method") or "xbrl-companyfacts",
        "_segment_method": "xbrl-segment-inline",
        "n_kpis": len(merged_kpis),
        "kpis": merged_kpis,
    }
    out_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2))
    return True


def worker(ticker: str):
    try:
        data = process_ticker(ticker)
    except Exception as e:
        return ticker, f"err-{type(e).__name__}-{str(e)[:60]}"
    if not data:
        return ticker, "no-segments"
    appended = merge_into_existing(ticker, data)
    if appended:
        return ticker, f"ok-{data['n_kpis']}seg"
    return ticker, "all-overlap"


def load_universe(name: str) -> list[str]:
    if name == "top307":
        f = ROOT / "src/data/v1-8-tickers-sorted.json"
        return json.loads(f.read_text())[:307]
    if name == "sp500":
        f = ROOT / "src/data/v1-7-public.json"
        data = json.loads(f.read_text())
        if isinstance(data, dict):
            return list(data.keys())
        return [d.get("ticker") for d in data if d.get("ticker")]
    if name == "test":
        return ["GOOGL", "AAPL", "NVDA", "META", "MSFT"]
    raise ValueError(f"unknown {name}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--universe", choices=["top307", "sp500", "test"], default="test")
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--workers", type=int, default=4)
    args = p.parse_args()

    tickers = load_universe(args.universe)
    if args.limit:
        tickers = tickers[: args.limit]
    # Skip tickers without local 10-K (foreign)
    tickers = [t for t in tickers if "." not in t]

    log(f"=== START segment XBRL universe={args.universe} tickers={len(tickers)} workers={args.workers} ===")

    counts = {}
    with mp.Pool(args.workers) as pool:
        for tk, status in pool.imap_unordered(worker, tickers):
            key = status.split("-")[0]
            counts[key] = counts.get(key, 0) + 1
            icon = "✅" if status.startswith("ok") else "⚠"
            log(f"  {icon} {tk:8} → {status}")

    log(f"=== DONE {counts} ===")


if __name__ == "__main__":
    main()
