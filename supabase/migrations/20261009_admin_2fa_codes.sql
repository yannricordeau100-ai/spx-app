-- 9 oct 2026 : seconde verification des comptes admin (code a 6 chiffres
-- envoye par e-mail avant l entree dans l outillage des preversions).
-- Le code n est JAMAIS stocke en clair : HMAC-SHA256 (secret ADMIN_2FA_SECRET).
-- RLS activee SANS politique : seule la cle service (routes serveur) lit/ecrit.
-- Idempotent.
create table if not exists public.admin_2fa_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  code_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  attempts integer not null default 0,
  used_at timestamptz
);
create index if not exists admin_2fa_codes_user_created_idx
  on public.admin_2fa_codes (user_id, created_at desc);
alter table public.admin_2fa_codes enable row level security;
revoke all on public.admin_2fa_codes from anon, authenticated;
