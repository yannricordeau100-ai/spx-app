-- 20260601_block_rules_apply.sql
-- Ajoute le tracking des "Appliquer maintenant à tout l'univers" sur les règles de bloc.
--
-- Yann (1er juin 2026) : sur la page admin /sandbox/admin/block-rules, ajout
-- d'un bouton pour appliquer les règles à toutes les stés V1.9.5. Chaque règle
-- garde la date de dernière application + le report (modifs faites).
--
-- Idempotent : IF NOT EXISTS.

alter table desk_block_rules
  add column if not exists last_applied_at timestamptz;

alter table desk_block_rules
  add column if not exists last_apply_report jsonb;

-- Table jobs : 1 ligne par run "Appliquer maintenant".
create table if not exists desk_block_rules_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending','running','done','error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  report jsonb not null default '{}'::jsonb,
  error_message text
);

create index if not exists desk_block_rules_jobs_status_idx
  on desk_block_rules_jobs (status, started_at desc);
