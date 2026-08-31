-- Telemetrie premiere partie Mettrik (Yann 31 aout 2026).
-- Un evenement par ligne : page vue, clic, erreur, appel API, email.
-- Aucune politique publique : seul le service role (API serveur) lit et ecrit.

create table if not exists public.telemetrie_evenements (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  -- page | clic | erreur | api | scroll | perf | email | serveur
  type text not null,
  -- nom court de l evenement (ex : "vue", "export_png", "email.opened")
  nom text not null,
  session_id text,
  user_id uuid,
  chemin text,
  referrer text,
  pays text,
  appareil text,      -- mobile | tablette | ordinateur
  navigateur text,
  os text,
  ecran text,         -- ex : 1920x1080
  langue text,
  duree_ms integer,   -- duree de vue, latence API...
  ip_hash text,       -- sha256 sale, jamais l IP en clair
  props jsonb not null default '{}'::jsonb
);

create index if not exists telemetrie_ts_idx on public.telemetrie_evenements (ts desc);
create index if not exists telemetrie_type_ts_idx on public.telemetrie_evenements (type, ts desc);
create index if not exists telemetrie_session_idx on public.telemetrie_evenements (session_id);
create index if not exists telemetrie_user_idx on public.telemetrie_evenements (user_id) where user_id is not null;

alter table public.telemetrie_evenements enable row level security;
-- Pas de policy : anon et authenticated ne voient rien, service role passe outre.

comment on table public.telemetrie_evenements is
  'Telemetrie premiere partie Mettrik. Ecrite par /api/telemetrie et /api/webhooks/resend, lue par /sandbox/telemetrie. IP jamais stockee en clair.';
