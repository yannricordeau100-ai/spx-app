-- 20260517_vip_inspection.sql
-- Migration : VIP Inspection vers Supabase (au lieu de fs.writeFileSync
-- qui échoue sur Vercel filesystem read-only).
-- Yann 17 mai 2026 : "je veux pouvoir ajouter toutes les stés".

-- 1. Liste VIP (tickers à inspecter avec audit visuel approfondi)
create table if not exists vip_inspection_list (
  ticker text primary key,
  note text,
  added_at timestamptz not null default now(),
  scheduled_at timestamptz
);

-- 2. Statut d'inspection (résultats Gemini + auto-fixes)
create table if not exists vip_inspection_status (
  ticker text primary key references vip_inspection_list(ticker) on delete cascade,
  state text not null default 'idle' check (state in ('idle','running','done','error')),
  last_run_at timestamptz,
  defects jsonb default '[]'::jsonb,
  mode_screenshots jsonb default '{}'::jsonb,
  error text,
  updated_at timestamptz not null default now()
);

create index if not exists vip_inspection_status_state_idx on vip_inspection_status (state);

-- 3. RLS : service role only (admin desk)
alter table vip_inspection_list enable row level security;
alter table vip_inspection_status enable row level security;

drop policy if exists "service role vip list" on vip_inspection_list;
create policy "service role vip list" on vip_inspection_list
  for all using (auth.role() = 'service_role');

drop policy if exists "service role vip status" on vip_inspection_status;
create policy "service role vip status" on vip_inspection_status
  for all using (auth.role() = 'service_role');

-- 4. Backfill depuis vip-list.json existant
insert into vip_inspection_list (ticker, note, added_at, scheduled_at)
values ('BABA', 'Pas de DEF14A (ADR Chinois) — investor relations via annual report HK + 6-K + IR page. À enrichir gov via 9988.HK quand dispo.', '2026-05-17T01:00:00Z', '2026-05-17T05:00:00Z')
on conflict (ticker) do nothing;
