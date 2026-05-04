#!/usr/bin/env bash
# Wait for first iter run (PID arg) to die, then launch iter on SKIP'd stés
set -e
PID="${1:-17635}"
ITER_LOG="/Users/yann/spx-app/sec-data/_meta/p3-logs/iter-top50.log"
SKIP_LIST="/tmp/iter-skipped-pass2.txt"
ANTHROPIC_API_KEY="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"
export ANTHROPIC_API_KEY

# Wait until PID dies
while kill -0 "$PID" 2>/dev/null; do
    sleep 30
done

# Extract SKIP'd tickers from log
grep "\[SKIP\]" "$ITER_LOG" | grep "no sub-industry template" | grep -oE "[A-Z0-9.-]+: no sub-industry" | sed 's/: no sub-industry//' | sort -u > "$SKIP_LIST"

n=$(wc -l < "$SKIP_LIST" | tr -d ' ')
if [ "$n" -gt 0 ]; then
    cd /Users/yann/spx-app
    nohup python3 scripts/iterative-refinement.py --ticker-file "$SKIP_LIST" --budget 6 \
        > sec-data/_meta/p3-logs/iter-pass2-skipped.log 2>&1 &
    echo "Launched iter pass 2 on $n skipped tickers, PID $!"
else
    echo "No skipped tickers, nothing to do"
fi
