-- 20 sept 2026 : nombre de graphiques souhaite par demande.
-- Le proprietaire pilote depuis /sandbox/image-findings le volume produit
-- pour chaque demande (valeur par defaut 3, bouton « +3 » pour en redemander).
-- Les scripts de publication utilisent cette valeur comme plafond.
ALTER TABLE public.desk_image_findings_requests
  ADD COLUMN IF NOT EXISTS desired_count integer NOT NULL DEFAULT 3;
