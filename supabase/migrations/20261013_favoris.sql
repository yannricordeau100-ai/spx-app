-- 13 oct 2026 : tables des favoris (etoile societe et etoile KPI), lues et ecrites par
-- src/app/favorites/actions.ts et src/app/api/company/favorites-state/route.ts. Elles n existaient pas en base.
create table if not exists public.favorite_companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  created_at timestamptz not null default now(),
  unique (user_id, ticker)
);
create table if not exists public.favorite_kpis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  kpi_short text not null,
  is_super boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, ticker, kpi_short)
);
create index if not exists favorite_companies_user_idx on public.favorite_companies (user_id, created_at desc);
create index if not exists favorite_kpis_user_idx on public.favorite_kpis (user_id, created_at desc);
alter table public.favorite_companies enable row level security;
alter table public.favorite_kpis enable row level security;
drop policy if exists "favoris societe : proprietaire" on public.favorite_companies;
create policy "favoris societe : proprietaire" on public.favorite_companies
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "favoris kpi : proprietaire" on public.favorite_kpis;
create policy "favoris kpi : proprietaire" on public.favorite_kpis
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
