#!/usr/bin/env bash
# Daily cron at 5h00 AM (added to user crontab).
# Translates EN + DE for all clean_all stés, then pushes to staging.
set -u

cd /Users/yann/spx-app || exit 1

# Source .env.local for CEREBRAS_API_KEY and others
if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
fi

TS=$(date +%Y-%m-%d_%H-%M-%S)
LOG="/tmp/translation-daily-${TS}.log"

{
  echo "=== Daily translation EN + DE — start $(date) ==="

  # Refresh audit (so list of clean_all stés is up to date)
  if [ -f scripts/audit-v1-9-pre-publication.js ]; then
    node scripts/audit-v1-9-pre-publication.js || echo "[warn] audit refresh failed"
  fi

  # Run translations (workers handled inside child scripts)
  /usr/bin/env python3 scripts/translate-stes-cerebras.py --locales en,de --workers 3

  echo "=== Translation done $(date) ==="

  # Stage changes & push
  cd /Users/yann/spx-app || exit 1
  git add src/data/v2-pipeline-i18n/ 2>/dev/null
  if ! git diff --cached --quiet; then
    git commit -m "chore(i18n): daily EN+DE translation refresh ${TS}" \
      --no-verify 2>&1 || echo "[warn] commit failed"
    git push origin staging 2>&1 || echo "[warn] push failed"
    echo "=== Push staging done $(date) ==="
  else
    echo "[info] no i18n changes to commit"
  fi
} >> "$LOG" 2>&1

# Symlink latest log
ln -sf "$LOG" /tmp/translation-daily-latest.log
