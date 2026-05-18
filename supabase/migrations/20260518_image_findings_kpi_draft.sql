alter table desk_image_findings
  add column if not exists convertible_to_kpi boolean not null default false,
  add column if not exists kpi_draft jsonb;

comment on column desk_image_findings.convertible_to_kpi is
  'Yann 18 mai 2026 : finding extrait dun doc société dont les data peuvent constituer un KPI normal (value, history, unit, yoy)';
comment on column desk_image_findings.kpi_draft is
  'JSON KPI prêt à insérer dans company.kpis[] si Yann approuve';
