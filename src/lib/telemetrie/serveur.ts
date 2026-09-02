/**
 * Télémétrie première partie, côté serveur (Yann 31 août 2026).
 *
 * Choix assumé : AUCUN traqueur tiers (Google Analytics, Meta Pixel, Hotjar...).
 * Un traqueur tiers imposerait un bandeau de consentement et contredirait la
 * politique de confidentialité publiée (« aucun cookie publicitaire ou de
 * profilage »). Tout est mesuré en première partie, comme le font en interne
 * les hyperscalers : les événements partent vers NOTRE base, jamais ailleurs.
 *
 * L'IP n'est jamais stockée en clair : hachage SHA-256 salé, qui permet de
 * compter des visiteurs distincts sans pouvoir remonter à l'adresse.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

export type EvenementTelemetrie = {
  type: string;
  nom: string;
  session_id?: string | null;
  user_id?: string | null;
  chemin?: string | null;
  referrer?: string | null;
  pays?: string | null;
  appareil?: string | null;
  navigateur?: string | null;
  os?: string | null;
  ecran?: string | null;
  langue?: string | null;
  duree_ms?: number | null;
  ip_hash?: string | null;
  props?: Record<string, unknown>;
  ts?: string;
};

const TYPES_VALIDES = new Set([
  "page", "clic", "erreur", "api", "scroll", "perf", "email", "serveur",
]);

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function hacheIp(ip: string): string {
  // Sel fixe côté serveur : suffit pour empêcher l inversion par dictionnaire
  // d IP, tout en gardant des comptages stables d un jour a l autre.
  const sel = process.env.TELEMETRIE_SEL ?? "mettrik-telemetrie-2026";
  return createHash("sha256").update(sel + ip).digest("hex").slice(0, 32);
}

const borne = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.length > 0 ? v.slice(0, max) : null;

/** Nettoie un evenement brut venu du client. Renvoie null s il est invalide. */
export function nettoieEvenement(brut: unknown): EvenementTelemetrie | null {
  if (!brut || typeof brut !== "object") return null;
  const e = brut as Record<string, unknown>;
  const type = typeof e.type === "string" ? e.type : "";
  const nom = borne(e.nom, 160);
  if (!TYPES_VALIDES.has(type) || !nom) return null;
  const duree = typeof e.duree_ms === "number" && Number.isFinite(e.duree_ms)
    ? Math.max(0, Math.min(3_600_000, Math.round(e.duree_ms)))
    : null;
  let props: Record<string, unknown> = {};
  if (e.props && typeof e.props === "object" && !Array.isArray(e.props)) {
    // Volume borne : 20 cles, valeurs texte tronquees.
    for (const [k, v] of Object.entries(e.props as Record<string, unknown>).slice(0, 20)) {
      props[k.slice(0, 60)] =
        typeof v === "string" ? v.slice(0, 400) : typeof v === "number" || typeof v === "boolean" ? v : String(v).slice(0, 200);
    }
  }
  return {
    type,
    nom,
    session_id: borne(e.session_id, 64),
    chemin: borne(e.chemin, 300),
    referrer: borne(e.referrer, 300),
    appareil: borne(e.appareil, 20),
    navigateur: borne(e.navigateur, 40),
    os: borne(e.os, 40),
    ecran: borne(e.ecran, 20),
    langue: borne(e.langue, 20),
    duree_ms: duree,
    props,
  };
}

/** Insere un lot d evenements. Ne jette jamais : la telemetrie ne casse rien. */
export async function insereEvenements(evts: EvenementTelemetrie[]): Promise<boolean> {
  if (!evts.length) return true;
  try {
    const { error } = await admin().from("telemetrie_evenements").insert(
      evts.map((e) => ({ ...e, props: e.props ?? {} })),
    );
    return !error;
  } catch {
    return false;
  }
}

/** Evenement cote serveur (connexion, checkout, export...). Fire-and-forget. */
export function enregistreEvenementServeur(
  nom: string,
  props?: Record<string, unknown>,
  user_id?: string | null,
): void {
  void (async () => {
    // Exclusions (Yann 2 sept 2026) : ses comptes ne comptent pas non plus
    // pour les evenements serveur (connexion, export...).
    if (user_id) {
      const { chargeConfigTelemetrie } = await import("@/lib/desk/telemetrie-store");
      const config = await chargeConfigTelemetrie();
      if (config.usersExclus.includes(user_id)) return;
    }
    await insereEvenements([{ type: "serveur", nom: nom.slice(0, 160), props, user_id: user_id ?? null }]);
  })().catch(() => {});
}
