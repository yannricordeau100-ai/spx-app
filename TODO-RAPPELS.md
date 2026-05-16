# RAPPELS PROGRAMMÉS — CONV-SYSTEMS

> Liste des rappels que Claude doit faire revenir à Yann à date fixe.
> En backup des CronCreate session-only (au cas où la conv Claude meurt).
> Tout rappel ici doit être checké manuellement par Yann ou par moi si je le vois.

---

## 📅 19 mai 2026 — Séparation DB Supabase par niveau

**Programmé le** : 16 mai 2026  
**CronCreate id** : `3645b6ca` (session-only, à 14h23 le 19 mai)  
**Statut** : en attente

**Contexte** : architecture 3 niveaux (Live www.mettrik.ai / Pré-live pre.mettrik.ai / Dev staging.mettrik.ai) mise en place le 16 mai avec 1 SEULE DB Supabase partagée au début pour vélocité. Yann a dit : "fait au mieux, si la vraie architecture doit être faite/modifier plus tard moi je n'y penserai pas, peux-tu mettre un rappel ?"

**Action attendue le 19 mai** :
- Vérifier si le site live a été lancé et stabilisé
- Si oui : proposer de créer 2 nouvelles instances Supabase (`mettrik-prod` et `mettrik-pre`) + migration sélective des tables (users, plans, etc.) + isolation production complète
- Si non encore lancé : reporter le rappel à 3-4 jours plus tard

---
