import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { listPromoCodes, upsertPromoCode } from "@/lib/billing/admin-queries";

export const dynamic = "force-dynamic";


/** Secours par jeton d audit (Yann 4 sept 2026) : la maintenance ferme la page
 *  de connexion, donc le back-office devient inaccessible. Le jeton, secret,
 *  permet de continuer a lire et ecrire les codes promo. */
async function autorise(req: NextRequest): Promise<boolean> {
  const t = req.nextUrl.searchParams.get("audit_token") ?? "";
  return !!t && !!process.env.VISUAL_AUDIT_TOKEN && t === process.env.VISUAL_AUDIT_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!(await autorise(req))) await requireDeskOwner();
  return NextResponse.json(await listPromoCodes());
}

export async function POST(req: NextRequest) {
  if (!(await autorise(req))) await requireDeskOwner();
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
