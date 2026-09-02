/**
 * Resend — service d'envoi d'emails transactionnels Mettrik AI.
 *
 * STATUS : stub prêt, env var RESEND_API_KEY en `todo`. À activer après
 * création compte Resend + setup DNS mettrik.ai (voir SUPABASE-EMAIL-SETUP.md).
 *
 * Usage :
 *   import { sendWelcomeEmail } from "@/lib/email/resend";
 *   await sendWelcomeEmail("user@example.com", { name: "Yann", locale: "fr" });
 *
 * Adresses (existantes côté Spacemail Spaceship) :
 *   - contact@mettrik.ai      (créée 29 avr 2026)
 *   - support@mettrik.ai      (créée 29 avr 2026)
 *   - noreply@mettrik.ai      (à créer si on veut un sender no-reply propre)
 *
 * Localisation des emails (4 mai 2026) :
 *   - 4 locales supportées : fr, en, de, nl.
 *   - en-GB tombe sur en, de-CH tombe sur de (cascade fallback).
 *   - Toute autre locale fallback sur en.
 */

import { renderEmailLayout, emailParagraph as p } from "./layout";

type FromAddress = "contact" | "support" | "noreply";
export type EmailLocale = "fr" | "en" | "de" | "nl";

const FROM_MAP: Record<FromAddress, string> = {
  contact: "Mettrik AI <contact@mettrik.ai>",
  support: "Mettrik AI Support <support@mettrik.ai>",
  noreply: "Mettrik AI <noreply@mettrik.ai>",
};

export type SendEmailParams = {
  to: string | string[];
  from: FromAddress;
  subject: string;
  html: string;
  /** Adresse de réponse différente du from (ex : noreply qui répond à contact). */
  replyTo?: string;
  /** Tag pour analytics Resend (ex : "welcome", "billing-failed"). */
  tag?: string;
};

export async function sendEmail(params: SendEmailParams): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === "re_TODO") {
    console.warn("[Resend] RESEND_API_KEY missing — email not sent. Add it to .env.local.");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  // ─────────────────────────────────────────────────────────────
  // DRY-RUN MODE (Yann 18 mai 2026, bascule niveau 1)
  //   - En niveau 1 (shadow prod) on NE DOIT PAS envoyer des emails à
  //     de vrais comptes (la Supabase niveau 1 est séparée mais on veut
  //     une garantie supplémentaire).
  //   - Mode déclenché par `EMAIL_DRY_RUN=1` (env var serveur). Mettre
  //     sur niveau 1 ; laisser unset en niveau 0 (prod publique).
  //   - Comportement : log l'email (to, subject, from, tag) côté console
  //     + table Supabase `desk_email_dry_run_log` (si elle existe), ne
  //     fait AUCUN appel à api.resend.com. Renvoie { ok: true } pour ne
  //     pas casser les flux d'inscription.
  // ─────────────────────────────────────────────────────────────
  const dryRun = process.env.EMAIL_DRY_RUN === "1" || process.env.EMAIL_DRY_RUN === "true";
  if (dryRun) {
    const recipients = Array.isArray(params.to) ? params.to.join(", ") : params.to;
    console.log(
      `[Resend DRY-RUN] from=${FROM_MAP[params.from]} to=${recipients} subject="${params.subject}" tag=${params.tag ?? "-"}`,
    );
    return { ok: true, id: `dryrun_${Date.now()}` };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_MAP[params.from],
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.html,
        reply_to: params.replyTo,
        tags: params.tag ? [{ name: "type", value: params.tag }] : undefined,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[Resend] HTTP error", res.status, errBody);
      return { ok: false, error: `HTTP ${res.status}` };
    }

    const data = (await res.json()) as { id: string };
    return { ok: true, id: data.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[Resend] send failed:", msg);
    return { ok: false, error: msg };
  }
}

/* ============================================================ */
/* HELPERS pour les types d'emails standards (4 locales)         */
/* ============================================================ */

/** Réduit toute Locale dictionnaire à une des 4 locales emails (en-GB → en, de-CH → de). */
function normalizeEmailLocale(loc: string | undefined | null): EmailLocale {
  if (!loc) return "en";
  const l = loc.toLowerCase();
  if (l === "fr") return "fr";
  if (l === "de" || l === "de-ch") return "de";
  if (l === "nl") return "nl";
  if (l === "en" || l === "en-gb") return "en";
  return "en";
}

/* ── WELCOME ── */
const WELCOME_SUBJECT: Record<EmailLocale, string> = {
  fr: "Bienvenue sur Mettrik AI",
  en: "Welcome to Mettrik AI",
  de: "Willkommen bei Mettrik AI",
  nl: "Welkom bij Mettrik AI",
};

const WELCOME_COPY: Record<
  EmailLocale,
  { preheader: string; title: string; body: (n: string) => string; cta: string }
> = {
  fr: {
    preheader: "Ton accès est actif : explore les KPI des plus grandes sociétés cotées.",
    title: "Bienvenue sur Mettrik AI",
    body: (n) =>
      p(`Bonjour${n ? " " + n : ""},`) +
      p("Bienvenue sur Mettrik AI. Tu peux dès maintenant explorer les KPI des plus grandes sociétés cotées et comparer leurs indicateurs sectoriels.") +
      p("Une question ? Réponds simplement à cet email."),
    cta: "Ouvrir Mettrik AI",
  },
  en: {
    preheader: "Your access is live: explore the KPIs of the largest listed companies.",
    title: "Welcome to Mettrik AI",
    body: (n) =>
      p(`Hi${n ? " " + n : ""},`) +
      p("Welcome to Mettrik AI. You can now explore the KPIs of the largest listed companies and compare their sector-specific indicators.") +
      p("Any question? Just reply to this email."),
    cta: "Open Mettrik AI",
  },
  de: {
    preheader: "Ihr Zugang ist aktiv: Erkunden Sie die KPIs der größten börsennotierten Unternehmen.",
    title: "Willkommen bei Mettrik AI",
    body: (n) =>
      p(`Hallo${n ? " " + n : ""},`) +
      p("Willkommen bei Mettrik AI. Sie können nun die KPIs der größten börsennotierten Unternehmen erkunden und ihre branchenspezifischen Indikatoren vergleichen.") +
      p("Eine Frage? Antworten Sie einfach auf diese E-Mail."),
    cta: "Mettrik AI öffnen",
  },
  nl: {
    preheader: "Je toegang is actief: verken de KPI's van de grootste beursgenoteerde bedrijven.",
    title: "Welkom bij Mettrik AI",
    body: (n) =>
      p(`Hallo${n ? " " + n : ""},`) +
      p("Welkom bij Mettrik AI. Je kunt nu de KPI's van de grootste beursgenoteerde bedrijven verkennen en hun sectorindicatoren vergelijken.") +
      p("Een vraag? Antwoord gewoon op deze e-mail."),
    cta: "Mettrik AI openen",
  },
};

const WELCOME_BODY: Record<EmailLocale, (name: string) => string> = {
  fr: (n) => renderWelcome("fr", n),
  en: (n) => renderWelcome("en", n),
  de: (n) => renderWelcome("de", n),
  nl: (n) => renderWelcome("nl", n),
};

function renderWelcome(locale: EmailLocale, name: string): string {
  const c = WELCOME_COPY[locale];
  return renderEmailLayout({
    locale,
    preheader: c.preheader,
    title: c.title,
    bodyHtml: c.body(name),
    cta: { label: c.cta, url: "https://www.mettrik.ai" },
  });
}

export async function sendWelcomeEmail(
  to: string,
  opts?: { name?: string; locale?: string }
) {
  const locale = normalizeEmailLocale(opts?.locale);
  return sendEmail({
    to,
    from: "contact",
    subject: WELCOME_SUBJECT[locale],
    tag: "welcome",
    html: WELCOME_BODY[locale](opts?.name ?? ""),
  });
}

/* ── BILLING FAILED ── */
const BILLING_SUBJECT: Record<EmailLocale, string> = {
  fr: "Problème de paiement · Mettrik AI",
  en: "Payment issue · Mettrik AI",
  de: "Zahlungsproblem · Mettrik AI",
  nl: "Betalingsprobleem · Mettrik AI",
};

const BILLING_COPY: Record<
  EmailLocale,
  { preheader: string; title: string; body: string; cta: string; note: string }
> = {
  fr: {
    preheader: "Le paiement de ton abonnement a échoué. Mets à jour tes informations bancaires.",
    title: "Problème de paiement sur ton abonnement",
    body:
      p("Le paiement de ton abonnement Mettrik AI a échoué.") +
      p("Merci de mettre à jour tes informations bancaires depuis ton espace personnel pour éviter une interruption de service."),
    cta: "Mettre à jour le paiement",
    note: "Besoin d'aide ? Réponds à cet email, on te répond vite.",
  },
  en: {
    preheader: "Your subscription payment failed. Please update your billing information.",
    title: "Payment issue on your subscription",
    body:
      p("The payment for your Mettrik AI subscription failed.") +
      p("Please update your billing information from your account area to avoid a service interruption."),
    cta: "Update payment details",
    note: "Need help? Reply to this email, we answer fast.",
  },
  de: {
    preheader: "Die Zahlung für Ihr Abonnement ist fehlgeschlagen. Bitte Zahlungsdaten aktualisieren.",
    title: "Zahlungsproblem bei Ihrem Abonnement",
    body:
      p("Die Zahlung für Ihr Mettrik AI Abonnement ist fehlgeschlagen.") +
      p("Bitte aktualisieren Sie Ihre Zahlungsinformationen in Ihrem Konto, um eine Unterbrechung zu vermeiden."),
    cta: "Zahlungsdaten aktualisieren",
    note: "Brauchen Sie Hilfe? Antworten Sie einfach auf diese E-Mail.",
  },
  nl: {
    preheader: "De betaling voor je abonnement is mislukt. Werk je betaalgegevens bij.",
    title: "Betalingsprobleem met je abonnement",
    body:
      p("De betaling voor je Mettrik AI-abonnement is mislukt.") +
      p("Werk je betaalgegevens bij vanuit je accountpagina om een onderbreking van de dienst te voorkomen."),
    cta: "Betaalgegevens bijwerken",
    note: "Hulp nodig? Antwoord op deze e-mail, we reageren snel.",
  },
};

const BILLING_BODY: Record<EmailLocale, string> = {
  fr: renderBilling("fr"),
  en: renderBilling("en"),
  de: renderBilling("de"),
  nl: renderBilling("nl"),
};

function renderBilling(locale: EmailLocale): string {
  const c = BILLING_COPY[locale];
  return renderEmailLayout({
    locale,
    preheader: c.preheader,
    title: c.title,
    bodyHtml: c.body,
    cta: { label: c.cta, url: "https://www.mettrik.ai/account" },
    note: c.note,
  });
}

export async function sendBillingFailedEmail(to: string, opts?: { locale?: string }) {
  const locale = normalizeEmailLocale(opts?.locale);
  return sendEmail({
    to,
    from: "noreply",
    subject: BILLING_SUBJECT[locale],
    replyTo: "contact@mettrik.ai",
    tag: "billing-failed",
    html: BILLING_BODY[locale],
  });
}
