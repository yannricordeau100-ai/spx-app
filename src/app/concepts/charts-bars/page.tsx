import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ChartsBarsConceptClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Concept : 3 styles de barres · Mettrik AI",
  robots: { index: false, follow: false },
};

/**
 * Page concept pour comparer 3-4 styles de "bars chart" sur les mêmes
 * données. Yann choisit lequel pousser sur l'app live.
 *
 * Chaque variante affiche les 5 années (2021-2025) + une barre TTM
 * pointillée pour montrer comment "trailing 12 months" est rendu.
 */
export default function ChartsBarsConceptPage() {
  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link
          href="/concepts"
          className="group mb-6 inline-flex items-center gap-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          Retour Concepts
        </Link>

        <h1 className="mb-2 font-display text-[28px] font-bold tracking-tight">
          Concept : 3 styles de barres
        </h1>
        <p className="mb-8 max-w-3xl text-[14px] text-zinc-400">
          Mêmes données (Cloud Revenue Alphabet 2021-2025 + TTM Q1 2026), 3 rendus différents.
          La barre TTM est toujours en pointillé pour signaler &quot;12 derniers mois&quot;
          (pas une année calendaire). Choisis ton préféré, je pousse en prod.
        </p>

        <ChartsBarsConceptClient />
      </div>
    </div>
  );
}
