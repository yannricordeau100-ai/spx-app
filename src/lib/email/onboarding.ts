/**
 * onboarding.ts — gestion de la séquence email onboarding J+1/J+3/J+7/J+14/J+25.
 *
 * - enrollUser() : appelé après inscription. Crée 5 lignes desk_email_sequences.
 * - processQueue() : appelé par cron, ramasse les emails dus et les envoie.
 * - unsubscribe() : opt-out global.
 *
 * Toutes les fonctions sont idempotentes (unique constraint sur user_email + sequence_key).
 */
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "./resend";
import {
  ONBOARDING_DAYS,
  ONBOARDING_TEMPLATES,
  normalizeOnboardingLocale,
  type OnboardingKey,
} from "./onboarding-templates";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role keys missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export type EnrollOptions = {
  email: string;
  name?: string;
  locale?: string;
  /** Date de référence pour calcul des dates J+N (default = now). */
  startDate?: Date;
};

/**
 * Inscrit un user dans la séquence onboarding. Crée 5 lignes (day1, day3, day7,
 * day14, day25) avec scheduled_for = startDate + N jours. Idempotent : si déjà
 * inscrit, ne fait rien.
 */
export async function enrollUserInOnboarding(opts: EnrollOptions): Promise<{
  enrolled: boolean;
  reason?: string;
}> {
  const supa = adminClient();
  const startDate = opts.startDate ?? new Date();
  const locale = normalizeOnboardingLocale(opts.locale);

  // Vérifier opt-out global
  const { data: unsub } = await supa
    .from("desk_email_unsubscribes")
    .select("user_email")
    .eq("user_email", opts.email)
    .maybeSingle();
  if (unsub) {
    return { enrolled: false, reason: "user-unsubscribed" };
  }

  const rows = (Object.keys(ONBOARDING_DAYS) as OnboardingKey[]).map((key) => {
    const days = ONBOARDING_DAYS[key];
    const scheduled = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
    return {
      user_email: opts.email,
      user_name: opts.name ?? null,
      locale,
      sequence_key: key,
      day_offset: days,
      scheduled_for: scheduled.toISOString(),
    };
  });

  // Idempotent grâce à la unique constraint (user_email, sequence_key).
  const { error } = await supa
    .from("desk_email_sequences")
    .upsert(rows, { onConflict: "user_email,sequence_key", ignoreDuplicates: true });
  if (error) return { enrolled: false, reason: error.message };
  return { enrolled: true };
}

/**
 * Marque un user comme désinscrit de la séquence onboarding. Cancel toutes les
 * lignes pas encore envoyées en marquant unsubscribed_at.
 */
export async function unsubscribeUser(email: string, reason?: string): Promise<void> {
  const supa = adminClient();
  await supa
    .from("desk_email_unsubscribes")
    .upsert({ user_email: email, reason: reason ?? null }, { onConflict: "user_email" });
  await supa
    .from("desk_email_sequences")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("user_email", email)
    .is("sent_at", null)
    .is("unsubscribed_at", null);
}

/**
 * Cron handler : récupère les lignes scheduled_for <= now() ET sent_at IS NULL
 * ET unsubscribed_at IS NULL. Envoie chaque email via Resend, marque sent_at.
 *
 * Cap = 50 emails par run pour ne pas saturer Resend (free tier 100/jour).
 * Idempotent : un email déjà envoyé n'est jamais ré-envoyé.
 */
export async function processOnboardingQueue(): Promise<{
  picked: number;
  sent: number;
  errors: number;
  details: Array<{ email: string; key: string; status: string }>;
}> {
  const supa = adminClient();
  const cap = 50;
  const { data: pending, error } = await supa
    .from("desk_email_sequences")
    .select("id, user_email, user_name, locale, sequence_key")
    .lte("scheduled_for", new Date().toISOString())
    .is("sent_at", null)
    .is("unsubscribed_at", null)
    .order("scheduled_for", { ascending: true })
    .limit(cap);
  if (error) throw error;

  const details: Array<{ email: string; key: string; status: string }> = [];
  let sent = 0;
  let errors = 0;

  for (const row of pending ?? []) {
    const key = row.sequence_key as OnboardingKey;
    const tpl = ONBOARDING_TEMPLATES[key];
    if (!tpl) {
      errors++;
      details.push({ email: row.user_email, key, status: "no-template" });
      continue;
    }
    const locale = normalizeOnboardingLocale(row.locale);
    const subject = tpl.subject[locale];
    const html = tpl.body[locale](row.user_name ?? "");
    const result = await sendEmail({
      to: row.user_email,
      from: "contact",
      subject,
      html,
      tag: `onboarding-${key}`,
      replyTo: "contact@mettrik.ai",
    });
    if (result.ok) {
      await supa
        .from("desk_email_sequences")
        .update({
          sent_at: new Date().toISOString(),
          send_status: "sent",
          resend_id: result.id ?? null,
        })
        .eq("id", row.id);
      sent++;
      details.push({ email: row.user_email, key, status: "sent" });
    } else {
      await supa
        .from("desk_email_sequences")
        .update({
          sent_at: new Date().toISOString(),
          send_status: `error:${result.error ?? "unknown"}`,
        })
        .eq("id", row.id);
      errors++;
      details.push({ email: row.user_email, key, status: `error:${result.error}` });
    }
  }

  return { picked: pending?.length ?? 0, sent, errors, details };
}
