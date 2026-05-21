#!/usr/bin/env python3
"""
refresh-freshness-yf-v19.py — refresh last_data_date pour les 549 publishable V1.9.

Pour chaque sté du fichier src/data/v1-9-publishable.json dont le hero KPI
n'a pas last_data_date OU dont last_data_date est > 12 mois :
  1. Fetch yfinance.info (mostRecentQuarter + lastFiscalYearEnd)
  2. Prendre le plus récent des deux
  3. Écrire le résultat sur le hero KPI dans src/data/v2-pipeline-enrich/<t>.json
     via le champ kpis_freshness_overrides (n'écrase pas v2-pipeline/ scope CONV-DATA)
  4. Si yfinance retourne rien (HTTP 401 anti-bot, delisted, OTC) → flag
     _freshness_unavailable:true

Output : src/data/v1-9-publishable-freshness-refresh.json (rapport)
"""
import json
import os
import sys
import time
import argparse
from datetime import datetime, timezone
from pathlib import Path

try:
    import yfinance as yf
except ImportError:
    print("ERROR: yfinance not installed (pip install yfinance)", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
PUB_FILE = ROOT / "src/data/v1-9-publishable.json"
PIPE = ROOT / "src/data/v2-pipeline"
ENRICH = ROOT / "src/data/v2-pipeline-enrich"
REPORT = ROOT / "src/data/v1-9-publishable-freshness-refresh.json"

NOW = datetime.now(timezone.utc)


def months_diff(iso_date: str) -> float | None:
    try:
        dt = datetime.fromisoformat(iso_date).replace(tzinfo=timezone.utc)
        return (NOW - dt).days / 30.44
    except Exception:
        return None


def find_hero_kpi(d: dict) -> dict | None:
    hero = d.get("hero_kpi")
    if not hero:
        return None
    kpis = d.get("kpis", []) or []
    h = next((k for k in kpis if k.get("short") == hero), None)
    if not h:
        hl = hero.lower()
        h = next(
            (k for k in kpis if isinstance(k.get("short"), str)
             and (hl in k["short"].lower() or k["short"].lower() in hl)),
            None,
        )
    return h


def collect_ko(pub_tickers: list[str]) -> list[dict]:
    """Identifie les stés à rafraîchir (hero KPI sans last_data_date OU > 12 mois)."""
    ko = []
    for tk in pub_tickers:
        f = PIPE / f"{tk.lower()}.json"
        if not f.exists():
            continue
        try:
            d = json.loads(f.read_text())
        except Exception:
            continue
        h = find_hero_kpi(d)
        if not h:
            continue
        ldd = h.get("last_data_date")
        if not ldd:
            ko.append({"ticker": tk, "hero": d.get("hero_kpi"), "current": None})
            continue
        m = months_diff(ldd)
        if m is None or m > 12:
            ko.append({"ticker": tk, "hero": d.get("hero_kpi"), "current": ldd, "months": round(m or 0, 1)})
    return ko


def fetch_yf_dates(ticker: str) -> dict:
    """Retourne {mostRecentQuarter, lastFiscalYearEnd, latest, http_status}."""
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        mrq = info.get("mostRecentQuarter")
        lfy = info.get("lastFiscalYearEnd")
        mrq_s = datetime.fromtimestamp(mrq).strftime("%Y-%m-%d") if mrq else None
        lfy_s = datetime.fromtimestamp(lfy).strftime("%Y-%m-%d") if lfy else None
        latest = None
        if mrq_s and lfy_s:
            latest = max(mrq_s, lfy_s)
        else:
            latest = mrq_s or lfy_s
        return {"mrq": mrq_s, "lfy": lfy_s, "latest": latest, "ok": bool(latest)}
    except Exception as e:
        msg = str(e)
        return {"ok": False, "error": msg[:200], "is_401": "401" in msg or "Unauthorized" in msg}


def write_enrich_override(ticker: str, hero: str, latest_date: str) -> bool:
    """Écrit le override dans v2-pipeline-enrich/<t>.json (champ kpis_freshness_overrides)."""
    ef = ENRICH / f"{ticker.lower()}.json"
    if ef.exists():
        try:
            existing = json.loads(ef.read_text())
        except Exception:
            existing = {}
    else:
        existing = {}
    overrides = existing.get("kpis_freshness_overrides", [])
    # Remove any prior override for same hero
    overrides = [o for o in overrides if o.get("short") != hero]
    overrides.append({
        "short": hero,
        "last_data_date": latest_date,
        "source": "yfinance",
        "refreshed_at": NOW.isoformat(),
    })
    existing["kpis_freshness_overrides"] = overrides
    existing["_freshness_yf_v19_refreshed_at"] = NOW.isoformat()
    ENRICH.mkdir(parents=True, exist_ok=True)
    ef.write_text(json.dumps(existing, indent=2, ensure_ascii=False))
    return True


def write_enrich_unavailable(ticker: str) -> None:
    ef = ENRICH / f"{ticker.lower()}.json"
    if ef.exists():
        try:
            existing = json.loads(ef.read_text())
        except Exception:
            existing = {}
    else:
        existing = {}
    existing["_freshness_unavailable"] = True
    existing["_freshness_unavailable_at"] = NOW.isoformat()
    ENRICH.mkdir(parents=True, exist_ok=True)
    ef.write_text(json.dumps(existing, indent=2, ensure_ascii=False))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="Limiter à N stés (debug)")
    ap.add_argument("--sleep", type=float, default=0.3, help="Sleep entre calls yfinance")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    pub = json.loads(PUB_FILE.read_text())["tickers"]
    print(f"Univers publishable V1.9: {len(pub)} stés")

    ko = collect_ko(pub)
    print(f"KO à rafraîchir (hero KPI manquant OU > 12 mois): {len(ko)}")
    if args.limit:
        ko = ko[:args.limit]
        print(f"Limit appliquée: {len(ko)}")

    report = {
        "generated_at": NOW.isoformat(),
        "total_publishable": len(pub),
        "ko_total": len(ko),
        "refreshed_ok": [],
        "unavailable": [],
        "http_401": [],
        "skipped_already_fresh": [],
        "errors": [],
    }

    for i, item in enumerate(ko, 1):
        tk = item["ticker"]
        hero = item["hero"]
        cur = item["current"]
        if args.dry_run:
            print(f"  [{i}/{len(ko)}] DRY {tk} hero={hero} cur={cur}")
            continue
        res = fetch_yf_dates(tk)
        if not res.get("ok"):
            if res.get("is_401"):
                report["http_401"].append({"ticker": tk, "error": res.get("error")})
            else:
                report["errors"].append({"ticker": tk, "error": res.get("error")})
            write_enrich_unavailable(tk)
            report["unavailable"].append(tk)
            print(f"  [{i}/{len(ko)}] ❌ {tk}: {res.get('error', 'no data')[:80]}")
            time.sleep(args.sleep)
            continue

        latest = res["latest"]
        if cur and latest <= cur:
            report["skipped_already_fresh"].append({"ticker": tk, "current": cur, "yf": latest})
            print(f"  [{i}/{len(ko)}] ⏭  {tk}: current={cur} yf={latest} (no improvement)")
            time.sleep(args.sleep)
            continue

        write_enrich_override(tk, hero, latest)
        report["refreshed_ok"].append({
            "ticker": tk,
            "hero": hero,
            "old": cur,
            "new": latest,
            "mrq": res["mrq"],
            "lfy": res["lfy"],
        })
        print(f"  [{i}/{len(ko)}] ✅ {tk}: {cur or 'N/A'} → {latest}")
        time.sleep(args.sleep)

    # Save report
    REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"\nRapport: {REPORT}")
    print(f"  ✅ refreshed: {len(report['refreshed_ok'])}")
    print(f"  ⏭  skipped (already fresh): {len(report['skipped_already_fresh'])}")
    print(f"  ❌ unavailable (no yf data): {len(report['unavailable'])}")
    print(f"  🚫 HTTP 401 anti-bot: {len(report['http_401'])}")
    print(f"  ⚠️ other errors: {len(report['errors'])}")


if __name__ == "__main__":
    main()
