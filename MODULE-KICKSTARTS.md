# Kickstarts pour les conversations modules

Chaque kickstart est un texte court à coller dans le 1ᵉʳ message d'une
nouvelle conversation Claude Code (bouton "+ nouvelle conversation").

`CLAUDE.md`, `RULES-GOLDEN.md`, `SHARED-STATUS.md`, `AGENTS.md`,
`HANDOFF.md` sont auto-chargés. Le kickstart ne sert qu'à délimiter le
scope de la conv.

---

## CONV-MODULE-RANKS-V2

```
Tu es CONV-MODULE-RANKS-V2. Ton scope unique = corriger les ranks (#mondial,
#US, sector, subsector) sur les 617 stés Pass 3 strict V1.7. Constat
factuel : NVDA est annoncée rank #10 mondial alors qu'elle est #1 ou #2
depuis 2 ans. Source actuelle (yfinance market_cap via
scripts/enrich-ranks-yfinance.py) est périmée pour le top tech.

Mission :
1. Identifier au moins 2 sources gratuites alternatives plus fraîches
   (candidats : SEC EDGAR daily, FMP /quote avec les 4 clés disponibles
   dans .env.local, Yahoo Finance API direct sans la lib python qui
   cache, Stooq, companiesmarketcap.com via leur API ou scraping
   respectueux). Choisis la meilleure combinaison.
2. Réécrire le script `scripts/enrich-ranks-yfinance-v2.py` (ou
   nouveau nom) qui produit un fichier
   `src/data/v2-pipeline-enrich/<ticker>.ranks.json` au format existant
   (compatible avec load-company.ts). Garder la convention
   `_data_freshness_date` ISO.
3. Tester sur les top 30 (NVDA, MSFT, AAPL, GOOGL, AMZN, META, TSLA,
   BRK-B, JPM, WMT, V, etc.) que les ranks sont corrects.
4. Run sur les 617 stés. Commit + push staging. Broadcast résumé DOB
   dans SHARED-STATUS log.

Tu n'écris JAMAIS dans `src/data/v2-pipeline/` (scope CONV-DATA). Tu
écris UNIQUEMENT dans `src/data/v2-pipeline-enrich/<ticker>.ranks.json`.
Tu ne touches pas au code partagé (CompanyView, charts, proxy).

À chaque ticker traité : claim/release via scripts/work-claim.ts.

Premier livrable attendu : top 30 testés et validés en moins d'1 h.
ETA total run 617 stés : indique-moi avant de lancer.
```

---

## CONV-MODULE-UI-AUDIT

```
Tu es CONV-MODULE-UI-AUDIT. Ton scope unique = détecter automatiquement
les défauts d'affichage sur les pages V1.8 (top 308 stés) et préparer
des correctifs templates.

Bugs connus à détecter SYSTÉMATIQUEMENT (liste non-exhaustive, fournie
par Yann sur AMAT le 8 mai 2026) :
- `B$`, `B €`, `M $`, `M €` etc dans contexte FR (devrait être `Mds $`,
  `Mds €`, `M $`, `M €` selon convention Mettrik)
- Lignes textuelles qui débordent en 2 lignes alors qu'elles devraient
  tenir en 1 (rangs, sous-secteurs, taglines)
- Toggles ou boutons à 1 seul choix (devrait être hidden, ex : `Annuel`
  seul sans `Trimestriel` dispo)
- Logo Mettrik AI non-canonique sur les charts (la version validée est
  l'iridescent Fraunces italic 800 avec `i` custom + dot violet, cf.
  src/components/charts/chart-mini-logo.tsx)
- Acronymes (HPC, CAGR, TAM, EBITDA, etc.) sans tooltip `i` explicatif
  pour un FR de 16 ans non-tech
- Texte EN dans contexte FR : taglines, sous-secteurs ("Semiconductors
  & Semiconductor Equipment" devrait s'afficher avec libellé FR ou
  acronyme FR de type "Semi & Équipements")
- Rangs incohérents (mix `#XX` absolu vs `Top X` relatif)
- Espace insécable FR manquant entre nombre et `%` ou unité

Approche :
1. Script `scripts/audit-ui-pages.ts` (TypeScript via Playwright dans
   node_modules, déjà installé). Visite chaque page
   `/sandbox/v1-8/<ticker>` localement (npm run dev port 3000).
2. Pour chaque page, applique 8-10 assertions visuelles
   (innerText.includes, offsetWidth > parentWidth, etc.).
3. Output : `src/data/v1-8-ui-audit.json` listant les défauts par
   ticker avec code (`UI_BAD_UNIT_BS`, `UI_OVERFLOW_RANK`, `UI_HPC_NO_TOOLTIP`,
   etc.).
4. Phase 2 : pour chaque code, écrire un FIX TEMPLATE qui corrige le
   pattern dans tout le code (ex : remplacer `B$` partout, ajouter
   tooltip mapping pour acronymes connus). Coordination avec
   CONV-SYSTEMS via SHARED-STATUS pour les fix de code partagé.
5. Phase 3 : rerun audit pour confirmer le fix sur top 308.

Tu n'écris JAMAIS dans `src/data/v2-pipeline/` ni dans le code partagé
sans broadcast. Tu écris dans :
- `scripts/audit-ui-pages.ts`
- `src/data/v1-8-ui-audit.json`
- `src/lib/ui-fix-templates.ts` (nouveau, helpers pour les fix)

À chaque audit batch : commit + résumé DOB dans SHARED-STATUS log.

Premier livrable attendu : audit complet top 30 V1.8 avec liste des
codes défaut + 1ᵉʳ fix template appliqué (ex : `B$` → `Mds $`)
testé localement.

ETA total : annonce-moi avant de lancer (~2-3 h estimé).
```

---

## Convention de fin de mission

Quand un module a fini son scope (pas une étape, le scope ENTIER) :

1. Commit + push staging
2. Post DOB dans SHARED-STATUS log (format `🧩 CONV-MODULE-<NOM> →`)
3. Tag de fin : `✅ MISSION COMPLETE`
4. Yann peut alors fermer la conversation ou la garder en standby pour
   un futur module similaire.
