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
 *   - 6 locales supportées : fr, en, de, nl, sv, da.
 *   - en-GB tombe sur en, de-CH tombe sur de (cascade fallback).
 *   - Toute autre locale fallback sur en.
 */

type FromAddress = "contact" | "support" | "noreply";
export type EmailLocale = "fr" | "en" | "de" | "nl" | "sv" | "da";

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
/* HELPERS pour les types d'emails standards (6 locales)         */
/* ============================================================ */

/** Réduit toute Locale dictionnaire à une des 6 locales emails (en-GB → en, de-CH → de). */
function normalizeEmailLocale(loc: string | undefined | null): EmailLocale {
  if (!loc) return "en";
  const l = loc.toLowerCase();
  if (l === "fr") return "fr";
  if (l === "de" || l === "de-ch") return "de";
  if (l === "nl") return "nl";
  if (l === "sv") return "sv";
  if (l === "da") return "da";
  if (l === "en" || l === "en-gb") return "en";
  return "en";
}

/* ── WELCOME ── */
const WELCOME_SUBJECT: Record<EmailLocale, string> = {
  fr: "Bienvenue sur Mettrik AI",
  en: "Welcome to Mettrik AI",
  de: "Willkommen bei Mettrik AI",
  nl: "Welkom bij Mettrik AI",
  sv: "Välkommen till Mettrik AI",
  da: "Velkommen til Mettrik AI",
};

const WELCOME_BODY: Record<EmailLocale, (name: string) => string> = {
  fr: (n) => `<p>Bonjour${n ? " " + n : ""},</p>
<p>Bienvenue sur Mettrik AI. Tu peux dès maintenant explorer les KPIs des plus grandes sociétés cotées et comparer leurs indicateurs sectoriels.</p>
<p>Une question ? Réponds simplement à cet email.</p>
<p style="color:#888;font-size:12px;margin-top:24px">Mettrik AI publie des analyses à titre informatif. Aucun contenu ne constitue un conseil en investissement.</p>`,
  en: (n) => `<p>Hi${n ? " " + n : ""},</p>
<p>Welcome to Mettrik AI. You can now explore the KPIs of the largest listed companies and compare their sector-specific indicators.</p>
<p>Any question? Just reply to this email.</p>
<p style="color:#888;font-size:12px;margin-top:24px">Mettrik AI publishes analyses for informational purposes only. No content constitutes investment advice.</p>`,
  de: (n) => `<p>Hallo${n ? " " + n : ""},</p>
<p>Willkommen bei Mettrik AI. Sie können nun die KPIs der größten börsennotierten Unternehmen erkunden und ihre branchenspezifischen Indikatoren vergleichen.</p>
<p>Eine Frage? Antworten Sie einfach auf diese E-Mail.</p>
<p style="color:#888;font-size:12px;margin-top:24px">Mettrik AI veröffentlicht Analysen ausschließlich zu Informationszwecken. Kein Inhalt stellt eine Anlageberatung dar.</p>`,
  nl: (n) => `<p>Hallo${n ? " " + n : ""},</p>
<p>Welkom bij Mettrik AI. Je kunt nu de KPI's van de grootste beursgenoteerde bedrijven verkennen en hun sectorindicatoren vergelijken.</p>
<p>Een vraag? Antwoord gewoon op deze e-mail.</p>
<p style="color:#888;font-size:12px;margin-top:24px">Mettrik AI publiceert analyses uitsluitend ter informatie. Geen enkele inhoud vormt beleggingsadvies.</p>`,
  sv: (n) => `<p>Hej${n ? " " + n : ""},</p>
<p>Välkommen till Mettrik AI. Du kan nu utforska KPI:erna för de största börsnoterade bolagen och jämföra deras branschindikatorer.</p>
<p>Frågor? Svara bara på det här mejlet.</p>
<p style="color:#888;font-size:12px;margin-top:24px">Mettrik AI publicerar analyser endast i informationssyfte. Inget innehåll utgör investeringsrådgivning.</p>`,
  da: (n) => `<p>Hej${n ? " " + n : ""},</p>
<p>Velkommen til Mettrik AI. Du kan nu udforske KPI'erne for de største børsnoterede selskaber og sammenligne deres branchespecifikke indikatorer.</p>
<p>Spørgsmål? Svar blot på denne mail.</p>
<p style="color:#888;font-size:12px;margin-top:24px">Mettrik AI udgiver analyser udelukkende til informationsformål. Intet indhold udgør investeringsrådgivning.</p>`,
};

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
  sv: "Betalningsproblem · Mettrik AI",
  da: "Betalingsproblem · Mettrik AI",
};

const BILLING_BODY: Record<EmailLocale, string> = {
  fr: `<p>Le paiement de ton abonnement Mettrik AI a échoué.</p>
<p>Merci de mettre à jour tes informations bancaires depuis ton espace personnel pour éviter une interruption de service.</p>`,
  en: `<p>The payment for your Mettrik AI subscription failed.</p>
<p>Please update your billing information from your account area to avoid a service interruption.</p>`,
  de: `<p>Die Zahlung für Ihr Mettrik AI Abonnement ist fehlgeschlagen.</p>
<p>Bitte aktualisieren Sie Ihre Zahlungsinformationen in Ihrem Konto, um eine Unterbrechung zu vermeiden.</p>`,
  nl: `<p>De betaling voor je Mettrik AI-abonnement is mislukt.</p>
<p>Werk je betaalgegevens bij vanuit je accountpagina om een onderbreking van de dienst te voorkomen.</p>`,
  sv: `<p>Betalningen för din Mettrik AI-prenumeration misslyckades.</p>
<p>Uppdatera dina betalningsuppgifter i ditt konto för att undvika ett avbrott i tjänsten.</p>`,
  da: `<p>Betalingen for dit Mettrik AI-abonnement mislykkedes.</p>
<p>Opdater dine betalingsoplysninger fra din kontoside for at undgå en afbrydelse af tjenesten.</p>`,
};

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
