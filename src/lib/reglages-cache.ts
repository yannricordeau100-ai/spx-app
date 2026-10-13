/**
 * Reglages du back-office lus a chaque page vue, mis en cache (13 oct 2026).
 *
 * Table desk_page_content : telemetrie (page « telemetrie »), floutage et
 * societes visibles en gratuit (page « floutage »), maintenance et tarifs
 * reserves aux inscrits (page « maintenance »). Avant : une requete Supabase
 * par page vue ou par evenement (journaux, docs/rapports-session-2026-10/
 * supabase-journaux.md). Desormais : cache partage de 5 min par page de
 * reglages, vide a chaque enregistrement depuis le back-office, et memoire de
 * 5 s par instance (rafales). Un reglage enregistre se voit donc aussitot.
 *
 * Le proxy garde sa propre lecture de la maintenance (20 s, src/proxy.ts) :
 * la bascule programmee de l ouverture du site doit rester a l heure pile.
 */
import { createClient } from "@supabase/supabase-js";
import { tableEnCache, type TableEnCache } from "@/lib/cache-partage";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Ligne de reglage : contenu brut et drapeau actif. */
export type LigneReglage = { content_fr: string | null; is_active: boolean | null };

/** Toutes les sections d une page de reglages : section_key -> ligne. */
function pageDeReglages(pageKey: string): TableEnCache<Record<string, LigneReglage>> {
  return tableEnCache<Record<string, LigneReglage>>(
    `desk_page_content-${pageKey}-v1`,
    async () => {
      const { data, error } = await admin()
        .from("desk_page_content")
        .select("section_key, content_fr, is_active")
        .eq("page_key", pageKey);
      if (error) throw new Error(error.message);
      const out: Record<string, LigneReglage> = {};
      for (const l of (data ?? []) as { section_key: string; content_fr: string | null; is_active: boolean | null }[]) {
        out[l.section_key] = { content_fr: l.content_fr, is_active: l.is_active };
      }
      return out;
    },
    { etiquette: `reglages-${pageKey}`, memoireNextMs: 5_000 },
  );
}

export const reglagesTelemetrie = pageDeReglages("telemetrie");
export const reglagesFloutage = pageDeReglages("floutage");
export const reglagesMaintenance = pageDeReglages("maintenance");

const PAR_PAGE: Record<string, TableEnCache<Record<string, LigneReglage>>> = {
  telemetrie: reglagesTelemetrie,
  floutage: reglagesFloutage,
  maintenance: reglagesMaintenance,
};

/**
 * Vide le cache d une page de reglages apres une ecriture generique (editeur
 * desk_page_content du back-office). Sans page connue : tout est vide.
 */
export function invaliderReglages(pageKey?: string | null): void {
  if (pageKey && PAR_PAGE[pageKey]) {
    PAR_PAGE[pageKey].invalider();
    return;
  }
  if (pageKey) return;
  for (const t of Object.values(PAR_PAGE)) t.invalider();
}
