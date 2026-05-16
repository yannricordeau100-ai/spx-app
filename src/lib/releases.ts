/**
 * Releases — gestion des versions par niveau (Yann 16 mai 2026).
 *
 * Architecture 3 niveaux :
 *   - 'live' : visible www.mettrik.ai (public)
 *   - 'pre-live' : pre.mettrik.ai (gated admin)
 *   - 'dev' : staging.mettrik.ai (gated admin)
 *
 * Versions invisible côté HTML public, exposées via :
 *   - header HTTP X-Mettrik-Version (visible curl + Network tab inspector)
 *   - endpoint /api/version (JSON minimal pour /live, full pour /pre + /dev)
 *   - page back-office /desk-mtk9x4kp/releases (historique complet)
 */
import { createClient } from "@supabase/supabase-js";

export type ReleaseLevel = "live" | "pre-live" | "dev";
export type ReleaseStatus = "current" | "archived" | "failed" | "pending";

/**
 * Versions utilisateur sur chaque niveau (Yann 17 mai 2026).
 * Le niveau 0 LIVE expose 4 versions distinctes :
 *   - visitor : non inscrit (rendu via isPublicPath dans proxy.ts)
 *   - free / premium / max : inscrit avec plan correspondant
 * Chaque version a sa propre matrice langues × pays.
 */
export type UserVariant = "visitor" | "free" | "premium" | "max";

export const ALL_USER_VARIANTS: readonly UserVariant[] = [
  "visitor",
  "free",
  "premium",
  "max",
] as const;

export const VARIANT_LABELS: Record<UserVariant, string> = {
  visitor: "Visiteur (non inscrit)",
  free: "Free (inscrit)",
  premium: "Premium",
  max: "Max",
};

/**
 * Structure type pour `variants_meta` d'une release.
 * Décrit quelles versions × langues × pays sont effectivement actives.
 */
export type VariantsMeta = {
  variants?: UserVariant[];          // versions actives (subset de ALL_USER_VARIANTS)
  locales?: string[];                // langues actives (subset de fr/en/de/nl/sv/da/en-GB/de-CH)
  country_overrides?: string[];      // pays avec variant pays-spécifique
  notes?: string;
};

export type Release = {
  id: string;
  level: ReleaseLevel;
  version: string;
  git_sha: string | null;
  vercel_url: string | null;
  status: ReleaseStatus;
  notes: string | null;
  variants_meta: Record<string, unknown>;
  deployed_at: string;
  deployed_by: string | null;
  archived_at: string | null;
  created_at: string;
};

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** Détecte le niveau actif depuis le hostname (utilisé par middleware + endpoints). */
export function levelFromHostname(hostname: string | null | undefined): ReleaseLevel {
  if (!hostname) return "dev";
  const h = hostname.toLowerCase();
  if (h === "www.mettrik.ai" || h === "mettrik.ai") return "live";
  if (h.startsWith("pre.")) return "pre-live";
  return "dev"; // staging.mettrik.ai, mettrik-staging.vercel.app, localhost, previews
}

/** Récupère la release courante d'un niveau (cached côté lib si besoin). */
export async function getCurrentRelease(level: ReleaseLevel): Promise<Release | null> {
  try {
    const supa = admin();
    const { data } = await supa
      .from("desk_releases")
      .select("*")
      .eq("level", level)
      .eq("status", "current")
      .order("deployed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data ?? null) as Release | null;
  } catch {
    return null;
  }
}

/** Historique complet d'un niveau, du plus récent au plus ancien. */
export async function listReleases(level?: ReleaseLevel): Promise<Release[]> {
  try {
    const supa = admin();
    const q = supa.from("desk_releases").select("*");
    if (level) q.eq("level", level);
    const { data } = await q.order("deployed_at", { ascending: false });
    return (data ?? []) as Release[];
  } catch {
    return [];
  }
}

/** Crée une nouvelle release. Archive l'ancienne current du même niveau. */
export async function createRelease(p: {
  level: ReleaseLevel;
  version: string;
  git_sha?: string;
  vercel_url?: string;
  notes?: string;
  variants_meta?: Record<string, unknown>;
  deployed_by?: string;
}): Promise<Release> {
  const supa = admin();
  // Archive l'ancienne current
  await supa
    .from("desk_releases")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("level", p.level)
    .eq("status", "current");
  // Insert la nouvelle
  const { data, error } = await supa
    .from("desk_releases")
    .insert({
      level: p.level,
      version: p.version,
      git_sha: p.git_sha ?? null,
      vercel_url: p.vercel_url ?? null,
      status: "current",
      notes: p.notes ?? null,
      variants_meta: p.variants_meta ?? {},
      deployed_by: p.deployed_by ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Release;
}
