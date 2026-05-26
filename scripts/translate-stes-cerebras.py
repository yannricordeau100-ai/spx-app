#!/usr/bin/env python3
"""
Multi-locale translation orchestrator for clean_all stés.

For each locale in --locales (e.g. "en,de"), invokes the matching
translate-v17-kpis-to-<locale>.py script over all clean_all stés
from src/data/v1-9-pre-publication-audit.json.

Idempotency : the per-locale scripts skip stés whose i18n file mtime
> source file mtime (or already exist). This wrapper just iterates
locales and triggers them in sequence (or parallel via N_WORKERS).

Usage :
  python3 scripts/translate-stes-cerebras.py --locales en,de
  python3 scripts/translate-stes-cerebras.py --locales en,de --workers 3
"""
import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent.parent
AUDIT_PATH = ROOT / "src/data/v1-9-pre-publication-audit.json"

LOCALE_SCRIPTS = {
    "en": "translate-v17-kpis-to-en.py",
    "de": "translate-v17-kpis-to-de.py",
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--locales", default="en,de", help="Comma-separated locales (en,de)")
    parser.add_argument("--workers", type=int, default=3, help="Worker count per locale")
    parser.add_argument("--limit", type=int, default=0, help="Limit stés (for testing)")
    args = parser.parse_args()

    locales = [l.strip().lower() for l in args.locales.split(",") if l.strip()]
    unknown = [l for l in locales if l not in LOCALE_SCRIPTS]
    if unknown:
        print(f"[fatal] unsupported locales: {unknown}", file=sys.stderr)
        print(f"[info] supported: {list(LOCALE_SCRIPTS.keys())}", file=sys.stderr)
        return 1

    if not AUDIT_PATH.exists():
        print(f"[fatal] audit not found: {AUDIT_PATH}", file=sys.stderr)
        return 1

    with open(AUDIT_PATH, "r", encoding="utf-8") as f:
        audit = json.load(f)
    clean_tickers = [a["ticker"] for a in audit.get("audits", []) if a.get("is_clean_all")]
    if args.limit > 0:
        clean_tickers = clean_tickers[: args.limit]
    print(f"[info] clean_all stés to process: {len(clean_tickers)}")

    overall_start = time.time()
    # Yann 26 mai 2026 : spawn N_WORKERS procs en parallèle par locale,
    # chacun avec un KEY_INDEX différent (0/1/2 = 3 keys Cerebras).
    # Avant : 1 proc séquentiel = bottleneck TPM 1 key. Maintenant 3x débit.
    n_workers = max(1, min(args.workers, 3))
    for locale in locales:
        script_name = LOCALE_SCRIPTS[locale]
        script_path = ROOT / "scripts" / script_name
        if not script_path.exists():
            print(f"[warn] {script_name} not found, skipping locale {locale}")
            continue
        print(f"\n========== locale={locale} workers={n_workers} ==========")
        loc_start = time.time()
        procs = []
        for wid in range(n_workers):
            cmd = [sys.executable, str(script_path)]
            if args.limit > 0:
                cmd += ["--limit", str(args.limit)]
            env = os.environ.copy()
            env["KEY_INDEX"] = str(wid)
            env["WORKER_ID"] = str(wid)
            env["NUM_WORKERS"] = str(n_workers)
            print(f"[exec W{wid} KEY{wid}] {' '.join(cmd)}")
            p = subprocess.Popen(cmd, cwd=str(ROOT), env=env)
            procs.append(p)
        # Wait all
        rcs = [p.wait() for p in procs]
        loc_dur = time.time() - loc_start
        print(f"[done locale={locale}] rcs={rcs} duration={loc_dur:.1f}s")

    total_dur = time.time() - overall_start
    print(f"\n[done all] total duration={total_dur / 60:.1f}min")
    return 0


if __name__ == "__main__":
    sys.exit(main())
