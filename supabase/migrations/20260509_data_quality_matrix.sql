-- 20260509_data_quality_matrix.sql
-- Tableau de vérification visuelle "société × fonctionnalité" pour suivre
-- ce qui est vraiment OK sur le top 305 V1.8.
--
-- Une ligne = un ticket de vérif (ex : NVDA × graph_annual = OK, vérifié
-- par CONV-SYSTEMS le 2026-05-09). On ne stocke ici que les overrides
-- manuels ; le statut "auto-OK" provient des fichiers data au runtime
-- via lib/desk/data-quality-matrix.ts (sans persistance).

create table if not exists desk_verification_matrix (
  id uuid primary key default gen_random_uuid (),
  ticker text not null,
  column_key text not null,
  -- ex 'logo', 'rank', 'graph_annual', 'graph_quarterly',
  --     'hero_interpretation', 'kpi_count', 'risks', 'governance',
  --     'ai_positioning', 'segments', 'geography'
  status text not null check (status in ('verified_ok', 'verified_ko', 'na')),
  verified_by text,
  -- 'CONV-SYSTEMS', 'CONV-CONCEPTS', 'CONV-DATA', 'YANN', etc.
  notes text,
  verified_at timestamptz not null default now (),
  unique (ticker, column_key)
);

create index if not exists desk_verification_matrix_ticker_idx on desk_verification_matrix (ticker);

create index if not exists desk_verification_matrix_column_idx on desk_verification_matrix (column_key, status);

alter table desk_verification_matrix enable row level security;

drop policy if exists "service role write matrix" on desk_verification_matrix;

create policy "service role write matrix" on desk_verification_matrix for all using (auth.role () = 'service_role');
