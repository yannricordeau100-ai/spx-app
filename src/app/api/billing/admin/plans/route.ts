import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { listPlans, upsertPlan } from "@/lib/billing/admin-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireDeskOwner();
  const data = await listPlans();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  await requireDeskOwner();
  const body = await req.json();
  if (!body.code || !body.name_fr) return NextResponse.json({ error: "code + name_fr requis" }, { status: 400 });
  try {
    const data = await upsertPlan(body);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
