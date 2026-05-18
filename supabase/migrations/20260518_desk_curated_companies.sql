-- Yann 18 mai 2026, bascule niveau 1.
--
-- Curation des sociétés visibles côté front public (niveau 0 + 1).
-- Niveau 2/3 ignore ce filtre (= toutes les sés sont visibles pour dev).
--
-- Modèle CUMULATIF : `min_plan` indique le tier minimum requis pour voir
-- la sté. Plus le plan est haut, plus on a accès :
--   - min_plan = 'free'    : visible par Free + Premium + Max
--   - min_plan = 'premium' : visible par Premium + Max
--   - min_plan = 'max'     : visible par Max uniquement
--   - min_plan = 'hidden'  : invisible publiquement (admin uniquement)
--
-- Une sté ABSENTE de cette table est considérée 'hidden' par défaut côté
-- niveau 0/1. Donc Yann doit explicitement marquer chaque sté qu'il
-- veut exposer publiquement (sécurité par défaut : opt-in).
CREATE TABLE IF NOT EXISTS public.desk_curated_companies (
  ticker     text PRIMARY KEY,
  min_plan   text NOT NULL DEFAULT 'hidden'
    CHECK (min_plan IN ('free', 'premium', 'max', 'hidden')),
  notes      text,
  added_at   timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS desk_curated_companies_min_plan_idx
  ON public.desk_curated_companies (min_plan);

-- RLS : admin uniquement (write). Lecture publique pour le filtre frontend.
ALTER TABLE public.desk_curated_companies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Lecture publique pour que le proxy frontend puisse filtrer les sés.
  CREATE POLICY desk_curated_companies_read
    ON public.desk_curated_companies
    FOR SELECT TO public
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger updated_at
DROP TRIGGER IF EXISTS desk_curated_companies_updated_at
  ON public.desk_curated_companies;
CREATE TRIGGER desk_curated_companies_updated_at
  BEFORE UPDATE ON public.desk_curated_companies
  FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
