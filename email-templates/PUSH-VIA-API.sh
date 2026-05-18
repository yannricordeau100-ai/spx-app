#!/usr/bin/env bash
# Push les 3 templates emails dans un projet Supabase via Management API.
# Utilisé pour pousser les templates niveau 1 sans avoir à les coller à la main.
#
# Usage :
#   export SUPABASE_PAT="sbp_xxx..."
#   export SUPABASE_PROJECT_REF="idpsbtgvuyfwtvzelogw"  # ou cnggtyxzqlqqjrynnvdq pour prod
#   bash email-templates/PUSH-VIA-API.sh
#
# Yann 18 mai 2026, bascule niveau 1.

set -euo pipefail

cd "$(dirname "$0")"

PAT="${SUPABASE_PAT:?SUPABASE_PAT non défini}"
REF="${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF non défini}"

CONFIRM_HTML=$(cat confirm-signup.html | jq -Rs .)
MAGIC_HTML=$(cat magic-link.html | jq -Rs .)
RESET_HTML=$(cat password-reset.html | jq -Rs .)

PAYLOAD=$(cat <<EOF
{
  "mailer_subjects_confirmation": "Active ton accès Mettrik",
  "mailer_templates_confirmation_content": $CONFIRM_HTML,
  "mailer_subjects_magic_link": "Ton lien de connexion Mettrik",
  "mailer_templates_magic_link_content": $MAGIC_HTML,
  "mailer_subjects_recovery": "Réinitialiser ton mot de passe Mettrik",
  "mailer_templates_recovery_content": $RESET_HTML,
  "mailer_subjects_invite": "Invitation à rejoindre Mettrik",
  "mailer_templates_invite_content": $CONFIRM_HTML,
  "mailer_subjects_email_change": "Confirmer ton nouvel email Mettrik",
  "mailer_templates_email_change_content": $MAGIC_HTML
}
EOF
)

echo "Pushing templates to project $REF..."
RESP=$(curl -sS -X PATCH "https://api.supabase.com/v1/projects/$REF/config/auth" \
  -H "Authorization: Bearer $PAT" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo "$RESP" | jq -c '{
  mailer_subjects_confirmation,
  mailer_subjects_magic_link,
  mailer_subjects_recovery,
  error: .error
}'

echo "✅ Done"
