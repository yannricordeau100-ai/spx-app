-- ============================================================
-- METTRIK NIVEAU 1 — toutes les migrations Supabase concaténées
-- Yann 18 mai 2026, bascule niveau 1
-- À coller TEL QUEL dans le SQL Editor du projet Supabase niveau 1
-- (https://supabase.com/dashboard/project/idpsbtgvuyfwtvzelogw/sql/new)
-- ============================================================


-- ==============================
-- 20251127_desk_and_billing.sql
-- ==============================
-- ============================================================================
-- Desk + Billing migration
-- ============================================================================
-- À lancer manuellement depuis le Supabase Dashboard :
--   1. Va sur https://supabase.com/dashboard/project/<TON_PROJECT_ID>/sql
--   2. Colle ce fichier dans l'éditeur SQL
--   3. Click "Run"
--   4. Vérifie que toutes les tables sont créées dans Database → Tables
--
-- Tables créées (toutes nouvelles, n'altère rien d'existant) :
--   - desk_notes        : notes markdown internes
--   - desk_todos        : to-do list interne
--   - desk_bookmarks    : liens utiles taggés
--   - desk_calendar     : événements (résultats, AGM, etc.)
--   - desk_ideas        : carnet d'idées Mettrik
--   - desk_links        : quick links (Stripe, Supabase, GitHub, etc.)
--   - desk_drafts       : brouillons newsletters / posts
--   - desk_pitch_notes  : mémo pitch / fundraising (cloisonné)
--   - desk_inspiration  : galerie inspirations (URLs + commentaires)
--   - desk_pipeline     : statut sociétés à scraper en V2
--   - subscriptions     : abonnements Stripe par user
--   - billing_events    : log brut des webhooks Stripe (audit + replay)
--
-- Toutes les tables desk_* sont protégées par RLS : seul le owner_email
-- (= ton email) y a accès.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- DESK NOTES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.desk_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL,
  title       text NOT NULL,
  body        text NOT NULL DEFAULT '',
  tags        text[] DEFAULT '{}',
  pinned      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS desk_notes_owner_idx ON public.desk_notes (owner_email, updated_at DESC);

-- ----------------------------------------------------------------------------
-- DESK TODOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.desk_todos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL,
  title       text NOT NULL,
  done        boolean NOT NULL DEFAULT false,
  priority    text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  project     text DEFAULT NULL,
  due_at      timestamptz DEFAULT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS desk_todos_owner_idx ON public.desk_todos (owner_email, done, priority DESC);

-- ----------------------------------------------------------------------------
-- DESK BOOKMARKS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.desk_bookmarks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL,
  title       text NOT NULL,
  url         text NOT NULL,
  description text DEFAULT '',
  category    text DEFAULT 'general',
  tags        text[] DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- DESK CALENDAR
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.desk_calendar (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL,
  title       text NOT NULL,
  description text DEFAULT '',
  category    text NOT NULL DEFAULT 'general' CHECK (category IN ('earnings', 'agm', 'conference', 'product', 'general')),
  ticker      text DEFAULT NULL,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz DEFAULT NULL,
  url         text DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS desk_calendar_when_idx ON public.desk_calendar (owner_email, starts_at);

-- ----------------------------------------------------------------------------
-- DESK IDEAS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.desk_ideas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL,
  title       text NOT NULL,
  body        text DEFAULT '',
  category    text DEFAULT 'product' CHECK (category IN ('product', 'design', 'business', 'tech', 'marketing', 'other')),
  status      text DEFAULT 'idea' CHECK (status IN ('idea', 'shortlist', 'doing', 'done', 'rejected')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- DESK LINKS (quick links)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.desk_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL,
  label       text NOT NULL,
  url         text NOT NULL,
  icon        text DEFAULT 'link',
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- DESK DRAFTS (com)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.desk_drafts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL,
  title       text NOT NULL,
  body        text DEFAULT '',
  channel     text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'newsletter', 'linkedin', 'twitter', 'blog', 'other')),
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- DESK PITCH NOTES (cloisonné, sensible)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.desk_pitch_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL,
  title       text NOT NULL,
  body        text DEFAULT '',
  audience    text DEFAULT '',
  status      text DEFAULT 'draft',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- DESK INSPIRATION (galerie URLs / screenshots)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.desk_inspiration (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL,
  title       text NOT NULL,
  url         text DEFAULT '',
  image_url   text DEFAULT '',
  category    text DEFAULT 'design',
  notes       text DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- DESK PIPELINE (sociétés à scraper en V2 — placeholder)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.desk_pipeline (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker          text NOT NULL,
  name            text NOT NULL,
  region          text NOT NULL CHECK (region IN ('US', 'CA', 'EU', 'JP')),
  market_cap_b    numeric DEFAULT NULL,
  status          text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'scraping', 'extracted', 'validated', 'published', 'rejected')),
  source_url      text DEFAULT '',
  notes           text DEFAULT '',
  added_at        timestamptz NOT NULL DEFAULT now(),
  last_status_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS desk_pipeline_region_idx ON public.desk_pipeline (region, status);
CREATE UNIQUE INDEX IF NOT EXISTS desk_pipeline_ticker_uq ON public.desk_pipeline (ticker);

-- ============================================================================
-- BILLING TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SUBSCRIPTIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email                    text NOT NULL,
  stripe_customer_id       text DEFAULT NULL,
  stripe_subscription_id   text DEFAULT NULL,
  stripe_price_id          text DEFAULT NULL,
  plan                     text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium_monthly', 'premium_yearly', 'enterprise')),
  status                   text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'paused')),
  currency                 text NOT NULL DEFAULT 'EUR',
  current_period_end       timestamptz DEFAULT NULL,
  cancel_at_period_end     boolean NOT NULL DEFAULT false,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_uq ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_idx ON public.subscriptions (stripe_customer_id);

-- ----------------------------------------------------------------------------
-- BILLING EVENTS (audit / replay)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  type            text NOT NULL,
  payload         jsonb NOT NULL,
  processed_ok    boolean NOT NULL DEFAULT false,
  error           text DEFAULT NULL,
  received_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_events_type_idx ON public.billing_events (type, received_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Desk tables : seul le owner_email match l'email du JWT supabase
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'desk_notes', 'desk_todos', 'desk_bookmarks', 'desk_calendar',
    'desk_ideas', 'desk_links', 'desk_drafts', 'desk_pitch_notes',
    'desk_inspiration', 'desk_pipeline'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

    -- policy "owner can do anything"
    EXECUTE format($p$
      CREATE POLICY %I ON public.%I
      FOR ALL TO authenticated
      USING ((auth.jwt() ->> 'email') = owner_email)
      WITH CHECK ((auth.jwt() ->> 'email') = owner_email);
    $p$, t || '_owner_policy', t);
  END LOOP;

  -- desk_pipeline n'a pas owner_email (table partagée pour pipeline V2)
  -- on l'autorise en lecture pour tous les authentifiés, en écriture pour
  -- l'admin uniquement (via service role key côté serveur).
  EXECUTE 'DROP POLICY IF EXISTS desk_pipeline_owner_policy ON public.desk_pipeline';
  EXECUTE 'CREATE POLICY desk_pipeline_read ON public.desk_pipeline FOR SELECT TO authenticated USING (true)';
EXCEPTION WHEN duplicate_object THEN
  -- policies déjà créées, on ignore
  NULL;
END $$;

-- Subscriptions : RLS — un user voit uniquement la sienne
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY subscriptions_self_read ON public.subscriptions
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Insert/update par service role (webhook Stripe), pas par les users
DO $$ BEGIN
  CREATE POLICY subscriptions_service_write ON public.subscriptions
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Billing events : table de log, pas accessible aux users authentifiés
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY billing_events_service_only ON public.billing_events
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- TRIGGERS : updated_at automatique
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['desk_notes', 'desk_todos', 'desk_drafts', 'desk_pitch_notes', 'subscriptions'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER %I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

-- ============================================================================
-- DONE
-- ============================================================================
-- Vérification finale (lance cette ligne après et tu devrais voir 12 tables) :
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name LIKE 'desk_%' OR table_name IN ('subscriptions', 'billing_events');


-- ==============================
-- 20260430_todo_categories.sql
-- ==============================
-- ============================================================================
-- Refonte des catégories de to-do du desk
-- ============================================================================
-- Avant : low / normal / high / urgent (priorité générique)
-- Après : urgent / v2 / v3 / idea (catégories projet "dossiers")
--
-- À lancer manuellement depuis Supabase Dashboard → SQL Editor :
--   1. Colle ce fichier dans une "New query"
--   2. Click "Run"
--   3. Vérifie qu'aucune erreur ne remonte
-- ============================================================================

-- 1. Migrer les anciennes valeurs vers les nouvelles
--    Mapping :
--      'urgent' → 'urgent' (inchangé)
--      'high'   → 'v2'
--      'normal' → 'v3'
--      'low'    → 'idea'
UPDATE public.desk_todos
SET priority = CASE priority
  WHEN 'urgent' THEN 'urgent'
  WHEN 'high'   THEN 'v2'
  WHEN 'normal' THEN 'v3'
  WHEN 'low'    THEN 'idea'
  ELSE 'v3'
END;

-- 2. Drop la contrainte CHECK existante
ALTER TABLE public.desk_todos
  DROP CONSTRAINT IF EXISTS desk_todos_priority_check;

-- 3. Recréer avec les 4 nouvelles valeurs
ALTER TABLE public.desk_todos
  ADD CONSTRAINT desk_todos_priority_check
  CHECK (priority IN ('urgent', 'v2', 'v3', 'idea'));

-- 4. Changer le default
ALTER TABLE public.desk_todos
  ALTER COLUMN priority SET DEFAULT 'v3';

-- ============================================================================
-- DONE — vérification :
--   SELECT priority, count(*) FROM public.desk_todos GROUP BY priority;
-- ============================================================================


-- ==============================
-- 20260502_todo_5th_category.sql
-- ==============================
-- =============================================================================
-- Add 5th to-do category : 'extra'
-- =============================================================================
-- Étend la contrainte CHECK du champ priority pour accepter une 5e valeur.
-- Aucune perte de données : seul un constraint est remplacé.
-- À lancer dans Supabase Dashboard -> SQL Editor.
-- =============================================================================

ALTER TABLE public.desk_todos
  DROP CONSTRAINT IF EXISTS desk_todos_priority_check;

ALTER TABLE public.desk_todos
  ADD CONSTRAINT desk_todos_priority_check
  CHECK (priority IN ('low', 'normal', 'high', 'urgent', 'extra'));

-- Vérification :
-- SELECT priority, count(*) FROM public.desk_todos GROUP BY priority;


-- ==============================
-- 20260503_contact_messages.sql
-- ==============================
-- =============================================================================
-- Contact messages : formulaire de contact + back office
-- =============================================================================
-- Table additive uniquement. Aucune perte de données existantes.
-- À lancer dans Supabase Dashboard -> SQL Editor.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.desk_contact_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient       text NOT NULL CHECK (recipient IN ('contact', 'support')),
  sender_name     text NOT NULL,
  sender_email    text NOT NULL,
  subject         text NOT NULL,
  body            text NOT NULL,
  source_locale   text DEFAULT NULL,                  -- locale détectée à l'envoi
  source_ip       text DEFAULT NULL,                  -- IP brute (RGPD : suppr 90j)
  user_agent      text DEFAULT NULL,
  status          text NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'read', 'replied', 'archived', 'spam')),
  read_at         timestamptz DEFAULT NULL,
  replied_at      timestamptz DEFAULT NULL,
  notes           text DEFAULT NULL,                  -- notes internes (back office)
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS desk_contact_messages_status_idx ON public.desk_contact_messages (status, created_at DESC);
CREATE INDEX IF NOT EXISTS desk_contact_messages_email_idx  ON public.desk_contact_messages (sender_email);

-- RLS : INSERT public (anyone can submit), READ owner-only via service role
ALTER TABLE public.desk_contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_insert_public" ON public.desk_contact_messages;
CREATE POLICY "contact_insert_public" ON public.desk_contact_messages
  FOR INSERT WITH CHECK (true);

-- READ : seul le owner_email du desk (passé via service_role + check API route)
-- Donc pas de policy READ ici, géré côté API.


-- ==============================
-- 20260503_referrals.sql
-- ==============================
-- =============================================================================
-- Referrals (parrainage)
-- =============================================================================
-- Système : un user payant ("referrer") génère un code unique. Un nouveau user
-- ("referee") s'inscrit avec ce code. Quand il souscrit un plan payant,
-- les 2 reçoivent 1 mois gratuit (à appliquer côté Stripe quand actif).
--
-- Tables additives uniquement. Aucune perte de données existantes.
-- À lancer dans Supabase Dashboard -> SQL Editor.
-- =============================================================================

-- 1. Table desk_referral_settings : config globale du programme (1 row max)
CREATE TABLE IF NOT EXISTS public.desk_referral_settings (
  id              integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled         boolean NOT NULL DEFAULT true,
  reward_months   integer NOT NULL DEFAULT 1 CHECK (reward_months > 0 AND reward_months <= 12),
  required_plan   text NOT NULL DEFAULT 'any_paid' CHECK (required_plan IN ('any_paid', 'monthly_only', 'annual_only')),
  max_referees_per_user integer NOT NULL DEFAULT 50 CHECK (max_referees_per_user > 0),
  code_validity_days   integer NOT NULL DEFAULT 90 CHECK (code_validity_days > 0),
  banner_text_fr  text NOT NULL DEFAULT 'Parrainez un proche, vous gagnez 1 mois offert chacun.',
  banner_text_en  text NOT NULL DEFAULT 'Invite a friend, both get 1 month free.',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text DEFAULT NULL
);

-- Bootstrap row par défaut (idempotent)
INSERT INTO public.desk_referral_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 2. Table desk_referrals : un row par lien de parrainage généré
CREATE TABLE IF NOT EXISTS public.desk_referrals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_email  text NOT NULL,                  -- celui qui invite
  referee_email   text DEFAULT NULL,              -- celui qui s'inscrit (rempli après inscription)
  code            text NOT NULL UNIQUE,           -- code court visible dans l'URL (ex: "MTK-XYZ123")
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'signed_up', 'subscribed', 'rewarded', 'expired', 'invalid')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  signed_up_at    timestamptz DEFAULT NULL,       -- inscription du referee
  subscribed_at   timestamptz DEFAULT NULL,       -- souscription plan payant referee
  rewarded_at     timestamptz DEFAULT NULL,       -- les 2 mois offerts appliqués
  expires_at      timestamptz NOT NULL,
  reward_applied_referrer  boolean NOT NULL DEFAULT false,
  reward_applied_referee   boolean NOT NULL DEFAULT false,
  notes           text DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS desk_referrals_referrer_idx ON public.desk_referrals (referrer_email, created_at DESC);
CREATE INDEX IF NOT EXISTS desk_referrals_code_idx ON public.desk_referrals (code);
CREATE INDEX IF NOT EXISTS desk_referrals_status_idx ON public.desk_referrals (status);

-- 3. RLS : settings = lecture libre (public banner), écriture owner_email match
ALTER TABLE public.desk_referral_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desk_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_read_all" ON public.desk_referral_settings;
CREATE POLICY "settings_read_all" ON public.desk_referral_settings FOR SELECT USING (true);

-- Pour referrals : un user voit ses propres referrals (referrer ou referee)
DROP POLICY IF EXISTS "referrals_read_own" ON public.desk_referrals;
CREATE POLICY "referrals_read_own" ON public.desk_referrals
  FOR SELECT USING (
    auth.jwt()->>'email' = referrer_email
    OR auth.jwt()->>'email' = referee_email
  );

-- INSERT : le referrer crée son code (auth.email = referrer_email)
DROP POLICY IF EXISTS "referrals_insert_own" ON public.desk_referrals;
CREATE POLICY "referrals_insert_own" ON public.desk_referrals
  FOR INSERT WITH CHECK (auth.jwt()->>'email' = referrer_email);

-- (UPDATE/DELETE non autorisés en RLS, doivent passer par les API routes
-- avec service_role pour valider le claim)


-- ==============================
-- 20260504_companies_v2_table.sql
-- ==============================
-- ============================================================================
-- Migration : table `companies_v2` pour la version 2.0 (6000 stés cible).
-- Date : 4 mai 2026 (préparation, à appliquer quand on bascule fichiers → DB).
--
-- Contexte :
--   En 1.x les datasets sociétés vivent dans des fichiers JSON locaux
--   (`src/data/v2-pipeline/<ticker>.json` pour le pipeline, `src/data/<ticker>.json`
--   pour les 5 V1 handcrafted). À 1606 stés on s'en sort, à 6000+ le bundle
--   Vercel deviendrait trop lourd et le build trop lent. La 2.0 bascule sur
--   Supabase Postgres.
--
--   Cette table stocke chaque sté dans une seule ligne JSONB pour rester
--   flexible (le schéma de Company évolue souvent : ajout de champs Pass 2/3,
--   transcripts, ESG, etc.). On indexe les champs hot-path (ticker, sector,
--   validated, kpis_count) pour les filtres de browse + search.
--
-- Pré-requis avant apply :
--   - Aucun. La table n'existe pas, pas de risque de perte de données.
--
-- Rollback :
--   DROP TABLE companies_v2 CASCADE;
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.companies_v2 (
  -- Clé primaire = ticker upper-case (AAPL, GOOGL, etc.)
  ticker TEXT PRIMARY KEY,

  -- Nom commercial de la sté.
  name TEXT NOT NULL,

  -- Secteur GICS niveau 1 (ex : Information Technology).
  sector TEXT,

  -- Sous-secteur GICS niveau 2 ou industrie spécifique (ex : Internet & Search).
  subsector TEXT,

  -- Pays d'origine ISO 3166-1 alpha-2 (US, FR, DE, etc.).
  country TEXT,

  -- Devise du reporting financier (USD, EUR, GBP, etc.).
  currency TEXT,

  -- Stade de validation pipeline :
  --   1 = Pass 1 brute (extraction LLM auto, non vérifiée)
  --   2 = Pass 2 enrichie (risks + governance + AI ajoutés)
  --   3 = Pass 3 validée (Sonnet a relu et corrigé l'extraction)
  validation_pass SMALLINT NOT NULL DEFAULT 1 CHECK (validation_pass BETWEEN 1 AND 3),

  -- Marque "ready for public display" : true uniquement quand Pass 3 ET
  -- aucun champ critique manquant. Mis à jour par script de QC après chaque
  -- pipeline run.
  display_ready BOOLEAN NOT NULL DEFAULT FALSE,

  -- Compteur de KPIs pour filtre rapide "stés avec >= N indicateurs".
  kpis_count INT NOT NULL DEFAULT 0,

  -- Hero KPI choisi (KPI.short, ex : "Cloud", "DAP", "Backlog").
  hero_kpi TEXT,

  -- Date de la dernière mise à jour data côté CONV-DATA pipeline.
  last_pipeline_update TIMESTAMPTZ,

  -- Date de la dernière publication officielle source (10-K, 10-Q, 8-K).
  last_filing_date DATE,

  -- Dataset complet (KPIs, risks, governance, AI positioning, transcripts,
  -- etc.) sérialisé en JSONB. Permet de faire évoluer le schéma sans
  -- migration côté Postgres tant qu'on reste sur les mêmes top-level keys.
  data JSONB NOT NULL,

  -- Métadonnées d'audit.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les requêtes de browse / search V2.
CREATE INDEX IF NOT EXISTS idx_companies_v2_sector ON public.companies_v2(sector);
CREATE INDEX IF NOT EXISTS idx_companies_v2_country ON public.companies_v2(country);
CREATE INDEX IF NOT EXISTS idx_companies_v2_display_ready ON public.companies_v2(display_ready) WHERE display_ready = TRUE;
CREATE INDEX IF NOT EXISTS idx_companies_v2_validation_pass ON public.companies_v2(validation_pass);
-- Trigram index pour search par nom (LIKE '%apple%') sans full scan.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_companies_v2_name_trgm ON public.companies_v2 USING gin (name gin_trgm_ops);

-- Trigger pour updated_at automatique.
CREATE OR REPLACE FUNCTION public.set_companies_v2_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_companies_v2_updated_at ON public.companies_v2;
CREATE TRIGGER trg_companies_v2_updated_at
BEFORE UPDATE ON public.companies_v2
FOR EACH ROW EXECUTE FUNCTION public.set_companies_v2_updated_at();

-- ============================================================================
-- Row Level Security : public read seulement sur display_ready=true.
-- Écriture réservée au service role (script CONV-DATA / cron de migration).
-- ============================================================================
ALTER TABLE public.companies_v2 ENABLE ROW LEVEL SECURITY;

-- SELECT : tout visiteur peut lire les stés ready. Les "in-progress" restent
-- invisibles côté API anon pour ne pas exposer du data brut non validé.
DROP POLICY IF EXISTS "companies_v2_public_read" ON public.companies_v2;
CREATE POLICY "companies_v2_public_read"
ON public.companies_v2 FOR SELECT
TO anon, authenticated
USING (display_ready = TRUE);

-- INSERT/UPDATE/DELETE : service role uniquement (bypass RLS automatique).
-- Aucune policy nécessaire pour anon/authenticated → write impossible.

-- ============================================================================
-- Table satellite pour i18n du contenu KPI (description, signal, etc.) par
-- locale. La 2.0 supportera les KPI multi-langues : on extrait la donnée une
-- fois par CONV-DATA (en EN ou FR original), puis on traduit séparément vers
-- DE/NL/SV/DA via Cerebras et on stocke ici. Permet à CONV-DATA de continuer
-- à écraser `data` sans perdre les traductions.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.companies_v2_i18n (
  ticker TEXT NOT NULL REFERENCES public.companies_v2(ticker) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('fr', 'en', 'de', 'nl', 'sv', 'da')),
  -- Contenu localisé : { kpis: [{short, name, description, signal, explanation}], ... }
  -- Mêmes shorts que la version EN/FR primaire pour matching côté front.
  content JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ticker, locale)
);

CREATE INDEX IF NOT EXISTS idx_companies_v2_i18n_locale ON public.companies_v2_i18n(locale);

ALTER TABLE public.companies_v2_i18n ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "companies_v2_i18n_public_read" ON public.companies_v2_i18n;
CREATE POLICY "companies_v2_i18n_public_read"
ON public.companies_v2_i18n FOR SELECT
TO anon, authenticated
USING (TRUE);

-- ============================================================================
-- COMMENT pour documenter les tables (visible dans Supabase Studio).
-- ============================================================================
COMMENT ON TABLE public.companies_v2 IS 'Datasets sociétés version 2.0 (cible 6000 stés). Migré depuis fichiers JSON v2-pipeline/ pour scaler le bundle Vercel.';
COMMENT ON TABLE public.companies_v2_i18n IS 'Traductions par locale du contenu KPI. Préservé entre les rebuilds de CONV-DATA.';


-- ==============================
-- 20260508_pricing_admin.sql
-- ==============================
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


-- ==============================
-- 20260509_data_quality_matrix.sql
-- ==============================
-- 20260509_data_quality_matrix.sql
-- Tableau de vérification visuelle "société × fonctionnalité" pour suivre
-- ce qui est vraiment OK sur le top 305 V1.8.
--
-- Une ligne = un ticket de vérif (ex : NVDA × graph_annual = OK, vérifié
-- par CONV-SYSTEMS le 2026-05-09). On ne stocke ici que les overrides
-- manuels ; le statut "auto-OK" provient des fichiers data au runtime
-- via lib/desk/data-quality-matrix.ts (sans persistance).

create table if not exists desk_verification_matrix (
  id uuid primary key default gen_random_uuid (),
  ticker text not null,
  column_key text not null,
  -- ex 'logo', 'rank', 'graph_annual', 'graph_quarterly',
  --     'hero_interpretation', 'kpi_count', 'risks', 'governance',
  --     'ai_positioning', 'segments', 'geography'
  status text not null check (status in ('verified_ok', 'verified_ko', 'na')),
  verified_by text,
  -- 'CONV-SYSTEMS', 'CONV-CONCEPTS', 'CONV-DATA', 'YANN', etc.
  notes text,
  verified_at timestamptz not null default now (),
  unique (ticker, column_key)
);

create index if not exists desk_verification_matrix_ticker_idx on desk_verification_matrix (ticker);

create index if not exists desk_verification_matrix_column_idx on desk_verification_matrix (column_key, status);

alter table desk_verification_matrix enable row level security;

drop policy if exists "service role write matrix" on desk_verification_matrix;

create policy "service role write matrix" on desk_verification_matrix for all using (auth.role () = 'service_role');


-- ==============================
-- 20260509_desk_bugs.sql
-- ==============================
-- 20260509_desk_bugs.sql
-- Module bug tracker pour le desk-mtk9x4kp (Yann 8 mai 2026, fond du tiroir).
-- MVP : Yann saisit / range / clôt manuellement. Le tracking auto via
-- Sentry-like sera une V2 si besoin.

create table if not exists desk_bugs (
  id uuid primary key default gen_random_uuid(),
  -- Titre court (1 ligne)
  title text not null,
  -- Description longue (markdown autorisé en V2 quand affiché)
  description text,
  -- Sévérité 1 (cosmétique) → 5 (bloquant ship)
  severity smallint not null default 3 check (severity between 1 and 5),
  -- Difficulté de réparation 1 (trivial, < 15 min) → 5 (refonte > 1 j)
  repair_difficulty smallint not null default 3 check (repair_difficulty between 1 and 5),
  -- Status
  status text not null default 'open' check (status in ('open', 'in_progress', 'fixed', 'wont_fix', 'duplicate')),
  -- Étiquettes libres séparées par virgule
  tags text,
  -- Page / module concerné (ex "/sandbox/v1-8/aapl", "pricing-admin")
  area text,
  -- Optionnel : URL de reproduction
  repro_url text,
  -- Quelle conv a soulevé le bug (CONV-SYSTEMS, CONV-DATA, …)
  reported_by_conv text,
  -- Notes de fix (qui, quand, comment) une fois résolu
  resolution_note text,
  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_by uuid references auth.users (id),
  resolved_by uuid references auth.users (id)
);

create index if not exists desk_bugs_status_idx on desk_bugs (status, severity desc, created_at desc);
create index if not exists desk_bugs_area_idx on desk_bugs (area);

alter table desk_bugs enable row level security;

drop policy if exists "service role write bugs" on desk_bugs;
create policy "service role write bugs"
  on desk_bugs for all using (auth.role() = 'service_role');

drop trigger if exists desk_bugs_updated on desk_bugs;
create trigger desk_bugs_updated before update on desk_bugs
  for each row execute function tg_set_updated_at();


-- ==============================
-- 20260509_desk_page_content.sql
-- ==============================
-- 20260509_desk_page_content.sql
-- Yann 8 mai 2026 (édition contenu page contact via desk).
--
-- Permet d'éditer le contenu user-facing de pages clés (contact en
-- premier, extensible aux mentions légales, à propos, etc.) directement
-- depuis le back-office desk-mtk9x4kp/page-content sans recompiler.
--
-- Une ligne = un (page_key, section_key) avec contenu FR/EN/DE.
-- La page lit ce contenu en SSR avec fallback sur les strings hardcodées
-- du dictionary.ts si la BDD est vide ou inaccessible.

create table if not exists desk_page_content (
  id uuid primary key default gen_random_uuid(),
  -- Identifiant logique de la page : "contact", "about", "privacy", etc.
  page_key text not null,
  -- Sous-section dans la page : "title", "intro", "form_intro", etc.
  -- Pour la page contact V1.8, sections seedées : title, subtitle,
  -- recipient_intro, success_intro, privacy_note.
  section_key text not null,
  -- Contenu par langue
  content_fr text not null,
  content_en text,
  content_de text,
  -- Visibilité publique
  is_active boolean not null default true,
  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  unique (page_key, section_key)
);

create index if not exists desk_page_content_page_idx on desk_page_content (page_key, is_active);

-- RLS
alter table desk_page_content enable row level security;

drop policy if exists "public read active page content" on desk_page_content;
create policy "public read active page content"
  on desk_page_content for select using (is_active = true);

drop policy if exists "service role write page content" on desk_page_content;
create policy "service role write page content"
  on desk_page_content for all using (auth.role() = 'service_role');

-- Trigger updated_at (réutilise tg_set_updated_at créé dans
-- 20260508_pricing_admin.sql)
drop trigger if exists desk_page_content_updated on desk_page_content;
create trigger desk_page_content_updated before update on desk_page_content
  for each row execute function tg_set_updated_at();

-- Seed initial : 5 sections clés de la page contact V1.8
insert into desk_page_content (page_key, section_key, content_fr, content_en, content_de, is_active) values
  ('contact','title',
    'Contacte l''équipe',
    'Contact the team',
    'Kontaktiere das Team',
    true),
  ('contact','subtitle',
    'Réponse sous 24 h ouvrées. Choisis la bonne destination ci-dessous.',
    'Reply within 24 business hours. Pick the right destination below.',
    'Antwort innerhalb 24 Werktagsstunden. Wähle das passende Ziel unten.',
    true),
  ('contact','recipient_intro',
    'Question générale, support technique ou demande commerciale Pro+ : on traite chaque type différemment pour aller plus vite.',
    'General question, technical support, or sales inquiry: we handle each type differently to be faster.',
    'Allgemeine Frage, technischer Support oder Vertriebsanfrage Pro+: wir behandeln jeden Typ unterschiedlich für schnellere Antworten.',
    true),
  ('contact','success_intro',
    'Message reçu. On revient vers toi sous 24 h ouvrées sur l''email associé à ton compte.',
    'Message received. We''ll get back to you within 24 business hours at your account email.',
    'Nachricht erhalten. Wir antworten innerhalb 24 Werktagsstunden an die mit deinem Konto verknüpfte E-Mail.',
    true),
  ('contact','privacy_note',
    'Tes données restent privées. Pas de revente, pas de spam marketing. Hébergement européen, RGPD-compliant.',
    'Your data stays private. No reselling, no marketing spam. EU hosting, GDPR-compliant.',
    'Deine Daten bleiben privat. Kein Weiterverkauf, kein Marketing-Spam. EU-Hosting, DSGVO-konform.',
    true)
on conflict (page_key, section_key) do nothing;


-- ==============================
-- 20260509_email_onboarding.sql
-- ==============================
-- 20260509_email_onboarding.sql
-- Email marketing onboarding J+1 / J+3 / J+7 / J+14 / J+25.
-- Une ligne = 1 email planifié pour 1 user. Le cron /api/cron/email-onboarding
-- ramasse les lignes scheduled_for <= now() et sent_at IS NULL puis les envoie.

create table if not exists desk_email_sequences (
  id uuid primary key default gen_random_uuid (),
  user_email text not null,
  user_name text,
  locale text not null default 'fr',
  sequence_key text not null,
  -- 'day1' | 'day3' | 'day7' | 'day14' | 'day25'
  day_offset smallint not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  send_status text,
  -- 'sent' | 'skipped' | 'error:<msg>'
  resend_id text,
  -- ID Resend pour traçabilité
  unsubscribed_at timestamptz,
  -- si user a unsub avant l'envoi, set ici
  created_at timestamptz not null default now (),
  unique (user_email, sequence_key)
);

create index if not exists desk_email_sequences_pending_idx on desk_email_sequences (scheduled_for)
where
  sent_at is null
  and unsubscribed_at is null;

create index if not exists desk_email_sequences_user_idx on desk_email_sequences (user_email);

-- Table opt-out global (un user qui veut couper tout l'onboarding)
create table if not exists desk_email_unsubscribes (
  user_email text primary key,
  unsubscribed_at timestamptz not null default now (),
  reason text
);

-- RLS : tables manipulées uniquement par service role (cron + signup hook).
alter table desk_email_sequences enable row level security;

alter table desk_email_unsubscribes enable row level security;


-- ==============================
-- 20260509_quality_history.sql
-- ==============================
-- 20260509_quality_history.sql
-- Snapshot horaire de la matrice qualité données. Une ligne par
-- (snapshot_at, column_key, section). Permet de tracer l'amélioration
-- globale dans le temps.

create table if not exists desk_quality_history (
  id bigserial primary key,
  snapshot_at timestamptz not null default now(),
  section text not null check (
    section in ('v18_top', 'extra', 'all')
  ),
  -- Section concernée : top 305, extras, ou agrégat global.
  column_key text not null,
  -- Une des 18 colonnes de COLUMN_KEYS (logo, rank, hero_kpi, etc.).
  total smallint not null,
  ok smallint not null default 0,
  -- 🟢 auto_ok + verified_ok confondus
  stale smallint not null default 0,
  -- 🟡 auto_stale (présent mais en retard sur dernier earning/AG)
  partial smallint not null default 0,
  -- 🟠 auto_partial (présent mais incomplet)
  ko smallint not null default 0,
  -- 🔴 auto_ko + verified_ko confondus (manquant)
  na smallint not null default 0,
  -- ⚪ na (sans objet, ex dividende sur sté qui n'en verse pas)
  unique (snapshot_at, section, column_key)
);

create index if not exists desk_quality_history_at_idx on desk_quality_history (snapshot_at desc);

create index if not exists desk_quality_history_col_idx on desk_quality_history (column_key, section, snapshot_at desc);

alter table desk_quality_history enable row level security;

drop policy if exists "service role write history" on desk_quality_history;

create policy "service role write history" on desk_quality_history for all using (auth.role () = 'service_role');


-- ==============================
-- 20260512_ir_sources.sql
-- ==============================
-- 20260512_ir_sources.sql
-- Table des sources IR (Investor Relations) par société.
--
-- Permet à Yann de saisir 1 à N URLs par sté (page corp + page IR home +
-- page IR docs + pages IR docs supplémentaires) puis à un scraper Python
-- (CONV-DATA scope) de télécharger automatiquement tous les docs IR :
-- press releases, audio webcast transcripts, CFO commentary, earning slides.
--
-- Pourquoi cette table : SEC EDGAR n'a que les filings réglementaires
-- (10-K, 10-Q, 8-K, DEF 14A, 20-F). Tous les autres docs (CFO commentary,
-- press releases trimestriels, slides earning call, transcripts) sont
-- UNIQUEMENT publiés sur les pages IR. Pour les stés européennes pures
-- (cat 3 sans ADR), SEC EDGAR n'a même pas les filings principaux.
--
-- Yann remplit les URLs manuellement (ou via auto-discovery futur).
-- Le scraper utilise ces URLs comme point d'entrée pour aspirer les PDFs.

create table if not exists desk_ir_sources (
  ticker text primary key,

  -- URL du site principal de la sté (ex: https://www.nvidia.com)
  home_url text,

  -- URL d'accueil de la section investisseurs (ex: https://investor.nvidia.com)
  -- Souvent différente de la page où sont les docs téléchargeables.
  -- Peut être null si identique à ir_docs_main_url.
  ir_home_url text,

  -- URL principale de la page où sont listés les docs téléchargeables
  -- (ex: https://investor.nvidia.com/financial-info/financial-reports/default.aspx)
  ir_docs_main_url text,

  -- URLs additionnelles si les docs sont éclatés en plusieurs pages
  -- (ex: une page Press Releases, une page Annual Reports, une page Transcripts).
  -- Stocké en JSONB pour flexibilité (array de strings).
  ir_docs_additional_urls jsonb default '[]'::jsonb,

  -- Notes libres (Yann peut commenter, ex "page JS-heavy, scraper Playwright")
  notes text,

  -- Statut global : todo (rien saisi), partial (au moins 1 URL), complete (toutes URLs OK),
  -- verified (Yann a confirmé que toutes les sources nécessaires sont là)
  status text not null default 'todo' check (status in ('todo', 'partial', 'complete', 'verified')),

  -- Types de docs manquants détectés (mis à jour par le scraper).
  -- Valeurs possibles : 'press_releases', 'transcripts', 'cfo_commentary',
  -- 'earning_slides', 'annual_report_pdf', 'esg_report', 'investor_day'.
  missing_docs jsonb default '[]'::jsonb,

  -- Compteurs scraper
  docs_count smallint default 0,
  last_scrape_at timestamptz,
  last_scrape_status text,    -- 'success' / 'partial' / 'error:<msg>'

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists desk_ir_sources_status_idx on desk_ir_sources (status, ticker);
create index if not exists desk_ir_sources_scrape_idx on desk_ir_sources (last_scrape_at desc);

alter table desk_ir_sources enable row level security;

drop policy if exists "service role write ir sources" on desk_ir_sources;
create policy "service role write ir sources" on desk_ir_sources for all using (auth.role() = 'service_role');

drop trigger if exists desk_ir_sources_updated on desk_ir_sources;
create trigger desk_ir_sources_updated before update on desk_ir_sources
  for each row execute function tg_set_updated_at();


-- ==============================
-- 20260513_ir_sources_regulator.sql
-- ==============================
-- 20260513_ir_sources_regulator.sql
-- Ajout colonne regulator_url à desk_ir_sources.
--
-- Pour les sociétés européennes (Stoxx 600, etc.), beaucoup de documents
-- réglementaires (résultats annuels, semestriels, OPA, BALO, etc.) sont
-- déposés auprès du régulateur national plutôt que sur la page IR maison.
-- Exemples par suffixe ticker :
--   .PA → AMF info-financiere.fr
--   .DE → BaFin / Bundesanzeiger
--   .L  → FCA (RNS / LSE national storage mechanism)
--   .SW → SIX Swiss Exchange
--   .MI → CONSOB / Borsa Italiana
--   .MC → CNMV (Spain)
--   .AS → AFM (Netherlands)
--   .BR → FSMA (Belgium)
--   .LS → CMVM (Portugal)
--   .HE → Nasdaq Helsinki
--   .ST → Nasdaq Stockholm
--   .CO → Nasdaq Copenhagen
--   .OL → Oslo Børs / Euronext
-- Cette URL alimente le scraper en source de secours (ou parfois primaire).

alter table desk_ir_sources
  add column if not exists regulator_url text;


-- ==============================
-- 20260514_special_kpis.sql
-- ==============================
-- 20260514_special_kpis.sql
-- KPIs spéciaux nécessitant recherche manuelle (interne 10-K + web) :
-- ex Apple iPhone units vendus, Netflix abonnés, Tesla livraisons par modèle.
-- Yann pilote depuis /sandbox/special-kpis : crée la demande, lance
-- l'extraction (Groq Llama 3.3 70B free, ou Claude conv), valide le rendu
-- en preview, coche "publié" pour les pousser sur les pages société live.

create table if not exists desk_special_kpis (
  id uuid primary key default gen_random_uuid(),

  -- Cible : 1 ticker précis OU une liste de tickers (mode "appliquer à plusieurs")
  ticker text,                                  -- mode mono-sté (NULL si multi)
  target_tickers text[] default '{}'::text[],   -- mode multi-stés
  mode text not null default 'single' check (mode in ('single', 'multi')),

  -- Identité du KPI
  kpi_short text not null,             -- ex "iPhone Units"
  kpi_name_fr text,                    -- ex "Unités iPhone vendues"
  kpi_name_en text,                    -- ex "iPhone units sold"
  kpi_unit text,                       -- ex "M unités"
  kpi_category text default 'Volume',  -- Revenue / Volume / User / Demand / ...

  -- Style et chart
  style text not null default 'classique' check (style in ('classique', 'story')),
  chart_type text not null default 'curve' check (chart_type in ('curve', 'bars', 'variation')),
  story_category text,                 -- si style='story' : Marché / Adoption / Capacité / Innovation

  -- Description de la demande (ce que le LLM doit chercher)
  description text,                    -- prompt user (ce qu'il faut trouver)

  -- Statut workflow
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'done', 'error', 'manual_needed', 'claude_assigned')),
  error_msg text,
  notes text,

  -- Résultat extrait par le LLM
  -- Format : { "values_by_period": [{period, value, uncertainty_pct?, uncertainty_note?, source?}], "hero_summary": "...", "interpretation": "..." }
  data jsonb default '{}'::jsonb,
  data_source text,                    -- ex "10-K FY24 + IDC + Statista"

  -- Trace LLM
  llm_provider text,                   -- 'groq-llama-3.3-70b' / 'claude-conv' / 'external-claude' / 'external-chatgpt'
  llm_prompt text,
  llm_response_raw text,
  llm_at timestamptz,

  -- Publication sur les pages société (cochée par Yann après preview)
  published boolean not null default false,
  published_at timestamptz,
  is_hero boolean not null default false,   -- si publié : remplace le hero KPI ? sinon liste indicateurs clés / stories

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists desk_special_kpis_ticker_idx on desk_special_kpis (ticker);
create index if not exists desk_special_kpis_status_idx on desk_special_kpis (status);
create index if not exists desk_special_kpis_pub_idx on desk_special_kpis (published, ticker);

alter table desk_special_kpis enable row level security;
drop policy if exists "service role write special_kpis" on desk_special_kpis;
create policy "service role write special_kpis" on desk_special_kpis for all using (auth.role() = 'service_role');

drop trigger if exists desk_special_kpis_updated on desk_special_kpis;
create trigger desk_special_kpis_updated before update on desk_special_kpis
  for each row execute function tg_set_updated_at();


-- ==============================
-- 20260515_image_findings.sql
-- ==============================
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


-- ==============================
-- 20260516_image_findings_i18n.sql
-- ==============================
-- 20260516_image_findings_i18n.sql
-- i18n des findings : title + summary (= "bloc lecture") en FR/EN/DE.
-- Yann 16 mai 2026 : "traduit en français, anglais et allemand les titres
-- et le sous bloc 'lecture' de chaque graph".
-- Le merge SSR sur les pages société pickup la valeur selon la locale active.

alter table desk_image_findings
  add column if not exists title_i18n jsonb not null default '{}'::jsonb,
  add column if not exists summary_i18n jsonb not null default '{}'::jsonb;

-- Schema attendu : { "fr": "...", "en": "...", "de": "..." }
-- Helpers (optionnel, géré côté code) :
-- coalesce(title_i18n->>locale, title_i18n->>'fr', title)


-- ==============================
-- 20260516_image_findings_theme_rank.sql
-- ==============================
-- 20260516_image_findings_theme_rank.sql
-- Ajoute support thème dark/light + classement par rank pour
-- desk_image_findings (Yann 16 mai 2026).

alter table desk_image_findings
  -- URL de l'image variante thème sombre (par défaut = image_url existante)
  add column if not exists image_url_dark text,
  -- URL de l'image variante thème clair (re-créée par Claude)
  add column if not exists image_url_light text,
  -- Rank pertinence assigné par Claude lors de l'extraction (1 = top,
  -- 999 = à voir). Utilisé pour filtrer Top 5 / 10 / 20.
  add column if not exists rank smallint default 100,
  -- Note de qualité 1-10 (Claude attribue lors de l'extraction selon
  -- pertinence, fraîcheur, qualité visuelle, autorité de la source).
  add column if not exists quality_score smallint;

-- Backfill : si image_url existait déjà, copie dans image_url_dark
update desk_image_findings
set image_url_dark = image_url
where image_url_dark is null and image_url is not null;

create index if not exists desk_image_findings_rank_idx on desk_image_findings (request_id, rank);


-- ==============================
-- 20260516_special_kpis_i18n.sql
-- ==============================
-- 20260516_special_kpis_i18n.sql
-- Ajoute traductions 8 langues + annotations sur les KPIs spéciaux.
-- Yann 15 mai 2026.

alter table desk_special_kpis
  -- Traductions du nom dans les 8 langues (fr en déjà via kpi_name_fr / kpi_name_en).
  -- Stocké en JSONB unique pour éviter de polluer le schéma de 6 colonnes.
  -- Clés : "fr", "en", "de", "nl", "sv", "da", "en-GB", "de-CH".
  add column if not exists kpi_name_i18n jsonb default '{}'::jsonb,

  -- Traductions du hero_summary (la phrase courte sous le chart)
  add column if not exists hero_summary_i18n jsonb default '{}'::jsonb,

  -- Traductions de l'interprétation (la phrase plus longue)
  add column if not exists interpretation_i18n jsonb default '{}'::jsonb,

  -- Annotations "i" placées sur le chart à des années précises.
  -- Format JSONB :
  -- [
  --   {
  --     "period": "2020" OR "FY20" OR "between:2020-2021",
  --     "title_i18n": {"fr": "Lancement iPhone 12", "en": "iPhone 12 launch", ...},
  --     "text_i18n":  {"fr": "Premier iPhone 5G...", "en": "First 5G iPhone...", ...}
  --   }
  -- ]
  add column if not exists annotations jsonb default '[]'::jsonb;

-- Index light pour la sérialisation
create index if not exists desk_special_kpis_annotations_idx on desk_special_kpis using gin (annotations);


-- ==============================
-- 20260517_desk_pricing_taglines.sql
-- ==============================
-- 20260517_desk_pricing_taglines.sql
-- Table dédiée aux taglines éditables affichés à droite du prix /jour
-- sur les cards pricing publiques. 1 ligne par plan (premium, max).
--
-- Pourquoi une table séparée et pas une colonne dans pricing_plans :
--  - Atomique / idempotent : CREATE IF NOT EXISTS sans toucher au schéma
--    existant qui contient déjà `tagline_fr` (utilisé pour la phrase
--    sous le titre du plan — usage différent).
--  - Le tagline /jour est un texte marketing distinct, traduit en 8 langues.
--  - Permet à l'admin de re-traduire indépendamment (hash-diff).
--
-- Locales cibles : fr (source) + en, en-GB, de, de-CH, nl, sv, da (autotrad).
-- Format tagline_i18n :
--   { "en": "...", "en-GB": "...", "de": "...", "de-CH": "...",
--     "nl": "...", "sv": "...", "da": "..." }
--
-- Hash : SHA-256 hex du tagline_fr au moment de la dernière traduction.
-- Si tagline_fr change → hash change → re-traduit. Sinon idempotent.

create table if not exists desk_pricing_taglines (
  plan_key text primary key,
  tagline_fr text not null default '',
  tagline_fr_hash text,
  tagline_i18n jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Trigger updated_at auto.
create or replace function desk_pricing_taglines_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists desk_pricing_taglines_touch on desk_pricing_taglines;
create trigger desk_pricing_taglines_touch
  before update on desk_pricing_taglines
  for each row execute function desk_pricing_taglines_touch_updated_at();

-- Index GIN pour serialization JSONB rapide.
create index if not exists desk_pricing_taglines_i18n_idx
  on desk_pricing_taglines using gin (tagline_i18n);

-- Seed initial : reprend la phrase café actuelle (i18n keys
-- pricing.card.coffee_slogan_part1 + part2 concaténées) pour ne pas casser
-- l'affichage public tant que Yann n'a pas saisi un tagline custom.
insert into desk_pricing_taglines (plan_key, tagline_fr)
values
  ('premium', 'Soit moins que le prix d''un café, mais bien mieux investi !'),
  ('max',     'Soit moins que le prix d''un café, mais bien mieux investi !')
on conflict (plan_key) do nothing;


-- ==============================
-- 20260517_desk_releases.sql
-- ==============================
-- 20260517_desk_releases.sql
-- Architecture 3 niveaux (Yann 16 mai 2026) :
--   * Niveau 0 LIVE www.mettrik.ai (public)
--   * Niveau 1 PRE-LIVE pre.mettrik.ai (gated admin)
--   * Niveau 2 DEV staging.mettrik.ai (gated admin)
--
-- Table desk_releases = historique versionné des push live + tracking
-- des versions pre-live actives. Version invisible côté HTML public,
-- visible via header HTTP X-Mettrik-Version, endpoint /api/version,
-- ou page back-office /desk-mtk9x4kp/releases.

create table if not exists desk_releases (
  id uuid primary key default gen_random_uuid(),
  -- Niveau : 'live' / 'pre-live' / 'dev'
  level text not null check (level in ('live', 'pre-live', 'dev')),
  -- Version sémantique majeur.mineur.patch (ex 1.0.0, 1.0.1, 1.1.0)
  version text not null,
  -- Hash git du commit pushé
  git_sha text,
  -- URL Vercel snapshot (immuable, garde l'ancienne live accessible)
  vercel_url text,
  -- Statut courant : current = actif maintenant, archived = ancienne live remplacée
  status text not null default 'current' check (status in ('current', 'archived', 'failed', 'pending')),
  -- Notes humaines (ex "ajout de feature X", "fix bug Y")
  notes text,
  -- Métadonnées variantes (plans, langues, pays actifs)
  variants_meta jsonb default '{}'::jsonb,
  deployed_at timestamptz not null default now(),
  deployed_by text,            -- email admin (ex yannricordeau100@gmail.com)
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists desk_releases_level_idx on desk_releases (level, status, deployed_at desc);
create index if not exists desk_releases_version_idx on desk_releases (version);

-- Assure qu'on a au plus 1 release "current" par niveau
create unique index if not exists desk_releases_current_per_level
  on desk_releases (level)
  where status = 'current';

alter table desk_releases enable row level security;

drop policy if exists "service role write releases" on desk_releases;
create policy "service role write releases" on desk_releases
  for all using (auth.role() = 'service_role');

-- Lecture publique du current live (pour endpoint /api/version public)
drop policy if exists "public read current live release" on desk_releases;
create policy "public read current live release" on desk_releases
  for select using (level = 'live' and status = 'current');

-- Seed initial : on note la version actuelle staging comme "dev v0.1.0"
-- variants_meta : 4 versions utilisateur (visitor + free + premium + max),
-- 3 langues officielles FR/EN/DE au démarrage (les autres FR/EN/DE/nl/sv/da
-- existent en code mais ne sont pas part des versions "officielles" niveau 0).
insert into desk_releases (level, version, status, notes, variants_meta, deployed_by)
values (
  'dev',
  '0.1.0',
  'current',
  'Bootstrap initial — architecture 3 niveaux mise en place 17 mai 2026',
  '{"variants":["visitor","free","premium","max"],"locales":["fr","en","de"],"notes":"4 versions utilisateur × 3 langues officielles"}'::jsonb,
  'yannricordeau100@gmail.com'
)
on conflict do nothing;


-- ==============================
-- 20260517_image_findings_show_summary.sql
-- ==============================
-- 20260517_image_findings_show_summary.sql
-- Toggle "afficher la lecture sur la fiche société" per finding.
-- Yann 17 mai 2026 : la lecture doit être toujours visible côté fiche
-- société (= comme avant). Le toggle pour la masquer ne va pas sur l'app
-- mais dans la sandbox admin (cas par cas).

alter table desk_image_findings
  add column if not exists show_summary boolean not null default true;

-- Backfill : tous les findings existants restent affichés (default true).


-- ==============================
-- 20260517_vip_inspection.sql
-- ==============================
-- 20260517_vip_inspection.sql
-- Migration : VIP Inspection vers Supabase (au lieu de fs.writeFileSync
-- qui échoue sur Vercel filesystem read-only).
-- Yann 17 mai 2026 : "je veux pouvoir ajouter toutes les stés".

-- 1. Liste VIP (tickers à inspecter avec audit visuel approfondi)
create table if not exists vip_inspection_list (
  ticker text primary key,
  note text,
  added_at timestamptz not null default now(),
  scheduled_at timestamptz
);

-- 2. Statut d'inspection (résultats Gemini + auto-fixes)
create table if not exists vip_inspection_status (
  ticker text primary key references vip_inspection_list(ticker) on delete cascade,
  state text not null default 'idle' check (state in ('idle','running','done','error')),
  last_run_at timestamptz,
  defects jsonb default '[]'::jsonb,
  mode_screenshots jsonb default '{}'::jsonb,
  error text,
  updated_at timestamptz not null default now()
);

create index if not exists vip_inspection_status_state_idx on vip_inspection_status (state);

-- 3. RLS : service role only (admin desk)
alter table vip_inspection_list enable row level security;
alter table vip_inspection_status enable row level security;

drop policy if exists "service role vip list" on vip_inspection_list;
create policy "service role vip list" on vip_inspection_list
  for all using (auth.role() = 'service_role');

drop policy if exists "service role vip status" on vip_inspection_status;
create policy "service role vip status" on vip_inspection_status
  for all using (auth.role() = 'service_role');

-- 4. Backfill depuis vip-list.json existant
insert into vip_inspection_list (ticker, note, added_at, scheduled_at)
values ('BABA', 'Pas de DEF14A (ADR Chinois) — investor relations via annual report HK + 6-K + IR page. À enrichir gov via 9988.HK quand dispo.', '2026-05-17T01:00:00Z', '2026-05-17T05:00:00Z')
on conflict (ticker) do nothing;


-- ==============================
-- 20260518_desk_kpi_requests.sql
-- ==============================
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

