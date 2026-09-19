/**
 * these.ts — types et helpers CLIENT-SAFE du bloc « Thèse d'investissement ».
 *
 * Miroir de l'anti-thèse (att.ts), demande de Yann du 19 sept 2026 :
 * le cas favorable, rédigé selon les critères d'un investisseur célèbre,
 * d'une grande banque ou d'une méthode reconnue, la valorisation étant
 * volontairement ignorée. Données : src/data/these/<ticker minuscule>.json
 * (lecture server-only dans src/lib/these-server.ts, ne PAS importer ici).
 *
 * Gating : comme l'anti-thèse, le contenu complet est réservé au plan Max.
 * `gateTheseForTier` retire le contenu côté SERVEUR avant sérialisation.
 */

export type TheseConviction = "faible" | "moderee" | "elevee";

export type TheseStyle = {
  nom: string;
  type: "investisseur" | "banque" | "methode";
  justification?: string;
  criteres?: string[];
};

export type TheseArgument = {
  titre: string;
  argument: string;
  preuve?: string;
  /** Shorts des KPI de la fiche mobilisés par l'argument. */
  kpis?: string[];
  /** Critère du style choisi confronté aux faits. */
  critere_style?: string;
};

export type TheseQuantitatif = {
  titre: string;
  chiffre: string;
  perspective?: string;
  source?: string;
  kpi?: string;
};

export type TheseGraphique = {
  titre: string;
  lecture?: string;
  source_nom?: string;
  source_url?: string;
  source_date?: string;
  /** Chemins publics des SVG générés au gabarit Mettrik. */
  image_dark?: string;
  image_light?: string;
};

export type TheseElementAdditionnel = {
  titre: string;
  texte: string;
  source?: string;
};

export type CompanyThese = {
  ticker: string;
  redigee_le: string;
  donnees_arretees_au?: string;
  style: TheseStyle;
  preambule?: string;
  conviction: TheseConviction;
  /** Toujours visible par tous, en clair. */
  hook: string;
  resume?: string;
  qualite_interne?: TheseArgument[];
  dynamique_externe?: TheseArgument[];
  quantitatif?: TheseQuantitatif[];
  graphique_externe?: TheseGraphique | null;
  /** Ajout personnel, clairement séparé et retirable sans casser la thèse. */
  element_additionnel?: TheseElementAdditionnel | null;
  ce_qui_invaliderait?: string[];
  glossaire?: Record<string, string>;
  /** true = contenu retiré côté serveur (visiteur sans plan Max). */
  locked?: boolean;
  _sources?: string[];
  _notes?: string;
  _redige_par?: string;
  _fige?: boolean;
};

const CONVICTIONS: ReadonlySet<string> = new Set(["faible", "moderee", "elevee"]);

/** Coercion défensive : renvoie null si le JSON n'a pas le minimum requis. */
export function coerceThese(raw: unknown): CompanyThese | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const hook = typeof o.hook === "string" ? o.hook.trim() : "";
  const redigee = typeof o.redigee_le === "string" ? o.redigee_le : "";
  const conviction =
    typeof o.conviction === "string" && CONVICTIONS.has(o.conviction) ? (o.conviction as TheseConviction) : null;
  const style = o.style && typeof o.style === "object" && typeof (o.style as { nom?: unknown }).nom === "string" ? (o.style as TheseStyle) : null;
  if (!hook || !redigee || !conviction || !style) return null;
  return o as unknown as CompanyThese;
}

/**
 * Version sérialisable vers le client selon le palier.
 * - "max" : contenu complet, métadonnées internes retirées.
 * - autres : en-tête, style, hook, préambule, avec `locked: true`.
 */
export function gateTheseForTier(these: CompanyThese, tier: string | undefined): CompanyThese {
  const header: CompanyThese = {
    ticker: these.ticker,
    redigee_le: these.redigee_le,
    donnees_arretees_au: these.donnees_arretees_au,
    style: { nom: these.style.nom, type: these.style.type, justification: these.style.justification },
    preambule: these.preambule,
    conviction: these.conviction,
    hook: these.hook,
  };
  if (tier !== "max") return { ...header, locked: true };
  return {
    ...header,
    style: these.style,
    locked: false,
    resume: these.resume,
    qualite_interne: these.qualite_interne,
    dynamique_externe: these.dynamique_externe,
    quantitatif: these.quantitatif,
    graphique_externe: these.graphique_externe ?? null,
    element_additionnel: these.element_additionnel ?? null,
    ce_qui_invaliderait: these.ce_qui_invaliderait,
    glossaire: these.glossaire,
  };
}
