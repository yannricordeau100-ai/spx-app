import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { copyFeatureValueAcrossPlans } from "@/lib/billing/admin-queries";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireDeskOwner();
  const { id } = await ctx.params;
  const body = (await req.json()) as { sourcePlanId: string; targetPlanIds: string[] };
  if (!body.sourcePlanId || !Array.isArray(body.targetPlanIds)) {
    return NextResponse.json({ error: "sourcePlanId + targetPlanIds requis" }, { status: 400 });
  }
  try {
    await copyFeatureValueAcrossPlans(id, body.sourcePlanId, body.targetPlanIds);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
