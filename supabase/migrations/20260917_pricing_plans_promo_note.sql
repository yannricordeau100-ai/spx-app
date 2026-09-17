-- Yann 17 sept 2026 : commentaire promotionnel (texte libre, affiche en rouge
-- dans un cadre arrondi sous le prix par semaine). Une seule colonne, le texte
-- est celui du proprietaire, sans traduction.
ALTER TABLE public.pricing_plans
  ADD COLUMN IF NOT EXISTS promo_note text;
