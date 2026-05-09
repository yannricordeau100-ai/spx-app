import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { listPromoCodes, upsertPromoCode } from "@/lib/billing/admin-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireDeskOwner();
  return NextResponse.json(await listPromoCodes());
}

export async function POST(req: NextRequest) {
  await requireDeskOwner();
  const body = await req.json();
  if (!body.code) return NextResponse.json({ error: "code requis" }, { status: 400 });
  try {
    const data = await upsertPromoCode({
      ...body,
      code: String(body.code).toUpperCase(),
      is_active: body.is_active ?? true,
      max_per_user: body.max_per_user ?? 1,
      recurring: body.recurring ?? false,
      new_customers_only: body.new_customers_only ?? false,
    });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
