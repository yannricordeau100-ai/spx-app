/**
 * data-quality-matrix.ts — calcule le statut auto par (ticker, column).
 *
 * Statuts retournés :
 *   - "auto_ok"   : la donnée existe et passe le check basique.
 *   - "auto_ko"   : la donnée manque ou échoue le check basique.
 *   - "na"        : sans objet (rarement utilisé ici, plutôt côté override).
 *
 * Les overrides manuels sont ensuite mergés depuis desk_verification_matrix
 * pour produire le statut final affiché.
 *
 * Sources lues (read-only, runtime SSR) :
 *   - src/data/v1-7-public.json (datasets validés, hero_kpi, kpis…)
 *   - src/data/v2-pipeline-enrich/<ticker>.ranks.json
 *   - src/data/v2-pipeline-enrich/<ticker>.json (enrich V1.8)
 *   - public/logos/<TICKER>.png (existence)
 *   - src/data/v1-8-ui-audit.json (audit UI massif CONV-MODULE-UI-AUDIT)
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import V17_PUBLIC from "@/data/v1-7-public.json";
import V18_TICKERS from "@/data/v1-8-tickers-sorted.json";
import {
  COLUMN_KEYS,
  type CellAuto,
  type Cell,
  type ColumnKey,
  type CompanyRow,
} from "./data-quality-matrix-types";

// Re-exports pour rester compatibles avec les imports existants côté serveur.
export {
  COLUMN_KEYS,
  COLUMN_LABEL,
  finalStatus,
} from "./data-quality-matrix-types";
export type {
  AutoStatus,
  FinalStatus,
  CellAuto,
  Cell,
  ColumnKey,
  CompanyRow,
  MatrixSection as MatrixSectionType,
} from "./data-quality-matrix-types";

type Datasets = Record<string, {
  ticker?: string;
  name?: string;
  ranks?: Record<string, unknown>;
  hero_kpi?: string;
  kpis?: Array<{
    short?: string;
    history?: number[];
    period_type?: string;
    value?: unknown;
    interpretation?: string;
    name_fr?: string;
  }>;
  risks?: unknown[];
  governance?: unknown;
  ai_positioning?: unknown;
  revenue_by_segment?: unknown;
  revenue_by_geography?: unknown;
  transcript?: unknown;
  company_description?: string;
  founded?: number;
  ipo?: number;
  key_facts?: Record<string, unknown>;
  peers?: unknown[];
  market_positions?: unknown[];
  super_kpis?: unknown;
  dividend_history?: unknown;
}>;

function readEnrich(ticker: string): Record<string, unknown> | null {
  const p = path.join(process.cwd(), "src/data/v2-pipeline-enrich", `${ticker.toLowerCase()}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

/** Lit le dataset complet depuis v2-pipeline/<ticker>.json (= source de
 *  vérité avec risks / governance / ai_positioning / etc, contrairement
 *  au V17_PUBLIC bundlé qui est strippé pour le bundle size).
 *  Yann 9 mai 2026 : matrice affichait tout en KO car V17_PUBLIC ne
 *  contenait que ticker/name/sector/hero_kpi/kpis, sans risks/gov/ai. */
function readPipeline(ticker: string): Record<string, unknown> | null {
  const p = path.join(process.cwd(), "src/data/v2-pipeline", `${ticker.toLowerCase()}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function readAiPos(ticker: string): Record<string, unknown> | null {
  const p = path.join(process.cwd(), "src/data/v2-pipeline-enrich", `${ticker.toLowerCase()}.ai-pos.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function readRanks(ticker: string): Record<string, unknown> | null {
  const p = path.join(process.cwd(), "src/data/v2-pipeline-enrich", `${ticker.toLowerCase()}.ranks.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function logoExists(ticker: string): boolean {
  const p = path.join(process.cwd(), "public/logos", `${ticker.toUpperCase()}.png`);
  return fs.existsSync(p);
}

/* ============================================================ */
/*  Checks unitaires par colonne                                */
/* ============================================================ */

function checkLogo(ticker: string): CellAuto {
  return logoExists(ticker)
    ? { status: "auto_ok", hint: "PNG présent" }
    : { status: "auto_ko", detail: "Pas de PNG dans public/logos/" };
}

function checkRank(ticker: string, ds: Datasets[string]): CellAuto {
  const ranks = (readRanks(ticker) ?? ds.ranks ?? {}) as Record<string, unknown>;
  const fields = ["global_world", "global_us", "sector", "subsector"];
  const filled = fields.filter((f) => {
    const v = ranks[f];
    return v && v !== "-" && v !== "—";
  }).length;
  if (filled === 4) return { status: "auto_ok", hint: "4/4 ranks" };
  if (filled >= 1) return { status: "auto_ok", hint: `${filled}/4 ranks (partiel)` };
  return { status: "auto_ko", detail: "Aucun rang renseigné" };
}

/** Tag avec fraîcheur (à jour / stale) basé sur last_data_date vs next_earnings_date. */
function freshness(lastDataDate: string | undefined, nextEarning: string | undefined): "fresh" | "stale" | "unknown" {
  if (!lastDataDate) return "unknown";
  const last = new Date(lastDataDate);
  if (isNaN(last.getTime())) return "unknown";
  // Si on a la date du prochain earning : last_data >= next - 100 jours = à jour
  if (nextEarning) {
    const next = new Date(nextEarning);
    if (!isNaN(next.getTime())) {
      const cutoff = next.getTime() - 100 * 86400_000;
      return last.getTime() >= cutoff ? "fresh" : "stale";
    }
  }
  // Sinon : comparer avec maintenant. Si > 6 mois = stale.
  const ageMs = Date.now() - last.getTime();
  return ageMs <= 200 * 86400_000 ? "fresh" : "stale";
}

function checkHeroKpi(ds: Datasets[string]): CellAuto {
  if (!ds.hero_kpi) return { status: "auto_ko", detail: "hero_kpi absent" };
  const kpi = ds.kpis?.find((k) => k.short === ds.hero_kpi);
  if (!kpi) return { status: "auto_ko", detail: "hero_kpi pointe sur un KPI introuvable" };
  if (kpi.value === undefined || kpi.value === null || kpi.value === 0) {
    return { status: "auto_ko", detail: "hero KPI sans value valide" };
  }
  const lastDate = (kpi as { last_data_date?: string }).last_data_date;
  const next = (ds as { next_earnings_date?: string }).next_earnings_date;
  const f = freshness(lastDate, next);
  if (f === "stale") return { status: "auto_stale", detail: `last_data_date ${lastDate} en retard sur dernier earning`, hint: `${ds.hero_kpi}` };
  if (f === "unknown") return { status: "auto_partial", detail: "last_data_date manquant", hint: `${ds.hero_kpi}` };
  return { status: "auto_ok", hint: `${ds.hero_kpi} (${lastDate})` };
}

function checkGraphAnnual(ds: Datasets[string]): CellAuto {
  const kpi = ds.kpis?.find((k) => k.short === ds.hero_kpi);
  if (!kpi || !Array.isArray(kpi.history)) {
    return { status: "auto_ko", detail: "history absente" };
  }
  // L'annuel est reconstruit à la volée depuis quarterly (Q4 de chaque année).
  // On considère OK si on a >=4 points annuels OU >=4 trimestriels.
  if (kpi.period_type === "quarter") {
    return kpi.history.length >= 4
      ? { status: "auto_ok", hint: `${kpi.history.length} pts (reconstruit Q4 chaque année)` }
      : { status: "auto_ko", detail: "Trop peu de points pour reconstruire annuel" };
  }
  return kpi.history.length >= 4
    ? { status: "auto_ok", hint: `${kpi.history.length} pts annuels` }
    : { status: "auto_ko", detail: `${kpi.history.length} pt(s) annuels (<4)` };
}

function checkGraphQuarterly(ds: Datasets[string]): CellAuto {
  const kpi = ds.kpis?.find((k) => k.short === ds.hero_kpi);
  if (!kpi) return { status: "auto_ko", detail: "hero KPI absent" };
  if (kpi.period_type !== "quarter") {
    return { status: "auto_ko", detail: "Pas d'history trimestrielle (period_type !== quarter)" };
  }
  if (!Array.isArray(kpi.history) || kpi.history.length < 8) {
    return { status: "auto_ko", detail: `${kpi.history?.length ?? 0} trim. (<8)` };
  }
  return { status: "auto_ok", hint: `${kpi.history.length} trim.` };
}

function checkHeroInterpretation(ds: Datasets[string]): CellAuto {
  const kpi = ds.kpis?.find((k) => k.short === ds.hero_kpi);
  if (!kpi) return { status: "auto_ko", detail: "hero KPI absent" };
  if (!kpi.interpretation || kpi.interpretation.length < 30) {
    return { status: "auto_ko", detail: "Interprétation absente ou trop courte" };
  }
  return { status: "auto_ok", hint: `${kpi.interpretation.length} chars` };
}

function checkKpiCount(ds: Datasets[string]): CellAuto {
  const n = ds.kpis?.length ?? 0;
  if (n === 0) return { status: "auto_ko", detail: "0 KPI" };
  if (n < 4) return { status: "auto_ko", detail: `Seulement ${n} KPIs (cible >= 4)` };
  return { status: "auto_ok", hint: `${n} KPIs` };
}

function checkRisks(ds: Datasets[string]): CellAuto {
  const n = Array.isArray(ds.risks) ? ds.risks.length : 0;
  if (n === 0) return { status: "auto_ko", detail: "Aucun risque" };
  if (n < 5) return { status: "auto_ok", hint: `${n} risques (cible >= 5)` };
  return { status: "auto_ok", hint: `${n} risques` };
}

function checkGovernance(ds: Datasets[string]): CellAuto {
  const gov = ds.governance as Record<string, unknown> | undefined;
  if (!gov || typeof gov !== "object") return { status: "auto_ko", detail: "Absent" };
  const keys = Object.keys(gov).filter((k) => gov[k] !== null && gov[k] !== undefined);
  if (keys.length < 3) return { status: "auto_ko", detail: `${keys.length} champs (<3)` };

  // Fraîcheur : on attend fiscal_year >= currentYear - 1 (ex en mai 2026,
  // l'exercice 2025 doit être bouclé via le 10-K déposé en fév 2026).
  const fiscalYear = gov.fiscal_year as number | undefined;
  const currentYear = new Date().getFullYear();
  if (typeof fiscalYear !== "number") {
    return { status: "auto_partial", detail: `${keys.length} champs · fiscal_year manquant`, hint: `${keys.length} champs` };
  }
  const lag = currentYear - 1 - fiscalYear; // 0 = à jour ; 1 = 1 an de retard ; etc.
  if (lag <= 0) return { status: "auto_ok", hint: `Exercice ${fiscalYear} · ${keys.length} champs` };
  if (lag === 1) return { status: "auto_stale", detail: `Exercice ${fiscalYear} (1 an de retard)`, hint: `Exercice ${fiscalYear}` };
  return { status: "auto_stale", detail: `Exercice ${fiscalYear} (${lag} ans de retard)`, hint: `Exercice ${fiscalYear}` };
}

function checkAiPositioning(ticker: string, ds: Datasets[string]): CellAuto {
  let ai = ds.ai_positioning as Record<string, unknown> | undefined;
  if (!ai) {
    const enrich = readEnrich(ticker);
    ai = enrich?.ai_positioning as Record<string, unknown> | undefined;
  }
  if (!ai) return { status: "auto_ko", detail: "Absent" };
  const stance = ai.stance as string | undefined;
  if (!stance) return { status: "auto_ko", detail: "stance absent" };
  return { status: "auto_ok", hint: `stance: ${stance}` };
}

function checkSegments(ticker: string, ds: Datasets[string]): CellAuto {
  let seg = ds.revenue_by_segment;
  if (!seg) {
    const enrich = readEnrich(ticker);
    seg = enrich?.revenue_by_segment;
  }
  if (!seg) return { status: "auto_ko", detail: "Absent" };
  const arr = seg as unknown[];
  if (!Array.isArray(arr) || arr.length === 0) return { status: "auto_ko", detail: "Vide" };
  return { status: "auto_ok", hint: `${arr.length} segments` };
}

function checkGeography(ticker: string, ds: Datasets[string]): CellAuto {
  let geo = ds.revenue_by_geography;
  if (!geo) {
    const enrich = readEnrich(ticker);
    geo = enrich?.revenue_by_geography;
  }
  if (!geo) return { status: "auto_ko", detail: "Absent" };
  // certaines données ont {slices: [...]} d'autres directement un array
  const obj = geo as { slices?: unknown[] };
  const arr = (Array.isArray(geo) ? geo : obj.slices) as unknown[] | undefined;
  if (!Array.isArray(arr) || arr.length === 0) return { status: "auto_ko", detail: "Vide" };
  return { status: "auto_ok", hint: `${arr.length} régions` };
}

function checkTranscript(ticker: string, ds: Datasets[string]): CellAuto {
  let tr = ds.transcript as { latest?: { content?: string; date?: string } } | undefined;
  if (!tr) {
    const enrich = readEnrich(ticker);
    tr = enrich?.transcript as typeof tr;
  }
  if (!tr) {
    const p = path.join(process.cwd(), "src/data/transcripts", `${ticker.toLowerCase()}.json`);
    if (fs.existsSync(p)) {
      try {
        tr = JSON.parse(fs.readFileSync(p, "utf8"));
      } catch {}
    }
  }
  if (!tr || !tr.latest || !tr.latest.content) return { status: "auto_ko", detail: "Aucun transcript" };
  // Fraîcheur : transcript > 6 mois = stale, > 9 mois = très stale.
  const date = tr.latest.date;
  if (!date) return { status: "auto_partial", detail: "transcript sans date", hint: "présent" };
  const ageMs = Date.now() - new Date(date).getTime();
  const ageMonths = Math.round(ageMs / (30 * 86400_000));
  if (ageMs > 270 * 86400_000) return { status: "auto_stale", detail: `transcript ${ageMonths} mois`, hint: date };
  if (ageMs > 180 * 86400_000) return { status: "auto_partial", detail: `transcript ${ageMonths} mois (limite)`, hint: date };
  return { status: "auto_ok", hint: date };
}

function checkCompanyProfile(ds: Datasets[string]): CellAuto {
  const desc = ds.company_description;
  const founded = ds.founded;
  const ipo = ds.ipo;
  const facts = ds.key_facts as Record<string, unknown> | undefined;
  const filled = [desc && typeof desc === "string" && desc.length > 20, founded, ipo, facts?.hq_city || facts?.hq_country, facts?.employees_count].filter(Boolean).length;
  if (filled >= 4) return { status: "auto_ok", hint: `${filled}/5 champs` };
  if (filled >= 2) return { status: "auto_ok", hint: `${filled}/5 (partiel)` };
  return { status: "auto_ko", detail: `${filled}/5 champs remplis` };
}

function checkPeers(ds: Datasets[string]): CellAuto {
  const peers = ds.peers as unknown[] | undefined;
  if (!Array.isArray(peers) || peers.length === 0) return { status: "auto_ko", detail: "Aucun peer" };
  if (peers.length < 3) return { status: "auto_ok", hint: `${peers.length} peers (cible >= 3)` };
  return { status: "auto_ok", hint: `${peers.length} peers` };
}

function checkMarketPositions(ticker: string, ds: Datasets[string]): CellAuto {
  let mp = ds.market_positions as unknown[] | undefined;
  if (!mp) {
    const enrich = readEnrich(ticker);
    mp = enrich?.market_positions as unknown[] | undefined;
  }
  if (!Array.isArray(mp) || mp.length === 0) return { status: "auto_ko", detail: "Aucune position TAM" };
  return { status: "auto_ok", hint: `${mp.length} TAM` };
}

function checkDividend(ds: Datasets[string]): CellAuto {
  // KPI "DPS" ou "Dividend per share" présent ?
  const hasDps = ds.kpis?.some((k) => /dividend|dps|dividende/i.test(k.short ?? "") || /dividend|dps|dividende/i.test(k.name_fr ?? ""));
  if (hasDps) return { status: "auto_ok", hint: "KPI DPS détecté" };
  return { status: "na", detail: "Sté ne verse pas de dividende (probablement)" };
}

function checkSuperKpis(ticker: string, ds: Datasets[string]): CellAuto {
  // Stocké soit directement sur le dataset, soit calculé à la volée par
  // computeSuperKpis(c). Ici on ne réimplémente pas la logique : on
  // vérifie uniquement la présence du SECTEUR (sans secteur = pas de
  // mapping super KPI dans la lib).
  const sector = (ds as { sector?: string }).sector;
  if (!sector) return { status: "auto_ko", detail: "Pas de secteur" };
  const hasKpis = (ds.kpis?.length ?? 0) >= 4;
  if (!hasKpis) return { status: "auto_ko", detail: "Trop peu de KPIs base pour calculer Super KPIs" };
  return { status: "auto_ok", hint: `secteur ${sector.slice(0, 20)}` };
}

/* ============================================================ */
/*  Calcul de toutes les cellules + overrides                   */
/* ============================================================ */

function computeAutoCells(ticker: string, ds: Datasets[string]): Record<ColumnKey, CellAuto> {
  return {
    logo: checkLogo(ticker),
    rank: checkRank(ticker, ds),
    hero_kpi: checkHeroKpi(ds),
    graph_annual: checkGraphAnnual(ds),
    graph_quarterly: checkGraphQuarterly(ds),
    hero_interpretation: checkHeroInterpretation(ds),
    kpi_count: checkKpiCount(ds),
    transcript: checkTranscript(ticker, ds),
    company_profile: checkCompanyProfile(ds),
    risks: checkRisks(ds),
    segments: checkSegments(ticker, ds),
    geography: checkGeography(ticker, ds),
    dividend: checkDividend(ds),
    governance: checkGovernance(ds),
    ai_positioning: checkAiPositioning(ticker, ds),
    market_positions: checkMarketPositions(ticker, ds),
    peers: checkPeers(ds),
    super_kpis: checkSuperKpis(ticker, ds),
  };
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function loadOverrides(): Promise<Map<string, Cell["override"]>> {
  const supa = adminClient();
  if (!supa) return new Map();
  const { data, error } = await supa.from("desk_verification_matrix").select("*");
  if (error || !data) return new Map();
  const m = new Map<string, Cell["override"]>();
  for (const row of data as Array<{
    ticker: string;
    column_key: string;
    status: "verified_ok" | "verified_ko" | "na";
    verified_by: string | null;
    verified_at: string;
    notes: string | null;
  }>) {
    m.set(`${row.ticker.toUpperCase()}::${row.column_key}`, {
      status: row.status,
      verified_by: row.verified_by,
      verified_at: row.verified_at,
      notes: row.notes,
    });
  }
  return m;
}

export type MatrixSection = {
  key: "v18_top" | "extra";
  label: string;
  rows: CompanyRow[];
};

function buildRow(
  ticker: string,
  datasets: Datasets,
  overrides: Map<string, Cell["override"]>,
): CompanyRow {
  const dsKey = Object.keys(datasets).find((k) => k.toUpperCase() === ticker.toUpperCase());
  const baseDs = (dsKey ? datasets[dsKey] : {}) as Datasets[string];
  // Merge enrichments (V17_PUBLIC bundlé est strippé : il manque risks /
  // governance / ai_positioning / ranks / etc). On lit v2-pipeline/<t>.json
  // (source de vérité) + v2-pipeline-enrich/<t>.json + .ai-pos.json + .ranks.json
  // pour donner aux checks la vraie image de ce qui est dispo. Yann 9 mai 2026.
  const pipeline = readPipeline(ticker) ?? {};
  const enrich = readEnrich(ticker) ?? {};
  const aiPos = readAiPos(ticker);
  const ds = {
    ...pipeline,
    ...baseDs,
    // baseDs (V17_PUBLIC) gagne pour ticker/name/sector/hero_kpi mais
    // pipeline.kpis (full array) gagne sur baseDs.kpis (1 seul = hero seul,
    // strippé par build-v17-public). Sans ça checkKpiCount = ko constant.
    kpis: (pipeline.kpis as unknown[] | undefined) ?? baseDs.kpis,
    ranks: pipeline.ranks ?? baseDs.ranks,
    // Champs riches : si manquent dans baseDs/pipeline, fallback enrich
    risks: baseDs.risks ?? pipeline.risks ?? enrich.risks,
    governance: baseDs.governance ?? pipeline.governance ?? enrich.governance,
    ai_positioning: aiPos ?? baseDs.ai_positioning ?? pipeline.ai_positioning ?? enrich.ai_positioning,
    revenue_by_segment: enrich.revenue_by_segment ?? pipeline.revenue_by_segment,
    revenue_by_geography: enrich.revenue_by_geography ?? pipeline.revenue_by_geography,
    market_positions: pipeline.market_positions ?? enrich.market_positions,
    company_description: enrich.company_description ?? pipeline.company_description,
    peers: enrich.peers ?? pipeline.peers,
    super_kpis: enrich.super_kpis ?? pipeline.super_kpis,
    key_facts: enrich.key_facts ?? pipeline.key_facts,
    dividend_history: enrich.dividend_history ?? pipeline.dividend_history,
  } as Datasets[string];
  const auto = computeAutoCells(ticker, ds);
  const cells = {} as Record<ColumnKey, Cell>;
  for (const col of COLUMN_KEYS) {
    const ov = overrides.get(`${ticker.toUpperCase()}::${col}`);
    cells[col] = { ...auto[col], override: ov };
  }
  return { ticker, name: (ds.name as string) ?? ticker, cells };
}

/**
 * Retourne 2 sections triées :
 *   1. v18_top : top 305 V1.8 (déjà trié par market_cap décroissant
 *      dans v1-8-tickers-sorted.json)
 *   2. extra : toutes les autres sés présentes dans le dataset Pass 3
 *      (cat 1 USA + cat 2 ADR + cat 3 EU générales) qui ne sont pas
 *      dans le top 305. Triées alphabétiquement.
 */
export async function buildMatrix(opts?: { limit?: number }): Promise<MatrixSection[]> {
  const datasets = V17_PUBLIC as unknown as Datasets;
  const validKeys = new Set(Object.keys(datasets).map((k) => k.toUpperCase()));
  const v18Tickers = (V18_TICKERS as string[]).filter((t) => validKeys.has(t.toUpperCase()));
  const v18Set = new Set(v18Tickers.map((t) => t.toUpperCase()));
  const extraTickers = Object.keys(datasets)
    .filter((k) => !v18Set.has(k.toUpperCase()))
    .sort();

  // limit ne s'applique qu'à v18_top (les extras ne sont chargés que
  // si limit >= taille v18Tickers). Permet pagination + chargement
  // progressif sans envoyer 600 lignes d'un coup côté client.
  const limit = opts?.limit ?? 50;
  const v18Slice = v18Tickers.slice(0, limit);
  const remainingBudget = Math.max(0, limit - v18Tickers.length);
  const extraSlice = remainingBudget > 0 ? extraTickers.slice(0, remainingBudget) : [];

  const overrides = await loadOverrides();
  const v18Rows = v18Slice.map((t) => buildRow(t, datasets, overrides));
  const extraRows = extraSlice.map((t) => buildRow(t, datasets, overrides));

  const sections: MatrixSection[] = [
    {
      key: "v18_top",
      label: `Top 305 V1.8 (par market cap)`,
      rows: v18Rows,
    },
  ];
  if (extraRows.length > 0 || (opts?.limit ?? 0) >= v18Tickers.length) {
    sections.push({
      key: "extra",
      label: `Sés cat 1 / 2 / 3 hors top 305 (alphabétique)`,
      rows: extraRows,
    });
  }
  return sections;
}

export async function setOverride(opts: {
  ticker: string;
  column_key: ColumnKey;
  status: "verified_ok" | "verified_ko" | "na";
  verified_by: string;
  notes?: string;
}): Promise<void> {
  const supa = adminClient();
  if (!supa) throw new Error("Supabase service role keys missing");
  const { error } = await supa.from("desk_verification_matrix").upsert(
    {
      ticker: opts.ticker.toUpperCase(),
      column_key: opts.column_key,
      status: opts.status,
      verified_by: opts.verified_by,
      notes: opts.notes ?? null,
      verified_at: new Date().toISOString(),
    },
    { onConflict: "ticker,column_key" },
  );
  if (error) throw error;
}
