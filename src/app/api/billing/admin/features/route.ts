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
  if (!body.code || !body.label_fr) {
    return NextResponse.json({ error: "code + label_fr requis" }, { status: 400 });
  }
  // Yann (27 mai 2026) : category peut désormais être "" (= sans catégorie),
  // les features sans catégorie s'affichent en haut de la matrice publique.
  if (typeof body.category !== "string") body.category = "";
  try {
    const data = await upsertFeature(body);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
