// Yann 18 sept 2026 : liste des onglets partagee entre les pages serveur (voir-kpi, reglages-kpi)
// et le composant client. Un export non-composant d un module "use client" n est pas lisible
// cote serveur (erreur 500 sur ?onglet=...), d ou ce module sans directive.
export type ToggleKpi = "voir" | "creer";

// Yann 17 sept 2026 (soir) : deux toggles distincts. « Voir les KPI » regroupe les
// vues et tris (par société, par industrie, par secteur, définitions) ; « Création
// KPI et données » regroupe les outils qui cherchent de la donnée (directement ou
// indirectement) pour en faire un KPI. Les onglets vides (valeurs approximatives)
// ont été retirés.
export const ONGLETS: { id: string; toggle: ToggleKpi; groupe: string; label: string; url: string; mots: string }[] = [
  { id: "heros", toggle: "voir", groupe: "Par société", label: "KPI héros par société", url: "/admin/kpis-toggle", mots: "tous les KPI d'une fiche, choisir le KPI principal, activer ou désactiver" },
  { id: "phare", toggle: "voir", groupe: "Par société", label: "Produit phare", url: "/sandbox/produit-phare", mots: "exceptions produit phare à trancher, A / B / aucun" },
  { id: "accueil", toggle: "voir", groupe: "Par société", label: "KPI de l’accueil", url: "/sandbox/accueil-kpis", mots: "les 3 KPI affichés sur la page d'accueil" },
  { id: "industries", toggle: "voir", groupe: "Par industrie", label: "KPI par industrie", url: "/sandbox/gics", mots: "classification GICS, KPI attendus par sous-industrie, qui a quoi" },
  { id: "secteurs", toggle: "voir", groupe: "Par secteur", label: "KPI star par secteur", url: "/sandbox/kpi-secteurs", mots: "métrique reine par secteur (NIM, ratio combiné, FFO, production…), sociétés avec ou sans" },
  { id: "definitions", toggle: "voir", groupe: "Référentiel", label: "Définitions et unités", url: "/sandbox/kpi-definitions", mots: "référentiel, unités métiers, infobulles" },
  { id: "theses", toggle: "voir", groupe: "Par société", label: "Thèses d’investissement", url: "/sandbox/theses", mots: "liste des thèses rédigées, style d'analyse, élément additionnel retirable" },
  { id: "constructeur", toggle: "creer", groupe: "Long terme", label: "Constructeur de KPI", url: "/sandbox/kpi-builder", mots: "créer un KPI multi-sociétés à partir d'une demande, extraction 10-K / 10-Q" },
  { id: "speciaux", toggle: "creer", groupe: "Long terme", label: "KPI spéciaux", url: "/sandbox/special-kpis", mots: "recherche manuelle hors documents (unités vendues, abonnés, livraisons)" },
  { id: "moyen-terme", toggle: "creer", groupe: "Moyen terme", label: "Indicateurs variés - Moyen terme", url: "/sandbox/image-findings", mots: "graphiques reconstruits depuis une demande, approuver ou retirer" },
  { id: "court-terme", toggle: "creer", groupe: "Court terme", label: "Faits marquants - Court terme", url: "/sandbox/story-builder", mots: "stories du dernier trimestre depuis un lien" },
];

export const TITRES: Record<ToggleKpi, string> = { voir: "Voir les KPI", creer: "Création KPI et données" };

