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
  let body: { action?: string; ticker?: string; tickers?: string[]; note?: string } = {};
  try { body = await req.json(); } catch {}
  if (!body.action) {
    return NextResponse.json({ error: "action required" }, { status: 400 });
  }
  const supa = admin();

  // Yann 19 mai 2026 : actions de groupe (add_group + launch_group).
  // Permet d'ajouter plusieurs tickers d'un coup et de lancer une inspection
  // en série (1 par 1, séquentiel — le worker GitHub Action traite les
  // tickers en state='running' en boucle).
  if (body.action === "add_group") {
    const tickers = Array.isArray(body.tickers) ? body.tickers : [];
    const cleaned = tickers
      .map((t) => String(t).toUpperCase().trim())
      .filter((t) => t.length > 0 && t.length <= 12);
    if (cleaned.length === 0) {
      return NextResponse.json({ error: "tickers[] required (non-empty)" }, { status: 400 });
    }
    const rows = cleaned.map((tk) => ({
      ticker: tk,
      note: body.note ?? null,
      added_at: new Date().toISOString(),
    }));
    const { error } = await supa
      .from("vip_inspection_list")
      .upsert(rows, { onConflict: "ticker", ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const list = await loadList();
    return NextResponse.json({
      ok: true,
      list,
      hint: `${cleaned.length} ticker(s) ajouté(s) au VIP : ${cleaned.join(", ")}`,
    });
  }

  if (body.action === "launch_group") {
    // Lance toutes les stés VIP non-done en passant chacune à state='running'.
    // Le worker GitHub Action picks one-by-one les 'running' et exécute
    // l'inspection séquentiellement.
    const list = await loadList();
    const all = list.tickers.map((t) => t.ticker.toUpperCase());
    const filter = Array.isArray(body.tickers) && body.tickers.length > 0
      ? new Set(body.tickers.map((t) => String(t).toUpperCase().trim()))
      : null;
    const targets = filter ? all.filter((t) => filter.has(t)) : all;
    if (targets.length === 0) {
      return NextResponse.json({ error: "aucun ticker à lancer" }, { status: 400 });
    }
    const rows = targets.map((tk) => ({
      ticker: tk,
      state: "running" as const,
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supa
      .from("vip_inspection_status")
      .upsert(rows, { onConflict: "ticker" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Trigger 1 seul workflow_dispatch (le worker traite les 'running' un par un)
    let webhook_hint = `${targets.length} sté(s) mises à 'running'. Le worker GHA traite séquentiellement (cron horaire max).`;
    const ghToken = process.env.GITHUB_DISPATCH_TOKEN;
    if (ghToken) {
      try {
        const resp = await fetch(
          "https://api.github.com/repos/yannricordeau100-ai/spx-app/actions/workflows/vip-inspection-worker.yml/dispatches",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ghToken}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
            body: JSON.stringify({
              ref: "main",
              inputs: { ticker: "__all_queued__" },
            }),
          },
        );
        if (resp.ok) {
          webhook_hint = `${targets.length} sté(s) en queue. Worker GHA déclenché en mode batch (séquentiel 1 par 1).`;
        }
      } catch {}
    }
    return NextResponse.json({ ok: true, hint: webhook_hint, count: targets.length, tickers: targets });
  }

  // Actions per-ticker (legacy)
  if (!body.ticker) {
    return NextResponse.json({ error: "ticker required for action " + body.action }, { status: 400 });
  }
  const tk = body.ticker.toUpperCase().trim();

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
    // 1. Marque state='running' en BDD
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

    // 2. Déclenche le worker GitHub Action via workflow_dispatch (utilise
    //    le yaml file directement, plus fiable que repository_dispatch qui
    //    ne semble pas déclencher correctement avec self-hosted runner).
    //    Yann 18 mai 2026 : switch repository_dispatch → workflow_dispatch.
    let webhook_hint = "Le worker GitHub Action exécutera l'inspection au prochain cron (max 1 heure).";
    const ghToken = process.env.GITHUB_DISPATCH_TOKEN;
    if (ghToken) {
      try {
        const resp = await fetch(
          "https://api.github.com/repos/yannricordeau100-ai/spx-app/actions/workflows/vip-inspection-worker.yml/dispatches",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ghToken}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
            body: JSON.stringify({
              ref: "main",
              inputs: { ticker: tk },
            }),
          },
        );
        if (resp.ok) {
          webhook_hint = `Worker GitHub Action déclenché immédiatement (workflow_dispatch, ticker=${tk}). Inspection démarre en ~30s.`;
        } else {
          const body = await resp.text().catch(() => "");
          webhook_hint = `Webhook GitHub fail (HTTP ${resp.status}: ${body.slice(0, 100)}). Fallback : cron hourly.`;
        }
      } catch (e) {
        webhook_hint = `Webhook GitHub error: ${String(e).slice(0, 80)}. Fallback : cron hourly.`;
      }
    }

    return NextResponse.json({
      ok: true,
      hint: `État '${tk}' mis à 'running'. ${webhook_hint}`,
    });
  }

  return NextResponse.json({ error: `unknown action: ${body.action}` }, { status: 400 });
}
