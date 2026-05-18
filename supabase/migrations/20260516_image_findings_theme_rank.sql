-- 20260516_image_findings_theme_rank.sql
-- Ajoute support thème dark/light + classement par rank pour
-- desk_image_findings (Yann 16 mai 2026).

alter table desk_image_findings
  -- URL de l'image variante thème sombre (par défaut = image_url existante)
  add column if not exists image_url_dark text,
  -- URL de l'image variante thème clair (re-créée par Claude)
  add column if not exists image_url_light text,
  -- Rank pertinence assigné par Claude lors de l'extraction (1 = top,
  -- 999 = à voir). Utilisé pour filtrer Top 5 / 10 / 20.
  add column if not exists rank smallint default 100,
  -- Note de qualité 1-10 (Claude attribue lors de l'extraction selon
  -- pertinence, fraîcheur, qualité visuelle, autorité de la source).
  add column if not exists quality_score smallint;

-- Backfill : si image_url existait déjà, copie dans image_url_dark
update desk_image_findings
set image_url_dark = image_url
where image_url_dark is null and image_url is not null;

create index if not exists desk_image_findings_rank_idx on desk_image_findings (request_id, rank);
