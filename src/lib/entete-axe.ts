/**
 * En-tete d unite de l axe Y (Yann 30 aout 2026).
 *
 * Regle posee par Yann :
 * - l en-tete se place AU-DESSUS des nombres de l axe, aligne sur leur bord ;
 * - axe a GAUCHE : s il est long, il peut deborder vers la droite, c est a
 *   dire au-dessus du graphique (zone vide) ; une seule ligne suffit donc ;
 * - axe a DROITE : il deborde aussi vers la droite (hors du graphique), MAIS
 *   jamais au point d etre coupe par le bord du cadre. En cas de necessite
 *   absolue seulement, le mot est coupe avec un tiret et continue a la ligne.
 */
export type EnteteAxe = { lignes: string[]; x: number; anchor: "start" };

export function calculeEnteteAxe(
  header: string,
  yOnRight: boolean,
  dims: { W: number; PAD_LEFT: number; INNER_W: number },
  fontSize = 13,
): EnteteAxe {
  const largeurCar = fontSize * 0.62;
  if (!yOnRight) {
    // Axe a gauche : depart au bord gauche du cadre, debordement vers le
    // graphique autorise (la bande au-dessus des graduations est vide).
    return { lignes: [header], x: 6, anchor: "start" };
  }
  const x = dims.PAD_LEFT + dims.INNER_W + 12;
  const dispo = dims.W - x - 2;
  if (header.length * largeurCar <= dispo) {
    return { lignes: [header], x, anchor: "start" };
  }
  // Necessite absolue : couper. D abord sur une espace, sinon dans le mot
  // avec un tiret.
  const maxCars = Math.max(3, Math.floor(dispo / largeurCar));
  const espace = header.lastIndexOf(" ", maxCars);
  if (espace > 2) {
    return {
      lignes: [header.slice(0, espace), header.slice(espace + 1)],
      x,
      anchor: "start",
    };
  }
  return {
    lignes: [header.slice(0, maxCars - 1) + "-", header.slice(maxCars - 1)],
    x,
    anchor: "start",
  };
}
