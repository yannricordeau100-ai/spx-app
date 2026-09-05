#!/usr/bin/env bash
# Incremente src/lib/version.ts (AAAA.MM.JJ.n) et ajoute une entree dans CHANGELOG.md.
# Usage : bash scripts/version-bump.sh "resume des modifications"
set -euo pipefail
cd "$(dirname "$0")/.."
RESUME="${1:?resume requis}"
AUJ=$(date +%Y.%m.%d)
CUR=$(grep -o '"[0-9.]*"' src/lib/version.ts | tr -d '"')
if [[ "$CUR" == "$AUJ".* ]]; then N=$(( ${CUR##*.} + 1 )); else N=1; fi
NEW="$AUJ.$N"
sed -i '' "s/VERSION = \"[0-9.]*\"/VERSION = \"$NEW\"/" src/lib/version.ts
SHA=$(git rev-parse --short HEAD)
printf '\n## v%s (%s, apres %s)\n- %s\n' "$NEW" "$(date '+%d %b %Y %H:%M')" "$SHA" "$RESUME" >> CHANGELOG.md
echo "$NEW"
