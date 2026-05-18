import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { WORDMARK_VARIANTS } from "@/components/wordmark-variants";

/**
 * POST /api/sandbox/active-wordmark
 * Body : { id: string } (un des IDs de WORDMARK_VARIANTS)
 *
 * Auth-gate : email = DESK_OWNER_EMAIL (Yann uniquement).
 * Écrit `src/data/active-wordmark.json` qui est lu en build par
 * BrandWordmark + MettrikWordmark + variantes.
 *
 * Note : en prod (Vercel), le filesystem est read-only. La route renvoie
 * 503 si l'écriture échoue : Yann doit alors commit le JSON manuellement.
 */

async function requireOwner() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== DESK_OWNER_EMAIL) {
    return { ok: false as const, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, email: user.email };
}

export async function POST(req: NextRequest) {
  const r = await requireOwner();
  if (!r.ok) return r.response;

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const id = body.id;
  if (!id || typeof id !== "string" || !WORDMARK_VARIANTS[id]) {
    return NextResponse.json({ error: "invalid_id", id }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), "src", "data", "active-wordmark.json");
  const payload = {
    id,
    updated_at: new Date().toISOString(),
  };

  try {
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2) + "\n", "utf-8");
  } catch (err) {
    const message = err instanceof Error ? err.message : "write_failed";
    return NextResponse.json(
      {
        error: "write_failed",
        detail: message,
        hint: "En prod (Vercel) le filesystem est read-only. Commit le fichier active-wordmark.json manuellement.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, ...payload });
}

export async function GET() {
  const r = await requireOwner();
  if (!r.ok) return r.response;
  try {
    const filePath = path.join(process.cwd(), "src", "data", "active-wordmark.json");
    const raw = await fs.readFile(filePath, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch (err) {
    const message = err instanceof Error ? err.message : "read_failed";
    return NextResponse.json({ error: "read_failed", detail: message }, { status: 500 });
  }
}
