import Link from "next/link";
import { ArrowLeft, ScrollText } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Layout commun à toutes les pages légales (CGU, CGV, Confidentialité, Mentions).
 * Style sobre, lisible, ton sérieux. Adapté FR ET CH (juste les placeholders à
 * remplir selon la juridiction finale choisie par Yann).
 */
export function LegalLayout({
  title,
  updatedAt,
  children,
  locale = "fr",
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
  locale?: "fr" | "en";
}) {
  const isEN = locale === "en";
  const homeHref = isEN ? "/" : "/fr";
  const labels = isEN
    ? {
        updated: "Last updated",
        mentions: "Legal notice",
        conditions: "General terms",
        privacy: "Privacy",
        back: "Back to home",
      }
    : {
        updated: "Dernière mise à jour",
        mentions: "Mentions légales",
        conditions: "Conditions générales",
        privacy: "Confidentialité",
        back: "Retour à l'accueil",
      };
  return (
    <div className="min-h-screen bg-[#050505]">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Link
          href={homeHref}
          className="group mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          <span className="font-display text-xl tracking-tight text-zinc-100">Mettrik AI</span>
        </Link>

        <div className="mb-8 flex items-baseline gap-3">
          <ScrollText className="size-5 shrink-0 text-violet-300" />
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
              {title}
            </h1>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-zinc-500">
              {labels.updated} : {updatedAt}
            </p>
          </div>
        </div>

        <article className="legal-prose space-y-5 text-[14.5px] leading-relaxed text-zinc-300">
          {children}
        </article>

        <div className="mt-12 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-[#1f1f1f] pt-6 text-[12.5px] text-zinc-500">
          <Link href="/legal/mentions" className="hover:text-zinc-200">{labels.mentions}</Link>
          <Link href="/legal/conditions" className="hover:text-zinc-200">{labels.conditions}</Link>
          <Link href="/legal/confidentialite" className="hover:text-zinc-200">{labels.privacy}</Link>
          <Link href={homeHref} className="ml-auto hover:text-zinc-200">{labels.back}</Link>
        </div>
      </div>
    </div>
  );
}

/* Helper: section H2 stylée */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-[20px] font-bold tracking-tight text-zinc-100">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/* Placeholder mis en évidence pour les infos à compléter */
export function ToFill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-sm border border-amber-500/30 bg-amber-500/[0.08] px-1.5 py-0.5 font-mono text-[12px] text-amber-200">
      [{children}]
    </span>
  );
}
