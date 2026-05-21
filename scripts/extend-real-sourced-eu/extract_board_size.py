#!/usr/bin/env python3
"""
Sub-agent #106: Extract board_size from sec-data sources for EU stés where:
- audit g_governance.missing INCLUDES board_size
- audit g_governance.missing does NOT include ceo_name or voting_structure
- overrides_governance._source_file exists physically
- overrides_governance.extraction_status matches heuristic_real_eu

Strategy: regex multi-langue (FR/EN/DE/IT/ES/NL) on the source file to find:
- "Board of Directors comprises N members"
- "X members of the board"
- "Conseil d'Administration de N membres"
- "Verwaltungsrat besteht aus N Mitglieder"
- "Consejo de Administración de N miembros"
- etc.

Verification: if regex finds value 5 ≤ N ≤ 25 (typical board sizes), accept.
Otherwise SKIP (don't fabricate).

Writes to overrides_governance.board_size in v2-pipeline-enrich/<ticker>.json.
"""

import json
import os
import re
import sys
import gzip
from pathlib import Path
from datetime import datetime, timezone

REPO = Path(__file__).resolve().parent.parent.parent
INPUT_FILE = REPO / 'tmp_eu_fillable_board_size.json'
ENRICH_DIR = REPO / 'src/data/v2-pipeline-enrich'

# Regex patterns multi-langue, ordered by reliability
PATTERNS = [
    # English (most reliable)
    (r'(?:Board of Directors|Board)\s+(?:currently\s+)?(?:comprises|consists of|is composed of|has|comprised|composed of|consist of|comprises of|comprising)\s+(\d{1,2})\s+(?:members|directors|individuals|persons)', 'en1'),
    (r'(?:The\s+)?Board\s+(?:currently\s+)?has\s+(\d{1,2})\s+(?:members|directors)', 'en2'),
    (r'(?:our|the)\s+Board\s+of\s+Directors\s+(?:consists|comprises)\s+of\s+(\d{1,2})', 'en3'),
    (r'(\d{1,2})\s+(?:non-executive\s+)?(?:members\s+of\s+the\s+Board|members\s+sit\s+on\s+the\s+Board|directors\s+on\s+the\s+Board)', 'en4'),
    (r'Board\s+composition[:\s]+(\d{1,2})\s+(?:members|directors)', 'en5'),
    # French
    (r"Conseil d'[Aa]dministration\s+(?:est composé|composé|comprend|comporte|comprenant)\s+de\s+(\d{1,2})\s+(?:membres|administrateurs)", 'fr1'),
    (r"(\d{1,2})\s+(?:membres|administrateurs)\s+(?:du|au sein du|composent le|composent)\s+[Cc]onseil", 'fr2'),
    (r"[Cc]onseil de Surveillance\s+(?:est composé|composé|comprend)\s+de\s+(\d{1,2})", 'fr3'),
    # German
    (r'(?:Verwaltungsrat|Aufsichtsrat|Vorstand)\s+(?:besteht|besteht aus|umfasst|setzt sich zusammen aus)\s+(\d{1,2})\s+(?:Mitglieder|Personen)', 'de1'),
    (r'(\d{1,2})\s+Mitglieder?\s+des\s+(?:Verwaltungsrat|Aufsichtsrat|Vorstand)', 'de2'),
    # Italian
    (r"[Cc]onsiglio\s+(?:di Amministrazione|d'Amministrazione)\s+(?:è composto|composto|comprende)\s+da\s+(\d{1,2})", 'it1'),
    (r"(\d{1,2})\s+(?:membri|amministratori)\s+(?:del|nel)\s+[Cc]onsiglio", 'it2'),
    # Spanish
    (r"[Cc]onsejo\s+de\s+Administración\s+(?:está compuesto|compuesto|integrado|formado)\s+por\s+(\d{1,2})", 'es1'),
    (r"(\d{1,2})\s+(?:miembros|consejeros)\s+(?:del|en el)\s+[Cc]onsejo", 'es2'),
    # Dutch
    (r"[Rr]aad\s+van\s+(?:Bestuur|Commissarissen)\s+(?:bestaat uit|telt|omvat)\s+(\d{1,2})", 'nl1'),
    (r"(\d{1,2})\s+leden\s+(?:van de|in de)\s+[Rr]aad", 'nl2'),
]


def read_source_file(path: Path, max_chars: int = 2_000_000) -> str:
    """Read text file, handling gzip if needed."""
    if not path.exists():
        return ''
    try:
        if path.suffix == '.gz' or str(path).endswith('.htm.gz'):
            with gzip.open(path, 'rt', encoding='utf-8', errors='replace') as f:
                content = f.read(max_chars)
                # Strip HTML if it's a DEF14A
                content = re.sub(r'<[^>]+>', ' ', content)
                content = re.sub(r'\s+', ' ', content)
                return content
        else:
            with open(path, 'r', encoding='utf-8', errors='replace') as f:
                return f.read(max_chars)
    except Exception as e:
        return ''


def extract_board_size(text: str) -> tuple:
    """Returns (size, pattern_id, evidence) or (None, None, None)."""
    if not text:
        return None, None, None
    # Try each pattern, return first plausible match
    candidates = []
    for pattern, pid in PATTERNS:
        for m in re.finditer(pattern, text, re.IGNORECASE):
            try:
                n = int(m.group(1))
                if 5 <= n <= 25:
                    start = max(0, m.start() - 50)
                    end = min(len(text), m.end() + 50)
                    evidence = text[start:end].strip()[:200]
                    candidates.append((n, pid, evidence))
            except (ValueError, IndexError):
                continue
    if not candidates:
        return None, None, None
    # Pick most frequent value (boards often mentioned multiple times)
    from collections import Counter
    counter = Counter(c[0] for c in candidates)
    most_common_value, _ = counter.most_common(1)[0]
    # Find one example with that value
    for n, pid, ev in candidates:
        if n == most_common_value:
            return n, pid, ev
    return None, None, None


def main():
    if not INPUT_FILE.exists():
        print(f'ERROR: {INPUT_FILE} not found. Run prep step first.', file=sys.stderr)
        sys.exit(1)

    targets = json.loads(INPUT_FILE.read_text())
    print(f'Processing {len(targets)} candidates...\n')

    results = {
        'updated': [],
        'skipped_no_source': [],
        'skipped_no_match': [],
        'skipped_file_missing': [],
        'errors': [],
    }

    now_iso = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    for c in targets:
        ticker = c['ticker']
        sf = c['source_file']
        sf_path = REPO / sf if not sf.startswith('/') else Path(sf)
        if not sf_path.exists():
            print(f'  {ticker:15s} SKIP file missing: {sf}')
            results['skipped_file_missing'].append(ticker)
            continue

        text = read_source_file(sf_path)
        if not text:
            print(f'  {ticker:15s} SKIP no text read')
            results['skipped_no_source'].append(ticker)
            continue

        size, pid, evidence = extract_board_size(text)
        if size is None:
            print(f'  {ticker:15s} SKIP no regex match (text {len(text)} chars)')
            results['skipped_no_match'].append(ticker)
            continue

        # Update enrich file
        enrich_path = ENRICH_DIR / f'{ticker.lower()}.json'
        if not enrich_path.exists():
            print(f'  {ticker:15s} SKIP enrich file missing')
            results['skipped_file_missing'].append(ticker)
            continue

        try:
            d = json.loads(enrich_path.read_text())
            og = d.get('overrides_governance', {})
            if og.get('board_size') is not None:
                print(f'  {ticker:15s} SKIP already has board_size={og.get("board_size")}')
                continue
            og['board_size'] = size
            og['_board_size_extracted_at'] = now_iso
            og['_board_size_pattern'] = pid
            og['_board_size_evidence'] = evidence
            d['overrides_governance'] = og
            enrich_path.write_text(json.dumps(d, indent=2, ensure_ascii=False))
            print(f'  {ticker:15s} OK board_size={size} pattern={pid}')
            results['updated'].append({'ticker': ticker, 'board_size': size, 'pattern': pid})
        except Exception as e:
            print(f'  {ticker:15s} ERROR {e}')
            results['errors'].append({'ticker': ticker, 'error': str(e)})

    # Summary
    print(f'\n=== SUMMARY ===')
    print(f'Updated         : {len(results["updated"])}')
    print(f'Skipped no source: {len(results["skipped_no_source"])}')
    print(f'Skipped no match: {len(results["skipped_no_match"])}')
    print(f'File missing    : {len(results["skipped_file_missing"])}')
    print(f'Errors          : {len(results["errors"])}')

    report_path = REPO / 'scripts/extend-real-sourced-eu/report.json'
    report_path.write_text(json.dumps(results, indent=2, ensure_ascii=False))
    print(f'\nReport: {report_path}')


if __name__ == '__main__':
    main()
