-- 20260514_special_kpis.sql
-- KPIs spéciaux nécessitant recherche manuelle (interne 10-K + web) :
-- ex Apple iPhone units vendus, Netflix abonnés, Tesla livraisons par modèle.
-- Yann pilote depuis /sandbox/special-kpis : crée la demande, lance
-- l'extraction (Groq Llama 3.3 70B free, ou Claude conv), valide le rendu
-- en preview, coche "publié" pour les pousser sur les pages société live.

create table if not exists desk_special_kpis (
  id uuid primary key default gen_random_uuid(),

  -- Cible : 1 ticker précis OU une liste de tickers (mode "appliquer à plusieurs")
  ticker text,                                  -- mode mono-sté (NULL si multi)
  target_tickers text[] default '{}'::text[],   -- mode multi-stés
  mode text not null default 'single' check (mode in ('single', 'multi')),

  -- Identité du KPI
  kpi_short text not null,             -- ex "iPhone Units"
  kpi_name_fr text,                    -- ex "Unités iPhone vendues"
  kpi_name_en text,                    -- ex "iPhone units sold"
  kpi_unit text,                       -- ex "M unités"
  kpi_category text default 'Volume',  -- Revenue / Volume / User / Demand / ...

  -- Style et chart
  style text not null default 'classique' check (style in ('classique', 'story')),
  chart_type text not null default 'curve' check (chart_type in ('curve', 'bars', 'variation')),
  story_category text,                 -- si style='story' : Marché / Adoption / Capacité / Innovation

  -- Description de la demande (ce que le LLM doit chercher)
  description text,                    -- prompt user (ce qu'il faut trouver)

  -- Statut workflow
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'done', 'error', 'manual_needed', 'claude_assigned')),
  error_msg text,
  notes text,

  -- Résultat extrait par le LLM
  -- Format : { "values_by_period": [{period, value, uncertainty_pct?, uncertainty_note?, source?}], "hero_summary": "...", "interpretation": "..." }
  data jsonb default '{}'::jsonb,
  data_source text,                    -- ex "10-K FY24 + IDC + Statista"

  -- Trace LLM
  llm_provider text,                   -- 'groq-llama-3.3-70b' / 'claude-conv' / 'external-claude' / 'external-chatgpt'
  llm_prompt text,
  llm_response_raw text,
  llm_at timestamptz,

  -- Publication sur les pages société (cochée par Yann après preview)
  published boolean not null default false,
  published_at timestamptz,
  is_hero boolean not null default false,   -- si publié : remplace le hero KPI ? sinon liste indicateurs clés / stories

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists desk_special_kpis_ticker_idx on desk_special_kpis (ticker);
create index if not exists desk_special_kpis_status_idx on desk_special_kpis (status);
create index if not exists desk_special_kpis_pub_idx on desk_special_kpis (published, ticker);

alter table desk_special_kpis enable row level security;
drop policy if exists "service role write special_kpis" on desk_special_kpis;
create policy "service role write special_kpis" on desk_special_kpis for all using (auth.role() = 'service_role');

drop trigger if exists desk_special_kpis_updated on desk_special_kpis;
create trigger desk_special_kpis_updated before update on desk_special_kpis
  for each row execute function tg_set_updated_at();
