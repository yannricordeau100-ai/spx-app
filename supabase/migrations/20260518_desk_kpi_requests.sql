-- desk_kpi_requests : file d'attente des demandes "Ajout KPI multi-sociétés"
-- depuis le desk admin. Une ligne = une description user transformée en un
-- ensemble de tickers ciblés à extraire via LLM (Cerebras/Haiku).
--
-- Le script Python /scripts/run-kpi-add-request.py lit les lignes en status
-- 'pending', traite ticker par ticker, et écrit le résultat dans la colonne
-- JSONB `results`. Aucune écriture directe dans v2-pipeline/ : validation
-- manuelle Yann avant intégration.

create table if not exists desk_kpi_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  description text not null,
  kpi_short text not null,
  kpi_name_en text not null,
  kpi_name_fr text,
  kpi_explanation text not null,
  kpi_type text not null,
  kpi_expected_unit text not null,
  extraction_prompt text not null,
  fallback_story boolean not null default true,
  tickers text[] not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'error', 'canceled')),
  progress_done int not null default 0,
  progress_total int not null,
  results jsonb not null default '[]'::jsonb,
  error_message text
);

create index if not exists desk_kpi_requests_status_idx on desk_kpi_requests (status, created_at desc);

create or replace function desk_kpi_requests_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists desk_kpi_requests_touch on desk_kpi_requests;
create trigger desk_kpi_requests_touch before update on desk_kpi_requests
  for each row execute function desk_kpi_requests_touch_updated_at();

alter table desk_kpi_requests enable row level security;
drop policy if exists "service role full access kpi_requests" on desk_kpi_requests;
create policy "service role full access kpi_requests" on desk_kpi_requests
  for all using (auth.role() = 'service_role');
