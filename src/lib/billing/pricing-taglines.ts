/**
 * pricing-taglines.ts — lecture/écriture des taglines éditables affichés
 * à droite du prix /jour sur les cards pricing publiques.
 *
 * Table : desk_pricing_taglines (cf migration 20260517_desk_pricing_taglines.sql)
 *
 * Source de vérité = BDD. Fallback string hardcodé si BDD vide / inaccessible
 * pour ne JAMAIS casser l'affichage public (cf règle "le front doit
 * toujours marcher" de load-pricing.ts).
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Locales gérées par le système autotrad. Source : src/lib/i18n/types.ts. */
export type TaglineLocale = "fr" | "en" | "en-GB" | "de" | "de-CH" | "nl";

export type PricingTaglineRow = {
  plan_key: string;
  tagline_fr: string;
  tagline_fr_hash: string | null;
  tagline_i18n: Record<string, string>;
  updated_at: string;
};

/** Fallback hardcodé si BDD vide. Reprend la phrase café actuelle. */
const FALLBACK_TAGLINE_FR = "Soit moins que le prix d'un café, mais bien mieux investi !";

/**
 * Charge tous les taglines (1 ligne par plan). Map plan_key → row.
 * Si la table n'existe pas encore (migration pas appliquée) → map vide.
 */
export async function loadAllTaglines(): Promise<Record<string, PricingTaglineRow>> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("desk_pricing_taglines")
      .select("*");
    if (error || !data) return {};
    const out: Record<string, PricingTaglineRow> = {};
    for (const r of data as PricingTaglineRow[]) {
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

/**
 * Upsert un tagline FR + ses traductions pour un plan.
 * Caller responsable de calculer le hash et les traductions AVANT.
 */
export async function upsertTagline(
  planKey: string,
  taglineFr: string,
  taglineFrHash: string,
  taglineI18n: Record<string, string>,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("desk_pricing_taglines")
    .upsert(
      {
        plan_key: planKey,
        tagline_fr: taglineFr,
        tagline_fr_hash: taglineFrHash,
        tagline_i18n: taglineI18n,
      },
      { onConflict: "plan_key" },
    );
  if (error) throw new Error(error.message);
}

/**
 * Résout le tagline à afficher pour (plan_key, locale).
 * Cascade : i18n[locale] → tagline_fr (si locale=fr ou pas de trad) → fallback hardcodé.
 *
 * Pure function, peut être appelée côté client OU server.
 */
export function getPricingTagline(
  taglinesByPlan: Record<string, PricingTaglineRow>,
  planKey: string,
  locale: string,
): string {
  const row = taglinesByPlan[planKey];
  if (!row) return FALLBACK_TAGLINE_FR;

  // FR : retourne tagline_fr directement.
  if (locale === "fr") {
    return row.tagline_fr || FALLBACK_TAGLINE_FR;
  }

  // Autres locales : cherche dans i18n, fallback sur FR, puis hardcodé.
  const translated = row.tagline_i18n?.[locale];
  if (translated && translated.trim().length > 0) return translated;

  return row.tagline_fr || FALLBACK_TAGLINE_FR;
}
