#!/bin/bash
# cron-cerebras-restart.sh
# Auto-relance les missions Cerebras quand quotas free tier reset (minuit UTC = 02h Paris)
# Schedule via launchd : ~/Library/LaunchAgents/com.mettrik.cerebras-restart.plist (00:05 UTC daily)
#
# Idempotent : si une mission echoue, log et continue. Pas de LLM dans le cron lui-meme.
# Sequentiel pour proteger RAM Mac (pas de parallele).

set +e  # ne PAS exit on error - on veut continuer meme si une mission KO

# === CONFIG ===
SPX_APP="/Users/yann/spx-app"
LOG_DIR="$SPX_APP/logs/cron-cerebras-restart"
HISTORY_FILE="$SPX_APP/src/data/v1-9-cron-history.json"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="$LOG_DIR/${TIMESTAMP}.log"
MIN_FREE_RAM_MB=200

mkdir -p "$LOG_DIR"

# Charger env vars (CEREBRAS_API_KEY etc.)
if [ -f "$SPX_APP/.env.local" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$SPX_APP/.env.local"
    set +a
fi

cd "$SPX_APP" || { echo "[FATAL] cd $SPX_APP failed" | tee -a "$LOG_FILE"; exit 1; }

log() {
    local msg="[$(date -u +%H:%M:%SZ)] $*"
    echo "$msg" | tee -a "$LOG_FILE"
}

# === Helpers ===

check_ram() {
    # Renvoie 0 si free RAM >= MIN_FREE_RAM_MB, 1 sinon
    local free_mb
    free_mb=$(vm_stat | awk '
        /page size of/ { ps = $8 }
        /Pages free/ { free = $3 }
        /Pages inactive/ { inactive = $3 }
        END {
            ps = ps + 0; free = free + 0; inactive = inactive + 0
            if (ps == 0) ps = 16384
            printf "%d", ((free + inactive) * ps) / 1024 / 1024
        }
    ')
    log "Free RAM: ${free_mb} MB (seuil ${MIN_FREE_RAM_MB} MB)"
    if [ "${free_mb:-0}" -lt "$MIN_FREE_RAM_MB" ]; then
        return 1
    fi
    return 0
}

check_cerebras_saturated() {
    # Test 1 call rapide pour detecter saturation. Renvoie 0 si OK, 1 si sature.
    if [ -z "${CEREBRAS_API_KEY:-}" ]; then
        log "WARN CEREBRAS_API_KEY non defini, skip detection saturation"
        return 0
    fi
    local http_code
    http_code=$(curl -s -o /tmp/cerebras_probe.json -w "%{http_code}" \
        --max-time 15 \
        -X POST "https://api.cerebras.ai/v1/chat/completions" \
        -H "Authorization: Bearer $CEREBRAS_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"model":"llama3.1-8b","max_tokens":5,"messages":[{"role":"user","content":"ping"}]}' 2>/dev/null)
    log "Cerebras probe HTTP $http_code"
    if [ "$http_code" = "429" ] || [ "$http_code" = "529" ]; then
        return 1
    fi
    return 0
}

append_history() {
    local mission="$1" status="$2" duration="$3"
    local entry
    entry=$(printf '{"ts":"%s","mission":"%s","status":"%s","duration_sec":%s,"log":"%s"}' \
        "$TIMESTAMP" "$mission" "$status" "${duration:-0}" "$LOG_FILE")
    # Append-style : on garde un JSON array, on cree le fichier si absent
    if [ ! -f "$HISTORY_FILE" ]; then
        echo "[]" > "$HISTORY_FILE"
    fi
    /usr/bin/python3 - "$HISTORY_FILE" "$entry" <<'PYEOF'
import json, sys
path, entry_json = sys.argv[1], sys.argv[2]
try:
    with open(path) as f:
        data = json.load(f)
    if not isinstance(data, list):
        data = []
except Exception:
    data = []
data.append(json.loads(entry_json))
with open(path, "w") as f:
    json.dump(data, f, indent=2)
PYEOF
}

run_mission() {
    local label="$1"; shift
    local script_args=("$@")
    log "=== MISSION START: $label ==="
    if ! check_ram; then
        log "SKIP $label (RAM insuffisante)"
        append_history "$label" "skipped_ram" 0
        return 0
    fi
    local start_ts=$(date +%s)
    "${script_args[@]}" >> "$LOG_FILE" 2>&1
    local rc=$?
    local end_ts=$(date +%s)
    local dur=$((end_ts - start_ts))
    if [ $rc -eq 0 ]; then
        log "OK  $label en ${dur}s"
        append_history "$label" "ok" "$dur"
    else
        log "KO  $label rc=$rc en ${dur}s (continue malgre tout)"
        append_history "$label" "failed_rc${rc}" "$dur"
    fi
    return 0
}

# === MAIN ===

log "===== CRON CEREBRAS RESTART start ====="
log "Run ID: $TIMESTAMP"

# Verifier saturation avant tout : si toujours sature, skip cette nuit
if ! check_cerebras_saturated; then
    log "Cerebras encore sature (HTTP 429/529). SKIP cette nuit, retry demain."
    append_history "probe" "saturated_skip_night" 0
    exit 0
fi

log "Cerebras OK -> lancement des 6 missions sequentielles"

# a) 309 stes d_stories KO
run_mission "scaleup_309_dstories_ko" \
    /usr/bin/python3 "$SPX_APP/scripts/stories-backfill/scaleup_309_dstories_ko.py" --shard 0 --total-shards 1

# b) 532 reste stories
run_mission "scaleup_532_stories" \
    /usr/bin/python3 "$SPX_APP/scripts/stories-backfill/scaleup_532_stories.py"

# c) 48 P0 Cerebras
run_mission "extract_p0_cerebras" \
    /usr/bin/python3 "$SPX_APP/scripts/conv-concepts-1-9-kpis/extract-p0-cerebras.py"

# d) AI positioning
run_mission "ai_pos_mission_runner" \
    /usr/bin/python3 "$SPX_APP/scripts/ai-pos-mission-runner.py"

# e) 83 EU governance
run_mission "enrich_top_voting_capital_passB" \
    /usr/bin/python3 "$SPX_APP/scripts/enrich-top-voting-capital.py" --pass-b

# f) 390 weak rationale
run_mission "enrich_risks_rationale_cerebras" \
    /usr/bin/python3 "$SPX_APP/scripts/enrich-risks-rationale-cerebras.py"

log "===== CRON CEREBRAS RESTART end ====="
exit 0
