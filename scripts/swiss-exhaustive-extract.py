#!/usr/bin/env python3
"""
swiss-exhaustive-extract.py — Extraction exhaustive "presque codée" des
annual reports Suisses, output JSON structuré réutilisable pour tout
nouveau bloc futur SANS re-Pass.

Mission Yann (16 mai 2026) : qualité stratospherique, schéma 18 domaines,
sortie séparée du pipeline existant CONV-DATA pour ne pas écraser.

Output : src/data/v2-pipeline-exhaustive/<TICKER>.json

Usage :
  POC (3 stés moyennes capi) :
    python3 scripts/swiss-exhaustive-extract.py --mode haiku-single \
      --tickers KNIN.SW,LOGN.SW,PGHN.SW

  Scale 17 SMI Haiku + 3 vitrine Sonnet :
    python3 scripts/swiss-exhaustive-extract.py --mode haiku-single --smi-17
    python3 scripts/swiss-exhaustive-extract.py --mode sonnet-deep \
      --tickers NESN.SW,NOVN.SW,ROG.SW

Modes :
  --mode haiku-single  : Haiku 4.5 single-pass exhaustive, ~$0.03/sté
  --mode haiku-multi   : Haiku 4.5 multi-shot par bloc, ~$0.20/sté (granularité)
  --mode sonnet-deep   : Sonnet 4.5 single-pass + cross-val, ~$0.45/sté (vitrine)
"""
from __future__ import annotations
import argparse
import json
import os
import re
import ssl
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl._create_unverified_context()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SEC_DATA = PROJECT_ROOT / "sec-data" / "cat3-european"
OUT_DIR = PROJECT_ROOT / "src/data/v2-pipeline-exhaustive"
LOG_PATH = PROJECT_ROOT / "sec-data" / "_meta" / "swiss-exhaustive.log"
PERF_PATH = PROJECT_ROOT / "sec-data" / "_meta" / "swiss-exhaustive-perf.json"

API_URL = "https://api.anthropic.com/v1/messages"
MODELS = {
    "haiku-single": "claude-haiku-4-5",
    "haiku-multi":  "claude-haiku-4-5",
    "sonnet-deep":  "claude-sonnet-4-5",
}
PRICING = {
    "claude-haiku-4-5":  {"in": 1.0,  "out": 5.0},   # USD per 1M tokens
    "claude-sonnet-4-5": {"in": 3.0,  "out": 15.0},
}


def load_env():
    env = PROJECT_ROOT / ".env.local"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        if k.strip() and not os.environ.get(k.strip()):
            os.environ[k.strip()] = v.strip().strip('"').strip("'")


def log(msg, fh=None):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    if fh:
        fh.write(line + "\n")
        fh.flush()


def load_filings_text(ticker: str) -> tuple[str, list[str]]:
    """Concatène tous les annual-text/*.txt pour un ticker. Retourne (text, source_files)."""
    base = SEC_DATA / ticker
    txt_dir = base / "annual-text"
    sources = []
    parts = []
    if txt_dir.exists():
        for txt_file in sorted(txt_dir.glob("*.txt"), reverse=True):  # plus récents d'abord
            try:
                content = txt_file.read_text(errors="ignore")
                if len(content) > 5000:
                    parts.append(f"\n\n=== ANNUAL REPORT {txt_file.stem} ({len(content)} chars) ===\n\n{content}")
                    sources.append(f"annual-text/{txt_file.name}")
            except Exception:
                pass
    # Snapshots IR/home page (HTML brut)
    snap_dir = base / "snapshots"
    if snap_dir.exists():
        for html_file in sorted(snap_dir.glob("*.html")):
            try:
                content = html_file.read_text(errors="ignore")
                # strip HTML
                stripped = re.sub(r"<script[^>]*>.*?</script>", " ", content, flags=re.DOTALL | re.IGNORECASE)
                stripped = re.sub(r"<style[^>]*>.*?</style>", " ", stripped, flags=re.DOTALL | re.IGNORECASE)
                stripped = re.sub(r"<[^>]+>", " ", stripped)
                stripped = re.sub(r"\s+", " ", stripped)
                if len(stripped) > 1000:
                    parts.append(f"\n\n=== SNAPSHOT {html_file.stem} (web page text, {len(stripped)} chars) ===\n\n{stripped[:30000]}")
                    sources.append(f"snapshots/{html_file.name}")
            except Exception:
                pass
    text = "".join(parts)
    return text, sources


# ────────────────────────────────────────────────────────────────────
# SCHÉMA EXHAUSTIF (18 domaines) — "presque codé" pour réuse future
# ────────────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """Tu es un analyste financier senior expert en extraction structurée de données depuis les rapports annuels et docs IR.

Ta mission : pour la société Suisse fournie, extrais TOUTES les informations factuelles disponibles dans les sources (annual reports, snapshots IR/home page) et structure-les dans un JSON COMPLET selon le schéma ci-dessous.

Règles strictes :
1. JAMAIS inventer une valeur. Si pas dans les sources : null
2. Préciser l'unité (CHF, EUR, USD, %, employees, etc) à chaque valeur numérique
3. Quand série historique : tableau d'objets [{year, value, unit}, ...]
4. Quand citation : "cite verbatim avec guillemets"
5. Sources : pour chaque champ majeur, indiquer source_doc_year (ex "annual_2023")
6. Format CHF/EUR : nombre + champ "unit" séparé (pas "1234 CHF" en string)
7. Évite tableau vide [] : null si pas trouvé
8. Output : JSON pur, RIEN d'autre, pas de markdown, pas de commentaire avant/après

Domaines à remplir (renvoie tous les domaines même si la plupart null) :
- company_profile (founded, hq, ceo, board, isin, ipo, employees, fiscal_year_end, listings)
- business_model (core, revenue_streams, customer_types, geography_split, advantages, competitors)
- financials (revenue, ebitda, ebit, net_income, fcf, balance_sheet, margins, multi-year history)
- segments (par segment: revenue, op_income, %_total, growth_yoy)
- geography_revenue (par région: revenue, %_total, growth)
- kpis_proprietary (KPIs spécifiques métier ex TEU shipped, AUM, beds, ...)
- governance (board complete with names+roles+since, executive_committee, voting_structure, shareholders)
- compensation (CEO comp by year, ratio CEO/median employee, equity grants)
- risks (par categorie: operational, market, regulatory, cyber, ESG ; severity 1-5, trend, rationale)
- ai_positioning (stance: leader/integrator/cautious/absent, evidence, summary FR)
- esg (CO2 scope1+2+3, renewable %, water, social, governance scores, certifications)
- events_milestones (acquisitions, divestments, restructurings, leadership changes, IPO events)
- products_services (catalog, launched dates, customers count if mentioned)
- rd_innovation (R&D spend abs+%revenue, patents, key projects, partnerships)
- capex_investments (capex history, breakdown by purpose, investments declared)
- dividends (history, current_yield, payout, policy, growth_streak)
- ma_activity (acquisitions+divestments with year, target, amount, rationale)
- regulatory (key authorities, active_litigations, compliance, fines)
- outlook_guidance (next_quarter, fy_targets, long_term_strategy, capital_markets_day_themes)

Tu dois sortir UN JSON UNIQUE valide, contenant TOUS ces domaines au plus haut niveau.
"""


def call_anthropic(messages, model: str, max_tokens: int = 16000) -> tuple[str, int, int]:
    """Appel API Anthropic. Retourne (text, tokens_in, tokens_out)."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY missing")
    payload = json.dumps({
        "model": model,
        "max_tokens": max_tokens,
        "system": SYSTEM_PROMPT,
        "messages": messages,
    }).encode()
    req = urllib.request.Request(
        API_URL, data=payload,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
    )
    with urllib.request.urlopen(req, timeout=300, context=SSL_CTX) as r:
        body = r.read()
    obj = json.loads(body)
    text = obj["content"][0]["text"]
    usage = obj.get("usage", {})
    return text, usage.get("input_tokens", 0), usage.get("output_tokens", 0)


def extract_json(text: str) -> dict:
    """Extrait le premier objet JSON valide du texte. Tolère :
    - markdown wrappers ```json ... ``` (stripés)
    - préambule textuel
    - truncation (essaie de réparer en ajoutant les } manquants)
    """
    # Strip markdown wrappers
    cleaned = re.sub(r"^\s*```(?:json)?\s*\n?", "", text, flags=re.MULTILINE)
    cleaned = re.sub(r"\n?\s*```\s*$", "", cleaned, flags=re.MULTILINE)
    # Cherche le premier { jusqu'à dernière } équilibrée
    start = cleaned.find("{")
    if start < 0:
        return {}
    depth = 0
    last_valid_close = -1
    for i, ch in enumerate(cleaned[start:], start=start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(cleaned[start:i+1])
                except json.JSONDecodeError:
                    continue
            last_valid_close = i
    # Si jamais équilibré (truncation), tenter de fermer artificiellement
    if depth > 0:
        attempt = cleaned[start:] + ("}" * depth)
        try:
            return json.loads(attempt)
        except json.JSONDecodeError:
            # Tronquer au dernier } valide observé et fermer
            if last_valid_close > 0:
                attempt = cleaned[start:last_valid_close + 1]
                # Compter ouvertures non fermées
                opens = attempt.count("{") - attempt.count("}")
                attempt += "}" * max(0, opens)
                try:
                    return json.loads(attempt)
                except json.JSONDecodeError:
                    pass
    return {}


def coverage_pct(d: dict) -> float:
    """% de domaines top-level non vides."""
    domains = [
        "company_profile", "business_model", "financials", "segments",
        "geography_revenue", "kpis_proprietary", "governance", "compensation",
        "risks", "ai_positioning", "esg", "events_milestones", "products_services",
        "rd_innovation", "capex_investments", "dividends", "ma_activity",
        "regulatory", "outlook_guidance",
    ]
    filled = 0
    for k in domains:
        v = d.get(k)
        if v is None:
            continue
        if isinstance(v, dict) and any(v.values()):
            filled += 1
        elif isinstance(v, list) and len(v) > 0:
            filled += 1
        elif v not in (None, "", [], {}):
            filled += 1
    return filled / len(domains)


def process_ticker(ticker: str, mode: str, log_fh) -> dict:
    """Extrait exhaustive pour 1 ticker. Retourne perf metrics."""
    out = {"ticker": ticker, "mode": mode, "started_at": datetime.now(timezone.utc).isoformat()}
    text, sources = load_filings_text(ticker)
    if not text or len(text) < 5000:
        out["status"] = "no-source"
        out["error"] = f"Pas de source usable (text={len(text)} chars)"
        log(f"  ❌ {ticker} : {out['error']}", log_fh)
        return out

    log(f"  → {ticker} : {len(sources)} sources, {len(text):,} chars input", log_fh)

    # Truncate si trop long (Haiku limite ~200k context, on garde marge)
    MAX_INPUT = 180_000
    if len(text) > MAX_INPUT:
        text = text[:MAX_INPUT] + "\n\n[...truncated for context window...]"
        log(f"     truncated to {MAX_INPUT:,} chars", log_fh)

    user_prompt = f"""Société : {ticker} (Suisse, cotée SIX)

Sources fournies ({len(sources)} docs) :
{chr(10).join('- ' + s for s in sources)}

CONTENU DES SOURCES (concaténé) :
{text}

Extrais TOUTES les informations factuelles dans le JSON exhaustif selon le schéma système. Renvoie UNIQUEMENT le JSON, sans markdown, sans commentaire."""

    model = MODELS[mode]
    t0 = time.time()
    try:
        # Prefill assistant avec "{" pour FORCER JSON pur (Haiku tend à
        # wrapper en ```json ... ```). Anthropic API : si dernier message
        # est assistant, le LLM continue depuis ce contenu.
        response, tin, tout = call_anthropic(
            [
                {"role": "user", "content": user_prompt},
                {"role": "assistant", "content": "{"},
            ],
            model=model,
            max_tokens=24000,  # Yann 16 mai : 24k pour éviter truncation JSON
        )
        # Re-prepend "{" car Anthropic strip le prefill dans la réponse
        if not response.lstrip().startswith("{"):
            response = "{" + response
    except Exception as e:
        out["status"] = "api-fail"
        out["error"] = str(e)
        log(f"  ❌ {ticker} API fail : {e}", log_fh)
        return out

    elapsed = time.time() - t0
    parsed = extract_json(response)
    if not parsed:
        out["status"] = "parse-fail"
        out["error"] = "JSON invalide dans réponse LLM"
        out["raw_preview"] = response[:500]
        log(f"  ❌ {ticker} parse fail (raw: {response[:100]}...)", log_fh)
        return out

    # Enrichit metadata
    parsed["_meta"] = {
        "ticker": ticker,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "extractor_version": "swiss-exhaustive-v1",
        "mode": mode,
        "model": model,
        "sources_count": len(sources),
        "sources": sources,
        "tokens_in": tin,
        "tokens_out": tout,
        "cost_usd": round((tin / 1_000_000) * PRICING[model]["in"]
                         + (tout / 1_000_000) * PRICING[model]["out"], 4),
        "elapsed_sec": round(elapsed, 1),
        "input_chars": len(text),
    }
    cov = coverage_pct(parsed)
    parsed["_meta"]["coverage_pct"] = round(cov, 3)

    # Detection cross-pollution : nom extrait vs ticker attendu
    extracted_name = ""
    cp = parsed.get("company_profile") or {}
    if isinstance(cp, dict):
        extracted_name = (cp.get("name") or cp.get("legal_name") or "").lower()
    expected_root = ticker.replace(".SW", "").lower()
    # Heuristic : check si le nom extrait contient un fragment du ticker root
    # OU si le pays/domicile est NON-Suisse (alerte cross-pollution)
    domicile = ""
    if isinstance(cp, dict):
        hq = cp.get("headquarters") or cp.get("hq") or {}
        if isinstance(hq, dict):
            domicile = (hq.get("country") or hq.get("location") or "").lower()
        domicile += " " + (cp.get("domicile") or "").lower()
    if "switzerland" not in domicile and "suisse" not in domicile and "ch" not in domicile.split():
        parsed["_meta"]["WARNING_cross_pollution"] = (
            f"Domicile non-Suisse détecté ('{domicile}'). Source PDF probablement "
            f"corrompue/cross-référencée. À ré-scraper depuis IR direct."
        )

    # Save
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dest = OUT_DIR / f"{ticker.lower()}.json"
    dest.write_text(json.dumps(parsed, indent=2, ensure_ascii=False))
    log(f"  ✅ {ticker} : coverage={cov:.0%} cost=${parsed['_meta']['cost_usd']} elapsed={elapsed:.0f}s tokens={tin}→{tout}", log_fh)

    out.update({
        "status": "ok",
        "coverage_pct": cov,
        "cost_usd": parsed["_meta"]["cost_usd"],
        "elapsed_sec": elapsed,
        "tokens_in": tin,
        "tokens_out": tout,
        "output_path": str(dest.relative_to(PROJECT_ROOT)),
    })
    return out


SMI_17_HAIKU = [  # 20 SMI moins les 3 vitrine Sonnet
    "UBSG.SW", "ABBN.SW", "ZURN.SW", "CFR.SW", "GIVN.SW", "LONN.SW",
    "SREN.SW", "ALC.SW", "SLHN.SW", "GEBN.SW", "HOLN.SW", "SCMN.SW",
    "LOGN.SW", "PGHN.SW", "SIKA.SW", "STMN.SW", "KNIN.SW",
]
VITRINE_SONNET = ["NESN.SW", "NOVN.SW", "ROG.SW"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=list(MODELS.keys()), default="haiku-single")
    parser.add_argument("--tickers", help="Comma-separated")
    parser.add_argument("--smi-17", action="store_true", help="17 SMI hors vitrine")
    parser.add_argument("--vitrine", action="store_true", help="3 vitrine NESN+NOVN+ROG (sonnet recommandé)")
    args = parser.parse_args()

    load_env()

    if args.tickers:
        tickers = [t.strip().upper() for t in args.tickers.split(",")]
    elif args.smi_17:
        tickers = SMI_17_HAIKU
    elif args.vitrine:
        tickers = VITRINE_SONNET
    else:
        print("ERR: --tickers OR --smi-17 OR --vitrine", file=sys.stderr)
        sys.exit(1)

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    log_fh = open(LOG_PATH, "a")

    log(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", log_fh)
    log(f"START swiss-exhaustive : mode={args.mode} model={MODELS[args.mode]} tickers={len(tickers)}", log_fh)
    log(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", log_fh)

    results = []
    for i, t in enumerate(tickers, 1):
        log(f"[{i}/{len(tickers)}] {t}", log_fh)
        try:
            res = process_ticker(t, args.mode, log_fh)
            results.append(res)
        except KeyboardInterrupt:
            log("INTERRUPTED", log_fh)
            break
        except Exception as e:
            results.append({"ticker": t, "status": "exception", "error": str(e)})
            log(f"  ❌ {t} exception : {e}", log_fh)
        time.sleep(2)  # throttle

    # Aggregate perf
    perf = {
        "session_at": datetime.now(timezone.utc).isoformat(),
        "mode": args.mode,
        "model": MODELS[args.mode],
        "tickers_total": len(tickers),
        "ok": sum(1 for r in results if r.get("status") == "ok"),
        "no_source": sum(1 for r in results if r.get("status") == "no-source"),
        "api_fail": sum(1 for r in results if r.get("status") == "api-fail"),
        "parse_fail": sum(1 for r in results if r.get("status") == "parse-fail"),
        "total_cost_usd": round(sum(r.get("cost_usd", 0) for r in results), 4),
        "avg_coverage_pct": round(
            sum(r.get("coverage_pct", 0) for r in results if r.get("status") == "ok")
            / max(1, sum(1 for r in results if r.get("status") == "ok")), 3
        ),
        "avg_elapsed_sec": round(
            sum(r.get("elapsed_sec", 0) for r in results if r.get("status") == "ok")
            / max(1, sum(1 for r in results if r.get("status") == "ok")), 1
        ),
        "results": results,
    }
    PERF_PATH.parent.mkdir(parents=True, exist_ok=True)
    PERF_PATH.write_text(json.dumps(perf, indent=2, ensure_ascii=False))

    log(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", log_fh)
    log(f"DONE : ok={perf['ok']}/{perf['tickers_total']} cost=${perf['total_cost_usd']} avg_cov={perf['avg_coverage_pct']:.0%}", log_fh)
    log(f"   Perf : {PERF_PATH}", log_fh)
    log_fh.close()


if __name__ == "__main__":
    main()
