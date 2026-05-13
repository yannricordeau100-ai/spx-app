#!/usr/bin/env python3
"""
audit-top307-v18-blocks.py — audit par bloc pour le top 307 V1.8.

Vérifie pour chaque sté la présence + qualité des blocs DANS :
- src/data/v2-pipeline/<t>.json (CONV-DATA scope)
- src/data/v2-pipeline-enrich/<t>.json (CONV-SYSTEMS scope)
- src/data/v2-pipeline-enrich/<t>.<key>.json (séparés : events, ranks, tam)
- public/logos/<TICKER>.png (avec . → -)

Blocs : logo, ranks, hero_history, kpis_5plus, risks, governance,
ai_positioning, segment, geography, customer_type, events, tam, freshness.

Sortie : stdout + src/data/audit-top307-v18.json + /tmp/audit-top307-missing.json
"""
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOP307_FILE = ROOT / "src/data/v1-8-tickers-sorted.json"
PIPELINE = ROOT / "src/data/v2-pipeline"
ENRICH = ROOT / "src/data/v2-pipeline-enrich"
LOGOS = ROOT / "public/logos"
OUT = ROOT / "src/data/audit-top307-v18.json"

HARDCODED = {"GOOGL", "META", "MSCI", "SPGI", "CAT"}


def load(p):
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


def safe_logo_name(t):
    return t.upper().replace(".", "-")


def check_logo(t):
    return (LOGOS / f"{safe_logo_name(t)}.png").exists() or t.upper() in HARDCODED


def get_pipe_enrich(t):
    p = load(PIPELINE / f"{t.lower()}.json") or {}
    e = load(ENRICH / f"{t.lower()}.json") or {}
    return p, e


def check_ranks(t, p, e):
    """Ranks can be in pipeline OR in <t>.ranks.json."""
    sources = [p.get("ranks"), e.get("ranks")]
    sep = load(ENRICH / f"{t.lower()}.ranks.json")
    if sep:
        sources.append(sep.get("ranks") or sep)
    for r in sources:
        if not isinstance(r, dict):
            continue
        ok = 0
        for k in ("global_world", "global_us", "sector", "subsector"):
            v = r.get(k)
            if isinstance(v, str) and v.strip() and v.strip() not in ("-", "—", "...", "Not ranked"):
                ok += 1
        if ok >= 3:
            return True
    return False


def check_hero_history(p):
    hero = p.get("hero_kpi")
    if not hero:
        return False
    kpis = p.get("kpis", [])
    h = next((k for k in kpis if k.get("short") == hero), None)
    if not h:
        return False
    hist = h.get("history")
    if not isinstance(hist, list) or len(hist) < 3:
        return False
    if h.get("_hero_history_unverified") is True:
        return False
    return True


def check_kpis(p):
    kpis = p.get("kpis", [])
    if not isinstance(kpis, list) or len(kpis) < 5:
        return False
    valid = [k for k in kpis if isinstance(k.get("value"), (int, float, str)) and k.get("value") not in (None, "", "-", "n/a")]
    return len(valid) >= 5


def check_risks(p, e):
    risks = p.get("risks") or e.get("risks") or []
    return isinstance(risks, list) and len(risks) >= 3


def check_governance(p, e):
    gov = p.get("governance") or e.get("governance")
    if not isinstance(gov, dict):
        return False
    return len(gov) >= 3


def check_ai(p, e):
    ai = p.get("ai_positioning") or e.get("ai_positioning")
    if not isinstance(ai, dict):
        return False
    stance = ai.get("stance")
    ev = ai.get("evidence")
    return bool(stance) and isinstance(ev, list) and len(ev) >= 1


def check_segment(p, e):
    seg = p.get("revenue_by_segment") or e.get("revenue_by_segment")
    if not isinstance(seg, dict):
        return False
    slices = seg.get("slices")
    return isinstance(slices, list) and len(slices) >= 2


def check_geo(p, e):
    g = p.get("revenue_by_geography") or e.get("revenue_by_geography")
    if not isinstance(g, dict):
        return False
    slices = g.get("slices")
    return isinstance(slices, list) and len(slices) >= 2


def check_customer_type(p, e):
    c = p.get("revenue_by_customer_type") or e.get("revenue_by_customer_type")
    if not isinstance(c, dict):
        return False
    slices = c.get("slices")
    return isinstance(slices, list) and len(slices) >= 2


def check_events(t, p, e):
    """Events lives in <t>.events.json typically."""
    ev = p.get("events") or e.get("events")
    if isinstance(ev, list) and len(ev) >= 1:
        return True
    sep = load(ENRICH / f"{t.lower()}.events.json")
    if sep and isinstance(sep.get("events"), list) and len(sep["events"]) >= 1:
        return True
    return False


def check_tam(t, p, e):
    """Market positions / TAM. Honesty rule = OK to be empty."""
    mp = p.get("market_positions") or e.get("market_positions")
    if isinstance(mp, list) and len(mp) >= 1:
        return True
    sep = load(ENRICH / f"{t.lower()}.tam.json")
    if sep and isinstance(sep.get("market_positions"), list) and len(sep["market_positions"]) >= 1:
        return True
    return False


def check_freshness(p):
    kpis = p.get("kpis", [])
    for k in kpis:
        ldd = k.get("last_data_date")
        if ldd:
            try:
                d = datetime.fromisoformat(ldd.replace("Z", "+00:00"))
                if d.tzinfo is None:
                    d = d.replace(tzinfo=timezone.utc)
                age = (datetime.now(timezone.utc) - d).days
                if age < 365:
                    return True
            except Exception:
                pass
    return False


def main():
    top307_raw = load(TOP307_FILE)
    if isinstance(top307_raw[0], str):
        top307 = [t for t in top307_raw[:307]]
    else:
        top307 = [t["ticker"] for t in top307_raw[:307]]

    results = {}
    blocks = {n: {"ok": 0, "ko": []} for n in [
        "logo", "ranks", "hero_history", "kpis_5plus", "risks",
        "governance", "ai_positioning", "segment", "geography",
        "customer_type", "events", "tam", "freshness",
    ]}

    for tk in top307:
        p, e = get_pipe_enrich(tk)
        if not p:
            for k in blocks:
                blocks[k]["ko"].append(tk)
            results[tk] = ["NO_PIPELINE"]
            continue

        miss = []
        checks = [
            ("logo", check_logo(tk)),
            ("ranks", check_ranks(tk, p, e)),
            ("hero_history", check_hero_history(p)),
            ("kpis_5plus", check_kpis(p)),
            ("risks", check_risks(p, e)),
            ("governance", check_governance(p, e)),
            ("ai_positioning", check_ai(p, e)),
            ("segment", check_segment(p, e)),
            ("geography", check_geo(p, e)),
            ("customer_type", check_customer_type(p, e)),
            ("events", check_events(tk, p, e)),
            ("tam", check_tam(tk, p, e)),
            ("freshness", check_freshness(p)),
        ]
        for name, ok in checks:
            if ok:
                blocks[name]["ok"] += 1
            else:
                blocks[name]["ko"].append(tk)
                miss.append(name)
        results[tk] = miss

    fully_ok = [t for t, miss in results.items() if not miss]
    total = len(top307)

    summary = {
        "audited_at": datetime.now(timezone.utc).isoformat(),
        "total": total,
        "fully_ok": len(fully_ok),
        "blocks": {
            name: {
                "ok": data["ok"],
                "ko_count": len(data["ko"]),
                "pct": round(100 * data["ok"] / total, 1),
                "ko_sample": data["ko"][:15],
            }
            for name, data in blocks.items()
        },
    }
    OUT.write_text(json.dumps({"summary": summary, "by_ticker": results}, indent=2, ensure_ascii=False))
    Path("/tmp/audit-top307-missing.json").write_text(
        json.dumps({n: data["ko"] for n, data in blocks.items()}, indent=2)
    )

    print(f"=== AUDIT TOP 307 V1.8 ({datetime.now().strftime('%H:%M CEST')}) ===\n")
    print(f"Stés totales : {total}")
    print(f"Stés 100% OK : {len(fully_ok)} ({round(100*len(fully_ok)/total,1)}%)\n")
    print(f"{'Bloc':<18} {'OK':>5} {'KO':>5}  {'%':>6}  Échantillon KO")
    print("-" * 100)
    for name, data in blocks.items():
        s = ", ".join(data["ko"][:6])
        print(f"{name:<18} {data['ok']:>5} {len(data['ko']):>5}  {round(100*data['ok']/total,1):>5}%  {s}")
    print(f"\nDétail : src/data/audit-top307-v18.json + /tmp/audit-top307-missing.json")


if __name__ == "__main__":
    main()
