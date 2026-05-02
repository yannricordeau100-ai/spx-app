import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";

const PDF_ROOT = "/Users/yann/Desktop/Projets 2025 26/App KPI/10-K";

type PdfDoc = {
  ticker: string;
  filename: string;
  size_kb: number;
  modified_at: string;
  type: "10-K" | "10-Q" | "8-K" | "DEF14A" | "ER" | "other";
  year: number | null;
};

function classify(filename: string): { type: PdfDoc["type"]; year: number | null } {
  const lower = filename.toLowerCase();
  let type: PdfDoc["type"] = "other";
  if (/10-?k/.test(lower)) type = "10-K";
  else if (/10-?q/.test(lower)) type = "10-Q";
  else if (/8-?k/.test(lower)) type = "8-K";
  else if (/def[\s_-]?14a|proxy/.test(lower)) type = "DEF14A";
  else if (/earning|er[\s_-]/.test(lower)) type = "ER";
  const yearMatch = filename.match(/(20\d{2})/);
  return { type, year: yearMatch ? parseInt(yearMatch[1], 10) : null };
}

export async function GET() {
  // auth
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== DESK_OWNER_EMAIL) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const exists = await fs.stat(PDF_ROOT).then(() => true).catch(() => false);
    if (!exists) {
      return NextResponse.json({ docs: [], error: "PDF root introuvable", root: PDF_ROOT });
    }

    const tickers = await fs.readdir(PDF_ROOT, { withFileTypes: true });
    const docs: PdfDoc[] = [];

    for (const t of tickers) {
      if (!t.isDirectory()) continue;
      const tickerName = t.name;
      const tickerPath = path.join(PDF_ROOT, tickerName);
      let files: string[] = [];
      try {
        files = await fs.readdir(tickerPath);
      } catch { continue; }
      for (const f of files) {
        if (!f.toLowerCase().endsWith(".pdf")) continue;
        const filePath = path.join(tickerPath, f);
        try {
          const stats = await fs.stat(filePath);
          const { type, year } = classify(f);
          docs.push({
            ticker: tickerName.toUpperCase(),
            filename: f,
            size_kb: Math.round(stats.size / 1024),
            modified_at: stats.mtime.toISOString(),
            type,
            year,
          });
        } catch {}
      }
    }

    docs.sort((a, b) => {
      if (a.ticker !== b.ticker) return a.ticker.localeCompare(b.ticker);
      return (b.year ?? 0) - (a.year ?? 0);
    });

    return NextResponse.json({ docs, root: PDF_ROOT });
  } catch (err) {
    return NextResponse.json({ error: String(err), root: PDF_ROOT }, { status: 500 });
  }
}
