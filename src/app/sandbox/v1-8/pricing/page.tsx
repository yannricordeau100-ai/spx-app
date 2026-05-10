import Link from "next/link";
import { ArrowLeft, Check, Sparkles, Shield, Zap, Mail } from "lucide-react";
import { PricingCards } from "@/components/billing/pricing-cards";
import { PricingMatrix } from "@/components/billing/pricing-matrix";
import { DisclaimerFooter } from "@/components/legal/disclaimer-footer";
import { BrandWordmark } from "@/components/brand-wordmark";
import { loadPricingCatalog } from "@/lib/billing/load-pricing";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dictionary";

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
  description: "3 plans Mettrik AI : Découverte gratuit, Premium 24,90 €/mois, Max 79 €/mois.",
  robots: { index: false, follow: false },
};

export default async function V18PricingPage() {
  const catalog = await loadPricingCatalog();
  const locale = await getServerLocale();
  const t = (k: string) => translate(k, locale);
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
          <BrandWordmark size="sm" animated={false} showRail={false} />
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
            {t("pricing.eyebrow")}
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl">
            {t("pricing.h1")}
          </h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-zinc-400">
            {t("pricing.intro")}
          </p>
          {/* Yann 9 mai 2026 : retire les badges "30 jours satisfait" et
              "Tarifs en 7 devises". Garde "Sans engagement" qui est encore
              une vraie PV pour le visiteur. */}
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-[12px] text-zinc-400">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-1.5">
              <Zap className="size-3.5 text-cyan-300" />
              {t("pricing.badge_no_engagement")}
            </span>
          </div>
        </div>

        {/* PLAN CARDS */}
        <div className="mx-auto mt-14 max-w-5xl">
          <PricingCards ctaTrackingPrefix="v18_top_" plans={catalog.plans} features={catalog.features} />
        </div>

        {/* MATRICE FEATURES */}
        <section className="mx-auto mt-20 max-w-5xl">
          <div className="mb-6 text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-zinc-50">
              {t("pricing.compare_title")}
            </h2>
            <p className="mt-2 text-[14px] text-zinc-400">
              {t("pricing.compare_sub")}
            </p>
          </div>
          <PricingMatrix plans={catalog.plans} features={catalog.features} />
        </section>

        {/* TRUST / VALUE */}
        <section className="mx-auto mt-20 grid max-w-5xl gap-5 sm:grid-cols-3">
          <TrustCard title={t("pricing.trust1_title")} body={t("pricing.trust1_body")} />
          <TrustCard title={t("pricing.trust2_title")} body={t("pricing.trust2_body")} />
          <TrustCard title={t("pricing.trust3_title")} body={t("pricing.trust3_body")} />
        </section>

        {/* FAQ */}
        <section className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-6 text-center font-display text-3xl font-bold tracking-tight text-zinc-50">
            {t("pricing.faq_title")}
          </h2>
          <div className="space-y-3">
            <FaqItem q={t("pricing.faq_q1")} a={t("pricing.faq_a1")} />
            <FaqItem q={t("pricing.faq_q2")} a={t("pricing.faq_a2")} />
            <FaqItem q={t("pricing.faq_q3")} a={t("pricing.faq_a3")} />
            <FaqItem q={t("pricing.faq_q4")} a={t("pricing.faq_a4")} />
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="mx-auto mt-20 max-w-3xl rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-500/[0.10] to-cyan-500/[0.05] p-10 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-zinc-50">
            {t("pricing.cta_final_title")}
          </h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-zinc-300">
            {t("pricing.cta_final_body")}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              data-pricing-cta="v18_bottom_signup"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-6 py-3 text-[14px] font-bold text-zinc-50 transition-colors hover:bg-violet-400"
            >
              {t("pricing.cta_final_btn")}
              <Check className="size-4" />
            </Link>
            <a
              href="mailto:contact@mettrik.ai?subject=Question%20sur%20les%20plans%20Mettrik%20AI"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3 text-[14px] font-semibold text-zinc-200 transition-colors hover:bg-white/[0.07]"
            >
              <Mail className="size-4" />
              {t("pricing.cta_final_email")}
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
