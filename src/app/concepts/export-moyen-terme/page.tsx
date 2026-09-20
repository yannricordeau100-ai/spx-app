import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ExportMoyenTermeConcepts } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Concepts · Export moyen terme · Mettrik AI",
  robots: { index: false, follow: false },
};

/**
 * Concepts du gabarit d image exportee depuis le bloc « Indicateurs varies -
 * Moyen terme » (Yann 20 sept 2026).
 *
 * Le rendu en production etait juge catastrophique : titre colle au nom de la
 * societe, vide enorme entre le titre et le graphique, ecarts non maitrises.
 * Cinq gabarits sont proposes ici, tous au format reel 1744 x 1504, fond
 * sombre, typographies du site, avec un vrai graphique moyen terme rattache a
 * cinq societes.
 */
export default function ExportMoyenTermeConceptsPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <div className="mx-auto max-w-[1100px] px-6 py-10">
        <Link
          href="/concepts"
          className="group mb-6 inline-flex items-center gap-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          Retour concepts
        </Link>
        <h1 className="font-display text-[30px] font-bold tracking-tight">
          Export « Indicateurs variés - Moyen terme » · 5 gabarits
        </h1>
        <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-zinc-400">
          Format réel <span className="font-mono text-zinc-300">1744 × 1504</span>{" "}
          (rendu ici à l&apos;échelle). Même contenu partout : le graphique
          moyen terme « Puces IA expédiées par concepteur », rattaché à cinq
          sociétés. Titre sans date, écarts réguliers, rangée des autres
          sociétés sous le bloc logo et nom.
        </p>
        <ExportMoyenTermeConcepts />
      </div>
    </div>
  );
}
