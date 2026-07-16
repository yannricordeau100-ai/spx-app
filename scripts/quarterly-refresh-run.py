#!/usr/bin/env python3
"""
scripts/quarterly-refresh-run.py

Chantier CRON RAFRAICHISSEMENT TRIMESTRIEL (go Yann 12 juil 2026).

Pour chaque ste detectee par quarterly-refresh-detect.py
(`.conv-state/quarterly-refresh-detected.json`) :

 a) telecharge le(s) nouveau(x) filing(s) dans data-lake/<T>/{10K,10Q,8K}/
    (meme arborescence et meme nommage que l'existant, .htm.gz) ;
 b) met a jour data-lake/<T>/xbrl/facts.json depuis l'API SEC companyfacts
    (+ INSERT OR IGNORE best-effort dans data-lake/mettrik.db) ;
 c) relance l'extraction KPI standard (adaptee de
    .conv-state/chantier-top10-work/extract.py) sur
    src/data/v2-pipeline-enrich/<t>.json : etend history/history_periods
    ET met a jour value / yoy / last_data_date du KPI ;
 d) inscrit la ste dans `.conv-state/quarterly-refresh-todo-llm.json` avec
    les flags par bloc a traiter par la conv Claude (PAS par ce script,
    zero API payante) :
      - ec_synthesis      : synthese Earning Call (toujours)
      - stories_rotation  : rotation KPI Stories, spec
                            .conv-state/quarterly-stories-rotation-spec.md (toujours)
      - risks             : re-extraction risques (si nouveau 10-K)
      - segments_geo      : repartition CA segments/geo (si 10-Q ou 10-K)
      - events            : evenements materiels (si 8-K)
      - profit_warning    : a evaluer si l'ER est negatif (si 8-K earnings)

Etat : `.conv-state/quarterly-refresh-state.json` mis a jour APRES chaque ste
traitee avec succes (idempotent + resume-safe : relancer ne refait pas le
travail deja fait, les downloads existants sont skippes).

Resultat : `.conv-state/quarterly-refresh-run-result.json` (consomme par
quarterly-refresh.sh pour le rapport final).

Regles : SEC EDGAR = seule source, UA obligatoire, throttle 0.5s.
Zero invention de donnees, zero LLM, zero API Anthropic payante.

Usage :
  python3 scripts/quarterly-refresh-run.py
  python3 scripts/quarterly-refresh-run.py --tickers AAPL,NVDA
  python3 scripts/quarterly-refresh-run.py --detected /path/detected.json
"""
from __future__ import annotations

import argparse
import gzip
import json
import re
import shutil
import sqlite3
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/Users/yann/spx-app")
DATALAKE = ROOT / "data-lake"
DB_PATH = DATALAKE / "mettrik.db"
ENRICH_DIR = ROOT / "src/data/v2-pipeline-enrich"
DETECTED_PATH = ROOT / ".conv-state/quarterly-refresh-detected.json"
STATE_PATH = ROOT / ".conv-state/quarterly-refresh-state.json"
TODO_LLM_PATH = ROOT / ".conv-state/quarterly-refresh-todo-llm.json"
RESULT_PATH = ROOT / ".conv-state/quarterly-refresh-run-result.json"
BACKUP_DIR = ROOT / ".conv-state/quarterly-refresh-backups"

USER_AGENT = "Mettrik-AI-Quarterly-Refresh yann@mettrik.ai"
THROTTLE_S = 0.5
CUTOFF = "2021-01-01"

# Registre canonique tag us-gaap -> metric_key (identique a
# scripts/datalake/build_datalake.py, source de verite du data-lake XBRL).
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

# Catalogue KPI standard (identique a extract.py chantier top10)
STD = {
    "Total Revenue":      {"metric": "revenue",             "period": "both",    "unit": "$M", "compute": None,           "name_fr": "Revenu total"},
    "Net Income":         {"metric": "net_income",          "period": "both",    "unit": "$M", "compute": None,           "name_fr": "Résultat net"},
    "EPS Diluted":        {"metric": "eps_diluted",         "period": "both",    "unit": "$",  "compute": None,           "name_fr": "BPA dilué"},
    "Op Margin":          {"metric": None,                  "period": "year",    "unit": "%",  "compute": "op_margin",    "name_fr": "Marge opérationnelle"},
    "Gross Margin":       {"metric": None,                  "period": "year",    "unit": "%",  "compute": "gross_margin", "name_fr": "Marge brute"},
    "Free Cash Flow":     {"metric": None,                  "period": "year",    "unit": "$M", "compute": "fcf",          "name_fr": "Free cash flow"},
    "Operating Cash Flow": {"metric": "operating_cash_flow", "period": "year",   "unit": "$M", "compute": None,           "name_fr": "Flux de trésorerie d'exploitation"},
    "Total Assets":       {"metric": "total_assets",        "period": "instant", "unit": "$M", "compute": None,           "name_fr": "Total actifs"},
    "R&D":                {"metric": "rd_expense",          "period": "year",    "unit": "$M", "compute": None,           "name_fr": "R&D"},
    "Capex":              {"metric": "capex",               "period": "year",    "unit": "$M", "compute": None,           "name_fr": "Capex"},
}

ALIASES = {
    "EPS Diluted": ["EPS Diluted", "EPS", "Diluted EPS"],
    "Total Revenue": ["Total Revenue", "Revenue", "Net Sales", "Total Net Sales"],
    "Free Cash Flow": ["Free Cash Flow", "FCF"],
    "Operating Cash Flow": ["Operating Cash Flow", "Cash from Operations"],
    "Op Margin": ["Op Margin", "Operating Margin"],
    "R&D": ["R&D", "Research and Development"],
}


def log(msg: str) -> None:
    print(f"[quarterly-refresh-run] {datetime.now(timezone.utc).isoformat()} {msg}", flush=True)


def _ssl_context():
    """macOS python3 sans certs systeme : utilise certifi si dispo."""
    import ssl
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


_SSL_CTX = _ssl_context()


def http_get(url: str) -> bytes | None:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=60, context=_SSL_CTX) as resp:
            return resp.read()
    except Exception as e:
        # fallback curl (meme approche que scripts/datalake/build_datalake.py)
        import subprocess
        try:
            out = subprocess.run(["/usr/bin/curl", "-s", "-A", USER_AGENT, url],
                                 capture_output=True, timeout=90)
            return out.stdout if out.returncode == 0 and out.stdout else None
        except Exception:
            log(f"WARNING http fail {url}: {e}")
            return None


def datalake_folder(ticker: str) -> Path:
    p = DATALAKE / ticker
    if p.exists():
        return p
    alt = DATALAKE / ticker.replace("-", ".")
    if alt.exists():
        return alt
    return p


def enrich_path(ticker: str) -> Path | None:
    for cand in (ticker.lower(), ticker.lower().replace(".", "-"), ticker.lower().replace("-", ".")):
        p = ENRICH_DIR / f"{cand}.json"
        if p.exists():
            return p
    return None


# ---------- (a) DOWNLOAD FILINGS ----------
# form normalise -> dossier data-lake (arborescence existante : DEF14A/ existe deja)
FORM_DIRS = {
    "10-K": "10K", "10-Q": "10Q", "8-K": "8K", "DEF 14A": "DEF14A",
    "S-1": "S1", "S-4": "S4", "424B": "424B",
    "SC 13D": "SC13D", "SC 13G": "SC13G", "4": "FORM4",
}
# Forms pouvant se repeter a la meme date : accession dans le nom de fichier
MULTI_PER_DATE = {"8-K", "424B", "SC 13D", "SC 13G", "4"}


def download_filings(ticker: str, cik: str, filings: list[dict]) -> tuple[list[str], list[str]]:
    """Telecharge les filings dans data-lake/<T>/. Retourne (paths ok, erreurs)."""
    folder = datalake_folder(ticker)
    name = folder.name  # nommage fichiers = nom du dossier data-lake (ex BRK.B)
    ok: list[str] = []
    errs: list[str] = []
    for f in filings:
        form_norm = f.get("form_norm") or f["form"]
        form_dir = FORM_DIRS.get(
            form_norm, form_norm.replace("-", "").replace(" ", "").replace("/", ""))
        target_dir = folder / form_dir
        target_dir.mkdir(parents=True, exist_ok=True)
        if form_norm in MULTI_PER_DATE:
            fname = f"{name}_{f['date']}_{f['accession']}.htm.gz"
        else:
            fname = f"{name}_{f['date']}.htm.gz"
        target = target_dir / fname
        if target.exists():
            ok.append(str(target.relative_to(ROOT)))
            continue  # resume-safe
        if not f.get("primary_doc"):
            errs.append(f"{f['form']} {f['date']}: no primary_doc")
            continue
        acc_nodash = f["accession"].replace("-", "")
        url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc_nodash}/{f['primary_doc']}"
        content = http_get(url)
        time.sleep(THROTTLE_S)
        if not content:
            errs.append(f"{f['form']} {f['date']}: download fail")
            continue
        with gzip.open(target, "wb") as gz:
            gz.write(content)
        ok.append(str(target.relative_to(ROOT)))
        log(f"  down {ticker} {f['form']} {f['date']} -> {target.relative_to(ROOT)}")
    return ok, errs


# ---------- (b) REFRESH XBRL FACTS ----------
def period_type(start: str | None, end: str) -> str:
    if not start:
        return "instant"
    try:
        import datetime as dt
        d = (dt.date.fromisoformat(end) - dt.date.fromisoformat(start)).days
    except Exception:
        return "?"
    if 80 <= d <= 100:
        return "quarter"
    if 350 <= d <= 380:
        return "year"
    return "other"


def refresh_facts(ticker: str, cik: str) -> tuple[int, str | None]:
    """Regenere data-lake/<T>/xbrl/facts.json depuis companyfacts. Retourne (n facts, err)."""
    raw = http_get(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json")
    time.sleep(THROTTLE_S)
    if not raw:
        return 0, "companyfacts_unreachable"
    try:
        cf = json.loads(raw)
    except Exception:
        return 0, "companyfacts_bad_json"
    usg = cf.get("facts", {}).get("us-gaap", {})
    recs = []
    for tag, mkey in REGISTRY.items():
        node = usg.get(tag)
        if not node:
            continue
        for unit, arr in node.get("units", {}).items():
            for e in arr:
                end = e.get("end")
                if not end or end < CUTOFF:
                    continue
                if e.get("form") not in ("10-K", "10-Q", "20-F", "40-F"):
                    continue
                pt = period_type(e.get("start"), end)
                if pt not in ("quarter", "year", "instant"):
                    continue
                recs.append((ticker, mkey, "financier", pt, end, float(e["val"]), unit,
                             "USD" if unit == "USD" else unit, e.get("form"),
                             f"accn:{e.get('accn')}", "xbrl",
                             f"us-gaap:{tag} {e.get('fy')}{e.get('fp')}", f"{e.get('fy')}{e.get('fp')}"))
    seen = set()
    clean = []
    for r in recs:
        k = (r[0], r[1], r[3], r[4])
        if k in seen:
            continue
        seen.add(k)
        clean.append(r)
    if not clean:
        return 0, "no_registry_facts"
    folder = datalake_folder(ticker)
    xdir = folder / "xbrl"
    xdir.mkdir(parents=True, exist_ok=True)
    fpath = xdir / "facts.json"
    if fpath.exists():
        # backup avant remplacement (data preservation)
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(fpath, BACKUP_DIR / f"{folder.name}_facts.json.bak")
    fpath.write_text(json.dumps(
        [{"metric": r[1], "period_type": r[3], "period_end": r[4],
          "value": r[5], "unit": r[6], "ref": r[9]} for r in clean]), "utf8")
    # best-effort SQLite (meme schema que build_datalake.py)
    try:
        con = sqlite3.connect(DB_PATH)
        con.execute("""CREATE TABLE IF NOT EXISTS facts(
          ticker TEXT, metric_key TEXT, bloc TEXT, period_type TEXT, period_end TEXT,
          value REAL, unit TEXT, currency TEXT, source_doc TEXT, source_ref TEXT,
          extracted_by TEXT, citation TEXT, fiscal_period TEXT,
          UNIQUE(ticker, metric_key, period_type, period_end, source_ref))""")
        con.executemany("INSERT OR IGNORE INTO facts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", clean)
        con.commit()
        con.close()
    except Exception as e:
        log(f"  WARNING sqlite insert {ticker}: {e}")
    return len(clean), None


# ---------- (c) EXTRACTION KPI STANDARD (adapte de extract.py top10) ----------
def load_facts(ticker: str):
    p = datalake_folder(ticker) / "xbrl" / "facts.json"
    if not p.exists():
        return None
    return json.loads(p.read_text("utf8"))


def facts_by_metric(facts, metric, ptype):
    out, seen = [], set()
    for x in facts or []:
        if x["metric"] != metric or x["period_type"] != ptype:
            continue
        pe = x["period_end"]
        if pe in seen:
            continue
        seen.add(pe)
        out.append({"date": pe, "value": float(x["value"])})
    out.sort(key=lambda r: r["date"])
    return out


def fmt_year(date_str: str) -> str:
    return f"FY{date_str[:4]}"


def fmt_quarter(date_str: str) -> str:
    d = datetime.strptime(date_str, "%Y-%m-%d")
    return f"{d.year}-Q{(d.month - 1) // 3 + 1}"


def scale(value: float, unit: str):
    if unit == "$M":
        return round(value / 1e6, 2)
    if unit == "$":
        return round(value, 4)
    if unit == "%":
        return round(value * 100, 2)
    return value


def build_series(facts, spec, ptype):
    if spec["compute"] is None:
        rows = facts_by_metric(facts, spec["metric"], ptype)
        if not rows:
            return None, None, None
        if ptype == "instant":
            by_year = {}
            for r in rows:
                y = r["date"][:4]
                if y not in by_year or r["date"] > by_year[y]["date"]:
                    by_year[y] = r
            rows = sorted(by_year.values(), key=lambda x: x["date"])
        vals = [scale(r["value"], spec["unit"]) for r in rows]
        periods = ([fmt_year(r["date"]) for r in rows] if ptype in ("year", "instant")
                   else [fmt_quarter(r["date"]) for r in rows])
        return vals, periods, rows[-1]["date"]

    def ratio(num_metric, den_metric):
        num = {r["date"]: r["value"] for r in facts_by_metric(facts, num_metric, ptype)}
        den = {r["date"]: r["value"] for r in facts_by_metric(facts, den_metric, ptype)}
        keys = sorted(k for k in set(num) & set(den) if den[k])
        if not keys:
            return None, None, None
        vals = [round(num[k] / den[k] * 100, 2) for k in keys]
        return vals, [fmt_year(k) for k in keys], keys[-1]

    if spec["compute"] == "op_margin":
        return ratio("operating_income", "revenue")
    if spec["compute"] == "gross_margin":
        return ratio("gross_profit", "revenue")
    if spec["compute"] == "fcf":
        ocf = {r["date"]: r["value"] for r in facts_by_metric(facts, "operating_cash_flow", ptype)}
        cx = {r["date"]: r["value"] for r in facts_by_metric(facts, "capex", ptype)}
        keys = sorted(set(ocf) & set(cx))
        if not keys:
            return None, None, None
        vals = [round((ocf[k] - cx[k]) / 1e6, 2) for k in keys]
        return vals, [fmt_year(k) for k in keys], keys[-1]
    return None, None, None


def compute_yoy(vals: list, periods: list) -> float | None:
    """YoY du dernier point vs meme periode annee-1 (via labels de periode)."""
    if not vals or not periods or len(vals) != len(periods):
        return None
    last_p = periods[-1]
    if last_p.startswith("FY"):
        target = f"FY{int(last_p[2:]) - 1}"
    else:
        m = re.match(r"^(\d{4})-(Q\d)$", last_p)
        if not m:
            return None
        target = f"{int(m.group(1)) - 1}-{m.group(2)}"
    if target not in periods:
        return None
    prev = vals[periods.index(target)]
    cur = vals[-1]
    if not isinstance(prev, (int, float)) or prev == 0:
        return None
    return round((cur / prev - 1) * 100, 1)


def refresh_kpis(ticker: str) -> dict:
    """Etend histories + met a jour value/yoy/last_data_date. Zero invention."""
    epath = enrich_path(ticker)
    if not epath:
        return {"status": "no_enrich_file", "updated": [], "added": [], "failed": []}
    facts = load_facts(ticker)
    if facts is None:
        return {"status": "no_xbrl", "updated": [], "added": [], "failed": []}

    enrich = json.loads(epath.read_text("utf8"))
    # backup avant modification (data preservation)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(epath, BACKUP_DIR / f"{epath.name}.bak")

    existing = {}
    for k in enrich.get("kpis", []):
        s = (k.get("short") or "").strip().lower()
        if s:
            existing[s] = k

    added, updated, failed = [], [], []
    kpi_points = []  # VERROU 1 (Yann 16 juil 2026) : points exposés pour la
                     # contre-vérification indépendante qr-lock1-dual-check.py
    for short, spec in STD.items():
        ptypes = (["quarter"] if spec["period"] == "both"
                  else ["instant"] if spec["period"] == "instant" else ["year"])
        for pt in ptypes:
            label = short
            for alias in ALIASES.get(short, []):
                if alias.strip().lower() in existing:
                    label = alias
                    break
            vals, periods, ldd = build_series(facts, spec, pt)
            if not vals or len(vals) < 3:
                failed.append({"kpi": label, "period_type": pt, "reason": "insufficient_data"})
                continue
            yoy = compute_yoy(vals, periods)
            kpi_obj = {
                "short": label,
                "name_fr": spec["name_fr"],
                "value": vals[-1],
                "history": vals,
                "history_periods": periods,
                "last_data_date": ldd,
                "period_type": pt,
                "unit": spec["unit"],
                "method": "llm-filing-crosschecked",
                "source": f"XBRL facts.json (SEC EDGAR) — {ticker}",
            }
            if yoy is not None:
                kpi_obj["yoy"] = yoy
            # VERROU 1 : valeur brute en dollars pour comparaison au document.
            if spec.get("metric"):
                scale = 1e6 if spec["unit"] == "$M" else 1.0
                kpi_points.append({
                    "metric": spec["metric"],
                    "period_end": ldd,
                    "value": vals[-1] * scale,
                    "kpi": label,
                })
            key = label.strip().lower()
            if key in existing:
                ex = existing[key]
                ex_ldd = ex.get("last_data_date") or ""
                # met a jour si la serie s'etend OU si champs manquants
                if (len(ex.get("history", [])) < len(vals)
                        or (ldd and ldd > ex_ldd)
                        or not ex.get("history_periods")
                        or not ex.get("last_data_date")):
                    ex.update(kpi_obj)
                    updated.append(label)
            else:
                enrich.setdefault("kpis", []).append(kpi_obj)
                added.append(label)
    epath.write_text(json.dumps(enrich, ensure_ascii=False, indent=2), "utf8")
    return {"status": "ok", "updated": updated, "added": added, "failed": failed,
            "kpi_points": kpi_points,
            "enrich_file": str(epath.relative_to(ROOT))}


# ---------- (d) TODO LLM ----------
# Tous les blocs LLM possibles (portes par le mapping FORM_TO_BLOCKS /
# EIGHTK_ITEM_BLOCKS de quarterly-refresh-detect.py). "kpi" = auto, exclu.
ALL_LLM_BLOCKS = [
    "ec_synthesis",            # synthese Earning Call (10-Q/10-K/8-K 2.02)
    "stories_rotation",        # rotation KPI Stories (spec dediee)
    "risks",                   # risques (10-K, 8-K 2.05/2.06)
    "segments_geo",            # repartition CA segments/geo (10-Q/10-K)
    "events",                  # evenements materiels (8-K, S-1/S-4, 424B)
    "profit_warning",          # a evaluer si ER negatif (8-K 2.02)
    "governance",              # bloc Gouvernance & remuneration entier (DEF 14A, 8-K 5.02)
    "governance_top_holders",  # top holders (SC 13D/G)
    "dilution",                # emissions/fusions (S-1, S-4, 424B)
    "description",             # description ste (10-K Item 1)
    "headcount",               # effectifs (10-K)
    "ai_positioning",          # positionnement IA (10-K Items 1/1A)
]


def llm_flags(filings: list[dict], downloaded_paths: list[str]) -> dict:
    """Union des blocs LLM alimentes par les filings detectes (champ 'blocks'
    pose par detect.py). Fallback legacy si 'blocks' absent."""
    blocks: set[str] = set()
    for f in filings:
        if f.get("blocks"):
            blocks.update(f["blocks"])
        else:  # legacy (detected.json ancien format)
            form = f.get("form_norm") or f["form"]
            if form in ("10-Q", "10-K"):
                blocks.update(["kpi", "segments_geo", "ec_synthesis", "stories_rotation"])
            if form == "10-K":
                blocks.update(["risks", "description", "headcount", "ai_positioning"])
            if form == "8-K":
                blocks.update(["kpi", "ec_synthesis", "stories_rotation",
                               "profit_warning", "events"])
    blocks.discard("kpi")  # bloc auto (XBRL), fait par ce script
    return {b: (b in blocks) for b in ALL_LLM_BLOCKS}


def append_todo_llm(ticker: str, item: dict, filings: list[dict], paths: list[str]) -> dict:
    todo = {"updated_at": None, "todo": {}}
    if TODO_LLM_PATH.exists():
        try:
            todo = json.loads(TODO_LLM_PATH.read_text("utf8"))
        except Exception:
            pass
    todo.setdefault("todo", {})
    prev = todo["todo"].get(ticker, {})
    flags = llm_flags(filings, paths)
    # merge : ne jamais degrader un flag deja true non traite
    for k, v in (prev.get("flags") or {}).items():
        if v is True:
            flags[k] = True
    entry = {
        "detected_at": datetime.now(timezone.utc).isoformat(),
        "type": item["type"],
        "forms": sorted({f["form"] for f in filings}),
        "filing_paths": sorted(set((prev.get("filing_paths") or []) + paths)),
        "flags": flags,
        "spec_stories": ".conv-state/quarterly-stories-rotation-spec.md",
    }
    todo["todo"][ticker] = entry
    todo["updated_at"] = datetime.now(timezone.utc).isoformat()
    TODO_LLM_PATH.write_text(json.dumps(todo, ensure_ascii=False, indent=2), "utf8")
    return flags


# ---------- STATE ----------
def mark_state(ticker: str, filings: list[dict]) -> None:
    state = {"tickers": {}, "updated_at": None}
    if STATE_PATH.exists():
        try:
            state = json.loads(STATE_PATH.read_text("utf8"))
        except Exception:
            pass
    state.setdefault("tickers", {})
    entry = state["tickers"].get(ticker) or {}
    accs = set(entry.get("processed_accessions") or [])
    accs.update(f["accession"] for f in filings)
    dates = [f["date"] for f in filings]
    baseline = entry.get("baseline_date") or ""
    entry.update({
        "processed_accessions": sorted(accs)[-60:],  # cap raisonnable
        "baseline_date": max([baseline] + dates),
        "last_accession": filings[-1]["accession"],
        "last_form": filings[-1]["form"],
        "last_refresh_at": datetime.now(timezone.utc).isoformat(),
    })
    state["tickers"][ticker] = entry
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), "utf8")


# ---------- MAIN ----------
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--detected", default=str(DETECTED_PATH))
    ap.add_argument("--tickers", help="filtre sur ces tickers uniquement")
    args = ap.parse_args()

    dpath = Path(args.detected)
    if not dpath.exists():
        log(f"FATAL: fichier detected introuvable : {dpath}")
        return 1
    detected = json.loads(dpath.read_text("utf8")).get("detected") or []
    if args.tickers:
        keep = {t.strip().upper() for t in args.tickers.split(",")}
        detected = [d for d in detected if d["ticker"] in keep]

    results = []
    for item in detected:
        t = item["ticker"]
        log(f"=== {t} ({item['type']}, {len(item['filings'])} filing(s)) ===")
        errors: list[str] = []
        paths, dl_errs = download_filings(t, item["cik"], item["filings"])
        errors.extend(dl_errs)
        n_facts, facts_err = refresh_facts(t, item["cik"])
        if facts_err:
            errors.append(f"xbrl: {facts_err}")
        kpi = refresh_kpis(t)
        if kpi["status"] != "ok":
            errors.append(f"kpi: {kpi['status']}")
        flags = append_todo_llm(t, item, item["filings"], paths)
        mark_state(t, item["filings"])  # resume-safe : marque apres traitement
        results.append({
            "ticker": t,
            "type": item["type"],
            "filings_downloaded": paths,
            "xbrl_facts": n_facts,
            "blocks_auto": {
                "filings_download": bool(paths),
                "xbrl_facts": n_facts > 0,
                "kpi_updated": kpi.get("updated", []),
                "kpi_points": kpi.get("kpi_points", []),
                "kpi_added": kpi.get("added", []),
                "kpi_failed": kpi.get("failed", []),
            },
            "blocks_pending_llm": {k: v for k, v in flags.items() if v},
            "errors": errors,
        })
        log(f"  {t}: facts={n_facts} kpi_updated={len(kpi.get('updated', []))} "
            f"kpi_added={len(kpi.get('added', []))} errors={len(errors)}")

    payload = {
        "run_at": datetime.now(timezone.utc).isoformat(),
        "processed": len(results),
        "results": results,
    }
    RESULT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), "utf8")
    log(f"Ecrit {RESULT_PATH} ({len(results)} ste(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
