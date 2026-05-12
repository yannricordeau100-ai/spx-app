-- 20260513_ir_sources_regulator.sql
-- Ajout colonne regulator_url à desk_ir_sources.
--
-- Pour les sociétés européennes (Stoxx 600, etc.), beaucoup de documents
-- réglementaires (résultats annuels, semestriels, OPA, BALO, etc.) sont
-- déposés auprès du régulateur national plutôt que sur la page IR maison.
-- Exemples par suffixe ticker :
--   .PA → AMF info-financiere.fr
--   .DE → BaFin / Bundesanzeiger
--   .L  → FCA (RNS / LSE national storage mechanism)
--   .SW → SIX Swiss Exchange
--   .MI → CONSOB / Borsa Italiana
--   .MC → CNMV (Spain)
--   .AS → AFM (Netherlands)
--   .BR → FSMA (Belgium)
--   .LS → CMVM (Portugal)
--   .HE → Nasdaq Helsinki
--   .ST → Nasdaq Stockholm
--   .CO → Nasdaq Copenhagen
--   .OL → Oslo Børs / Euronext
-- Cette URL alimente le scraper en source de secours (ou parfois primaire).

alter table desk_ir_sources
  add column if not exists regulator_url text;
