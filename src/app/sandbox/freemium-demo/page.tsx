import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FreemiumDemoClient } from "./client";

export const metadata = {
  title: "Demo floutage Free tier · Mettrik AI",
  robots: { index: false, follow: false },
};

/**
 * /sandbox/freemium-demo — démo du floutage "inviolable" Free tier.
 *
 * Yann (25 mai 2026) : montre avant/après sur AAPL (top market cap, data
 * riche) avec un toggle "Simuler tier" → free / premium / max. Permet de
 * valider visuellement l'effet sur les chiffres clés (KPIs, charts) sans
 * toucher au signup réel.
 */
export default function FreemiumDemoPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <nav className="mx-auto max-w-5xl px-4 py-6">
        <Link
          href="/sandbox"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="size-4" />
          Retour sandbox
        </Link>
      </nav>
      <main className="mx-auto max-w-5xl px-4 pb-20">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Demo floutage <span className="text-emerald-300">Free tier</span>
        </h1>
        <p className="mt-3 text-[14px] text-zinc-400">
          Démo du composant <code className="text-violet-300">&lt;BlurredFreeValue&gt;</code> :
          floute les chiffres clés pour les utilisateurs en plan FREE sur les
          stés verrouillées (toutes sauf Google + Meta en tradition V1).
          Click sur valeur floutée → redirect /pricing pour upgrade Premium.
        </p>
        <p className="mt-2 text-[12.5px] text-zinc-500">
          <strong className="text-emerald-300">Inviolabilité :</strong> la valeur
          réelle n'est JAMAIS rendue dans le HTML quand blocked=true. Devtools /
          curl / view-source ne révèlent qu'un placeholder <code>████</code>.
          La valeur réelle reste côté serveur si SSR + tier user lu via session.
        </p>
        <FreemiumDemoClient />
      </main>
    </div>
  );
}
