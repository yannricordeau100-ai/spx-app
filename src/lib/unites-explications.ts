/**
 * Explications des unités d'axe Y non évidentes (Yann 2 sept 2026).
 *
 * Dès qu'un KPI porte une unité "pas simple" (points de base, gigawatts,
 * pieds cubes de gaz, barils par jour...), le tooltip "i" du titre du KPI
 * ajoute une ligne qui explique l'unité en français courant. Les unités
 * évidentes (Mds $, %, magasins, clients...) ne déclenchent rien.
 *
 * Le matching est fait sur l'unité NORMALISÉE (minuscules, espaces réduits) ;
 * d'abord par égalité exacte, puis par motif pour les familles (/d, /j...).
 * Secteur énergie traité en priorité, à la demande de Yann.
 */

const norm = (u: string) => u.trim().toLowerCase().replace(/\s+/g, " ");

/** Égalité exacte après normalisation. */
const EXACTES: Record<string, string> = {
  bps: "Points de base : 1 bps = 0,01 point de pourcentage. 50 bps = 0,5 point.",
  pp: "Points de pourcentage : écart entre deux pourcentages (passer de 20 % à 22 % = +2 points).",
  pt: "Points de pourcentage : écart entre deux pourcentages (passer de 20 % à 22 % = +2 points).",
  pts: "Points de pourcentage : écart entre deux pourcentages (passer de 20 % à 22 % = +2 points).",
  points: "Points de pourcentage : écart entre deux pourcentages (passer de 20 % à 22 % = +2 points).",
  x: "Multiple : rapport entre deux grandeurs. 2x = le double. Pour un book-to-bill, un ratio au-dessus de 1x veut dire plus de commandes reçues que de ventes facturées.",
  mw: "Mégawatts : puissance électrique instantanée (capacité). 1 MW alimente environ 1 000 foyers.",
  gw: "Gigawatts : puissance électrique instantanée (capacité). 1 GW = 1 000 MW, l'ordre de grandeur d'un réacteur nucléaire.",
  kwh: "Kilowattheures : énergie effectivement produite ou vendue sur une période (puissance x durée).",
  mwh: "Mégawattheures : énergie effectivement produite ou vendue sur une période. 1 MWh = 1 000 kWh.",
  gwh: "Gigawattheures : énergie effectivement produite ou vendue sur une période. 1 GWh = 1 million de kWh.",
  twh: "Térawattheures : énergie effectivement produite ou vendue sur une période. 1 TWh = 1 milliard de kWh, la consommation annuelle d'environ 200 000 foyers.",
  "millions kwh": "Millions de kilowattheures : énergie électrique vendue sur la période.",
  "millions de kwh": "Millions de kilowattheures : énergie électrique vendue sur la période.",
  bcf: "Milliards de pieds cubes de gaz naturel (1 Bcf = environ 28 millions de m3).",
  mmcf: "Millions de pieds cubes de gaz naturel (1 MMcf = environ 28 300 m3).",
  mmbtu: "Millions de BTU : quantité d'énergie thermique, l'unité de vente du gaz naturel en Amérique du Nord.",
  mboed: "Milliers de barils équivalent pétrole par jour : production quotidienne, gaz converti en équivalent pétrole.",
  "boe/d": "Barils équivalent pétrole par jour : production quotidienne, gaz converti en équivalent pétrole.",
  kt: "Milliers de tonnes.",
  "t$": "Milliers de milliards de dollars (trillions).",
  $t: "Milliers de milliards de dollars (trillions).",
  "t usd": "Milliers de milliards de dollars (trillions).",
  "sq ft": "Pieds carrés : 1 sq ft = environ 0,09 m2 (10 sq ft = environ 1 m2).",
  "m sq ft": "Millions de pieds carrés : 1 million de sq ft = environ 93 000 m2.",
  acres: "Acres : 1 acre = environ 0,4 hectare (4 047 m2).",
  miles: "Miles : 1 mile = environ 1,6 km.",
};

/** Familles par motif (débits par jour, variantes d'écriture). */
const MOTIFS: Array<[RegExp, string]> = [
  [/^mbbl\s*\/\s*[dj]$/, "Milliers de barils par jour : débit quotidien de pétrole ou de liquides de gaz."],
  [/^bcf\s*\/\s*[dj]$/, "Milliards de pieds cubes de gaz naturel PAR JOUR : un débit, pas un stock (1 Bcf = environ 28 millions de m3)."],
  [/^mmcf\s*\/\s*[dj]$/, "Millions de pieds cubes de gaz naturel PAR JOUR : un débit, pas un stock (1 MMcf = environ 28 300 m3)."],
  [/^(m|k)?boe(d|\s*\/\s*[dj])$/, "Barils équivalent pétrole par jour : production quotidienne, gaz converti en équivalent pétrole."],
];

/**
 * Explication FR de l'unité, ou null si l'unité est jugée évidente.
 */
export function expliqueUnite(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const u = norm(unit);
  if (EXACTES[u]) return EXACTES[u];
  for (const [re, txt] of MOTIFS) if (re.test(u)) return txt;
  return null;
}
