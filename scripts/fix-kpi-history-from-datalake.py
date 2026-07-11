#!/usr/bin/env python3
"""Correcteur déterministe H2/K4/K2 : étend/répare l'history des KPI depuis
les séries DATÉES du data-lake (kpis_q/extracted.json, kpis/extracted.json).

Sécurité anti cross-pollution : un KPI n'est réparé QUE si ses valeurs
actuelles matchent exactement (à un facteur d'échelle près parmi
1, 1e3, 1e6) une sous-séquence CONTIGUË d'une série data-lake, et que ce
match est UNIQUE parmi toutes les séries de la sté. Pour K4 (history vide),
on exige un match de nom quasi exact (normalisation) ET une série unique.

Usage : python3 scripts/fix-kpi-history-from-datalake.py [--apply] [T ...]
Sans --apply : dry-run (rapport seulement).
"""
import json, os, re, sys, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APPLY = "--apply" in sys.argv
ARGS = [a.upper() for a in sys.argv[1:] if not a.startswith("--")]

def norm_name(s):
    s = unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()

def load_datalake_series(t):
    """Retourne {clé: [(period_end, value), ...]} triées par date."""
    out = {}
    for sub in ("kpis_q", "kpis"):
        p = f"{ROOT}/data-lake/{t}/{sub}/extracted.json"
        if not os.path.exists(p):
            continue
        try:
            d = json.load(open(p))
        except Exception:
            continue
        items = d.get("kpis", d) if isinstance(d, dict) else d
        if isinstance(items, dict):
            # format {name: [{period_end, value}...]} OU {name: {...}}
            for name, v in items.items():
                if name in ("ticker", "extracted_at", "n_kpis"):
                    continue
                hist = v if isinstance(v, list) else (v.get("history") if isinstance(v, dict) else None)
                if isinstance(hist, list) and hist and isinstance(hist[0], dict) and "period_end" in hist[0]:
                    series = sorted(
                        [(x["period_end"], float(x["value"])) for x in hist
                         if isinstance(x.get("value"), (int, float))],
                        key=lambda z: z[0])
                    if len(series) >= 3:
                        out[f"{sub}:{name}"] = series
        elif isinstance(items, list):
            for v in items:
                if not isinstance(v, dict):
                    continue
                name = v.get("short") or v.get("name") or v.get("metric")
                hist = v.get("history")
                if name and isinstance(hist, list) and hist and isinstance(hist[0], dict) and "period_end" in hist[0]:
                    series = sorted(
                        [(x["period_end"], float(x["value"])) for x in hist
                         if isinstance(x.get("value"), (int, float))],
                        key=lambda z: z[0])
                    if len(series) >= 3:
                        out[f"{sub}:{name}"] = series
    return out

SCALES = (1.0, 1e3, 1e-3, 1e6, 1e-6)

def find_value_match(cur_vals, series_map):
    """Cherche la série data-lake dont une sous-séquence contiguë == cur_vals
    (à échelle près, tolérance 0.5%). Retourne (clé, scale, série) si UNIQUE."""
    matches = []
    n = len(cur_vals)
    if n < 4:
        return None  # trop court pour un match fiable
    for key, series in series_map.items():
        vals = [v for _, v in series]
        if len(vals) < n:
            continue
        for scale in SCALES:
            target = [v * scale for v in cur_vals]
            for off in range(0, len(vals) - n + 1):
                seg = vals[off:off + n]
                ok = all(
                    (abs(a - b) <= max(abs(a), abs(b)) * 0.005 + 1e-9)
                    for a, b in zip(seg, target))
                if ok:
                    matches.append((key, scale, series))
                    break
            else:
                continue
            break
    # dédoublonner par clé
    uniq = {m[0]: m for m in matches}
    if len(uniq) == 1:
        return list(uniq.values())[0]
    return None

def period_label(date_str, period_type):
    y, m, _ = date_str.split("-")
    if period_type == "quarter":
        q = (int(m) - 1) // 3 + 1
        return f"Q{q}-{y}"
    return f"FY{y}"

def guess_period_type(series):
    """quarter si écart médian entre points < 150 jours."""
    from datetime import date
    ds = [date(*map(int, p.split("-"))) for p, _ in series]
    gaps = sorted((b - a).days for a, b in zip(ds, ds[1:]))
    med = gaps[len(gaps) // 2] if gaps else 365
    return "quarter" if med < 150 else "year"

def repair_kpi(t, k, series_map, reasons):
    hist = k.get("history") or []
    cur_vals = [h if isinstance(h, (int, float)) else h.get("v") for h in hist]
    cur_vals = [v for v in cur_vals if isinstance(v, (int, float))]
    if not cur_vals:
        return False  # K4 → traité par agents (match par nom trop risqué en masse)
    m = find_value_match(cur_vals, series_map)
    if not m:
        reasons.append(f"{k.get('short')}: aucun match valeurs unique")
        return False
    key, scale, series = m
    pt = guess_period_type(series)
    new_hist = [round(v / scale, 6) for _, v in series]
    new_periods = [period_label(p, pt) for p, _ in series]
    if len(new_hist) <= len(cur_vals):
        reasons.append(f"{k.get('short')}: match {key} mais pas plus long ({len(new_hist)})")
        return False
    k["history"] = new_hist
    k["history_periods"] = new_periods
    k["last_data_date"] = series[-1][0]
    k["period_type"] = pt
    k.setdefault("method", "datalake-value-matched")
    k["_extended_from"] = key
    reasons.append(f"{k.get('short')}: ÉTENDU {len(cur_vals)}→{len(new_hist)} pts via {key} (scale {scale})")
    return True

def main():
    report = json.load(open(f"{ROOT}/.conv-state/audit-pages-report.json"))["report"]
    targets = {}
    for t, issues in report.items():
        shorts = set()
        for i in issues:
            if i["code"] in ("H2", "K4", "K2"):
                m = re.match(r'(?:hero ")?([^":]+)', i["detail"])
                if m:
                    shorts.add(m.group(1).strip())
        if shorts:
            targets[t] = shorts
    if ARGS:
        targets = {t: s for t, s in targets.items() if t in ARGS}

    summary = {"repaired": 0, "unrepaired": 0, "stes": 0}
    details = {}
    for t, shorts in sorted(targets.items()):
        canon = t.replace(".", "-") if not os.path.isdir(f"{ROOT}/data-lake/{t}") else t
        series_map = load_datalake_series(canon) or load_datalake_series(t)
        fp = f"{ROOT}/src/data/v2-pipeline/{t.lower()}.json"
        fe = f"{ROOT}/src/data/v2-pipeline-enrich/{t.lower()}.json"
        reasons = []
        changed_v = changed_e = False
        for path, flag in ((fp, "v"), (fe, "e")):
            if not os.path.exists(path):
                continue
            d = json.load(open(path))
            for k in (d.get("kpis") or []):
                short = (k.get("short") or "").strip()
                if not any(norm_name(short) == norm_name(s) or short == s for s in shorts):
                    continue
                if repair_kpi(t, k, series_map, reasons):
                    summary["repaired"] += 1
                    if flag == "v": changed_v = True
                    else: changed_e = True
                else:
                    summary["unrepaired"] += 1
            if APPLY and ((flag == "v" and changed_v) or (flag == "e" and changed_e)):
                open(path, "w").write(json.dumps(d, ensure_ascii=False, indent=1))
        details[t] = reasons
        summary["stes"] += 1
    out = {"apply": APPLY, "summary": summary, "details": details}
    open(f"{ROOT}/.conv-state/fix-kpi-history-report.json", "w").write(json.dumps(out, ensure_ascii=False, indent=1))
    print(json.dumps(summary, indent=1))
    for t, rs in list(details.items())[:15]:
        for r in rs:
            print(f"  {t}: {r}")

main()
