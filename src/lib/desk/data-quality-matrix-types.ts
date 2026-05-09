/**
 * data-quality-matrix-types.ts — types & constantes safe pour client + server.
 *
 * Le fichier data-quality-matrix.ts importe node:fs et createClient Supabase,
 * donc il ne peut pas être importé côté client. On extrait ici les types
 * et helpers purement statiques.
 */

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

export function finalStatus(cell: Cell): FinalStatus {
  if (cell.override) return cell.override.status;
  return cell.status;
}
