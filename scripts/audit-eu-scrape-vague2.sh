#!/usr/bin/env bash
# Lightweight bash helper to inspect EU scrape vague 1+2 quality.
# Reads /Users/yann/spx-app/sec-data/cat3-european/<TICKER>/annual-text/<YEAR>.txt
# Mac-friendly (single pass, no parallelism).
#
# Usage:
#   ./audit-eu-scrape-vague2.sh            # full audit via Python
#   ./audit-eu-scrape-vague2.sh quick      # quick size+count summary in bash only
#   ./audit-eu-scrape-vague2.sh check TICKER YEAR NAME
#                                          # inspect one file (size, year mentions, name hits)

set -euo pipefail

ROOT="/Users/yann/spx-app/sec-data/cat3-european"
META="/Users/yann/spx-app/sec-data/_meta"
PY="/Users/yann/spx-app/scripts/audit-eu-scrape-vague2.py"

MODE="${1:-full}"

case "$MODE" in
  full)
    echo "[audit] running full Python audit (1400+ files, ~30-60s)..."
    python3 "$PY"
    echo "[audit] done. Reports:"
    echo "  $META/audit-quality-vague2.json"
    echo "  $META/audit-quality-vague2.md"
    ;;

  quick)
    echo "[audit] quick scan: files modified < 24h"
    cnt=$(find "$ROOT" -name "*.txt" -path "*/annual-text/*" -mtime -1 | wc -l | tr -d ' ')
    echo "  total: $cnt"
    echo "  size distribution:"
    find "$ROOT" -name "*.txt" -path "*/annual-text/*" -mtime -1 -exec stat -f '%z %N' {} \; \
      | awk '{
          s=$1;
          if (s<10240) b="<10KB";
          else if (s<51200) b="10-50KB";
          else if (s<512000) b="50-500KB";
          else if (s<2097152) b="500KB-2MB";
          else b=">2MB";
          buckets[b]++;
        } END { for (b in buckets) printf "    %-12s %d\n", b, buckets[b] }' \
      | sort
    ;;

  check)
    TICKER="${2:?ticker required}"
    YEAR="${3:?year required}"
    NAME="${4:-}"
    FILE="$ROOT/$TICKER/annual-text/$YEAR.txt"
    if [[ ! -f "$FILE" ]]; then
      echo "MISSING: $FILE"
      exit 1
    fi
    SIZE=$(stat -f %z "$FILE")
    YHITS=$(grep -c "$YEAR" "$FILE" || true)
    echo "file:         $FILE"
    echo "size:         $SIZE bytes"
    echo "year_mentions: $YHITS ('$YEAR')"
    if [[ -n "$NAME" ]]; then
      NHITS=$(grep -ci "$NAME" "$FILE" || true)
      echo "name_hits:    $NHITS ('$NAME', case-insensitive)"
    fi
    echo "--- first 20 lines ---"
    head -20 "$FILE"
    ;;

  *)
    echo "usage: $0 [full|quick|check TICKER YEAR [NAME]]"
    exit 2
    ;;
esac
