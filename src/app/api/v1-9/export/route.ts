/**
 * GET /api/v1-9/export
 *
 * Export CSV de l'univers V1.9 (924 stés). Yann 19 mai 2026.
 *
 * Univers = union de :
 *   - SP500 (503 stés US)
 *   - Top 307 V1.8 (307 stés mondial par market cap)
 *   - Indices européens principaux : CAC 40 (FR), FTSE 100 (UK), DAX 40 (DE),
 *     SMI (CH), BEL 20 (BE), FTSE MIB (IT), AEX (NL), ATX (AT)
 *
 * Colonnes (demande Yann) : country, source, ticker.
 *   - country : ISO 2 lettres (US, FR, GB, DE, CH, BE, IT, NL, AT)
 *   - source : catégorie interne (sp500, top307, cac40, ftse100, dax40,
 *     smi, bel20, ftsemib, aex, atx). Si une sté appartient à plusieurs,
 *     les sources sont concaténées avec "+" (ex "cac40+top307").
 *   - ticker : ticker Yahoo Finance (avec suffixe place boursière pour EU)
 *
 * Format : RFC 4180, BOM UTF-8 pour Excel, quoted strings.
 */
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import V19_UNIVERSE from "@/data/v1-9-universe.json";

export const dynamic = "force-static";
export const revalidate = 3600;

type V19Entry = {
  ticker: string;
  name: string;
  country: string;
  sources: string[];
};

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[,;"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function GET() {
  const universe = V19_UNIVERSE as unknown as V19Entry[];
  const headers = ["country", "source", "ticker"];
  const rows: string[] = [headers.join(",")];

  for (const e of universe) {
    if (!e?.ticker) continue;
    const source = (e.sources ?? []).join("+");
    rows.push([e.country ?? "", source, e.ticker].map(csvEscape).join(","));
  }

  const body = "﻿" + rows.join("\n") + "\n";
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mettrik-v1-9-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
