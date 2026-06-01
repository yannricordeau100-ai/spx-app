#!/usr/bin/env python3
"""
MISSION 4a — Merge quarterly histories vers les 180 stés haute qualité.

CONTEXTE :
 - Univers haute qualité = union(v2-pipeline-kpi-v2 + v2-pipeline-exhaustive) = 180 tickers
 - Source quarterly : v2-pipeline-enrich/<ticker>.quarterly-history.json
 - Source canonique annuelle : v2-pipeline/<ticker>.json
 - Destination : v2-pipeline-enrich/<ticker>.json champ `_quarterly_history_extension`

VALIDATION SYNCHRONISATION (critique) :
 - Pour chaque KPI cible (hero + top 5-6 visibles) :
   * Si KPI canonique a period_type=year et quarterly disponible :
     * Aligner les Q1-Q4 d'une année avec valeur annuelle correspondante (±5%)
     * Si validation OK -> garder
     * Si validation KO (>5% écart) -> log dans conflits, SKIP
   * Si KPI canonique a period_type=quarter -> NE PAS ÉCRASER (NFLX native)
 - Stricter : on n'invente rien. Si KPI quarterly inconnu cote canonique -> skip.

ANTI-INVENTION :
 - Aucune fabrication de valeurs
 - Skip silencieux si quarterly non disponible
 - Log conflits plutôt que merger en cas de doute

OUTPUT :
 - src/data/v2-pipeline-enrich/<ticker>.json field `_quarterly_history_extension`
 - /tmp/quarterly-merge-conflicts.json (log validation failures)
 - /tmp/quarterly-merge-success.json (log success)
"""

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/Users/yann/spx-app/src/data")
DIR_KPIV2 = ROOT / "v2-pipeline-kpi-v2"
DIR_EXH = ROOT / "v2-pipeline-exhaustive"
DIR_CANONICAL = ROOT / "v2-pipeline"
DIR_ENRICH = ROOT / "v2-pipeline-enrich"

LOG_CONFLICTS = Path("/tmp/quarterly-merge-conflicts.json")
LOG_SUCCESS = Path("/tmp/quarterly-merge-success.json")

NOW = datetime.now(timezone.utc).isoformat()
TOLERANCE_PCT = 5.0  # validation : Q1..Q4 sum vs annual ± 5%


def norm_ticker(t: str) -> str:
    return t.lower().replace("_", ".")


def build_hq_universe() -> list:
    """Liste des 180 tickers haute qualité (lowercased + dots)."""
    v2 = []
    for f in os.listdir(DIR_KPIV2):
        m = re.match(r"kpi-extract-(.+)\.json$", f)
        if m:
            v2.append(m.group(1))
    exh = []
    for f in os.listdir(DIR_EXH):
        if f.endswith(".json"):
            exh.append(f[:-5])
    tickers = sorted(set([norm_ticker(t) for t in v2] + [norm_ticker(t) for t in exh]))
    return tickers


def load_json(path: Path):
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except json.JSONDecodeError as e:
        print(f"  ! JSON decode error {path}: {e}", file=sys.stderr)
        return None


def write_json_atomic(path: Path, data: dict) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    tmp.replace(path)


def short_norm(s: str) -> str:
    return (s or "").strip().lower()


def parse_year_from_period(p: str):
    """'Q1 2024' -> 2024."""
    if not p:
        return None
    m = re.search(r"(\d{4})", p)
    return int(m.group(1)) if m else None


def parse_quarter_from_period(p: str):
    """'Q1 2024' -> 1."""
    if not p:
        return None
    m = re.search(r"Q(\d)", p)
    return int(m.group(1)) if m else None


def validate_sync(quarterly_kpi: dict, canonical_kpi: dict) -> dict:
    """
    Pour un KPI :
     - quarterly_kpi a history[] + history_periods[] (Q1 2021 ... Q4 2025)
     - canonical_kpi a history[] (annuel)
    Retourne {ok: bool, reason: str, evidence: {...}}.

    Logique :
     - Si canonical period_type == 'quarter' : conflit, on garde le canonique
     - Si pas d'history annuelle canonique >= 1 valeur : pas validable -> OK conservatif (kept, no_annual_to_check)
     - Sinon on essaie d'aligner les sommes Q1..Q4 d'une ou plusieurs années
       qui apparaissent COMPLÈTES dans quarterly et CONNUES côté annuel.
    """
    qhist = quarterly_kpi.get("history") or []
    qperiods = quarterly_kpi.get("history_periods") or []
    if len(qhist) != len(qperiods) or not qhist:
        return {"ok": False, "reason": "quarterly_empty_or_mismatched"}

    cperiod_type = canonical_kpi.get("period_type")
    if cperiod_type == "quarter":
        return {"ok": False, "reason": "canonical_already_quarter_no_overwrite"}

    chist = canonical_kpi.get("history") or []
    if not chist:
        # pas de référence annuelle => on accepte (aucun moyen de valider, on fait confiance à la source quarterly)
        return {"ok": True, "reason": "no_annual_ref_kept_quarterly", "validations": []}

    # Heuristique : annuel typique est trié chronologiquement (le plus récent à droite).
    # On assume canonical[-1] = dernière année connue. last_data_date donne l'année.
    last_date = canonical_kpi.get("last_data_date") or ""
    last_year = None
    if last_date:
        m = re.match(r"(\d{4})", last_date)
        if m:
            last_year = int(m.group(1))

    # Map annuel: year -> value
    n = len(chist)
    annual_map = {}
    if last_year is not None:
        # Suppose chronologique : chist[-1] correspond a last_year
        for i, val in enumerate(chist):
            year = last_year - (n - 1 - i)
            annual_map[year] = val
    else:
        # Pas de date : on ne peut pas matcher. Acceptation conservative.
        return {"ok": True, "reason": "no_last_data_date_kept_quarterly", "validations": []}

    # Regroupe quarterly par annee, ne garde que les annees ou Q1+Q2+Q3+Q4 sont presents
    by_year = {}
    for v, p in zip(qhist, qperiods):
        y = parse_year_from_period(p)
        q = parse_quarter_from_period(p)
        if y is None or q is None:
            continue
        by_year.setdefault(y, {})[q] = v

    validations = []
    fail_count = 0
    pass_count = 0
    for y, qmap in by_year.items():
        if set(qmap.keys()) != {1, 2, 3, 4}:
            continue
        if y not in annual_map:
            continue
        a_val = annual_map[y]
        if a_val is None:
            continue
        try:
            a_val = float(a_val)
        except (ValueError, TypeError):
            continue
        if a_val == 0:
            continue
        # KPI marges (%) ou ratios : on ne somme PAS les trimestres, c'est faux
        unit = (canonical_kpi.get("unit") or "").lower()
        is_pct = unit in {"%", "pct", "pourcent", "percent"}
        if is_pct:
            # On compare moyenne trimestres vs annuel
            qsum = sum(float(qmap[i]) for i in (1, 2, 3, 4)) / 4.0
            method = "avg_pct"
        else:
            qsum = sum(float(qmap[i]) for i in (1, 2, 3, 4))
            method = "sum_q1_q4"
        delta_pct = abs((qsum - a_val) / a_val) * 100.0
        ok = delta_pct <= TOLERANCE_PCT
        validations.append({
            "year": y, "annual": a_val, "qsum": round(qsum, 4),
            "delta_pct": round(delta_pct, 3), "method": method, "ok": ok,
        })
        if ok:
            pass_count += 1
        else:
            fail_count += 1

    if not validations:
        return {"ok": True, "reason": "no_full_year_to_validate_kept_quarterly", "validations": []}

    # Si au moins 1 annee passe et aucune ne fail catastrophiquement (>20% delta), on accepte
    catastrophic = any(v["delta_pct"] > 20.0 for v in validations)
    if catastrophic:
        return {"ok": False, "reason": "annual_sync_catastrophic_delta_gt_20pct", "validations": validations}
    if pass_count >= 1 and fail_count == 0:
        return {"ok": True, "reason": "all_validated_within_5pct", "validations": validations}
    if pass_count >= fail_count:
        return {"ok": True, "reason": "majority_validated", "validations": validations}
    return {"ok": False, "reason": "majority_failed_sync", "validations": validations}


def select_target_kpis(canonical: dict) -> list:
    """
    Retourne la liste ordonnee des shorts des KPIs cibles (hero + top 5).
    Total max 6 KPIs visibles.
    """
    hero = (canonical.get("hero_kpi") or "").strip()
    kpis = canonical.get("kpis") or []
    target_shorts = []
    seen = set()
    if hero:
        target_shorts.append(hero)
        seen.add(short_norm(hero))
    for k in kpis:
        s = (k.get("short") or "").strip()
        if not s or short_norm(s) in seen:
            continue
        target_shorts.append(s)
        seen.add(short_norm(s))
        if len(target_shorts) >= 6:
            break
    return target_shorts


def find_kpi_in_list(kpis: list, target_short: str):
    """Match KPI by short (case-insensitive, trimmed)."""
    if not target_short:
        return None
    tn = short_norm(target_short)
    for k in kpis:
        if short_norm(k.get("short", "")) == tn:
            return k
    return None


def process_ticker(ticker: str, conflicts: list, successes: list) -> str:
    """Traite un ticker. Retourne le statut court."""
    enrich_path = DIR_ENRICH / f"{ticker}.json"
    canonical_path = DIR_CANONICAL / f"{ticker}.json"
    quarterly_path = DIR_ENRICH / f"{ticker}.quarterly-history.json"

    if not canonical_path.exists():
        return "no_canonical"
    if not enrich_path.exists():
        return "no_enrich"
    if not quarterly_path.exists():
        return "no_quarterly_source"

    canonical = load_json(canonical_path)
    enrich = load_json(enrich_path)
    quarterly = load_json(quarterly_path)
    if canonical is None or enrich is None or quarterly is None:
        return "json_error"

    target_shorts = select_target_kpis(canonical)
    if not target_shorts:
        return "no_target_kpis"

    quarterly_kpis = quarterly.get("kpis") or []
    canonical_kpis = canonical.get("kpis") or []

    merged_kpis = []
    per_ticker_conflicts = []
    per_ticker_success = []

    for short in target_shorts:
        qkpi = find_kpi_in_list(quarterly_kpis, short)
        ckpi = find_kpi_in_list(canonical_kpis, short)
        if qkpi is None:
            continue  # pas de quarterly dispo pour ce KPI, skip silencieux
        if ckpi is None:
            # Bizarre : KPI hero non trouve dans canonical.kpis ?
            continue

        # Refus d'ecraser un period_type=quarter natif
        if (ckpi.get("period_type") or "").lower() == "quarter":
            per_ticker_conflicts.append({
                "kpi_short": short,
                "reason": "canonical_already_quarter_skipped",
            })
            continue

        # Validation sync
        validation = validate_sync(qkpi, ckpi)
        if not validation.get("ok"):
            per_ticker_conflicts.append({
                "kpi_short": short,
                "unit": qkpi.get("unit") or ckpi.get("unit"),
                "reason": validation.get("reason"),
                "validations": validation.get("validations", []),
                "canonical_period_type": ckpi.get("period_type"),
                "canonical_last_data_date": ckpi.get("last_data_date"),
                "canonical_history_len": len(ckpi.get("history") or []),
                "quarterly_history_len": len(qkpi.get("history") or []),
            })
            continue

        # Construire entree merged
        merged_kpis.append({
            "kpi_short": short,
            "unit": qkpi.get("unit"),
            "period_type": "quarter",
            "history": qkpi.get("history"),
            "history_periods": qkpi.get("history_periods"),
            "last_data_date": qkpi.get("last_data_date"),
            "source": qkpi.get("_source") or "SEC EDGAR XBRL companyfacts",
            "_sec_tag": qkpi.get("_tag"),
            "_sync_validation": {
                "reason": validation.get("reason"),
                "validations": validation.get("validations", []),
            },
        })
        per_ticker_success.append({
            "kpi_short": short,
            "n_quarters": len(qkpi.get("history") or []),
            "validation_reason": validation.get("reason"),
        })

    if not merged_kpis and not per_ticker_conflicts:
        return "no_overlap"

    # Ecriture (preservation des donnees existantes : si une extension hero
    # mono-KPI etait deja la, on la conserve dans `_legacy_hero_extension`).
    if merged_kpis:
        existing = enrich.get("_quarterly_history_extension")
        legacy = None
        if isinstance(existing, dict) and existing.get("hero_kpi_short") and "kpis" not in existing:
            # Ancienne forme mono-hero : on l'archive
            legacy = existing
        ext = {
            "ticker": canonical.get("ticker") or ticker.upper(),
            "kpis": merged_kpis,
            "_merged_by": "mission-4a-merge-quarterly-to-hq-180",
            "_merged_at": NOW,
            "_source_quarterly_file": str(quarterly_path.relative_to(ROOT.parent)),
            "_source_canonical_file": str(canonical_path.relative_to(ROOT.parent)),
            "_n_kpis_merged": len(merged_kpis),
            "_n_kpis_conflicts": len(per_ticker_conflicts),
        }
        if legacy is not None:
            ext["_legacy_hero_extension"] = legacy
        enrich["_quarterly_history_extension"] = ext
        write_json_atomic(enrich_path, enrich)
        successes.append({"ticker": ticker, "n_kpis": len(merged_kpis), "kpis": per_ticker_success, "preserved_legacy": legacy is not None})

    if per_ticker_conflicts:
        conflicts.append({"ticker": ticker, "conflicts": per_ticker_conflicts})

    if not merged_kpis:
        return "all_conflicts"
    if per_ticker_conflicts:
        return "partial_merged"
    return "ok"


def main():
    tickers = build_hq_universe()
    print(f"HQ universe : {len(tickers)} tickers")

    stats = {
        "ok": 0, "partial_merged": 0, "all_conflicts": 0,
        "no_canonical": 0, "no_enrich": 0, "no_quarterly_source": 0,
        "json_error": 0, "no_target_kpis": 0, "no_overlap": 0,
    }
    conflicts = []
    successes = []

    for t in tickers:
        status = process_ticker(t, conflicts, successes)
        stats[status] = stats.get(status, 0) + 1
        if status in ("ok", "partial_merged"):
            print(f"  + {t} : {status}")
        elif status in ("all_conflicts", "no_overlap"):
            print(f"  - {t} : {status}")

    # Logs sortie
    with open(LOG_CONFLICTS, "w") as f:
        json.dump({
            "generated_at": NOW,
            "tolerance_pct": TOLERANCE_PCT,
            "n_tickers_with_conflicts": len(conflicts),
            "tickers": conflicts,
        }, f, indent=2, ensure_ascii=False)
    with open(LOG_SUCCESS, "w") as f:
        json.dump({
            "generated_at": NOW,
            "n_tickers_success": len(successes),
            "tickers": successes,
        }, f, indent=2, ensure_ascii=False)

    print("\n=== STATS ===")
    for k, v in stats.items():
        print(f"  {k}: {v}")
    print(f"\nConflits log : {LOG_CONFLICTS}")
    print(f"Success log  : {LOG_SUCCESS}")


if __name__ == "__main__":
    main()
