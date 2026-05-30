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
