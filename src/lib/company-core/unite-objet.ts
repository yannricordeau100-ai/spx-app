/**
 * 13 oct 2026 (verif n2, JPM « 10,4 M » sans objet) : un KPI de comptage dont
 * l unite n est qu un ordre de grandeur (« M », « millions », « milliers »,
 * « Mds ») recoit l objet compte, lu dans son libelle francais :
 * « Nouveaux comptes cartes ouverts » 10,4 M -> 10,4 M comptes.
 *
 * Garde-fous :
 *  - seulement si le libelle commence par (ou contient en tete) un nom compte
 *    connu ; sinon rien ne change (zero invention) ;
 *  - seulement si toutes les valeurs restent sous 1 000 : au-dela, l echelle
 *    d affichage (M -> Mds) s appliquerait a une unite qu elle ne connait plus ;
 *  - jamais pour une unite monetaire ni un pourcentage.
 */

const ECHELLE: Record<string, string> = {
  M: "M",
  millions: "M",
  Millions: "M",
  million: "M",
  Mds: "Mds",
  milliards: "Mds",
  Md: "Mds",
  B: "Mds",
  milliers: "k",
  k: "k",
  K: "k",
};

/** Noms comptes reconnus (forme du libelle -> forme affichee dans l unite). */
const NOMS: [RegExp, string][] = [
  [/^(?:nombre (?:total )?d['’]|nombre de |total )?utilisateurs?\b/i, "utilisateurs"],
  [/^(?:nombre (?:total )?de |total )?clients?\b/i, "clients"],
  [/^(?:nombre (?:total )?d['’]|total )?abonn[ée]s?\b/i, "abonnés"],
  [/^(?:nombre (?:total )?de |total )?membres?\b/i, "membres"],
  [/^(?:nouveaux |nombre de )?comptes?\b/i, "comptes"],
  [/^actions?\b/i, "actions"],
  [/^compteurs?\b/i, "compteurs"],
  [/^transactions?\b/i, "transactions"],
  [/^tests?\b/i, "tests"],
  [/^sites?\b/i, "sites"],
  [/^polices?\b/i, "polices"],
  [/^wagons?\b/i, "wagons"],
  [/^lignes?\b/i, "lignes"],
  [/^d[ée]clarations?\b/i, "déclarations"],
  [/^consommateurs?\b/i, "consommateurs"],
  [/^prescriptions?\b/i, "prescriptions"],
  [/^v[ée]hicules?\b/i, "véhicules"],
  [/^(?:total )?porteurs? de cartes?\b/i, "porteurs de carte"],
  [/^d[ée]veloppeurs?\b/i, "développeurs"],
  [/^annonceurs?\b/i, "annonceurs"],
  [/^identit[ée]s?\b/i, "identités"],
  [/^t[ée]l[ée]chargements?\b/i, "téléchargements"],
  [/^b[ée]n[ée]ficiaires?\b/i, "bénéficiaires"],
  [/^passagers?\b/i, "passagers"],
  [/^visiteurs?\b/i, "visiteurs"],
  [/^appareils?\b/i, "appareils"],
  [/^foyers?\b/i, "foyers"],
  [/^m[ée]nages?\b/i, "ménages"],
  [/^commandes?\b/i, "commandes"],
  [/^livraisons?\b/i, "livraisons"],
  [/^colis\b/i, "colis"],
  [/^nuit[ée]es?\b/i, "nuitées"],
  [/^patients?\b/i, "patients"],
  [/^salari[ée]s?\b/i, "salariés"],
  [/^employ[ée]s?\b/i, "employés"],
  [/^effectifs?\b/i, "salariés"],
  [/^contrats?\b/i, "contrats"],
  [/^r[ée]servations?\b/i, "réservations"],
  [/^jours[- ]lits?\b/i, "jours-lits"],
  [/^points? d['’]acceptation\b/i, "points d’acceptation"],
  [/^(?:nouveaux |nombre de )?magasins?\b/i, "magasins"],
  [/^unit[ée]s?\b/i, "unités"],
];

type KpiUnite = { name_fr?: unknown; unit?: unknown; value?: unknown; history?: unknown };

export function uniteAvecObjet(kpi: KpiUnite): string | null {
  const u = String(kpi.unit ?? "").trim();
  const echelle = ECHELLE[u];
  if (!echelle) return null;
  const nom = String(kpi.name_fr ?? "").trim();
  if (!nom) return null;
  let objet: string | null = null;
  for (const [re, forme] of NOMS) {
    if (re.test(nom)) {
      objet = forme;
      break;
    }
  }
  if (!objet) return null;
  const valeurs = [kpi.value, ...(Array.isArray(kpi.history) ? kpi.history : [])]
    .map((v) => (typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", "."))))
    .filter((v) => Number.isFinite(v));
  if (valeurs.length === 0 || valeurs.some((v) => Math.abs(v) >= 1000)) return null;
  if (echelle === "k") return `milliers ${/^[aeiouyéèêh]/i.test(objet) ? "d’" : "de "}${objet}`;
  return `${echelle} ${objet}`;
}

/** Applique uniteAvecObjet a tous les KPI d une fiche ; renvoie le nombre de KPI touches. */
export function completerUnitesFiche(company: Record<string, unknown>): number {
  let n = 0;
  const kpis = company.kpis;
  if (!Array.isArray(kpis)) return 0;
  for (const k of kpis as KpiUnite[]) {
    if (!k || typeof k !== "object") continue;
    const nouvelle = uniteAvecObjet(k);
    if (nouvelle) {
      k.unit = nouvelle;
      n++;
    }
  }
  return n;
}
