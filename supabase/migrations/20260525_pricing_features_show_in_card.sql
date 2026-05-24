-- Yann (25 mai 2026) : permettre de choisir QUELLES features apparaissent
-- dans le bloc "forfait" (card pricing publique). Avant : on prenait les 8
-- premières features non-false. Maintenant : seules celles flaggées
-- show_in_card=true apparaissent (au choix Yann depuis /desk-mtk9x4kp/pricing).
--
-- Non destructif : default false → existant inchangé tant que Yann n'a coché
-- aucune ligne. Une fois ≥1 feature cochée, seules les cochées s'affichent.
-- Fallback : si AUCUNE feature cochée pour le plan, la card retombe sur
-- les 8 premières (comportement avant migration) → pas de card vide.

alter table pricing_features
  add column if not exists show_in_card boolean not null default false;

-- Index optionnel (lecture rapide des features cochées)
create index if not exists pricing_features_card_idx
  on pricing_features (show_in_card)
  where show_in_card = true;
