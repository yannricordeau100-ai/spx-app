#!/bin/bash
# Sauvegarde commune aux deux comptes Claude (Yann 9 oct 2026) : a lancer a 95 % puis 98 % de la limite hebdomadaire.
# Usage : bash scripts/sauvegarde-relais.sh <etiquette>
set -u
cd /Users/yann/spx-app
ET=${1:-manuel}
D=/Users/yann/Mettrik-sauvegardes/$(date +%Y-%m-%d-%H%M)-$ET
mkdir -p "$D"
# Garde-fou disque : jamais sous 15 Go libres
LIBRE=$(df -g /Users/yann | tail -1 | awk '{print $4}'); [ "$LIBRE" -lt 15 ] && { echo "ESPACE INSUFFISANT ($LIBRE Go)"; exit 1; }
# 1. etat de l extraction sp5001000
python3 - > docs/rapports-session-2026-10/sp5001000-extraction-etat.md <<'PY'
import json,glob,collections,datetime
c=collections.Counter(); lignes=[]
for f in sorted(glob.glob('data-lake/_sp5001000/etat-extraction/*.json')):
    try: d=json.load(open(f))
    except Exception: c['illisible']+=1; continue
    st='p3 fini' if d.get('p3') else ('verifie' if d.get('verif') else d.get('p2','?'))
    c[st]+=1; lignes.append(f"| {d.get('ticker')} | {d.get('p2')} | {d.get('series')} | {d.get('hero')} | {(d.get('verif') or {}).get('ok','-')}/{(d.get('verif') or {}).get('points','-')} | {', '.join((d.get('p3') or {}).get('ecrits',[]))} |")
print(f"# Extraction sp5001000 : etat au {datetime.datetime.now():%Y-%m-%d %H:%M}\n")
print("Statuts : "+", ".join(f"{k} {v}" for k,v in c.items())+f" ; total {sum(c.values())}/490\n")
print("Reprise : relancer le workflow (scripts du dossier .claude workflows, ou recreer) sur les tickers absents de data-lake/_sp5001000/etat-extraction/ ou sans champ p3. Gabarits .conv-state/sox30-template-p2.txt et p3.txt. Puis scripts/sp5001000-onboard.py et scripts/deploy-niveau1.sh (voir docs/rapports-session-2026-10/n1-sp5001000.md).\n")
print("| Ticker | P2 | Series | Hero | Verif | P3 ecrits |\n|---|---|---|---|---|---|"); print("\n".join(lignes))
PY
# 2. copies
cp -f /private/tmp/claude-501/-Users-yann/*/scratchpad/*.md docs/rapports-session-2026-10/ 2>/dev/null
git bundle create "$D/depot-depuis-14-sept.bundle" $(git rev-list -1 --before="2026-09-14 19:00" HEAD)..HEAD >/dev/null 2>&1
git diff > "$D/modifs-non-commitees.diff"; git status --short > "$D/statut.txt"
tar czf "$D/non-commites-kpis-et-etats.tgz" $(git ls-files --modified --others --exclude-standard .batches-drafts-safe/kpis-haut) data-lake/_sp5001000/*.json data-lake/_sp5001000/etat-extraction data-lake/_kpi-mt/etat.json data-lake/_ir-bloques/etat $(git ls-files --others --exclude-standard src scripts docs public 2>/dev/null) 2>/dev/null
cp $(ls -t /Users/yann/.claude/projects/-Users-yann/*.jsonl | head -2) "$D/" 2>/dev/null
tar czf "$D/memoire.tgz" -C /Users/yann/.claude/projects/-Users-yann memory
cp .env.local "$D/env.local.copie"; chmod 600 "$D/env.local.copie"
# 3. commit des rapports (jamais git add -A)
git add docs/rapports-session-2026-10 docs/REPRISE-2026-10-09.md HANDOFF.md 2>/dev/null
git commit -q -m "Sauvegarde relais ($ET) : etat de l extraction sp5001000" 2>/dev/null
echo "sauvegarde : $D ($(du -sh "$D" | cut -f1))"
