/**
 * Chargeur Turbopack (8 oct 2026, audit des fuites publiques, lignes 8, 14, 24).
 *
 * Applique AUTOMATIQUEMENT, et seulement au code envoye au navigateur
 * (condition "browser" dans next.config.ts), a tout fichier src/data/*.json
 * importe par un composant client. Il retire la cuisine interne avant
 * qu elle n arrive dans les chunks publics :
 *   - cles commencant par "_" qui portent une note, une doc, un commentaire,
 *     une source, un motif (_doc, _note, _eu_note, _gate_fix_note, _source...) ;
 *   - toute cle commencant par "_" dont la valeur texte cite le prenom du
 *     fondateur, un chemin local ou un script interne ;
 *   - les champs generation / source / script qui citent un script interne
 *     (ex. "scripts/build-home-wow.py").
 * Le code serveur lit toujours les fichiers complets (regle non appliquee).
 * Permanent : toute nouvelle note ajoutee a un JSON est filtree sans action.
 */
const CLE_INTERNE = /^_.*(note|doc|comment|todo|source|origine|audit|fix|regle|raison|reason|motif|why|explication_interne)/i;
const TEXTE_INTERNE = /\bYann\b|\/Users\/|scripts\/[A-Za-z0-9_\-]+\.(py|ts|mjs|cjs|sh)|\.conv-state|\.batches-drafts|data-lake/;
const CHAMPS_SCRIPT = new Set(["generation", "source", "script", "genere_par", "generated_by"]);

function nettoie(v) {
  if (Array.isArray(v)) return v.map(nettoie);
  if (v && typeof v === "object") {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      if (k.startsWith("_") && (CLE_INTERNE.test(k) || (typeof x === "string" && TEXTE_INTERNE.test(x)))) continue;
      if (CHAMPS_SCRIPT.has(k) && typeof x === "string" && /scripts\//.test(x)) continue;
      out[k] = nettoie(x);
    }
    return out;
  }
  return v;
}

// Listes de tickers utilisees cote navigateur pour un simple test
// d appartenance : livrees en empreintes (voir src/lib/empreinte-ticker.ts,
// meme fonction). La liste des societes n est plus lisible dans le JS.
const LISTES_EN_EMPREINTES = /(^|[\\/])(logo-tickers|light-bg-tickers)\.json$/;
function empreinteTicker(t) {
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return "h" + (h >>> 0).toString(36);
}

module.exports = function assainirJsonClient(source) {
  let donnees;
  try {
    donnees = JSON.parse(typeof source === "string" ? source : source.toString("utf8"));
  } catch {
    return `module.exports = ${source};`;
  }
  const chemin = (this && this.resourcePath) || "";
  if (LISTES_EN_EMPREINTES.test(chemin) && Array.isArray(donnees)) {
    donnees = [...new Set(donnees.map((t) => empreinteTicker(String(t).toUpperCase())))].sort();
  } else {
    donnees = nettoie(donnees);
  }
  return `module.exports = JSON.parse(${JSON.stringify(JSON.stringify(donnees))});`;
};
