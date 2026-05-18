-- Yann 18 mai 2026, bascule niveau 1.
--
-- Table de préférences user (par owner_email), sert pour :
--   (a) Labels customs des 5 catégories de to-dos (anciennement localStorage)
--       → survit aux changements de domaine (prod / niveau1 / niveau2)
--   (b) Memo simulation tier admin ("view as anonymous/free/premium/max")
--       → optionnel, le cookie est la source de vérité par onglet
--
-- 1 row par user (PK = owner_email, donc upsert simple).
CREATE TABLE IF NOT EXISTS public.desk_user_preferences (
  owner_email           text PRIMARY KEY,
  todo_category_labels  jsonb NOT NULL DEFAULT '{}'::jsonb,
  simulate_tier         text,  -- null | "anonymous" | "free" | "premium" | "max"
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS desk_user_preferences_email_idx ON public.desk_user_preferences (owner_email);

-- RLS : un user voit/modifie uniquement sa propre row.
ALTER TABLE public.desk_user_preferences ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY desk_user_preferences_owner_policy
    ON public.desk_user_preferences
    FOR ALL TO authenticated
    USING ((auth.jwt() ->> 'email') = owner_email)
    WITH CHECK ((auth.jwt() ->> 'email') = owner_email);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger updated_at
DROP TRIGGER IF EXISTS desk_user_preferences_updated_at ON public.desk_user_preferences;
CREATE TRIGGER desk_user_preferences_updated_at
  BEFORE UPDATE ON public.desk_user_preferences
  FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
