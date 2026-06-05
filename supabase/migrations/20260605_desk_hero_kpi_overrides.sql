-- Yann 5 juin 2026 : table `desk_hero_kpi_overrides`
--
-- Source de vérité PERSISTANTE pour les overrides du hero KPI sélectionnés
-- via `/admin/kpis-toggle`. Remplace l'ancienne écriture filesystem dans
-- `src/data/v2-pipeline/<ticker>.json` qui était PERDUE à chaque deploy
-- Vercel (filesystem read-only en prod → EROFS, choix Yann perdus).
--
-- Schéma minimal :
--   ticker         : symbol canonical (upper, ex "AAPL"). PK.
--   hero_kpi_short : `short` du KPI choisi comme hero (ex "iPad Revenue").
--   updated_at     : ISO timestamp de la dernière modif.
--   updated_by     : email admin (Yann) qui a posé l'override.
--
-- Lecture : `loadV17Company()` SSR fetche toutes les overrides + cache mémoire
-- 60 s. Si une override existe pour `ticker` → remplace `company.hero_kpi`.
--
-- Écriture : `POST /api/admin/kpis-toggle/set-hero` upsert direct dans cette
-- table via service role (bypass RLS). Auth gate côté route via
-- `DESK_OWNER_EMAIL`.
--
-- RLS : pas d'accès anon/authenticated par défaut. Toutes les opérations
-- passent par la service role key côté server. Évite tout accès non autorisé
-- depuis le browser.

create table if not exists desk_hero_kpi_overrides (
  ticker          text primary key,
  hero_kpi_short  text not null,
  updated_at      timestamptz not null default now(),
  updated_by      text
);

create index if not exists desk_hero_kpi_overrides_updated_at_idx
  on desk_hero_kpi_overrides (updated_at desc);

alter table desk_hero_kpi_overrides enable row level security;

-- Service role bypass : toutes les ops admin passent par
-- `createSupabaseAdminClient()` qui utilise la service_role key (bypass RLS).
-- Pas de policy ouverte aux rôles anon/authenticated.
drop policy if exists "service role write hero overrides"
  on desk_hero_kpi_overrides;
create policy "service role write hero overrides"
  on desk_hero_kpi_overrides
  for all
  using (auth.role() = 'service_role');

-- Trigger updated_at auto (fonction `tg_set_updated_at` déjà créée dans une
-- migration précédente, cf desk_bugs).
drop trigger if exists desk_hero_kpi_overrides_updated
  on desk_hero_kpi_overrides;
create trigger desk_hero_kpi_overrides_updated
  before update on desk_hero_kpi_overrides
  for each row execute function tg_set_updated_at();
