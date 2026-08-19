#!/usr/bin/env python3
"""
scripts/quarterly-refresh-detect.py

Chantier CRON RAFRAICHISSEMENT TRIMESTRIEL (go Yann 12 juil 2026).

Detecte les stes de l'univers V1.9.5 avec un NOUVEAU document SEC utilisable
pour un ou plusieurs blocs de page ste (complement Yann 12 juil) :
10-Q, 10-K, 8-K (items pertinents : 2.02 resultats, 5.02 dirigeants,
1.01/2.01 M&A, 7.01/8.01 annonces, 2.05/2.06 restructurations/impairments),
DEF 14A (gouvernance), S-1/S-4/424B (emissions/fusions, dilution),
SC 13D/G (participations >5%). Form 4 : hors scope par defaut (FORM4_ENABLED).
Comparaison avec l'etat connu `.conv-state/quarterly-refresh-state.json`
(par ste : accessions deja traites). Mapping form->blocs : FORM_TO_BLOCKS.

Bootstrap (ste absente du state) : la baseline = dernier filing deja present
localement dans data-lake/<T>/{10K,10Q,8K}/. Seuls les filings SEC plus
recents que cette baseline sont flagges.

Sortie : `.conv-state/quarterly-refresh-detected.json`
  {"generated_at", "dry_run", "detected": [{"ticker","type":"quarter|annual",
    "cik","filings":[{"form","date","accession","primary_doc","items"}]}],
   "errors": [...], "checked": N}

Regles : SEC EDGAR = seule source, UA obligatoire, throttle 0.5s (2 req/s,
bien sous la limite 10 req/s). Zero LLM, zero API payante. Read-only :
ce script n'ecrit JAMAIS le state (c'est quarterly-refresh-run.py qui marque
une ste comme traitee apres succes → idempotent + resume-safe).

Usage :
  python3 scripts/quarterly-refresh-detect.py                     # univers complet
  python3 scripts/quarterly-refresh-detect.py --tickers AAPL,NVDA --dry-run
  python3 scripts/quarterly-refresh-detect.py --limit 50
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/Users/yann/spx-app")
UNIVERSE_PATH = ROOT / "src/data/v1-9-5-clean-all-tickers.json"
STATE_PATH = ROOT / ".conv-state/quarterly-refresh-state.json"
CIK_CACHE_PATH = ROOT / ".conv-state/quarterly-refresh-cik-map.json"
DEFAULT_OUT = ROOT / ".conv-state/quarterly-refresh-detected.json"
DATALAKE = ROOT / "data-lake"

USER_AGENT = "Mettrik-AI-Quarterly-Refresh yann@mettrik.ai"
THROTTLE_S = 0.5
CIK_CACHE_MAX_AGE_S = 7 * 24 * 3600

# ---------------------------------------------------------------------------
# Mapping form SEC -> blocs de page ste alimentes (complement Yann 12 juil).
# "kpi" = bloc auto (XBRL, fait par run.py). Le reste = flags todo-llm.
# ---------------------------------------------------------------------------
FORM_TO_BLOCKS: dict[str, list[str]] = {
    "10-Q": ["kpi", "segments_geo", "ec_synthesis", "stories_rotation"],
    # 10-K : risques + segments/geo annuels + description ste + headcount +
    # AI positioning (Items 1 / 1A)
    "10-K": ["kpi", "segments_geo", "risks", "description", "headcount",
             "ai_positioning", "ec_synthesis", "stories_rotation"],
    "8-K": [],  # depend des items, cf EIGHTK_ITEM_BLOCKS
    # Proxy annuel : bloc Gouvernance & remuneration entier (remuneration CEO,
    # comp_detail salaire/bonus/actions, pay ratio, say-on-pay, board, top holders)
    "DEF 14A": ["governance"],
    # Emissions / fusions : events + dilution
    "S-1": ["events", "dilution"],
    "S-4": ["events", "dilution"],
    "424B": ["events", "dilution"],  # prefixe : 424B1..424B5
    # Participations > 5% : top holders du bloc gouvernance
    "SC 13D": ["governance_top_holders"],
    "SC 13G": ["governance_top_holders"],
}

# 8-K : items pertinents -> blocs. Les autres items sont ignores.
EIGHTK_ITEM_BLOCKS: dict[str, list[str]] = {
    "2.02": ["kpi", "ec_synthesis", "stories_rotation", "profit_warning", "events"],  # resultats
    "5.02": ["governance", "events"],        # depart / nomination dirigeants
    "1.01": ["events", "stories_rotation"],  # accord materiel (M&A...)
    "2.01": ["events", "stories_rotation"],  # acquisition / cession finalisee
    "7.01": ["events"],                      # Reg FD (annonces materielles)
    "8.01": ["events"],                      # autres evenements materiels
    "2.05": ["risks", "events"],             # restructurations
    "2.06": ["risks", "events"],             # impairments
}

# Anti-bruit 424B : whitelist stricte. Les 424B2/B3/B7/B8 sont des prospectus
# de dette / structured notes routiniers (les banques type JPM en deposent des
# dizaines par semaine, zero info page ste). On ne garde que les vraies
# emissions/resales : 424B1, 424B4, 424B5.
ALLOWED_424B = {"424B1", "424B4", "424B5"}
# Cap par form repetitif : on ne garde que les N plus recents par detection.
MAX_PER_FORM = {"424B": 2, "SC 13D": 3, "SC 13G": 3, "8-K": 6}

# Form 4 (transactions dirigeants) : HORS SCOPE par defaut (volume enorme).
# Passer FORM4_ENABLED=True pour flagger (a reserver aux transactions
# CEO/CFO majeures). Blocs si active : governance + events.
FORM4_ENABLED = False
FORM4_BLOCKS = ["governance", "events"]


def normalize_form(form: str) -> str | None:
    """Ramene un form SEC a sa cle FORM_TO_BLOCKS (gere /A et prefixe 424B)."""
    if form == "4":
        return "4" if FORM4_ENABLED else None
    if form in FORM_TO_BLOCKS:
        return form
    base = form.replace("/A", "").strip()
    if base in FORM_TO_BLOCKS:
        return base
    if base.startswith("424B"):
        return "424B" if base in ALLOWED_424B else None
    return None


def blocks_for_filing(form_norm: str, items: str) -> list[str]:
    """Blocs alimentes par ce filing. 8-K : union des items pertinents."""
    if form_norm == "4":
        return list(FORM4_BLOCKS)
    if form_norm != "8-K":
        return list(FORM_TO_BLOCKS[form_norm])
    out: list[str] = []
    for item, blocks in EIGHTK_ITEM_BLOCKS.items():
        if item in (items or ""):
            for b in blocks:
                if b not in out:
                    out.append(b)
    return out


def log(msg: str) -> None:
    print(f"[quarterly-refresh-detect] {datetime.now(timezone.utc).isoformat()} {msg}", flush=True)


def _ssl_context():
    """macOS python3 sans certs systeme : utilise certifi si dispo."""
    import ssl
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


_SSL_CTX = _ssl_context()


def http_get_json(url: str) -> dict | None:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=45, context=_SSL_CTX) as resp:
            return json.loads(resp.read())
    except Exception as e:
        # fallback curl (meme approche que scripts/datalake/build_datalake.py)
        import subprocess
        try:
            out = subprocess.run(["/usr/bin/curl", "-s", "-A", USER_AGENT, url],
                                 capture_output=True, text=True, timeout=60)
            return json.loads(out.stdout)
        except Exception:
            log(f"WARNING http fail {url}: {e}")
            return None


def load_universe() -> list[str]:
    data = json.loads(UNIVERSE_PATH.read_text("utf8"))
    return list(data.get("tickers") or [])


def load_state() -> dict:
    if STATE_PATH.exists():
        try:
            return json.loads(STATE_PATH.read_text("utf8"))
        except Exception:
            log(f"WARNING state file corrompu, traite comme vide : {STATE_PATH}")
    return {"tickers": {}, "updated_at": None}


def load_cik_map(force_refresh: bool = False) -> dict[str, str]:
    """Mapping TICKER -> CIK (zero-padded 10). Cache local 7 jours."""
    if not force_refresh and CIK_CACHE_PATH.exists():
        age = time.time() - CIK_CACHE_PATH.stat().st_mtime
        if age < CIK_CACHE_MAX_AGE_S:
            try:
                return json.loads(CIK_CACHE_PATH.read_text("utf8"))
            except Exception:
                pass
    log("Fetch SEC company_tickers.json (refresh cache CIK)...")
    j = http_get_json("https://www.sec.gov/files/company_tickers.json")
    time.sleep(THROTTLE_S)
    if not j:
        # fallback : cache perime mieux que rien
        if CIK_CACHE_PATH.exists():
            return json.loads(CIK_CACHE_PATH.read_text("utf8"))
        return {}
    m = {v["ticker"].upper(): str(v["cik_str"]).zfill(10) for v in j.values()}
    CIK_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CIK_CACHE_PATH.write_text(json.dumps(m), "utf8")
    return m


# Suffixes de place boursiere non-US : ces tickers ne sont PAS des deposants SEC.
# Sans ce garde-fou, le fallback ticker.split(".")[0] mappait ROG.SW sur Rogers Corp,
# MC.PA sur Moelis, ALV.DE sur Autoliv, etc., et polluait le data-lake et les KPI.
NON_US_SUFFIXES = {"PA", "AS", "DE", "SW", "L", "MC", "MI", "BR", "CO", "ST", "HE", "LS", "VI", "OL"}


def resolve_cik(ticker: str, cikmap: dict[str, str]) -> str | None:
    suffix = ticker.rsplit(".", 1)[-1].upper() if "." in ticker else ""
    cands = [ticker, ticker.replace(".", "-"), ticker.replace("-", ".")]
    # Le fallback sur le symbole nu n'est admis que si le suffixe n'est pas une place non-US
    # (BF.B, BRK-B : classes d'actions US, legitimes).
    if suffix not in NON_US_SUFFIXES:
        cands.append(ticker.split(".")[0])
    for cand in cands:
        c = cikmap.get(cand.upper())
        if c:
            return c
    return None


def datalake_folder(ticker: str) -> Path:
    """data-lake utilise le format point (BRK.B), l'univers aussi en general."""
    p = DATALAKE / ticker
    if p.exists():
        return p
    alt = DATALAKE / ticker.replace("-", ".")
    if alt.exists():
        return alt
    return p


DATE_RE = re.compile(r"(\d{4}-\d{2}-\d{2})")


def local_baseline_date(ticker: str) -> str | None:
    """Date du filing le plus recent deja present dans data-lake/<T>/ (10K/10Q/8K/DEF14A)."""
    folder = datalake_folder(ticker)
    dates: list[str] = []
    for sub in ("10K", "10Q", "8K", "DEF14A"):
        d = folder / sub
        if not d.is_dir():
            continue
        for f in d.iterdir():
            m = DATE_RE.search(f.name)
            if m:
                dates.append(m.group(1))
    return max(dates) if dates else None


def detect_ticker(ticker: str, cik: str, state_entry: dict | None) -> tuple[list[dict], str | None]:
    """Retourne (nouveaux filings, erreur)."""
    subs = http_get_json(f"https://data.sec.gov/submissions/CIK{cik}.json")
    if not subs:
        return [], "sec_submissions_unreachable"
    recent = subs.get("filings", {}).get("recent", {})
    forms = recent.get("form") or []
    dates = recent.get("filingDate") or []
    accs = recent.get("accessionNumber") or []
    docs = recent.get("primaryDocument") or []
    items_l = recent.get("items") or []

    processed: set[str] = set((state_entry or {}).get("processed_accessions") or [])
    baseline: str | None = (state_entry or {}).get("baseline_date")
    if state_entry is None:
        baseline = local_baseline_date(ticker)

    new: list[dict] = []
    for i, form in enumerate(forms):
        form_norm = normalize_form(form)
        if not form_norm:
            continue
        try:
            fdate = dates[i]
            acc = accs[i]
        except IndexError:
            continue
        items = items_l[i] if i < len(items_l) else ""
        blocks = blocks_for_filing(form_norm, items)
        if not blocks:
            continue  # ex 8-K sans item pertinent
        if acc in processed:
            continue
        if baseline and fdate <= baseline:
            continue  # deja couvert par le data-lake existant
        new.append({
            "form": form,
            "form_norm": form_norm,
            "date": fdate,
            "accession": acc,
            "primary_doc": docs[i] if i < len(docs) else "",
            "items": items,
            "blocks": blocks,
        })
    # Cap anti-bruit par form repetitif : garde les plus recents
    capped: list[dict] = []
    by_form: dict[str, list[dict]] = {}
    for f in new:
        by_form.setdefault(f["form_norm"], []).append(f)
    for fn, lst in by_form.items():
        cap = MAX_PER_FORM.get(fn)
        if cap and len(lst) > cap:
            lst = sorted(lst, key=lambda x: x["date"])[-cap:]
        capped.extend(lst)
    capped.sort(key=lambda x: x["date"])
    return capped, None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers", help="liste separee par virgules (defaut: univers V1.9.5 complet)")
    ap.add_argument("--limit", type=int, default=0, help="cap nb de stes verifiees")
    ap.add_argument("--dry-run", action="store_true", help="affiche seulement, n'ecrit pas le fichier detected")
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()

    tickers = ([t.strip().upper() for t in args.tickers.split(",") if t.strip()]
               if args.tickers else load_universe())
    if args.limit:
        tickers = tickers[: args.limit]

    state = load_state()
    cikmap = load_cik_map()
    if not cikmap:
        log("FATAL: mapping CIK indisponible (SEC injoignable et pas de cache)")
        return 1

    detected: list[dict] = []
    errors: list[dict] = []
    for n, t in enumerate(tickers, 1):
        cik = resolve_cik(t, cikmap)
        if not cik:
            errors.append({"ticker": t, "error": "no_cik"})
            continue
        entry = state.get("tickers", {}).get(t)
        new, err = detect_ticker(t, cik, entry)
        if err:
            errors.append({"ticker": t, "error": err})
        elif new:
            norms = {f["form_norm"] for f in new}
            if "10-K" in norms:
                rtype = "annual"
            elif "10-Q" in norms or any("kpi" in f["blocks"] for f in new):
                rtype = "quarter"
            else:
                rtype = "docs"  # DEF 14A / 8-K non-earnings / S-x / SC 13D-G seuls
            detected.append({
                "ticker": t,
                "cik": cik,
                "type": rtype,
                "filings": new,
            })
            log(f"NEW {t}: {len(new)} filing(s) → {[f['form'] + ' ' + f['date'] for f in new]}")
        if n % 50 == 0:
            log(f"progress {n}/{len(tickers)}")
        time.sleep(THROTTLE_S)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dry_run": bool(args.dry_run),
        "checked": len(tickers),
        "detected": detected,
        "errors": errors,
    }
    if args.dry_run:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    else:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(payload, indent=2, ensure_ascii=False), "utf8")
        log(f"Ecrit {out} : {len(detected)} ste(s) a rafraichir, {len(errors)} erreur(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
