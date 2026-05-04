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
