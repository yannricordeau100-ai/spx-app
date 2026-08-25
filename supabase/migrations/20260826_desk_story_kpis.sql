create table if not exists public.desk_story_kpis (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  source_url text not null,
  source_kind text not null default 'web',
  source_label text,
  source_published_at date,
  hint text,
  kpi_short text,
  kpi_name_fr text,
  kpi_name_en text,
  kpi_value double precision,
  kpi_unit text,
  kpi_period text,
  signal_fr text,
  signal_en text,
  evidence text,
  family text,
  status text not null default 'draft',
  error_msg text,
  llm_raw text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists desk_story_kpis_ticker_idx on public.desk_story_kpis (ticker);

alter table public.desk_story_kpis enable row level security;
