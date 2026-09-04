/**
 * Societes enregistrees par un abonne (Yann 4 sept 2026).
 *
 * Le bouton "Enregistrer" de la fiche ne faisait rien : aucun stockage
 * n existait. Cette route en donne un, reserve aux offres payantes.
 *
 *   GET                 -> { tickers: [...] }
 *   POST { ticker }     -> ajoute
 *   DELETE ?ticker=XXX  -> retire
 *
 * L acces est verrouille par la politique de securite de la table : chacun ne
 * voit et n ecrit que ses propres lignes. Le palier est verifie ici, pour que
 * la limite soit la meme cote serveur que cote bouton.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tierDepuisAbonnement } from "@/lib/freemium/tier-serveur";

export const dynamic = "force-dynamic";

const TABLE = "user_saved_companies";

async function contexte() {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { sb, user: null, paye: false };
  const tier = await tierDepuisAbonnement(user);
  return { sb, user, paye: tier === "premium" || tier === "max" };
}

export async function GET() {
  const { sb, user } = await contexte();
  if (!user) return NextResponse.json({ tickers: [] });
  const { data } = await sb.from(TABLE).select("ticker").order("created_at", { ascending: false });
  return NextResponse.json({ tickers: (data ?? []).map((r) => String(r.ticker)) });
}

export async function POST(req: NextRequest) {
  const { sb, user, paye } = await contexte();
  if (!user) return NextResponse.json({ error: "connexion requise" }, { status: 401 });
  if (!paye) return NextResponse.json({ error: "offre payante requise" }, { status: 403 });
  let ticker = "";
  try {
    ticker = String(((await req.json()) as { ticker?: unknown }).ticker ?? "").toUpperCase().trim();
  } catch {
    return NextResponse.json({ error: "corps invalide" }, { status: 400 });
  }
  if (!/^[A-Z0-9.\-]{1,12}$/.test(ticker)) {
    return NextResponse.json({ error: "ticker invalide" }, { status: 400 });
  }
  // La cle primaire est (user_id, ticker) : sans `onConflict`, un second clic
  // sur la meme societe provoquait une erreur de doublon et le bouton
  // revenait a son etat precedent sans rien dire.
  const { error } = await sb
    .from(TABLE)
    .upsert({ user_id: user.id, ticker }, { onConflict: "user_id,ticker" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ticker });
}

export async function DELETE(req: NextRequest) {
  const { sb, user, paye } = await contexte();
  if (!user) return NextResponse.json({ error: "connexion requise" }, { status: 401 });
  if (!paye) return NextResponse.json({ error: "offre payante requise" }, { status: 403 });
  const ticker = (req.nextUrl.searchParams.get("ticker") ?? "").toUpperCase().trim();
  if (!ticker) return NextResponse.json({ error: "ticker requis" }, { status: 400 });
  const { error } = await sb.from(TABLE).delete().eq("user_id", user.id).eq("ticker", ticker);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
