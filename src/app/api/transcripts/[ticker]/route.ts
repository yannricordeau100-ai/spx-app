import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { readSimulateTier } from "@/lib/desk/effective-tier";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tierDepuisAbonnement } from "@/lib/freemium/tier-serveur";
import { estAlias, ticker_canonique } from "@/lib/ticker-aliases";

/**
 * Yann 24 sept 2026, mission des quatre conferences : une conference
 * anterieure se lit a la demande (synthese + KPI extraits), pour ne pas
 * alourdir la fiche. Reservee aux paliers Premium et Max (et aux comptes
 * internes) ; les autres recoivent 403 et voient les fleches floutees.
 */
async function autorise(req: Request): Promise<boolean> {
  const jeton = new URL(req.url).searchParams.get("audit_token");
  if (jeton && process.env.VISUAL_AUDIT_TOKEN && jeton === process.env.VISUAL_AUDIT_TOKEN) return true;
  const sim = await readSimulateTier();
  if (sim === "premium" || sim === "max") return true;
  if (sim === "anonymous" || sim === "free") return false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return false;
    const t = await tierDepuisAbonnement(data.user);
    return t === "premium" || t === "max";
  } catch {
    return false;
  }
}

async function lit(p: string): Promise<unknown | null> {
  try { return JSON.parse(await fs.readFile(p, "utf-8")); } catch { return null; }
}

export async function GET(req: Request, ctx: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await ctx.params;
  const t = (estAlias(ticker) ? ticker_canonique(ticker) : ticker).toLowerCase();
  if (!/^[a-z0-9.\-]{1,12}$/.test(t)) return NextResponse.json({ error: "code" }, { status: 400 });
  const root = process.cwd();
  const doc = (await lit(path.join(root, "src/data/transcripts", `${t}.json`))) as { calls?: { date: string; quarter?: unknown; year?: unknown }[]; latest?: { date?: string } } | null;
  const dates = (doc?.calls ?? []).map((c) => c.date).filter(Boolean);
  const date = new URL(req.url).searchParams.get("date");
  // Sans date : la liste des conferences disponibles, ouverte a tous (aucun contenu).
  if (!date) return NextResponse.json({ ticker: t.toUpperCase(), dates, derniere: doc?.latest?.date ?? dates[0] ?? null });
  if (!dates.includes(date)) return NextResponse.json({ error: "conference inconnue" }, { status: 404 });
  if (!(await autorise(req))) return NextResponse.json({ error: "abonnes" }, { status: 403 });
  const syntheses = (await lit(path.join(root, "src/data/transcript-summaries", `${t}.calls.json`))) as Record<string, unknown> | null;
  const kpis = (await lit(path.join(root, "src/data/transcripts-kpi", `${t}.json`))) as { calls?: { date: string; kpis: unknown[] }[] } | null;
  return NextResponse.json({
    ticker: t.toUpperCase(),
    date,
    synthese: syntheses?.[date] ?? null,
    kpis: kpis?.calls?.find((c) => c.date === date)?.kpis ?? [],
  });
}
