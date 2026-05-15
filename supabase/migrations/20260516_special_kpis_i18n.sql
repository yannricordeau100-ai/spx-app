-- 20260516_special_kpis_i18n.sql
-- Ajoute traductions 8 langues + annotations sur les KPIs spéciaux.
-- Yann 15 mai 2026.

alter table desk_special_kpis
  -- Traductions du nom dans les 8 langues (fr en déjà via kpi_name_fr / kpi_name_en).
  -- Stocké en JSONB unique pour éviter de polluer le schéma de 6 colonnes.
  -- Clés : "fr", "en", "de", "nl", "sv", "da", "en-GB", "de-CH".
  add column if not exists kpi_name_i18n jsonb default '{}'::jsonb,

  -- Traductions du hero_summary (la phrase courte sous le chart)
  add column if not exists hero_summary_i18n jsonb default '{}'::jsonb,

  -- Traductions de l'interprétation (la phrase plus longue)
  add column if not exists interpretation_i18n jsonb default '{}'::jsonb,

  -- Annotations "i" placées sur le chart à des années précises.
  -- Format JSONB :
  -- [
  --   {
  --     "period": "2020" OR "FY20" OR "between:2020-2021",
  --     "title_i18n": {"fr": "Lancement iPhone 12", "en": "iPhone 12 launch", ...},
  --     "text_i18n":  {"fr": "Premier iPhone 5G...", "en": "First 5G iPhone...", ...}
  --   }
  -- ]
  add column if not exists annotations jsonb default '[]'::jsonb;

-- Index light pour la sérialisation
create index if not exists desk_special_kpis_annotations_idx on desk_special_kpis using gin (annotations);
