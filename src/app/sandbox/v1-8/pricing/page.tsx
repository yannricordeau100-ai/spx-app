import Link from "next/link";
import { ArrowLeft, Check, Sparkles, Shield, Zap, Mail } from "lucide-react";
import { PricingCards } from "@/components/billing/pricing-cards";
import { PricingMatrix } from "@/components/billing/pricing-matrix";
import { DisclaimerFooter } from "@/components/legal/disclaimer-footer";
import { loadPricingCatalog } from "@/lib/billing/load-pricing";

/**
 * /sandbox/v1-8/pricing — page tarifs sales-optimized.
 *
 * 3 plans : Découverte (gratuit), Investisseur (recommandé), Pro+.
 * Layout : hero + cards + matrice features + trust + FAQ + CTA final.
 *
 * Optimisations vente :
 *  - Annuel par défaut + chip -33 % (ancrage prix bas)
 *  - Carte Investisseur visuellement dominante
 *  - 3 garanties dans le hero (sans engagement, satisfait/remboursé, sans
 *    carte pour Free)
 *  - Matrice features détaillée → réduit la friction "qu'est-ce que je
 *    perds en restant Free"
 *  - FAQ couvre les objections fréquentes (annulation, devises, données)
 *  - CTA final dupliqué en bas (re-engagement après lecture)
 */
export const metadata = {
  title: "Tarifs · Mettrik AI",
  description: "3 plans Mettrik AI : Découverte gratuit, Investisseur 24,90 €/mois, Pro+ 79 €/mois. 30 jours satisfait ou remboursé.",
  robots: { index: false, follow: false },
};

export default async function V18PricingPage() {
  const catalog = await loadPricingCatalog();
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[700px]"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(167,139,250,0.18), transparent 60%)",
        }}
      />

      {/* Top nav */}
      <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <Link
          href="/sandbox/v1-8"
          className="group inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          <span className="font-display text-xl tracking-tight text-zinc-100">Mettrik AI</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-zinc-400 transition-colors hover:text-zinc-100">
            Se connecter
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3.5 py-2 text-sm font-semibold text-violet-200 transition-colors hover:border-violet-500/50 hover:bg-violet-500/15"
          >
            S&apos;inscrire
          </Link>
        </div>
      </nav>

      <main className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        {/* HERO */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-violet-200">
            Tarifs simples, accès puissant
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl">
            Le bon plan pour ta façon d&apos;investir
          </h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-zinc-400">
            Découvre Mettrik AI gratuitement sur Google et Meta. Quand tu veux
            aller plus loin, débloque les 1 000 plus grandes sociétés mondiales
            avec un seul clic.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-[12px] text-zinc-400">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5">
              <Shield className="size-3.5 text-emerald-300" />
              30 jours satisfait ou remboursé
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-1.5">
              <Zap className="size-3.5 text-cyan-300" />
              Sans engagement, annulation en 1 clic
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/[0.06] px-3 py-1.5">
              <Sparkles className="size-3.5 text-violet-300" />
              Tarifs en 7 devises (€/$/£/CHF/SEK/DKK/CAD)
            </span>
          </div>
        </div>

        {/* PLAN CARDS */}
        <div className="mx-auto mt-14 max-w-5xl">
          <PricingCards ctaTrackingPrefix="v18_top_" plans={catalog.plans} />
        </div>

        {/* MATRICE FEATURES */}
        <section className="mx-auto mt-20 max-w-5xl">
          <div className="mb-6 text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-zinc-50">
              Comparatif détaillé
            </h2>
            <p className="mt-2 text-[14px] text-zinc-400">
              Toutes les fonctionnalités, en clair, pour décider sans surprise.
            </p>
          </div>
          <PricingMatrix plans={catalog.plans} features={catalog.features} />
        </section>

        {/* TRUST / VALUE */}
        <section className="mx-auto mt-20 grid max-w-5xl gap-5 sm:grid-cols-3">
          <TrustCard
            title="Données vérifiées"
            body="Chaque chiffre vient des documents officiels (10-K, 20-F, transcripts) déposés par les sociétés. Aucune estimation maison."
          />
          <TrustCard
            title="Pas de revente de tes données"
            body="On ne vend ni ne loue tes données à des tiers. Pas de tracker publicitaire, pas de data broker."
          />
          <TrustCard
            title="Hébergement européen"
            body="Tes données restent en Europe. Conforme RGPD. Facturation par R consulting (Suisse)."
          />
        </section>

        {/* FAQ */}
        <section className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-6 text-center font-display text-3xl font-bold tracking-tight text-zinc-50">
            Questions fréquentes
          </h2>
          <div className="space-y-3">
            <FaqItem
              q="Puis-je tester Mettrik AI sans payer ?"
              a="Oui, le plan Découverte est gratuit à vie. Tu accèdes à l'intégralité de Google (GOOGL) et Meta (META) sans carte bancaire. C'est suffisant pour évaluer la profondeur de l'analyse avant de décider."
            />
            <FaqItem
              q="Comment annuler mon abonnement ?"
              a="Depuis ton compte (Mon profil > Facturation), un seul clic. Pas de pénalité, ton accès reste actif jusqu'à la fin de la période payée."
            />
            <FaqItem
              q="Quelle différence entre Investisseur et Pro+ ?"
              a="Investisseur couvre les besoins d'un particulier qui suit son portefeuille (1 000+ sociétés, 50 favoris, 5 alertes email). Pro+ ajoute l'export PDF/CSV, l'accès API en lecture, l'historique 10 et 20 ans, et un support prioritaire — pensé pour les family offices et conseillers."
            />
            <FaqItem
              q="Puis-je changer de plan plus tard ?"
              a="Oui, à tout moment. Si tu passes de Investisseur à Pro+, l'écart est facturé au prorata. Si tu downgrade, le changement prend effet à la prochaine échéance."
            />
            <FaqItem
              q="Les prix incluent-ils la TVA ?"
              a="Oui, les prix affichés sont TTC. La facturation est assurée par R consulting (Kreuzlingen, Suisse) qui n'est pas assujettie à la TVA."
            />
            <FaqItem
              q="Quelles sociétés sont couvertes en Investisseur et Pro+ ?"
              a="Plus de 1 000 sociétés américaines (S&P 500, S&P MidCap 400, Nasdaq) et européennes (CAC 40, DAX, FTSE 100, AEX, etc.). Le catalogue s'étoffe automatiquement chaque mois."
            />
            <FaqItem
              q="Comment fonctionne la garantie 30 jours ?"
              a="Si Mettrik AI ne te convient pas dans les 30 premiers jours, on te rembourse intégralement, sans question. Un email à contact@mettrik.ai suffit."
            />
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="mx-auto mt-20 max-w-3xl rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-500/[0.10] to-cyan-500/[0.05] p-10 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-zinc-50">
            Prêt à voir tes sociétés sous un autre angle ?
          </h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-zinc-300">
            Démarre en 30 secondes, sans carte bancaire. Tu pourras passer en Investisseur ou Pro+ quand tu seras prêt.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              data-pricing-cta="v18_bottom_signup"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-6 py-3 text-[14px] font-bold text-zinc-50 transition-colors hover:bg-violet-400"
            >
              Démarrer gratuitement
              <Check className="size-4" />
            </Link>
            <a
              href="mailto:contact@mettrik.ai?subject=Question%20sur%20les%20plans%20Mettrik%20AI"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3 text-[14px] font-semibold text-zinc-200 transition-colors hover:bg-white/[0.07]"
            >
              <Mail className="size-4" />
              Une question ? On est là.
            </a>
          </div>
        </section>

        <DisclaimerFooter />
      </main>
    </div>
  );
}

function TrustCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <h3 className="font-display text-[15px] font-bold tracking-tight text-zinc-100">{title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors open:border-violet-500/20 open:bg-violet-500/[0.04]">
      <summary className="flex cursor-pointer items-center justify-between gap-3 text-[14px] font-semibold text-zinc-100">
        {q}
        <span className="text-[18px] text-zinc-500 transition-transform group-open:rotate-45">+</span>
      </summary>
      <p className="mt-2.5 text-[13px] leading-relaxed text-zinc-400">{a}</p>
    </details>
  );
}
