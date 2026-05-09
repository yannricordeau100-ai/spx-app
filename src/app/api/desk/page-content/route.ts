import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { loadPageContentRaw, upsertPageContent } from "@/lib/desk/page-content";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireDeskOwner();
  return NextResponse.json(await loadPageContentRaw());
}

export async function POST(req: NextRequest) {
  await requireDeskOwner();
  const body = await req.json();
  if (!body.page_key || !body.section_key || !body.content_fr) {
    return NextResponse.json({ error: "page_key + section_key + content_fr requis" }, { status: 400 });
  }
  try {
    const data = await upsertPageContent(body);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
