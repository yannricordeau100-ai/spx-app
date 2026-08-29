/**
 * Zones de floutage nommees (Yann 29 aout 2026).
 *
 * Deux portees :
 *  - GLOBALE : ligne (floutage, zones), appliquee a toutes les societes ;
 *  - PAR SOCIETE : ligne (floutage, zones:<TICKER>), qui PRIME sur la
 *    globale quand elle existe. Une liste vide est un override valide :
 *    c est ainsi qu une societe vitrine (GOOGL, META...) est exemptee de
 *    tout floutage sans une ligne de code.
 *
 * Stockage : table generique desk_page_content, effet immediat en production
 * sans redeploiement (company-view lit /api/floutage-zones au chargement).
 */
import { createClient } from "@supabase/supabase-js";
import type { Zone } from "@/lib/floutage";

const PAGE_KEY = "floutage";
const SECTION_GLOBAL = "zones";

function sectionPour(ticker?: string | null): string {
  return ticker ? `zones:${ticker.toUpperCase()}` : SECTION_GLOBAL;
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function lit(section: string): Promise<Zone[] | null> {
  const { data } = await admin()
    .from("desk_page_content")
    .select("content_fr")
    .eq("page_key", PAGE_KEY)
    .eq("section_key", section)
    .maybeSingle();
  if (!data) return null;
  try {
    const parsed = JSON.parse(data.content_fr ?? "[]");
    return Array.isArray(parsed) ? (parsed as Zone[]) : [];
  } catch {
    return [];
  }
}

/** Zones EFFECTIVES pour une societe : override si present, sinon global. */
export async function chargeZonesFloutage(ticker?: string | null): Promise<{
  zones: Zone[];
  portee: "societe" | "globale";
}> {
  if (ticker) {
    const propre = await lit(sectionPour(ticker));
    if (propre !== null) return { zones: propre, portee: "societe" };
  }
  return { zones: (await lit(SECTION_GLOBAL)) ?? [], portee: "globale" };
}

export async function enregistreZonesFloutage(
  zones: Zone[],
  ticker?: string | null,
): Promise<void> {
  const { error } = await admin()
    .from("desk_page_content")
    .upsert(
      {
        page_key: PAGE_KEY,
        section_key: sectionPour(ticker),
        content_fr: JSON.stringify(zones),
      },
      { onConflict: "page_key,section_key" },
    );
  if (error) throw new Error(error.message);
}

/** Retire l override d une societe : elle revient au reglage global. */
export async function supprimeZonesFloutage(ticker: string): Promise<void> {
  const { error } = await admin()
    .from("desk_page_content")
    .delete()
    .eq("page_key", PAGE_KEY)
    .eq("section_key", sectionPour(ticker));
  if (error) throw new Error(error.message);
}
