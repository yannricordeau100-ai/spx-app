#!/usr/bin/env bash
# auto_kpi_pipeline.sh — Pipeline autonome KPI hors contexte Claude
# Usage: nohup bash scripts/datalake/auto_kpi_pipeline.sh > /tmp/auto_kpi.log 2>&1 &
set -e
cd ~/spx-app

LOG=/tmp/auto_kpi.log
RESULT=/tmp/monitor_result.json

echo "[$(date)] === AUTO KPI PIPELINE DÉMARRÉ ===" | tee -a "$LOG"

# 1. Vérifier que main() est correct (appelle yfinance_kpis, pas yfinance_revenue)
if grep -q "yfinance_revenue" scripts/datalake/extract_kpis_batch.py; then
    echo "[$(date)] ERREUR: extract_kpis_batch.py utilise encore yfinance_revenue. Arrêt." | tee -a "$LOG"
    exit 1
fi
echo "[$(date)] Fix extract_kpis_batch.py confirmé (yfinance_kpis OK)" | tee -a "$LOG"

# 2. Supprimer les extracted.json mono-KPI des tickers orange/rouge kpi_normaux
# Un extracted.json mono-KPI = fichier avec 1 seul KPI au lieu de 3-4
echo "[$(date)] Suppression extracted.json avec <=1 KPI (re-extraction multi-KPI)..." | tee -a "$LOG"
python3 - <<'PYEOF' 2>&1 | tee -a "$LOG"
import json, pathlib, sqlite3

DATALAKE = pathlib.Path('/Users/yann/spx-app/data-lake')
DB = pathlib.Path('/Users/yann/spx-app/data-lake/mettrik.db')

# Tickers orange/rouge kpi_normaux = ceux avec < 3 metric_keys distincts dans facts
deleted = 0
kept = 0

if DB.exists():
    conn = sqlite3.connect(DB)
    rows = conn.execute("""
        SELECT ticker, COUNT(DISTINCT metric_key) as cnt
        FROM facts
        WHERE bloc = 'kpi_normaux'
        GROUP BY ticker
        HAVING cnt < 3
    """).fetchall()
    conn.close()
    rouge_orange = {r[0] for r in rows}
    print(f"  {len(rouge_orange)} tickers avec < 3 KPIs distincts dans DB")
else:
    rouge_orange = set()
    print("  DB non trouvée, suppression basée sur extracted.json directement")

# Supprimer extracted.json avec <= 1 KPI
for f in DATALAKE.glob("*/kpis/extracted.json"):
    ticker = f.parent.parent.name
    try:
        data = json.loads(f.read_text())
        n_kpis = len(data.get("kpis", []))
        if n_kpis <= 1 or ticker in rouge_orange:
            f.unlink()
            deleted += 1
        else:
            kept += 1
    except Exception:
        f.unlink()
        deleted += 1

print(f"  Supprimés: {deleted}, Conservés: {kept}")
PYEOF

# 3. Préparer la liste des tickers à extraire (rouge kpi_normaux)
echo "[$(date)] Préparation liste tickers à extraire..." | tee -a "$LOG"
python3 - <<'PYEOF' 2>&1 | tee -a "$LOG"
import json, sqlite3, pathlib

DB = pathlib.Path('/Users/yann/spx-app/data-lake/mettrik.db')
DATALAKE = pathlib.Path('/Users/yann/spx-app/data-lake')
OUT = '/tmp/kpi_rouge_tickers.json'

if DB.exists():
    conn = sqlite3.connect(DB)
    # Tickers avec < 3 metric_keys distincts
    rows = conn.execute("""
        SELECT ticker FROM facts
        WHERE bloc = 'kpi_normaux'
        GROUP BY ticker
        HAVING COUNT(DISTINCT metric_key) < 3
    """).fetchall()
    conn.close()
    tickers = [r[0] for r in rows]
    # Aussi ajouter tickers sans aucune entrée dans facts (jamais extraits)
    all_in_db = set(sqlite3.connect(DB).execute("SELECT DISTINCT ticker FROM facts").fetchall())
    # tickers_without_extracted = tickers sans extracted.json
    for d in DATALAKE.iterdir():
        if d.is_dir() and not (d / 'kpis' / 'extracted.json').exists():
            t = d.name
            if t not in tickers and t != 'mettrik.db':
                tickers.append(t)
else:
    # Fallback: tous les tickers sans extracted.json
    tickers = []
    for d in DATALAKE.iterdir():
        if d.is_dir() and not (d / 'kpis' / 'extracted.json').exists():
            t = d.name
            if t != 'mettrik.db':
                tickers.append(t)

with open(OUT, 'w') as f:
    json.dump(tickers, f)
print(f"  {len(tickers)} tickers à extraire → {OUT}")
PYEOF

# 4. Lancer l'extraction KPI
TICKER_COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/kpi_rouge_tickers.json'))))" 2>/dev/null || echo "0")
echo "[$(date)] Extraction KPI pour $TICKER_COUNT tickers..." | tee -a "$LOG"

if [ "$TICKER_COUNT" -gt 0 ]; then
    python3 scripts/datalake/extract_kpis_batch.py 2>&1 | tee -a "$LOG"
    echo "[$(date)] Extraction KPI terminée" | tee -a "$LOG"
else
    echo "[$(date)] Aucun ticker à extraire" | tee -a "$LOG"
fi

# 5. Boucle monitor jusqu'à stop condition
MAX_CYCLES=20
cycle=0
while [ $cycle -lt $MAX_CYCLES ]; do
    cycle=$((cycle + 1))
    echo "[$(date)] === CYCLE MONITOR $cycle ===" | tee -a "$LOG"

    bash scripts/monitor_cycle.sh 2>&1 | tee -a "$LOG"

    # Lire résultat
    STOP=$(python3 -c "import json; r=json.load(open('/tmp/monitor_result.json')); print(r.get('stop', False))" 2>/dev/null || echo "False")

    if [ "$STOP" = "True" ]; then
        echo "[$(date)] STOP CONDITION ATTEINTE — kpi_normaux>=470 ET gouvernance>=470" | tee -a "$LOG"
        python3 -c "
import json
r = json.load(open('/tmp/monitor_result.json'))
c = r['counts']
print(f\"financier vert={c['financier']['vert']}/rouge={c['financier']['rouge']}\")
print(f\"kpi_normaux vert={c['kpi_normaux']['vert']}/rouge={c['kpi_normaux']['rouge']}\")
print(f\"story vert={c['story']['vert']}/rouge={c['story']['rouge']}\")
print(f\"gouvernance vert={c['gouvernance']['vert']}/rouge={c['gouvernance']['rouge']}\")
print('TERMINÉ')
" | tee -a "$LOG"
        exit 0
    fi

    # Re-lancer extraction si kpi_normaux pas encore vert
    KPI_VERT=$(python3 -c "import json; r=json.load(open('/tmp/monitor_result.json')); print(r['counts']['kpi_normaux']['vert'])" 2>/dev/null || echo "0")
    echo "[$(date)] kpi_normaux vert=$KPI_VERT" | tee -a "$LOG"

    if [ "$KPI_VERT" -lt 470 ]; then
        echo "[$(date)] kpi_normaux < 470, re-extraction..." | tee -a "$LOG"
        # Régénérer liste tickers à extraire
        python3 - <<'PYEOF' 2>&1 | tee -a "$LOG"
import json, sqlite3, pathlib

DB = pathlib.Path('/Users/yann/spx-app/data-lake/mettrik.db')
DATALAKE = pathlib.Path('/Users/yann/spx-app/data-lake')
OUT = '/tmp/kpi_rouge_tickers.json'

if DB.exists():
    conn = sqlite3.connect(DB)
    rows = conn.execute("""
        SELECT ticker FROM facts
        WHERE bloc = 'kpi_normaux'
        GROUP BY ticker
        HAVING COUNT(DISTINCT metric_key) < 3
    """).fetchall()
    conn.close()
    tickers = [r[0] for r in rows]
else:
    tickers = []
    for d in DATALAKE.iterdir():
        if d.is_dir() and not (d / 'kpis' / 'extracted.json').exists():
            tickers.append(d.name)

with open(OUT, 'w') as f:
    json.dump(tickers, f)
print(f"  {len(tickers)} tickers à re-extraire")
PYEOF

        NEW_COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/kpi_rouge_tickers.json'))))" 2>/dev/null || echo "0")
        if [ "$NEW_COUNT" -gt 0 ]; then
            python3 scripts/datalake/extract_kpis_batch.py 2>&1 | tee -a "$LOG"
        fi
    fi

    echo "[$(date)] Attente 1500s avant prochain cycle..." | tee -a "$LOG"
    sleep 1500
done

echo "[$(date)] MAX_CYCLES atteint sans STOP condition" | tee -a "$LOG"
