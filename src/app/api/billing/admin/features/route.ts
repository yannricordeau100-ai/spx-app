import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { listFeatures, upsertFeature } from "@/lib/billing/admin-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireDeskOwner();
  return NextResponse.json(await listFeatures());
}

export async function POST(req: NextRequest) {
  await requireDeskOwner();
  const body = await req.json();
  if (!body.code || !body.label_fr || !body.category) {
    return NextResponse.json({ error: "code + label_fr + category requis" }, { status: 400 });
  }
  try {
    const data = await upsertFeature(body);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
