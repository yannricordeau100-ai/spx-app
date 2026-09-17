import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/company/favorites-state?ticker=AAPL
 * Etat des favoris de l utilisateur pour UNE fiche, en une seule requete :
 * la societe est-elle en favori, et quels KPI le sont.
 *
 * Yann 17 sept 2026 : chaque bouton etoile de la fiche appelait une action
 * serveur au montage (une par KPI), et chaque action renvoyait la page
 * entiere en RSC (68 Ko) : dix allers-retours par fiche, d ou la lenteur
 * ressentie apres le clic. Ici : un seul JSON de quelques octets.
 */
export async function GET(req: Request) {
  const ticker = (new URL(req.url).searchParams.get("ticker") ?? "").toUpperCase();
  if (!ticker) return NextResponse.json({ company: false, kpis: [] });
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ company: false, kpis: [] });
    const [c, k] = await Promise.all([
      supabase.from("favorite_companies").select("id").eq("user_id", user.id).eq("ticker", ticker).maybeSingle(),
      supabase.from("favorite_kpis").select("kpi_short").eq("user_id", user.id).eq("ticker", ticker),
    ]);
    return NextResponse.json({ company: !!c.data, kpis: (k.data ?? []).map((r) => r.kpi_short) });
  } catch {
    return NextResponse.json({ company: false, kpis: [] });
  }
}
