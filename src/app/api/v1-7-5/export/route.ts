/**
 * GET /api/v1-7-5/export.csv
 *
 * Export CSV de toutes les sociétés V1.7.5 publiables (502 stés Pass 3
 * strict). Yann 19 mai 2026.
 *
 * Colonnes : ticker, name, sector, subsector, country, hero_kpi,
 *   hero_value, hero_unit, hero_yoy, hero_period_type, hero_history_len,
 *   next_earnings_date.
 *
 * Format : RFC 4180, BOM UTF-8 pour Excel, quoted strings.
 * Cliquer le lien dans le navigateur déclenche le download.
 */
import { NextResponse } from "next/server";
import V17_PUBLIC from "@/data/v1-7-5-public.json";
import type { Company, KPI } from "@/lib/data";

export const dynamic = "force-static";
export const revalidate = 3600; // 1 h

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[,;"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function GET() {
  const datasets = V17_PUBLIC as unknown as Record<string, Company>;
  const headers = [
    "ticker",
    "name",
    "sector",
    "subsector",
    "country",
    "hero_kpi",
    "hero_value",
    "hero_unit",
    "hero_yoy",
    "hero_period_type",
    "hero_history_len",
    "next_earnings_date",
  ];
  const rows: string[] = [headers.join(",")];

  for (const [ticker, c] of Object.entries(datasets)) {
    if (!c || typeof c !== "object") continue;
    const hero =
      (c.kpis ?? []).find((k: KPI) => k && k.short === c.hero_kpi) ??
      (c.kpis ?? [])[0];
    const country = (c as Company & { country?: string }).country ?? "";
    const nextEarnings =
      (c as Company & { next_earnings_date?: string }).next_earnings_date ?? "";
    const historyLen = Array.isArray(hero?.history) ? hero.history.length : 0;
    rows.push(
      [
        ticker,
        c.name ?? "",
        c.sector ?? "",
        c.subsector ?? "",
        country,
        hero?.short ?? "",
        hero?.value ?? "",
        hero?.unit ?? "",
        hero?.yoy ?? "",
        hero?.period_type ?? "",
        historyLen,
        nextEarnings,
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  // BOM UTF-8 pour Excel + LF Unix
  const body = "﻿" + rows.join("\n") + "\n";
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mettrik-v1-7-5-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
