export type Lang = "fr" | "en" | "de";

export type EmailCopy = {
  brand: string;
  subtitle: string;
  badge: string;
  h1Line1: string;
  h1Line2: string;
  body: string;
  cta: string;
  expiry: string;
  teaserTitle: string;
  teasers: [string, string, string];
  manualLinkLabel: string;
  footerLine1: string;
  footerLine2: string;
  url: string;
};

/**
 * Copy globale Mettrik (FR · EN · DE).
 * Mêmes formulations que la home et la modal — single source of truth.
 *
 * Règles :
 *   - Pas de mention du nombre exact de sociétés (V1 = 5 mais on parle déjà
 *     « plusieurs milliers »).
 *   - Pas de mention « 10-K » ou « variantes visuelles » (jargon V1).
 *   - On nomme 5 max sociétés retail-friendly mixées US / FR / DE :
 *     Apple, Tesla, LVMH, SAP, BMW.
 */
export const TRANSLATIONS: Record<Lang, EmailCopy> = {
  fr: {
    brand: "Mettrik AI",
    subtitle: "KPI Intelligence",
    badge: "Accès anticipé",
    h1Line1: "Bienvenue.",
    h1Line2: "Active ton accès Mettrik.",
    body: "Plus que 3 clics pour découvrir les KPI des plus grandes sociétés américaines et européennes : Apple, Tesla, LVMH, SAP, BMW.",
    cta: "Confirmer mon adresse",
    expiry: "Le lien expire dans 24 h.",
    teaserTitle: "Ce qui t'attend",
    teasers: [
      "KPI indispensables et Super KPI privées",
      "Plusieurs milliers de sociétés US et Europe",
      "Risques, gouvernance et IA",
    ],
    manualLinkLabel: "Le bouton ne marche pas ? Copie ce lien :",
    footerLine1: "Mettrik AI · KPI Intelligence pour investisseurs.",
    footerLine2:
      "Tu reçois cet email parce que ton adresse a été utilisée pour créer un compte sur mettrik.ai.",
    url: "https://mettrik.ai/auth/confirm?token=demo-token-xxxxxxxxxxxxxxxx",
  },
  en: {
    brand: "Mettrik AI",
    subtitle: "KPI Intelligence",
    badge: "Early access",
    h1Line1: "Welcome.",
    h1Line2: "Activate your Mettrik account.",
    body: "3 clicks left to access the KPIs of the biggest US and European companies: Apple, Tesla, LVMH, SAP, BMW.",
    cta: "Confirm my email",
    expiry: "Link expires in 24h.",
    teaserTitle: "What's inside",
    teasers: [
      "Essential KPIs and private Super KPIs",
      "Thousands of US and European companies",
      "Risk factors, governance and AI",
    ],
    manualLinkLabel: "Button not working? Copy this link:",
    footerLine1: "Mettrik AI · KPI Intelligence for investors.",
    footerLine2:
      "You're receiving this email because your address was used to create an account on mettrik.ai.",
    url: "https://mettrik.ai/auth/confirm?token=demo-token-xxxxxxxxxxxxxxxx",
  },
  de: {
    brand: "Mettrik AI",
    subtitle: "KPI Intelligence",
    badge: "Frühzugang",
    h1Line1: "Willkommen.",
    h1Line2: "Aktiviere deinen Mettrik-Zugang.",
    body: "Nur noch 3 Klicks bis zu den KPIs der größten US- und europäischen Unternehmen: Apple, Tesla, LVMH, SAP, BMW.",
    cta: "E-Mail-Adresse bestätigen",
    expiry: "Der Link läuft in 24 Stunden ab.",
    teaserTitle: "Was dich erwartet",
    teasers: [
      "Unverzichtbare KPIs und private Super-KPIs",
      "Tausende US- und europäische Unternehmen",
      "Risiken, Governance und KI",
    ],
    manualLinkLabel: "Button funktioniert nicht? Kopiere diesen Link:",
    footerLine1: "Mettrik AI · KPI Intelligence für Investoren.",
    footerLine2:
      "Du erhältst diese E-Mail, weil deine Adresse zur Erstellung eines Kontos auf mettrik.ai verwendet wurde.",
    url: "https://mettrik.ai/auth/confirm?token=demo-token-xxxxxxxxxxxxxxxx",
  },
};
