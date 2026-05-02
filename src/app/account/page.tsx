import Link from "next/link";
import { redirect } from "next/navigation";
import { Star, LogOut, User, KeyRound, AtSign, Trash2 } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  signOut,
  updatePassword,
  updateEmail,
  deleteAccount,
} from "@/app/auth/actions";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dictionary";
import { DisclaimerFooter } from "@/components/legal/disclaimer-footer";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; info?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=signin&next=/account");

  const locale = await getServerLocale();
  const t = (k: string) => translate(k, locale);
  const sp = await searchParams;
  const provider = (user.app_metadata?.provider as string | undefined) ?? "email";
  const isOAuth = provider !== "email";
  const created = user.created_at
    ? new Date(user.created_at).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <>
    <div className="relative min-h-screen overflow-hidden bg-[#050505]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[700px] bg-radial-glow" />
      <div className="pointer-events-none absolute inset-0 bg-grid" />

      <div className="relative mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <Link href="/" className="mb-8 inline-flex items-center gap-2.5">
          <span className="inline-flex size-7 items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#0a0a0a]">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-violet-400" />
          </span>
          <span className="font-display text-xl tracking-tight text-zinc-50">
            Mettrik
          </span>
        </Link>

        <h1 className="text-[28px] font-semibold text-zinc-50">{t("account.title")}</h1>
        <p className="mt-1 text-[14px] text-zinc-400">
          {t("account.subtitle")}
        </p>

        {/* Flash messages */}
        {sp.error && (
          <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13.5px] text-rose-200">
            {sp.error}
          </div>
        )}
        {sp.info && (
          <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[13.5px] text-emerald-200">
            {sp.info}
          </div>
        )}

        {/* PROFIL */}
        <section className="mt-6 rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a] p-6">
          <div className="flex items-center gap-4">
            <span className="inline-flex size-12 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#0c0c0c] text-zinc-300">
              <User className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold text-zinc-50">
                {user.email}
              </div>
              <div className="mt-0.5 font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">
                {t("account.member_since_prefix")} {provider} {t("account.member_since_middle")} {created}
              </div>
            </div>
          </div>
        </section>

        {/* RACCOURCIS */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/account/favorites"
            className="group flex items-center gap-3 rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4 transition-colors hover:border-amber-400/40"
          >
            <span className="inline-flex size-10 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-500/10 text-amber-300">
              <Star className="size-4 fill-amber-300" strokeWidth={1.5} />
            </span>
            <div>
              <div className="text-[14px] font-semibold text-zinc-50">
                {t("account.favorites")}
              </div>
              <div className="text-[11.5px] text-zinc-400">
                {t("account.favorites_sub")}
              </div>
            </div>
          </Link>

          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4 text-left transition-colors hover:border-rose-400/40"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-lg border border-rose-400/30 bg-rose-500/10 text-rose-300">
                <LogOut className="size-4" />
              </span>
              <div>
                <div className="text-[14px] font-semibold text-zinc-50">
                  {t("account.signout")}
                </div>
                <div className="text-[11.5px] text-zinc-400">
                  {t("account.signout_sub")}
                </div>
              </div>
            </button>
          </form>
        </div>

        {/* SECURITE — mot de passe */}
        <section className="mt-8 rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a] p-6">
          <header className="mb-5 flex items-center gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-lg border border-violet-400/30 bg-violet-500/10 text-violet-200">
              <KeyRound className="size-4" />
            </span>
            <div>
              <h2 className="text-[15.5px] font-semibold text-zinc-50">
                {t("account.password.title")}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-zinc-400">
                {isOAuth
                  ? t("account.password.subtitle_oauth")
                  : t("account.password.subtitle")}
              </p>
            </div>
          </header>

          {!isOAuth && (
            <form action={updatePassword} className="space-y-3">
              <Field
                label={t("account.password.current")}
                name="current"
                type="password"
                autoComplete="current-password"
                required
              />
              <Field
                label={t("account.password.new")}
                name="next"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <Field
                label={t("account.password.confirm")}
                name="confirm"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button
                type="submit"
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-violet-400"
              >
                {t("account.password.update")}
              </button>
            </form>
          )}
        </section>

        {/* EMAIL */}
        <section className="mt-4 rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a] p-6">
          <header className="mb-5 flex items-center gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/10 text-cyan-200">
              <AtSign className="size-4" />
            </span>
            <div>
              <h2 className="text-[15.5px] font-semibold text-zinc-50">
                {t("account.email.title")}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-zinc-400">
                {t("account.email.subtitle")}
              </p>
            </div>
          </header>

          <form action={updateEmail} className="space-y-3">
            <Field
              label={t("account.email.new_label")}
              name="email"
              type="email"
              autoComplete="email"
              defaultValue=""
              placeholder={user.email ?? ""}
              required
            />
            <button
              type="submit"
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-cyan-400/15 px-4 py-2.5 text-[13.5px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/25"
            >
              {t("account.email.send_link")}
            </button>
          </form>
        </section>

        {/* DANGER — supprimer compte */}
        <section className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-6">
          <header className="mb-4 flex items-center gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300">
              <Trash2 className="size-4" />
            </span>
            <div>
              <h2 className="text-[15.5px] font-semibold text-zinc-50">
                {t("account.delete.title")}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-zinc-400">
                {t("account.delete.warning")}
              </p>
            </div>
          </header>

          <form action={deleteAccount} className="space-y-3">
            <Field
              label={t("account.delete.confirm_label")}
              name="confirm"
              type="text"
              autoComplete="off"
              placeholder={locale === "en" ? "DELETE" : "SUPPRIMER"}
              required
            />
            <button
              type="submit"
              className="mt-1 inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-[13.5px] font-semibold text-rose-200 transition-colors hover:bg-rose-500/20"
            >
              {t("account.delete.button")}
            </button>
          </form>
        </section>
      </div>
    </div>
    <DisclaimerFooter />
    </>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
  required,
  minLength,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-wider text-zinc-400">
        {label}
      </span>
      <input
        type={type}
        name={name}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="block w-full rounded-lg border border-[#262626] bg-[#0c0c0c] px-3 py-2.5 text-[14px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/60"
      />
    </label>
  );
}
