/**
 * onboarding-templates.ts — séquence onboarding J+1 / J+3 / J+7 / J+14 / J+25.
 *
 * 5 emails pédagogiques pour engager le nouvel utilisateur après inscription.
 * Chacun localisé en FR / EN / DE (locales primaires Mettrik AI). NL/SV/DA
 * fallback sur EN.
 *
 * Ton : rappeler concrètement la PV de l'app, donner 1 conseil utile par
 * email, jamais d'argumentaire de vente lourd. Tutoiement FR.
 */

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

/* Petit utilitaire pour wrapper le contenu HTML dans un layout sobre. */
function wrap(html: string, footerLocale: OnboardingLocale): string {
  const FOOTER: Record<OnboardingLocale, string> = {
    fr: "Mettrik AI publie des analyses à titre informatif. Aucun contenu ne constitue un conseil en investissement.",
    en: "Mettrik AI publishes analyses for informational purposes only. No content constitutes investment advice.",
    de: "Mettrik AI veröffentlicht Analysen ausschließlich zu Informationszwecken. Kein Inhalt stellt eine Anlageberatung dar.",
  };
  const UNSUB: Record<OnboardingLocale, string> = {
    fr: "Tu peux te désinscrire de cette série en répondant simplement « stop » à ce mail.",
    en: "You can unsubscribe from this series by simply replying \"stop\" to this email.",
    de: "Sie können sich von dieser Serie abmelden, indem Sie einfach mit \"stop\" auf diese E-Mail antworten.",
  };
  return `<div style="font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;max-width:560px;margin:auto;padding:24px">
  ${html}
  <p style="color:#888;font-size:11.5px;margin-top:32px;border-top:1px solid #eee;padding-top:12px">
    ${FOOTER[footerLocale]}<br>${UNSUB[footerLocale]}
  </p>
</div>`;
}

const DAY1: OnboardingTemplate = {
  subject: {
    fr: "Premier pas avec Mettrik AI",
    en: "Your first step with Mettrik AI",
    de: "Ihr erster Schritt mit Mettrik AI",
  },
  body: {
    fr: (n) =>
      wrap(
        `<p>Salut${n ? " " + n : ""},</p>
<p>Bienvenue. En 30 secondes tu peux comparer le hero KPI de n'importe quelle société du top 300.</p>
<p><strong>Conseil du jour :</strong> commence par les 5 sociétés que tu suis le plus. Tape leur ticker dans la barre du haut et regarde leur indicateur principal. Tu verras tout de suite si la dynamique récente est saine ou pas.</p>
<p><a href="https://www.mettrik.ai" style="color:#7c3aed;text-decoration:underline">Ouvrir Mettrik AI →</a></p>`,
        "fr",
      ),
    en: (n) =>
      wrap(
        `<p>Hi${n ? " " + n : ""},</p>
<p>Welcome aboard. In 30 seconds, you can compare the hero KPI of any company in the top 300.</p>
<p><strong>Tip of the day:</strong> start with the 5 companies you follow most. Type their ticker in the top bar and look at their hero KPI. You'll see right away whether their recent trend is healthy.</p>
<p><a href="https://www.mettrik.ai" style="color:#7c3aed;text-decoration:underline">Open Mettrik AI →</a></p>`,
        "en",
      ),
    de: (n) =>
      wrap(
        `<p>Hallo${n ? " " + n : ""},</p>
<p>Willkommen an Bord. In 30 Sekunden können Sie den Hero-KPI eines beliebigen Unternehmens aus den Top 300 vergleichen.</p>
<p><strong>Tipp des Tages:</strong> Starten Sie mit den 5 Unternehmen, die Sie am meisten verfolgen. Geben Sie deren Ticker in der oberen Leiste ein und betrachten Sie deren Hero-KPI. Sie sehen sofort, ob die Entwicklung gesund ist.</p>
<p><a href="https://www.mettrik.ai" style="color:#7c3aed;text-decoration:underline">Mettrik AI öffnen →</a></p>`,
        "de",
      ),
  },
};

const DAY3: OnboardingTemplate = {
  subject: {
    fr: "Le bouton « Comparer », ton meilleur ami",
    en: "The Compare button, your best friend",
    de: "Der Vergleichen-Button, Ihr bester Freund",
  },
  body: {
    fr: (n) =>
      wrap(
        `<p>Salut${n ? " " + n : ""},</p>
<p>Tu as exploré plusieurs fiches société. Aujourd'hui, je te montre la fonction qui change tout : <strong>Comparer</strong>.</p>
<p>Sur n'importe quelle fiche, clique sur « Comparer » en haut. Tu obtiens : CAGR 5 ans, momentum sur le dernier trimestre, volatilité, position vs sous-secteur. C'est l'équivalent de 30 minutes d'analyse Excel en 2 secondes.</p>
<p><strong>Essaye :</strong> compare META vs GOOGL sur leur hero KPI. Verdict instantané.</p>`,
        "fr",
      ),
    en: (n) =>
      wrap(
        `<p>Hi${n ? " " + n : ""},</p>
<p>You've explored a few company pages. Today, let me show you the feature that changes everything: <strong>Compare</strong>.</p>
<p>On any page, click "Compare" at the top. You get: 5-year CAGR, last quarter momentum, volatility, position vs sub-sector. That's the equivalent of 30 minutes of Excel work in 2 seconds.</p>
<p><strong>Try this:</strong> compare META vs GOOGL on their hero KPI. Instant verdict.</p>`,
        "en",
      ),
    de: (n) =>
      wrap(
        `<p>Hallo${n ? " " + n : ""},</p>
<p>Sie haben einige Unternehmensseiten erkundet. Heute zeige ich Ihnen die Funktion, die alles verändert: <strong>Vergleichen</strong>.</p>
<p>Klicken Sie auf einer beliebigen Seite oben auf "Vergleichen". Sie erhalten: 5-Jahres-CAGR, Momentum des letzten Quartals, Volatilität, Position vs Untersektor. Das entspricht 30 Minuten Excel-Arbeit in 2 Sekunden.</p>
<p><strong>Probieren Sie:</strong> Vergleichen Sie META vs GOOGL beim Hero-KPI. Sofortiges Urteil.</p>`,
        "de",
      ),
  },
};

const DAY7: OnboardingTemplate = {
  subject: {
    fr: "Le bloc Risques que personne ne lit (à tort)",
    en: "The Risks block nobody reads (wrongly so)",
    de: "Der Risiken-Block, den niemand liest (zu Unrecht)",
  },
  body: {
    fr: (n) =>
      wrap(
        `<p>Salut${n ? " " + n : ""},</p>
<p>Une semaine que tu utilises Mettrik AI. Voilà un bloc qui sort du lot : <strong>Facteurs de risque</strong>.</p>
<p>Chaque sté affiche 5 à 8 risques avec un score 1-5 et un rationale. C'est une lecture condensée de ce que la sté écrit elle-même dans son rapport annuel. Ça t'épargne 100 pages de PDF.</p>
<p>Cherche les chips « Nouveau » ou « En hausse » : ce sont les risques que la sté a augmentés cette année. Souvent, c'est le signal le plus utile.</p>`,
        "fr",
      ),
    en: (n) =>
      wrap(
        `<p>Hi${n ? " " + n : ""},</p>
<p>One week using Mettrik AI. Here's a block that stands out: <strong>Risk factors</strong>.</p>
<p>Each company shows 5 to 8 risks with a 1-5 score and rationale. It's a condensed read of what the company itself writes in its annual report. Saves you 100 pages of PDF.</p>
<p>Look for "New" or "Up" chips: those are risks the company escalated this year. Often the most useful signal.</p>`,
        "en",
      ),
    de: (n) =>
      wrap(
        `<p>Hallo${n ? " " + n : ""},</p>
<p>Eine Woche mit Mettrik AI. Hier ist ein Block, der heraussticht: <strong>Risikofaktoren</strong>.</p>
<p>Jedes Unternehmen zeigt 5 bis 8 Risiken mit einer Bewertung von 1-5 und einer Begründung. Es ist eine komprimierte Zusammenfassung dessen, was das Unternehmen selbst in seinem Geschäftsbericht schreibt. Spart Ihnen 100 PDF-Seiten.</p>
<p>Achten Sie auf die Chips "Neu" oder "Steigend": Das sind Risiken, die das Unternehmen dieses Jahr verstärkt hat. Oft das nützlichste Signal.</p>`,
        "de",
      ),
  },
};

const DAY14: OnboardingTemplate = {
  subject: {
    fr: "Gouvernance : ce que les 10-K cachent en plein jour",
    en: "Governance: what 10-Ks hide in plain sight",
    de: "Governance: Was 10-Ks im Klartext verbergen",
  },
  body: {
    fr: (n) =>
      wrap(
        `<p>Salut${n ? " " + n : ""},</p>
<p>Le bloc <strong>Gouvernance</strong> donne 9 indicateurs : indépendance du board, dual-class, pay ratio, vote des actionnaires, etc. Plus le comparatif vs pairs en mots simples (« Bien au-dessus de la moyenne », pas de jargon).</p>
<p>Clique sur le block « Top 3 droits de vote » pour voir le pie chart 3D : tu visualises immédiatement si la sté est contrôlée par 1-2 actionnaires (= risque dilué) ou par un float liquide.</p>`,
        "fr",
      ),
    en: (n) =>
      wrap(
        `<p>Hi${n ? " " + n : ""},</p>
<p>The <strong>Governance</strong> block gives 9 indicators: board independence, dual-class, pay ratio, shareholder votes, etc. Plus a peer comparison in plain words ("Well above average", no jargon).</p>
<p>Click the "Top 3 voting rights" block to open the 3D pie chart: you instantly see whether the company is controlled by 1-2 shareholders (= concentrated risk) or by a liquid float.</p>`,
        "en",
      ),
    de: (n) =>
      wrap(
        `<p>Hallo${n ? " " + n : ""},</p>
<p>Der <strong>Governance</strong>-Block liefert 9 Indikatoren: Unabhängigkeit des Boards, Dual-Class, Pay Ratio, Aktionärsabstimmungen usw. Plus ein Peer-Vergleich in klaren Worten ("Deutlich über dem Durchschnitt", kein Fachjargon).</p>
<p>Klicken Sie auf den Block "Top 3 Stimmrechte", um das 3D-Tortendiagramm zu öffnen: Sie sehen sofort, ob das Unternehmen von 1-2 Aktionären kontrolliert wird (= Konzentrationsrisiko) oder durch einen liquiden Float.</p>`,
        "de",
      ),
  },
};

const DAY25: OnboardingTemplate = {
  subject: {
    fr: "Plan Pro : ce que tu débloques",
    en: "Pro plan: what you unlock",
    de: "Pro-Plan: Was Sie freischalten",
  },
  body: {
    fr: (n) =>
      wrap(
        `<p>Salut${n ? " " + n : ""},</p>
<p>Tu utilises Mettrik AI depuis presque un mois. Si tu veux passer à la vitesse supérieure :</p>
<ul>
  <li><strong>Pro</strong> : accès aux 1500+ stés (vs 300 en gratuit), comparaisons multi-sociétés, alertes earning dates.</li>
  <li><strong>Investisseur</strong> : tout Pro + export PDF des fiches, watchlists illimitées, données trimestrielles complètes.</li>
</ul>
<p><a href="https://www.mettrik.ai/pricing" style="color:#7c3aed;text-decoration:underline">Voir les plans →</a></p>
<p>Si tu restes en gratuit, aucun souci : la base que tu as suffit pour un usage sérieux. Ce mail est juste pour information.</p>`,
        "fr",
      ),
    en: (n) =>
      wrap(
        `<p>Hi${n ? " " + n : ""},</p>
<p>You've been using Mettrik AI for almost a month. If you want to step it up:</p>
<ul>
  <li><strong>Pro</strong>: access to all 1500+ companies (vs 300 on free), multi-company comparisons, earnings date alerts.</li>
  <li><strong>Investor</strong>: everything in Pro + PDF export of profiles, unlimited watchlists, full quarterly data.</li>
</ul>
<p><a href="https://www.mettrik.ai/pricing" style="color:#7c3aed;text-decoration:underline">See the plans →</a></p>
<p>If you stay on free, no worries: the base you have is enough for serious usage. This email is for info only.</p>`,
        "en",
      ),
    de: (n) =>
      wrap(
        `<p>Hallo${n ? " " + n : ""},</p>
<p>Sie nutzen Mettrik AI seit fast einem Monat. Wenn Sie einen Schritt weitergehen möchten:</p>
<ul>
  <li><strong>Pro</strong>: Zugriff auf alle 1500+ Unternehmen (vs 300 in der kostenlosen Version), Multi-Unternehmens-Vergleiche, Earnings-Date-Alerts.</li>
  <li><strong>Investor</strong>: Alles aus Pro + PDF-Export der Profile, unbegrenzte Watchlists, vollständige Quartalsdaten.</li>
</ul>
<p><a href="https://www.mettrik.ai/pricing" style="color:#7c3aed;text-decoration:underline">Pläne ansehen →</a></p>
<p>Wenn Sie kostenlos bleiben, kein Problem: Die Basis, die Sie haben, reicht für ernsthafte Nutzung. Diese E-Mail dient nur zur Information.</p>`,
        "de",
      ),
  },
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
