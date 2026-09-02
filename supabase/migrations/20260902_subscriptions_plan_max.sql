-- 2 sept 2026 : le webhook Stripe ecrit max_monthly / max_yearly (produits Max).
-- Deja applique en prod par ALTER direct le 2 sept 2026 ; cette migration porte
-- le changement pour toute recreation d environnement.
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check
  check (plan in ('free','premium_monthly','premium_yearly','max_monthly','max_yearly','enterprise'));
