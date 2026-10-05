import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CONCEPTS } from "./liste";

export const metadata = {
  title: "Remplacer le bloc story sur ordinateur · Mettrik",
  robots: { index: false, follow: false },
};

export default function KpiCourtTermeIndex() {
  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link href="/concepts" className="group mb-6 inline-flex items-center gap-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-200">
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          Retour Concepts
        </Link>
        <h1 className="font-display text-[30px] font-bold tracking-tight">Remplacer le bloc story sur ordinateur</h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-zinc-400">
          6 présentations du MÊME contenu que le bloc story de la fiche (KPI court terme : chiffre, variation, graphique, texte explicatif, familles, tri, vedettes, pause et reprise), pensées pour le grand écran et la souris. Le mobile garde les stories actuelles.
          Chaque page utilise les vraies stories de Netflix et de LVMH, avec un sélecteur de société.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-5 lg:grid-cols-3">
          {CONCEPTS.map((c, i) => (
            <Link key={c.slug} href={`/concepts/kpi-court-terme/${c.slug}`} className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition-colors hover:border-violet-400/40 hover:bg-violet-500/[0.05]">
              <div className="font-mono text-[11px] text-violet-300/80">Concept {i + 1}</div>
              <div className="mt-1 font-display text-[19px] font-bold">{c.nom}</div>
              <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">{c.phrase}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
