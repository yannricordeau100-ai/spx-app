-- 20260512_ir_sources.sql
-- Table des sources IR (Investor Relations) par société.
--
-- Permet à Yann de saisir 1 à N URLs par sté (page corp + page IR home +
-- page IR docs + pages IR docs supplémentaires) puis à un scraper Python
-- (CONV-DATA scope) de télécharger automatiquement tous les docs IR :
-- press releases, audio webcast transcripts, CFO commentary, earning slides.
--
-- Pourquoi cette table : SEC EDGAR n'a que les filings réglementaires
-- (10-K, 10-Q, 8-K, DEF 14A, 20-F). Tous les autres docs (CFO commentary,
-- press releases trimestriels, slides earning call, transcripts) sont
-- UNIQUEMENT publiés sur les pages IR. Pour les stés européennes pures
-- (cat 3 sans ADR), SEC EDGAR n'a même pas les filings principaux.
--
-- Yann remplit les URLs manuellement (ou via auto-discovery futur).
-- Le scraper utilise ces URLs comme point d'entrée pour aspirer les PDFs.

create table if not exists desk_ir_sources (
  ticker text primary key,

  -- URL du site principal de la sté (ex: https://www.nvidia.com)
  home_url text,

  -- URL d'accueil de la section investisseurs (ex: https://investor.nvidia.com)
  -- Souvent différente de la page où sont les docs téléchargeables.
  -- Peut être null si identique à ir_docs_main_url.
  ir_home_url text,

  -- URL principale de la page où sont listés les docs téléchargeables
  -- (ex: https://investor.nvidia.com/financial-info/financial-reports/default.aspx)
  ir_docs_main_url text,

  -- URLs additionnelles si les docs sont éclatés en plusieurs pages
  -- (ex: une page Press Releases, une page Annual Reports, une page Transcripts).
  -- Stocké en JSONB pour flexibilité (array de strings).
  ir_docs_additional_urls jsonb default '[]'::jsonb,

  -- Notes libres (Yann peut commenter, ex "page JS-heavy, scraper Playwright")
  notes text,

  -- Statut global : todo (rien saisi), partial (au moins 1 URL), complete (toutes URLs OK),
  -- verified (Yann a confirmé que toutes les sources nécessaires sont là)
  status text not null default 'todo' check (status in ('todo', 'partial', 'complete', 'verified')),

  -- Types de docs manquants détectés (mis à jour par le scraper).
  -- Valeurs possibles : 'press_releases', 'transcripts', 'cfo_commentary',
  -- 'earning_slides', 'annual_report_pdf', 'esg_report', 'investor_day'.
  missing_docs jsonb default '[]'::jsonb,

  -- Compteurs scraper
  docs_count smallint default 0,
  last_scrape_at timestamptz,
  last_scrape_status text,    -- 'success' / 'partial' / 'error:<msg>'

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists desk_ir_sources_status_idx on desk_ir_sources (status, ticker);
create index if not exists desk_ir_sources_scrape_idx on desk_ir_sources (last_scrape_at desc);

alter table desk_ir_sources enable row level security;

drop policy if exists "service role write ir sources" on desk_ir_sources;
create policy "service role write ir sources" on desk_ir_sources for all using (auth.role() = 'service_role');

drop trigger if exists desk_ir_sources_updated on desk_ir_sources;
create trigger desk_ir_sources_updated before update on desk_ir_sources
  for each row execute function tg_set_updated_at();
