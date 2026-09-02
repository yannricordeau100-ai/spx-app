"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { headers, cookies } from "next/headers";
import { authErrorParam, type Locale } from "@/lib/auth-errors";
// Captcha hCaptcha : vérification déléguée à Supabase via options.captchaToken.

/** Extrait le token hCaptcha présent dans le form.
 *  La vérification se fait côté Supabase (option captchaToken sur les
 *  appels auth, vérifié par Supabase avec le secret configuré dans
 *  Auth Settings → Bot/Spam protection → hCaptcha). */
function getCaptchaToken(formData: FormData): string {
  const token = formData.get("h-captcha-response");
  return typeof token === "string" ? token : "";
}

/** Retourne URL d'erreur si pas de token, sinon null. */
function requireCaptcha(formData: FormData, errorRedirect: string): string | null {
  const token = getCaptchaToken(formData);
  if (!token) {
    const msg = "Vérification anti-bot manquante. Recharge la page et réessaie.";
    return `${errorRedirect}&error=${encodeURIComponent(msg)}`;
  }
  return null;
}

/**
 * Server Actions auth — appelées depuis les forms / boutons des pages
 * /login, /signup, /account. Toutes typées, error-safe.
 */

async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/**
 * Détecte la locale active (FR par défaut). Lit en priorité un cookie
 * `NEXT_LOCALE` posé par le switcher i18n, fallback sur `accept-language`.
 */
async function getLocale(): Promise<Locale> {
  try {
    const c = await cookies();
    const cookieLoc = c.get("NEXT_LOCALE")?.value;
    if (cookieLoc === "en") return "en";
    if (cookieLoc === "fr") return "fr";
  } catch {}
  try {
    const h = await headers();
    const al = h.get("accept-language") ?? "";
    if (al.toLowerCase().startsWith("en")) return "en";
  } catch {}
  return "fr";
}

/**
 * Wrapper interne : encode + traduit le message d'erreur Supabase pour la
 * locale active, puis colle dans une URL de redirect.
 */
async function authErr(msg: string | undefined | null): Promise<string> {
  const loc = await getLocale();
  return authErrorParam(msg, loc);
}

/* ─── Email + password ──────────────────────────────────────────────── */

function safeNextParam(raw: FormDataEntryValue | null): string {
  // Par défaut, après connexion / inscription on envoie sur la home
  // (l'app entière est désormais déverrouillée). Si `next` pointe vers
  // une page protégée précise (l'user avait cliqué sur /googl avant de
  // se connecter), on l'y envoie directement.
  if (typeof raw !== "string" || !raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export async function signInWithPassword(formData: FormData) {
  // Yann 11 mai 2026 v4 : retire revalidatePath("layout") qui ralentissait
  // de 1-3 sec. Les pages cibles (home / sandbox/v1-8 / account) sont
  // toutes force-dynamic → cache RSC pas à invalider, getUser() refetch
  // de toute façon. Cible : signin en < 800 ms (vs 2-4 sec avant).
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNextParam(formData.get("next"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/?auth=signin&error=${await authErr(error.message)}`);
  }
  redirect(next);
}

export async function signUpWithPassword(formData: FormData) {
  // Captcha hCaptcha (Yann 13 mai 2026) — vérifié par Supabase via
  // options.captchaToken (config secret dans Auth Settings).
  const captchaErr = requireCaptcha(formData, "/?auth=signup");
  if (captchaErr) redirect(captchaErr);
  const captchaToken = getCaptchaToken(formData);

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createSupabaseServerClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback`, captchaToken },
  });
  if (error) {
    redirect(`/?auth=signup&error=${await authErr(error.message)}`);
  }
  redirect(
    `/?auth=signup&info=${encodeURIComponent("Vérifie ton email pour valider ton compte.")}`
  );
}

/* ─── Magic link ────────────────────────────────────────────────────── */
/* RETIRÉ Yann 13 mai 2026 : tout accès doit passer par inscription
 * email + mot de passe + captcha. Plus de magic link (anti-fraude). */

export async function signInWithMagicLink(_formData: FormData) {
  redirect(
    `/?auth=signin&error=${encodeURIComponent("La connexion par lien magique a été désactivée. Connecte-toi avec ton email et mot de passe.")}`
  );
}

/* ─── Google OAuth ──────────────────────────────────────────────────── */

export async function signInWithGoogle(formData?: FormData) {
  const supabase = await createSupabaseServerClient();
  const origin = await getOrigin();
  // Propage le `next` à travers le redirect Google → /auth/callback?next=...
  // pour que le user retombe sur la page d'origine après login (ex: /parrainage).
  const next = safeNextParam(formData?.get("next") ?? null);
  const callback = next && next !== "/account"
    ? `${origin}/auth/callback?next=${encodeURIComponent(next)}`
    : `${origin}/auth/callback`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback },
  });
  if (error) {
    redirect(`/?auth=signin&error=${await authErr(error.message)}`);
  }
  if (data?.url) {
    redirect(data.url);
  }
}

/* ─── Mot de passe oublié — envoie un email de reset ────────────────── */

export async function requestPasswordReset(formData: FormData) {
  // Captcha hCaptcha (Yann 13 mai 2026) — anti-enumeration emails.
  const captchaErr = requireCaptcha(formData, "/?auth=reset");
  if (captchaErr) redirect(captchaErr);
  const captchaToken = getCaptchaToken(formData);

  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect(
      `/?auth=reset&error=${encodeURIComponent("Renseigne ton adresse email.")}`
    );
  }
  const supabase = await createSupabaseServerClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
    captchaToken,
  });
  if (error) {
    redirect(`/?auth=reset&error=${await authErr(error.message)}`);
  }
  redirect(
    `/?auth=reset&info=${encodeURIComponent("Email de réinitialisation envoyé. Vérifie ta boîte mail.")}`
  );
}

/* ─── Reset effectif — l'user est connecté via le lien ──────────────── */

export async function resetPassword(formData: FormData) {
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (next.length < 8) {
    redirect(
      `/auth/update-password?error=${encodeURIComponent("8 caractères minimum.")}`
    );
  }
  if (next !== confirm) {
    redirect(
      `/auth/update-password?error=${encodeURIComponent("Les deux mots de passe ne correspondent pas.")}`
    );
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=signin");
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) {
    redirect(`/auth/update-password?error=${await authErr(error.message)}`);
  }
  redirect(`/account?info=${encodeURIComponent("Mot de passe mis à jour.")}`);
}

/* ─── Sign out ──────────────────────────────────────────────────────── */

export async function signOut() {
  // Yann 11 mai 2026 v4 : "la déconnexion est très très longue".
  // Cause v3 : revalidatePath("layout") invalidait TOUT le cache RSC
  // → la page cible se reconstruisait entièrement (300-2000 ms cold).
  // Or /sandbox/v1-8 et / sont déjà force-dynamic → revalidate inutile.
  //
  // Fix v4 (rapide) :
  // 1. Parallélise supabase signOut + cookie cleanup (Promise.all)
  // 2. SUPPRIME tous les revalidatePath (force-dynamic suffit)
  // 3. Redirect direct vers la home cible
  // Cible : déconnexion en < 500 ms (vs 3-5 sec avant).
  await Promise.all([
    (async () => {
      try {
        const supabase = await createSupabaseServerClient();
        await supabase.auth.signOut();
      } catch (e) {
        console.error("[signOut] supabase signOut failed:", e);
      }
    })(),
    (async () => {
      try {
        const cookieStore = await cookies();
        for (const c of cookieStore.getAll()) {
          if (c.name.startsWith("sb-") || c.name === "supabase-auth-token") {
            try {
              cookieStore.set(c.name, "", {
                path: "/",
                maxAge: 0,
                expires: new Date(0),
              });
            } catch {
              // ignore par cookie
            }
          }
        }
      } catch (e) {
        console.error("[signOut] cookie cleanup failed:", e);
      }
    })(),
  ]);
  const isStaging =
    process.env.VERCEL_GIT_COMMIT_REF === "staging" ||
    process.env.NEXT_PUBLIC_DEPLOY_TARGET === "staging";
  // Yann 21 mai 2026 : V1.9.5 = défaut staging (au lieu de V1.8).
  redirect(isStaging ? "/sandbox/v1-9-5" : "/");
}

/* ─── Update password (user déjà connecté) ──────────────────────────── */

export async function updatePassword(formData: FormData) {
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 8) {
    redirect(
      `/account?error=${encodeURIComponent("Le nouveau mot de passe doit faire au moins 8 caractères.")}`
    );
  }
  if (next !== confirm) {
    redirect(
      `/account?error=${encodeURIComponent("Les deux mots de passe ne correspondent pas.")}`
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    redirect("/?auth=signin");
  }

  // Re-vérifier le mot de passe actuel pour empêcher un cookie volé
  // de changer le mot de passe sans connaître l'ancien.
  const { error: signinError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  });
  if (signinError) {
    redirect(
      `/account?error=${encodeURIComponent("Mot de passe actuel incorrect.")}`
    );
  }

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) {
    redirect(`/account?error=${await authErr(error.message)}`);
  }

  redirect(`/account?info=${encodeURIComponent("Mot de passe mis à jour.")}`);
}

/* ─── Update email (déclenche un mail de vérification) ──────────────── */

export async function updateEmail(formData: FormData) {
  const newEmail = String(formData.get("email") ?? "").trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
    redirect(
      `/account?error=${encodeURIComponent("Adresse email invalide.")}`
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=signin");

  if (user.email === newEmail) {
    redirect(
      `/account?info=${encodeURIComponent("Cette adresse est déjà la tienne.")}`
    );
  }

  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) {
    redirect(`/account?error=${await authErr(error.message)}`);
  }

  redirect(
    `/account?info=${encodeURIComponent(
      "Email de confirmation envoyé. Clique le lien pour valider la nouvelle adresse."
    )}`
  );
}

/* ─── Delete account (irréversible) ─────────────────────────────────── */

export async function deleteAccount(formData: FormData) {
  const confirmText = String(formData.get("confirm") ?? "").trim();
  if (confirmText !== "SUPPRIMER" && confirmText !== "DELETE") {
    redirect(
      `/account?error=${encodeURIComponent('Tape SUPPRIMER (ou DELETE) en majuscules pour confirmer. / Type SUPPRIMER (or DELETE) in caps to confirm.')}`
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=signin");

  // Suppression via service_role (l'user n'a pas le droit de se supprimer
  // lui-même via la SDK client). Cascade via RLS ON DELETE.
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const admin = createSupabaseAdminClient();
  // Audit 2 sept 2026 : resilier l abonnement Stripe AVANT de supprimer le
  // compte, sinon un client supprime continuait d etre facture.
  try {
    const { data: abo } = await admin
      .from("subscriptions")
      .select("stripe_subscription_id,stripe_customer_id,status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (abo?.stripe_subscription_id && abo.status !== "canceled") {
      const { getStripe } = await import("@/lib/billing/stripe");
      await getStripe().subscriptions.cancel(abo.stripe_subscription_id);
    }
  } catch (e) {
    console.error("[deleteAccount] resiliation Stripe impossible", e);
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    redirect(`/account?error=${await authErr(error.message)}`);
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(
    `/?info=${encodeURIComponent("Compte supprimé. À la prochaine.")}`
  );
}
