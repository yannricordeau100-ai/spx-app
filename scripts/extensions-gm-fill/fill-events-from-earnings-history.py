#!/usr/bin/env python3
"""
fill-events-from-earnings-history.py — sub-agent #91 (CONV-CONCEPTS).

Mission ciblée : compléter les events pour les 3 stés clean a-f mais
i_events KO (count < 4) :
  - ADBE (3 events)
  - CPRT (2 events)
  - TSLA (3 events)

Stratégie programmatic (zéro LLM, zéro hallucination) :
  - yfinance.Ticker(t).earnings_history → 4 derniers earnings publiés
    avec EPS actual + EPS estimate + surprise % (data factuelle SEC + analystes)
  - Génère pour chaque trimestre un event "Résultats Q{N} {year} publiés"
    avec EPS actual et beat/miss vs consensus

Output : merge dans
  - src/data/v2-pipeline-enrich/<ticker>.events.json (sidecar)
  - src/data/v2-pipeline-enrich/<ticker>.json (main enrich, champ events)

Idempotent : dédupe par (title prefix, date).
"""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
ENR = PROJECT_ROOT / "src/data/v2-pipeline-enrich"
TARGETS = ["ADBE", "CPRT", "TSLA"]

MONTHS_FR = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]


def quarter_of(month: int) -> int:
    return (month - 1) // 3 + 1


def fmt_date_fr(d: datetime) -> str:
    return f"{d.day} {MONTHS_FR[d.month - 1]} {d.year}"


def build_event(year: int, month: int, title: str, body: str, source: str,
                url: str = "", date_iso: str = "") -> dict:
    return {
        "year": year,
        "month": month,
        "title": title[:140],
        "body": body[:280],
        "source": source,
        "url": url,
        "date": date_iso,
    }


def fetch_earnings_events(ticker: str) -> list[dict]:
    """Retourne des events depuis earnings_history yfinance."""
    import yfinance as yf

    events: list[dict] = []
    try:
        t = yf.Ticker(ticker)
        eh = t.earnings_history
    except Exception as e:
        print(f"  ⚠️ {ticker}: earnings_history err {e}", file=sys.stderr)
        return events

    if eh is None or eh.empty:
        return events

    # Garde les 4 derniers (du plus ancien au plus récent dans l'index)
    rows = eh.tail(4)
    for idx, row in rows.iterrows():
        try:
            # idx = Timestamp ou date string (fiscal quarter end)
            if hasattr(idx, "to_pydatetime"):
                d = idx.to_pydatetime()
            else:
                d = datetime.fromisoformat(str(idx))
            if d.tzinfo is None:
                d = d.replace(tzinfo=timezone.utc)

            eps_actual = row.get("epsActual")
            eps_est = row.get("epsEstimate")
            surprise_pct = row.get("surprisePercent")

            if eps_actual is None:
                continue

            q = quarter_of(d.month)
            title = f"Résultats Q{q} {d.year} publiés"

            # Compose body honnête : EPS réel vs consensus
            parts = [f"EPS Q{q} {d.year} : {eps_actual:.2f} $"]
            if eps_est is not None:
                try:
                    eps_est_f = float(eps_est)
                    delta = float(eps_actual) - eps_est_f
                    if surprise_pct is not None:
                        sp = float(surprise_pct)
                        if sp >= 0.005:
                            parts.append(f"beat consensus ({eps_est_f:.2f} $, +{sp * 100:.1f}%)")
                        elif sp <= -0.005:
                            parts.append(f"miss consensus ({eps_est_f:.2f} $, {sp * 100:.1f}%)")
                        else:
                            parts.append(f"in line avec consensus ({eps_est_f:.2f} $)")
                    else:
                        parts.append(f"vs consensus {eps_est_f:.2f} $")
                except Exception:
                    pass
            body = ". ".join(parts) + f". Clôture trimestre {fmt_date_fr(d)}."

            events.append(build_event(
                year=d.year,
                month=d.month,
                title=title,
                body=body,
                source="yfinance · earnings_history",
                date_iso=d.date().isoformat(),
            ))
        except Exception as e:
            print(f"  ⚠️ {ticker}: row err {e}", file=sys.stderr)
            continue

    return events


def load_events_sidecar(ticker: str) -> tuple[Path, list[dict]]:
    path = ENR / f"{ticker.lower()}.events.json"
    if path.exists():
        try:
            data = json.loads(path.read_text())
            return path, list(data.get("events", []))
        except Exception:
            return path, []
    return path, []


def merge_events(existing: list[dict], new_events: list[dict], cap: int = 8) -> list[dict]:
    seen = set()
    out: list[dict] = []
    for e in existing:
        key = (str(e.get("title", "")).lower()[:60], e.get("date", ""))
        if key in seen:
            continue
        seen.add(key)
        out.append(e)
    for e in new_events:
        key = (str(e.get("title", "")).lower()[:60], e.get("date", ""))
        if key in seen:
            continue
        seen.add(key)
        out.append(e)
    out.sort(key=lambda e: e.get("date", ""), reverse=True)
    return out[:cap]


def main():
    print(f"📊 Earnings-history events fill : {len(TARGETS)} stés (ADBE/CPRT/TSLA)", flush=True)
    ENR.mkdir(parents=True, exist_ok=True)

    stats = {"processed": 0, "written": 0, "with_4plus_events": 0}

    for ticker in TARGETS:
        stats["processed"] += 1
        print(f"\n→ {ticker}", flush=True)
        try:
            new_events = fetch_earnings_events(ticker)
        except Exception as e:
            print(f"  ❌ {ticker}: err {e}", file=sys.stderr)
            continue

        print(f"  earnings_history events generated: {len(new_events)}", flush=True)

        path, existing = load_events_sidecar(ticker)
        merged = merge_events(existing, new_events)
        print(f"  before/after merge: {len(existing)} → {len(merged)}", flush=True)

        if len(merged) >= 4:
            stats["with_4plus_events"] += 1

        # Write sidecar
        payload = {
            "ticker": ticker,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "events": merged,
            "_earnings_history_fill_at": datetime.now(timezone.utc).isoformat(),
        }
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
        stats["written"] += 1

        # Also merge into main <ticker>.json enrich (BOTH casings to be safe)
        for main_name in [f"{ticker}.json", f"{ticker.lower()}.json"]:
            main_path = ENR / main_name
            if main_path.exists():
                try:
                    main_data = json.loads(main_path.read_text())
                except Exception:
                    continue
                existing_main_events = main_data.get("events")
                if not isinstance(existing_main_events, list):
                    existing_main_events = []
                # Merge with main events (cap 8, dedupe)
                merged_main = merge_events(existing_main_events, merged)
                main_data["events"] = merged_main
                main_data["_events_earnings_history_fill_at"] = datetime.now(timezone.utc).isoformat()
                main_path.write_text(json.dumps(main_data, ensure_ascii=False, indent=2))
                print(f"  ✔ merged into {main_name} ({len(merged_main)} events total)", flush=True)
                break

        time.sleep(0.8)

    print("\n📈 Bilan :", flush=True)
    print(f"  - processed : {stats['processed']}")
    print(f"  - written   : {stats['written']}")
    print(f"  - with_4plus_events : {stats['with_4plus_events']} / {stats['processed']}")


if __name__ == "__main__":
    main()
