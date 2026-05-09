import { NextResponse, type NextRequest } from "next/server";
import { persistSnapshot } from "@/lib/desk/quality-history";

export const dynamic = "force-dynamic";
// Calcule la matrice complète + insère snapshot. Peut prendre 5-10s.
export const maxDuration = 60;

/**
 * Cron Vercel : toutes les 3 h.
 * Auth : header `authorization: Bearer <CRON_SECRET>` ou `?secret=<...>`.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const ok = secret && (auth === `Bearer ${secret}` || querySecret === secret);
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await persistSnapshot();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
