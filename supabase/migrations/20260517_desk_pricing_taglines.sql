-- 20260517_desk_pricing_taglines.sql
-- Table dédiée aux taglines éditables affichés à droite du prix /jour
-- sur les cards pricing publiques. 1 ligne par plan (premium, max).
--
-- Pourquoi une table séparée et pas une colonne dans pricing_plans :
--  - Atomique / idempotent : CREATE IF NOT EXISTS sans toucher au schéma
--    existant qui contient déjà `tagline_fr` (utilisé pour la phrase
--    sous le titre du plan — usage différent).
--  - Le tagline /jour est un texte marketing distinct, traduit en 8 langues.
--  - Permet à l'admin de re-traduire indépendamment (hash-diff).
--
-- Locales cibles : fr (source) + en, en-GB, de, de-CH, nl, sv, da (autotrad).
-- Format tagline_i18n :
--   { "en": "...", "en-GB": "...", "de": "...", "de-CH": "...",
--     "nl": "...", "sv": "...", "da": "..." }
--
-- Hash : SHA-256 hex du tagline_fr au moment de la dernière traduction.
-- Si tagline_fr change → hash change → re-traduit. Sinon idempotent.

create table if not exists desk_pricing_taglines (
  plan_key text primary key,
  tagline_fr text not null default '',
  tagline_fr_hash text,
  tagline_i18n jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Trigger updated_at auto.
create or replace function desk_pricing_taglines_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists desk_pricing_taglines_touch on desk_pricing_taglines;
create trigger desk_pricing_taglines_touch
  before update on desk_pricing_taglines
  for each row execute function desk_pricing_taglines_touch_updated_at();

-- Index GIN pour serialization JSONB rapide.
create index if not exists desk_pricing_taglines_i18n_idx
  on desk_pricing_taglines using gin (tagline_i18n);

-- Seed initial : reprend la phrase café actuelle (i18n keys
-- pricing.card.coffee_slogan_part1 + part2 concaténées) pour ne pas casser
-- l'affichage public tant que Yann n'a pas saisi un tagline custom.
insert into desk_pricing_taglines (plan_key, tagline_fr)
values
  ('premium', 'Soit moins que le prix d''un café, mais bien mieux investi !'),
  ('max',     'Soit moins que le prix d''un café, mais bien mieux investi !')
on conflict (plan_key) do nothing;
