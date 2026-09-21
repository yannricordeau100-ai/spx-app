---
name: project-mettrik-cron-autonome
description: "Cron quarterly-refresh Mettrik = autonome depuis le 16 juil 2026 (4 verrous + auto-publication des stés 3-verrous-verts, GO Yann)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 10cedc9f-5671-44ba-bad4-816404d68570
---

Depuis le 16 juillet 2026 (GO explicite Yann), le cron `com.mettrik.quarterly-refresh` (launchd, 7h30) est autonome de bout en bout POUR LES CHIFFRES : détection SEC → téléchargement → extraction XBRL → 4 verrous → publication auto (commit+push+deploy+alias+verify) des seules stés PUBLIABLES.

**Les 4 verrous** (scripts/qr-lock1-dual-check.py, qr-lock2-completeness.py, audit-pages-full.ts, qr-lock4-history.py) : double extraction indépendante (companyfacts vs document, écart >0,5 % = bloquant), complétude 100 % des KPI + todo LLM vide, audit rendu, historique dans `src/data/_quarterly-refresh-history.json` affiché sur /sandbox/refresh-status.

**Ce qui reste MANUEL** : les blocs texte (todo `.conv-state/quarterly-refresh-todo-llm.json`) sont traités par Claude en conversation ; tant qu'ils sont en attente, la sté est BLOQUÉE et non publiée. Publication = scripts/qr-publish.py (git add ciblé, jamais de -A).

**Why :** le périmètre du GO est strict : uniquement les stés 3-verrous-verts du run quotidien ; la règle §0nonies (validation Yann avant push data) reste valable pour tout AUTRE flux d'écriture data.

**How to apply :** ne pas re-demander de validation pour les publications du cron ; pour débloquer des stés, traiter la todo LLM puis relancer lock2/lock4/publish. Lié : [[project-mettrik]].

MAJ 9 août 2026 : `scripts/daily-doc-watcher.sh` (cron 4h00) exécute désormais `scripts/kpi-lag-detect.py` (fiscal-correct, double convention FY) après le téléchargement des filings. Si retard KPI détecté → `.conv-state/kpi-lag-alert.json` (à lire au réveil et dans le sum-up horaire) ; fichier absent = 0 retard. C'est le maillon qui manquait quand 245 stés US ont accumulé du retard en silence (rattrapées 8-9 août).
