/**
 * Tables du back-office lues par le chargeur de fiche, EN UNE FOIS (13 oct 2026).
 *
 * Avant : quatre requetes par societe (desk_image_findings, desk_special_kpis,
 * desk_att, desk_these), soit ~58 000 lignes de journal Supabase par jour, a
 * cause des balayages des ~660 societes. Desormais une requete par table,
 * mise en cache (src/lib/cache-partage.ts), puis lecture par ticker en memoire.
 * Contenu et ordre identiques aux anciennes requetes par societe.
 *
 * Invalidation : chaque route d ecriture appelle invalider() sur la table
 * touchee (graphiques moyen terme, KPI speciaux, anti-these).
 */
import { createClient } from "@supabase/supabase-js";
import { tableEnCache } from "@/lib/cache-partage";
import { triPostgres } from "@/lib/tri-postgres";
import type { ImageFinding } from "@/lib/desk/image-findings";
import type { SpecialKpi } from "@/lib/desk/special-kpis";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Table absente de la base (PostgREST : 404, code PGRST205 ou 42P01). */
function estTableAbsente(error: { code?: string; message?: string } | null, status?: number): boolean {
  if (!error) return false;
  return status === 404 || error.code === "PGRST205" || error.code === "42P01";
}

// --- desk_image_findings : graphiques approuves, non rejetes (~250 lignes) ---
// Lues SANS tri, donc dans l ordre physique de la table : le tri par
// display_order est refait par societe avec l algorithme de PostgreSQL
// (tri-postgres.ts), pour que les graphiques de meme rang gardent l ordre
// exact que donnait l ancienne requete par societe.
export const tableFindingsApprouves = tableEnCache<ImageFinding[]>(
  "desk_image_findings-approuves-v2",
  async () => {
    const tous: ImageFinding[] = [];
    const PAGE = 1000;
    for (let debut = 0; ; debut += PAGE) {
      const { data, error } = await admin()
        .from("desk_image_findings")
        .select("*")
        .eq("approved", true)
        .eq("rejected", false)
        .range(debut, debut + PAGE - 1);
      if (error) throw new Error(error.message);
      tous.push(...((data ?? []) as ImageFinding[]));
      if (!data || data.length < PAGE) break;
    }
    return tous;
  },
  { etiquette: "table-desk-image-findings" },
);

/** Graphiques approuves d une societe (meme filtre et meme ordre qu avant). */
export async function findingsApprouvesPour(ticker: string): Promise<ImageFinding[]> {
  const T = ticker.toUpperCase();
  const tous = await tableFindingsApprouves.lire();
  const lignes = tous.filter((f) => Array.isArray(f.target_tickers) && f.target_tickers.includes(T));
  // ORDER BY display_order ASC : valeurs nulles en dernier, comme PostgreSQL.
  const rang = (f: ImageFinding) => (typeof f.display_order === "number" ? f.display_order : Number.POSITIVE_INFINITY);
  // Copies : le chargeur modifie ces objets sur place (harmonisation des
  // periodes) ; sans copie, une fiche heriterait des retouches d une autre.
  return triPostgres(structuredClone(lignes), (a, b) => {
    const x = rang(a);
    const y = rang(b);
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

// --- desk_special_kpis : KPI speciaux publies (4 lignes au 13 oct) ---
export const tableSpecialPublies = tableEnCache<SpecialKpi[]>(
  "desk_special_kpis-publies-v1",
  async () => {
    const { data, error } = await admin().from("desk_special_kpis").select("*").eq("published", true);
    if (error) throw new Error(error.message);
    return (data ?? []) as SpecialKpi[];
  },
  { etiquette: "table-desk-special-kpis" },
);

/** KPI speciaux publies d une societe : ticker principal ou liste cible. */
export async function specialPubliesPour(ticker: string): Promise<SpecialKpi[]> {
  const T = ticker.toUpperCase();
  const tous = await tableSpecialPublies.lire();
  return structuredClone(
    tous.filter((k) => k.ticker === T || (Array.isArray(k.target_tickers) && k.target_tickers.includes(T))),
  );
}

// --- desk_att et desk_these : payload par ticker, ou table absente ---
export type TablePayloads = { absente: boolean; parTicker: Record<string, unknown> };

function tablePayloads(table: "desk_att" | "desk_these", etiquette: string) {
  return tableEnCache<TablePayloads>(
    `${table}-payloads-v1`,
    async () => {
      const { data, error, status } = await admin().from(table).select("ticker, payload");
      // desk_these n existe pas en base (13 oct 2026) : l absence est memorisee
      // comme un contenu vide, plus aucun appel par societe.
      if (estTableAbsente(error, status)) return { absente: true, parTicker: {} };
      if (error) throw new Error(error.message);
      const parTicker: Record<string, unknown> = {};
      for (const l of (data ?? []) as { ticker?: string; payload?: unknown }[]) {
        if (l.ticker) parTicker[String(l.ticker).toUpperCase()] = l.payload;
      }
      return { absente: false, parTicker };
    },
    { etiquette },
  );
}

export const tableAtt = tablePayloads("desk_att", "table-desk-att");
export const tableThese = tablePayloads("desk_these", "table-desk-these");

/**
 * Remplit la memoire des quatre tables depuis le cache partage, AVANT la
 * construction d une fiche (qui tourne dans un unstable_cache imbrique, ou le
 * cache partage est contourne). Jamais d exception.
 */
export async function prechaufferTablesFiche(): Promise<void> {
  await Promise.all([
    tableFindingsApprouves.prechauffer(),
    tableSpecialPublies.prechauffer(),
    tableAtt.prechauffer(),
    tableThese.prechauffer(),
  ]);
}
