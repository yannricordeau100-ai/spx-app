/**
 * GET /api/kpis-existants
 *
 * Yann 29 aout 2026 : INDEX unique de tous les KPI existants, toutes societes
 * en ligne confondues. Concu pour etre lu en un seul appel par une
 * conversation Claude externe qui verifie qu un KPI candidat n existe pas
 * deja. Volontairement compact : ticker -> liste des noms de KPI.
 */
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { promises as fs } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

const ROOT = process.cwd();

async function lit(p: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await fs.readFile(p, "utf-8"));
  } catch {
    return null;
  }
}

export async function GET() {
  // Audit 2 sept 2026 : dataset coeur de valeur, reserve aux comptes connectes.
  try {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }
  const uni = await lit(
    path.join(ROOT, "src/data/v1-9-5-clean-all-tickers.json"),
  );
  const tickers = Array.isArray(uni?.tickers) ? (uni!.tickers as string[]) : [];
  const out: Record<string, string[]> = {};
  await Promise.all(
    tickers.map(async (raw) => {
      const t = String(raw).toUpperCase();
      const vus = new Set<string>();
      const noms: string[] = [];
      const haut = await lit(
        path.join(ROOT, ".batches-drafts-safe/kpis-haut", `${t}.json`),
      );
      const pipe = await lit(
        path.join(ROOT, "src/data/v2-pipeline", `${t.toLowerCase()}.json`),
      );
      for (const src of [haut, pipe]) {
        for (const k of ((src?.kpis as Array<Record<string, unknown>>) ?? [])) {
          const short = String(k?.short ?? "");
          if (!short || vus.has(short)) continue;
          vus.add(short);
          const nom = String(k.name_fr ?? k.name_en ?? short);
          noms.push(`${short} | ${nom}`);
        }
      }
      if (noms.length) out[t] = noms;
    }),
  );
  return NextResponse.json({
    societes: Object.keys(out).length,
    kpis_total: Object.values(out).reduce((n, l) => n + l.length, 0),
    par_ticker: out,
  });
}
