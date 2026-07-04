#!/bin/bash
# Deploy chain complete vers mettrik-niveau2 (Yann 4 juillet 2026).
# Usage: ./scripts/deploy-niveau2.sh
# push (si commits locaux) -> attend le build Vercel du dernier deploiement -> realias niveau2.
set -euo pipefail
cd "$(dirname "$0")/.."

git push origin staging 2>&1 | tail -1

echo "Attente du deploiement Vercel..."
sleep 20
DEP=$(vercel ls 2>/dev/null | grep -m1 'https://' | awk '{print $3}')
if [ -z "$DEP" ]; then echo "ERREUR: deploiement introuvable"; exit 1; fi
echo "Deploiement: $DEP"

for i in $(seq 1 30); do
  STATUS=$(vercel inspect "$DEP" 2>&1 | grep -m1 'status' || true)
  case "$STATUS" in
    *Ready*) echo "Build Ready."; break ;;
    *Error*) echo "ERREUR: build en echec"; exit 1 ;;
    *) sleep 15 ;;
  esac
  if [ "$i" = "30" ]; then echo "ERREUR: timeout build"; exit 1; fi
done

vercel alias set "$DEP" mettrik-niveau2.vercel.app
echo "OK: https://mettrik-niveau2.vercel.app -> $DEP"
