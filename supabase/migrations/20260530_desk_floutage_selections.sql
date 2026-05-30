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
