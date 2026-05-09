import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { setOverride, type ColumnKey } from "@/lib/desk/data-quality-matrix";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await requireDeskOwner();
  const body = (await req.json()) as {
    ticker: string;
    column_key: ColumnKey;
    status: "verified_ok" | "verified_ko" | "na";
    verified_by?: string;
    notes?: string;
  };
  if (!body.ticker || !body.column_key || !body.status) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  try {
    await setOverride({
      ticker: body.ticker,
      column_key: body.column_key,
      status: body.status,
      verified_by: body.verified_by ?? "YANN",
      notes: body.notes,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
