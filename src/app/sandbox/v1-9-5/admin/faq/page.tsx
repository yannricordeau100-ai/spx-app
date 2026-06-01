import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isDeskOwner } from "@/lib/desk/auth";
import { translate } from "@/lib/i18n/dictionary";
import { LATEST_VERSION_SLUG } from "@/lib/version-routing";
import { FaqAdminClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin · FAQ pricing · Mettrik AI",
  robots: { index: false, follow: false },
};

/**
 * /sandbox/v1-9-5/admin/faq
 *
 * Page admin (Yann P7, 31 mai 2026) qui affiche les 7 questions/réponses
 * de la FAQ pricing en FR / EN / DE pour édition rapide.
 *
 * Workflow simple (pas de table BDD pour rester compatible avec le
 * compactage data §0septies) :
 *  1. Yann modifie les Q/R dans les textareas
 *  2. Clic "Générer le bloc TS"
 *  3. Copie-colle dans src/lib/i18n/dictionary.ts (clés pricing.faq_q1..7)
 *  4. Commit + deploy = changement live
 *
 * Si Yann veut une vraie édition runtime plus tard, migrer vers la table
 * desk_page_content qui supporte déjà ce pattern (page = "pricing").
 *
 * Thème orange (différencie l'admin pricing des autres admin = identité
 * visuelle commerciale).
 */
export default async function PricingFaqAdminPage() {
  const isOwner = await isDeskOwner();
  if (!isOwner) {
    redirect(`/?auth=signin&next=/sandbox/${LATEST_VERSION_SLUG}/admin/faq`);
  }

  // Lit les valeurs courantes du dictionary (3 langues × 7 questions)
  const locales = ["fr", "en", "de"] as const;
  type Locale = (typeof locales)[number];
  const questions: Array<{
    id: string;
    qKey: string;
    aKey: string;
    values: Record<Locale, { q: string; a: string }>;
  }> = [];
  for (let i = 1; i <= 7; i++) {
    const qKey = `pricing.faq_q${i}`;
    const aKey = `pricing.faq_a${i}`;
    const values = {} as Record<Locale, { q: string; a: string }>;
    for (const loc of locales) {
      values[loc] = {
        q: translate(qKey, loc),
        a: translate(aKey, loc),
      };
    }
    questions.push({ id: `q${i}`, qKey, aKey, values });
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[300px]"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% -10%, rgba(251,146,60,0.10), transparent 60%)",
        }}
      />

      <nav className="relative mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link
          href={`/sandbox/${LATEST_VERSION_SLUG}/pricing`}
          className="group inline-flex items-center gap-2 text-[12.5px] text-zinc-500 hover:text-zinc-200"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          Voir la page tarifs
        </Link>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-orange-200">
            Admin
          </span>
          <span className="font-display text-lg tracking-tight text-zinc-100">
            FAQ pricing
          </span>
        </div>
        <div className="w-12" />
      </nav>

      <main className="relative mx-auto max-w-5xl px-6 pb-16">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-50">
            Édition des 7 questions FAQ pricing
          </h1>
          <p className="mt-2 text-[13.5px] text-zinc-400">
            Modifie les questions et réponses ci-dessous (FR / EN / DE).
            Clique sur « Générer le bloc TS » en bas pour récupérer le
            code à coller dans{" "}
            <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11.5px] text-orange-200">
              src/lib/i18n/dictionary.ts
            </code>
            . Commit + push pour mettre en ligne.
          </p>
        </header>

        <FaqAdminClient initialQuestions={questions} />
      </main>
    </div>
  );
}
