/**
 * src/lib/floutage.ts
 *
 * Helper côté UI free tier : applique les règles de floutage stockées dans
 * `src/data/floutage-rules.json` (générées depuis la sélection visuelle Yann
 * sur /sandbox/admin/floutage-selector).
 *
 * V1 (maintenant) : applique CSS `filter: blur(8px)` + classe utilitaire sur
 * les éléments matchant `dom_selector`.
 *
 * V2 (futur) : prise en compte `sub_target` (offset pixel intra-élément) pour
 * flouter une zone précise d'un bloc.
 */

export type FloutageRule = {
  label: string;
  dom_selector: string;
  sub_target?: { x: number; y: number; w: number; h: number } | null;
  action: "blur" | "hide";
};

export type FloutageRulesFile = {
  rules: FloutageRule[];
  generated_at?: string;
  signed_by?: string;
};

/**
 * Applique les règles côté DOM (à appeler dans un useEffect côté client).
 * Retourne un cleanup qui restaure l'état initial.
 */
export function applyFloutageRules(rules: FloutageRule[]): () => void {
  if (typeof document === "undefined" || rules.length === 0) {
    return () => {};
  }

  const touched: {
    el: HTMLElement;
    prevFilter: string;
    prevBoxDecorationBreak: string;
    prevWebkitBoxDecorationBreak: string;
    prevDataset: string | undefined;
  }[] = [];

  for (const rule of rules) {
    let els: NodeListOf<Element> | null = null;
    try {
      els = document.querySelectorAll(rule.dom_selector);
    } catch {
      // sélecteur invalide → skip silencieux
      continue;
    }
    els.forEach((node) => {
      const el = node as HTMLElement;
      if (el.dataset.floutageApplied === "1") return;
      touched.push({
        el,
        prevFilter: el.style.filter,
        prevBoxDecorationBreak: el.style.boxDecorationBreak,
        prevWebkitBoxDecorationBreak: (el.style as unknown as Record<string, string>)["webkitBoxDecorationBreak"] ?? "",
        prevDataset: el.dataset.floutageApplied,
      });
      if (rule.action === "hide") {
        el.style.visibility = "hidden";
      } else {
        el.style.filter = "blur(8px)";
        el.style.userSelect = "none";
        el.style.pointerEvents = "none";
        // Yann 2 juin 2026 : flou adaptatif multi-lignes.
        // box-decoration-break:clone permet au filter:blur de s'appliquer
        // ligne par ligne sur un span inline qui wrap. Sans ça, le blur
        // dessine un seul rectangle englobant qui mord sur le texte voisin.
        el.style.boxDecorationBreak = "clone";
        (el.style as unknown as Record<string, string>)["webkitBoxDecorationBreak"] = "clone";
      }
      el.dataset.floutageApplied = "1";
      el.dataset.floutageLabel = rule.label;
    });
  }

  return () => {
    for (const t of touched) {
      t.el.style.filter = t.prevFilter;
      t.el.style.visibility = "";
      t.el.style.userSelect = "";
      t.el.style.pointerEvents = "";
      t.el.style.boxDecorationBreak = t.prevBoxDecorationBreak;
      (t.el.style as unknown as Record<string, string>)["webkitBoxDecorationBreak"] = t.prevWebkitBoxDecorationBreak;
      if (t.prevDataset === undefined) {
        delete t.el.dataset.floutageApplied;
      }
      delete t.el.dataset.floutageLabel;
    }
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Zones nommées (Yann 27 aout 2026)

   Pourquoi ce second mecanisme : `dom_selector` ci dessus enregistre un chemin
   CSS du type `div.mt-9.rounded-2xl > section:nth-of-type(3)`. Ce chemin est
   fait de classes utilitaires et de rangs de freres, deux choses qui changent
   a chaque retouche de design et qui different d une societe a l autre selon
   les blocs reellement presents. D ou l ecart entre la zone montree dans
   l outil et la zone reellement floutee en production.

   La regle posee ici : une zone est designee par l identifiant STABLE du bloc
   (les memes que ceux du controle des blocs) et, si besoin, par une partie de
   ce bloc. L attribut `data-blur` est emis par les composants eux memes, donc
   il survit a toute refonte visuelle et vaut pour les 656 pages.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { BlockId } from "@/lib/v1-9-blocks-control";
import { BLOCK_LABELS } from "@/lib/v1-9-blocks-control";

export type PartieDeBloc =
  | "tout"
  | "titre"
  | "valeur"
  | "variation"
  | "graphique"
  | "tableau"
  | "texte"
  | "source"
  // Yann 29 aout 2026, spec floutage palier gratuit :
  | "indicateur"   // colonne des noms du tableau KPI
  | "qualite"      // colonne Qualite - Signal du tableau KPI
  | "voir-plus" // bouton "Voir x indicateurs supplementaires"
  // Yann 1er sept 2026 : jauge de severite X/5 des risques.
  | "note"
  // 9 sept 2026 : blocs Moat et Clients.
  | "niveau"      // pastille de note du Moat (Important / Moyen / Aucun)
  | "tendance"    // carte Tendance Mettrik du Moat
  | "noms"        // noms des clients cites
  // Yann 24 sept 2026, floutage fin : une partie par petit element, et des
  // parties « par element repete » (carte, ligne, citation) qui suivent le
  // nombre reel d elements de chaque societe.
  | "carte"        // chaque carte d une liste (risque, story, position de marche)
  | "ligne"        // chaque ligne d un tableau (KPI, segment, mesure de gouvernance)
  | "categorie"    // pastille de categorie ou de classement (risque, IA)
  | "citation"     // chaque citation ou preuve
  | "original"     // texte original dans le « i »
  | "synthese"     // phrase de synthese en tete de bloc
  | "signal"       // colonne ou mention du signal
  | "historique"   // mini graphique d historique
  | "unite"        // unite affichee
  | "periode"      // periode ou date d une valeur
  | "onglets"      // onglets (geographie / activite)
  | "pourcentage"  // parts en pourcentage
  | "ceo"          // ligne du dirigeant
  | "remuneration" // lignes de remuneration
  | "actionnaires" // top 3 votes et capital
  | "fleches"      // fleches de navigation (conferences, graphiques)
  | "suivi"        // sous bloc de suivi des KPI (conferences)
  | "cites-une-fois" // sous bloc des KPI cites une seule fois
  | "reglage"      // curseur et choix de reference (bloc capacite)
  | "ecart"        // ecart au taux (bloc capacite)
  | "reserve";     // bandeau de reserve (bloc capacite)

export const LIBELLES_PARTIES: Record<PartieDeBloc, string> = {
  tout: "le bloc entier",
  titre: "le titre",
  valeur: "la valeur chiffrée",
  variation: "la variation",
  graphique: "le graphique",
  tableau: "le tableau",
  texte: "le texte",
  source: "la source",
  indicateur: "la colonne des noms",
  qualite: "la colonne Qualité · Signal",
  "voir-plus": "le bouton voir plus",
  note: "la note de sévérité (X/5)",
  niveau: "la note (Important / Moyen / Aucun)",
  tendance: "la carte Tendance Mettrik",
  noms: "les noms de clients",
  carte: "chaque carte (risque, story, position)",
  ligne: "chaque ligne (KPI, segment, mesure)",
  categorie: "la pastille de catégorie",
  citation: "chaque citation ou preuve",
  original: "le texte original dans le i",
  synthese: "la phrase de synthèse",
  signal: "le signal",
  historique: "le mini historique",
  unite: "l'unité",
  periode: "la période ou la date",
  onglets: "les onglets",
  pourcentage: "les parts en pourcentage",
  ceo: "la ligne du dirigeant",
  remuneration: "les lignes de rémunération",
  actionnaires: "les top 3 votes et capital",
  fleches: "les flèches de navigation",
  suivi: "le sous bloc Suivi des KPI",
  "cites-une-fois": "le sous bloc Cités une fois",
  reglage: "le réglage du taux",
  ecart: "l'écart au taux",
  reserve: "le bandeau de réserve",
};

/** Paliers d abonnement, du plus ouvert au plus complet. */
export type PalierFloutage = "anon" | "free" | "premium" | "max";

export const PALIERS: PalierFloutage[] = ["anon", "free", "premium", "max"];

export const LIBELLES_PALIERS: Record<PalierFloutage, string> = {
  anon: "Anonyme",
  free: "Gratuit",
  premium: "Premium",
  max: "Max",
};

/**
 * Zone de floutage.
 *
 * `plans` (Yann 4 sept 2026) : paliers pour lesquels CE detail precis est
 * floute. Absent = comportement historique, c est-a-dire anonyme et gratuit
 * uniquement. Les reglages deja enregistres continuent donc de fonctionner a
 * l identique sans migration.
 */
export type Zone = { bloc: BlockId; partie: PartieDeBloc; plans?: PalierFloutage[] };

/** Paliers effectivement concernes par une zone. */
export function paliersDeZone(z: Zone): PalierFloutage[] {
  return Array.isArray(z.plans) && z.plans.length > 0 ? z.plans : ["anon", "free"];
}

/** Zones a appliquer pour un palier donne. */
export function zonesPourPalier(zones: Zone[], palier: PalierFloutage): Zone[] {
  return zones.filter((z) => paliersDeZone(z).includes(palier));
}

/** Selecteur applique a l identique en apercu et en production. */
export function selecteurDeZone(z: Zone): string {
  const base = `[data-blur="${z.bloc}"]`;
  return z.partie === "tout" ? base : `${base} [data-blur-part="${z.partie}"]`;
}

/** Libelle lisible, affiche dans l outil et dans les recapitulatifs. */
export function libelleDeZone(z: Zone): string {
  const bloc = BLOCK_LABELS[z.bloc] ?? z.bloc;
  return z.partie === "tout" ? bloc : `${bloc} : ${LIBELLES_PARTIES[z.partie]}`;
}

/** Parties proposees par bloc dans l outil de selection. */
export const PARTIES_PAR_BLOC: Partial<Record<BlockId, PartieDeBloc[]>> = {
  hero: ["tout", "titre", "valeur", "variation", "graphique", "source"],
  kpis: ["tout", "titre", "tableau", "valeur", "variation", "indicateur", "qualite", "voir-plus"],
  stories: ["tout", "titre", "texte", "source"],
  repartition: ["tout", "titre", "onglets", "graphique", "tableau", "ligne", "valeur", "pourcentage"],
  governance: ["tout", "titre", "tableau", "texte", "ligne", "remuneration", "actionnaires"],
  // "note" (Yann 1er sept 2026) : la jauge de severite X/5 de chaque risque,
  // desormais pilotable separement — et laissee VISIBLE par defaut.
  risks: ["tout", "titre", "texte", "source", "note", "carte", "categorie", "tendance", "citation"],
  events: ["tout", "titre", "tableau"],
  ai_positioning: ["tout", "titre", "categorie", "texte", "citation", "original", "source"],
  dividend: ["tout", "titre", "valeur", "graphique"],
  // fleches, suivi et cites-une-fois seront ajoutes avec l interface des quatre conferences.
  transcripts: ["tout", "titre", "texte", "source", "citation", "ligne"],
  image_findings: ["tout", "titre", "graphique", "source"],
  ranks: ["tout", "titre", "tableau", "valeur"],
  interpretation: ["tout", "texte"],
  company_logo: ["tout"],
  // 9 sept 2026 : les deux groupes du tableau sont pilotes separement (KPI
  // avances = bloc kpis ; KPI standard = bloc kpis_standard), puis chaque
  // nouveau bloc ou partie de bloc apporte depuis le 4 septembre.
  kpis_standard: ["tout", "tableau", "valeur", "variation", "indicateur", "qualite", "voir-plus"],
  moat: ["tout", "titre", "niveau", "texte", "tendance"],
  clients: ["tout", "titre", "graphique", "valeur", "noms", "texte"],
  tam: ["tout", "titre", "valeur", "graphique", "texte", "source"],
  unites: ["tout", "titre", "tableau"],
  prochains_resultats: ["tout", "valeur"],
  antithese: ["tout", "titre", "synthese", "texte", "carte", "ligne"],
  these: ["tout", "titre", "synthese", "texte", "carte", "ligne"],
};

/** Transforme des zones nommees en regles, pour reutiliser applyFloutageRules. */
export function zonesEnRegles(zones: Zone[]): FloutageRule[] {
  return zones.map((z) => ({
    label: libelleDeZone(z),
    dom_selector: selecteurDeZone(z),
    sub_target: null,
    action: "blur" as const,
  }));
}

/**
 * Yann 18 sept 2026 : chaque bloc (section) contenant au moins une partie floutee
 * recoit un appel a l abonnement centre, sans mention de palier. Anonyme : lien
 * vers l inscription ; gratuit : lien vers les offres. Retourne un nettoyage.
 */
export function ajouteAppelsAbonnement(palier: "anon" | "free" | string): () => void {
  if (typeof document === "undefined" || (palier !== "anon" && palier !== "free")) return () => {};
  const poses: HTMLElement[] = [];
  const restaure: { el: HTMLElement; position: string }[] = [];
  const floutes = document.querySelectorAll<HTMLElement>('[data-floutage-applied="1"]');
  const blocs = new Set<HTMLElement>();
  floutes.forEach((el) => {
    const bloc = el.closest("section") as HTMLElement | null;
    if (bloc && !bloc.querySelector('[data-zone-reservee]')) blocs.add(bloc);
  });
  blocs.forEach((bloc) => {
    if (bloc.querySelector('[data-appel-abonnement]')) return;
    if (getComputedStyle(bloc).position === "static") { restaure.push({ el: bloc, position: bloc.style.position }); bloc.style.position = "relative"; }
    const a = document.createElement("a");
    a.setAttribute("data-appel-abonnement", "1");
    const next = encodeURIComponent(window.location.pathname);
    a.href = palier === "anon" ? `/?auth=signup&gate=1&next=${next}` : "/pricing";
    a.textContent = palier === "anon" ? "Inscris-toi gratuitement pour lire cette section" : "Contenu réservé aux abonnés · Voir les offres";
    a.className = "absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-violet-400/60 bg-[#0a0a0e]/95 px-5 py-2.5 text-[13.5px] font-semibold text-violet-100 shadow-lg backdrop-blur hover:bg-violet-500/20";
    bloc.appendChild(a); poses.push(a);
  });
  return () => {
    for (const a of poses) a.remove();
    for (const r of restaure) r.el.style.position = r.position;
  };
}
