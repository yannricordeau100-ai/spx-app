-- 20260509_desk_bugs.sql
-- Module bug tracker pour le desk-mtk9x4kp (Yann 8 mai 2026, fond du tiroir).
-- MVP : Yann saisit / range / clôt manuellement. Le tracking auto via
-- Sentry-like sera une V2 si besoin.

create table if not exists desk_bugs (
  id uuid primary key default gen_random_uuid(),
  -- Titre court (1 ligne)
  title text not null,
  -- Description longue (markdown autorisé en V2 quand affiché)
  description text,
  -- Sévérité 1 (cosmétique) → 5 (bloquant ship)
  severity smallint not null default 3 check (severity between 1 and 5),
  -- Difficulté de réparation 1 (trivial, < 15 min) → 5 (refonte > 1 j)
  repair_difficulty smallint not null default 3 check (repair_difficulty between 1 and 5),
  -- Status
  status text not null default 'open' check (status in ('open', 'in_progress', 'fixed', 'wont_fix', 'duplicate')),
  -- Étiquettes libres séparées par virgule
  tags text,
  -- Page / module concerné (ex "/sandbox/v1-8/aapl", "pricing-admin")
  area text,
  -- Optionnel : URL de reproduction
  repro_url text,
  -- Quelle conv a soulevé le bug (CONV-SYSTEMS, CONV-DATA, …)
  reported_by_conv text,
  -- Notes de fix (qui, quand, comment) une fois résolu
  resolution_note text,
  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_by uuid references auth.users (id),
  resolved_by uuid references auth.users (id)
);

create index if not exists desk_bugs_status_idx on desk_bugs (status, severity desc, created_at desc);
create index if not exists desk_bugs_area_idx on desk_bugs (area);

alter table desk_bugs enable row level security;

drop policy if exists "service role write bugs" on desk_bugs;
create policy "service role write bugs"
  on desk_bugs for all using (auth.role() = 'service_role');

drop trigger if exists desk_bugs_updated on desk_bugs;
create trigger desk_bugs_updated before update on desk_bugs
  for each row execute function tg_set_updated_at();
