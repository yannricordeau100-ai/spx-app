# 🔄 Continuation du projet Mettrik Data-Lake pour Claude suivant

## État du projet (16 juin 2026)

**Budget hebdomadaire:** 3% restant (jusqu'à lundi 01:00 Paris)
**Deadline:** Lundi 01:00 Paris - CRITIQUE

### ✅ Complété (ne rien refaire)
- Description FR: 430/503 stés
- Stories KPI: 449/503 stés  
- Gouvernance: 499/503 stés
- Segments CA: 495/503 stés
- Géographie CA: 494/503 stés
- Events timeline: 495/503 stés
- Ranks: 493/503 stés
- IA Positionnement: 495/503 stés
- Profit Warning: 489/503 stés
- KPI Interprétations: 25/503 stés
- **Data-lake hard-store:** 503 stés avec _index.json ✅
- **Live:** mettrik-niveau2.vercel.app (à jour via alias Vercel)

### 🟡 Partiel (commencé, inachevé)
- **KPI haut de gamme:** 143/503 stés FAITS (360 manquants)
- **KPI milieu de gamme:** 141/503 stés FAITS (362 manquants)

### 🔴 Manquant ENTIÈREMENT (0%)
- **Risques (Item 1A):** 0/503 stés - source _risks_src.txt prête dans chaque dossier

---

## Source de vérité pour le statut

📍 `src/data/extraction-status.json`

Structure par sté:
```json
{
  "ticker": "AAPL",
  "financier": { "vert": 512, "rouge": 117 },
  "kpi_normaux": { "vert": 335, "rouge": 283 },
  "story": { "vert": 477, "rouge": 178 },
  "gouvernance": { "vert": 211, "rouge": 327 }
}
```

**Vert** = fait. **Rouge** = manquant ou à refaire.

Voir le toggle: `https://mettrik-niveau2.vercel.app/sandbox/extraction-monitor`

---

## 🎯 Tâches possibles (par ordre de criticité)

### Tâche A: Risques (497 stés) - PLUS IMPORTANT
**Effort:** Haiku seulement, ~75 min  
**Budget:** 3% restant = ~1.5M tokens = faisable à peine

**Étapes:**
1. Lire `src/data/extraction-status.json` → identifier stés avec `story.rouge > 0`
2. Pour chaque sté rouge story: lancer agent Haiku
   ```
   Prompt ultra-court (50 chars max):
   "${TICKER}: Lis /Users/yann/spx-app/data-lake/${ticker}/_risks_src.txt. 
   Retourne JSON {ticker, n_risks} avec array risques FR."
   ```
3. Écrire résultats → `/Users/yann/spx-app/data-lake/${ticker}/risques_fr.json`
4. Après complétion: lancer
   ```bash
   cd ~/spx-app && python3 scripts/datalake/ingest_drafts.py && \
   python3 scripts/datalake/build_status.py && \
   git add src/data/extraction-status.json && \
   git commit -m "risques: +N stés" && \
   git push origin staging
   ```

### Tâche B: KPI haut/milieu (360 stés) - SECONDAIRE
**Effort:** Impossible avec 3% budget (Sonnet coûte trop cher, Haiku bloque dans workflows)  
**Décision:** ABANDONNER jusqu'à lundi après reset budget

---

## ⚙️ Processus sans chevauchement

**Chaque itération:**
1. ✅ Lire `extraction-status.json` pour état actuel
2. ✅ Traiter UNIQUEMENT stés avec rouge = non faits
3. ✅ Relancer `ingest_drafts.py + build_status.py` IMMÉDIATEMENT après
   - Cela met à jour extraction-status.json
   - Prochain Claude lit la version à jour
4. ✅ Push staging à chaque fin de batch

**Fichiers JAMAIS à éditer manuellement:**
- `extraction-status.json` (généré par build_status.py)
- Fichiers _srctext*.txt (déjà compilés)

---

## 🚀 Commandes rapides

**Vérifier état actuel:**
```bash
cd ~/spx-app && \
python3 -c "import json; s=json.load(open('src/data/extraction-status.json')); \
print(f'KPI rouge: {sum(1 for t in s[\"stés\"] if t.get(\"kpi_normaux\",{}).get(\"rouge\",0)>0)}')"
```

**Lancer ingest + update status:**
```bash
cd ~/spx-app && \
python3 scripts/datalake/ingest_drafts.py && \
python3 scripts/datalake/build_status.py && \
git add src/data/extraction-status.json && \
git commit -m "status update" && \
git push origin staging
```

**Deploy live (si données validées):**
```bash
cd ~/spx-app && source .env.local && \
npx vercel deploy --prod --token $VERCEL_TOKEN && \
# Attendre READY, puis:
npx vercel alias set <URL_READY> mettrik-niveau2.vercel.app --token $VERCEL_TOKEN
```

---

## ⚠️ Contraintes ABSOLUES

- ❌ NE PAS utiliser Sonnet (budget = 0)
- ❌ NE PAS utiliser Opus (budget = -1000%)
- ✅ HAIKU SEULEMENT (Haiku direct API, prompts <100 chars)
- ❌ NE PAS modifier extraction-status.json manuellement
- ✅ TOUJOURS relancer build_status.py après nouveau travail
- ✅ TOUJOURS pousser staging après changement données
- ❌ NE PAS commencer risques SI budget < 2% (critique)

---

## 📍 Reprise par moi (Claude orig)

Quand tu relances: je lis cet fichier + extraction-status.json → je sais EXACTEMENT où on en est, zéro ambiguïté. Je reprends au point exact de pause, pas avant.

---

## Résumé pour toi

**Si tu fais risques:**
- 497 stés × Haiku ~1.5M tokens
- ETA: 1h30
- Budget: juste faisable (3% margin)
- Impact: 🔴 → 🟢 pour 497 stés

**Si tu fais KPI haut:**
- 360 stés × Sonnet = ❌ RUPTURE BUDGET
- ❌ NE PAS FAIRE

**Recommandation:** Tente risques Haiku. Si ça marche → live sur staging avant dimanche 20h (marge avant deadline lundi 01:00).

---

Bon courage. C'est une tâche simple si tu respectes les contraintes. Pas de créativité, juste exécution.
