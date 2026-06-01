import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";

/**
 * POST /api/admin/duplicates/confirm
 *
 * Body : {
 *   id: number,
 *   status: "same" | "different" | "ignored" | "pending",
 *   canonical_ticker?: string  // requis si status === "same"
 * }
 *
 * Met à jour le statut d'une entrée doublon dans
 * `src/data/duplicates-audit.json`. Auth-gate Yann uniquement
 * (DESK_OWNER_EMAIL).
 *
 * Note : en prod Vercel le filesystem est read-only. Renvoie 503 sur
 * fail d'écriture, dans ce cas Yann commit le JSON à la main.
 */

const AUDIT_PATH = path.join(
  process.cwd(),
  "src/data/duplicates-audit.json",
);

type DuplicateEntry = {
  id: number;
  kind: string;
  priority?: number;
  tickers: string[];
  names: string[];
  primary_suggestion: string;
  status: "pending" | "same" | "different" | "ignored";
  canonical_ticker?: string;
  reviewed_at?: string;
};

async function requireOwner(req: NextRequest) {
  // Bypass audit_token (cohérent avec page admin block-rules / duplicates)
  const url = new URL(req.url);
  const auditToken = url.searchParams.get("audit_token") ?? "";
  const expected = process.env.VISUAL_AUDIT_TOKEN ?? "";
  if (auditToken && expected && auditToken === expected) {
    return { ok: true as const };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== DESK_OWNER_EMAIL) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return { ok: true as const };
}

export async function POST(req: NextRequest) {
  const r = await requireOwner(req);
  if (!r.ok) return r.response;

  let body: {
    id?: unknown;
    status?: unknown;
    canonical_ticker?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const id = typeof body.id === "number" ? body.id : Number(body.id);
  const status =
    typeof body.status === "string" ? body.status.trim() : "";
  const canonicalTicker =
    typeof body.canonical_ticker === "string"
      ? body.canonical_ticker.trim().toUpperCase()
      : undefined;

  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }
  const allowed = ["pending", "same", "different", "ignored"];
  if (!allowed.includes(status)) {
    return NextResponse.json(
      { error: "status_invalid", allowed },
      { status: 400 },
    );
  }

  // Lire l'état courant
  let entries: DuplicateEntry[] = [];
  try {
    const raw = await fs.readFile(AUDIT_PATH, "utf-8");
    entries = JSON.parse(raw);
    if (!Array.isArray(entries)) {
      return NextResponse.json(
        { error: "audit_corrupted" },
        { status: 500 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: "audit_not_found", detail: String(err) },
      { status: 500 },
    );
  }

  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "id_not_found" }, { status: 404 });
  }

  const entry = entries[idx];
  entry.status = status as DuplicateEntry["status"];
  if (status === "same") {
    // si canonical_ticker fourni, le prendre ; sinon garder primary_suggestion
    entry.canonical_ticker = canonicalTicker ?? entry.primary_suggestion;
  } else {
    delete entry.canonical_ticker;
  }
  entry.reviewed_at = new Date().toISOString();
  entries[idx] = entry;

  try {
    await fs.writeFile(
      AUDIT_PATH,
      JSON.stringify(entries, null, 2) + "\n",
      "utf-8",
    );
  } catch (err) {
    console.error("duplicates-audit write failed", err);
    return NextResponse.json(
      { error: "write_failed", detail: String(err) },
      { status: 503 },
    );
  }

  try {
    revalidatePath("/sandbox/admin/duplicates");
  } catch {
    // pas critique
  }

  return NextResponse.json({
    ok: true,
    id,
    status,
    canonical_ticker: entry.canonical_ticker,
  });
}
