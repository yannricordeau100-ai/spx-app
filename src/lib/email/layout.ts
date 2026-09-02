/**
 * layout.ts — layout HTML partagé pour tous les emails Resend Mettrik AI.
 *
 * Design aligné sur la charte app : fond #050507, carte #0b0b0e, bordures
 * #26262b, accents violet #a78bfa / cyan #22d3ee, wordmark Mettrik AI.
 *
 * Contraintes clients mail respectées :
 * - tables HTML + styles inline (Outlook / Gmail), largeur max 600px
 * - system font stack, pas de webfont
 * - preheader caché 50-90 caractères
 * - bouton bulletproof (table + padding, min 44px de haut)
 * - lien de secours en texte sous le bouton
 * - meta color-scheme dark + couleurs explicites partout (anti-inversion Gmail)
 * - jamais d'em-dash dans le texte
 */

export type LayoutLocale = "fr" | "en" | "de" | "nl";

export type EmailLayoutOptions = {
  locale: LayoutLocale;
  /** Texte caché affiché en aperçu inbox (50-90 caractères). */
  preheader: string;
  /** Titre court dans la carte. */
  title: string;
  /** Corps HTML : utiliser emailParagraph / emailList pour rester cohérent. */
  bodyHtml: string;
  /** CTA principal unique (bouton bulletproof + lien de secours). */
  cta?: { label: string; url: string };
  /** Petite note sous le CTA (ex : expiration du lien). */
  note?: string;
  /** Ajoute la ligne de désinscription (emails onboarding uniquement). */
  withUnsubscribe?: boolean;
};

/* Palette charte (couleurs explicites, jamais héritées) */
const C = {
  page: "#050507",
  card: "#0b0b0e",
  border: "#26262b",
  title: "#f4f4f5",
  body: "#b9b9c3",
  muted: "#8f8f9c",
  faint: "#6b6b78",
  violet: "#a78bfa",
  cyan: "#22d3ee",
  btnText: "#0b0b0e",
} as const;

const FONT =
  "'Helvetica Neue',Helvetica,Arial,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

const LOGO_URL =
  "https://mettrik-niveau2.vercel.app/brand/mettrik-ai-white-purple.png";

const STR: Record<
  LayoutLocale,
  { fallback: string; legal: string; unsubscribe: string; sender: string }
> = {
  fr: {
    fallback: "Le bouton ne s'affiche pas ? Utilise ce lien :",
    legal:
      "Mettrik AI publie des analyses à titre informatif. Aucun contenu ne constitue un conseil en investissement.",
    unsubscribe:
      "Pour te désinscrire de cette série, réponds simplement « stop » à ce mail.",
    sender: "Mettrik AI · KPI Intelligence · mettrik.ai",
  },
  en: {
    fallback: "Button not showing? Use this link instead:",
    legal:
      "Mettrik AI publishes analyses for informational purposes only. No content constitutes investment advice.",
    unsubscribe:
      "To unsubscribe from this series, simply reply \"stop\" to this email.",
    sender: "Mettrik AI · KPI Intelligence · mettrik.ai",
  },
  de: {
    fallback: "Der Button wird nicht angezeigt? Nutzen Sie diesen Link:",
    legal:
      "Mettrik AI veröffentlicht Analysen ausschließlich zu Informationszwecken. Kein Inhalt stellt eine Anlageberatung dar.",
    unsubscribe:
      "Um sich von dieser Serie abzumelden, antworten Sie einfach mit \"stop\" auf diese E-Mail.",
    sender: "Mettrik AI · KPI Intelligence · mettrik.ai",
  },
  nl: {
    fallback: "Zie je de knop niet? Gebruik deze link:",
    legal:
      "Mettrik AI publiceert analyses uitsluitend ter informatie. Geen enkele inhoud vormt beleggingsadvies.",
    unsubscribe:
      "Om je af te melden voor deze reeks, antwoord gewoon \"stop\" op deze e-mail.",
    sender: "Mettrik AI · KPI Intelligence · mettrik.ai",
  },
};

/** Paragraphe standard du corps d'email. */
export function emailParagraph(html: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${C.body};">${html}</p>`;
}

/** Mise en avant (strong) dans un paragraphe, en zinc clair. */
export function emailStrong(html: string): string {
  return `<strong style="color:${C.title};font-weight:700;">${html}</strong>`;
}

/** Liste à puces avec puce violette. */
export function emailList(items: string[]): string {
  const rows = items
    .map(
      (it) =>
        `<tr><td valign="top" style="padding:0 10px 10px 0;font-size:15px;line-height:1.6;color:${C.violet};font-weight:700;">&#8226;</td><td style="padding:0 0 10px;font-size:14.5px;line-height:1.6;color:${C.body};">${it}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">${rows}</table>`;
}

/** Encadré secondaire (fond légèrement relevé, bordure fine). */
export function emailPanel(label: string, innerHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 16px;background:#101014;border:1px solid ${C.border};border-radius:12px;"><tr><td style="padding:16px 18px;">
<p style="margin:0 0 10px;font-size:10.5px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${C.violet};">${label}</p>
${innerHtml}
</td></tr></table>`;
}

function ctaBlock(locale: LayoutLocale, cta: { label: string; url: string }): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 14px;">
<tr><td align="center" bgcolor="#a78bfa" style="background:${C.violet};border-radius:10px;">
<a href="${cta.url}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:15px;font-weight:700;line-height:1.1;color:${C.btnText};text-decoration:none;border-radius:10px;">${cta.label}</a>
</td></tr></table>
<p style="margin:0 0 18px;font-size:12px;line-height:1.55;color:${C.muted};">${STR[locale].fallback}<br>
<a href="${cta.url}" target="_blank" style="color:${C.violet};text-decoration:underline;word-break:break-all;">${cta.url}</a></p>`;
}

/** Rend l'email complet (document HTML autonome). */
export function renderEmailLayout(opts: EmailLayoutOptions): string {
  const s = STR[opts.locale];
  return `<!DOCTYPE html>
<html lang="${opts.locale}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};font-family:${FONT};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${C.page};opacity:0;">${opts.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#050507" style="background:${C.page};">
<tr><td align="center" style="padding:36px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

<tr><td style="padding:0 4px 20px;">
<img src="${LOGO_URL}" width="140" alt="Mettrik AI · KPI Intelligence" style="display:block;width:140px;max-width:140px;height:auto;border:0;">
</td></tr>

<tr><td bgcolor="#0b0b0e" style="background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:0 0 6px;">
<div style="width:44px;height:3px;border-radius:2px;background:${C.violet};background-image:linear-gradient(90deg,${C.violet},${C.cyan});font-size:0;line-height:0;">&nbsp;</div>
</td></tr>
<tr><td style="padding:14px 0 12px;">
<h1 style="margin:0;font-family:${FONT};font-size:23px;line-height:1.25;font-weight:800;letter-spacing:-0.01em;color:${C.title};">${opts.title}</h1>
</td></tr>
<tr><td style="padding:2px 0 0;">
${opts.bodyHtml}
${opts.cta ? ctaBlock(opts.locale, opts.cta) : ""}
${opts.note ? `<p style="margin:0;padding-top:12px;border-top:1px solid ${C.border};font-size:12px;line-height:1.55;color:${C.muted};">${opts.note}</p>` : ""}
</td></tr>
</table>
</td></tr>

<tr><td style="padding:20px 4px 0;">
<p style="margin:0 0 6px;font-size:11.5px;line-height:1.5;color:${C.muted};">${s.sender}</p>
<p style="margin:0;font-size:10.5px;line-height:1.6;color:${C.faint};">${s.legal}${opts.withUnsubscribe ? `<br>${s.unsubscribe}` : ""}</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
