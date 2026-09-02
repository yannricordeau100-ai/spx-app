/**
 * GET /api/kpis-existants/<ticker>
 *
 * Yann 29 aout 2026 : liste PUBLIQUE en JSON des KPI deja presents sur la
 * fiche d une societe (fusion kpis-haut + pipeline, la meme que la page).
 * Usage : une conversation Claude externe verifie qu un KPI candidat n existe
 * pas deja avant de le proposer. Lecture seule, aucune donnee sensible :
 * uniquement short, noms, unite, cadence et profondeur d historique.
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  // Audit 2 sept 2026 : dataset coeur de valeur, reserve aux comptes connectes.
  try {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }
  const { ticker } = await params;
  const t = String(ticker || "").toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
  if (!t) return NextResponse.json({ error: "ticker requis" }, { status: 400 });

  const haut = await lit(
    path.join(ROOT, ".batches-drafts-safe/kpis-haut", `${t}.json`),
  );
  const pipe = await lit(
    path.join(ROOT, "src/data/v2-pipeline", `${t.toLowerCase()}.json`),
  );
  if (!haut && !pipe)
    return NextResponse.json({ error: "societe inconnue" }, { status: 404 });

  const vus = new Set<string>();
  const kpis: Array<Record<string, unknown>> = [];
  for (const src of [haut, pipe]) {
    for (const k of ((src?.kpis as Array<Record<string, unknown>>) ?? [])) {
      const short = String(k?.short ?? "");
      if (!short || vus.has(short)) continue;
      vus.add(short);
      kpis.push({
        short,
        name_fr: k.name_fr ?? null,
        name_en: k.name_en ?? null,
        unit: k.unit ?? null,
        frequency: k.frequency ?? k.period_type ?? null,
        points: Array.isArray(k.history) ? k.history.length : 0,
      });
    }
  }
  return NextResponse.json({ ticker: t, total: kpis.length, kpis });
}
