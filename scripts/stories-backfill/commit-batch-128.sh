#!/bin/bash
# commit-batch-128.sh — Cerebras paid d_stories scaleup résiduel #2
# Usage: bash scripts/stories-backfill/commit-batch-128.sh <batch_num> <count_processed_so_far> <total>

set -e
cd /Users/yann/spx-app

BATCH_NUM="${1:-?}"
COUNT="${2:-?}"
TOTAL="${3:-205}"

# Stage uniquement les fichiers enrich modifiés + le results
git add src/data/v2-pipeline-enrich/*.json src/data/stories-backfill-residuel/results-batch6*.json 2>/dev/null || true

if git diff --cached --quiet; then
  echo "No changes to commit"
  exit 0
fi

N_MODIFIED=$(git diff --cached --name-only | grep -c "v2-pipeline-enrich" || echo 0)

git commit -m "feat(stories): Cerebras paid d_stories scaleup résiduel #2 batch ${BATCH_NUM} (#128)

Stés couvertes : ${N_MODIFIED} tickers SP500/top307 (~${COUNT}/${TOTAL} processed)
Source: scaleup_residuel_dstories.py (Cerebras paid qwen-3-235b + domain_filter inline)
APPEND-only on stories_kpis, 0 hallucination (domain filter strict)
"

echo "Commit batch ${BATCH_NUM} done: ${N_MODIFIED} enrich files"
