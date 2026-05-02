"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";

/**
 * <Paywall> — composant générique pour gater un élément derrière l'abonnement
 * Premium.
 *
 * Modes :
 *   - "blur"    : le contenu reste visible, mais flouté + un overlay propose
 *                 d'unlock. Utilisé pour les chiffres / textes PV des sociétés
 *                 non-free pour les users free.
 *   - "replace" : le contenu est remplacé par un panneau d'upsell (utilisé
 *                 pour bloquer entièrement une feature, ex : la comparaison
 *                 N-vs-N).
 *   - "soft"    : le contenu est lisible mais grisé, avec un petit cadenas
 *                 inline. Utilisé pour signaler un bonus premium sans gêner
 *                 la lecture (ex : note d'analyste).
 *
 * Usage :
 *
 *   <Paywall locked={isPaywalled(ticker, plan)} mode="blur">
 *     <span>{kpi.value}</span>
 *   </Paywall>
 */

type PaywallProps = {
  locked: boolean;
  mode?: "blur" | "replace" | "soft";
  children: ReactNode;
  /** CTA personnalisé (par défaut : "Passer en Premium"). */
  label?: string;
  /** Lien vers la page de pricing (par défaut : /sandbox/billing en dev). */
  pricingHref?: string;
};

export function Paywall({
  locked,
  mode = "blur",
  children,
  label = "Passer en Premium pour débloquer",
  pricingHref = "/sandbox/billing",
}: PaywallProps) {
  if (!locked) return <>{children}</>;

  if (mode === "soft") {
    return (
      <span className="inline-flex items-center gap-1 opacity-60">
        {children}
        <Lock className="size-3 text-zinc-500" aria-label="Premium" />
      </span>
    );
  }

  if (mode === "replace") {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/[0.06] p-6 text-center">
        <Sparkles className="mb-2 size-6 text-violet-300" />
        <div className="text-[14px] font-semibold text-zinc-100">Réservé Premium</div>
        <p className="mt-1 max-w-md text-[12.5px] text-zinc-400">{label}</p>
        <Link
          href={pricingHref}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-[12.5px] font-medium text-violet-100 transition-colors hover:border-violet-500/60 hover:bg-violet-500/25"
        >
          Voir les forfaits
        </Link>
      </div>
    );
  }

  // mode "blur" (par défaut)
  return (
    <span className="relative inline-block">
      <span aria-hidden className="select-none blur-sm">{children}</span>
      <span className="pointer-events-auto absolute inset-0 flex items-center justify-center">
        <Link
          href={pricingHref}
          className="inline-flex items-center gap-1 rounded-md border border-violet-500/40 bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-100 transition-colors hover:border-violet-500/60 hover:bg-violet-500/25"
          title={label}
        >
          <Lock className="size-2.5" />
          premium
        </Link>
      </span>
    </span>
  );
}
