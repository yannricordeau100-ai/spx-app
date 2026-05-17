# RAPPELS PROGRAMMÉS — CONV-SYSTEMS

> Liste des rappels que Claude doit faire revenir à Yann à date fixe.
> En backup des CronCreate session-only (au cas où la conv Claude meurt).
> Tout rappel ici doit être checké manuellement par Yann ou par moi si je le vois.

---

## 📅 18 mai 2026 05h40 — Wakeup session autonome auto-régulée RAM

**Programmé le** : 17 mai 2026 22h (annule l'ancien rappel 19 mai 14h23)  
**CronCreate id** : `97d43e23` (session-only, lundi 18 mai 05h40)  
**Statut** : en attente

**Contexte** : Yann probablement endormi, ordinateur laissé open. Mission travail nuit : continuer ce qui est utile sur les sujets connus (Phase 2 go-prod si Phase 1 confirmée OK, ou autre tâche en attente). Auto-régulation RAM chaque minute obligatoire (cf prompt complet du cron).

**Règles RAM** :
- > 5 GB dispo : 3 agents max en parallèle
- 3-5 GB : 2 agents max
- 1.5-3 GB : 1 agent max
- < 1.5 GB : STOP, attendre 2 min, re-checker

**Objectifs priorisés (selon RAM dispo)** :
1. Vérifier SQL desk_releases collé par Yann + écrire release dev v0.1.1
2. Phase 2 go-prod si Yann a validé Phase 1 (CI/CD + bouton Push to live + snapshot tagging)
3. Reviewer les 27 image-findings demande #1 pending
4. Nettoyage cache RAM si besoin

**Bilan attendu** : au réveil de Yann, format DOB : ✅FAIT / ❌PAS FAIT / ⚠️PROBLÈMES / 🔧POUR RÉPARER.

---

## 📅 (REPORTÉ) Séparation DB Supabase par niveau

**Programmé initial le 16 mai pour 19 mai 14h23** : annulé le 17 mai à la demande de Yann (priorité au wakeup 18 mai).

**À reprogrammer** : à voir avec Yann selon état stabilisation site live (probablement vers fin mai 2026 si tout va bien).

**Action attendue** : créer 2 nouvelles instances Supabase (`mettrik-prod` + `mettrik-pre`) + migration sélective des tables (users, plans, etc.) + isolation production complète.

---
