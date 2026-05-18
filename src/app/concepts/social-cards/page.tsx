import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SocialCardsLab } from "./client";

export const metadata = {
  title: "Concepts · Cards Réseaux Sociaux · Mettrik AI",
  robots: { index: false, follow: false },
};

/**
 * 7 variants "wow + sérieux" pour la présence Mettrik AI sur les RS.
 * Yann 17 mai 2026 : "fait d'autre style sur une page dédiée dans la
 * page concept. fait en autant que possible sachant que je ne veux pas
 * qq chose de classique/déjà vu chez toutes les stés. sois innovant et
 * n'hésites pas à apporter de la nouveauté, dans le sens double / triple
 * usage, à la fois sur l'app mettrik mais aussi lorsque l'on clic."
 */
export default function SocialCardsConceptPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link
          href="/concepts"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="size-4" /> Retour concepts
        </Link>
        <h1 className="font-display text-[32px] font-bold tracking-tight">
          Cards Réseaux Sociaux · 16 variants
        </h1>
        <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-zinc-400">
          Chaque variant a un <strong className="text-zinc-200">double ou triple usage</strong>
          : présence permanente sur l&apos;app Mettrik AI + interaction riche au clic
          (suivre, partager, copier, prévisualiser, contextualiser).
        </p>
        <p className="mt-1 max-w-3xl text-[12px] text-zinc-500">
          Comptes officiels : X{" "}
          <span className="font-mono text-violet-300">@mettrik_ai</span> · Instagram{" "}
          <span className="font-mono text-pink-300">@mettrik_ai</span>
        </p>

        <SocialCardsLab />
      </div>
    </div>
  );
}
