import type { Metadata } from "next";
import Link from "next/link";
import { getServerLocale } from "@/lib/i18n/server";
import { chargeFaq, paragraphes, texteBrut } from "@/lib/faq";
import { LogoMettrik } from "@/components/logo-mettrik";
import { DisclaimerFooter } from "@/components/legal/disclaimer-footer";

/**
 * /faq : questions fréquentes publiques (Yann 2 sept 2026).
 *
 * Optimisée pour les moteurs de recherche ET les moteurs de réponse IA :
 *  - une question = un <details> natif (lisible sans JavaScript, indexable,
 *    ancre stable par question) ;
 *  - données structurées schema.org FAQPage + BreadcrumbList ;
 *  - contenu éditable depuis /sandbox/faq, servi depuis la base.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mettrik.ai";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { contenu } = await chargeFaq();
  const n = contenu.items.length;
  const title = "FAQ Mettrik AI : questions fréquentes sur les KPI, les données et les offres";
  const description = `${n} réponses claires sur Mettrik AI : sociétés couvertes, origine des données, mises à jour, notes des indicateurs, offres Gratuit, Premium et Max, paiement, confidentialité.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/faq` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/faq`,
      type: "website",
      siteName: "Mettrik AI",
      images: [{ url: `${SITE_URL}/og-cover.png`, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description, images: [`${SITE_URL}/og-cover.png`] },
    robots: { index: true, follow: true },
  };
}

export default async function FaqPage() {
  const locale = await getServerLocale();
  const en = locale.startsWith("en");
  const { contenu } = await chargeFaq();

  const q = (it: { q_fr: string; q_en: string }) => (en && it.q_en ? it.q_en : it.q_fr);
  const r = (it: { r_fr: string; r_en: string }) => (en && it.r_en ? it.r_en : it.r_fr);
  const titreCat = (c: { titre_fr: string; titre_en: string }) => (en && c.titre_en ? c.titre_en : c.titre_fr);

  const jsonLdFaq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${SITE_URL}/faq#faq`,
    inLanguage: en ? "en" : "fr",
    mainEntity: contenu.items.map((it) => ({
      "@type": "Question",
      name: q(it),
      url: `${SITE_URL}/faq#${it.id}`,
      acceptedAnswer: { "@type": "Answer", text: texteBrut(r(it)) },
    })),
  };
  const jsonLdBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Mettrik AI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: en ? "FAQ" : "Questions fréquentes", item: `${SITE_URL}/faq` },
    ],
  };

  return (
    <>
      <main className="min-h-screen bg-[#050507] text-zinc-100">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }}
        />

        <header className="mx-auto flex max-w-3xl items-center justify-between px-5 pt-6">
          <Link href="/" aria-label="Retour à l'accueil Mettrik AI" className="inline-flex">
            <LogoMettrik emplacement="retour-societe" size="sm" />
          </Link>
          <nav aria-label="Pages" className="flex items-center gap-4 text-[13px] text-zinc-400">
            <Link href="/pricing" className="hover:text-zinc-100">{en ? "Pricing" : "Tarifs"}</Link>
            <Link href="/contact" className="hover:text-zinc-100">Contact</Link>
          </nav>
        </header>

        <section className="mx-auto max-w-3xl px-5 pb-6 pt-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-violet-300">
            {en ? "Help center" : "Centre d'aide"}
          </p>
          <h1 className="mt-2 font-display text-[30px] font-bold leading-tight tracking-tight sm:text-[40px]">
            {en ? "Frequently asked questions" : "Questions fréquentes"}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
            {en
              ? "Everything investors ask before using Mettrik AI: covered companies, where the data comes from, how indicators are scored, plans and payment, privacy."
              : "Tout ce que les investisseurs demandent avant d'utiliser Mettrik AI : sociétés couvertes, origine des données, notation des indicateurs, offres et paiement, confidentialité."}
          </p>

          <nav aria-label={en ? "Categories" : "Catégories"} className="mt-6 flex flex-wrap gap-2">
            {contenu.categories.map((c) => (
              <a
                key={c.id}
                href={`#cat-${c.id}`}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12.5px] text-zinc-300 hover:border-violet-400/50 hover:text-zinc-50"
              >
                {titreCat(c)}
              </a>
            ))}
          </nav>
        </section>

        <div className="mx-auto max-w-3xl space-y-12 px-5 pb-20">
          {contenu.categories.map((c) => {
            const items = contenu.items.filter((it) => it.categorie === c.id);
            if (!items.length) return null;
            return (
              <section key={c.id} id={`cat-${c.id}`} aria-labelledby={`h-${c.id}`} className="scroll-mt-24">
                <h2 id={`h-${c.id}`} className="mb-4 font-display text-[20px] font-semibold tracking-tight text-zinc-100">
                  {titreCat(c)}
                </h2>
                <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-[#0b0b0e]">
                  {items.map((it) => (
                    <details key={it.id} id={it.id} className="group scroll-mt-24 open:bg-white/[0.02]">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 text-[15px] font-medium leading-snug text-zinc-100 marker:content-none hover:text-white">
                        <h3 className="text-[15px] font-medium">{q(it)}</h3>
                        <span
                          aria-hidden
                          className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-white/10 text-zinc-400 transition-transform group-open:rotate-45"
                        >
                          +
                        </span>
                      </summary>
                      <div className="px-5 pb-5 text-[14.5px] leading-relaxed text-zinc-300">
                        {paragraphes(r(it)).map((segs, i) => (
                          <p key={i} className={i > 0 ? "mt-3" : ""}>
                            {segs.map((s, j) =>
                              s.type === "lien" ? (
                                <Link key={j} href={s.href} className="text-violet-300 underline decoration-violet-300/40 underline-offset-2 hover:text-violet-200">
                                  {s.texte}
                                </Link>
                              ) : (
                                <span key={j}>{s.texte}</span>
                              ),
                            )}
                          </p>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            );
          })}

          <section className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-cyan-500/5 p-6">
            <h2 className="font-display text-[18px] font-semibold text-zinc-100">
              {en ? "Still have a question?" : "Une question sans réponse ?"}
            </h2>
            <p className="mt-1 text-[14px] text-zinc-400">
              {en
                ? "Write to us, we answer every message."
                : "Écrivez-nous, chaque message reçoit une réponse."}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/contact" className="rounded-full bg-violet-400 px-4 py-2 text-[13.5px] font-semibold text-[#0b0b0e] hover:bg-violet-300">
                {en ? "Contact us" : "Nous contacter"}
              </Link>
              <Link href="/pricing" className="rounded-full border border-white/15 px-4 py-2 text-[13.5px] text-zinc-200 hover:border-white/30">
                {en ? "See plans" : "Voir les offres"}
              </Link>
            </div>
          </section>
        </div>
      </main>
      <DisclaimerFooter />
    </>
  );
}
