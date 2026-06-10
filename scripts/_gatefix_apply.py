#!/usr/bin/env python3
"""
_gatefix_apply.py — utilitaire commun pour ecrire des KPIs propres dans le pipeline.

Strategie (robuste face au merge multi-sources de load-company.ts) :
  1. Reecrit src/data/v2-pipeline/<slug>.json : kpis = nouvelle liste propre,
     hero_kpi = short specifique non-CA-total >=16q, flag _gatefix_hard.
  2. Neutralise les sources qui re-injectent de la contamination par `short` :
     - enrich/<slug>.json : kpis=[], kpis_supplementary=[], et corrige/retire
       hero_kpi_override (le pointe sur le nouveau hero specifique).
     - specific-kpis/<TICKER>.json : kpis=[] (garde le fichier mais vide).
  Tous les autres champs (risks, governance, events, descriptions, segments,
  ai_positioning, ranks, etc.) sont PRESERVES intacts.

Regle absolue : verbatim filing ou rien. NULL si non chiffre. FR strict, zero
em-dash, unites Mds/M.
"""
import json
import os
import datetime

ROOT = "/Users/yann/spx-app"
PIPE = os.path.join(ROOT, "src/data/v2-pipeline")
ENRICH = os.path.join(ROOT, "src/data/v2-pipeline-enrich")
SPEC = os.path.join(ROOT, "src/data/v2-pipeline-specific-kpis")

TS = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def save(p, d):
    with open(p, "w", encoding="utf-8") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
        f.write("\n")


def mk_kpi(short, name_fr, name_en, unit, history, period_type, explanation,
           value=None, yoy=None, signal=None, nature="flow", typ="Segment"):
    """Build a clean KPI dict. value defaults to last history point."""
    hist = [round(x, 4) if isinstance(x, float) else x for x in history] if history else []
    if value is None and hist:
        value = hist[-1]
    if yoy is None and hist and len(hist) >= 5:
        # YoY same-period: quarterly -> -4, annual -> -1
        prev = hist[-5] if period_type == "quarter" and len(hist) >= 5 else (hist[-2] if len(hist) >= 2 else None)
        if prev not in (None, 0):
            yoy = "%+.1f%%" % ((value - prev) / abs(prev) * 100.0)
    return {
        "short": short,
        "name_fr": name_fr,
        "name_en": name_en,
        "value": value,
        "unit": unit,
        "yoy": yoy,
        "type": typ,
        "nature": nature,
        "history": hist,
        "period_type": period_type,
        "explanation": explanation,
        "is_generic": False,
        "_gatefix_hard": TS,
    }


def apply(slug, ticker, kpis, hero_short, hero_rationale_fr, hero_last_date=None):
    """Rewrite base pipeline file + neutralize contaminating enrich/specific sources."""
    # 1. base pipeline
    pp = os.path.join(PIPE, f"{slug}.json")
    d = load(pp)
    d["kpis"] = kpis
    d["hero_kpi"] = hero_short
    d["hero_kpi_rationale"] = hero_rationale_fr
    if hero_last_date:
        # also set on the hero KPI
        for k in d["kpis"]:
            if k["short"] == hero_short:
                k["last_data_date"] = hero_last_date
    d["_gatefix_hard"] = TS
    save(pp, d)

    # 2. enrich: neutralize kpis arrays + fix hero override
    ep = os.path.join(ENRICH, f"{slug}.json")
    if os.path.exists(ep):
        e = load(ep)
        if "kpis" in e:
            e["kpis"] = []
        if "kpis_supplementary" in e:
            e["kpis_supplementary"] = []
        if "kpis-v3" in e:
            e["kpis-v3"] = []
        # hero override -> point to new specific hero (so load-company keeps it specific)
        e["hero_kpi_override"] = hero_short
        e["_hero_kpi_override_at"] = TS
        e["_hero_kpi_override_by"] = "gatefix-hard"
        e["_hero_kpi_override_reason"] = "re-extraction hero specifique propre (gate qualify-stes)"
        # neutralize quarterly/extension blobs that could re-point/extend stale hero
        for kk in ["_quarterly_history_extension", "_hero_history_extension", "hero_quarterly_history"]:
            if kk in e:
                e[kk] = None
        e["_gatefix_hard"] = TS
        save(ep, e)

    # 3. enrich .kpis-v3.json sidecar file
    v3 = os.path.join(ENRICH, f"{slug}.kpis-v3.json")
    if os.path.exists(v3):
        try:
            j = load(v3)
            if isinstance(j, dict) and "kpis" in j:
                j["kpis"] = []
                save(v3, j)
        except Exception:
            pass

    # 3b. hero_name_fr.json sidecar: repoint its hero_kpi_override too (it runs late
    #     in load-company and would otherwise override our specific hero).
    hnf = os.path.join(ENRICH, f"{slug}.hero_name_fr.json")
    if os.path.exists(hnf):
        try:
            j = load(hnf)
            if isinstance(j, dict):
                j["hero_kpi_override"] = hero_short
                if "overrides_hero_name_fr" in j and isinstance(j["overrides_hero_name_fr"], dict):
                    # repoint to the new hero short (UI display name)
                    j["overrides_hero_name_fr"]["hero_short"] = hero_short
                j["_gatefix_hard"] = TS
                save(hnf, j)
        except Exception:
            pass

    # 3c. standalone <slug>.hero_kpi.json (legacy, not loaded by load-company but fix anyway)
    hk = os.path.join(ENRICH, f"{slug}.hero_kpi.json")
    if os.path.exists(hk):
        try:
            j = load(hk)
            if isinstance(j, dict) and "hero_kpi_override" in j:
                j["hero_kpi_override"] = hero_short
                save(hk, j)
        except Exception:
            pass

    # 4. specific-kpis: empty the kpis array (keep file)
    for cand in [f"{ticker}.json", f"{slug}.json", f"{ticker.upper()}.json"]:
        sp = os.path.join(SPEC, cand)
        if os.path.exists(sp):
            try:
                s = load(sp)
                if isinstance(s, dict):
                    s["kpis"] = []
                    s["_gatefix_hard"] = TS
                    save(sp, s)
            except Exception:
                pass
    print(f"[{ticker}] applied: {len(kpis)} kpis, hero={hero_short!r}")
