/**
 * /api/desk/att — back-office Anti-thèse d'investissement (Yann 14 août 2026).
 *
 * Gated DESK_OWNER_EMAIL (même pattern que /api/desk/notes). Écritures via
 * client ADMIN (service role, bypass RLS) car la table `desk_att` n'a pas de
 * policies (RLS activée sans policy = accès service role uniquement).
 *
 * SQL de création (à exécuter dans Supabase, PAS créée par le code) :
 *   create table if not exists public.desk_att (
 *     ticker text primary key,
 *     payload jsonb not null,
 *     updated_at timestamptz not null default now()
 *   );
 *   alter table public.desk_att enable row level security;
 *
 * Endpoints :
 *   GET             → liste des 651 stés V1.9.5 avec statut ATT
 *   GET ?ticker=X   → payload effectif (Supabase prioritaire, sinon local)
 *   POST {ticker, payload} → upsert override desk_att
 *   DELETE ?ticker=X → supprime l'override (retour au JSON local)
 */
import { promises as fs } from "fs";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { coerceAtt } from "@/lib/att";
import { invalidateAttCache } from "@/lib/att-server";

export const dynamic = "force-dynamic";

async function requireOwner() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== DESK_OWNER_EMAIL) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return { ok: true as const };
}

type AttListRow = {
  ticker: string;
  present: boolean;
  source: "supabase" | "local" | null;
  intensite: string | null;
  redigee_le: string | null;
  fige: boolean;
};

async function loadUniverseTickers(): Promise<string[]> {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), "src/data/v1-9-5-clean-all-tickers.json"),
      "utf-8",
    );
    const tickers = (JSON.parse(raw) as { tickers?: string[] }).tickers ?? [];
    return tickers.map((t) => t.toUpperCase());
  } catch {
    return [];
  }
}

async function readLocalPayload(ticker: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), "src/data/att", `${ticker.toLowerCase()}.json`),
      "utf-8",
    );
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function summarize(
  ticker: string,
  payload: Record<string, unknown> | null,
  source: "supabase" | "local" | null,
): AttListRow {
  return {
    ticker,
    present: !!payload,
    source: payload ? source : null,
    intensite: payload && typeof payload.intensite === "string" ? payload.intensite : null,
    redigee_le: payload && typeof payload.redigee_le === "string" ? payload.redigee_le : null,
    fige: !!(payload && payload._fige === true),
  };
}

export async function GET(req: NextRequest) {
  const r = await requireOwner();
  if (!r.ok) return r.response;

  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase() ?? null;
  const admin = createSupabaseAdminClient();

  // Détail d'une sté : payload effectif + provenance.
  if (ticker) {
    let source: "supabase" | "local" | null = null;
    let payload: Record<string, unknown> | null = null;
    try {
      const { data } = await admin
        .from("desk_att")
        .select("payload")
        .eq("ticker", ticker)
        .maybeSingle();
      const p = (data as { payload?: unknown } | null)?.payload;
      if (p && typeof p === "object") {
        payload = p as Record<string, unknown>;
        source = "supabase";
      }
    } catch {
      // Table absente / Supabase down → fallback local silencieux.
    }
    if (!payload) {
      payload = await readLocalPayload(ticker);
      if (payload) source = "local";
    }
    return NextResponse.json({ ticker, source, payload });
  }

  // Liste : univers 651 stés + statut local + overrides Supabase.
  const tickers = await loadUniverseTickers();

  const localByTicker = new Map<string, Record<string, unknown>>();
  try {
    const dir = path.join(process.cwd(), "src/data/att");
    const files = await fs.readdir(dir);
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const t = f.replace(/\.json$/, "").toUpperCase();
      const payload = await readLocalPayload(t);
      if (payload) localByTicker.set(t, payload);
    }
  } catch {
    // Dossier absent → aucune ATT locale.
  }

  const sbByTicker = new Map<string, Record<string, unknown>>();
  try {
    const { data } = await admin.from("desk_att").select("ticker, payload");
    for (const row of data ?? []) {
      const t = String((row as { ticker?: unknown }).ticker ?? "").toUpperCase();
      const p = (row as { payload?: unknown }).payload;
      if (t && p && typeof p === "object") {
        sbByTicker.set(t, p as Record<string, unknown>);
      }
    }
  } catch {
    // Table absente → liste basée sur le local uniquement.
  }

  // Union : univers + tout ticker ayant une ATT hors liste (sécurité).
  const all = new Set<string>([...tickers, ...localByTicker.keys(), ...sbByTicker.keys()]);
  const rows: AttListRow[] = [...all].sort().map((t) => {
    const sb = sbByTicker.get(t) ?? null;
    if (sb) return summarize(t, sb, "supabase");
    return summarize(t, localByTicker.get(t) ?? null, "local");
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const r = await requireOwner();
  if (!r.ok) return r.response;
  const body = await req.json().catch(() => null);
  const ticker = typeof body?.ticker === "string" ? body.ticker.toUpperCase().trim() : "";
  const payload = body?.payload;
  if (!ticker) {
    return NextResponse.json({ error: "ticker requis" }, { status: 400 });
  }
  if (!coerceAtt(payload)) {
    return NextResponse.json(
      { error: "payload invalide : hook, redigee_le et intensite (faible|moderee|elevee) sont requis" },
      { status: 400 },
    );
  }
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("desk_att")
    .upsert(
      { ticker, payload, updated_at: new Date().toISOString() },
      { onConflict: "ticker" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  invalidateAttCache(ticker);
  return NextResponse.json({ ok: true, ticker });
}

export async function DELETE(req: NextRequest) {
  const r = await requireOwner();
  if (!r.ok) return r.response;
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase() ?? "";
  if (!ticker) {
    return NextResponse.json({ error: "ticker requis" }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("desk_att").delete().eq("ticker", ticker);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  invalidateAttCache(ticker);
  return NextResponse.json({ ok: true, ticker });
}
