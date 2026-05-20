"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Mail, Lock, X, Sparkles, ArrowLeft, Loader2 } from "lucide-react";
import {
  signUpWithPassword,
  signInWithMagicLink,
  signInWithGoogle,
  requestPasswordReset,
} from "@/app/auth/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/provider";
import { HCaptchaWidget } from "@/components/hcaptcha-widget";

/**
 * Bouton submit avec état "pending" automatique via useFormStatus.
 * Yann (10 mai 2026) : le bouton "Se connecter" semblait bloqué car aucun
 * feedback visuel pendant l'attente serveur. Maintenant : spinner +
 * désactivation pendant le submit, plus de doute pour l'utilisateur.
 */
function SubmitButton({
  children,
  className = "",
  variant = "primary",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "ghost" | "small";
}) {
  const { pending } = useFormStatus();
  const base =
    variant === "small"
      ? "ml-2 shrink-0 rounded-md bg-cyan-400/15 px-2.5 py-1 text-[12px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/25 disabled:opacity-60"
      : variant === "ghost"
        ? "inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/[0.07] disabled:opacity-60"
        : "mt-1 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-3 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_rgba(139,92,246,0.7)] transition-colors hover:bg-violet-400 disabled:opacity-70 disabled:cursor-wait";
  return (
    <button type="submit" disabled={pending} className={`${base} ${className}`}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

/**
 * AuthModal — pop-up Sign In / Sign Up / Reset password.
 *
 * Modes :
 *   - signin : email+password + magic link + Google + lien "mot de passe oublié"
 *   - signup : email+password + Google
 *   - reset  : email seul + bouton "Envoyer le lien"
 *
 * Déclenché par `?auth=signin|signup|reset`. Si l'URL n'a aucun de ces
 * params, la modal n'apparaît pas (la home reste accessible).
 */
type Mode = "signin" | "signup" | "reset";

export function AuthModal() {
  const { t } = useT();
  const params = useSearchParams();
  const router = useRouter();
  const auth = params.get("auth");
  const open = auth === "signin" || auth === "signup" || auth === "reset";
  const initialMode: Mode =
    auth === "signup" ? "signup" : auth === "reset" ? "reset" : "signin";
  const error = params.get("error");
  const info = params.get("info");

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  // Yann (11 mai 2026) : signin client-side direct au lieu de Server Action.
  // Bénéfice : feedback immédiat, erreur visible, plus de "20 sec et pas
  // connecté" (cookie posé instantanément côté browser, pas de race condition
  // avec le redirect serveur).
  const [signinErr, setSigninErr] = useState<string | null>(null);
  const [signinBusy, setSigninBusy] = useState(false);

  async function handleSigninClient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSigninErr(null);
    setSigninBusy(true);
    const fd = new FormData(e.currentTarget);
    const emailV = String(fd.get("email") ?? "").trim();
    const passwordV = String(fd.get("password") ?? "");
    if (!emailV || !passwordV) {
      setSigninErr("Email + mot de passe requis");
      setSigninBusy(false);
      return;
    }
    try {
      // Yann 20 mai 17h : fix DÉFINITIF Lock "sb-...-auth-token released
      // because another request stole it".
      // Cause = navigator.locks API utilisée par Supabase JS v2 pour sync
      // refresh token entre tabs. Si plusieurs composants créent des
      // clients Supabase en parallèle (UserPrefsSync, AdminFloatingPanel,
      // server actions), ils contention le même lock.
      // Stratégie : (1) clear localStorage, (2) retry 3× max sur erreur
      // Lock, (3) timeout 15s par tentative.
      try {
        if (typeof window !== "undefined") {
          for (const k of Object.keys(window.localStorage)) {
            if (k.startsWith("sb-") || k.includes("supabase")) {
              window.localStorage.removeItem(k);
            }
          }
        }
      } catch {}
      const supa = createSupabaseBrowserClient();

      let data: Awaited<ReturnType<typeof supa.auth.signInWithPassword>>["data"] | null = null;
      let error: Awaited<ReturnType<typeof supa.auth.signInWithPassword>>["error"] | null = null;
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const signinPromise = supa.auth.signInWithPassword({ email: emailV, password: passwordV });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 15000),
        );
        try {
          const res = await Promise.race([signinPromise, timeoutPromise]) as Awaited<typeof signinPromise>;
          data = res.data;
          error = res.error;
          // Retry uniquement si l'erreur Supabase est un Lock contention
          const isLockErr = error?.message?.toLowerCase().includes("lock") &&
                            error.message.toLowerCase().includes("stole");
          if (!isLockErr) break;
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 500 * attempt));
            continue;
          }
        } catch (innerErr) {
          if (innerErr instanceof Error && innerErr.message === "timeout") throw innerErr;
          if (attempt === maxAttempts) throw innerErr;
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      }
      if (error || !data || !data.session) {
        setSigninErr(
          error?.message?.includes("Invalid login")
            ? "Email ou mot de passe incorrect."
            : error?.message?.includes("Email not confirmed")
              ? "Email pas encore confirmé. Vérifie ta boîte mail."
              : (error?.message ?? "Connexion impossible. Réessaie dans un instant."),
        );
        setSigninBusy(false);
        return;
      }
      // Yann (12 mai 2026) : fix 404 après login.
      // Cause : window.location.href = nextParam pouvait pointer sur une
      // URL fantôme (params de l'ancienne session, page protégée disable,
      // etc.). Maintenant on redirige TOUJOURS vers une home safe + on
      // attend 200ms pour laisser le cookie Supabase propager.
      //
      // Sur staging : "/sandbox/v1-8" directement (la home staging).
      // Sur prod : "/" (la home prod).
      // Si nextParam pointe sur une page sté valide (ex /sandbox/v1-8/nvda)
      // on l'autorise, sinon fallback safe.
      // Yann 19 mai 2026 : ajout /sandbox/v1-9 dans l'allowlist sinon le
      // user qui se connecte depuis une page V1.9 atterrit sur V1.8 (faute
      // d'allowlist) et perd son contexte.
      const isStaging = typeof window !== "undefined" && window.location.host.includes("staging");
      const safeHome = isStaging ? "/sandbox/v1-8" : "/";
      let target = safeHome;
      if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")) {
        // Autorise les pages sté V1.7 / V1.7.5 / V1.8 / V1.9 directement
        if (
          nextParam.startsWith("/sandbox/v1-9") ||
          nextParam.startsWith("/sandbox/v1-8") ||
          nextParam.startsWith("/sandbox/v1-7") ||
          nextParam.startsWith("/account") ||
          nextParam.startsWith("/desk-mtk9x4kp") ||
          nextParam.startsWith("/sandbox")
        ) {
          target = nextParam;
        }
      }
      // Yann 20 mai 2026 14h : retiré setTimeout 200ms.
      // Supabase v2 JS a déjà committé le cookie session avant que la promesse
      // signInWithPassword résolve (cookie sync écrit avant la fin du await).
      // Navigation immédiate = -200ms perçu par l'utilisateur.
      window.location.href = target;
    } catch (err) {
      // Yann 20 mai 15h15 : afficher l'erreur réelle pour diagnostic.
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[signin] caught error:", err);
      const msg = errMsg === "timeout"
        ? "Connexion trop longue (15s). Vérifie ton réseau et réessaie."
        : `Erreur : ${errMsg.slice(0, 200)}`;
      setSigninErr(msg);
      setSigninBusy(false);
    }
  }
  // Conserve le `next` URL pour le passer en hidden input à tous les forms
  // d'auth (password, signup, magic link, Google). Sinon le user atterrit
  // sur /account au lieu de la page d'origine (ex: /parrainage).
  const nextParam = params.get("next") ?? "";

  // Sync mode quand le param URL change
  useEffect(() => {
    if (auth === "signin") setMode("signin");
    else if (auth === "signup") setMode("signup");
    else if (auth === "reset") setMode("reset");
  }, [auth]);

  const close = () => {
    const next = new URLSearchParams(params.toString());
    next.delete("auth");
    next.delete("error");
    next.delete("info");
    next.delete("next");
    const qs = next.toString();
    router.replace(qs ? `/?${qs}` : "/");
  };

  // Esc pour fermer
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Lock scroll quand modal ouverte
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="auth-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
        >
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={close}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />

          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0e] p-6 shadow-[0_30px_120px_-20px_rgba(139,92,246,0.45)]"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-violet-500/30 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl"
            />

            <button
              type="button"
              onClick={close}
              aria-label={t("common.close")}
              className="absolute right-3 top-3 z-10 inline-flex size-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
            >
              <X className="size-4" />
            </button>

            {/* Header */}
            <div className="relative mb-5">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-violet-300/80">
                <Sparkles className="size-3.5" />
                Mettrik AI · KPI Intelligence
              </div>
              <h2 className="mt-2 font-display text-2xl font-semibold text-zinc-50">
                {mode === "signin"
                  ? t("auth.signin.title")
                  : mode === "signup"
                    ? t("auth.signup.title")
                    : t("auth.reset.title")}
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                {mode === "signin"
                  ? t("auth.signin.subtitle")
                  : mode === "signup"
                    ? t("auth.signup.subtitle")
                    : t("auth.reset.subtitle")}
              </p>
            </div>

            {/* Tabs (signin/signup uniquement, masqué en reset).
                Yann 10 mai 2026 : centré au lieu d'aligné gauche. */}
            {mode !== "reset" && (
              <div className="relative mb-5 flex justify-center">
                <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-[12.5px]">
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className={`rounded-full px-3.5 py-1.5 transition-colors ${
                      mode === "signin"
                        ? "bg-violet-500/90 text-white"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {t("auth.tab.signin")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className={`rounded-full px-3.5 py-1.5 transition-colors ${
                      mode === "signup"
                        ? "bg-violet-500/90 text-white"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {t("auth.tab.signup")}
                  </button>
                </div>
              </div>
            )}

            {/* Messages flash (error / info) */}
            {error && (
              <div className="relative mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
                {error}
              </div>
            )}
            {info && (
              <div className="relative mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-200">
                {info}
              </div>
            )}

            {/* === MODE RESET === */}
            {mode === "reset" && (
              <>
                <form action={requestPasswordReset} className="relative space-y-3">
                  <input type="hidden" name="next" value={nextParam} />
                  <Field icon={<Mail className="size-4" />}>
                    <input
                      type="email"
                      name="email"
                      required
                      autoFocus
                      autoComplete="email"
                      placeholder={t("auth.field.email")}
                      defaultValue={email}
                      className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
                    />
                  </Field>
                  <div className="flex justify-center">
                    <HCaptchaWidget theme="dark" />
                  </div>
                  <SubmitButton>{t("auth.cta.send_reset")}</SubmitButton>
                </form>
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="relative mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-400 transition-colors hover:text-violet-200"
                >
                  <ArrowLeft className="size-3.5" />
                  {t("auth.back_to_signin")}
                </button>
              </>
            )}

            {/* === MODE SIGNIN / SIGNUP === */}
            {mode !== "reset" && (
              <>
                <form action={signInWithGoogle} className="relative">
                  <input type="hidden" name="next" value={nextParam} />
                  <SubmitButton variant="ghost">
                    <GoogleLogo className="size-4" />
                    {t("auth.cta.google")}
                  </SubmitButton>
                </form>

                <div className="relative my-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                  <span className="h-px flex-1 bg-white/10" />
                  {t("auth.divider.or")}
                  <span className="h-px flex-1 bg-white/10" />
                </div>

                {mode === "signin" ? (
                  // Yann (11 mai 2026) : signin via Supabase JS browser direct.
                  // Plus rapide + erreur instantanée + cookie posé côté client
                  // (plus de "20 sec et toujours pas connecté").
                  <form onSubmit={handleSigninClient} className="relative space-y-2.5">
                    <Field icon={<Mail className="size-4" />}>
                      <input
                        type="email"
                        name="email"
                        required
                        autoComplete="email"
                        placeholder={t("auth.field.email")}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
                      />
                    </Field>
                    <Field icon={<Lock className="size-4" />}>
                      <input
                        type="password"
                        name="password"
                        required
                        autoComplete="current-password"
                        placeholder={t("auth.field.password")}
                        className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
                      />
                    </Field>
                    {signinErr && (
                      <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-200">
                        {signinErr}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={signinBusy}
                      className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-3 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_rgba(139,92,246,0.7)] transition-colors hover:bg-violet-400 disabled:opacity-70 disabled:cursor-wait"
                    >
                      {signinBusy && <Loader2 className="size-4 animate-spin" />}
                      {signinBusy ? "Connexion…" : t("auth.cta.signin")}
                    </button>
                  </form>
                ) : (
                  <form action={signUpWithPassword} className="relative space-y-2.5">
                    <input type="hidden" name="next" value={nextParam} />
                    <Field icon={<Mail className="size-4" />}>
                      <input
                        type="email"
                        name="email"
                        required
                        autoComplete="email"
                        placeholder={t("auth.field.email")}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
                      />
                    </Field>
                    <Field icon={<Lock className="size-4" />}>
                      <input
                        type="password"
                        name="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        placeholder={t("auth.field.password_min")}
                        className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
                      />
                    </Field>
                    {/* Captcha Turnstile : token injecté dans le form en tant
                        que champ caché 'cf-turnstile-response'. */}
                    <div className="flex justify-center">
                      <HCaptchaWidget theme="dark" />
                    </div>
                    <SubmitButton>{t("auth.cta.signup")}</SubmitButton>
                  </form>
                )}

                {mode === "signin" && (
                  <div className="relative mt-3 text-right">
                    <button
                      type="button"
                      onClick={() => setMode("reset")}
                      className="text-[12.5px] font-medium text-zinc-400 transition-colors hover:text-violet-200"
                    >
                      {t("auth.forgot_password")}
                    </button>
                  </div>
                )}

                {/* Magic link RETIRÉ (Yann 13 mai 2026) : tout accès passe
                    par inscription email + mot de passe + captcha. Pas de
                    connexion sans signup au préalable. */}

                <p className="relative mt-5 text-center text-[12px] text-zinc-500">
                  {mode === "signin" ? (
                    <>
                      {t("auth.no_account")}{" "}
                      <button
                        type="button"
                        onClick={() => setMode("signup")}
                        className="font-medium text-violet-300 hover:text-violet-200"
                      >
                        {t("auth.create_account")}
                      </button>
                    </>
                  ) : (
                    <>
                      {t("auth.has_account")}{" "}
                      <button
                        type="button"
                        onClick={() => setMode("signin")}
                        className="font-medium text-violet-300 hover:text-violet-200"
                      >
                        {t("auth.tab.signin")}
                      </button>
                    </>
                  )}
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 transition-colors focus-within:border-violet-400/60 focus-within:bg-white/[0.05]">
      <span className="text-zinc-400">{icon}</span>
      {children}
    </label>
  );
}

function GoogleLogo({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4-5.5 4-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.7 2.5 2.5 6.7 2.5 12s4.2 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6L12 10.2z"
      />
      <path
        fill="#34A853"
        d="M3.9 7.3l3.2 2.4C8 7.5 9.8 6.4 12 6.4c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 8.4 2.5 5.3 4.5 3.9 7.3z"
      />
      <path
        fill="#FBBC05"
        d="M12 21.5c2.6 0 4.7-.9 6.3-2.4l-3-2.4c-.8.6-2 1-3.3 1-2.6 0-4.8-1.7-5.5-4.1l-3.2 2.5C4.7 19.4 8.1 21.5 12 21.5z"
      />
      <path
        fill="#4285F4"
        d="M21.4 12.2c0-.6-.1-1.1-.2-1.6H12v3.9h5.5c-.2 1-.8 1.9-1.7 2.6l3 2.4c1.7-1.6 2.6-4 2.6-7.3z"
      />
    </svg>
  );
}
