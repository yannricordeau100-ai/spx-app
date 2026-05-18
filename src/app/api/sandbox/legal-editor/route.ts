import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { legalFilePath } from "@/lib/legal-md";

/**
 * POST /api/sandbox/legal-editor
 * Body : { slug: "conditions", fr?: string, en?: string }
 *
 * Auth-gate : email = DESK_OWNER_EMAIL (Yann uniquement).
 * Réécrit `src/data/legal/conditions-{fr,en}.md`. La page publique
 * `/legal/conditions` est `force-dynamic`, donc le changement est visible
 * dès le prochain render (pas besoin de rebuild).
 *
 * En prod Vercel le filesystem est read-only : on renvoie 503 avec un
 * hint clair. Yann doit commit le MD manuellement.
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

const ALLOWED_SLUGS = ["conditions"] as const;
type Slug = (typeof ALLOWED_SLUGS)[number];

export async function POST(req: NextRequest) {
  const r = await requireOwner();
  if (!r.ok) return r.response;

  let body: { slug?: string; fr?: string; en?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const slug = body.slug;
  if (!slug || typeof slug !== "string" || !ALLOWED_SLUGS.includes(slug as Slug)) {
    return NextResponse.json({ error: "invalid_slug", slug }, { status: 400 });
  }

  const writes: { locale: "fr" | "en"; content: string }[] = [];
  if (typeof body.fr === "string") writes.push({ locale: "fr", content: body.fr });
  if (typeof body.en === "string") writes.push({ locale: "en", content: body.en });

  if (writes.length === 0) {
    return NextResponse.json({ error: "no_content", hint: "fournir 'fr' et/ou 'en'" }, { status: 400 });
  }

  // Sanity check : taille raisonnable (<200 KB)
  for (const w of writes) {
    if (w.content.length > 200_000) {
      return NextResponse.json(
        { error: "content_too_large", locale: w.locale, size: w.content.length },
        { status: 413 },
      );
    }
  }

  const written: { locale: "fr" | "en"; bytes: number }[] = [];
  for (const w of writes) {
    const filePath = legalFilePath(slug as Slug, w.locale);
    // Préserver newline terminale + normaliser \r\n → \n
    const normalized = w.content.replace(/\r\n/g, "\n");
    const final = normalized.endsWith("\n") ? normalized : normalized + "\n";
    try {
      await fs.writeFile(filePath, final, "utf-8");
      written.push({ locale: w.locale, bytes: final.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : "write_failed";
      return NextResponse.json(
        {
          error: "write_failed",
          locale: w.locale,
          detail: message,
          hint: "En prod (Vercel) le filesystem est read-only. Édite localement ou sur une branche preview, puis commit le fichier MD.",
        },
        { status: 503 },
      );
    }
  }

  return NextResponse.json({ ok: true, slug, written, updated_at: new Date().toISOString() });
}

export async function GET(req: NextRequest) {
  const r = await requireOwner();
  if (!r.ok) return r.response;

  const slug = req.nextUrl.searchParams.get("slug") ?? "conditions";
  if (!ALLOWED_SLUGS.includes(slug as Slug)) {
    return NextResponse.json({ error: "invalid_slug", slug }, { status: 400 });
  }

  try {
    const [fr, en] = await Promise.all([
      fs.readFile(legalFilePath(slug as Slug, "fr"), "utf-8"),
      fs.readFile(legalFilePath(slug as Slug, "en"), "utf-8"),
    ]);
    return NextResponse.json({ ok: true, slug, fr, en });
  } catch (err) {
    const message = err instanceof Error ? err.message : "read_failed";
    return NextResponse.json({ error: "read_failed", detail: message }, { status: 500 });
  }
}
