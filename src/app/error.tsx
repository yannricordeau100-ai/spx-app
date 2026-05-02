"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Home, RotateCw } from "lucide-react";

/**
 * Page d'erreur 500 (erreur runtime côté serveur ou client).
 * Doit être un Client Component selon les conventions Next.js App Router.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log côté client. En prod, à remplacer par Sentry.
    if (typeof window !== "undefined") {
      console.error("[Mettrik AI ErrorPage]", error);
    }
  }, [error]);

  return (
    <div className="relative flex min-h-screen flex-col bg-[#050505] text-zinc-100">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[600px]"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(244,63,94,0.15), transparent 60%)",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <div className="font-display text-[120px] font-bold leading-none tracking-tighter sm:text-[160px]"
          style={{
            backgroundImage: "linear-gradient(135deg, #fafafa 0%, #f43f5e 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}>
          500
        </div>
        <h1 className="mt-4 font-display text-[28px] font-bold tracking-tight sm:text-[32px]">
          Quelque chose a cassé
        </h1>
        <p className="mt-3 max-w-md text-[14px] leading-relaxed text-zinc-400">
          Une erreur inattendue est survenue. L&apos;équipe est notifiée. Réessaie dans un instant : si le problème
          persiste, contacte-nous à <a href="mailto:contact@mettrik.ai" className="text-violet-300 hover:text-violet-200">contact@mettrik.ai</a>.
        </p>

        {error.digest && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 font-mono text-[10.5px] text-rose-200">
            erreur ID : {error.digest}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-violet-400"
          >
            <RotateCw className="size-4" />
            Réessayer
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.03] px-5 py-2.5 text-[13.5px] font-medium text-zinc-200 transition-colors hover:bg-white/[0.07]"
          >
            <Home className="size-4" />
            Retour à l&apos;accueil
          </Link>
        </div>

        <div className="mt-12 inline-flex items-baseline gap-2 text-[11px] text-zinc-500">
          <span className="size-1.5 rounded-full bg-rose-400/50" />
          <span>Mettrik AI · KPI Intelligence</span>
        </div>
      </div>
    </div>
  );
}
