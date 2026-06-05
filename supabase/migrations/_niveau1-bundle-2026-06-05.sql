-- ============================================================================
-- BUNDLE NIVEAU 1 SUPABASE — Yann 5 juin 2026
-- ============================================================================
-- Concaténation idempotente de toutes les migrations post-bascule (18 mai+)
-- À coller dans le SQL Editor niveau 1 en UN SEUL bloc.
-- Toutes les opérations utilisent `if not exists` / `create or replace` /
-- `on conflict do nothing` → safe à re-exécuter.
-- ============================================================================

-- Fonction commune `tg_set_updated_at` (référencée par presque toutes les
-- tables ci-dessous via trigger). Créée en premier pour éviter forward-ref.
create or replace function tg_set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


-- ============================================================================
-- 20260518_desk_curated_companies
-- ============================================================================
-- Yann 18 mai 2026, bascule niveau 1.
--
-- Curation des sociétés visibles côté front public (niveau 0 + 1).
-- Niveau 2/3 ignore ce filtre (= toutes les sés sont visibles pour dev).
--
-- Modèle CUMULATIF : `min_plan` indique le tier minimum requis pour voir
-- la sté. Plus le plan est haut, plus on a accès :
--   - min_plan = 'free'    : visible par Free + Premium + Max
--   - min_plan = 'premium' : visible par Premium + Max
--   - min_plan = 'max'     : visible par Max uniquement
--   - min_plan = 'hidden'  : invisible publiquement (admin uniquement)
--
-- Une sté ABSENTE de cette table est considérée 'hidden' par défaut côté
-- niveau 0/1. Donc Yann doit explicitement marquer chaque sté qu'il
-- veut exposer publiquement (sécurité par défaut : opt-in).
CREATE TABLE IF NOT EXISTS public.desk_curated_companies (
  ticker     text PRIMARY KEY,
  min_plan   text NOT NULL DEFAULT 'hidden'
    CHECK (min_plan IN ('free', 'premium', 'max', 'hidden')),
  notes      text,
  added_at   timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS desk_curated_companies_min_plan_idx
  ON public.desk_curated_companies (min_plan);

-- RLS : admin uniquement (write). Lecture publique pour le filtre frontend.
ALTER TABLE public.desk_curated_companies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Lecture publique pour que le proxy frontend puisse filtrer les sés.
  CREATE POLICY desk_curated_companies_read
    ON public.desk_curated_companies
    FOR SELECT TO public
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger updated_at
DROP TRIGGER IF EXISTS desk_curated_companies_updated_at
  ON public.desk_curated_companies;
CREATE TRIGGER desk_curated_companies_updated_at
  BEFORE UPDATE ON public.desk_curated_companies
  FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();


-- ============================================================================
-- 20260518_desk_kpi_requests
-- ============================================================================
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


-- ============================================================================
-- 20260518_desk_user_preferences
-- ============================================================================
-- Yann 18 mai 2026, bascule niveau 1.
--
-- Table de préférences user (par owner_email), sert pour :
--   (a) Labels customs des 5 catégories de to-dos (anciennement localStorage)
--       → survit aux changements de domaine (prod / niveau1 / niveau2)
--   (b) Memo simulation tier admin ("view as anonymous/free/premium/max")
--       → optionnel, le cookie est la source de vérité par onglet
--
-- 1 row par user (PK = owner_email, donc upsert simple).
CREATE TABLE IF NOT EXISTS public.desk_user_preferences (
  owner_email           text PRIMARY KEY,
  todo_category_labels  jsonb NOT NULL DEFAULT '{}'::jsonb,
  simulate_tier         text,  -- null | "anonymous" | "free" | "premium" | "max"
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS desk_user_preferences_email_idx ON public.desk_user_preferences (owner_email);

-- RLS : un user voit/modifie uniquement sa propre row.
ALTER TABLE public.desk_user_preferences ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY desk_user_preferences_owner_policy
    ON public.desk_user_preferences
    FOR ALL TO authenticated
    USING ((auth.jwt() ->> 'email') = owner_email)
    WITH CHECK ((auth.jwt() ->> 'email') = owner_email);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger updated_at
DROP TRIGGER IF EXISTS desk_user_preferences_updated_at ON public.desk_user_preferences;
CREATE TRIGGER desk_user_preferences_updated_at
  BEFORE UPDATE ON public.desk_user_preferences
  FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();


-- ============================================================================
-- 20260518_image_findings_kpi_draft
-- ============================================================================
alter table desk_image_findings
  add column if not exists convertible_to_kpi boolean not null default false,
  add column if not exists kpi_draft jsonb;

comment on column desk_image_findings.convertible_to_kpi is
  'Yann 18 mai 2026 : finding extrait dun doc société dont les data peuvent constituer un KPI normal (value, history, unit, yoy)';
comment on column desk_image_findings.kpi_draft is
  'JSON KPI prêt à insérer dans company.kpis[] si Yann approuve';


-- ============================================================================
-- 20260518_pricing_plans_price_caption
-- ============================================================================
-- Yann 18 mai 2026, bascule niveau 1 : colonnes price_caption_* qui étaient
-- en prod (ajoutées via SQL Editor en direct sans migration commitée).
-- Aligne le schéma de tout nouveau projet Supabase (niveau 1, futures
-- instances) avec la prod.
ALTER TABLE public.pricing_plans
  ADD COLUMN IF NOT EXISTS price_caption_fr text,
  ADD COLUMN IF NOT EXISTS price_caption_en text,
  ADD COLUMN IF NOT EXISTS price_caption_de text;


-- ============================================================================
-- 20260525_pricing_features_show_in_card
-- ============================================================================
-- Yann (25 mai 2026) : permettre de choisir QUELLES features apparaissent
-- dans le bloc "forfait" (card pricing publique). Avant : on prenait les 8
-- premières features non-false. Maintenant : seules celles flaggées
-- show_in_card=true apparaissent (au choix Yann depuis /desk-mtk9x4kp/pricing).
--
-- Non destructif : default false → existant inchangé tant que Yann n'a coché
-- aucune ligne. Une fois ≥1 feature cochée, seules les cochées s'affichent.
-- Fallback : si AUCUNE feature cochée pour le plan, la card retombe sur
-- les 8 premières (comportement avant migration) → pas de card vide.

alter table pricing_features
  add column if not exists show_in_card boolean not null default false;

-- Index optionnel (lecture rapide des features cochées)
create index if not exists pricing_features_card_idx
  on pricing_features (show_in_card)
  where show_in_card = true;


-- ============================================================================
-- 20260530_desk_block_rules
-- ============================================================================
-- 20260530_desk_block_rules.sql
-- Règles d'écriture libres saisies par Yann pour chaque bloc page sté.
-- Sub-agents futurs liront ces règles AVANT d'extraire / écrire le bloc.
-- Idempotent : CREATE IF NOT EXISTS, pas de DROP, pas de DELETE.
--
-- Workflow :
--   1. Yann écrit librement (fond + forme) dans `rules_raw` (textarea)
--   2. V1 (maintenant) : `rules_structured = { lines: [...] }` (split lignes non vides)
--   3. V2 (futur) : LLM Cerebras parse en { do:[], dont:[], hors_top1:[] }
--   4. Sub-agent lit getBlockRules(blockKey) avant écriture
--
-- Auth-gate : email Yann uniquement (desk_owner). Pas de RLS user, table admin.

create table if not exists desk_block_rules (
  block_key text primary key,
  rules_raw text not null default '',
  rules_structured jsonb not null default '{}'::jsonb,
  rules_hors_top1_raw text not null default '',
  rules_hors_top1_structured jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Trigger updated_at auto sur UPDATE.
create or replace function desk_block_rules_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists desk_block_rules_touch on desk_block_rules;
create trigger desk_block_rules_touch
  before update on desk_block_rules
  for each row execute function desk_block_rules_touch_updated_at();

-- Index GIN pour les futurs query JSONB structured.
create index if not exists desk_block_rules_structured_idx
  on desk_block_rules using gin (rules_structured);

-- Seed : 12 blocs canoniques (cf docs/BLOCK-RULES.md à venir).
-- Les block_key correspondent aux IDs UI / composants existants.
-- Yann pourra remplir librement chaque ligne via /sandbox/admin/block-rules.
insert into desk_block_rules (block_key, rules_raw, rules_structured)
values
  ('hero_kpi',              '', '{}'::jsonb),
  ('chart_hero',            '', '{}'::jsonb),
  ('indicateurs_cles',      '', '{}'::jsonb),
  ('stories_kpi',           '', '{}'::jsonb),
  ('comprendre_societe',    '', '{}'::jsonb),
  ('facteurs_risque',       '', '{}'::jsonb),
  ('gouvernance',           '', '{}'::jsonb),
  ('ai_positioning',        '', '{}'::jsonb),
  ('repartition_ca',        '', '{}'::jsonb),
  ('events_timeline',       '', '{}'::jsonb),
  ('freshness_pill',        '', '{}'::jsonb),
  ('footer_disclaimer',     '', '{}'::jsonb)
on conflict (block_key) do nothing;


-- ============================================================================
-- 20260530_desk_floutage_selections
-- ============================================================================
-- 20260530_desk_floutage_selections.sql
-- Outil sélecteur visuel floutage : Yann surligne au pixel près sur la page
-- GOOGL V1.9.5 les zones à flouter (free tier). Le système stocke chaque
-- rectangle (bounding box + sélecteur DOM associé) pour reconvertir ensuite
-- en règles applicables sur toutes les autres sociétés.
--
-- Workflow :
--   1. Yann ouvre /sandbox/admin/floutage-selector
--   2. Clone visuel COMPLET de /sandbox/v1-9-5/googl chargé dans iframe
--   3. Overlay canvas transparent : drag click → rect avec capture (a) bbox
--      pixels, (b) elementFromPoint DOM (querySelector), (c) texte sélectionné
--   4. Bouton "Valider et Enregistrer" → POST /api/desk-mtk9x4kp/floutage-selections
--   5. Helper applyFloutageRules() utilisé côté free tier sur company-view
--
-- Idempotent : CREATE IF NOT EXISTS, pas de DROP, pas de DELETE.
-- Auth-gate : email Yann uniquement (desk_owner).

create table if not exists desk_floutage_selections (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  created_at timestamptz not null default now(),
  selections jsonb not null default '[]'::jsonb,
  signed_by text not null default 'YANN'
);

create index if not exists desk_floutage_selections_ticker_idx
  on desk_floutage_selections (ticker, created_at desc);

create index if not exists desk_floutage_selections_payload_idx
  on desk_floutage_selections using gin (selections);


-- ============================================================================
-- 20260601_block_rules_apply
-- ============================================================================
-- 20260601_block_rules_apply.sql
-- Ajoute le tracking des "Appliquer maintenant à tout l'univers" sur les règles de bloc.
--
-- Yann (1er juin 2026) : sur la page admin /sandbox/admin/block-rules, ajout
-- d'un bouton pour appliquer les règles à toutes les stés V1.9.5. Chaque règle
-- garde la date de dernière application + le report (modifs faites).
--
-- Idempotent : IF NOT EXISTS.

alter table desk_block_rules
  add column if not exists last_applied_at timestamptz;

alter table desk_block_rules
  add column if not exists last_apply_report jsonb;

-- Table jobs : 1 ligne par run "Appliquer maintenant".
create table if not exists desk_block_rules_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending','running','done','error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  report jsonb not null default '{}'::jsonb,
  error_message text
);

create index if not exists desk_block_rules_jobs_status_idx
  on desk_block_rules_jobs (status, started_at desc);


-- ============================================================================
-- Hero KPI overrides : re-migrate 5 existing choices into niveau 1
-- ============================================================================

-- ============================================================================
-- Hero KPI overrides : 5 choix Yann à re-migrer dans niveau 1
-- (déjà présents dans niveau 0 via migration filesystem du 5 juin)
-- ============================================================================
insert into desk_hero_kpi_overrides (ticker, hero_kpi_short, updated_by) values
  ('ADBE', 'Digital Media Revenue',              'migration-niveau1-bundle'),
  ('ADI',  'Industrial Revenue',                 'migration-niveau1-bundle'),
  ('ADP',  'Employer Services Revenue',          'migration-niveau1-bundle'),
  ('AMD',  'Data Center Revenue',                'migration-niveau1-bundle'),
  ('DD',   'Electronics & Industrial Net Sales', 'migration-niveau1-bundle')
on conflict (ticker) do update
  set hero_kpi_short = excluded.hero_kpi_short, updated_at = now();
