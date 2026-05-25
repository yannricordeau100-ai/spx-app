import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { DISABLED_BLOCKS_KEYS } from "@/lib/disabled-blocks";

/**
 * POST /api/sandbox/blocks-per-ste
 * Body : { ticker: string, blocks: string[] }
 *
 * Réécrit l'entrée per-sté dans `src/data/disabled-blocks-per-ste.json`.
 * Si blocks=[] → retire l'entrée. Sinon → la remplace.
 *
 * Auth-gate : Yann uniquement (DESK_OWNER_EMAIL).
 *
 * Note : en prod Vercel le filesystem est read-only. Renvoie 503 sur fail
 * d'écriture, dans ce cas Yann commit le JSON à la main.
 */

const CONFIG_PATH = path.join(process.cwd(), "src/data/disabled-blocks-per-ste.json");

async function requireOwner() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== DESK_OWNER_EMAIL) {
    return { ok: false as const, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true as const };
}

export async function POST(req: NextRequest) {
  const r = await requireOwner();
  if (!r.ok) return r.response;

  let body: { ticker?: unknown; blocks?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const ticker = typeof body.ticker === "string" ? body.ticker.trim().toUpperCase() : "";
  if (!ticker) {
    return NextResponse.json({ error: "ticker_required" }, { status: 400 });
  }

  const rawBlocks = Array.isArray(body.blocks) ? body.blocks : [];
  const allowed = new Set<string>(DISABLED_BLOCKS_KEYS);
  const blocks = rawBlocks
    .filter((b): b is string => typeof b === "string")
    .filter((b) => allowed.has(b));

  // Lire l'état courant
  let current: { _doc?: string; overrides?: Record<string, string[]>; updated_at?: string } = {};
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    current = JSON.parse(raw);
  } catch {
    current = { overrides: {} };
  }

  const overrides: Record<string, string[]> = { ...(current.overrides ?? {}) };
  if (blocks.length === 0) {
    delete overrides[ticker];
  } else {
    overrides[ticker] = blocks;
  }

  const payload = {
    _doc: current._doc ??
      "Overrides per-sté pour masquer des blocs page société sur un ticker précis. Géré via /sandbox/v1-8/blocks-per-ste.",
    overrides,
    updated_at: new Date().toISOString(),
  };

  try {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(payload, null, 2) + "\n", "utf-8");
  } catch (err) {
    return NextResponse.json(
      {
        error: "write_failed",
        detail: err instanceof Error ? err.message : String(err),
        hint: "Vercel filesystem is read-only. Commit the JSON manually.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, ticker, blocks, overrides_count: Object.keys(overrides).length });
}
