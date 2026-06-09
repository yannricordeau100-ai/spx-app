#!/usr/bin/env python3
"""Super-KPI XBRL backfill — remplit Revenue / Operating Margin / Capex
manquants des stés US via SEC EDGAR companyfacts (programmatique, zéro LLM).

Ajoute les KPIs manquants dans `kpis[]` du fichier `src/data/v2-pipeline/<slug>.json`
avec is_generic:true (masqués à l'affichage via isGenericKpi, lus par super-kpi.ts).

RÈGLE : verbatim XBRL ou rien. NULL/skip si tag absent. Jamais inventer.

Sources XBRL (annuel FY, durée ~365j, 5+ ans) :
  - Revenue        : Revenues | RevenueFromContractWithCustomerExcludingAssessedTax
                     (fallback SalesRevenueNet)
  - Operating Inc. : OperatingIncomeLoss  (+ Revenue -> Operating Margin %)
  - Capex          : CapitalExpenditures | PaymentsToAcquirePropertyPlantAndEquipment

Unités :
  - Revenue / Op income absolus -> "Mds $" (valeurs / 1e9)
  - Operating Margin -> "%"
  - Capex -> "Mds $"

Parallélise N workers réseau (défaut 3). Throttle sleep entre requêtes SEC.

Usage :
  python3 scripts/superkpi-xbrl-backfill/backfill.py --workers 3            # full run
  python3 scripts/superkpi-xbrl-backfill/backfill.py --tickers AAPL,AMD     # subset
  python3 scripts/superkpi-xbrl-backfill/backfill.py --dry-run              # no write
"""
from __future__ import annotations

import argparse
import gzip
import json
import ssl
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lib_common as L

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

UA = "Mettrik AI yannricordeau100@gmail.com"
SEC_FACTS = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"
COMPANY_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SLEEP = 0.16  # ~6 req/s, sous la limite SEC ~10 req/s (recommandé <=8)
MARKER = "superkpi-xbrl-backfill"
TODAY = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

# Familles de tags XBRL us-gaap. Plusieurs tags par concept car les stés
# migrent leur taxonomie d'une année sur l'autre (ex Apple Revenues ->
# RevenueFromContractWithCustomerExcludingAssessedTax en 2019, Amazon
# PaymentsToAcquirePropertyPlantAndEquipment -> PaymentsToAcquireProductiveAssets).
# On UNIONNE les tags par exercice (le dépôt le plus récent gagne) pour obtenir
# une série continue 5+ ans. Tous sont des concepts XBRL officiels = verbatim,
# jamais inventé.
REV_TAGS = [
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "Revenues",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
    "SalesRevenueNet",
    "SalesRevenueGoodsNet",
]
OPINC_TAGS = ["OperatingIncomeLoss"]
# Capex : tag canonique demandé (PaymentsToAcquirePropertyPlantAndEquipment,
# CapitalExpenditures) + équivalents us-gaap officiels (productive assets,
# other PP&E). Ordre = préférence de canonicité.
CAPEX_TAGS = [
    "PaymentsToAcquirePropertyPlantAndEquipment",
    "PaymentsToAcquireProductiveAssets",
    "CapitalExpenditures",
    "PaymentsForCapitalImprovements",
    "PaymentsToAcquireOtherPropertyPlantAndEquipment",
]

_print_lock = threading.Lock()
_rate_lock = threading.Lock()
_last_req = [0.0]


def log(msg: str):
    with _print_lock:
        print(msg, flush=True)


def _throttle():
    with _rate_lock:
        dt = time.time() - _last_req[0]
        if dt < SLEEP:
            time.sleep(SLEEP - dt)
        _last_req[0] = time.time()


def fetch_companyfacts(cik: int, retries: int = 4) -> dict | None:
    url = SEC_FACTS.format(cik=cik)
    for attempt in range(retries):
        _throttle()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=45) as r:
                raw = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.decompress(raw)
                return json.loads(raw)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code in (429, 502, 503, 504):
                time.sleep(2 * (attempt + 1))
                continue
            return None
        except Exception:
            time.sleep(1.5 * (attempt + 1))
            continue
    return None


def _annual_points_raw(facts: dict, tag: str) -> dict[int, tuple[str, float]]:
    """Retourne {fiscal_year: (filed, value)} pour les frames annuels (form
    10-K, fp=FY, durée ~365j). Le dépôt le plus récent gagne par exercice."""
    node = facts.get("facts", {}).get("us-gaap", {}).get(tag)
    if not node:
        return {}
    out: dict[int, tuple[str, float]] = {}
    for unit_key, items in node.get("units", {}).items():
        if not unit_key.startswith("USD"):
            continue
        for it in items:
            form = it.get("form", "")
            fp = it.get("fp", "")
            fy = it.get("fy")
            start = it.get("start")
            end = it.get("end")
            val = it.get("val")
            filed = it.get("filed", "")
            if val is None or fy is None or not start or not end:
                continue
            if form not in ("10-K", "10-K/A"):
                continue
            if fp != "FY":
                continue
            try:
                d0 = datetime.strptime(start, "%Y-%m-%d")
                d1 = datetime.strptime(end, "%Y-%m-%d")
            except Exception:
                continue
            dur = (d1 - d0).days
            if not (350 <= dur <= 380):
                continue
            year = d1.year
            prev = out.get(year)
            if prev is None or filed > prev[0]:
                out[year] = (filed, float(val))
    return out


def _annual_points(facts: dict, tag: str) -> dict[int, float]:
    return {y: v for y, (f, v) in _annual_points_raw(facts, tag).items()}


def merge_tags_by_year(facts: dict, tags: list[str]) -> tuple[str | None, dict[int, float]]:
    """Unionne plusieurs tags par exercice. Pour chaque année, on garde la
    valeur du dépôt le PLUS RÉCENT, en cas d'égalité de date on respecte
    l'ordre de préférence des tags. Retourne (tag_principal, {year: value}).

    tag_principal = le tag qui a fourni le plus de points (pour citation)."""
    merged: dict[int, tuple[str, float, str]] = {}  # year -> (filed, value, tag)
    tag_count: dict[str, int] = {}
    for rank, tag in enumerate(tags):
        raw = _annual_points_raw(facts, tag)
        for year, (filed, val) in raw.items():
            tag_count[tag] = tag_count.get(tag, 0) + 1
            cur = merged.get(year)
            if cur is None:
                merged[year] = (filed, val, tag)
            else:
                cur_filed, _, cur_tag = cur
                # dépôt plus récent gagne ; à égalité, tag mieux classé gagne
                if filed > cur_filed:
                    merged[year] = (filed, val, tag)
                elif filed == cur_filed and tags.index(tag) < tags.index(cur_tag):
                    merged[year] = (filed, val, tag)
    if not merged:
        return None, {}
    principal = max(tag_count, key=tag_count.get) if tag_count else None
    return principal, {y: v for y, (f, v, t) in merged.items()}


# alias compat
def first_present(facts: dict, tags: list[str]) -> tuple[str | None, dict[int, float]]:
    return merge_tags_by_year(facts, tags)


def _round_bn(v: float) -> float:
    return round(v / 1e9, 3)


def _sorted_years(d: dict[int, float], n: int = 6) -> list[int]:
    return sorted(d.keys())[-n:]


def build_kpis(facts: dict, need_rev: bool, need_mgn: bool, need_cap: bool,
               rev_period: str = "year") -> dict:
    """Construit les KPIs à ajouter. Retourne dict {short: kpi_dict, ...} +
    diagnostics. Exige >=5 ans pour chaque KPI ajouté (sinon skip ce KPI).

    rev_period : périodicité du KPI Revenue que super-kpi.ts utilisera pour
    Capital Intensity (Capex / Revenue, ratio sur les .value bruts). Si la
    sté a déjà un Revenue TRIMESTRIEL (304 cas), on aligne la `value` du Capex
    backfillé sur la base trimestrielle (annuel / 4) pour que le ratio reste
    correct. Le Capex est masqué (is_generic) : sa value sert UNIQUEMENT au
    calcul, jamais affichée. L'history reste annuelle + le montant annuel
    réel est conservé dans `_annual_value` pour traçabilité."""
    result = {"added": {}, "skipped": {}}

    rev_tag, rev_pts = merge_tags_by_year(facts, REV_TAGS)
    opinc_tag, opinc_pts = merge_tags_by_year(facts, OPINC_TAGS)
    cap_tag, cap_pts = merge_tags_by_year(facts, CAPEX_TAGS)

    # ── Revenue (Total Revenue) ──────────────────────────────────────────
    if need_rev:
        years = _sorted_years(rev_pts)
        if len(years) >= 5:
            hist = [_round_bn(rev_pts[y]) for y in years]
            last = hist[-1]
            prev = hist[-2]
            yoy = round((last - prev) / abs(prev) * 100, 1) if prev else 0.0
            result["added"]["Total Revenue"] = _mk_kpi(
                short="Total Revenue",
                name_fr="Chiffre d'affaires total",
                name_en="Total Revenue",
                value=last,
                unit="Mds $",
                yoy=yoy,
                kpi_type="Revenu",
                nature="Structurel",
                history=hist,
                last_year=years[-1],
                tag=rev_tag,
            )
        else:
            result["skipped"]["Total Revenue"] = f"only {len(years)} FY points (tag={rev_tag})"

    # ── Operating Margin (from OperatingIncomeLoss / Revenue) ────────────
    if need_mgn:
        common = sorted(set(opinc_pts.keys()) & set(rev_pts.keys()))
        common = common[-6:]
        if len(common) >= 5:
            hist = []
            ok = True
            for y in common:
                rev = rev_pts[y]
                oi = opinc_pts[y]
                if rev == 0:
                    ok = False
                    break
                m = round(oi / rev * 100, 1)
                # sanity : marge op plausible -50%..80%
                if m < -50 or m > 80:
                    ok = False
                    break
                hist.append(m)
            if ok and len(hist) >= 5:
                last = hist[-1]
                prev = hist[-2]
                yoy_pts = round(last - prev, 1)
                result["added"]["Operating Margin"] = _mk_kpi(
                    short="Operating Margin",
                    name_fr="Marge opérationnelle",
                    name_en="Operating Margin",
                    value=last,
                    unit="%",
                    yoy=yoy_pts,
                    kpi_type="Marge",
                    nature="Structurel",
                    history=hist,
                    last_year=common[-1],
                    tag=f"{opinc_tag}/{rev_tag}",
                    yoy_is_pts=True,
                )
            else:
                result["skipped"]["Operating Margin"] = "implausible or insufficient computed margin"
        else:
            result["skipped"]["Operating Margin"] = (
                f"only {len(common)} common FY (opinc={len(opinc_pts)},rev={len(rev_pts)})"
            )

    # ── Capex ────────────────────────────────────────────────────────────
    if need_cap:
        years = _sorted_years(cap_pts)
        if len(years) >= 5:
            hist = [_round_bn(abs(cap_pts[y])) for y in years]
            annual_last = hist[-1]
            prev = hist[-2]
            yoy = round((annual_last - prev) / abs(prev) * 100, 1) if prev else 0.0
            # Capital Intensity = Capex.value / Revenue.value (bruts) dans
            # super-kpi.ts. Si le Revenue de la sté est trimestriel, on aligne
            # la value du Capex sur la base trimestrielle (annuel / 4) pour que
            # le ratio reste juste. History annuelle conservée (jamais affichée).
            if rev_period == "quarter":
                value = round(annual_last / 4.0, 3)
            else:
                value = annual_last
            kpi = _mk_kpi(
                short="Capex",
                name_fr="Dépenses d'investissement",
                name_en="Capital Expenditures",
                value=value,
                unit="Mds $",
                yoy=yoy,
                kpi_type="Cash",
                nature="Structurel",
                history=hist,
                last_year=years[-1],
                tag=cap_tag,
            )
            kpi["_annual_value"] = annual_last
            kpi["_value_period"] = rev_period
            if rev_period == "quarter":
                kpi["explanation"] = (
                    f"Source : SEC EDGAR XBRL ({cap_tag}), exercices annuels. "
                    "Valeur ramenée en base trimestrielle pour cohérence du ratio."
                )
            result["added"]["Capex"] = kpi
        else:
            result["skipped"]["Capex"] = f"only {len(years)} FY points (tag={cap_tag})"

    return result


def _mk_kpi(short, name_fr, name_en, value, unit, yoy, kpi_type, nature, history,
           last_year, tag, yoy_is_pts=False):
    yoy_str = (f"+{yoy}" if yoy >= 0 else f"{yoy}") + (" pts" if yoy_is_pts else " %")
    return {
        "short": short,
        "name_fr": name_fr,
        "name_en": name_en,
        "explanation": f"Source : SEC EDGAR XBRL ({tag}), exercices annuels.",
        "value": str(value),
        "unit": unit,
        "yoy": yoy_str,
        "type": kpi_type,
        "nature": nature,
        "comparable": "oui",
        "signal": "",
        "description": "",
        "history": history,
        "is_generic": True,
        "period_type": "year",
        "last_data_date": f"{last_year}-12-31",
        "_source": "SEC EDGAR XBRL companyfacts",
        "_backfilled_by": MARKER,
        "_backfilled_at": TODAY,
        "_xbrl_tag": tag,
    }


def process_ticker(ticker: str, dry_run: bool, extra_cik_map: dict) -> dict:
    res = {"ticker": ticker, "status": None, "added": [], "skipped": {}, "note": ""}
    p = L.pipeline_path(ticker)
    if not p.exists():
        res["status"] = "no_file"
        return res
    try:
        c = json.loads(p.read_text())
    except Exception as e:
        res["status"] = "read_error"
        res["note"] = str(e)
        return res

    need_rev = not L.has_revenue(c)
    need_mgn = not L.has_margin(c)
    need_cap = not L.has_capex(c)
    rev_period = L.revenue_period(c)

    # ── Correction d'un Capex DÉJÀ backfillé dont la value n'est pas sur la
    #    bonne base de période (le Revenue de la sté est trimestriel mais le
    #    Capex a été écrit en annuel -> Capital Intensity surévaluée ~4x).
    corrected = False
    if not need_cap:
        for k in c.get("kpis", []) or []:
            if k.get("short") == "Capex" and k.get("_backfilled_by") == MARKER:
                ann = k.get("_annual_value")
                if ann is None:
                    ann = L._num(k.get("value"))
                want = (
                    round(ann / 4.0, 3) if rev_period == "quarter"
                    else round(ann / 2.0, 3) if rev_period == "semester"
                    else ann
                )
                cur = L._num(k.get("value"))
                expl_stale = (
                    rev_period in ("quarter", "semester")
                    and "base" not in (k.get("explanation") or "")
                )
                if ann is not None and cur is not None and (abs(cur - want) > 1e-6 or expl_stale):
                    k["value"] = str(want)
                    k["_annual_value"] = ann
                    k["_value_period"] = rev_period
                    k["_corrected_period_at"] = TODAY
                    tagref = k.get("_xbrl_tag", "")
                    if rev_period == "quarter":
                        k["explanation"] = (
                            f"Source : SEC EDGAR XBRL ({tagref}), exercices annuels. "
                            "Valeur ramenée en base trimestrielle pour cohérence du ratio."
                        )
                    elif rev_period == "semester":
                        k["explanation"] = (
                            f"Source : SEC EDGAR XBRL ({tagref}), exercices annuels. "
                            "Valeur ramenée en base semestrielle pour cohérence du ratio."
                        )
                    else:
                        k["explanation"] = (
                            f"Source : SEC EDGAR XBRL ({tagref}), exercices annuels."
                        )
                    corrected = True

    if not (need_rev or need_mgn or need_cap):
        if corrected:
            res["status"] = "corrected"
            res["added"] = ["Capex(period-fix)"]
            if not dry_run:
                _atomic_write(p, c)
        else:
            res["status"] = "already_complete"
        return res

    cik = L.cik_for_ticker(ticker, extra_cik_map)
    if cik is None:
        res["status"] = "no_cik"
        return res

    facts = fetch_companyfacts(cik)
    if facts is None:
        res["status"] = "no_facts"
        return res

    built = build_kpis(facts, need_rev, need_mgn, need_cap, rev_period=rev_period)
    res["skipped"] = built["skipped"]

    # Anti-duplication : ne pas ajouter un short déjà présent.
    existing_shorts = {k.get("short") for k in c.get("kpis", []) or []}
    to_add = [kpi for short, kpi in built["added"].items() if short not in existing_shorts]
    if not to_add and not corrected:
        res["status"] = "no_tag" if not built["added"] else "dup_only"
        return res

    res["added"] = [k["short"] for k in to_add] + (["Capex(period-fix)"] if corrected else [])
    res["status"] = "backfilled" if to_add else "corrected"

    if not dry_run:
        c.setdefault("kpis", [])
        c["kpis"].extend(to_add)
        c["_superkpi_backfill_at"] = TODAY
        c["_superkpi_backfill_added"] = sorted(
            set(c.get("_superkpi_backfill_added", [])) | {s for s in res["added"]}
        )
        _atomic_write(p, c)
    return res


def _atomic_write(p, obj):
    tmp = p.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=2))
    tmp.replace(p)


def fetch_company_tickers_map() -> dict:
    """Fallback ticker->CIK depuis SEC company_tickers.json (forme SEC: dash)."""
    try:
        _throttle()
        req = urllib.request.Request(COMPANY_TICKERS_URL, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=45) as r:
            raw = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                raw = gzip.decompress(raw)
            data = json.loads(raw)
        out = {}
        for v in data.values():
            sym = str(v.get("ticker", "")).upper()
            cik = v.get("cik_str")
            if sym and cik is not None:
                out[sym] = int(cik)
                out[sym.replace("-", ".")] = int(cik)
        return out
    except Exception as e:
        log(f"[warn] company_tickers.json fetch failed: {e}")
        return {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--tickers", type=str, default="", help="comma list, else full US universe")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    if args.tickers:
        tickers = [t.strip().upper() for t in args.tickers.split(",") if t.strip()]
    else:
        tickers = L.load_us_tickers()
    if args.limit:
        tickers = tickers[: args.limit]

    # extra CIK map fallback (résout les tickers absents de l'index local)
    extra_cik_map = fetch_company_tickers_map()
    log(f"[init] {len(tickers)} US tickers · workers={args.workers} · dry_run={args.dry_run} · fallback_cik={len(extra_cik_map)}")

    results = []
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(process_ticker, t, args.dry_run, extra_cik_map): t for t in tickers}
        done = 0
        for fut in as_completed(futs):
            r = fut.result()
            results.append(r)
            done += 1
            if r["status"] == "backfilled":
                log(f"[{done}/{len(tickers)}] {r['ticker']:8s} +{','.join(r['added'])}")
            elif r["status"] in ("no_cik", "no_facts", "no_tag", "read_error"):
                log(f"[{done}/{len(tickers)}] {r['ticker']:8s} {r['status']} {r.get('skipped','')}")

    # ── Rapport ──
    by = {}
    for r in results:
        by.setdefault(r["status"], []).append(r["ticker"])
    add_rev = sum(1 for r in results if "Total Revenue" in r["added"])
    add_mgn = sum(1 for r in results if "Operating Margin" in r["added"])
    add_cap = sum(1 for r in results if "Capex" in r["added"])

    log("\n================ RAPPORT ================")
    log(f"Stés traitées          : {len(results)}")
    log(f"Backfillées            : {len(by.get('backfilled', []))}")
    log(f"  + Total Revenue      : {add_rev}")
    log(f"  + Operating Margin   : {add_mgn}")
    log(f"  + Capex              : {add_cap}")
    log(f"Capex period-corrigés  : {len(by.get('corrected', []))}")
    log(f"Déjà complètes (3/3)   : {len(by.get('already_complete', []))}")
    log(f"No file (slug absent)  : {len(by.get('no_file', []))} {by.get('no_file', [])}")
    log(f"No CIK                 : {len(by.get('no_cik', []))} {by.get('no_cik', [])}")
    log(f"No facts (404 SEC)     : {len(by.get('no_facts', []))} {by.get('no_facts', [])}")
    log(f"No tag (XBRL absent)   : {len(by.get('no_tag', []))} {by.get('no_tag', [])}")
    log(f"Dup only               : {len(by.get('dup_only', []))}")
    log(f"Read error             : {len(by.get('read_error', []))} {by.get('read_error', [])}")

    # Diagnostics des skips partiels (sté backfillée mais 1 input toujours KO)
    partial = {}
    for r in results:
        if r["status"] == "backfilled" and r["skipped"]:
            for k, why in r["skipped"].items():
                partial.setdefault(k, []).append(r["ticker"])
    if partial:
        log("\n--- Inputs encore KO sur des stés partiellement backfillées ---")
        for k, ts in partial.items():
            log(f"  {k}: {len(ts)} stés -> {ts[:15]}")

    out = Path(__file__).resolve().parent / "last_run_report.json"
    out.write_text(json.dumps({"at": TODAY, "results": results, "summary": {k: len(v) for k, v in by.items()}}, ensure_ascii=False, indent=2))
    log(f"\nRapport détaillé : {out}")


if __name__ == "__main__":
    main()
