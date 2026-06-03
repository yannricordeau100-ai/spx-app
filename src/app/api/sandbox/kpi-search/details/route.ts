import { NextResponse } from "next/server";
import kpiIndex from "@/data/_kpis-index.json";

export const dynamic = "force-static";
export const revalidate = 3600;

type KpiDetail = {
  value: number | string | null;
  unit: string | null;
  period_type: string | null;
  history_len: number | null;
  name_fr: string | null;
};

type KpiIndex = {
  kpi_details: Record<string, Record<string, Partial<KpiDetail> | null | undefined>>;
};

/**
 * GET /api/sandbox/kpi-search/details?short=<KPI_SHORT>
 *
 * Renvoie les détails (value, unit, period_type, history_len, name_fr)
 * par ticker pour un short KPI donné. Lazy-loadé par le client pour
 * éviter d'envoyer l'index complet (3.8 MB) au navigateur.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const short = url.searchParams.get("short");
  if (!short) {
    return NextResponse.json({ error: "missing short" }, { status: 400 });
  }
  const idx = kpiIndex as unknown as KpiIndex;
  const raw = idx.kpi_details?.[short] ?? {};
  const tickers: Record<string, KpiDetail> = {};
  for (const [ticker, detail] of Object.entries(raw)) {
    if (!detail || typeof detail !== "object") continue;
    tickers[ticker] = {
      value: detail.value ?? null,
      unit: detail.unit ?? null,
      period_type: detail.period_type ?? null,
      history_len: detail.history_len ?? null,
      name_fr: detail.name_fr ?? null,
    };
  }
  return NextResponse.json({ short, tickers });
}
