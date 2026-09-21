---
name: reference_mettrik_visibility_gate
description: "Gate de visibilité V195 Mettrik, comment vérifier qu'une fiche existe vraiment avant de publier"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 3d66d21c-90d4-48da-815a-a51cc4d035be
  modified: 2026-08-09T13:21:14.191Z
---

La page V1.9.5 (`src/app/sandbox/v1-9-5/[ticker]/page.tsx`) redirige vers l'overview toute société absente de `src/data/v1-9-5-clean-all-tickers.json`, **même si `loadV17Company` renvoie des KPIs**. Publier dans Supabase ne crée pas la fiche.

**Comment vérifier** (en vue connectée, jamais anonyme, cf [[feedback_mettrik_verify_admin]]) :
```
curl -sL -o /tmp/p.html "https://mettrik-niveau2.vercel.app/sandbox/v1-9-5/<ticker>?audit_token=$VISUAL_AUDIT_TOKEN"
```
Une vraie fiche pèse 350 à 420 Ko. L'overview de repli pèse **2 166 745 octets, identique pour tous les tickers cassés**. Le `<title>` est le même dans les deux cas, donc il ne discrimine pas : c'est la taille qui tranche.

L'URL canonique d'une société est `/sandbox/v1-9-5/<ticker>`. La route racine `/<TICKER>` dépend d'une autre liste (`v1-7-public.json`) et renvoie 404 pour beaucoup de sociétés qui fonctionnent très bien, dont JNJ et MSI : ne pas s'en servir pour conclure.

`scripts/qualify-stes.ts` contrôle cette gate depuis le 9 août 2026 et rejette les tickers absents avant tout autre test. Voir [[project_mettrik_v195_blocked_tail]].

Rappel (27 aout 2026) : `publish-online.ts` ecrit uniquement dans Supabase `desk_curated_companies`. Il NE met PAS a jour `src/data/v1-9-5-clean-all-tickers.json`. Publier une ste = les deux gestes, sinon elle apparait dans la recherche et sa page redirige vers l overview. Le desalignement avait atteint 235 stes. Le qualifieur accepte `QUALIFY_SKIP_CLEAN_GATE=1` pour auditer une ste hors liste, et `QUALIFY_OUT_PASS` / `QUALIFY_OUT_FAIL` pour tourner en parallele. Voir aussi [[reference_mettrik_casse_fichiers]].
