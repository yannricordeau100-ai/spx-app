# RAPPELS PROGRAMMÉS — CONV-SYSTEMS

> Liste des rappels que Claude doit faire revenir à Yann à date fixe.
> En backup des CronCreate session-only (au cas où la conv Claude meurt).
> Tout rappel ici doit être checké manuellement par Yann ou par moi si je le vois.

---

## 📅 18 mai 2026 05h40 — Wakeup session autonome MAC-PROTECTION-FIRST

**Programmé le** : 17 mai 2026 22h, MAJ 17 mai 23h (priorité absolue : pas crasher Mac)  
**CronCreate id** : `474f204e` (session-only, lundi 18 mai 05h40)  
**Statut** : en attente

**Contexte** : Yann probablement endormi, ordinateur laissé open. Possiblement d'autres convs encore actives (terminant tâches nuit). PRIORITÉ ABSOLUE : pas crasher Mac (crash hard reset nuit précédente).

**Protocole démarrage progressif** :
- Démarrer LENTEMENT, vérifier RAM AVANT toute action
- Attendre que les autres convs terminent si saturation
- Augmenter graduellement quand RAM remonte
- Re-check RAM chaque minute

**Règles RAM (free + inactive recoverable)** :
- < 1.5 GB : ⏸ ATTENDRE 5 min, re-checker. Rien ne lance.
- 1.5-3 GB : ⚡ Lent — pas d'agent, edits + commits perso. Sleep 5s.
- 3-5 GB : ⚙️ Normal — max 1 agent. Sleep 3s.
- > 5 GB : 🚀 Plein régime — max 2 agents en //. Sleep 1-2s.

**Objectifs priorisés (selon RAM dispo)** :
1. Confirmer SQL desk_releases collé (table existe + seed dev v0.1.0)
2. Écrire release dev v0.1.1 avec git_sha = b03645d0
3. Phase 2 go-prod (si RAM > 3GB) : endpoint promote + bouton Push to live + snapshot tagging
4. Reviewer 27 image-findings demande #1 pending
5. Test endpoints /api/version sur 3 niveaux staging
6. Nettoyage /tmp > 60 min si tout OK

**Bilan attendu** : au réveil Yann, format DOB ✅FAIT / ❌PAS FAIT / ⚠️PROBLÈMES / 🔧POUR RÉPARER.

---

## 📅 (REPORTÉ) Séparation DB Supabase par niveau

**Programmé initial le 16 mai pour 19 mai 14h23** : annulé le 17 mai à la demande de Yann (priorité au wakeup 18 mai).

**À reprogrammer** : à voir avec Yann selon état stabilisation site live (probablement vers fin mai 2026 si tout va bien).

**Action attendue** : créer 2 nouvelles instances Supabase (`mettrik-prod` + `mettrik-pre`) + migration sélective des tables (users, plans, etc.) + isolation production complète.

---
