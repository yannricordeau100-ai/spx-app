-- Yann 18 mai 2026, bascule niveau 1 : colonnes price_caption_* qui étaient
-- en prod (ajoutées via SQL Editor en direct sans migration commitée).
-- Aligne le schéma de tout nouveau projet Supabase (niveau 1, futures
-- instances) avec la prod.
ALTER TABLE public.pricing_plans
  ADD COLUMN IF NOT EXISTS price_caption_fr text,
  ADD COLUMN IF NOT EXISTS price_caption_en text,
  ADD COLUMN IF NOT EXISTS price_caption_de text;
