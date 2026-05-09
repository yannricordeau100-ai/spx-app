import { NextResponse, type NextRequest } from "next/server";
import { processOnboardingQueue } from "@/lib/email/onboarding";

export const dynamic = "force-dynamic";

/**
 * Cron Vercel : POST /api/cron/email-onboarding
 *
 * Auth : header `authorization: Bearer <CRON_SECRET>` ou query `?secret=<CRON_SECRET>`.
 * Tourne 1 fois par heure depuis vercel.json. Envoie 50 emails max par run.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const ok =
    secret &&
    (auth === `Bearer ${secret}` || querySecret === secret);
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await processOnboardingQueue();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

// GET supporté pour tests rapides + cron Vercel par défaut (qui appelle GET).
export async function GET(req: NextRequest) {
  return POST(req);
}
