---
name: reference-mettrik-hero-override-supabase
description: Le hero affiche d une ste Mettrik vient de la table Supabase desk_hero_kpi_overrides, que apply-hero-fix.py ne met pas a jour
metadata:
  type: reference
---

Dans ~/spx-app, le KPI hero réellement rendu suit cet ordre de priorité :

1. `desk_hero_kpi_overrides` (Supabase, colonne `hero_kpi_short`, lue par `src/lib/company-core/hero-kpi-overrides.ts`) — priorité maximale, ~289 lignes en août 2026
2. `hero_kpi` dans `src/data/v2-pipeline/<ticker minuscule>.json`
3. `.batches-drafts-safe/kpis-haut/<TICKER>.json` — fournit la liste des KPIs réellement affichés, souvent bien plus riche que la couche v2-pipeline
4. `src/data/companies/<ticker>.json` n'est PAS lu en runtime (audits locaux seulement)

`scripts/apply-hero-fix.py` n'écrit QUE la couche 2. Si un override Supabase existe, le fix reste invisible et le qualifieur continue de rejeter la sté. Vérifier et corriger l'override avant de conclure qu'un fix a échoué :

curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/desk_hero_kpi_overrides?select=ticker,hero_kpi_short&ticker=eq.<T>" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

Cas vécu le 21 août 2026 : SIKA.SW rejetée pour hero = CA total. Le KPI régional REV_EMEA existait déjà dans kpis-haut avec la bonne série FY2020 à FY2025 ; seul l'override Supabase pointait encore sur REV_Q. Un PATCH de l'override a suffi.

Voir aussi [[project-mettrik-hero-selection-defect]] et [[reference-mettrik-apply-hero-fix]].
