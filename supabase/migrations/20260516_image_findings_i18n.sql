-- 20260516_image_findings_i18n.sql
-- i18n des findings : title + summary (= "bloc lecture") en FR/EN/DE.
-- Yann 16 mai 2026 : "traduit en français, anglais et allemand les titres
-- et le sous bloc 'lecture' de chaque graph".
-- Le merge SSR sur les pages société pickup la valeur selon la locale active.

alter table desk_image_findings
  add column if not exists title_i18n jsonb not null default '{}'::jsonb,
  add column if not exists summary_i18n jsonb not null default '{}'::jsonb;

-- Schema attendu : { "fr": "...", "en": "...", "de": "..." }
-- Helpers (optionnel, géré côté code) :
-- coalesce(title_i18n->>locale, title_i18n->>'fr', title)
