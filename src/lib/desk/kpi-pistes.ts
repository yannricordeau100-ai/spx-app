/**
 * Pistes de recherche de nouveaux KPI (/sandbox/kpi-pistes), 21 sept 2026.
 *
 * Cinq methodes de recherche, chacune avec son sous-onglet sur la page :
 *   analystes    : les questions posees par les analystes pendant les appels
 *                  de resultats revelent les indicateurs qu ils suivent ;
 *   regulateurs  : les organismes de tutelle et les federations publient des
 *                  series sectorielles ;
 *   concurrents  : un indicateur publie par un concurrent proche manque
 *                  souvent a la societe examinee ;
 *   referentiel  : le referentiel par sous-industrie (atelier GICS) signale
 *                  ce qui reste non couvert ;
 *   journees     : les journees investisseurs livrent des documents riches.
 *
 * L etat d avancement est range dans la table Supabase `desk_kpi_pistes`
 * (une ligne par couple methode + societe, contrainte unique). La lecture se
 * fait avec le client admin, comme pour les KPI speciaux.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import REGULATEURS_JSON from "@/data/kpi-regulateurs.json";

/* ───────── Methodes ───────── */

export type MethodePiste = "analystes" | "regulateurs" | "concurrents" | "referentiel" | "journees";

export const METHODES: MethodePiste[] = ["analystes", "regulateurs", "concurrents", "referentiel", "journees"];

/** Libelle et argumentaire de chaque methode. Texte en dur, relu par Yann. */
export const FICHES_METHODES: {
  id: MethodePiste;
  label: string;
  resume: string;
  /** Cout en jetons pour passer tout l univers, de 1 (faible) a 5 (tres eleve). */
  cout: 1 | 2 | 3 | 4 | 5;
  coutTexte: string;
  /** Chances de trouver beaucoup d indicateurs, de 1 (faibles) a 5 (tres fortes). */
  rendement: 1 | 2 | 3 | 4 | 5;
  rendementTexte: string;
}[] = [
  {
    id: "analystes",
    label: "Questions des analystes",
    resume:
      "Relever, dans les appels de résultats, les indicateurs que les analystes réclament à la direction.",
    cout: 5,
    coutTexte:
      "Très élevé : il faut lire un appel de résultats complet par société, soit plusieurs dizaines de milliers de jetons pour chacune des 671 sociétés de l’univers.",
    rendement: 5,
    rendementTexte:
      "Très fortes : ce sont exactement les chiffres que le marché suit, et ils sont souvent absents des états financiers.",
  },
  {
    id: "regulateurs",
    label: "Régulateurs et fédérations",
    resume:
      "Répertorier les organismes de tutelle et les fédérations professionnelles qui publient des séries chiffrées par secteur.",
    cout: 1,
    coutTexte:
      "Faible : le travail se fait par secteur, pas par société. Une centaine d’organismes couvre l’essentiel de l’univers.",
    rendement: 3,
    rendementTexte:
      "Moyennes : les séries sont excellentes mais sectorielles, donc rarement attribuables à une seule société.",
  },
  {
    id: "concurrents",
    label: "Concurrents",
    resume:
      "Comparer la fiche d’une société à celle de ses concurrents directs et relever les indicateurs qui lui manquent.",
    cout: 3,
    coutTexte:
      "Moyen : la comparaison se fait par sous-industrie, ce qui mutualise la lecture entre sociétés voisines.",
    rendement: 4,
    rendementTexte:
      "Fortes : la méthode trouve des indicateurs déjà publiés, donc vérifiables, mais elle ne crée rien de neuf pour une sous-industrie entière qui ne publie rien.",
  },
  {
    id: "referentiel",
    label: "Référentiel par sous-industrie",
    resume:
      "Partir du référentiel de l’atelier GICS et traiter ce qui reste sans donnée et sans graphique moyen terme.",
    cout: 2,
    coutTexte:
      "Faible à moyen : le référentiel existe déjà, il ne reste qu’à combler les cases vides, société par société.",
    rendement: 2,
    rendementTexte:
      "Limitées : par construction, cette méthode ne sort jamais de la liste déjà établie. Elle complète, elle ne découvre pas.",
  },
  {
    id: "journees",
    label: "Journées investisseurs",
    resume:
      "Exploiter les supports des journées investisseurs, souvent les documents les plus riches en indicateurs opérationnels.",
    cout: 2,
    coutTexte:
      "Faible à moyen : peu de sociétés tiennent une journée investisseurs, et le tri se fait sur la seule existence du document.",
    rendement: 4,
    rendementTexte:
      "Fortes là où le document existe : objectifs pluriannuels, segments détaillés, indicateurs opérationnels rarement repris ailleurs. Nulles ailleurs.",
  },
];

export function ficheMethode(id: MethodePiste) {
  return FICHES_METHODES.find((f) => f.id === id)!;
}

/* ───────── Lignes en base ───────── */

export type StatutPiste = "a_traiter" | "en_cours" | "traite" | "sans_objet" | "erreur" | string;

/** Un indicateur propose pour la societe. */
export type PropositionKpi = {
  short?: string;
  nom?: string;
  /** Provenance : question d analyste, document d un concurrent, publication d un organisme. */
  source?: string;
  url?: string;
  /** Methode concurrents : vrai si l indicateur convient aussi a la societe examinee. */
  convient?: boolean;
  /** Raison d un refus (activites trop differentes, perimetre non comparable). */
  raison?: string;
  /** Methode concurrents : chez quel concurrent l indicateur a ete releve. */
  releve_chez?: string;
};

/** Contenu de la colonne jsonb `propositions`, commun aux cinq methodes. */
export type PropositionsPiste = {
  kpis?: PropositionKpi[];
  /** Methode concurrents : les concurrents retenus pour la comparaison. */
  concurrents?: { ticker?: string; nom: string; proche: boolean; raison?: string }[];
  /** Methode journees investisseurs. */
  journee?: { documentation_riche: boolean; date?: string; url?: string; titre?: string };
  note?: string;
};

export type PisteRow = {
  id: string;
  methode: MethodePiste;
  ticker: string;
  statut: StatutPiste;
  propositions: PropositionsPiste | null;
  commentaire: string | null;
  hors_ordinaire: boolean;
  traite_le: string | null;
  cout_tokens: number | null;
  created_at: string;
  updated_at: string;
};

export type PistesParMethode = Record<MethodePiste, PisteRow[]>;

function vide(): PistesParMethode {
  return { analystes: [], regulateurs: [], concurrents: [], referentiel: [], journees: [] };
}

/**
 * Lit toutes les lignes de `desk_kpi_pistes` et les range par methode.
 * En cas d indisponibilite de la base, renvoie cinq listes vides : la page
 * reste consultable, elle affiche simplement tout l univers comme a traiter.
 */
export async function lirePistes(): Promise<PistesParMethode> {
  const out = vide();
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("desk_kpi_pistes")
      .select("id,methode,ticker,statut,propositions,commentaire,hors_ordinaire,traite_le,cout_tokens,created_at,updated_at")
      .order("ticker", { ascending: true });
    if (error) return out;
    for (const brut of (data ?? []) as PisteRow[]) {
      const m = brut.methode as MethodePiste;
      if (!METHODES.includes(m)) continue;
      out[m].push({ ...brut, ticker: String(brut.ticker ?? "").toUpperCase(), hors_ordinaire: !!brut.hors_ordinaire });
    }
  } catch {
    /* base indisponible : listes vides */
  }
  return out;
}

/** Vrai si la ligne compte comme traitee (elle a ete examinee, meme sans resultat). */
export function estTraitee(l: PisteRow): boolean {
  return l.statut === "traite" || l.statut === "sans_objet" || !!l.traite_le;
}

/* ───────── Regulateurs et federations (src/data/kpi-regulateurs.json) ───────── */

export type Regulateur = {
  /** Nom officiel de l organisme. */
  nom: string;
  /** Sigle usuel, s il existe. */
  sigle?: string;
  /** Secteur d activite couvert, en clair. */
  secteur: string;
  /** Code de secteur GICS a deux chiffres, quand il s applique. */
  secteur_code?: string;
  /** Zone couverte : mondiale, Etats-Unis, zone euro, France, Suisse, Pays-Bas, Allemagne. */
  zone?: string;
  /** Lien vers la page de publication des donnees. */
  lien: string;
  /** Vrai si l organisme publie des series chiffrees exploitables comme indicateurs. */
  indicateurs_disponibles: boolean;
  /** Ce qu on y trouve, en une ligne. */
  nature_donnees?: string;
  /** Frequence de publication. */
  frequence?: string;
  note?: string;
};

export type FichierRegulateurs = {
  maj: string;
  note: string;
  regulateurs: Regulateur[];
};

export function lireRegulateurs(): FichierRegulateurs {
  const j = REGULATEURS_JSON as FichierRegulateurs;
  return { maj: j.maj ?? "", note: j.note ?? "", regulateurs: Array.isArray(j.regulateurs) ? j.regulateurs : [] };
}
