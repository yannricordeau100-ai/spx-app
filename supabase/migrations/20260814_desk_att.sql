-- ATT (anti-theses d'investissement) : overrides editables depuis le desk
create table if not exists public.desk_att (
  ticker text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.desk_att enable row level security;
