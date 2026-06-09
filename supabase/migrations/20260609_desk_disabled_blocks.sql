-- 20260609_desk_disabled_blocks.sql
-- Toggle ON/OFF des blocs page societe, persiste en Supabase (writable en prod
-- contrairement aux fichiers JSON: le disque Vercel est read-only -> fs.writeFile
-- plantait en 500 sur /admin/blocks). Meme raison que la migration hero overrides.
--
-- scope = '__global__'  -> blocs desactives globalement (toutes stes)
-- scope = '<TICKER>'    -> blocs desactives UNIQUEMENT pour cette ste (majuscules)
-- blocks = tableau JSON des cles de bloc desactivees (ex ["gouvernance","events"]).
--
-- Idempotent: CREATE IF NOT EXISTS, pas de DROP TABLE, pas de DELETE.
-- Auth: table admin, RLS service_role uniquement (ecrit via admin client server-side).

create table if not exists desk_disabled_blocks (
  scope text primary key,
  blocks jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function desk_disabled_blocks_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists desk_disabled_blocks_touch_trg on desk_disabled_blocks;
create trigger desk_disabled_blocks_touch_trg
  before update on desk_disabled_blocks
  for each row execute function desk_disabled_blocks_touch();

alter table desk_disabled_blocks enable row level security;

drop policy if exists "service role all desk_disabled_blocks" on desk_disabled_blocks;
create policy "service role all desk_disabled_blocks"
  on desk_disabled_blocks for all using (auth.role() = 'service_role');
