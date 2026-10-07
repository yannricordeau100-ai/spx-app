import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { STYLES } from "./liste";

export const metadata = {
  title: "Fiche société en onglets · Mettrik",
  robots: { index: false, follow: false },
};

export default function FicheOngletsIndex() {
  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Link href="/concepts" className="group mb-6 inline-flex items-center gap-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-200">
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          Retour Concepts
        </Link>
        <h1 className="font-display text-[30px] font-bold tracking-tight">Fiche société en onglets</h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-zinc-400">
          {STYLES.length} styles d’onglets pour la même fiche : l’en-tête et la rangée des rangs restent en haut, puis une barre d’onglets donne accès aux parties
          (vue d’ensemble, KPI, stories, moyen terme, marché, risques, gouvernance, IA, résultats, thèse, sources). Chaque page affiche les vrais blocs de la fiche, avec les vraies données de Google (GOOGL) et de LVMH (MC.PA), sélecteur en haut.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {STYLES.map((s, i) => (
            <Link key={s.slug} href={`/concepts/fiche-onglets/${s.slug}`} className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition-colors hover:border-violet-400/40 hover:bg-violet-500/[0.05]">
              <div className="font-mono text-[11px] text-violet-300/80">Style {i + 1}</div>
              <div className="mt-1 font-display text-[19px] font-bold">{s.nom}</div>
              <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">{s.phrase}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
