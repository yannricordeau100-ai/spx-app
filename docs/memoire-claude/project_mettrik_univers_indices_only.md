---
name: project-mettrik-univers-indices-only
description: Regle du 28 aout 2026 - l'univers en ligne Mettrik = indices seulement (666), interdiction d'ajouter par capitalisation
metadata:
  type: project
---

Depuis le 28 aout 2026, l'univers en ligne de Mettrik est ferme aux indices : S&P 500, Nasdaq 100, SOX, CAC 40, SMI, AEX, DAX. Total 666 tickers dans `src/data/v1-9-5-clean-all-tickers.json` et dans la table Supabase `desk_curated_companies`. Toute societe hors indices va dans `/sandbox/hors-indices` (208 le 29 aout).

**Why:** le 29 aout 2026, la tache planifiee `mettrik-v195-resume` (mission de mai, ajout des plus grosses capitalisations) a fait passer clean-all de 666 a 825. Yann a annule par le commit `91ee0a9eb2` et desactive la tache. La mission "publier les plus grosses cap non-online" est donc perimee.

**How to apply:** ne jamais ajouter un ticker a `v1-9-5-clean-all-tickers.json` ni publier via `scripts/publish-online.ts` sans verifier son appartenance a l'un des 7 indices. Les taches `mettrik-v195-resume` et `mettrik-rebuild-merged` sont desactivees, ne pas les reactiver. Voir [[project-mettrik-v195-blocked-tail]] et [[reference-mettrik-visibility-gate]].

- 13 sept 2026 : univers 670 (RDDT, FERG, FLEX, FDXF ajoutes, nouveaux membres du S&P 500). Veille automatique des indices : /api/cron/veille-indices (Wikipedia S&P 500, portail Nasdaq pour le Nasdaq 100), email a Yann aux entrees/sorties. Ajout d une societe = suivre .conv-state/ajout-societe-CHECKLIST.md et scripts/verif-societe.py. Sorties du S&P (AVB CAG CPB EA EPAM EQR POOL) restent en ligne. Compteur de societes : src/lib/univers.ts NB_SOCIETES, plus jamais 666 en dur.

Mise a jour 13 sept 2026 (Yann) : une societe sortie d un indice RESTE dans l univers (page + toutes les listes). La veille des indices signale, elle ne retire jamais. AVB et EQR, retirees le 28 aout, ont ete restaurees. Interdiction d ajouter par capitalisation : inchangee.
