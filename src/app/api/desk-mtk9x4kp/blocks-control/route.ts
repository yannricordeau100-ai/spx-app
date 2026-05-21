import { NextResponse } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import fs from "node:fs/promises";
import path from "node:path";

const CONFIG_PATH = path.join(process.cwd(), "src/data/v1-9-blocks-control.json");

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await requireDeskOwner();
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") {
      return new NextResponse("invalid payload", { status: 400 });
    }
    const next = {
      _doc:
        "Block visibility control for V1.9.5. Global toggles apply to all stés; per_ticker overrides apply only when global=true (cannot force-enable when global=false).",
      _updated_at: new Date().toISOString(),
      global: body.global ?? {},
      per_ticker_overrides: body.per_ticker_overrides ?? {},
    };
    await fs.writeFile(CONFIG_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");
    return NextResponse.json({ ok: true, updated_at: next._updated_at });
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : "error", { status: 500 });
  }
}
