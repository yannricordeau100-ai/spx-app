#!/usr/bin/env bash
# Extraction des KPI des 4 dernieres conferences, une societe par appel Claude
# sans interface (contexte neuf a chaque societe, pas de relecture d un gros
# contexte d orchestration). Lance A LA DEMANDE de Yann, jamais par un cron.
# Garde-fou deux comptes (RULES-GOLDEN 0terdecies) : s arrete net si le compte
# connecte change en cours de route.
# Usage : bash scripts/transcripts-4-extraction-lot.sh <liste.json> [parallele]
set -u
# Binaire Claude Code le plus recent (celui de l app, le /usr/local/bin est trop ancien pour Fable)
CLAUDE_BIN=$(ls -d "$HOME/Library/Application Support/Claude/claude-code/"*/claude.app/Contents/MacOS/claude 2>/dev/null | sort -V | tail -1)
[ -x "$CLAUDE_BIN" ] || CLAUDE_BIN=claude
ROOT=/Users/yann/spx-app; cd "$ROOT"
LISTE="$1"; PAR="${2:-4}"
LOG=/tmp/transcripts-4-lot.log; LOCK=/tmp/transcripts-4-git.lock
COMPTE0=$(python3 -c "import json,os;print(json.load(open(os.path.expanduser('~/.claude.json'))).get('oauthAccount',{}).get('emailAddress',''))")
echo "$(date '+%d %H:%M') DEBUT compte=$COMPTE0 parallele=$PAR" >> "$LOG"

une() {
  T="$1"; l=$(echo "$T" | tr 'A-Z' 'a-z')
  C=$(python3 -c "import json,os;print(json.load(open(os.path.expanduser('~/.claude.json'))).get('oauthAccount',{}).get('emailAddress',''))")
  if [ "$C" != "$COMPTE0" ]; then echo "$(date '+%d %H:%M') STOP compte change ($COMPTE0 -> $C), $T non lance" >> "$LOG"; touch /tmp/transcripts-4-STOP; return; fi
  [ -f /tmp/transcripts-4-STOP ] && return
  [ -f "src/data/transcripts-kpi/$l.json" ] && return
  NOM=$(python3 -c "import json;d=json.load(open('src/data/v2-pipeline/$l.json')) if __import__('os').path.exists('src/data/v2-pipeline/$l.json') else {};print(d.get('name') or '$T')" 2>/dev/null)
  for essai in 1 2; do
    find /tmp/transcripts-kpi -maxdepth 1 \( -name "$T.20*.json" -o -name "outil-$T.py" \) -delete
    CONSIGNE=""; [ $essai = 2 ] && CONSIGNE="ATTENTION : un premier passage a extrait trop peu d indicateurs. Lis l INTEGRALITE de chaque texte, du debut a la fin, questions des analystes comprises."
    PROMPT="Depot /Users/yann/spx-app. Societe $NOM ($T). Le fichier src/data/transcripts/$l.json contient 4 conferences de resultats dans le tableau calls (champs date et content). Pour CHAQUE conference, applique a la lettre le prompt fige docs/cahier/PROMPT-TRANSCRIPT-KPI.md (lis-le d abord) et ecris /tmp/transcripts-kpi/$T.<date>.json (date = champ date de la conference). $CONSIGNE Si tu as besoin d un script auxiliaire, nomme-le /tmp/transcripts-kpi/outil-$T.py et rien d autre. Ne touche a AUCUN fichier d une autre societe, ne modifie rien sous src/. N utilise jamais le navigateur integre. Reponds uniquement TERMINE nombre=<total> a la fin."
    for MODELE in claude-fable-5-1 claude-opus-5-5; do
      OUT=$("$CLAUDE_BIN" -p "$PROMPT" --model "$MODELE" --dangerously-skip-permissions --output-format text 2>&1 | tail -3)
      echo "$OUT" | grep -qi "limit\|quota\|rate\|does not support\|API Error" && { echo "$(date '+%d %H:%M') $T limite sur $MODELE, bascule" >> "$LOG"; continue; }
      break
    done
    n=$(ls /tmp/transcripts-kpi/ 2>/dev/null | grep -cE "^$(echo "$T" | sed 's/\./\\./g')\.20[0-9-]+\.json$")
    if [ "$n" -eq 0 ]; then
      echo "$(date '+%d %H:%M') $T ECHEC aucune sortie ($MODELE) : $OUT" >> "$LOG"
      # limite de session atteinte : on s'arrete au lieu de griller toute la liste
      echo "$OUT" | grep -qi "session limit\|hit your" && { echo "limite de session" > /tmp/transcripts-4-STOP; echo "$(date '+%d %H:%M') STOP limite de session" >> "$LOG"; }
      return
    fi
    python3 scripts/transcripts-kpi-verif.py "$T" --applique > /tmp/verif-$T.txt 2>&1 || { echo "$(date '+%d %H:%M') $T ECHEC verif" >> "$LOG"; return; }
    DENS=$(python3 -c "
import json
t=json.load(open('src/data/transcripts/$l.json'));k=json.load(open('src/data/transcripts-kpi/$l.json'))
ch=sum(len(c.get('content','')) for c in t['calls']);n=sum(len(c['kpis']) for c in k['calls'])
print(round(n/max(ch,1)*10000,1))")
    if python3 -c "import sys;sys.exit(0 if $DENS>=3 else 1)"; then break; fi
    echo "$(date '+%d %H:%M') $T densite $DENS trop faible, relance integrale" >> "$LOG"
    rm -f "src/data/transcripts-kpi/$l.json"
    [ $essai = 2 ] && { echo "$(date '+%d %H:%M') $T INCOMPLET apres 2 essais" >> "$LOG"; return; }
  done
  python3 scripts/transcripts-kpi-suivi.py "$T" > /dev/null 2>&1
  until mkdir "$LOCK" 2>/dev/null; do sleep 2; done
  git add "src/data/transcripts-kpi/$l.json" "src/data/transcripts-kpi/$l.suivi.json" 2>/dev/null
  git commit -q -m "commit local de protection : transcripts-kpi $T" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" >/dev/null 2>&1
  rmdir "$LOCK"
  echo "$(date '+%d %H:%M') $T OK densite=$DENS modele=$MODELE $(tail -1 /tmp/verif-$T.txt)" >> "$LOG"
}
export -f une; export COMPTE0 LOG LOCK CLAUDE_BIN
rm -f /tmp/transcripts-4-STOP
python3 -c "import json;print('\n'.join(json.load(open('$LISTE'))))" | xargs -P "$PAR" -I{} bash -c 'une "$@"' _ {}
echo "$(date '+%d %H:%M') FIN" >> "$LOG"
python3 scripts/transcripts-4-etat.py >> "$LOG" 2>&1
