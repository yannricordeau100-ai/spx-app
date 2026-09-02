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
    fr: "Le graphique fait tout le travail : 3 réglages à connaître",
    en: "The chart does the work: 3 settings to know",
    de: "Der Chart macht die Arbeit: 3 Einstellungen, die Sie kennen sollten",
  },
  body: make({
    fr: {
      preheader: "Fenêtre 5 ans ou MAX, trimestriel ou annuel, téléchargement en un clic.",
      title: "Trois réglages qui changent la lecture d'un KPI",
      body: (n) =>
        p(HI.fr(n)) +
        p("Tu as ouvert plusieurs fiches. Sur chacune, le graphique du KPI principal se règle en 3 gestes :") +
        emailList([
          `${b("Fenêtre")} : 5 ans par défaut, MAX pour remonter à l'origine de la série.`,
          `${b("Fréquence")} : trimestriel pour voir l'inflexion, annuel pour la tendance.`,
          `${b("Téléchargement")} : le bouton en haut du graphique exporte une image propre, prête à partager.`,
        ]) +
        p("Clique sur n'importe quel indicateur du tableau pour le promouvoir en KPI principal : le graphique suit."),
      cta: { label: "Essayer sur une fiche", url: APP_URL },
    },
    en: {
      preheader: "5-year or MAX window, quarterly or annual, one-click download.",
      title: "Three settings that change how you read a KPI",
      body: (n) =>
        p(HI.en(n)) +
        p("You have opened a few profiles. On each one, the main KPI chart adjusts in 3 moves:") +
        emailList([
          `${b("Window")}: 5 years by default, MAX to go back to the start of the series.`,
          `${b("Frequency")}: quarterly to spot the inflection, annual for the trend.`,
          `${b("Download")}: the button above the chart exports a clean image, ready to share.`,
        ]) +
        p("Click any indicator in the table to promote it as the main KPI: the chart follows."),
      cta: { label: "Try it on a profile", url: APP_URL },
    },
    de: {
      preheader: "5 Jahre oder MAX, quartalsweise oder jährlich, Download mit einem Klick.",
      title: "Drei Einstellungen, die die Lesart einer Kennzahl verändern",
      body: (n) =>
        p(HI.de(n)) +
        p("Sie haben einige Profile geöffnet. Auf jedem lässt sich der Chart der Hauptkennzahl in 3 Schritten einstellen:") +
        emailList([
          `${b("Zeitfenster")}: standardmäßig 5 Jahre, MAX bis zum Beginn der Reihe.`,
          `${b("Frequenz")}: quartalsweise für den Wendepunkt, jährlich für den Trend.`,
          `${b("Download")}: der Button über dem Chart exportiert ein sauberes Bild zum Teilen.`,
        ]) +
        p("Klicken Sie auf eine beliebige Kennzahl in der Tabelle, um sie zur Hauptkennzahl zu machen: der Chart folgt."),
      cta: { label: "Auf einem Profil ausprobieren", url: APP_URL },
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
    fr: "Premium et Max : ce que tu débloques",
    en: "Premium and Max: what you unlock",
    de: "Premium und Max: Was Sie freischalten",
  },
  body: make({
    fr: {
      preheader: "Presque un mois sur Mettrik AI : voilà ce que Premium et Max débloquent.",
      title: "Envie de passer la vitesse supérieure ?",
      body: (n) =>
        p(HI.fr(n)) +
        p("Tu utilises Mettrik AI depuis presque un mois. Si tu veux passer à la vitesse supérieure :") +
        emailList([
          `${b("Premium")} : toutes les fiches des 666 sociétés sans floutage, indicateurs et graphiques complets, risques, gouvernance et synthèses de résultats.`,
          `${b("Max")} : tout Premium + l\'anti-thèse de chaque société, les favoris illimités et le support prioritaire.`,
        ]) +
        p("Si tu restes en gratuit, aucun souci : la base que tu as suffit pour un usage sérieux. Ce mail est juste pour information."),
      cta: { label: "Voir les plans", url: `${APP_URL}/pricing` },
    },
    en: {
      preheader: "Almost a month on Mettrik AI: here is what Premium and Max unlock.",
      title: "Ready to step it up?",
      body: (n) =>
        p(HI.en(n)) +
        p("You've been using Mettrik AI for almost a month. If you want to step it up:") +
        emailList([
          `${b("Premium")}: every profile of the 666 companies without blurring, full indicators and charts, risks, governance and earnings summaries.`,
          `${b("Max")}: everything in Premium + the counter-thesis of each company, unlimited favorites and priority support.`,
        ]) +
        p("If you stay on free, no worries: the base you have is enough for serious usage. This email is for info only."),
      cta: { label: "See the plans", url: `${APP_URL}/pricing` },
    },
    de: {
      preheader: "Fast ein Monat mit Mettrik AI: Das schalten Premium und Max frei.",
      title: "Bereit für den nächsten Schritt?",
      body: (n) =>
        p(HI.de(n)) +
        p("Sie nutzen Mettrik AI seit fast einem Monat. Wenn Sie einen Schritt weitergehen möchten:") +
        emailList([
          `${b("Premium")}: Alle Profile der 666 Unternehmen ohne Unkenntlichmachung, vollständige Kennzahlen und Charts, Risiken, Governance und Ergebniszusammenfassungen.`,
          `${b("Max")}: Alles aus Premium + die Gegenthese jedes Unternehmens, unbegrenzte Favoriten und bevorzugter Support.`,
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
