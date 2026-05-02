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
