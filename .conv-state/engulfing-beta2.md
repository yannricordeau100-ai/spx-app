# Conversation : Engulfing / Beta>2 universe

Dernière mise à jour : 2026-05-12

## 🎯 Périmètre de cette conversation

Tout ce qui concerne :
- L'univers d'actions Beta>2 (screener Finviz)
- Le détecteur Bearish Engulfing (BBE) strict
- Les onglets BBE dans `app_local.py` et `bbe_ranking_app.py` standalone
- Le scanner live IBKR + notifications Telegram/email à 22:00 et 01:30 Paris
- Tous les fichiers dans `~/spx-quant-engine/beta2_engulfing/`
- Les CSV tickers dans `~/spx-quant-engine/data/live_selected/tickers/`

**Hors périmètre** (autre conv "SPX Quant Engine") :
- Moteur SPX pur (`patterns_v2.py`, `cross_feature_library.py`, `spx_pattern_search.py`)
- Onglets RIC/IC/Grille/Options/Validation 2025/Signal aujourd'hui
- `query_executor.py`, `feature_engineering.py`, `app_cloud.py`

## 📁 Fichiers principaux

### Code (`~/spx-quant-engine/beta2_engulfing/`)
- `beta_screen.py` — screener Finviz Beta>2 + MCap>1B
- `refresh_tickers_from_ibkr.py` — pull OHLCV via IBKR (useRTH=False = ETH)
- `precompute_bbe_signals.py` — calcule bbe_signals.csv (signaux + perf J+1..J+5)
- `bbe_ranking_tab.py` — composant Streamlit du classement interactif
- `bbe_ranking_app.py` — app Streamlit standalone (utilise bbe_ranking_tab)
- `conditions_custom_tab.py` — onglet "Conditions custom" (J0 × J+1 ranges)
- `weekly_history_tab.py` — onglet "Historique BBE — cette semaine" (détection LIVE depuis CSV)
- `bbe_live_scanner.py` — scanner live IBKR cron 22:00 + 01:30
- `notifiers.py` — Telegram + Resend email
- `sanity_check.py` — vérif cohérence entre 2 onglets (à lancer après refresh)

### Data
- `beta_gt2_midlarge.csv` — univers screener (169 tickers actuellement, 245 si extension)
- `beta_gt2_extended.csv` — extension 245 tickers (97 nouveaux non encore intégrés)
- `bbe_signals.csv` — signaux pré-calculés
- `bbe_meta.csv` — metadata (Company, Sector, MCap_USD)
- `bbe_today_*.csv` — exports scans ponctuels

### Clés (gitignored)
- `.telegram_token`, `.telegram_chat_id`
- `.resend_api_key`, `.resend_to_email`
- `.last_successful_scan` (idempotence)

### Scheduler
- `~/Library/LaunchAgents/com.yann.bbe-scanner.plist`
  - StartCalendarInterval array : 22:00 + 01:30 Paris
  - PY=/usr/local/bin/python3 + PYTHONUSERBASE=/Users/yann/Library/Python/3.12
  - Chain : `bbe_live_scanner.py ; refresh_tickers_from_ibkr.py ; precompute_bbe_signals.py`

### Modifications dans app_local.py (3 expanders ajoutés ligne ~5232+)
- 📉 BBE Ranking — Univers Beta>2 (164 tickers)
- 🎯 Conditions custom — variation J0 × J+1 (par ticker)
- 📅 Historique BBE — cette semaine (45 tickers gardés)

Plus : sliders locaux Seuil bearish/bullish dans onglet "🕯️ BBE — Analyse multi-ticker" (bypass sidebar buggée).

## 📐 Règles BBE strict (état actuel — REGLE FINALE)

Pour J-1 = bougie verte / J0 = bougie rouge :
1. J-1 verte (close > open) ET J0 rouge (close < open)
2. **Engulfement HAUT** : open J0 ≥ close J-1 + **0.01** (margin minimum, pas tolérance % !)
3. **Engulfement BAS** : close J0 ≤ open J-1 − **0.01**
4. Body J0 > 1.1 × Body J-1 (substantiel)
5. Volume J0 ≥ Volume J-1 (confirmation acheteurs absents)
6. Pas dans fenêtre ±5 jours d'un earnings

Symétrique bullish.

Source data : **IBKR ETH (useRTH=False)** — choisi empiriquement (+15% signaux, +2.5pts WR J+1 vs RTH).

## 🛠️ Pipeline quotidien automatique (launchd 22:00 + 01:30)

1. `bbe_live_scanner.py` (~2 min)
   - Filtre dynamique : tickers WR J+1 lowmin -2% ≥ 70% ET n ≥ 8 (≈ 45-57 tickers)
   - Si Gateway down → retry 5 min × 3h
   - Notif "🔌 Connecte Gateway" après 1 min de retry (1 fois)
   - Notif résultat BBE Telegram + email
2. `refresh_tickers_from_ibkr.py` (~5 min)
   - 169 CSV refresh ETH 5Y
3. `precompute_bbe_signals.py` (~30 sec)
   - Régénère bbe_signals.csv

## ✅ Travail accompli (chronologique)

1. Screener Finviz Beta>2 / MCap 1-100B → 164 tickers
2. Pipeline OHLCV via yfinance puis bascule vers IBKR ETH (cohérence IBKR mobile)
3. Génération CSV format `time;open;high;low;close;Volume` dans data/live_selected/tickers/
4. Précompute bbe_signals.csv avec J+1..J+5 returns
5. Onglet BBE Ranking interactif (slider seuil, horizon, base lowmin/close)
6. Intégration dans app_local.py (3 expanders, modif minimale)
7. Notifs Telegram + Email Resend opérationnels
8. Scanner live + launchd 22:00 + 01:30
9. Filtre WR≥70% / n≥8 sur scanner (54 tickers)
10. Règle stricte engulfement margin 0.01 appliquée partout
11. SPX context (J-1, J0, J+1) sur cards d'échec dans onglet BBE Multi-ticker
12. Onglet Conditions custom (J0 × J+1 ranges)
13. Onglet Historique BBE semaine (détection LIVE, colonne "Gardé")
14. Sanity check 169 tickers × 5 seuils (TOUT cohérent)
15. Settings Claude bypassPermissions + deny destructifs

## ⏳ En attente / TODO

### Priorité haute
- **Intégrer 97 nouveaux tickers** (extension MCap>300M, total 245) — attente confirmation user
- **Onglet "📅 Historique BBE — cette semaine"** : actuellement filtre 45 gardés mais peut afficher tout l'univers (déjà modifié)

### Backlog non urgent
- Désactiver "Read-Only API" dans Gateway quand on passera à l'auto-trading (V2)
- Activer Paper Trading account séparé (user pas pressé)
- Considérer Finnhub si Gateway trop instable (signup 30 sec)
- Watchlist IBKR créée (CSV `ibkr_watchlist_TWS.csv` dans Downloads, jamais importée car TWS UI pas user-friendly)

## 🚨 Risques / limitations connus

1. **Gateway doit rester ouvert** — si user utilise mobile pendant journée, Gateway kicked → scan échoue
2. **Auto-restart Gateway** : 21:55 Paris (configuré côté user). À 01:30 dépend de si Gateway tient depuis 21:55
3. **Données ETH partielles à 22:00** : open du jour peut être pollué par spike pre-market (rare, AMPX un cas vu)
4. **Scanner stoppe après 3h** de retry IBKR (pour ne pas overlap avec scan suivant)

## 🔧 Commandes utiles

```bash
# Vérifier launchd
launchctl list | grep bbe-scanner

# Forcer scan manuel
cd ~/spx-quant-engine/beta2_engulfing && python3 bbe_live_scanner.py --force

# Refresh manuel
python3 refresh_tickers_from_ibkr.py && python3 precompute_bbe_signals.py

# Test connexion Gateway
python3 -c "from ib_insync import IB; ib=IB(); ib.connect('127.0.0.1',4001,clientId=1,timeout=5); print(ib.managedAccounts()); ib.disconnect()"

# Voir logs
tail -50 ~/spx-quant-engine/beta2_engulfing/alerts.log

# Restart Streamlit (port 8503)
pkill -9 -f "streamlit run app_local"
cd ~/spx-quant-engine && python3 -m streamlit run app_local.py --server.port 8503 --server.headless true
```

## 🤝 Coordination avec autre conv (SPX Quant Engine)

**Zones partagées à protéger** :
- `app_local.py` — annoncer toute modif (cette conv a 3 expanders + sliders BBE)
- `query_executor.py` — pas modifié par cette conv (BBE inline-strict utilise ses propres règles)

**Zones exclusives cette conv** :
- `ticker_analysis.py` (detect_engulfing_strict, BBE handler)
- `data/live_selected/tickers/*.csv` (164+ tickers)
- `beta2_engulfing/` (tout)

Avant tout commit qui touche app_local.py : vérifier `git diff` pour ne pas écraser le travail de l'autre conv.
