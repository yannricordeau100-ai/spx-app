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
