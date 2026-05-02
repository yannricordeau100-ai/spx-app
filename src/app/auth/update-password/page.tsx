import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resetPassword } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

/**
 * Page atteinte après avoir cliqué le lien "Mot de passe oublié".
 * Le callback a déjà échangé le code, donc l'user est connecté.
 * On lui demande de définir un nouveau mot de passe puis on redirige.
 */
export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=signin");

  const sp = await searchParams;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[700px] bg-radial-glow" />
      <div className="pointer-events-none absolute inset-0 bg-grid" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-10 sm:px-6">
        <Link href="/" className="mb-8 flex items-center gap-2.5">
          <span className="inline-flex size-7 items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#0a0a0a]">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-violet-400" />
          </span>
          <span className="font-display text-xl tracking-tight text-zinc-50">
            Mettrik
          </span>
        </Link>

        <div className="w-full rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a] p-6">
          <header className="mb-5 flex items-center gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-lg border border-violet-400/30 bg-violet-500/10 text-violet-200">
              <KeyRound className="size-4" />
            </span>
            <div>
              <h1 className="text-[18px] font-semibold text-zinc-50">
                Nouveau mot de passe
              </h1>
              <p className="mt-0.5 text-[12.5px] text-zinc-400">
                Pour {user.email}. Au moins 8 caractères.
              </p>
            </div>
          </header>

          {sp.error && (
            <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
              {sp.error}
            </div>
          )}

          <form action={resetPassword} className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-wider text-zinc-400">
                Nouveau mot de passe
              </span>
              <input
                type="password"
                name="next"
                required
                minLength={8}
                autoComplete="new-password"
                className="block w-full rounded-lg border border-[#262626] bg-[#0c0c0c] px-3 py-2.5 text-[14px] text-zinc-100 outline-none focus:border-violet-400/60"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-wider text-zinc-400">
                Confirme
              </span>
              <input
                type="password"
                name="confirm"
                required
                minLength={8}
                autoComplete="new-password"
                className="block w-full rounded-lg border border-[#262626] bg-[#0c0c0c] px-3 py-2.5 text-[14px] text-zinc-100 outline-none focus:border-violet-400/60"
              />
            </label>
            <button
              type="submit"
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-violet-400"
            >
              Définir mon mot de passe
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
