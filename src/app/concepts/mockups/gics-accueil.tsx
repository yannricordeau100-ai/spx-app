"use client";

/**
 * Maquettes (9 sept 2026) : bloc GICS du bas de la page d accueil, trois
 * presentations pour choix du proprietaire. La V1 (toggle) est posee sur
 * l accueil en attendant la decision.
 */

import { HomeGicsBlock } from "@/components/home-gics-block";

export function MockupGicsAccueil() {
  return (
    <div className="space-y-14 px-4 pb-16 pt-6">
      <p className="mx-auto max-w-3xl text-center text-[13px] text-zinc-400">
        Trois façons de montrer les 163 sous-industries GICS (noms et codes uniquement) en bas de l’accueil. La V1 est en ligne sur l’accueil.
      </p>
      {([
        ["V1 · toggle des secteurs (style 5 ans / MAX) puis sous-industries", "toggle"],
        ["V2 · colonnes par secteur, tout visible d’un coup", "colonnes"],
        ["V3 · tuiles avec filtre par secteur, survol lumineux", "tuiles"],
      ] as const).map(([titre, v]) => (
        <section key={v}>
          <h3 className="mb-2 text-center font-display text-[16px] font-bold text-zinc-100">{titre}</h3>
          <HomeGicsBlock variante={v} />
        </section>
      ))}
    </div>
  );
}
