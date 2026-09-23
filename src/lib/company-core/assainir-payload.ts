/**
 * Assainissement du paquet envoye au navigateur (Yann 23 sept 2026).
 *
 * Pourquoi : le code source des fiches transportait, invisible a l ecran mais
 * lisible par n importe qui, la cuisine interne de fabrication des donnees :
 * chemins du disque de Yann (« /Users/yann/spx-app/sec-data/... »), noms de
 * sous traitants de generation (« Sub-agent Opus MAJ chunk-01 »), noms de
 * modeles, identifiants de conversations internes (« CONV-... ») et chemins de
 * scripts. Regle posee par Yann : AUCUNE donnee interne ne doit etre visible
 * dans la source de la page.
 *
 * Methode, volontairement conservatrice pour ne rien casser a l affichage :
 *  1. toute cle commencant par « _ » est retiree, SAUF celles que le rendu lit
 *     vraiment (liste CLES_RENDU, etablie en relevant les usages dans
 *     src/components, src/lib/company-core et la page societe) ;
 *  2. les cles de tracabilite sans souligne (model, extracted_by, script...)
 *     sont retirees telles quelles ;
 *  3. pour tout ce qui reste, une valeur texte qui contient une marque interne
 *     dure (chemin disque, sous agent, identifiant de conversation, chemin de
 *     script, nom de fichier de depot) fait disparaitre la cle.
 *
 * Les textes publics ne sont jamais fouilles pour des noms de modeles : une
 * fiche peut legitimement citer Qwen chez Alibaba ou Claude chez Amazon.
 */

/**
 * Cles souligne reellement consommees par l AFFICHAGE : elles restent. Relevees
 * une a une dans src/components. Toutes les autres traces souligne servent au
 * chargement cote serveur, qui a deja fini son travail quand on assainit.
 */
const CLES_RENDU = new Set([
  "_estime", "_estime_libelle", "_kpis_hidden_by_history_rule", "_meta",
]);

/** Cles de tracabilite sans souligne : elles ne servent jamais a l affichage. */
const CLES_TRACABILITE = new Set([
  "model", "extracted_by", "extracted_by_mission20", "extractor", "script",
  "source_file", "source_path", "source_backup", "source_10k", "method",
  "marked_by", "batch", "by", "last_extended_by", "verified_by", "validated_by",
  "file_latest", "file_old", "ceo_name_evidence", "signed_by", "generated_by",
  "enriched_by", "verifier", "reextracted_by", "mode_extraction",
]);

/**
 * Marques internes dures. Volontairement sans les noms de modeles seuls : un
 * texte public peut citer un modele d intelligence artificielle sans que ce
 * soit une fuite.
 */
const MARQUE_INTERNE =
  /\/Users\/|\/private\/(tmp|var)\/|(^|[\s"(/])sec-data\/|sub-?agents?\b|subagent|chunk-\d|CONV-[A-Z0-9]|REEXTRACT|scripts\/[\w./-]+\.(py|js|ts|sh)|\.conv-state|batches-drafts|\.htm\.gz|\.json\.bak|mission-\d|mission-[a-z]-b\d/i;

function valeurInterne(v: unknown): boolean {
  return typeof v === "string" && MARQUE_INTERNE.test(v);
}

/**
 * Renvoie une copie profonde debarrassee de la cuisine interne. L objet passe
 * n est jamais modifie : le chargeur et les scripts continuent de voir leurs
 * traces, seul le paquet servi au navigateur est nettoye.
 */
export function assainirPourClient<T>(valeur: T): T {
  return nettoie(valeur) as T;
}

function nettoie(v: unknown): unknown {
  if (Array.isArray(v)) return v.filter((e) => !valeurInterne(e)).map(nettoie);
  if (v === null || typeof v !== "object") return v;
  if (v instanceof Date) return v;
  const src = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(src)) {
    if (k.startsWith("_") && !CLES_RENDU.has(k)) continue;
    if (CLES_TRACABILITE.has(k)) continue;
    if (valeurInterne(val)) continue;
    out[k] = nettoie(val);
  }
  return out;
}

/** Expose les regles pour les controles automatiques. */
export const REGLES_ASSAINISSEMENT = { CLES_RENDU, CLES_TRACABILITE, MARQUE_INTERNE };
