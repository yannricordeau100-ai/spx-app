/**
 * /api/version — endpoint pour exposer la version courante du niveau.
 *
 * Public en mode "live" : retourne uniquement version + level (data minimale).
 * Gated admin en "pre-live" / "dev" : retourne le détail complet.
 *
 * Utile pour :
 *   - Yann inspecte rapidement via `curl https://www.mettrik.ai/api/version`
 *   - Health check externes (uptime monitoring)
 *   - Back-office /desk-mtk9x4kp/releases peut le fetch
 */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getCurrentRelease, levelFromHostname, type ReleaseLevel } from "@/lib/releases";

export const dynamic = "force-dynamic";

export async function GET() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const level: ReleaseLevel = levelFromHostname(host);
  const release = await getCurrentRelease(level);

  const minimal = {
    level,
    version: release?.version ?? "unknown",
  };

  // Pour live : payload minimal (pas d'info sensitive)
  if (level === "live") {
    return NextResponse.json(minimal, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    });
  }

  // Pour pre-live / dev : payload détaillé (gated par auth admin via proxy.ts)
  return NextResponse.json({
    ...minimal,
    git_sha: release?.git_sha ?? null,
    vercel_url: release?.vercel_url ?? null,
    status: release?.status ?? null,
    notes: release?.notes ?? null,
    variants_meta: release?.variants_meta ?? {},
    deployed_at: release?.deployed_at ?? null,
    deployed_by: null, // masque (audit 2 sept 2026) : ne pas exposer l email du deployeur
  });
}
