-- 20260509_quality_history.sql
-- Snapshot horaire de la matrice qualité données. Une ligne par
-- (snapshot_at, column_key, section). Permet de tracer l'amélioration
-- globale dans le temps.

create table if not exists desk_quality_history (
  id bigserial primary key,
  snapshot_at timestamptz not null default now(),
  section text not null check (
    section in ('v18_top', 'extra', 'all')
  ),
  -- Section concernée : top 305, extras, ou agrégat global.
  column_key text not null,
  -- Une des 18 colonnes de COLUMN_KEYS (logo, rank, hero_kpi, etc.).
  total smallint not null,
  ok smallint not null default 0,
  -- 🟢 auto_ok + verified_ok confondus
  stale smallint not null default 0,
  -- 🟡 auto_stale (présent mais en retard sur dernier earning/AG)
  partial smallint not null default 0,
  -- 🟠 auto_partial (présent mais incomplet)
  ko smallint not null default 0,
  -- 🔴 auto_ko + verified_ko confondus (manquant)
  na smallint not null default 0,
  -- ⚪ na (sans objet, ex dividende sur sté qui n'en verse pas)
  unique (snapshot_at, section, column_key)
);

create index if not exists desk_quality_history_at_idx on desk_quality_history (snapshot_at desc);

create index if not exists desk_quality_history_col_idx on desk_quality_history (column_key, section, snapshot_at desc);

alter table desk_quality_history enable row level security;

drop policy if exists "service role write history" on desk_quality_history;

create policy "service role write history" on desk_quality_history for all using (auth.role () = 'service_role');
