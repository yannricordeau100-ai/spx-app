/**
 * Catalogue des tarifs en cache partage (13 oct 2026, journaux Supabase).
 *
 * La page /pricing faisait 7 requetes par affichage (plans, prix, fonctions,
 * valeurs par plan, codes des plans, carte Gratuit, accroches). Les lignes
 * brutes sont desormais lues une fois par 5 min, cache vide a chaque
 * enregistrement du back-office des tarifs (invaliderTarifs). Le calcul du
 * catalogue (load-pricing.ts) est inchange.
 *
 * SERVEUR UNIQUEMENT. Une erreur de base n est jamais mise en cache : elle
 * remonte a l appelant, qui garde son repli habituel.
 */
import { createClient } from "@supabase/supabase-js";
import { tableEnCache } from "@/lib/cache-partage";
import type { PricingTaglineRow } from "./pricing-taglines";

const ETIQUETTE = "tarifs";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type Ligne = Record<string, unknown>;

/** Plans actifs (ordre tier_order) et tous les prix. */
export const tarifsPlansPrix = tableEnCache<{ plans: Ligne[]; prix: Ligne[] }>(
  "tarifs-plans-prix-v1",
  async () => {
    const sb = admin();
    const { data: plans, error } = await sb
      .from("pricing_plans")
      .select("*")
      .eq("is_active", true)
      .order("tier_order", { ascending: true });
    if (error) throw new Error(error.message);
    if (!plans || plans.length === 0) return { plans: [], prix: [] };
    const { data: prix, error: e2 } = await sb.from("pricing_prices").select("*");
    if (e2) throw new Error(e2.message);
    return { plans: plans as Ligne[], prix: (prix ?? []) as Ligne[] };
  },
  { etiquette: ETIQUETTE, memoireNextMs: 5_000 },
);

/** Fonctions actives (ordre feature_order), valeurs par plan, codes des plans. */
export const tarifsFonctions = tableEnCache<{ fonctions: Ligne[]; valeurs: Ligne[]; codesPlans: Ligne[] }>(
  "tarifs-fonctions-v1",
  async () => {
    const sb = admin();
    const [featRes, pfRes] = await Promise.all([
      sb.from("pricing_features").select("*").eq("is_active", true).order("feature_order"),
      sb.from("pricing_plan_features").select("*").eq("is_active", true),
    ]);
    if (featRes.error) throw new Error(featRes.error.message);
    if (pfRes.error) throw new Error(pfRes.error.message);
    if (!featRes.data || featRes.data.length === 0) return { fonctions: [], valeurs: [], codesPlans: [] };
    const { data: codesPlans, error: e3 } = await sb.from("pricing_plans").select("id, code");
    if (e3) throw new Error(e3.message);
    return {
      fonctions: featRes.data as Ligne[],
      valeurs: (pfRes.data ?? []) as Ligne[],
      codesPlans: (codesPlans ?? []) as Ligne[],
    };
  },
  { etiquette: ETIQUETTE, memoireNextMs: 5_000 },
);

/** Reglage de la carte Gratuit (desk_page_content, pricing / carte_gratuit). */
export const tarifsCarteGratuit = tableEnCache<{ content_fr: string | null; is_active: boolean | null } | null>(
  "tarifs-carte-gratuit-v1",
  async () => {
    const { data, error } = await admin()
      .from("desk_page_content")
      .select("content_fr, is_active")
      .eq("page_key", "pricing")
      .eq("section_key", "carte_gratuit")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data ?? null) as { content_fr: string | null; is_active: boolean | null } | null;
  },
  { etiquette: ETIQUETTE, memoireNextMs: 5_000 },
);

/** Accroches des cartes de prix (desk_pricing_taglines). */
export const tarifsAccroches = tableEnCache<PricingTaglineRow[]>(
  "tarifs-accroches-v1",
  async () => {
    const { data, error } = await admin().from("desk_pricing_taglines").select("*");
    if (error) throw new Error(error.message);
    return (data ?? []) as PricingTaglineRow[];
  },
  { etiquette: ETIQUETTE, memoireNextMs: 5_000 },
);

/**
 * Meme resultat que loadAllTaglines (pricing-taglines.ts), lu dans le cache.
 * Table absente ou base injoignable : map vide, comme avant.
 */
export async function loadAllTaglines(): Promise<Record<string, PricingTaglineRow>> {
  try {
    const out: Record<string, PricingTaglineRow> = {};
    for (const r of await tarifsAccroches.lire()) {
      out[r.plan_key] = {
        plan_key: r.plan_key,
        tagline_fr: r.tagline_fr ?? "",
        tagline_fr_hash: r.tagline_fr_hash ?? null,
        tagline_i18n: (r.tagline_i18n ?? {}) as Record<string, string>,
        updated_at: r.updated_at,
      };
    }
    return out;
  } catch {
    return {};
  }
}

/** A appeler apres toute ecriture du back-office des tarifs. */
export function invaliderTarifs(): void {
  tarifsPlansPrix.invalider();
  tarifsFonctions.invalider();
  tarifsCarteGratuit.invalider();
  tarifsAccroches.invalider();
}
