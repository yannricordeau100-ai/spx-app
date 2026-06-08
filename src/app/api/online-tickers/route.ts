/**
 * GET /api/online-tickers
 *
 * Retourne la liste des tickers "online" (= publiés / trouvables), source de
 * vérité = table Supabase `desk_curated_companies` (min_plan != 'hidden').
 *
 * Consommé par la search (company-search.tsx) pour n'afficher QUE les stés
 * réellement publiées. Runtime (pas de rebuild requis quand on publie/retire
 * une sté via le toggle curated-companies ou via script).
 *
 * Yann 9 juin 2026 : "la fenêtre de recherche doit toujours afficher
 * uniquement les stés que l'on peut réellement trouver" (N0/N1/N2).
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ tickers: [] });
  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("desk_curated_companies")
      .select("ticker, min_plan");
    if (error) return NextResponse.json({ tickers: [], error: error.message });
    const tickers = (data ?? [])
      .filter((r: { min_plan?: string | null }) => r.min_plan && r.min_plan !== "hidden")
      .map((r: { ticker: string }) => String(r.ticker).toUpperCase());
    return NextResponse.json({ tickers });
  } catch (e) {
    return NextResponse.json({ tickers: [], error: String(e) });
  }
}
