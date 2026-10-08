-- 8 oct 2026 : audit des fuites publiques (lignes 1 a 5 du rapport).
-- La cle anonyme est publiee dans le JS du site (c est normal) : tout ce que
-- les regles d acces (RLS) laissent lire avec elle est lisible par n importe qui.
-- Toutes les lectures de ces tables passent par des routes serveur qui
-- utilisent la cle service (verifie le 8 oct 2026), la fermeture ne casse rien.
-- Idempotent : peut etre rejouee sans effet de bord.

-- 1. Codes promo : la validation se fait dans /api/billing/checkout (cle service).
drop policy if exists "public lookup active promo by code" on public.pricing_promo_codes;

-- 2 et 3. Contenus du back-office (journal des courriels, alertes, veille des
-- indices, reglages, unites...). Lus uniquement cote serveur avec la cle service.
drop policy if exists "public read active page content" on public.desk_page_content;

-- 4. Univers complet et societes masquees.
drop policy if exists "desk_curated_companies_read" on public.desk_curated_companies;

-- 5. Parrainage : lu par /parrainage et /api/referrals avec la cle service.
drop policy if exists "settings_read_all" on public.desk_referral_settings;

-- 5bis. Ateliers verrouilles et support client : RLS etait DESACTIVEE, la cle
-- anonyme pouvait lire ET ecrire. Activation sans politique = service_role seul.
alter table public.desk_kpi_non_financiers enable row level security;
alter table public.desk_kpi_pistes enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

-- Tables vides ou lues seulement par le serveur : plus de lecture anonyme.
drop policy if exists "public read current live release" on public.desk_releases;
drop policy if exists "companies_v2_public_read" on public.companies_v2;
drop policy if exists "companies_v2_i18n_public_read" on public.companies_v2_i18n;

-- Garde-fou permanent : toute table du schema public sans RLS est signalee
-- par scripts/verif-release.py (bloc fuites publiques).
