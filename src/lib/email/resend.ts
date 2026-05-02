/**
 * Resend — service d'envoi d'emails transactionnels.
 *
 * STATUS : stub prêt, env vars en `todo`. À activer après création compte
 * Resend + setup DNS mettrik.ai (voir SUPABASE-EMAIL-SETUP.md option B).
 *
 * Usage typique :
 *
 *   import { sendEmail } from "@/lib/email/resend";
 *   await sendEmail({
 *     to: "user@example.com",
 *     from: "noreply",  // mappé vers noreply@mettrik.ai
 *     subject: "Bienvenue",
 *     html: "<h1>...</h1>",
 *   });
 *
 * Adresses configurées (existantes côté Spacemail Spaceship) :
 *   - contact@mettrik.ai      (créée le 29/04/2026)
 *   - support@mettrik.ai      (créée le 29/04/2026)
 *   - noreply@mettrik.ai      (à créer si on veut un sender no-reply propre)
 *
 * yann@ et antoine@ retirés de la liste car non créés à date — éviterait
 * des bounces silencieux. À ré-ajouter quand effectivement créés.
 */

type FromAddress = "contact" | "support" | "noreply";

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
/* HELPERS pour les types d'emails standards                      */
/* ============================================================ */

export async function sendWelcomeEmail(to: string, name?: string) {
  return sendEmail({
    to,
    from: "contact",
    subject: "Bienvenue sur Mettrik AI",
    tag: "welcome",
    html: `<p>Bonjour ${name ?? ""},</p><p>Bienvenue sur Mettrik AI.</p>`, // template à enrichir via concepts/Email templates
  });
}

export async function sendBillingFailedEmail(to: string) {
  return sendEmail({
    to,
    from: "noreply",
    subject: "Problème de paiement — Mettrik AI",
    replyTo: "contact@mettrik.ai",
    tag: "billing-failed",
    html: `<p>Le paiement de ton abonnement Mettrik AI a échoué. Merci de mettre à jour tes informations bancaires depuis ton compte.</p>`,
  });
}
