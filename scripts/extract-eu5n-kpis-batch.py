#!/usr/bin/env python3
"""extract-eu5n-kpis-batch.py

Orchestrateur extraction LLM KPIs spécifiques EU5+N (règle §0septies).

- Lit `sec-data/_meta/eu5n-pipeline-manifest.json`.
- Filtre stés `extraction_pending` OU (`extracted_existing` ET 5/5)
  (= stés "kpis_done=false ET 5_5=true").
- Pour chaque sté : lance extraction Cerebras free tier (qwen-3-235b).
- Prompt strict : KPIs spécifiques (BANNIR Revenue/EPS/EBITDA/etc),
  ≥4 KPIs sur ≥3 ans, "null si non chiffré dans le filing".
- Output drafts : `/tmp/eu5n-extract-drafts/<TICKER>.json` (validation
  manuelle Yann avant écriture dans `src/data/`).
- Rate limit : 30 req/min/key, 3 keys rotation.
- Mode `--dry-run` : pas d'appel LLM, juste le plan.

USAGE:
    python3 scripts/extract-eu5n-kpis-batch.py --dry-run
    python3 scripts/extract-eu5n-kpis-batch.py --limit 5
    python3 scripts/extract-eu5n-kpis-batch.py --countries France,Allemagne
    python3 scripts/extract-eu5n-kpis-batch.py            # all targets

PRÉREQUIS:
    - CEREBRAS_API_KEY (+ CEREBRAS2_API_KEY + CEREBRAS3_API_KEY) dans env
    - Package python `cerebras-cloud-sdk` (pip install cerebras-cloud-sdk)
    - Annual-text 2020-2024 dans sec-data/cat3-european/<TICKER>/annual-text/
"""

from __future__ import annotations

import argparse
import collections
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# ----- Config -----
PROJECT_ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = PROJECT_ROOT / "sec-data" / "_meta" / "eu5n-pipeline-manifest.json"
CAT3_DIR = PROJECT_ROOT / "sec-data" / "cat3-european"
DRAFTS_DIR = Path("/tmp/eu5n-extract-drafts")

CEREBRAS_MODEL = "qwen-3-235b-a22b-instruct-2507"
CEREBRAS_KEYS_ENV = ["CEREBRAS_API_KEY", "CEREBRAS2_API_KEY", "CEREBRAS3_API_KEY"]
RATE_LIMIT_PER_MIN_PER_KEY = 30  # Cerebras free tier
MIN_INTERVAL_PER_KEY = 60.0 / RATE_LIMIT_PER_MIN_PER_KEY  # 2 sec
MAX_SOURCE_CHARS = 60_000  # cap pour rester sous le context budget
TARGET_YEARS = ["2020", "2021", "2022", "2023", "2024"]

# Liste KPIs génériques BANNIS (règle §0septies)
BANNED_KPIS = {
    "revenue",
    "total revenue",
    "net revenue",
    "sales",
    "net sales",
    "total sales",
    "operating margin",
    "op margin",
    "operating income",
    "eps",
    "diluted eps",
    "earnings per share",
    "net income",
    "net profit",
    "ebitda",
    "ebitda margin",
    "ebit",
    "fcf",
    "free cash flow",
    "headcount",
    "employees",
    "capex",
    "capital expenditure",
    "r&d",
    "research and development",
    "gross margin",
    "gross profit",
    "cap return",
    "capital return",
    "dps",
    "dividend per share",
    "payout ratio",
    "total assets",
    "total debt",
    "cash",
    "cash and equivalents",
    "net debt",
    "buybacks",
    "share buybacks",
    "market cap",
    "market capitalization",
    "leverage ratio",
}


# ----- Helpers -----
def load_manifest() -> dict:
    if not MANIFEST_PATH.is_file():
        print(f"FATAL: manifest manquant {MANIFEST_PATH}", file=sys.stderr)
        sys.exit(2)
    return json.loads(MANIFEST_PATH.read_text())


def filter_targets(
    manifest: dict,
    countries: set[str] | None,
    limit: int | None,
) -> list[dict]:
    """Filtre stés selon règles :
    - status == 'extraction_pending' (5/5 OK, pas de companies.json)
    - status == 'extracted_existing' AND count_5_5 (re-extract pour KPI spec)
    """
    targets: list[dict] = []
    for s in manifest["stes"]:
        status = s.get("pipeline_status")
        if status == "extraction_pending":
            pass
        elif status == "extracted_existing" and s.get("count_5_5"):
            pass
        else:
            continue
        if countries and s["country"] not in countries:
            continue
        targets.append(s)
    # Sort: extraction_pending d'abord (priorité 1), puis par pays + ticker
    targets.sort(
        key=lambda s: (
            0 if s["pipeline_status"] == "extraction_pending" else 1,
            s["country"],
            s["ticker"],
        )
    )
    if limit:
        targets = targets[:limit]
    return targets


def read_annual_text_combined(ticker: str, max_chars: int = MAX_SOURCE_CHARS) -> tuple[str, list[str]]:
    """Lit + concatène les 5 annual-text. Retourne (text, years_used).

    Stratégie : trim per-year pour rester sous max_chars, en gardant
    une fraction équilibrée par année.
    """
    base = CAT3_DIR / ticker / "annual-text"
    if not base.is_dir():
        return "", []
    parts: list[tuple[str, str]] = []
    for y in TARGET_YEARS:
        f = base / f"{y}.txt"
        if not f.is_file():
            continue
        try:
            txt = f.read_text(errors="ignore")
        except Exception:
            continue
        parts.append((y, txt))
    if not parts:
        return "", []
    # Budget par année
    per_year = max_chars // max(1, len(parts))
    chunks = []
    years_used = []
    for y, txt in parts:
        chunk = txt[:per_year]
        chunks.append(f"========== YEAR {y} ==========\n{chunk}")
        years_used.append(y)
    return "\n\n".join(chunks), years_used


def build_prompt(ticker: str, name: str, country: str, sector: str | None, source_text: str) -> tuple[str, str]:
    sector_str = sector or "Secteur non renseigné"
    system = (
        "Tu es un analyste financier expert KPIs spécifiques sté/secteur. "
        "Tu lis des extraits de rapports annuels européens (FR/DE/IT/ES/EN/NL) "
        "et tu en extrais uniquement les KPIs SPECIFIQUES à la société ou son sous-secteur. "
        "Règles ABSOLUES :\n"
        "1. JAMAIS de KPIs génériques bannis : Revenue, Net Revenue, Sales, Op Margin, "
        "EPS, Net Income, EBITDA, FCF, Headcount, Capex, R&D, Gross Margin, Cap Return, "
        "DPS, Payout Ratio, Total Assets, Total Debt, Cash, Net Debt, Buybacks, Market Cap.\n"
        "2. Cibler les KPIs distinctifs : segments métier (ex Cloud Revenue, Backlog, "
        "Data Center Revenue), ratios sectoriels (Tier 1 ratio pour banques, ARPP pour "
        "telecoms, Same-Store Sales pour retail, Production kbpd pour énergie).\n"
        "3. ≥4 KPIs minimum, sur ≥3 ans (idéalement 5 ans 2020-2024).\n"
        "4. Si une valeur n'est PAS chiffrée explicitement dans le filing : `null`. "
        "JAMAIS extrapoler, JAMAIS inventer, JAMAIS estimer.\n"
        "5. Output : JSON strict, pas de markdown, pas de commentaire.\n"
    )
    user = (
        f"Société : {name} ({ticker}, {country}, {sector_str}).\n\n"
        "Extraits des rapports annuels 2020-2024 (texte tronqué pour budget tokens) :\n\n"
        f"{source_text}\n\n"
        "Renvoie UNIQUEMENT un JSON conforme à ce schéma :\n"
        "{\n"
        '  "ticker": "...",\n'
        '  "extracted_at": "ISO8601",\n'
        '  "official_name_guess": "...",\n'
        '  "kpis_supplementary": [\n'
        '    {\n'
        '      "short": "Backlog",\n'
        '      "name_fr": "Carnet de commandes",\n'
        '      "name_en": "Backlog",\n'
        '      "unit": "Mds €",\n'
        '      "history": [{"year": 2020, "value": null}, {"year": 2021, "value": 12.4}, ...],\n'
        '      "rationale_specific": "Pourquoi ce KPI est spécifique à la sté ou son secteur",\n'
        '      "source_quote": "Citation textuelle de la source"\n'
        '    }\n'
        "  ]\n"
        "}\n"
        "≥4 KPIs spécifiques. Si tu ne trouves pas 4 KPIs distinctifs : ajoute des "
        "champs `null` honnêtement, NE remplis PAS avec des génériques bannis. "
        "JSON ONLY, no markdown."
    )
    return system, user


def looks_banned(kpi_short: str) -> bool:
    s = (kpi_short or "").lower().strip()
    return s in BANNED_KPIS


def post_validate(draft: dict) -> dict:
    """Filtre les KPIs bannis et flag warnings."""
    warnings: list[str] = []
    kpis = draft.get("kpis_supplementary") or []
    kept = []
    for k in kpis:
        short = k.get("short", "")
        if looks_banned(short):
            warnings.append(f"BANNED_KPI_FILTERED: {short}")
            continue
        kept.append(k)
    draft["kpis_supplementary"] = kept
    if len(kept) < 4:
        warnings.append(f"INSUFFICIENT_KPIS: {len(kept)}<4")
    draft["_validation_warnings"] = warnings
    return draft


# ----- Cerebras client wrapper -----
class CerebrasRotator:
    def __init__(self):
        self.keys: list[tuple[str, str]] = []  # (env_name, key_value)
        for env in CEREBRAS_KEYS_ENV:
            v = os.environ.get(env)
            if v:
                self.keys.append((env, v))
        self.last_call: dict[str, float] = collections.defaultdict(float)
        self.idx = 0
        self.client = None
        if self.keys:
            try:
                from cerebras.cloud.sdk import Cerebras  # noqa
                self._Cerebras = Cerebras
            except ImportError:
                self._Cerebras = None
        else:
            self._Cerebras = None

    def available(self) -> bool:
        return bool(self.keys) and self._Cerebras is not None

    def next_key(self) -> tuple[str, str]:
        """Round-robin avec rate-limit attente."""
        if not self.keys:
            raise RuntimeError("No Cerebras keys configured")
        # Find key with oldest last_call
        env, key = self.keys[self.idx]
        self.idx = (self.idx + 1) % len(self.keys)
        elapsed = time.monotonic() - self.last_call[env]
        if elapsed < MIN_INTERVAL_PER_KEY:
            wait = MIN_INTERVAL_PER_KEY - elapsed
            time.sleep(wait)
        self.last_call[env] = time.monotonic()
        return env, key

    def call(self, system: str, user: str) -> str:
        env, key = self.next_key()
        client = self._Cerebras(api_key=key)
        resp = client.chat.completions.create(
            model=CEREBRAS_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.0,
            max_tokens=4096,
        )
        return resp.choices[0].message.content


def extract_one(rotator: CerebrasRotator, ticker_info: dict, dry_run: bool) -> dict | None:
    ticker = ticker_info["ticker"]
    name = ticker_info["official_name"]
    country = ticker_info["country"]
    sector = ticker_info.get("gics_sector")

    source_text, years_used = read_annual_text_combined(ticker)
    if not source_text:
        return {"ticker": ticker, "skipped": True, "reason": "no_annual_text"}

    system, user = build_prompt(ticker, name, country, sector, source_text)

    if dry_run:
        return {
            "ticker": ticker,
            "country": country,
            "name": name,
            "years_used": years_used,
            "source_chars": len(source_text),
            "prompt_chars": len(system) + len(user),
            "dry_run": True,
        }

    try:
        raw = rotator.call(system, user)
    except Exception as e:
        return {"ticker": ticker, "error": f"llm_call_failed: {e}"}

    # Parse JSON
    raw = raw.strip()
    # strip markdown fences if any
    if raw.startswith("```"):
        # naive: remove first and last fence
        lines = raw.splitlines()
        # drop lines that are ``` or ```json
        lines = [l for l in lines if not l.strip().startswith("```")]
        raw = "\n".join(lines)
    try:
        parsed = json.loads(raw)
    except Exception as e:
        return {
            "ticker": ticker,
            "error": f"json_parse_failed: {e}",
            "raw_first_500": raw[:500],
        }

    parsed.setdefault("ticker", ticker)
    parsed.setdefault("country", country)
    parsed.setdefault("official_name_input", name)
    parsed.setdefault("years_used", years_used)
    parsed["_extracted_by"] = "extract-eu5n-kpis-batch"
    parsed["_extracted_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    parsed["_model"] = CEREBRAS_MODEL
    parsed = post_validate(parsed)
    return parsed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="N'appelle pas le LLM, montre juste le plan.",
    )
    ap.add_argument("--limit", type=int, default=None, help="Limit nombre de stés.")
    ap.add_argument(
        "--countries",
        default=None,
        help="Filtre comma-separated, ex: France,Allemagne",
    )
    ap.add_argument(
        "--only-status",
        choices=["extraction_pending", "extracted_existing"],
        default=None,
        help="Filtre par status pipeline.",
    )
    args = ap.parse_args()

    manifest = load_manifest()
    countries = (
        {c.strip() for c in args.countries.split(",")} if args.countries else None
    )
    targets = filter_targets(manifest, countries, args.limit)
    if args.only_status:
        targets = [t for t in targets if t["pipeline_status"] == args.only_status]
        if args.limit:
            targets = targets[: args.limit]

    print(f"[plan] {len(targets)} stés cibles ({args.dry_run=})", file=sys.stderr)
    # Mini summary par pays
    by_c = collections.Counter(t["country"] for t in targets)
    for c, n in by_c.most_common():
        print(f"  - {c}: {n}", file=sys.stderr)

    if args.dry_run:
        # Show first 10 targets
        for t in targets[:10]:
            print(
                f"  · {t['ticker']:>14} ({t['country']:<11}) status={t['pipeline_status']}",
                file=sys.stderr,
            )
        if len(targets) > 10:
            print(f"  ... +{len(targets) - 10} more", file=sys.stderr)

    rotator = CerebrasRotator()
    if not args.dry_run:
        if not rotator.available():
            missing = []
            if not rotator.keys:
                missing.append("Aucune clé CEREBRAS_API_KEY trouvée dans env")
            if rotator.keys and rotator._Cerebras is None:
                missing.append(
                    "Package python 'cerebras-cloud-sdk' non installé"
                    " (pip install cerebras-cloud-sdk)"
                )
            print("FATAL prérequis manquants :", file=sys.stderr)
            for m in missing:
                print(f"  - {m}", file=sys.stderr)
            sys.exit(3)

    DRAFTS_DIR.mkdir(parents=True, exist_ok=True)

    written = 0
    skipped = 0
    errors = 0
    started = time.monotonic()

    for i, t in enumerate(targets, 1):
        ticker = t["ticker"]
        out_path = DRAFTS_DIR / f"{ticker}.json"
        if out_path.is_file() and not args.dry_run:
            print(f"[skip] {ticker} draft déjà présent ({out_path})", file=sys.stderr)
            skipped += 1
            continue

        try:
            result = extract_one(rotator, t, args.dry_run)
        except Exception as e:
            print(f"[err] {ticker} exception: {e}", file=sys.stderr)
            errors += 1
            continue

        if not result:
            errors += 1
            continue

        if not args.dry_run:
            out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2))
            print(f"[ok] {i}/{len(targets)} {ticker} -> {out_path}", file=sys.stderr)
            written += 1
        else:
            # dry-run: log only
            print(
                f"[dry] {i}/{len(targets)} {ticker} ({t['country']}) "
                f"src={result.get('source_chars', 0)}c prompt={result.get('prompt_chars', 0)}c",
                file=sys.stderr,
            )

    elapsed = time.monotonic() - started
    print(
        f"\n[done] targets={len(targets)} written={written} skipped={skipped} "
        f"errors={errors} elapsed={elapsed:.1f}s",
        file=sys.stderr,
    )
    print(f"[drafts] {DRAFTS_DIR}", file=sys.stderr)
    print(
        "\nNote: les drafts NE sont PAS écrits dans `src/data/`. "
        "Validation manuelle Yann requise avant promotion.",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
