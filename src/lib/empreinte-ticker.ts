/**
 * 8 oct 2026 (audit des fuites publiques, ligne 24) : empreinte courte d un
 * ticker (FNV-1a 32 bits, base 36, prefixe "h"). Les listes de tickers dont le
 * navigateur n a besoin que pour un test d appartenance (logos disponibles,
 * logos sur fond clair) sont livrees sous forme d empreintes par le chargeur
 * src/build/assainir-json-client.cjs : la liste des societes n est plus
 * lisible dans le JS servi. Meme fonction des deux cotes (garder identiques).
 */
export function empreinteTicker(t: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return "h" + (h >>> 0).toString(36);
}

/** Appartenance a une liste livree en clair (developpement) ou en empreintes (production). */
export function dansListe(set: ReadonlySet<string>, t: string): boolean {
  return set.has(t) || set.has(empreinteTicker(t));
}
