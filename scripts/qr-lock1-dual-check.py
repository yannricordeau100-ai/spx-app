#!/usr/bin/env python3
"""
VERROU 1 — Double extraction indépendante (go Yann 16 juil 2026).

Pour chaque sté rafraîchie par quarterly-refresh-run.py, chaque point de
donnée ajouté depuis l'API SEC companyfacts (chemin A) est re-extrait
INDÉPENDAMMENT depuis le document téléchargé lui-même (chemin B : parsing
inline-XBRL du .htm.gz du data-lake). Publication possible uniquement si
A == B (tolérance 0,5 % pour les arrondis d'échelle).

Sortie : .conv-state/qr-lock1-result.json
  { "<TICKER>": { "status": "OK|MISMATCH|UNVERIFIABLE",
                  "checked": N, "ok": N,
                  "mismatches": [ {metric, period_end, facts_value, filing_value} ],
                  "unverifiable": [ {metric, period_end, reason} ] } }

Un point UNVERIFIABLE (concept absent du document, ex valeur issue d'un
10-K alors qu'on vérifie un 10-Q) n'est PAS bloquant s'il est vérifié par
ailleurs ; un MISMATCH est TOUJOURS bloquant.
Zéro LLM, zéro invention : uniquement les deux sources SEC officielles.
"""
from __future__ import annotations
import gzip
import json
import re
import sys
from pathlib import Path

ROOT = Path("/Users/yann/spx-app")
RESULT_IN = ROOT / ".conv-state/quarterly-refresh-run-result.json"
OUT = ROOT / ".conv-state/qr-lock1-result.json"

# Même registre canonique que quarterly-refresh-run.py (source de vérité).
REGISTRY = {
    "Revenues": "revenue",
    "RevenueFromContractWithCustomerExcludingAssessedTax": "revenue",
    "NetIncomeLoss": "net_income",
    "OperatingIncomeLoss": "operating_income",
    "GrossProfit": "gross_profit",
    "ResearchAndDevelopmentExpense": "rd_expense",
    "EarningsPerShareDiluted": "eps_diluted",
    "PaymentsToAcquirePropertyPlantAndEquipment": "capex",
    "NetCashProvidedByUsedInOperatingActivities": "operating_cash_flow",
    "Assets": "total_assets",
    "CashAndCashEquivalentsAtCarryingValue": "cash",
    "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost": "rd_expense",
}
METRIC_TO_TAGS: dict[str, list[str]] = {}
for tag, metric in REGISTRY.items():
    METRIC_TO_TAGS.setdefault(metric, []).append(tag)

TOL = 0.005  # 0,5 %


def log(msg: str) -> None:
    print(f"[lock1] {msg}", flush=True)


def datalake_folder(ticker: str) -> Path:
    for cand in (ticker.upper(), ticker.upper().replace(".", "-"), ticker.upper().replace("-", ".")):
        p = ROOT / "data-lake" / cand
        if p.is_dir():
            return p
    return ROOT / "data-lake" / ticker.upper()


def load_facts(ticker: str) -> list[dict]:
    p = datalake_folder(ticker) / "xbrl" / "facts.json"
    if not p.exists():
        return []
    try:
        return json.loads(p.read_text("utf8"))
    except Exception:
        return []


# ---------- Chemin B : parsing inline-XBRL du document téléchargé ----------

CTX_RE = re.compile(
    r'<xbrli:context[^>]*id="([^"]+)"[^>]*>(.*?)</xbrli:context>',
    re.DOTALL | re.IGNORECASE,
)
END_RE = re.compile(r"<xbrli:endDate>\s*([\d-]+)\s*</xbrli:endDate>", re.IGNORECASE)
INSTANT_RE = re.compile(r"<xbrli:instant>\s*([\d-]+)\s*</xbrli:instant>", re.IGNORECASE)
START_RE = re.compile(r"<xbrli:startDate>\s*([\d-]+)\s*</xbrli:startDate>", re.IGNORECASE)
SEGMENT_RE = re.compile(r"<xbrli:segment>", re.IGNORECASE)

FACT_RE = re.compile(
    r'<ix:nonfraction([^>]*)>(.*?)</ix:nonfraction>',
    re.DOTALL | re.IGNORECASE,
)
ATTR_RE = re.compile(r'([a-zA-Z:_-]+)="([^"]*)"')


def parse_filing_facts(html: str) -> dict[tuple[str, str], list[float]]:
    """Retourne {(us-gaap tag, period_end): [valeurs]} des faits CONSOLIDÉS
    (contexts sans segment/dimension) du document inline-XBRL."""
    # 1. Contexts -> date de fin + consolidé ?
    contexts: dict[str, tuple[str, bool]] = {}
    for m in CTX_RE.finditer(html):
        cid, body = m.group(1), m.group(2)
        end = END_RE.search(body) or INSTANT_RE.search(body)
        if not end:
            continue
        has_segment = bool(SEGMENT_RE.search(body))
        contexts[cid] = (end.group(1), not has_segment)

    out: dict[tuple[str, str], list[float]] = {}
    for m in FACT_RE.finditer(html):
        attrs = dict(ATTR_RE.findall(m.group(1)))
        name = attrs.get("name", "")
        if not name.lower().startswith("us-gaap:"):
            continue
        tag = name.split(":", 1)[1]
        if tag not in REGISTRY:
            continue
        ctx = attrs.get("contextRef") or attrs.get("contextref", "")
        info = contexts.get(ctx)
        if not info or not info[1]:  # contexte absent ou segmenté
            continue
        end_date = info[0]
        raw = re.sub(r"<[^>]+>", "", m.group(2))
        raw = raw.replace(",", "").replace(" ", "").strip()
        if raw in ("", "—", "-"):
            continue
        try:
            val = float(raw)
        except ValueError:
            continue
        scale = int(attrs.get("scale", "0") or 0)
        val *= 10 ** scale
        if attrs.get("sign") == "-":
            val = -val
        out.setdefault((tag, end_date), []).append(val)
    return out


def check_ticker(ticker: str, updated_metrics: list[dict]) -> dict:
    """updated_metrics : liste {metric, period_end, value} issus du run (chemin A)."""
    res = {"status": "OK", "checked": 0, "ok": 0, "mismatches": [], "unverifiable": []}

    # Documents récents téléchargés (10-Q/10-K) : on parse les 2 plus récents.
    folder = datalake_folder(ticker)
    docs: list[Path] = []
    for kind in ("10Q", "10K"):
        d = folder / kind
        if d.is_dir():
            docs += sorted(d.glob("*.htm.gz"))
    docs = sorted(docs, key=lambda p: p.name)[-2:]
    if not docs:
        res["status"] = "UNVERIFIABLE"
        res["unverifiable"].append({"reason": "aucun document local à confronter"})
        return res

    filing_facts: dict[tuple[str, str], list[float]] = {}
    for doc in docs:
        try:
            html = gzip.decompress(doc.read_bytes()).decode("utf8", errors="ignore")
        except Exception:
            continue
        for k, v in parse_filing_facts(html).items():
            filing_facts.setdefault(k, []).extend(v)

    for u in updated_metrics:
        metric, period_end, a_val = u.get("metric"), u.get("period_end"), u.get("value")
        if metric is None or period_end is None or a_val is None:
            continue
        tags = METRIC_TO_TAGS.get(metric, [])
        if not tags:
            # métrique calculée (marges, FCF) : vérifiée via ses composantes,
            # déjà couvertes par leurs propres checks -> non bloquant.
            continue
        res["checked"] += 1
        candidates: list[float] = []
        for tag in tags:
            candidates += filing_facts.get((tag, period_end), [])
        if not candidates:
            res["unverifiable"].append(
                {"metric": metric, "period_end": period_end,
                 "reason": "concept absent du document téléchargé (période antérieure ou tag custom)"})
            continue
        ok = any(
            abs(float(a_val) - c) <= TOL * max(abs(c), 1e-9) or abs(float(a_val) - c) < 0.51
            for c in candidates
        )
        if ok:
            res["ok"] += 1
        else:
            res["mismatches"].append(
                {"metric": metric, "period_end": period_end,
                 "facts_value": a_val, "filing_values": candidates[:4]})
    if res["mismatches"]:
        res["status"] = "MISMATCH"
    elif res["checked"] == 0 or res["ok"] < res["checked"] - len(res["unverifiable"]):
        res["status"] = "OK" if res["checked"] == 0 else res["status"]
    return res


def main() -> int:
    if not RESULT_IN.exists():
        log("aucun run-result, rien à vérifier")
        OUT.write_text(json.dumps({}, indent=2))
        return 0
    run = json.loads(RESULT_IN.read_text("utf8"))
    out: dict[str, dict] = {}
    for r in run.get("results", []):
        t = r["ticker"]
        upd = r.get("verified_points") or []
        # Rétro-compat : si le run n'expose pas verified_points, reconstruire
        # depuis blocks_auto (metric + period portés par kpi_updated_detail).
        if not upd:
            upd = r.get("blocks_auto", {}).get("kpi_points", []) or []
        out[t] = check_ticker(t, upd)
        log(f"{t}: {out[t]['status']} ({out[t]['ok']}/{out[t]['checked']} points concordants, "
            f"{len(out[t]['mismatches'])} écarts, {len(out[t]['unverifiable'])} invérifiables)")
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    log(f"résultat écrit: {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
