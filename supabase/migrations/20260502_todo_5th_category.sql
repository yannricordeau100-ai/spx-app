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
