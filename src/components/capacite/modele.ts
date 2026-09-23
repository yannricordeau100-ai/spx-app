/**
 * Bloc « Capacité de la société à performer dans les conditions de marché actuelles ».
 *
 * Modèle commun aux trois designs A, B et C : types, valeurs de référence,
 * seuils de classement et mise en forme. Ce fichier n'importe AUCUNE donnée,
 * il reste donc minuscule côté navigateur. Le chargement du jeu de 671
 * sociétés se fait dans charger.ts, appelé uniquement côté serveur.
 *
 * Source des ratios : src/data/ratios-rentabilite-stockanalysis.json
 * (stockanalysis.com). Attention, les valeurs y sont des fractions :
 * 1.4539 vaut 145,39 pour cent.
 */

export type CleRatio = "roic" | "roe" | "roa" | "roce";

export const ORDRE_RATIOS: CleRatio[] = ["roic", "roce", "roe", "roa"];

export type PointHistorique = { exercice: string; cloture: string | null; valeur: number | null };

export type RatioBrut = {
  valeur: number | null;
  exercice: string | null;
  cloture: string | null;
  historique?: PointHistorique[];
  cumul_glissant?: number | null;
} | null;

export type CapaciteSociete = {
  ticker: string;
  nom: string;
  exercice: string | null;
  cloture: string | null;
  /** Valeurs en POURCENTAGE (déjà multipliées par 100), ou null si absentes. */
  ratios: Record<CleRatio, number | null>;
};

/* ------------------------------------------------------------------ */
/* Références de marché                                                */
/* ------------------------------------------------------------------ */

export type TypeReference = "sans_risque" | "inflation";

/**
 * Taux sans risque par défaut : rendement de l'emprunt d'État américain
 * à 10 ans, 4,96 pour cent au 22 septembre 2026.
 * Source : U.S. Department of the Treasury, Daily Treasury Par Yield Curve
 * Rates, https://home.treasury.gov/resource-center/data-chart-center/interest-rates/
 * (relevé du 22 septembre 2026, colonne « 10 Yr »).
 * Arrondi au demi point, comme demandé : 5,0 pour cent.
 */
export const DEFAUT_SANS_RISQUE = 5;

/**
 * Inflation par défaut : hausse des prix à la consommation sur douze mois
 * aux États-Unis, 3,4 pour cent pour le mois d'août 2026.
 * Source : U.S. Bureau of Labor Statistics, communiqué « Consumer Price Index,
 * August 2026 », publié le 11 septembre 2026,
 * https://www.bls.gov/news.release/cpi.nr0.htm
 * Arrondi au point, comme demandé : 3 pour cent.
 */
export const DEFAUT_INFLATION = 3;

export type ReglageReference = {
  type: TypeReference;
  /** Valeur en pourcentage choisie par la personne, par référence. */
  sansRisque: number;
  inflation: number;
};

export const REGLAGE_INITIAL: ReglageReference = {
  type: "sans_risque",
  sansRisque: DEFAUT_SANS_RISQUE,
  inflation: DEFAUT_INFLATION,
};

export const BORNES: Record<TypeReference, { min: number; max: number; pas: number }> = {
  // Taux sans risque : de 2 à 15 pour cent, par demi point.
  sans_risque: { min: 2, max: 15, pas: 0.5 },
  // Inflation : de 0 à 15 pour cent, par point entier.
  inflation: { min: 0, max: 15, pas: 1 },
};

export function valeurReference(r: ReglageReference): number {
  return r.type === "sans_risque" ? r.sansRisque : r.inflation;
}

export function libelleReference(t: TypeReference): string {
  return t === "sans_risque" ? "Taux sans risque" : "Taux d'inflation";
}

/* ------------------------------------------------------------------ */
/* Classement vert / orange / rouge                                    */
/* ------------------------------------------------------------------ */

/**
 * Marge de l'orange : 2 points de pourcentage au dessus du taux de référence.
 *
 * Pourquoi 2 points, et pourquoi c'est défendable : battre le taux de
 * référence d'un cheveu ne protège de rien. Un ratio comptable est publié une
 * fois par an, il bouge de plus d'un point d'un exercice à l'autre chez la
 * plupart des sociétés, et le taux de référence lui même bouge en continu.
 * Un avantage inférieur à 2 points entre donc dans l'épaisseur du trait : il
 * peut disparaître à la publication suivante ou à la prochaine décision de
 * banque centrale. On le signale en orange, « au dessus mais de peu », plutôt
 * que de le présenter comme un avantage acquis.
 *
 *   vert   : ratio >= référence + 2 points
 *   orange : référence <= ratio < référence + 2 points
 *   rouge  : ratio < référence
 */
export const MARGE_ORANGE_PTS = 2;

/**
 * Au delà de 100 pour cent, le ratio n'est plus comparable à un taux : il
 * signale surtout un capital investi proche de zéro (rachats d'actions massifs,
 * financement par la dette, actifs largement amortis). On ne montre pas le
 * chiffre brut et on ne classe jamais ces cas en vert sans réserve.
 */
export const PLAFOND_CREDIBLE_PCT = 100;

export type Statut = "vert" | "orange" | "rouge" | "reserve" | "absent";

export type Verdict = {
  cle: CleRatio;
  valeur: number | null;
  statut: Statut;
  /** Écart en points par rapport à la référence, null si absent ou sous réserve. */
  ecart: number | null;
};

export function classer(valeur: number | null, reference: number): Statut {
  if (valeur === null || !Number.isFinite(valeur)) return "absent";
  if (valeur > PLAFOND_CREDIBLE_PCT) return "reserve";
  if (valeur < reference) return "rouge";
  if (valeur < reference + MARGE_ORANGE_PTS) return "orange";
  return "vert";
}

export function verdicts(societe: CapaciteSociete, reference: number): Verdict[] {
  return ORDRE_RATIOS.map((cle) => {
    const valeur = societe.ratios[cle];
    const statut = classer(valeur, reference);
    return {
      cle,
      valeur,
      statut,
      ecart: statut === "absent" || statut === "reserve" ? null : (valeur as number) - reference,
    };
  });
}

/** Phrase de synthèse, lisible sans regarder les chiffres. */
export function synthese(vs: Verdict[], reference: number, type: TypeReference): string {
  const mesurees = vs.filter((v) => v.statut !== "absent");
  const reserve = vs.filter((v) => v.statut === "reserve").length;
  const nom = type === "sans_risque" ? "le taux sans risque" : "l'inflation";
  const taux = `${formatPct(reference)}`;
  if (mesurees.length === 0) return `Aucune mesure de rentabilité disponible pour cette société.`;
  const gagnantes = vs.filter((v) => v.statut === "vert" || v.statut === "orange").length;
  const comparables = mesurees.length - reserve;
  const base =
    comparables === 0
      ? `Aucune mesure comparable ${nom === "l'inflation" ? "à l'inflation" : "au taux sans risque"} de ${taux}`
      : gagnantes === 0
        ? `Aucune des ${comparables} mesures ne dépasse ${nom} de ${taux}`
        : `${gagnantes} mesure${gagnantes > 1 ? "s" : ""} sur ${comparables} ${
            gagnantes > 1 ? "dépassent" : "dépasse"
          } ${nom} de ${taux}`;
  if (reserve > 0) {
    return `${base}, et ${reserve === 1 ? "une autre dépasse" : `${reserve} autres dépassent`} 100 pour cent, à lire avec réserve.`;
  }
  return `${base}.`;
}

/* ------------------------------------------------------------------ */
/* Mise en forme                                                       */
/* ------------------------------------------------------------------ */

export function formatPct(v: number, decimales = 1): string {
  const arrondi = Number(v.toFixed(decimales));
  return `${arrondi.toLocaleString("fr-FR", {
    minimumFractionDigits: Number.isInteger(arrondi) ? 0 : 1,
    maximumFractionDigits: decimales,
  })} %`;
}

export function formatEcart(v: number): string {
  // Un écart qui s'arrondit à zéro ne doit pas s'écrire « +0 pts » ou
  // « -0 pts » : on dit alors que la mesure est au ras du taux.
  if (Math.abs(v) < 0.05) return "au ras du taux";
  const signe = v > 0 ? "+" : v < 0 ? "-" : "";
  return `${signe}${Math.abs(Number(v.toFixed(1))).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })} pts`;
}

/** Libellé de la pastille de statut : évite « En dessous, -0 pts ». */
export function libelleVerdict(v: Verdict): string {
  const nom = COULEURS[v.statut].nom;
  if (v.ecart === null) return nom;
  if (Math.abs(v.ecart) < 0.05) return "Au niveau du taux";
  return `${nom}, ${formatEcart(v.ecart)}`;
}

/** Texte affiché à la place du chiffre. Jamais de zéro ni de tiret ambigu. */
export function affichageValeur(v: Verdict): string {
  if (v.statut === "absent") return "Non disponible";
  if (v.statut === "reserve") return "Supérieur à 100 %";
  return formatPct(v.valeur as number);
}

export const COULEURS: Record<Statut, { trait: string; fond: string; texte: string; nom: string }> = {
  vert: { trait: "#34d399", fond: "rgba(52,211,153,0.12)", texte: "#6ee7b7", nom: "Au dessus" },
  orange: { trait: "#fbbf24", fond: "rgba(251,191,36,0.12)", texte: "#fcd34d", nom: "Juste au dessus" },
  rouge: { trait: "#fb7185", fond: "rgba(251,113,133,0.12)", texte: "#fda4af", nom: "En dessous" },
  reserve: { trait: "#a78bfa", fond: "rgba(167,139,250,0.12)", texte: "#c4b5fd", nom: "Sous réserve" },
  absent: { trait: "#52525b", fond: "rgba(82,82,91,0.10)", texte: "#a1a1aa", nom: "Non disponible" },
};
