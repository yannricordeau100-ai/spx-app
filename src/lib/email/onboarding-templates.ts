/**
 * onboarding-templates.ts — séquence onboarding J+1 / J+3 / J+7 / J+14 / J+25.
 *
 * 5 emails pédagogiques pour engager le nouvel utilisateur après inscription.
 * Chacun localisé en FR / EN / DE (locales primaires Mettrik AI). NL/SV/DA
 * fallback sur EN.
 *
 * Ton : rappeler concrètement la PV de l'app, donner 1 conseil utile par
 * email, jamais d'argumentaire de vente lourd. Tutoiement FR.
 *
 * Design : layout partagé src/lib/email/layout.ts (charte dark Mettrik AI,
 * 1 CTA principal par email, preheader caché, lien de secours).
 */

import {
  renderEmailLayout,
  emailParagraph as p,
  emailStrong as b,
  emailList,
} from "./layout";

export type OnboardingLocale = "fr" | "en" | "de";
export type OnboardingKey = "day1" | "day3" | "day7" | "day14" | "day25";

export const ONBOARDING_DAYS: Record<OnboardingKey, number> = {
  day1: 1,
  day3: 3,
  day7: 7,
  day14: 14,
  day25: 25,
};

export type OnboardingTemplate = {
  subject: Record<OnboardingLocale, string>;
  body: Record<OnboardingLocale, (name: string) => string>;
};

const HI: Record<OnboardingLocale, (n: string) => string> = {
  fr: (n) => `Salut${n ? " " + n : ""},`,
  en: (n) => `Hi${n ? " " + n : ""},`,
  de: (n) => `Hallo${n ? " " + n : ""},`,
};

type Copy = {
  preheader: string;
  title: string;
  body: (name: string) => string;
  cta: { label: string; url: string };
};

function make(copy: Record<OnboardingLocale, Copy>): OnboardingTemplate["body"] {
  const build = (loc: OnboardingLocale) => (name: string) =>
    renderEmailLayout({
      locale: loc,
      preheader: copy[loc].preheader,
      title: copy[loc].title,
      bodyHtml: copy[loc].body(name),
      cta: copy[loc].cta,
      withUnsubscribe: true,
    });
  return { fr: build("fr"), en: build("en"), de: build("de") };
}

const APP_URL = "https://www.mettrik.ai";

/* ── J+1 ── */
const DAY1: OnboardingTemplate = {
  subject: {
    fr: "Premier pas avec Mettrik AI",
    en: "Your first step with Mettrik AI",
    de: "Ihr erster Schritt mit Mettrik AI",
  },
  body: make({
    fr: {
      preheader: "En 30 secondes, compare le hero KPI de n'importe quelle société du top 300.",
      title: "Ton premier réflexe Mettrik",
      body: (n) =>
        p(HI.fr(n)) +
        p("Bienvenue. En 30 secondes tu peux comparer le hero KPI de n'importe quelle société du top 300.") +
        p(`${b("Conseil du jour :")} commence par les 5 sociétés que tu suis le plus. Tape leur ticker dans la barre du haut et regarde leur indicateur principal. Tu verras tout de suite si la dynamique récente est saine ou pas.`),
      cta: { label: "Ouvrir Mettrik AI", url: APP_URL },
    },
    en: {
      preheader: "In 30 seconds, compare the hero KPI of any company in the top 300.",
      title: "Your first Mettrik habit",
      body: (n) =>
        p(HI.en(n)) +
        p("Welcome aboard. In 30 seconds, you can compare the hero KPI of any company in the top 300.") +
        p(`${b("Tip of the day:")} start with the 5 companies you follow most. Type their ticker in the top bar and look at their hero KPI. You'll see right away whether their recent trend is healthy.`),
      cta: { label: "Open Mettrik AI", url: APP_URL },
    },
    de: {
      preheader: "In 30 Sekunden den Hero-KPI eines beliebigen Top-300-Unternehmens vergleichen.",
      title: "Ihr erster Mettrik-Reflex",
      body: (n) =>
        p(HI.de(n)) +
        p("Willkommen an Bord. In 30 Sekunden können Sie den Hero-KPI eines beliebigen Unternehmens aus den Top 300 vergleichen.") +
        p(`${b("Tipp des Tages:")} Starten Sie mit den 5 Unternehmen, die Sie am meisten verfolgen. Geben Sie deren Ticker in der oberen Leiste ein und betrachten Sie deren Hero-KPI. Sie sehen sofort, ob die Entwicklung gesund ist.`),
      cta: { label: "Mettrik AI öffnen", url: APP_URL },
    },
  }),
};

/* ── J+3 ── */
const DAY3: OnboardingTemplate = {
  subject: {
    fr: "Le bouton « Comparer », ton meilleur ami",
    en: "The Compare button, your best friend",
    de: "Der Vergleichen-Button, Ihr bester Freund",
  },
  body: make({
    fr: {
      preheader: "CAGR 5 ans, momentum, volatilité : 30 minutes d'Excel en 2 secondes.",
      title: "La fonction qui change tout : Comparer",
      body: (n) =>
        p(HI.fr(n)) +
        p(`Tu as exploré plusieurs fiches société. Aujourd'hui, je te montre la fonction qui change tout : ${b("Comparer")}.`) +
        p("Sur n'importe quelle fiche, clique sur « Comparer » en haut. Tu obtiens : CAGR 5 ans, momentum sur le dernier trimestre, volatilité, position vs sous-secteur. C'est l'équivalent de 30 minutes d'analyse Excel en 2 secondes.") +
        p(`${b("Essaye :")} compare META vs GOOGL sur leur hero KPI. Verdict instantané.`),
      cta: { label: "Comparer META vs GOOGL", url: APP_URL },
    },
    en: {
      preheader: "5-year CAGR, momentum, volatility: 30 minutes of Excel in 2 seconds.",
      title: "The feature that changes everything: Compare",
      body: (n) =>
        p(HI.en(n)) +
        p(`You've explored a few company pages. Today, let me show you the feature that changes everything: ${b("Compare")}.`) +
        p('On any page, click "Compare" at the top. You get: 5-year CAGR, last quarter momentum, volatility, position vs sub-sector. That\'s the equivalent of 30 minutes of Excel work in 2 seconds.') +
        p(`${b("Try this:")} compare META vs GOOGL on their hero KPI. Instant verdict.`),
      cta: { label: "Compare META vs GOOGL", url: APP_URL },
    },
    de: {
      preheader: "5-Jahres-CAGR, Momentum, Volatilität: 30 Minuten Excel in 2 Sekunden.",
      title: "Die Funktion, die alles verändert: Vergleichen",
      body: (n) =>
        p(HI.de(n)) +
        p(`Sie haben einige Unternehmensseiten erkundet. Heute zeige ich Ihnen die Funktion, die alles verändert: ${b("Vergleichen")}.`) +
        p('Klicken Sie auf einer beliebigen Seite oben auf "Vergleichen". Sie erhalten: 5-Jahres-CAGR, Momentum des letzten Quartals, Volatilität, Position vs Untersektor. Das entspricht 30 Minuten Excel-Arbeit in 2 Sekunden.') +
        p(`${b("Probieren Sie:")} Vergleichen Sie META vs GOOGL beim Hero-KPI. Sofortiges Urteil.`),
      cta: { label: "META vs GOOGL vergleichen", url: APP_URL },
    },
  }),
};

/* ── J+7 ── */
const DAY7: OnboardingTemplate = {
  subject: {
    fr: "Le bloc Risques que personne ne lit (à tort)",
    en: "The Risks block nobody reads (wrongly so)",
    de: "Der Risiken-Block, den niemand liest (zu Unrecht)",
  },
  body: make({
    fr: {
      preheader: "5 à 8 risques scorés par société : 100 pages de rapport annuel condensées.",
      title: "Les facteurs de risque, ton raccourci",
      body: (n) =>
        p(HI.fr(n)) +
        p(`Une semaine que tu utilises Mettrik AI. Voilà un bloc qui sort du lot : ${b("Facteurs de risque")}.`) +
        p("Chaque société affiche 5 à 8 risques avec un score 1-5 et un rationale. C'est une lecture condensée de ce que la société écrit elle-même dans son rapport annuel. Ça t'épargne 100 pages de PDF.") +
        p("Cherche les chips « Nouveau » ou « En hausse » : ce sont les risques que la société a augmentés cette année. Souvent, c'est le signal le plus utile."),
      cta: { label: "Voir les facteurs de risque", url: APP_URL },
    },
    en: {
      preheader: "5 to 8 scored risks per company: 100 pages of annual report, condensed.",
      title: "Risk factors, your shortcut",
      body: (n) =>
        p(HI.en(n)) +
        p(`One week using Mettrik AI. Here's a block that stands out: ${b("Risk factors")}.`) +
        p("Each company shows 5 to 8 risks with a 1-5 score and rationale. It's a condensed read of what the company itself writes in its annual report. Saves you 100 pages of PDF.") +
        p('Look for "New" or "Up" chips: those are risks the company escalated this year. Often the most useful signal.'),
      cta: { label: "See the risk factors", url: APP_URL },
    },
    de: {
      preheader: "5 bis 8 bewertete Risiken pro Unternehmen: 100 Berichtsseiten, komprimiert.",
      title: "Risikofaktoren, Ihre Abkürzung",
      body: (n) =>
        p(HI.de(n)) +
        p(`Eine Woche mit Mettrik AI. Hier ist ein Block, der heraussticht: ${b("Risikofaktoren")}.`) +
        p("Jedes Unternehmen zeigt 5 bis 8 Risiken mit einer Bewertung von 1-5 und einer Begründung. Es ist eine komprimierte Zusammenfassung dessen, was das Unternehmen selbst in seinem Geschäftsbericht schreibt. Spart Ihnen 100 PDF-Seiten.") +
        p('Achten Sie auf die Chips "Neu" oder "Steigend": Das sind Risiken, die das Unternehmen dieses Jahr verstärkt hat. Oft das nützlichste Signal.'),
      cta: { label: "Risikofaktoren ansehen", url: APP_URL },
    },
  }),
};

/* ── J+14 ── */
const DAY14: OnboardingTemplate = {
  subject: {
    fr: "Gouvernance : ce que les 10-K cachent en plein jour",
    en: "Governance: what 10-Ks hide in plain sight",
    de: "Governance: Was 10-Ks im Klartext verbergen",
  },
  body: make({
    fr: {
      preheader: "9 indicateurs de gouvernance et le comparatif vs pairs, sans jargon.",
      title: "Gouvernance : lis entre les lignes",
      body: (n) =>
        p(HI.fr(n)) +
        p(`Le bloc ${b("Gouvernance")} donne 9 indicateurs : indépendance du board, dual-class, pay ratio, vote des actionnaires, etc. Plus le comparatif vs pairs en mots simples (« Bien au-dessus de la moyenne », pas de jargon).`) +
        p("Clique sur le bloc « Top 3 droits de vote » pour voir le pie chart 3D : tu visualises immédiatement si la société est contrôlée par 1-2 actionnaires (= risque concentré) ou par un float liquide."),
      cta: { label: "Explorer la gouvernance", url: APP_URL },
    },
    en: {
      preheader: "9 governance indicators plus a plain-words peer comparison, no jargon.",
      title: "Governance: read between the lines",
      body: (n) =>
        p(HI.en(n)) +
        p(`The ${b("Governance")} block gives 9 indicators: board independence, dual-class, pay ratio, shareholder votes, etc. Plus a peer comparison in plain words ("Well above average", no jargon).`) +
        p('Click the "Top 3 voting rights" block to open the 3D pie chart: you instantly see whether the company is controlled by 1-2 shareholders (= concentrated risk) or by a liquid float.'),
      cta: { label: "Explore governance", url: APP_URL },
    },
    de: {
      preheader: "9 Governance-Indikatoren plus Peer-Vergleich in klaren Worten.",
      title: "Governance: zwischen den Zeilen lesen",
      body: (n) =>
        p(HI.de(n)) +
        p(`Der ${b("Governance")}-Block liefert 9 Indikatoren: Unabhängigkeit des Boards, Dual-Class, Pay Ratio, Aktionärsabstimmungen usw. Plus ein Peer-Vergleich in klaren Worten ("Deutlich über dem Durchschnitt", kein Fachjargon).`) +
        p('Klicken Sie auf den Block "Top 3 Stimmrechte", um das 3D-Tortendiagramm zu öffnen: Sie sehen sofort, ob das Unternehmen von 1-2 Aktionären kontrolliert wird (= Konzentrationsrisiko) oder durch einen liquiden Float.'),
      cta: { label: "Governance erkunden", url: APP_URL },
    },
  }),
};

/* ── J+25 ── */
const DAY25: OnboardingTemplate = {
  subject: {
    fr: "Plan Pro : ce que tu débloques",
    en: "Pro plan: what you unlock",
    de: "Pro-Plan: Was Sie freischalten",
  },
  body: make({
    fr: {
      preheader: "Presque un mois sur Mettrik AI : voilà ce que Pro et Premium débloquent.",
      title: "Envie de passer la vitesse supérieure ?",
      body: (n) =>
        p(HI.fr(n)) +
        p("Tu utilises Mettrik AI depuis presque un mois. Si tu veux passer à la vitesse supérieure :") +
        emailList([
          `${b("Pro")} : accès aux 1500+ sociétés (vs 300 en gratuit), comparaisons multi-sociétés, alertes earning dates.`,
          `${b("Premium")} : tout Pro + export PDF des fiches, watchlists illimitées, données trimestrielles complètes.`,
        ]) +
        p("Si tu restes en gratuit, aucun souci : la base que tu as suffit pour un usage sérieux. Ce mail est juste pour information."),
      cta: { label: "Voir les plans", url: `${APP_URL}/pricing` },
    },
    en: {
      preheader: "Almost a month on Mettrik AI: here is what Pro and Premium unlock.",
      title: "Ready to step it up?",
      body: (n) =>
        p(HI.en(n)) +
        p("You've been using Mettrik AI for almost a month. If you want to step it up:") +
        emailList([
          `${b("Pro")}: access to all 1500+ companies (vs 300 on free), multi-company comparisons, earnings date alerts.`,
          `${b("Premium")}: everything in Pro + PDF export of profiles, unlimited watchlists, full quarterly data.`,
        ]) +
        p("If you stay on free, no worries: the base you have is enough for serious usage. This email is for info only."),
      cta: { label: "See the plans", url: `${APP_URL}/pricing` },
    },
    de: {
      preheader: "Fast ein Monat mit Mettrik AI: Das schalten Pro und Premium frei.",
      title: "Bereit für den nächsten Schritt?",
      body: (n) =>
        p(HI.de(n)) +
        p("Sie nutzen Mettrik AI seit fast einem Monat. Wenn Sie einen Schritt weitergehen möchten:") +
        emailList([
          `${b("Pro")}: Zugriff auf alle 1500+ Unternehmen (vs 300 in der kostenlosen Version), Multi-Unternehmens-Vergleiche, Earnings-Date-Alerts.`,
          `${b("Premium")}: Alles aus Pro + PDF-Export der Profile, unbegrenzte Watchlists, vollständige Quartalsdaten.`,
        ]) +
        p("Wenn Sie kostenlos bleiben, kein Problem: Die Basis, die Sie haben, reicht für ernsthafte Nutzung. Diese E-Mail dient nur zur Information."),
      cta: { label: "Pläne ansehen", url: `${APP_URL}/pricing` },
    },
  }),
};

export const ONBOARDING_TEMPLATES: Record<OnboardingKey, OnboardingTemplate> = {
  day1: DAY1,
  day3: DAY3,
  day7: DAY7,
  day14: DAY14,
  day25: DAY25,
};

export function normalizeOnboardingLocale(loc: string | undefined | null): OnboardingLocale {
  if (!loc) return "en";
  const l = loc.toLowerCase();
  if (l === "fr") return "fr";
  if (l === "de" || l === "de-ch") return "de";
  return "en";
}
