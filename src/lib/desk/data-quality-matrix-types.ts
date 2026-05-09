/**
 * data-quality-matrix-types.ts — types & constantes safe pour client + server.
 *
 * Le fichier data-quality-matrix.ts importe node:fs et createClient Supabase,
 * donc il ne peut pas être importé côté client. On extrait ici les types
 * et helpers purement statiques.
 */

export type AutoStatus =
  | "auto_ok"        // 🟢 présent ET à jour
  | "auto_stale"     // 🟡 présent mais en retard sur le dernier earning / AG
  | "auto_partial"   // 🟠 présent mais incomplet (champs manquants)
  | "auto_ko"        // 🔴 absent ou vide
  | "na";            // ⚪ sans objet
export type FinalStatus =
  | "verified_ok"
  | "verified_ko"
  | "na"
  | "auto_ok"
  | "auto_stale"
  | "auto_partial"
  | "auto_ko";

export const COLUMN_KEYS = [
  "logo",
  "rank",
  "hero_kpi",
  "graph_annual",
  "graph_quarterly",
  "hero_interpretation",
  "kpi_count",
  "transcript",
  "company_profile",
  "risks",
  "segments",
  "geography",
  "dividend",
  "governance",
  "ai_positioning",
  "market_positions",
  "peers",
  "super_kpis",
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
  transcript: "Transcript",
  company_profile: "Profil sté",
  risks: "Risques",
  segments: "Segments",
  geography: "Géographie",
  dividend: "Dividende",
  governance: "Gouvernance",
  ai_positioning: "Position. IA",
  market_positions: "TAM",
  peers: "Pairs",
  super_kpis: "Super KPIs",
};

export type CellAuto = {
  status: AutoStatus;
  detail?: string;
  hint?: string;
};

export type Cell = CellAuto & {
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

export type MatrixSection = {
  key: "v18_top" | "extra";
  label: string;
  rows: CompanyRow[];
};

export function finalStatus(cell: Cell): FinalStatus {
  if (cell.override) return cell.override.status;
  return cell.status;
}
