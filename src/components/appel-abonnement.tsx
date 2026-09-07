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
    // Yann 07 sept 2026 (point 8, design) : composition 2026 centree, halo
    // sur l appel a l action, coherente avec l identite Mettrik (fond sombre,
    // violet / cyan). Fini le bloc de texte aligne a gauche.
    return (
      <div className={`group relative ${className}`}>
        {/* Halo d ambiance derriere le bloc */}
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-5 rounded-3xl opacity-50 blur-2xl transition-opacity duration-500 group-hover:opacity-80"
          style={{
            background:
              "radial-gradient(55% 65% at 50% 45%, rgba(139,92,246,0.30) 0%, rgba(34,211,238,0.14) 50%, transparent 78%)",
          }}
        />
        <div
          className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#0a0a0e]/85 px-6 py-8 text-center backdrop-blur-sm sm:px-10 sm:py-9"
          style={{
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.14), 0 16px 36px -14px rgba(139,92,246,0.35), 0 8px 18px -8px rgba(0,0,0,0.6)",
          }}
        >
          {/* Catch light haut + voile degrade violet/cyan */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)" }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -top-16 left-1/2 h-40 w-[130%] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
            style={{ background: "linear-gradient(90deg, rgba(139,92,246,0.5), rgba(34,211,238,0.35))" }}
          />
          <p className="font-display text-[19px] font-bold leading-snug tracking-tight text-zinc-50 sm:text-[22px]">
            <span className="bg-gradient-to-r from-violet-200 via-zinc-50 to-cyan-200 bg-clip-text text-transparent">
              {titre}
            </span>
          </p>
          {detail && (
            <p className="mx-auto mt-2.5 max-w-md text-[13px] leading-relaxed text-zinc-400">
              {detail}
            </p>
          )}
          {/* Appel a l action : legere surbrillance permanente, renforcee au survol */}
          <span className="relative mt-5 inline-block">
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-2 rounded-xl opacity-70 blur-md transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background:
                  "radial-gradient(60% 90% at 50% 50%, rgba(139,92,246,0.55) 0%, rgba(34,211,238,0.25) 60%, transparent 85%)",
              }}
            />
            <Link
              href={href}
              className="relative inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-violet-400 px-5 py-2.5 text-[13.5px] font-semibold text-white transition-transform duration-200 hover:scale-[1.03]"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 0 22px rgba(139,92,246,0.45)" }}
            >
              {action}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </span>
        </div>
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
