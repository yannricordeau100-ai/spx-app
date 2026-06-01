#!/bin/bash
# Usage: find_source.sh TICKER
# Prints: path|year|category  or "NONE"
T="$1"
BASE=/Users/yann/spx-app/sec-data

# Try US 10K
for Y in 2026 2025 2024; do
  F=$(ls $BASE/cat1-us/10K/$Y/${T}_*.htm.gz 2>/dev/null | sort -r | head -1)
  if [ -n "$F" ]; then
    echo "$F|$Y|us"
    exit 0
  fi
done

# Try FPI 20-F  
for Y in 2026 2025 2024; do
  F=$(ls $BASE/cat2-foreign-adr/20F/$Y/${T}_*.htm.gz 2>/dev/null | sort -r | head -1)
  if [ -n "$F" ]; then
    echo "$F|$Y|fpi"
    exit 0
  fi
done

# Try EU annual-text - need uppercase
EUDIR=$BASE/cat3-european/${T}/annual-text
if [ -d "$EUDIR" ]; then
  for Y in 2026 2025 2024; do
    if [ -f "$EUDIR/$Y.txt" ]; then
      echo "$EUDIR/$Y.txt|$Y|eu"
      exit 0
    fi
  done
fi

echo "NONE"
