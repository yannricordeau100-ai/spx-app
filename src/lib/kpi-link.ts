/**
 * Micro-lien de partage d un KPI (Yann 3 sept 2026).
 * mettrik.ai/k/<ticker>/<code> renvoie directement sur la fiche avec le KPI
 * promu en principal. Le code est un condense stable du `short` du KPI :
 * 5 caracteres, sans table en base, recalculable partout (client, serveur).
 */
export function codeKpi(short: string): string {
  let h = 2166136261;
  for (let i = 0; i < short.length; i++) {
    h ^= short.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36).padStart(5, "0").slice(-5);
}

export function lienCourtKpi(ticker: string, short: string, base = "https://mettrik.ai"): string {
  return `${base}/k/${ticker.toLowerCase()}/${codeKpi(short)}`;
}

/** Texte du post X : court, un chiffre, une variation, un cashtag, un lien.
 *  Regles X : 280 caracteres max, le lien compte 23, pas de hashtag en rafale. */
export function textePartageX(p: {
  societe: string; ticker: string; kpi: string; valeur: string; unite?: string; variation?: string | null; periode?: string | null;
}): string {
  const val = `${p.valeur}${p.unite ? " " + p.unite : ""}`.trim();
  const variaFr = p.variation ? p.variation.replace(".", ",").replace(/(\d)%/, "$1 %") : "";
  const varia = variaFr ? ` (${variaFr} vs N-1)` : "";
  const per = p.periode ? ` au ${p.periode}` : "";
  const corps = `${p.societe} $${p.ticker.toUpperCase().replace(/[.-].*$/, "")} : ${p.kpi}${per} = ${val}${varia}.`;
  const signature = "\nChiffre extrait des rapports officiels, via Mettrik AI";
  const texte = corps + signature;
  return texte.length > 250 ? corps.slice(0, 247) + "..." : texte;
}
