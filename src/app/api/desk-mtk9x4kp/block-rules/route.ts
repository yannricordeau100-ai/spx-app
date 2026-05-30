/**
 * /api/desk-mtk9x4kp/block-rules
 *
 * GET   → { [block_key]: { raw, structured, hors_top1_raw, hors_top1_structured, updated_at } }
 * PATCH { block_key, rules_raw, rules_hors_top1_raw? }
 *       → upsert (auto-save debounce 1s côté UI)
 *
 * Auth : requireDeskOwner() (email Yann uniquement).
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import {
  BLOCK_KEYS,
  getAllBlockRules,
  upsertBlockRules,
  type BlockKey,
} from "@/lib/block-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requireDeskOwner();
  const all = await getAllBlockRules();
  return NextResponse.json(all);
}

export async function PATCH(req: NextRequest) {
  await requireDeskOwner();

  const body = (await req.json().catch(() => ({}))) as {
    block_key?: string;
    rules_raw?: string;
    rules_hors_top1_raw?: string;
  };

  const blockKey = (body.block_key ?? "").trim() as BlockKey;
  if (!BLOCK_KEYS.includes(blockKey)) {
    return NextResponse.json(
      { error: `block_key inconnu : "${blockKey}"` },
      { status: 400 },
    );
  }

  const raw = typeof body.rules_raw === "string" ? body.rules_raw : "";
  const horsTop1Raw =
    typeof body.rules_hors_top1_raw === "string" ? body.rules_hors_top1_raw : "";

  try {
    await upsertBlockRules(blockKey, raw, horsTop1Raw);
  } catch (e) {
    return NextResponse.json(
      { error: `BDD : ${(e as Error).message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, block_key: blockKey });
}
