import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { listIrSources, upsertIrSource, seedTickers } from "@/lib/desk/ir-sources";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireDeskOwner();
  return NextResponse.json(await listIrSources());
}

export async function POST(req: NextRequest) {
  await requireDeskOwner();
  const body = await req.json();
  // Action spéciale : seed bulk
  if (body.action === "seed" && Array.isArray(body.tickers)) {
    try {
      return NextResponse.json(await seedTickers(body.tickers));
    } catch (e) {
      return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
    }
  }
  if (!body.ticker) return NextResponse.json({ error: "ticker requis" }, { status: 400 });
  try {
    return NextResponse.json(await upsertIrSource(body));
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
