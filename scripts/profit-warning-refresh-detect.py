#!/usr/bin/env python3
"""Cron mensuel : detecte les stes SP500 qui ont recu de nouveaux 8-K
depuis _profit_warning_at et dont le contenu contient des mots-cles de
profit warning. Genere .conv-state/profit-warning-refresh-todo-llm.json
avec la liste des stes a repasser sous LLM.

Idempotent : chaque run recalcule la liste depuis zero, ecrase le fichier.
Aucun appel API. Robuste : ignore silencieusement les stes sans data-lake.

Usage:
  python3 scripts/profit-warning-refresh-detect.py [--days N]

Default lookback : 90 jours si _profit_warning_at absent.
"""
from __future__ import annotations
import argparse
import gzip
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TICKERS_FILE = ROOT / 'src/data/v1-9-5-clean-all-tickers.json'
PIPELINE_DIR = ROOT / 'src/data/v2-pipeline'
DATA_LAKE = ROOT / 'data-lake'
STATE_DIR = ROOT / '.conv-state'
OUTPUT_FILE = STATE_DIR / 'profit-warning-refresh-todo-llm.json'

DEFAULT_LOOKBACK_DAYS = 90
MAX_FILES_SCANNED_PER_TICKER = 8  # safety
FILENAME_DATE_RE = re.compile(r'(\d{4}-\d{2}-\d{2})')

# Mots-cles warning FR + EN. Regex compilee une fois.
WARNING_PATTERNS = [
    r'reduc(?:e|ing|ed)\s+(?:our\s+|full[- ]year\s+)?guidance',
    r'lower(?:ing|ed|s)?\s+(?:our\s+|full[- ]year\s+)?(?:guidance|outlook|forecast)',
    r'below\s+(?:our\s+)?(?:prior|previously\s+issued|previous)\s+guidance',
    r'materially\s+lower',
    r'retir(?:e|ing|ed)\s+(?:our\s+)?(?:guidance|outlook)',
    r'withdraw(?:ing|n|s)?\s+(?:our\s+)?(?:guidance|outlook)',
    r'revised?\s+(?:downward|lower)',
    r'profit\s+warning',
    r'earnings\s+shortfall',
    r'cut(?:ting)?\s+(?:full[- ]year\s+)?(?:guidance|outlook)',
    r'weaker[- ]than[- ]expected',
    r'below\s+(?:our\s+)?expectations',
    # FR
    r'avertissement\s+sur\s+(?:les\s+)?r[eé]sultats',
    r'r[eé]vision\s+(?:[aà]\s+la\s+baisse|en\s+baisse)',
    r'perspectives?\s+d[eé]grad[eé]es?',
]
WARNING_RE = re.compile('|'.join(WARNING_PATTERNS), re.IGNORECASE)


def load_tickers() -> list[str]:
    with TICKERS_FILE.open() as f:
        data = json.load(f)
    if isinstance(data, list):
        return [t.upper() for t in data if isinstance(t, str)]
    if isinstance(data, dict):
        for key in ('tickers', 'universe', 'symbols'):
            if key in data and isinstance(data[key], list):
                return [t.upper() for t in data[key] if isinstance(t, str)]
    raise ValueError(f'Format inattendu pour {TICKERS_FILE}')


def get_reference_date(ticker: str, default: datetime) -> datetime:
    """Retourne _profit_warning_at (ou pw.last_date) si dispo, sinon default."""
    f = PIPELINE_DIR / f'{ticker.lower()}.json'
    if not f.exists():
        return default
    try:
        d = json.load(f.open())
    except Exception:
        return default
    for key in ('_profit_warning_at', '_profit_warning_refreshed_at'):
        val = d.get(key)
        if isinstance(val, str):
            parsed = parse_date(val)
            if parsed:
                return parsed
    pw = d.get('profit_warning') or {}
    val = pw.get('last_date')
    if isinstance(val, str):
        parsed = parse_date(val)
        if parsed:
            return parsed
    return default


def parse_date(s: str) -> datetime | None:
    if not s:
        return None
    s = s.strip()[:10]
    try:
        return datetime.strptime(s, '%Y-%m-%d').replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def scan_new_filings(ticker: str, since: datetime) -> tuple[list[dict], list[str]]:
    """Retourne (new_filings, warning_hits).
    new_filings = [{path, date}]
    warning_hits = liste de motifs trouves (dedupliques).
    """
    d8k = DATA_LAKE / ticker / '8K'
    if not d8k.is_dir():
        return [], []
    files = sorted(d8k.glob('*.htm.gz'), reverse=True)
    new_filings: list[dict] = []
    hits: set[str] = set()
    scanned = 0
    for p in files:
        m = FILENAME_DATE_RE.search(p.name)
        if not m:
            continue
        fdate = parse_date(m.group(1))
        if not fdate or fdate <= since:
            continue
        new_filings.append({'path': str(p.relative_to(ROOT)), 'date': m.group(1)})
        if scanned < MAX_FILES_SCANNED_PER_TICKER:
            scanned += 1
            try:
                with gzip.open(p, 'rt', errors='ignore') as fh:
                    text = fh.read()
            except Exception:
                continue
            for match in WARNING_RE.findall(text):
                hits.add(match.strip().lower()[:80])
    return new_filings, sorted(hits)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--days', type=int, default=DEFAULT_LOOKBACK_DAYS,
                    help='Lookback en jours si _profit_warning_at absent (defaut 90).')
    args = ap.parse_args()

    now = datetime.now(timezone.utc)
    default_since = now - timedelta(days=args.days)

    try:
        tickers = load_tickers()
    except Exception as e:
        print(f'ERROR chargement tickers: {e}', file=sys.stderr)
        sys.exit(1)

    todo: list[dict] = []
    scanned_count = 0
    for tk in tickers:
        since = get_reference_date(tk, default_since)
        new_filings, hits = scan_new_filings(tk, since)
        if not new_filings:
            continue
        scanned_count += 1
        needs = bool(hits)
        # Meme sans hit keyword, on flag si beaucoup de nouveaux 8-K (contexte)
        if needs or len(new_filings) >= 3:
            todo.append({
                'ticker': tk,
                'since': since.date().isoformat(),
                'new_filings': new_filings[:20],
                'new_filings_count': len(new_filings),
                'warning_hits': hits,
                'needs_recheck': needs or len(new_filings) >= 3,
            })

    STATE_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        'generated_at': now.isoformat(),
        'lookback_days_default': args.days,
        'universe_size': len(tickers),
        'scanned_with_new_filings': scanned_count,
        'todo_count': len(todo),
        'todo': todo,
    }
    with OUTPUT_FILE.open('w') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f'Wrote {OUTPUT_FILE} : {len(todo)} stes a repasser sous LLM '
          f'(sur {scanned_count} stes avec 8-K nouveaux, univers={len(tickers)}).')


if __name__ == '__main__':
    main()
