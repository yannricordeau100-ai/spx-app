#!/bin/bash
# Launch 2 parallel Cerebras workers (keys 0+1 only; key 2 quota exhausted)
cd "$(dirname "$0")/.."
mkdir -p .conv-state
LOGDIR=.conv-state
NUM_PROCS=2

for k in 0 1; do
  KEY_INDEX=$k NUM_PROCS=$NUM_PROCS python3 scripts/enrich-top-voting-capital.py --pass-b \
    > "$LOGDIR/CONV-CONCEPTS-top-voting-pass-b-key${k}.out" 2>&1 &
  echo "Started worker key=$k PID=$!"
done

wait
echo "All workers done"
