"use client";

/**
 * Yann 15 sept 2026 : zone entierement floutee pour les paliers non payants.
 *  - palier "free" : appel a l abonnement Premium par-dessus la zone ;
 *  - palier "anon" : toute la zone est un lien vers l inscription gratuite.
 * Le contenu reste rendu (lecture par les moteurs de recherche et les IA),
 * mais il est illisible et inerte pour le visiteur.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { AppelAbonnement } from "@/components/appel-abonnement";

export function lienInscription(next?: string): string {
  const n = next ?? (typeof window !== "undefined" ? window.location.pathname : "/");
  return `/?auth=signup&next=${encodeURIComponent(n)}`;
}

export function ZoneReservee({
  actif,
  palier,
  titre,
  detail,
  children,
  className,
}: {
  actif: boolean;
  palier: "free" | "anon";
  titre?: string;
  detail?: string;
  children: ReactNode;
  className?: string;
}) {
  if (!actif) return <>{children}</>;
  return (
    <div className={`relative ${className ?? ""}`} data-zone-reservee={palier}>
      <div className="pointer-events-none select-none blur-[14px] saturate-50" aria-hidden>
        {children}
      </div>
      {palier === "anon" ? (
        <Link
          href={lienInscription()}
          className="absolute inset-0 z-40 flex items-start justify-center"
          aria-label="Inscris-toi gratuitement pour découvrir ces KPI"
        >
          <span className="sticky top-[38vh] mt-16 inline-flex items-center gap-2 rounded-full border border-violet-400/50 bg-[#0a0a0e]/90 px-5 py-2.5 text-[14px] font-semibold text-violet-100 underline decoration-violet-400/60 underline-offset-4 shadow-lg shadow-violet-500/10 hover:bg-violet-500/20">
            Inscris-toi gratuitement pour découvrir ces KPI
          </span>
        </Link>
      ) : (
        <div className="absolute inset-0 z-40 flex items-start justify-center px-4">
          <div className="sticky top-[36vh] mt-12 w-full max-w-2xl">
            <AppelAbonnement titre={titre ?? "KPI réservés aux abonnés"} detail={detail ?? "Tous les indicateurs, dix ans d’historique et le comparateur : inclus dès le plan Premium."} />
          </div>
        </div>
      )}
    </div>
  );
}
