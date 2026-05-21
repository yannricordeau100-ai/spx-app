/**
 * GET /api/v1-7-5/export
 *
 * Export CSV de toutes les sociétés V1.7.5 (univers brut 626 stés, sorted
 * by market cap décroissant). Yann 19 mai 2026 (v2 simplifié).
 *
 * Colonnes : rank, ticker, name, sector, subsector, publishable.
 *  - publishable=true → sté Pass 3 strict (502 stés visibles sur
 *    /sandbox/v1-7-5)
 *  - publishable=false → sté brute pas encore validée (124 stés)
 *
 * Format : RFC 4180, BOM UTF-8 pour Excel, quoted strings.
 * Cliquer le lien dans le navigateur déclenche le download.
 */
import { NextResponse } from "next/server";
import V17_PUBLIC from "@/data/v1-7-5-public.json";
import V17_SORTED from "@/data/v1-7-tickers-sorted.json";
import fs from "node:fs"; import path from "node:path"; const MERGED = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/data/v2-pipeline/_merged.json"), "utf-8"));
import type { Company } from "@/lib/data";

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
  const publicDatasets = V17_PUBLIC as unknown as Record<string, Company>;
  const merged = MERGED as unknown as Record<string, Company>;
  const sorted = V17_SORTED as string[];
  const publishableSet = new Set(
    Object.keys(publicDatasets).map((k) => k.toUpperCase()),
  );

  const headers = ["rank", "ticker", "name", "sector", "subsector", "publishable"];
  const rows: string[] = [headers.join(",")];

  sorted.forEach((ticker, idx) => {
    const up = ticker.toUpperCase();
    // Prend les données depuis publishable d'abord (canonique), fallback merged
    const c =
      publicDatasets[ticker] ??
      publicDatasets[up] ??
      merged[ticker] ??
      merged[up];
    if (!c || typeof c !== "object") return;
    rows.push(
      [
        idx + 1,
        ticker,
        c.name ?? "",
        c.sector ?? "",
        c.subsector ?? "",
        publishableSet.has(up) ? "true" : "false",
      ]
        .map(csvEscape)
        .join(","),
    );
  });

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
