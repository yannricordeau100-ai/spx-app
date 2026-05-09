-- 20260508_pricing_admin.sql
-- Schéma back-office pricing complet (Yann 8 mai 2026).
--
-- Objectifs :
--   - CRUD plans avec multi-devises (EUR, USD, GBP, CHF, SEK, DKK, CAD)
--   - Tarification mensuelle + annuelle avec % réduction réglable
--   - Activation / désactivation par plan
--   - Toggle "recommandé" (highlight) sur n'importe quel plan
--   - Codes promo avec règles complètes (usage, montant, durée, max usages)
--   - Catalogue features partagé pour copie inter-plans
--   - Audit log toutes modifications

-- ─── Plans ─────────────────────────────────────────────────────────────
create table if not exists pricing_plans (
  id uuid primary key default gen_random_uuid(),
  -- Identifiant interne stable (utilisé par le code Stripe sync)
  code text not null unique,            -- ex "free", "investisseur", "pro_plus"
  -- Display
  name_fr text not null,
  name_en text,
  name_de text,
  tagline_fr text,
  tagline_en text,
  tagline_de text,
  audience_fr text,
  audience_en text,
  audience_de text,
  cta_label_fr text,
  cta_label_en text,
  cta_label_de text,
  -- Tier metadata
  tier_order integer not null default 0,         -- 0 = gratuit, 1, 2, 3
  accent_color text default '#a78bfa',
  is_highlight boolean not null default false,   -- "Recommandé"
  is_active boolean not null default true,       -- activable / désactivable
  -- API plan ?
  is_api_only boolean not null default false,
  api_contact_email text,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id)
);

create index if not exists pricing_plans_active_idx on pricing_plans (is_active, tier_order);

-- ─── Prix par devise & fréquence ───────────────────────────────────────
create table if not exists pricing_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references pricing_plans (id) on delete cascade,
  currency text not null,                        -- "EUR", "USD", "GBP", ...
  frequency text not null check (frequency in ('monthly', 'annual')),
  -- Montant en unité de la devise (ex EUR 24.90)
  amount_decimal numeric(10, 2) not null,
  -- Pourcentage de réduction sur l'annuel par rapport au mensuel × 12
  -- (utilisé seulement si frequency='annual', informationnel)
  annual_discount_pct numeric(5, 2),
  -- Stripe price_id (rempli après sync via /api/billing/admin/stripe-sync)
  stripe_price_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, currency, frequency)
);

create index if not exists pricing_prices_plan_idx on pricing_prices (plan_id, is_active);

-- ─── Catalogue de features réutilisables ───────────────────────────────
create table if not exists pricing_features (
  id uuid primary key default gen_random_uuid(),
  -- Identifiant stable pour code (ex "stes_count", "alerts_email")
  code text not null unique,
  -- Catégorie pour grouper visuellement (ex "Analyse", "Suivi")
  category text not null,
  category_order integer not null default 0,
  feature_order integer not null default 0,
  -- Display label
  label_fr text not null,
  label_en text,
  label_de text,
  -- Tooltip d'aide (3-4 lignes)
  help_fr text,
  help_en text,
  help_de text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pricing_features_active_idx on pricing_features (is_active, category_order, feature_order);

-- ─── Mapping plan × feature (valeur par plan) ──────────────────────────
-- Pour chaque feature, définir la valeur affichée par plan : booléen
-- (✓ ou —) ou texte ("3 max", "Illimité", etc.). Permet de copier la
-- valeur d'un plan vers un autre via simple INSERT.
create table if not exists pricing_plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references pricing_plans (id) on delete cascade,
  feature_id uuid not null references pricing_features (id) on delete cascade,
  -- "true" = check vert, "false" = lock gris, autre = texte affiché
  value_fr text not null,
  value_en text,
  value_de text,
  -- Override couleur ponctuelle (sinon = accent du plan)
  highlight_color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, feature_id)
);

-- ─── Codes promo ───────────────────────────────────────────────────────
create table if not exists pricing_promo_codes (
  id uuid primary key default gen_random_uuid(),
  -- Code visible utilisateur (UPPER recommandé)
  code text not null unique,
  -- Display interne
  internal_label text,                           -- "Black Friday 2026", "Influenceur X"
  -- Type de réduction
  discount_type text not null check (discount_type in ('percent', 'amount')),
  discount_percent numeric(5, 2),                -- si type='percent' (10 = 10 %)
  discount_amount_decimal numeric(10, 2),        -- si type='amount'
  discount_currency text,                        -- si type='amount' (EUR, USD…)
  -- Règles d'usage
  max_redemptions integer,                       -- null = illimité
  redemptions_count integer not null default 0,
  max_per_user integer not null default 1,       -- limite par utilisateur
  -- Durée
  starts_at timestamptz,
  expires_at timestamptz,
  -- Première facture seulement / récurrent
  recurring boolean not null default false,
  -- Plans ciblés (null = tous, sinon array d'ids)
  applicable_plan_codes text[] default null,
  -- Devises ciblées (null = toutes)
  applicable_currencies text[] default null,
  -- Fréquence ciblée (null = toutes, ex "annual" only)
  applicable_frequency text,
  -- Première inscription / clients existants
  new_customers_only boolean not null default false,
  -- Activable / désactivable
  is_active boolean not null default true,
  -- Stripe coupon_id (sync optionnel)
  stripe_coupon_id text,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create index if not exists pricing_promo_codes_active_idx on pricing_promo_codes (is_active, code);

-- ─── Trace des utilisations de codes promo ────────────────────────────
create table if not exists pricing_promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_id uuid not null references pricing_promo_codes (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  user_email text,
  applied_to_subscription text,                  -- Stripe subscription_id
  amount_saved_decimal numeric(10, 2),
  amount_saved_currency text,
  redeemed_at timestamptz not null default now()
);

create index if not exists pricing_promo_redemptions_user_idx on pricing_promo_redemptions (user_id, promo_id);

-- ─── RLS — desk owner only en write, lecture publique pour pricing actif
alter table pricing_plans enable row level security;
alter table pricing_prices enable row level security;
alter table pricing_features enable row level security;
alter table pricing_plan_features enable row level security;
alter table pricing_promo_codes enable row level security;
alter table pricing_promo_redemptions enable row level security;

-- Lecture publique des plans / prix / features ACTIFS uniquement
create policy "public read active plans"
  on pricing_plans for select
  using (is_active = true);

create policy "public read active prices"
  on pricing_prices for select
  using (is_active = true);

create policy "public read active features"
  on pricing_features for select
  using (is_active = true);

create policy "public read active plan_features"
  on pricing_plan_features for select
  using (is_active = true);

-- Promo code : lookup par code possible (pour validation côté client)
create policy "public lookup active promo by code"
  on pricing_promo_codes for select
  using (is_active = true and (expires_at is null or expires_at > now()));

-- Redemptions : user voit ses propres
create policy "user reads own redemptions"
  on pricing_promo_redemptions for select
  using (user_id = (select auth.uid()));

-- Write : desk owner uniquement (auth.users.email = DESK_OWNER_EMAIL).
-- En pratique on contrôle côté API via requireDeskOwner(), donc ici
-- on bloque tout write côté Supabase pour les autres rôles.
create policy "service role write plans"
  on pricing_plans for all
  using (auth.role() = 'service_role');

create policy "service role write prices"
  on pricing_prices for all
  using (auth.role() = 'service_role');

create policy "service role write features"
  on pricing_features for all
  using (auth.role() = 'service_role');

create policy "service role write plan_features"
  on pricing_plan_features for all
  using (auth.role() = 'service_role');

create policy "service role write promo_codes"
  on pricing_promo_codes for all
  using (auth.role() = 'service_role');

create policy "service role write redemptions"
  on pricing_promo_redemptions for all
  using (auth.role() = 'service_role');

-- ─── Updated_at triggers ──────────────────────────────────────────────
create or replace function tg_set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger pricing_plans_updated before update on pricing_plans
  for each row execute function tg_set_updated_at();
create trigger pricing_prices_updated before update on pricing_prices
  for each row execute function tg_set_updated_at();
create trigger pricing_features_updated before update on pricing_features
  for each row execute function tg_set_updated_at();
create trigger pricing_plan_features_updated before update on pricing_plan_features
  for each row execute function tg_set_updated_at();
create trigger pricing_promo_codes_updated before update on pricing_promo_codes
  for each row execute function tg_set_updated_at();

-- ─── Seed initial : 3 plans (Découverte / Investisseur / Pro+) ────────
insert into pricing_plans (code, name_fr, name_en, name_de, tagline_fr, tagline_en, tier_order, accent_color, is_highlight, is_active)
values
  ('decouverte', 'Découverte', 'Discovery', 'Entdeckung',
   'Teste la profondeur de Mettrik sur les 2 GAFA les plus suivies.',
   'Test the depth of Mettrik on the 2 most-followed GAFA.',
   0, '#71717a', false, true),
  ('investisseur', 'Investisseur', 'Investor', 'Anleger',
   'L''essentiel pour suivre ton portefeuille au quotidien.',
   'The essentials to track your portfolio daily.',
   1, '#a78bfa', true, true),
  ('pro_plus', 'Pro+', 'Pro+', 'Pro+',
   'Outils avancés pour family offices, conseillers et fonds.',
   'Advanced tools for family offices, advisors and funds.',
   2, '#22d3ee', false, true)
on conflict (code) do nothing;
