-- 20260517_image_findings_show_summary.sql
-- Toggle "afficher la lecture sur la fiche société" per finding.
-- Yann 17 mai 2026 : la lecture doit être toujours visible côté fiche
-- société (= comme avant). Le toggle pour la masquer ne va pas sur l'app
-- mais dans la sandbox admin (cas par cas).

alter table desk_image_findings
  add column if not exists show_summary boolean not null default true;

-- Backfill : tous les findings existants restent affichés (default true).
