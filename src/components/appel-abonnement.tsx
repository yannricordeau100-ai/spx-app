"use client";

/**
 * Invitation a s abonner, posee sur les zones reservees (Yann 4 sept 2026).
 *
 * Constat de son test reel : un visiteur gratuit voit du contenu floute ou un
 * cadenas, sans jamais savoir quoi faire ni ce qu il gagnerait a payer. Ce
 * composant repond aux deux questions en une ligne : ce qui est verrouille,
 * et le bouton pour le debloquer.
 *
 * Deux formes :
 *  - "bandeau" : pose SUR une zone floutee (graphique du hero, anti-these),
 *    centre, avec un fond assombri qui laisse deviner le contenu derriere ;
 *  - "encart"  : bloc autonome, utilise sur la page d accueil.
 */

import Link from "next/link";
import { Lock, ArrowRight } from "lucide-react";

export function AppelAbonnement({
  titre,
  detail,
  forme = "bandeau",
  action = "Voir les offres",
  href = "/pricing",
  className = "",
}: {
  titre: string;
  detail?: string;
  forme?: "bandeau" | "encart";
  action?: string;
  href?: string;
  className?: string;
}) {
  if (forme === "encart") {
    return (
      <div
        className={`rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-500/[0.12] via-transparent to-transparent p-5 ${className}`}
      >
        <p className="text-[15px] font-semibold text-zinc-100">{titre}</p>
        {detail && <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">{detail}</p>}
        <Link
          href={href}
          className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-violet-400"
        >
          {action}
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    );
  }

  // Bandeau : superpose a la zone reservee. `pointer-events-none` sur le fond
  // pour ne pas bloquer le survol du graphique, sauf sur le bouton lui-meme.
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-2xl bg-[#07070b]/55 px-5 text-center backdrop-blur-[2px] ${className}`}
    >
      <span className="inline-flex size-9 items-center justify-center rounded-full border border-violet-400/40 bg-[#0b0b0e]">
        <Lock className="size-4 text-violet-300" />
      </span>
      <p className="text-[14px] font-semibold text-zinc-100">{titre}</p>
      {detail && <p className="max-w-[320px] text-[12px] leading-snug text-zinc-400">{detail}</p>}
      <Link
        href={href}
        className="pointer-events-auto mt-1 inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-violet-400"
      >
        {action}
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
