"use client";

import { AlertTriangle } from "lucide-react";

/**
 * Placeholder rouge pour les blocs manquants en mode V1.8.
 *
 * Yann 7 mai 2026 : sur la version V1.8 sandbox (filtre relaxé), au lieu
 * de masquer un bloc absent (risks, governance, AI positioning, etc.),
 * on affiche une bordure rouge + libellé "Bloc à compléter" avec un hint
 * sur ce qui manque concrètement. Permet de voir d'un coup d'œil ce qui
 * doit être enrichi avant qu'une sté soit "client-ready".
 *
 * Ne s'affiche JAMAIS sur la prod ni sur /sandbox/v1-7 (mode strict).
 */
export function V18MissingPlaceholder({
  id,
  label,
  hint,
}: {
  /** Anchor id (ex: "sec-risks") pour scroll-to et CmdF. */
  id?: string;
  /** Nom user-facing du bloc manquant (ex: "Facteurs de risque"). */
  label: string;
  /** Phrase courte expliquant CE QUI manque techniquement (lu par Yann). */
  hint?: string;
}) {
  return (
    <div
      id={id}
      className="mt-9 scroll-mt-24 rounded-2xl border-2 border-dashed border-rose-500/60 bg-rose-500/[0.04] p-5"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-400" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] font-semibold text-rose-200">
              {label}
            </h3>
            <span className="rounded-md border border-rose-500/40 bg-rose-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-rose-200">
              Bloc à compléter
            </span>
          </div>
          {hint && (
            <p className="mt-1 text-[12.5px] text-rose-300/80">{hint}</p>
          )}
        </div>
      </div>
    </div>
  );
}
