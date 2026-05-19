#!/bin/bash
# notify-conv.sh — envoie un message ciblé à une autre conv + broadcast SHARED-STATUS.
#
# Usage :
#   scripts/notify-conv.sh CONV-CONCEPTS "Texte du message"
#   scripts/notify-conv.sh CONV-CONCEPTS "Texte" --urgent  # préfixe URGENT-
#   scripts/notify-conv.sh CONV-CONCEPTS "Texte" --blocker  # préfixe BLOCKER-
#
# Yann 20 mai 2026 — protocole com inbox.
#
# Effet :
#   1. Append au log SHARED-STATUS.md (broadcast global)
#   2. Crée .conv-state/inbox/<TARGET>/<ISO>-from-<MY>.md (ciblé)
#   3. git add + commit + push staging (propagation immédiate)
#
# Auteur : nom de la conv = $CONV_NAME env var (export dans ~/.zshrc ou settings)
# Default : "UNKNOWN" si pas défini.

set -e

TARGET="${1:?Usage: notify-conv.sh <TARGET-CONV> <MESSAGE> [--urgent|--blocker]}"
MESSAGE="${2:?Message required}"
FLAG="${3:-}"

SENDER="${CONV_NAME:-UNKNOWN}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INBOX="$ROOT/.conv-state/inbox/$TARGET"
SHARED="$ROOT/SHARED-STATUS.md"

if [ ! -d "$INBOX" ]; then
  echo "❌ Target conv unknown: $TARGET. Available:"
  ls "$ROOT/.conv-state/inbox/" 2>/dev/null
  exit 1
fi

TS=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
PREFIX=""
[ "$FLAG" = "--urgent" ] && PREFIX="URGENT-"
[ "$FLAG" = "--blocker" ] && PREFIX="BLOCKER-"

FILE="$INBOX/${PREFIX}${TS}-from-${SENDER}.md"

cat > "$FILE" <<EOF
# Message de $SENDER → $TARGET
**Date :** $(date -u +"%Y-%m-%dT%H:%M:%SZ")
**Flag :** ${FLAG:-normal}

---

$MESSAGE
EOF

echo "✅ Inbox file: $FILE"

# Append broadcast SHARED-STATUS (top of log activity)
PARIS_TS=$(TZ='Europe/Paris' date +"%Y-%m-%d %Hh%M")
BROADCAST="[${PARIS_TS}] ${SENDER} → 🤝 @${TARGET} (via inbox)
${MESSAGE}

---
"

# Insert after "## Log d'activité (le plus récent en haut)\n\n"
python3 - "$SHARED" "$BROADCAST" <<'PY'
import sys
path, broadcast = sys.argv[1], sys.argv[2]
src = open(path).read()
marker = "## Log d'activité (le plus récent en haut)\n\n"
idx = src.find(marker)
if idx == -1:
    print("⚠️  marker not found, appending to end")
    open(path,'w').write(src + "\n" + broadcast)
else:
    pos = idx + len(marker)
    open(path,'w').write(src[:pos] + broadcast + src[pos:])
PY
echo "✅ Broadcast appended to SHARED-STATUS.md"

# Git commit + push
cd "$ROOT"
git add "$FILE" "$SHARED"
git commit -m "notify: $SENDER → $TARGET (${FLAG:-normal})

$(echo "$MESSAGE" | head -3)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>" > /dev/null 2>&1 || echo "⚠️  nothing to commit"
git push origin staging 2>&1 | tail -2

echo "📨 Notification envoyée à $TARGET."
