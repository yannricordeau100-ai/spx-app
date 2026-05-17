/**
 * /api/desk-mtk9x4kp/taglines — endpoint admin (Yann only) pour les
 * taglines affichés à droite du prix /jour sur les pricing cards publiques.
 *
 * GET  → { [plan_key]: { tagline_fr, tagline_fr_hash, tagline_i18n, updated_at } }
 *
 * POST { plan_key, tagline_fr, force_retranslate? }
 *      → sauve FR + (re)déclenche autotrad FR→7 langues si hash a changé
 *        ou si force_retranslate=true.
 *      → returns { tagline_fr, tagline_i18n, hash_changed, translated_count }
 *
 * Auth : requireDeskOwner() (user.email === DESK_OWNER_EMAIL).
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import {
  loadAllTaglines,
  upsertTagline,
} from "@/lib/billing/pricing-taglines";
import {
  translateToAllLocales,
  hashTextFr,
} from "@/lib/i18n-autotrad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requireDeskOwner();
  const taglines = await loadAllTaglines();
  return NextResponse.json(taglines);
}

export async function POST(req: NextRequest) {
  await requireDeskOwner();

  const body = (await req.json().catch(() => ({}))) as {
    plan_key?: string;
    tagline_fr?: string;
    force_retranslate?: boolean;
  };

  const planKey = (body.plan_key ?? "").trim();
  const taglineFr = (body.tagline_fr ?? "").trim();
  const force = !!body.force_retranslate;

  if (!planKey) {
    return NextResponse.json({ error: "plan_key requis" }, { status: 400 });
  }

  // Charge l'état actuel pour comparer le hash.
  const all = await loadAllTaglines();
  const existing = all[planKey];
  const previousHash = existing?.tagline_fr_hash ?? null;
  const newHash = hashTextFr(taglineFr);
  const hashChanged = previousHash !== newHash;
  const shouldTranslate = force || hashChanged || !existing;

  let i18n: Record<string, string> = existing?.tagline_i18n ?? {};

  if (shouldTranslate && taglineFr.length > 0) {
    try {
      i18n = await translateToAllLocales(taglineFr);
    } catch {
      // Si autotrad échoue (rate limit, réseau, etc.) on garde l'ancien i18n
      // ou un objet vide. Yann pourra cliquer "Re-traduire" plus tard.
      i18n = existing?.tagline_i18n ?? {};
    }
  } else if (taglineFr.length === 0) {
    // Tagline FR vidé → on vide aussi les trads pour éviter incohérence.
    i18n = {};
  }

  try {
    await upsertTagline(planKey, taglineFr, newHash, i18n);
  } catch (e) {
    return NextResponse.json(
      { error: `BDD : ${(e as Error).message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    plan_key: planKey,
    tagline_fr: taglineFr,
    tagline_fr_hash: newHash,
    tagline_i18n: i18n,
    hash_changed: hashChanged,
    translated_count: Object.keys(i18n).length,
  });
}
