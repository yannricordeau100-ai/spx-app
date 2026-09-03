#!/bin/bash
# Chaine quotidienne 23h00 (heure du Mac, Europe/Zurich) — Yann 27 aout 2026.
# Le Mac n est quasiment jamais allume a l aube : les veilles documentaires
# sont donc rejouees ICI, juste avant l extraction, pour que la chaine soit
# complete en une seule fenetre du soir.
#   1. veille US (nouveaux depots SEC)
#   2. veille Europe (pages investisseurs, 124 stes)
#   3. extraction et ecriture des nouveaux points (moteur : session Claude
#      Code locale — profil ~/.claude-20x s il existe, sinon profil defaut)
cd /Users/yann/spx-app || exit 1
export PATH="/usr/local/bin:/usr/bin:/bin"
# cron ne transmet ni USER ni LOGNAME. Sans eux, le CLI Claude ne retrouve pas
# ses identifiants dans le trousseau macOS et repond "Not logged in" avec un
# code de retour 0. C est ce qui a fait tomber la passe du 27 aout dans le mode
# dossier : 694 dossiers ecrits, aucun point extrait.
export USER="${USER:-$(id -un)}"
export LOGNAME="$USER"
{
  echo "=== $(date '+%F %T') veille US ==="
  nice -n 10 python3 scripts/daily-doc-watcher.py
  echo "=== $(date '+%F %T') veille EU ==="
  nice -n 10 python3 scripts/fr-doc-watcher.py
  echo "=== $(date '+%F %T') extraction ==="
  # Sonde moteur (2 sept 2026) : un appel minimal AVANT la passe, avec la
  # reponse ou l erreur exacte dans le log. 6 nuits ont echoue en silence.
  echo "--- sonde moteur claude -p :"
  claude -p --model sonnet --output-format text <<< "Reponds exactement: SONDE-OK" 2>&1 | tail -2
  nice -n 10 python3 scripts/earnings-refresh.py --apply
  echo "=== $(date '+%F %T') transcripts d earnings calls (Fool, 3 derniers mois) ==="
  # Yann 30 aout 2026 : la chaine transcripts/syntheses n etait branchee sur
  # aucun cron — les syntheses vieillissaient en silence (GOOGL bloque au T1,
  # 0/8 stes du 27 aout a jour). transcripts-refresh ne remplace que par plus
  # recent ; summaries-refresh (moteur claude -p) ne regenere que si le
  # transcript a change.
  MOIS_TR=$(python3 -c "from datetime import date
d=date.today(); y,m=d.year,d.month; ms=[]
for _ in range(3):
    ms.append(f'{y}-{m:02d}'); m-=1
    if m==0: m,y=12,y-1
print(','.join(reversed(ms)))")
  nice -n 10 python3 scripts/transcripts-refresh.py --mois "$MOIS_TR"
  echo "=== $(date '+%F %T') syntheses des transcripts mis a jour ==="
  # Fix 2 sept 2026 : le script exige --tickers, l appel nu echouait CHAQUE
  # nuit ("error: the following arguments are required: --tickers") et aucune
  # synthese n etait regeneree. On passe les tickers dont le transcript a
  # bouge dans les dernieres 24 h (mtime) ; s il n y en a aucun, on saute.
  TICKERS_FRAIS=$(find src/data/transcripts -name '*.json' -mtime -1 2>/dev/null \
    | sed 's|.*/||; s|\.json$||' | tr '[:lower:]' '[:upper:]' | paste -sd, -)
  if [ -n "$TICKERS_FRAIS" ]; then
    nice -n 10 python3 scripts/summaries-refresh.py --tickers "$TICKERS_FRAIS"
  else
    echo "aucun transcript modifie en 24 h : pas de synthese a refaire"
  fi
  echo "=== $(date '+%F %T') controle des publications attendues ==="
  # Compare le calendrier des resultats a ce qui est reellement tombe dans le
  # data-lake. Sans ce controle, une publication captee par personne passe
  # totalement inapercue. Purement mecanique, aucun appel LLM ni reseau.
  nice -n 10 python3 scripts/verifie-publications.py
  echo "=== $(date '+%F %T') fin ==="
} >> /tmp/earnings-refresh.log 2>&1

# ── Bilan et alerte (3 sept 2026) : 6 nuits avaient echoue en silence. ──
# Rotation du journal au-dela de 50 Mo, bilan de la passe, email rouge au
# proprietaire si le moteur n a rien traite (identifiants, quota, panne).
if [ "$(stat -f%z /tmp/earnings-refresh.log 2>/dev/null || echo 0)" -gt 52428800 ]; then
  mv /tmp/earnings-refresh.log "/tmp/earnings-refresh.$(date +%Y%m%d).log"
fi
BILAN=$(grep -E "FINI \{" /tmp/earnings-refresh.log | tail -1)
TRAITE=$(printf '%s' "$BILAN" | sed -E "s/.*'traite': ([0-9]+).*/\1/")
DOSSIERS=$(printf '%s' "$BILAN" | sed -E "s/.*'dossier prepare': ([0-9]+).*/\1/")
MOTIF=$(grep -oE "motif=[^$]{0,160}" /tmp/earnings-refresh.log | tail -1)
python3 - "$TRAITE" "$DOSSIERS" "$MOTIF" <<'PY'
import json, sys, subprocess, re
traite, dossiers, motif = sys.argv[1], sys.argv[2], sys.argv[3]
etat = {"date": subprocess.run(["date","+%F %T"],capture_output=True,text=True).stdout.strip(),
        "traite": traite, "dossiers_prepares": dossiers, "dernier_motif": motif}
open("/Users/yann/spx-app/.conv-state/earnings-refresh-dernier-bilan.json","w").write(json.dumps(etat, ensure_ascii=False, indent=1))
env = {}
for l in open("/Users/yann/spx-app/.env.local"):
    l = l.strip()
    if "=" in l and not l.startswith("#"):
        k, v = l.split("=", 1); env[k] = v.strip().strip('"')
cle, dest = env.get("RESEND_API_KEY"), env.get("DESK_OWNER_EMAIL")
ok_traite = traite.isdigit() and int(traite) > 0
if cle and dest and not ok_traite:
    corps = f"Passe de 23h : {traite or '?'} societe(s) traitee(s), {dossiers or '?'} dossier(s) prepares sans extraction.\nDernier motif : {motif or 'aucun'}\nJournal : /tmp/earnings-refresh.log"
    subprocess.run(["curl","-s","-X","POST","https://api.resend.com/emails","-H",f"Authorization: Bearer {cle}","-H","Content-Type: application/json",
        "-d", json.dumps({"from":"Mettrik Robots <noreply@mettrik.ai>","to":[dest],"subject":"🔴 Mise a jour des societes : le moteur n a rien extrait cette nuit","text":corps})],capture_output=True)
print(f"bilan : traite={traite} dossiers={dossiers} alerte={'envoyee' if (cle and dest and not ok_traite) else 'non'}")
PY
