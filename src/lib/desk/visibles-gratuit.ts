/**
 * Societes 100 % visibles en gratuit (Yann 30 sept 2026).
 *
 * Stockage : desk_page_content, ligne (floutage, visibles-gratuit), content_fr
 * = JSON d un tableau de tickers en majuscules. Meme mecanisme que les zones
 * de floutage : effet immediat en production, sans redeploiement.
 * Pour ces societes, les paliers gratuit ET anonyme voient tout (palier Max
 * sur la fiche) et seules elles peuvent aller au comparateur et aux favoris.
 */
import { createClient } from "@supabase/supabase-js";
import type { UserTier } from "@/lib/freemium/context";
import { VISIBLES_GRATUIT_DEFAUT } from "@/lib/freemium/visibles-gratuit-defaut";
import { readSimulateTier } from "@/lib/desk/effective-tier";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tierDepuisAbonnement } from "@/lib/freemium/tier-serveur";

const PAGE_KEY = "floutage";
const SECTION = "visibles-gratuit";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function normalise(liste: unknown): string[] {
  if (!Array.isArray(liste)) return [];
  const out = new Set<string>();
  for (const t of liste) {
    if (typeof t !== "string") continue;
    const u = t.trim().toUpperCase();
    if (u && /^[A-Z0-9.\-]{1,15}$/.test(u)) out.add(u);
  }
  return [...out];
}

let CACHE: { at: number; v: string[] } | null = null;

/** Liste en base, sinon la liste par defaut. Cache 60 s par instance. */
export async function chargeVisiblesGratuit(): Promise<string[]> {
  if (CACHE && Date.now() - CACHE.at < 60_000) return CACHE.v;
  let v: string[] = [...VISIBLES_GRATUIT_DEFAUT];
  try {
    const { data } = await admin()
      .from("desk_page_content")
      .select("content_fr")
      .eq("page_key", PAGE_KEY)
      .eq("section_key", SECTION)
      .maybeSingle();
    if (data) {
      try {
        v = normalise(JSON.parse(data.content_fr ?? "[]"));
      } catch {
        v = [];
      }
    }
  } catch {
    // base injoignable : liste par defaut
  }
  CACHE = { at: Date.now(), v };
  return v;
}

export async function chargeVisiblesGratuitSet(): Promise<Set<string>> {
  return new Set(await chargeVisiblesGratuit());
}

export async function enregistreVisiblesGratuit(tickers: unknown): Promise<string[]> {
  const liste = normalise(tickers);
  const { error } = await admin()
    .from("desk_page_content")
    .upsert(
      { page_key: PAGE_KEY, section_key: SECTION, content_fr: JSON.stringify(liste) },
      { onConflict: "page_key,section_key" },
    );
  if (error) throw new Error(error.message);
  CACHE = null;
  return liste;
}

/** Palier de l appelant (cookie de simulation, sinon abonnement reel). */
export async function palierAppelant(): Promise<UserTier> {
  const sim = await readSimulateTier();
  if (sim === "anonymous") return "anon";
  if (sim === "free" || sim === "premium" || sim === "max") return sim;
  try {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    return user ? await tierDepuisAbonnement(user) : "anon";
  } catch {
    return "anon";
  }
}

/** Vrai si le palier est gratuit ou anonyme ET la societe hors liste. */
export async function reserveAuxAbonnes(ticker: string, palier: UserTier): Promise<boolean> {
  if (palier !== "free" && palier !== "anon") return false;
  return !(await chargeVisiblesGratuitSet()).has(ticker.toUpperCase());
}
