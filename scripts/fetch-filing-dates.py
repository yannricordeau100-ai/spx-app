#!/usr/bin/env python3
"""
fetch-filing-dates.py — récupère la date du dernier earning filé sur SEC
EDGAR pour chaque ticker du top 307 V1.8.

Pour chaque sté :
  1. Lookup CIK via ticker (table SEC officielle).
  2. Appel `data.sec.gov/submissions/CIK<X>.json` (gratuit, illimité).
  3. Récupère le dernier filing 10-Q (ou 10-K si plus récent qu'un 10-Q).
  4. Stocke dans `src/data/v2-pipeline-enrich/<t>.json` champ `latest_filing` :
       {
         "date":       "2026-04-22",  // filed date (publication)
         "form":       "10-Q",
         "period_end": "2026-03-31",  // fin de période fiscale couverte
         "fetched_at": "2026-05-10T22:00:00Z"
       }

Audit : produit aussi `src/data/v2-freshness-audit.json` avec les stés où
`latest_filing.period_end > last_data_date` du KPI hero local (= sté en retard,
on a l'annonce SEC mais pas encore intégré sur la page).

Pour les FPI européennes (.PA / .DE / .L / etc.) qui ne déposent pas SEC :
fallback yfinance `quarterly_earnings_dates` pour une date approchée.

Usage :
  python3 scripts/fetch-filing-dates.py [--top N] [--ticker X]

Rate limit SEC : 10 req/s avec User-Agent valide. On limite à 8 req/s.
"""
from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENR_DIR = ROOT / "src/data/v2-pipeline-enrich"
V18 = ROOT / "src/data/v1-8-tickers-sorted.json"
AUDIT = ROOT / "src/data/v2-freshness-audit.json"
PIPELINE = ROOT / "src/data/v2-pipeline"

USER_AGENT = "Mettrik AI yannricordeau100@gmail.com"
SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SEC_SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
SEC_DELAY = 0.13  # ~8 req/s

try:
    import certifi
    _SSL = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _SSL = ssl.create_default_context()


def fetch_json(url: str, retries: int = 3) -> dict | None:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=20, context=_SSL) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code == 429 and attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            return None
        except Exception:
            if attempt < retries - 1:
                time.sleep(1)
                continue
            return None
    return None


def load_cik_map() -> dict[str, str]:
    """Renvoie ticker(uppercase) → CIK (10 digits zero-padded)."""
    print("Téléchargement table CIK SEC...", flush=True)
    data = fetch_json(SEC_TICKERS_URL)
    if not data:
        print("ERR : impossible de récupérer la table SEC tickers.", file=sys.stderr)
        sys.exit(1)
    out = {}
    for v in data.values():
        if isinstance(v, dict):
            t = str(v.get("ticker", "")).upper()
            c = str(v.get("cik_str", ""))
            if t and c:
                out[t] = c.zfill(10)
    print(f"  {len(out)} tickers dans la table SEC")
    return out


def parse_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except Exception:
        return None


def fetch_latest_filing(cik: str) -> dict | None:
    """Renvoie {date, form, period_end} du dernier 10-Q/10-K/20-F/6-K (publié)."""
    data = fetch_json(SEC_SUBMISSIONS_URL.format(cik=cik))
    if not data:
        return None
    recent = (data.get("filings") or {}).get("recent") or {}
    forms = recent.get("form") or []
    filed = recent.get("filingDate") or []
    period = recent.get("reportDate") or []
    # On accepte 10-Q, 10-K, 20-F (FPI annual), 6-K (FPI interim).
    # FIX 10 mai 2026 (Yann) : prendre le filing dont la PÉRIODE FISCALE est
    # la plus récente, pas la date de filing. Sinon un 10-K/A déposé après
    # un 10-Q écrase le 10-Q (TSLA bug observé : 10-K/A 2026-04-30 pour
    # FY2025 cachait le 10-Q Q1 2026).
    best = None
    for i in range(min(len(forms), len(filed), len(period))):
        f = forms[i]
        if f not in ("10-Q", "10-K", "10-K/A", "10-Q/A", "20-F", "20-F/A", "6-K"):
            continue
        try:
            pe = datetime.fromisoformat(period[i])
        except Exception:
            continue
        if best is None:
            best = {"date": filed[i], "form": f, "period_end": period[i]}
            continue
        try:
            cur_pe = datetime.fromisoformat(best["period_end"])
        except Exception:
            cur_pe = None
        # Plus récent par période fiscale, ou égalité → on garde le filed le plus récent
        if cur_pe is None or pe > cur_pe:
            best = {"date": filed[i], "form": f, "period_end": period[i]}
        elif pe == cur_pe:
            try:
                if datetime.fromisoformat(filed[i]) > datetime.fromisoformat(best["date"]):
                    best = {"date": filed[i], "form": f, "period_end": period[i]}
            except Exception:
                pass
    return best


def get_local_last_data_date(ticker: str) -> str | None:
    """Renvoie `last_data_date` du hero KPI dans v2-pipeline/<t>.json."""
    p = PIPELINE / f"{ticker.lower()}.json"
    if not p.exists():
        return None
    try:
        d = json.loads(p.read_text())
    except Exception:
        return None
    hero = d.get("hero_kpi")
    kpis = d.get("kpis") or []
    if not isinstance(kpis, list):
        return None
    target = None
    for k in kpis:
        if isinstance(k, dict) and k.get("short") == hero:
            target = k
            break
    if target is None and kpis:
        target = kpis[0]
    if isinstance(target, dict):
        return target.get("last_data_date")
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=307)
    ap.add_argument("--ticker", help="Forcer un seul ticker")
    args = ap.parse_args()

    cik_map = load_cik_map()
    if args.ticker:
        tickers = [args.ticker.upper()]
    else:
        sorted_list = json.loads(V18.read_text())
        tickers = sorted_list[: args.top]

    written = 0
    no_cik = 0
    no_filing = 0
    audit_stale = []  # stés en retard
    audit_ok = []

    for t in tickers:
        # Normalise pour SEC : on cherche le sous-ticker US (avant le .)
        tu = t.upper()
        cik = cik_map.get(tu)
        # Cas BRK-B → BRK.B sur SEC, ou .PA / .L / etc → pas dans SEC US
        if not cik and "-" in tu:
            cik = cik_map.get(tu.replace("-", "."))
        if not cik:
            no_cik += 1
            print(f"  · {t} : pas dans SEC (FPI EU probablement)", flush=True)
            continue

        time.sleep(SEC_DELAY)
        filing = fetch_latest_filing(cik)
        if not filing:
            no_filing += 1
            print(f"  ⚠ {t} : pas de 10-Q/10-K/20-F/6-K trouvé", flush=True)
            continue

        # Merge dans v2-pipeline-enrich/<t>.json
        out_path = ENR_DIR / f"{t.lower()}.json"
        existing = {}
        if out_path.exists():
            try:
                existing = json.loads(out_path.read_text())
            except Exception:
                existing = {}
        existing["ticker"] = t
        existing["latest_filing"] = {
            **filing,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(existing, indent=2, ensure_ascii=False))
        written += 1

        # Audit : SEC plus récent que local ?
        local_last = get_local_last_data_date(t)
        sec_period = filing.get("period_end")
        if local_last and sec_period:
            try:
                if datetime.fromisoformat(sec_period) > datetime.fromisoformat(local_last):
                    audit_stale.append(
                        {
                            "ticker": t,
                            "local_last_data_date": local_last,
                            "sec_period_end": sec_period,
                            "sec_filing_date": filing["date"],
                            "sec_form": filing["form"],
                        }
                    )
                else:
                    audit_ok.append(t)
            except Exception:
                pass

        print(f"  ✓ {t} : {filing['form']} filé {filing['date']} (période {filing.get('period_end')})", flush=True)

    # Écriture audit
    AUDIT.write_text(
        json.dumps(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "tickers_checked": len(tickers),
                "written": written,
                "no_cik": no_cik,
                "no_filing": no_filing,
                "stale_count": len(audit_stale),
                "stale": audit_stale,
                "up_to_date_count": len(audit_ok),
            },
            indent=2,
            ensure_ascii=False,
        )
    )

    print(
        f"\n✅ {written}/{len(tickers)} stés enrichies · {no_cik} pas dans SEC (FPI EU) · "
        f"{no_filing} sans filing récent · {len(audit_stale)} en retard (SEC > local) · "
        f"{len(audit_ok)} à jour",
        flush=True,
    )
    print(f"Audit : {AUDIT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
