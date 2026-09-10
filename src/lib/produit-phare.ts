import { createClient } from "@supabase/supabase-js";
import { revalidateTag } from "next/cache";
import REGISTRE from "@/data/produit-phare.json";

/**
 * KPI « produit phare » (Yann, 9 sept 2026).
 *
 * Pour chaque société Industrie / Consommation, un KPI annuel (10 exercices)
 * du produit phare a été posé dans kpis-haut et promu hero. Le registre
 * src/data/produit-phare.json (écrit par le script de pose) garde, par
 * société, le ou les candidats posés, le hero précédent et le type
 * d exception. La page /sandbox/produit-phare ne montre QUE les exceptions
 * (hésitation entre deux produits, ou aucun produit phare identifié) ; le
 * propriétaire y coche A, B ou « pas de KPI », et le choix est appliqué
 * immédiatement sur le hero (Supabase desk_hero_kpi_overrides).
 */

export type CandidatPhare = { produit: string; short: string; points: number; statut: string };
export type EntreePhare = {
  candidat_A?: CandidatPhare;
  candidat_B?: CandidatPhare;
  exception?: "hesitation" | "sans_produit" | null;
  exception_detail?: { type: string; raison?: string | null; verif?: string | null; A?: { produit?: string | null } | null; B?: { produit?: string | null; raison?: string | null } | null };
  hero_precedent?: string | null;
  hero?: string | null;
  nom?: string | null;
};
export type ChoixPhare = "A" | "B" | "aucun";

type Registre = { stes: Record<string, EntreePhare> };

export function lireRegistre(): Registre {
  return REGISTRE as unknown as Registre;
}

/** Exceptions seules (hésitation ou sans produit), triées par ticker. */
export function exceptionsPhare(): Array<{ ticker: string } & EntreePhare> {
  const r = lireRegistre();
  return Object.entries(r.stes)
    .filter(([, e]) => e.exception)
    .map(([ticker, e]) => ({ ticker, ...e }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
}

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function lireChoixPhare(): Promise<Record<string, ChoixPhare>> {
  try {
    const { data } = await admin()
      .from("desk_page_content")
      .select("content_fr")
      .eq("page_key", "produit_phare")
      .eq("section_key", "choix")
      .maybeSingle();
    const brut = data?.content_fr ? (JSON.parse(data.content_fr) as Record<string, ChoixPhare>) : {};
    return brut && typeof brut === "object" ? brut : {};
  } catch {
    return {};
  }
}

/** Enregistre le choix et applique le hero correspondant (A, B ou hero précédent). */
export async function appliquerChoixPhare(ticker: string, choix: ChoixPhare): Promise<{ hero: string | null }> {
  const t = ticker.toUpperCase();
  const e = lireRegistre().stes[t];
  if (!e) throw new Error("société absente du registre");
  const hero = choix === "A" ? e.candidat_A?.short ?? null : choix === "B" ? e.candidat_B?.short ?? null : e.hero_precedent ?? null;
  const sb = admin();
  const tous = await lireChoixPhare();
  tous[t] = choix;
  await sb
    .from("desk_page_content")
    .upsert({ page_key: "produit_phare", section_key: "choix", content_fr: JSON.stringify(tous) }, { onConflict: "page_key,section_key" });
  if (hero) {
    await sb
      .from("desk_hero_kpi_overrides")
      .upsert({ ticker: t, hero_kpi_short: hero, updated_at: new Date().toISOString(), updated_by: "sandbox/produit-phare" }, { onConflict: "ticker" });
  } else {
    await sb.from("desk_hero_kpi_overrides").delete().eq("ticker", t);
  }
  try {
    const { invalidateHeroOverridesCache } = await import("@/lib/company-core/hero-kpi-overrides");
    invalidateHeroOverridesCache();
  } catch {
    /* best effort */
  }
  revalidateTag("fiches", "max");
  return { hero };
}
