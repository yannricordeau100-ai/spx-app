#!/usr/bin/env python3
"""
Sub-agent #101 — i_events 87 KO yfinance fill (CONV-CONCEPTS leader T2)

Workflow:
- Pour chaque ticker de la liste KO, charge la donnée yfinance:
  * earnings_dates  -> past Q (EPS actual vs estimate, surprise%) + next earnings
  * calendar        -> next earnings_date + next ex-dividend
  * dividends.tail(4) -> projection prochain ex-div
  * info.lastFiscalYearEnd -> estimation AGM
- Construit array events FR avec format:
  {year, month, title, body, source, url, date}
- Écrit:
  src/data/v2-pipeline-enrich/<lower>.events.json (sidecar - source de verite)
  + merge events array dans src/data/v2-pipeline-enrich/<lower>.json
    (sans ecraser ce qui existe deja en dehors d'events)

Source: yfinance officiel uniquement. Aucun LLM. Aucun Cerebras / Groq.
Sleep 0.4s entre tickers pour rate-limit propre.
"""
import json
import os
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

import yfinance as yf
import pandas as pd

REPO = Path(__file__).resolve().parents[2]
DATA = REPO / "src" / "data"
ENRICH_DIR = DATA / "v2-pipeline-enrich"

# Liste 87 i_events KO (audit V1.9 post #99) - on exclut CASY/ODFL (overlap #96)
KO_TICKERS = [
    "1COV.DE", "A2A.MI", "ABVX", "AD.AS", "ARES", "BEN", "BME.L", "BNP.PA",
    "BRK.B", "BT-A.L", "BZU.MI", "CAVA", "CME", "CMG",
    "CNA.L", "COF", "COFB.BR", "CPR.MI", "CRDA.L", "DDOG", "DLTR", "DOC.VI",
    "DPW.DE", "DVA", "ENGI.PA", "EOAN.DE", "FIX", "HER.MI", "HLMA.L", "HO.PA",
    "HOLN.SW", "IMB.L", "ISRG", "IVG.MI", "JBHT", "KNIN.SW", "KO", "L", "LDO.MI",
    "MPC", "NXT.L", "P911.DE", "PHNX.L", "POLY.L", "PROX.BR",
    "PRX.AS", "PSN.L", "PST.MI", "PWR", "RHM.DE", "RNO.PA", "RTO.L", "RWE.DE",
    "SAF.PA", "SGE.L", "SGSN.SW", "SHOP", "SMDS.L", "SPM.MI", "SRG.MI",
    "STLAM.MI", "STLAP.PA", "STLD", "STT", "TEP.PA", "TKA.VI", "TMUS", "TRN.MI",
    "TSCO.L", "TTD", "TTWO", "UAL", "UCB.BR", "ULVR.L", "UMI.BR", "UNA.AS",
    "VER.VI", "VOE.VI", "VOW3.DE", "WDAY", "WDP.BR", "WFC", "WIE.VI", "WIZZ.L",
    "WTB.L",
]
# Note: CASY + ODFL exclus (overlap sub-agent #96 US XBRL pivot)

SLEEP_BETWEEN = 0.4
NOW = datetime.now(timezone.utc)

# Mois FR pour le label "Résultats Q1 2026"
def q_of_month(month: int) -> int:
    return (month - 1) // 3 + 1

def fr_month(month: int) -> str:
    names = ["janvier", "fevrier", "mars", "avril", "mai", "juin",
             "juillet", "aout", "septembre", "octobre", "novembre", "decembre"]
    return names[month - 1]

def safe_float(x):
    try:
        if x is None or pd.isna(x):
            return None
        return float(x)
    except Exception:
        return None

def lc(ticker: str) -> str:
    return ticker.lower()

# Yahoo Finance ticker normalization (Class A/B shares use - not .)
YF_TICKER_OVERRIDES = {
    "BRK.B": "BRK-B",
    "BF.B": "BF-B",
    "BRK.A": "BRK-A",
    "DPW.DE": "DHL.DE",  # Deutsche Post renomme DHL Group
}

def yf_symbol(ticker: str) -> str:
    return YF_TICKER_OVERRIDES.get(ticker, ticker)

def fetch_events_for_ticker(ticker: str):
    """Returns (events_list, debug_info)."""
    t = yf.Ticker(yf_symbol(ticker))
    events = []
    debug = {"ticker": ticker, "ok": False}

    # 1) earnings_dates (past + future Q)
    earnings_past = []
    next_earnings_date = None
    try:
        ed = t.earnings_dates
        if ed is not None and not ed.empty:
            ed = ed.reset_index()
            # ed columns: Earnings Date, EPS Estimate, Reported EPS, Surprise(%)
            for _, row in ed.iterrows():
                date_obj = row.get("Earnings Date")
                if pd.isna(date_obj):
                    continue
                date_str = str(date_obj.date())
                est = safe_float(row.get("EPS Estimate"))
                actual = safe_float(row.get("Reported EPS"))
                surprise = safe_float(row.get("Surprise(%)"))
                is_future = date_obj.to_pydatetime() > NOW
                if is_future:
                    if next_earnings_date is None or date_str < next_earnings_date:
                        next_earnings_date = date_str
                else:
                    earnings_past.append({
                        "date": date_str,
                        "estimate": est,
                        "actual": actual,
                        "surprise": surprise,
                    })
            # garder 4 plus recents past
            earnings_past = sorted(earnings_past, key=lambda x: x["date"], reverse=True)[:4]
            debug["earnings_dates_count"] = int(len(ed))
    except Exception as e:
        debug["earnings_dates_err"] = str(e)[:120]

    # 2) calendar -> next earnings + next ex-div + revenue projections
    next_ex_div = None
    earnings_revenue_avg = None
    earnings_eps_avg = None
    try:
        cal = t.calendar or {}
        ex_div = cal.get("Ex-Dividend Date")
        if ex_div:
            next_ex_div = str(ex_div)
        edates = cal.get("Earnings Date") or []
        if edates and not next_earnings_date:
            next_earnings_date = str(edates[0])
        earnings_revenue_avg = safe_float(cal.get("Revenue Average"))
        earnings_eps_avg = safe_float(cal.get("Earnings Average"))
    except Exception as e:
        debug["calendar_err"] = str(e)[:120]

    # 3) dividends history (pour projection si pas dans calendar)
    div_hist = []
    try:
        divs = t.dividends
        if divs is not None and not divs.empty:
            tail = divs.tail(6)
            for d, v in tail.items():
                div_hist.append({"date": str(d.date()), "value": float(v)})
    except Exception as e:
        debug["dividends_err"] = str(e)[:120]

    # 4) info pour fiscal year end
    last_fy_end = None
    try:
        info = t.info or {}
        ts = info.get("lastFiscalYearEnd")
        if ts:
            last_fy_end = datetime.fromtimestamp(int(ts), tz=timezone.utc).date()
    except Exception as e:
        debug["info_err"] = str(e)[:120]

    # Construction des events FR
    # a) Past earnings (jusqu'a 4)
    for ep in earnings_past:
        date_str = ep["date"]
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
        q = q_of_month(d.month)
        title = f"Resultats Q{q} {d.year} publies"
        body_parts = []
        if ep["actual"] is not None:
            body_parts.append(f"EPS {ep['actual']:.2f}")
            if ep["estimate"] is not None and ep["surprise"] is not None:
                direction = "beat" if ep["surprise"] > 0 else ("miss" if ep["surprise"] < 0 else "in line")
                body_parts.append(
                    f"vs consensus {ep['estimate']:.2f} ({direction} {ep['surprise']:+.1f} %)"
                )
            elif ep["estimate"] is not None:
                body_parts.append(f"vs consensus {ep['estimate']:.2f}")
        body_parts.append(f"Annonce le {d.day} {fr_month(d.month)} {d.year}.")
        events.append({
            "year": d.year,
            "month": d.month,
            "title": title,
            "body": " ".join(body_parts),
            "source": "yfinance.earnings_dates",
            "url": "",
            "date": date_str,
        })

    # b) Next earnings
    if next_earnings_date:
        try:
            d = datetime.strptime(next_earnings_date, "%Y-%m-%d").date()
            q = q_of_month(d.month)
            title = f"Prochaine publication Q{q} {d.year}"
            body = f"Publication attendue le {d.day} {fr_month(d.month)} {d.year}."
            if earnings_eps_avg:
                body += f" Consensus EPS : {earnings_eps_avg:.2f}."
            events.append({
                "year": d.year,
                "month": d.month,
                "title": title,
                "body": body,
                "source": "yfinance.calendar",
                "url": "",
                "date": next_earnings_date,
            })
        except Exception:
            pass

    # c) Next ex-dividend (calendar OU projection cycle div_hist)
    if next_ex_div:
        try:
            d = datetime.strptime(next_ex_div, "%Y-%m-%d").date()
            future = datetime(d.year, d.month, d.day, tzinfo=timezone.utc) > NOW
            label = "Prochain ex-dividende" if future else "Dernier ex-dividende"
            last_amount = None
            if div_hist:
                last_amount = div_hist[-1]["value"]
            body = f"Date ex-dividende : {d.day} {fr_month(d.month)} {d.year}."
            if last_amount is not None:
                body += f" Montant precedent : {last_amount:.4f}."
            events.append({
                "year": d.year,
                "month": d.month,
                "title": label,
                "body": body,
                "source": "yfinance.calendar",
                "url": "",
                "date": next_ex_div,
            })
        except Exception:
            pass
    elif len(div_hist) >= 2:
        # Projection cycle annuel : dernier ex-div + 1 an
        try:
            last = div_hist[-1]
            d = datetime.strptime(last["date"], "%Y-%m-%d").date()
            projected = d.replace(year=d.year + 1)
            events.append({
                "year": projected.year,
                "month": projected.month,
                "title": "Prochain ex-dividende (estimation cycle)",
                "body": (f"Estimation basee sur cycle annuel : {projected.day} "
                         f"{fr_month(projected.month)} {projected.year}. "
                         f"Dernier montant : {last['value']:.4f}."),
                "source": "yfinance.dividends",
                "url": "",
                "date": projected.isoformat(),
            })
        except Exception:
            pass

    # d') Past dividends (jusqu'a 3, hors le dernier deja inclus) - utile pour
    # tickers UK/EU semi-annuels avec peu d'earnings_dates
    if len(deduped if False else events) < 6 and div_hist:
        # Inclure les 3 derniers ex-div passes (hors le tout dernier deja dans next_ex_div)
        past_divs = sorted(div_hist, key=lambda x: x["date"], reverse=True)
        # Skip si deja inclus comme next_ex_div
        skipped = 0
        for dv in past_divs[:5]:
            try:
                d = datetime.strptime(dv["date"], "%Y-%m-%d").date()
            except Exception:
                continue
            if next_ex_div and dv["date"] == next_ex_div:
                continue
            # Eviter doublons proches
            already = any(e["date"] == dv["date"] and "dividende" in e["title"].lower() for e in events)
            if already:
                continue
            events.append({
                "year": d.year,
                "month": d.month,
                "title": "Ex-dividende paye",
                "body": f"Ex-dividende du {d.day} {fr_month(d.month)} {d.year} : {dv['value']:.4f}.",
                "source": "yfinance.dividends",
                "url": "",
                "date": dv["date"],
            })
            skipped += 1
            if skipped >= 3:
                break

    # d) AGM estimate (last_fy_end + ~4 mois)
    if last_fy_end:
        try:
            agm_month = ((last_fy_end.month + 3) - 1) % 12 + 1
            agm_year = last_fy_end.year + (1 if last_fy_end.month + 3 > 12 else 0)
            # Si lastFiscalYearEnd appartient deja a une AG passee, projette
            # +1 an pour avoir la prochaine
            agm_date_obj = datetime(agm_year, agm_month, 15, tzinfo=timezone.utc).date()
            if agm_date_obj < NOW.date():
                agm_year += 1
                agm_date_obj = agm_date_obj.replace(year=agm_year)
            events.append({
                "year": agm_date_obj.year,
                "month": agm_date_obj.month,
                "title": "Assemblee generale (estimation)",
                "body": (f"Estimation basee sur fin d'exercice precedente : "
                         f"AG attendue vers {fr_month(agm_date_obj.month)} "
                         f"{agm_date_obj.year}."),
                "source": "yfinance.info.lastFiscalYearEnd",
                "url": "",
                "date": agm_date_obj.isoformat(),
            })
        except Exception:
            pass

    # Dedup par (title+date)
    seen = set()
    deduped = []
    for e in events:
        key = (e["title"][:60].lower(), e["date"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(e)

    # tri date desc (les plus recents/proches en premier)
    deduped.sort(key=lambda e: e["date"], reverse=True)

    debug["events_built"] = len(deduped)
    if len(deduped) >= 4:
        debug["ok"] = True

    return deduped, debug


def merge_into_main_enrich(ticker_lc: str, new_events: list):
    """Merge events dans <lower>.json sans ecraser le reste."""
    main_path = ENRICH_DIR / f"{ticker_lc}.json"
    data = {}
    if main_path.exists():
        try:
            data = json.loads(main_path.read_text())
        except Exception:
            data = {}
    if "ticker" not in data:
        data["ticker"] = ticker_lc.upper()
    # Dedup avec events existant (priorite a new_events si meme date+title)
    existing = data.get("events") if isinstance(data.get("events"), list) else []
    combined = []
    seen = set()
    for src in (new_events, existing):
        for e in src or []:
            if not isinstance(e, dict):
                continue
            key = (str(e.get("title", ""))[:60].lower(), str(e.get("date", "")))
            if key in seen:
                continue
            seen.add(key)
            combined.append(e)
    combined.sort(key=lambda e: str(e.get("date", "")), reverse=True)
    data["events"] = combined[:10]
    data["_events_sub_agent_101_fill_at"] = NOW.isoformat()
    data["_events_sub_agent_101_source"] = "yfinance-batch (earnings_dates + calendar + dividends + info)"
    main_path.write_text(json.dumps(data, ensure_ascii=False, indent=2))


def write_sidecar(ticker: str, ticker_lc: str, events: list, debug: dict):
    sidecar = ENRICH_DIR / f"{ticker_lc}.events.json"
    payload = {
        "ticker": ticker,
        "fetched_at": NOW.isoformat(),
        "events": events,
        "_source": "sub-agent-101-yfinance-batch",
        "_verified_at": NOW.isoformat(),
        "_debug": debug,
    }
    sidecar.write_text(json.dumps(payload, ensure_ascii=False, indent=2))


def main():
    if len(sys.argv) > 1:
        # mode batch : python fill-events.py <batch_index> <batch_size>
        # ex: python fill-events.py 0 40 -> tickers[0:40]
        start = int(sys.argv[1])
        size = int(sys.argv[2]) if len(sys.argv) > 2 else len(KO_TICKERS)
        tickers = KO_TICKERS[start:start + size]
        batch_label = f"batch_{start}_{start + size}"
    else:
        tickers = KO_TICKERS
        batch_label = "all"

    print(f"[#101] Processing {len(tickers)} tickers ({batch_label})")

    results = {"ok": [], "partial": [], "fail": []}
    for i, ticker in enumerate(tickers):
        try:
            events, debug = fetch_events_for_ticker(ticker)
        except Exception as e:
            print(f"  [{i+1}/{len(tickers)}] {ticker}: FAIL {type(e).__name__}: {str(e)[:120]}")
            results["fail"].append({"ticker": ticker, "err": str(e)[:200]})
            time.sleep(SLEEP_BETWEEN)
            continue

        ticker_lc = lc(ticker)
        # ALWAYS write sidecar (audit trail), even partial
        write_sidecar(ticker, ticker_lc, events, debug)

        if len(events) >= 4:
            merge_into_main_enrich(ticker_lc, events)
            results["ok"].append({"ticker": ticker, "events": len(events)})
            status = "OK"
        elif len(events) > 0:
            # Still merge what we have - audit comptes events[]
            merge_into_main_enrich(ticker_lc, events)
            results["partial"].append({"ticker": ticker, "events": len(events)})
            status = "PARTIAL"
        else:
            results["fail"].append({"ticker": ticker, "err": "no events from yfinance"})
            status = "EMPTY"

        print(f"  [{i+1}/{len(tickers)}] {ticker}: {status} ({len(events)} events)")
        time.sleep(SLEEP_BETWEEN)

    summary = {
        "sub_agent": 101,
        "batch": batch_label,
        "finished_at": NOW.isoformat(),
        "ok_count": len(results["ok"]),
        "partial_count": len(results["partial"]),
        "fail_count": len(results["fail"]),
        "ok_tickers": [r["ticker"] for r in results["ok"]],
        "partial_tickers": results["partial"],
        "fail_tickers": results["fail"],
    }
    out = REPO / "scripts" / "events-fill-yf" / f"report-{batch_label}.json"
    out.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"\n== SUMMARY ==")
    print(f"OK (>=4 events) : {len(results['ok'])}")
    print(f"PARTIAL (<4)    : {len(results['partial'])}")
    print(f"FAIL/EMPTY      : {len(results['fail'])}")
    print(f"Report          : {out.relative_to(REPO)}")


if __name__ == "__main__":
    main()
