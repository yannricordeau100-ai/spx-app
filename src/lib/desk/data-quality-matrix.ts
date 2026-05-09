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

export type AutoStatus = "auto_ok" | "auto_ko" | "na";
export type FinalStatus =
  | "verified_ok"
  | "verified_ko"
  | "na"
  | "auto_ok"
  | "auto_ko";

export const COLUMN_KEYS = [
  "logo",
  "rank",
  "hero_kpi",
  "graph_annual",
  "graph_quarterly",
  "hero_interpretation",
  "kpi_count",
  "risks",
  "governance",
  "ai_positioning",
  "segments",
  "geography",
] as const;
export type ColumnKey = (typeof COLUMN_KEYS)[number];

export const COLUMN_LABEL: Record<ColumnKey, string> = {
  logo: "Logo",
  rank: "Rang",
  hero_kpi: "Hero KPI",
  graph_annual: "Graph annuel",
  graph_quarterly: "Graph trim.",
  hero_interpretation: "Interprétation",
  kpi_count: "Nb KPIs",
  risks: "Risques",
  governance: "Gouvernance",
  ai_positioning: "Positionnement IA",
  segments: "Segments",
  geography: "Géographie",
};

export type CellAuto = {
  status: AutoStatus;
  detail?: string;
  /** Valeur brute affichée (ex "12 KPIs", "+42% YoY"). */
  hint?: string;
};

export type Cell = CellAuto & {
  /** Override manuel persistant si présent (gagne sur auto). */
  override?: {
    status: "verified_ok" | "verified_ko" | "na";
    verified_by: string | null;
    verified_at: string;
    notes: string | null;
  };
};

export type CompanyRow = {
  ticker: string;
  name: string;
  cells: Record<ColumnKey, Cell>;
};

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

function checkHeroKpi(ds: Datasets[string]): CellAuto {
  if (!ds.hero_kpi) return { status: "auto_ko", detail: "hero_kpi absent" };
  const kpi = ds.kpis?.find((k) => k.short === ds.hero_kpi);
  if (!kpi) return { status: "auto_ko", detail: "hero_kpi pointe sur un KPI introuvable" };
  if (kpi.value === undefined || kpi.value === null || kpi.value === 0) {
    return { status: "auto_ko", detail: "hero KPI sans value valide" };
  }
  return { status: "auto_ok", hint: `${ds.hero_kpi} = ${String(kpi.value)}` };
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
  return { status: "auto_ok", hint: `${keys.length} champs` };
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
  const arr = geo as unknown[];
  if (!Array.isArray(arr) || arr.length === 0) return { status: "auto_ko", detail: "Vide" };
  return { status: "auto_ok", hint: `${arr.length} régions` };
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
    risks: checkRisks(ds),
    governance: checkGovernance(ds),
    ai_positioning: checkAiPositioning(ticker, ds),
    segments: checkSegments(ticker, ds),
    geography: checkGeography(ticker, ds),
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

export async function buildMatrix(opts?: { limit?: number }): Promise<CompanyRow[]> {
  const datasets = V17_PUBLIC as unknown as Datasets;
  const validKeys = new Set(Object.keys(datasets).map((k) => k.toUpperCase()));
  const tickers = (V18_TICKERS as string[]).filter((t) => validKeys.has(t.toUpperCase()));
  const slice = opts?.limit ? tickers.slice(0, opts.limit) : tickers;
  const overrides = await loadOverrides();

  return slice.map((ticker) => {
    const dsKey = Object.keys(datasets).find((k) => k.toUpperCase() === ticker.toUpperCase());
    const ds = (dsKey ? datasets[dsKey] : {}) as Datasets[string];
    const auto = computeAutoCells(ticker, ds);
    const cells = {} as Record<ColumnKey, Cell>;
    for (const col of COLUMN_KEYS) {
      const ov = overrides.get(`${ticker.toUpperCase()}::${col}`);
      cells[col] = { ...auto[col], override: ov };
    }
    return {
      ticker,
      name: (ds.name as string) ?? ticker,
      cells,
    };
  });
}

export function finalStatus(cell: Cell): FinalStatus {
  if (cell.override) return cell.override.status;
  return cell.status;
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
