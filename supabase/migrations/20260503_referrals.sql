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
