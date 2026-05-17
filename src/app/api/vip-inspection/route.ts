import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * API endpoint pour gérer la liste VIP inspection.
 *
 * GET  /api/vip-inspection         → retourne {list, status}
 * POST /api/vip-inspection         → body {action: "add", ticker, note?} | {action: "remove", ticker} | {action: "launch", ticker}
 *
 * Yann 17 mai 2026.
 * v2 : migration vers Supabase (fs.writeFileSync ne marche pas sur
 * Vercel filesystem read-only). Tables :
 *   - vip_inspection_list   : tickers + notes + scheduled_at
 *   - vip_inspection_status : state + defects + screenshots
 */

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type ListEntry = { ticker: string; added_at: string; note?: string; scheduled_at?: string };
type ListFile = { updated_at: string; tickers: ListEntry[] };

type Defect = { id: string; severity: number; obs: string; corrected?: boolean; reverified?: boolean };
type StatusEntry = {
  ticker: string;
  last_run_at?: string;
  state: "idle" | "running" | "done" | "error";
  defects?: Defect[];
  mode_screenshots?: Record<string, string>;
  error?: string;
};
type StatusFile = { updated_at: string; results: Record<string, StatusEntry> };

async function loadList(): Promise<ListFile> {
  const supa = admin();
  const { data, error } = await supa
    .from("vip_inspection_list")
    .select("ticker, note, added_at, scheduled_at")
    .order("added_at", { ascending: true });
  if (error) {
    console.error("loadList error:", error);
    return { updated_at: new Date().toISOString(), tickers: [] };
  }
  return {
    updated_at: new Date().toISOString(),
    tickers: (data ?? []).map((r) => ({
      ticker: r.ticker,
      note: r.note ?? undefined,
      added_at: r.added_at,
      scheduled_at: r.scheduled_at ?? undefined,
    })),
  };
}

async function loadStatus(): Promise<StatusFile> {
  const supa = admin();
  const { data } = await supa.from("vip_inspection_status").select("*");
  const results: Record<string, StatusEntry> = {};
  for (const r of data ?? []) {
    results[r.ticker] = {
      ticker: r.ticker,
      state: r.state,
      last_run_at: r.last_run_at ?? undefined,
      defects: r.defects ?? [],
      mode_screenshots: r.mode_screenshots ?? {},
      error: r.error ?? undefined,
    };
  }
  return { updated_at: new Date().toISOString(), results };
}

export async function GET() {
  const [list, status] = await Promise.all([loadList(), loadStatus()]);
  return NextResponse.json({ list, status });
}

export async function POST(req: Request) {
  let body: { action?: string; ticker?: string; note?: string } = {};
  try { body = await req.json(); } catch {}
  if (!body.action || !body.ticker) {
    return NextResponse.json({ error: "action + ticker required" }, { status: 400 });
  }
  const tk = body.ticker.toUpperCase().trim();
  const supa = admin();

  if (body.action === "add") {
    // Upsert : ajoute si pas présent, sinon ignore
    const { error } = await supa
      .from("vip_inspection_list")
      .upsert(
        { ticker: tk, note: body.note ?? null, added_at: new Date().toISOString() },
        { onConflict: "ticker", ignoreDuplicates: true },
      );
    if (error) {
      console.error("add error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const list = await loadList();
    return NextResponse.json({ ok: true, list });
  }

  if (body.action === "remove") {
    const { error } = await supa.from("vip_inspection_list").delete().eq("ticker", tk);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const list = await loadList();
    return NextResponse.json({ ok: true, list });
  }

  if (body.action === "launch") {
    // Marque le statut "running" — un script Python en CLI/cron prendra le relais.
    const { error } = await supa
      .from("vip_inspection_status")
      .upsert(
        {
          ticker: tk,
          state: "running",
          last_run_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "ticker" },
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      ok: true,
      hint: `État '${tk}' mis à 'running'. Lance le script CLI : python3 scripts/vip-deep-inspection.py --ticker ${tk} (ou attend qu'il tourne en cron).`,
    });
  }

  return NextResponse.json({ error: `unknown action: ${body.action}` }, { status: 400 });
}
