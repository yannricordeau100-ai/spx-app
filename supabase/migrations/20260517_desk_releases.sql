-- 20260517_desk_releases.sql
-- Architecture 3 niveaux (Yann 16 mai 2026) :
--   * Niveau 0 LIVE www.mettrik.ai (public)
--   * Niveau 1 PRE-LIVE pre.mettrik.ai (gated admin)
--   * Niveau 2 DEV staging.mettrik.ai (gated admin)
--
-- Table desk_releases = historique versionné des push live + tracking
-- des versions pre-live actives. Version invisible côté HTML public,
-- visible via header HTTP X-Mettrik-Version, endpoint /api/version,
-- ou page back-office /desk-mtk9x4kp/releases.

create table if not exists desk_releases (
  id uuid primary key default gen_random_uuid(),
  -- Niveau : 'live' / 'pre-live' / 'dev'
  level text not null check (level in ('live', 'pre-live', 'dev')),
  -- Version sémantique majeur.mineur.patch (ex 1.0.0, 1.0.1, 1.1.0)
  version text not null,
  -- Hash git du commit pushé
  git_sha text,
  -- URL Vercel snapshot (immuable, garde l'ancienne live accessible)
  vercel_url text,
  -- Statut courant : current = actif maintenant, archived = ancienne live remplacée
  status text not null default 'current' check (status in ('current', 'archived', 'failed', 'pending')),
  -- Notes humaines (ex "ajout de feature X", "fix bug Y")
  notes text,
  -- Métadonnées variantes (plans, langues, pays actifs)
  variants_meta jsonb default '{}'::jsonb,
  deployed_at timestamptz not null default now(),
  deployed_by text,            -- email admin (ex yannricordeau100@gmail.com)
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists desk_releases_level_idx on desk_releases (level, status, deployed_at desc);
create index if not exists desk_releases_version_idx on desk_releases (version);

-- Assure qu'on a au plus 1 release "current" par niveau
create unique index if not exists desk_releases_current_per_level
  on desk_releases (level)
  where status = 'current';

alter table desk_releases enable row level security;

drop policy if exists "service role write releases" on desk_releases;
create policy "service role write releases" on desk_releases
  for all using (auth.role() = 'service_role');

-- Lecture publique du current live (pour endpoint /api/version public)
drop policy if exists "public read current live release" on desk_releases;
create policy "public read current live release" on desk_releases
  for select using (level = 'live' and status = 'current');

-- Seed initial : on note la version actuelle staging comme "dev v0.1.0"
-- variants_meta : 4 versions utilisateur (visitor + free + premium + max),
-- 3 langues officielles FR/EN/DE au démarrage (les autres FR/EN/DE/nl/sv/da
-- existent en code mais ne sont pas part des versions "officielles" niveau 0).
insert into desk_releases (level, version, status, notes, variants_meta, deployed_by)
values (
  'dev',
  '0.1.0',
  'current',
  'Bootstrap initial — architecture 3 niveaux mise en place 17 mai 2026',
  '{"variants":["visitor","free","premium","max"],"locales":["fr","en","de"],"notes":"4 versions utilisateur × 3 langues officielles"}'::jsonb,
  'yannricordeau100@gmail.com'
)
on conflict do nothing;
