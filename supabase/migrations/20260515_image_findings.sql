-- 20260515_image_findings.sql
-- Graphiques et Schémas de sources diverses (principalement images de
-- posts X / Twitter).
-- Workflow Yann :
--   1. Crée demande #N dans /sandbox/image-findings (query libre,
--      tickers cibles, langues par défaut)
--   2. Clique "Lancer recherche Claude" → status = claude_pending
--   3. Va dans la conv Claude MAX 20×, tape "lance la demande N"
--   4. Claude fait WebSearch site:x.com + extract images + insert findings
--   5. Yann revient sandbox, voit grid d'images, approuve/rejette
--   6. Images approuvées s'affichent dans bloc "Graphiques et Schémas
--      de sources diverses" sur les pages sté concernées.

-- Table 1 : les demandes (1 par "demande #N")
create table if not exists desk_image_findings_requests (
  id uuid primary key default gen_random_uuid(),
  -- Numéro lisible #1, #2, ... (auto-incrément côté UI via count)
  display_number int,
  title text,
  query text not null,                                  -- ex "graph français part Google IA"
  target_tickers text[] not null default '{}'::text[],  -- 1 ou plusieurs
  languages text[] not null default '{fr,en}'::text[],  -- langues d'affichage par défaut
  status text not null default 'todo'
    check (status in ('todo', 'claude_pending', 'in_progress', 'pending_review', 'done', 'error')),
  error_msg text,
  findings_count int default 0,
  approved_count int default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table 2 : les images trouvées (N par demande)
create table if not exists desk_image_findings (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references desk_image_findings_requests(id) on delete cascade,
  -- Tickers concernés (hérités request, modifiables par image)
  target_tickers text[] not null default '{}'::text[],
  -- Langues d'affichage (héritées request, décochables par image)
  languages text[] not null default '{fr,en}'::text[],
  -- Source X
  source_url text,
  source_author text,
  source_handle text,
  source_date timestamptz,
  source_platform text default 'x',
  -- Image
  image_url text not null,
  image_local_path text,
  -- Métadonnées extraites
  title text,
  caption text,
  summary text,                       -- résumé LLM 1-2 lignes
  detected_kpi_topics text[] default '{}'::text[],
  -- Validation Yann
  approved boolean not null default false,
  rejected boolean not null default false,
  reviewed_at timestamptz,
  reviewer_notes text,
  -- Ordre d'affichage (Yann peut réordonner)
  display_order smallint default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists desk_image_findings_req_idx on desk_image_findings (request_id);
create index if not exists desk_image_findings_approved_idx on desk_image_findings (approved, rejected);
create index if not exists desk_image_findings_tickers_idx on desk_image_findings using gin (target_tickers);

alter table desk_image_findings_requests enable row level security;
alter table desk_image_findings enable row level security;
drop policy if exists "service role write findings req" on desk_image_findings_requests;
create policy "service role write findings req" on desk_image_findings_requests for all using (auth.role() = 'service_role');
drop policy if exists "service role write findings" on desk_image_findings;
create policy "service role write findings" on desk_image_findings for all using (auth.role() = 'service_role');

drop trigger if exists desk_findings_req_updated on desk_image_findings_requests;
create trigger desk_findings_req_updated before update on desk_image_findings_requests
  for each row execute function tg_set_updated_at();
drop trigger if exists desk_findings_updated on desk_image_findings;
create trigger desk_findings_updated before update on desk_image_findings
  for each row execute function tg_set_updated_at();
