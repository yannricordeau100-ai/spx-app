/**
 * att.ts — types et helpers CLIENT-SAFE du bloc "Anti-thèse d'investissement".
 *
 * Spec : .conv-state/att-spec.md (validée Yann 10 août 2026).
 * Données : src/data/att/<ticker minuscule>.json, override Supabase `desk_att`
 * (lecture server-only dans src/lib/att-server.ts, ne PAS importer ici).
 *
 * Gating : le contenu complet (resume, sections, glossaire) est réservé au
 * plan Max. Pour tout autre tier, `gateAttForTier` retire le contenu côté
 * SERVEUR avant sérialisation : le texte complet n'est jamais envoyé au
 * client non abonné (anti-triche view-source / devtools).
 */

export type AttIntensite = "faible" | "moderee" | "elevee";

export type AttArgument = {
  titre: string;
  argument: string;
  preuve?: string;
};

export type AttQuantitatif = {
  titre: string;
  chiffre: string;
  perspective?: string;
  source?: string;
};

export type CompanyAtt = {
  ticker: string;
  redigee_le: string;
  donnees_arretees_au?: string;
  intensite: AttIntensite;
  /** Toujours visible par tous, en clair. */
  hook: string;
  resume?: string;
  fondamental_interne?: AttArgument[];
  fondamental_externe?: AttArgument[];
  quantitatif?: AttQuantitatif[];
  ce_qui_affaiblirait?: string[];
  glossaire?: Record<string, string>;
  /** true = contenu retiré côté serveur (visiteur sans plan Max). */
  locked?: boolean;
  /** Métadonnées internes (jamais sérialisées vers le client). */
  _sources?: string[];
  _redige_par?: string;
  _fige?: boolean;
};

const INTENSITES: ReadonlySet<string> = new Set(["faible", "moderee", "elevee"]);

/** Coercion défensive : renvoie null si le JSON n'a pas le minimum requis. */
export function coerceAtt(raw: unknown): CompanyAtt | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const hook = typeof o.hook === "string" ? o.hook.trim() : "";
  const redigee = typeof o.redigee_le === "string" ? o.redigee_le : "";
  const intensite = typeof o.intensite === "string" && INTENSITES.has(o.intensite)
    ? (o.intensite as AttIntensite)
    : null;
  if (!hook || !redigee || !intensite) return null;
  return o as unknown as CompanyAtt;
}

/**
 * Version sérialisable vers le client selon le tier freemium.
 * - tier "max" : contenu complet, métadonnées internes (_*) retirées.
 * - tout autre tier : UNIQUEMENT titre implicite + intensité + dates + hook,
 *   avec `locked: true`. Aucun texte réservé n'atteint le HTML.
 */
export function gateAttForTier(
  att: CompanyAtt,
  tier: string | undefined,
): CompanyAtt {
  const header: CompanyAtt = {
    ticker: att.ticker,
    redigee_le: att.redigee_le,
    donnees_arretees_au: att.donnees_arretees_au,
    intensite: att.intensite,
    hook: att.hook,
  };
  if (tier !== "max") {
    return { ...header, locked: true };
  }
  return {
    ...header,
    locked: false,
    resume: att.resume,
    fondamental_interne: att.fondamental_interne,
    fondamental_externe: att.fondamental_externe,
    quantitatif: att.quantitatif,
    ce_qui_affaiblirait: att.ce_qui_affaiblirait,
    glossaire: att.glossaire,
  };
}
