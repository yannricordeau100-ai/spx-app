import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";

/**
 * GET /api/admin/kpis-toggle/list-overrides
 *
 * Retourne tous les overrides hero KPI persistés dans la table
 * `desk_hero_kpi_overrides` (Supabase niveau 1, source de vérité).
 *
 * Réponse :
 * {
 *   overrides: [
 *     { ticker: "AAPL", hero_kpi_short: "Services Revenue", updated_at: "..." },
 *     ...
 *   ],
 *   count: 73
 * }
 *
 * Auth-gate via DESK_OWNER_EMAIL (cf autres routes admin).
 * Cache : no-store (lecture toujours fraîche pour refléter immédiatement
 * les upserts).
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  // Auth-gate Yann
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== DESK_OWNER_EMAIL) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from("desk_hero_kpi_overrides")
      .select("ticker, hero_kpi_short, updated_at")
      .order("ticker", { ascending: true });

    if (error) {
      console.error("[list-overrides] supabase select failed", error);
      return NextResponse.json(
        { error: "supabase_select_failed", detail: error.message },
        { status: 500, headers: { "cache-control": "no-store" } },
      );
    }

    const overrides = (data ?? []).map((row) => ({
      ticker: row.ticker,
      hero_kpi_short: row.hero_kpi_short,
      updated_at: row.updated_at,
    }));

    return NextResponse.json(
      {
        overrides,
        count: overrides.length,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    console.error("[list-overrides] supabase client failed", err);
    return NextResponse.json(
      { error: "supabase_client_failed", detail: String(err) },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
