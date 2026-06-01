#!/usr/bin/env bash
# Trigger Vercel deploy + auto-alias mettrik-niveau2 to the new ready deploy.
# Évite le bug de l'alias figé qu'on a découvert le 2026-06-02.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env.local; set +a

echo "→ Triggering Vercel deploy hook..."
JOB=$(curl -s -X POST "$VERCEL_DEPLOY_HOOK_STAGING")
echo "  $JOB"

echo "→ Waiting 30s for deploy to register..."
sleep 30

# Find the newest preview deploy in BUILDING/QUEUED/READY state
echo "→ Polling for latest deploy URL..."
DEPLOY_URL=""
for i in $(seq 1 20); do
  DEPLOY_URL=$(npx vercel ls --token="$VERCEL_TOKEN" 2>/dev/null \
    | grep -E "^\s+[0-9]+m\s+yannricordeau100" \
    | head -1 \
    | awk '{print $3}' \
    | sed 's|https://||' || true)
  if [ -n "$DEPLOY_URL" ]; then
    echo "  Latest: $DEPLOY_URL"
    break
  fi
  sleep 10
done

if [ -z "$DEPLOY_URL" ]; then
  echo "❌ No deploy URL found after 200s"
  exit 1
fi

echo "→ Waiting for $DEPLOY_URL to be Ready..."
until npx vercel inspect "$DEPLOY_URL" --token="$VERCEL_TOKEN" 2>&1 | grep -q "● Ready"; do
  echo "  ...still building"
  sleep 15
done

echo "→ Aliasing mettrik-niveau2 to $DEPLOY_URL"
npx vercel alias set "$DEPLOY_URL" mettrik-niveau2.vercel.app --token="$VERCEL_TOKEN"

echo "✅ Live: https://mettrik-niveau2.vercel.app"
