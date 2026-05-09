import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { duplicatePlan } from "@/lib/billing/admin-queries";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireDeskOwner();
  const { id } = await ctx.params;
  const body = await req.json();
  if (!body.code || !body.name_fr) return NextResponse.json({ error: "code + name_fr requis" }, { status: 400 });
  try {
    const data = await duplicatePlan(id, body.code, body.name_fr);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
