import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft, Check, Mail } from "lucide-react";
import { PricingCards } from "@/components/billing/pricing-cards";
import { PricingMatrix } from "@/components/billing/pricing-matrix";
import { ScrollToTopOnMount } from "@/components/scroll-to-top-on-mount";
import { DisclaimerFooter } from "@/components/legal/disclaimer-footer";
import { BrandWordmark } from "@/components/brand-wordmark";
import { FloatingLogosBg } from "@/components/billing/floating-logos-bg";
import { CurrencyPicker } from "@/components/billing/currency-picker";
import { loadPricingCatalog } from "@/lib/billing/load-pricing";
import { loadAllTaglines } from "@/lib/billing/pricing-taglines";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dictionary";
import { isDeskOwner } from "@/lib/desk/auth";
import V18_TICKERS from "@/data/v1-8-tickers-sorted.json";

async function detectCurrency(): Promise<string> {
  try {
    const c = await cookies();
    const v = c.get("mettrik:currency")?.value?.toUpperCase();
    if (v && ["EUR", "USD", "GBP", "CHF", "SEK", "DKK", "CAD"].includes(v)) return v;
  } catch {}
  return "EUR";
}

/**
 * Page tarifs publique `/pricing` (RGPD-friendly, aucune auth requise).
 *
 * Refonte 7 mai 2026 : abandon du squelette ad-hoc, alignement sur le
 * nouveau modèle 3 plans (Gratuit / Premium / Max) défini dans
 * `src/lib/billing/plans.ts`. Une seule source de vérité partagée avec
 * `/sandbox/v1-8/pricing`.
 *
 * Sales-optimisée : annuel par défaut, garanties visibles, matrice
 * features détaillée, FAQ, CTA finale.
 */
export const metadata = {
  title: "Tarifs · Mettrik AI",
  description: "3 plans Mettrik AI : Gratuit gratuit, Premium 29,90 €/mois, Max 59,90 €/mois.",
};

// Yann (1er juin 04:55) : force-dynamic pour que les modifs de taglines /
// pricing en admin soient visibles immédiatement (sinon Next.js cache la
// version statique build-time = sync cassée entre admin save et /pricing render).
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PricingPage() {
  const currency = await detectCurrency();
  // Yann (25 mai 2026) : passer currency au catalog → auto-conversion EUR→cible
  // si pas de prix natif en BDD (fix bug "USD ne fonctionne pas dans le picker").
  const catalog = await loadPricingCatalog(currency);
  const locale = await getServerLocale();
  const taglines = await loadAllTaglines();
  // Yann (25 mai 2026) : CurrencyPicker visible UNIQUEMENT pour l'admin réel.
  const showCurrencyPicker = await isDeskOwner();
  const t = (k: string) => translate(k, locale);
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505]">
      <FloatingLogosBg tickers={(V18_TICKERS as string[]).slice(0, 50)} />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[700px]"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(167,139,250,0.18), transparent 60%)",
        }}
      />

      <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          <BrandWordmark size="sm" animated={false} showRail={false} />
        </Link>
        <div className="flex items-center gap-3">
          {showCurrencyPicker && <CurrencyPicker current={currency} />}
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

      {/* Yann (26 mai 2026) : padding-top main encore réduit pour coller
          le hero à la nav (pt-1 sm:pt-2 au lieu de pt-2 sm:pt-4). Réduit
          aussi l'espace au-dessus de "TARIFS SIMPLES" (Bug 5). */}
      <main className="relative mx-auto max-w-6xl px-4 pb-12 pt-1 sm:px-6 sm:pb-16 sm:pt-2">
        {/* Force scroll-to-top au chargement initial : empêche le browser
            de restaurer le scroll position vers le bas (Bug 3 Yann). */}
        <ScrollToTopOnMount />
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/40 bg-violet-500/10 px-3.5 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-violet-200 shadow-[0_0_24px_rgba(167,139,250,0.18)] transition-all hover:border-violet-400/60 hover:bg-violet-500/15">
            <span className="size-1.5 animate-pulse rounded-full bg-violet-400" />
            {t("pricing.eyebrow")}
          </span>
          <h1 className="mt-4 bg-gradient-to-br from-zinc-50 via-zinc-100 to-violet-200 bg-clip-text font-display text-4xl font-bold tracking-tight text-transparent sm:text-[56px] sm:leading-[1.05]">
            {t("pricing.h1")}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl whitespace-pre-line text-[15.5px] leading-relaxed text-zinc-400">
            {t("pricing.intro")}
          </p>
          {/* Yann 26 mai 2026 : badge "Sans engagement" intégré dans la
              phrase d'intro (cf dictionary.ts) → bloc badges retiré. */}
        </div>

        {/* Yann 26 mai 2026 : mt réduit (était mt-14, maintenant mt-6) pour
            réduire l'espace entre la phrase d'intro et les onglets
            Mensuel/Annuel. */}
        <div className="mx-auto mt-6 max-w-5xl">
          <PricingCards ctaTrackingPrefix="pricing_top_" plans={catalog.plans} features={catalog.features} currency={currency} taglines={taglines} />
        </div>

        {/* Yann (25 mai 2026) : ancre #compare = cible du bouton "Tout comparer
            en détail" placé sous les bullets des cards pricing. */}
        <section id="compare" className="mx-auto mt-24 max-w-5xl scroll-mt-20">
          <div className="mb-2 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-400">
              <span className="h-px w-6 bg-gradient-to-r from-transparent to-violet-400/60" />
              02
              <span className="h-px w-6 bg-gradient-to-l from-transparent to-violet-400/60" />
            </span>
          </div>
          <div className="mb-7 text-center">
            <h2 className="bg-gradient-to-br from-zinc-50 to-zinc-300 bg-clip-text font-display text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
              {t("pricing.compare_title")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[14.5px] leading-relaxed text-zinc-400">
              {t("pricing.compare_sub")}
            </p>
          </div>
          <PricingMatrix plans={catalog.plans} features={catalog.features} currency={currency} />
        </section>

        <section className="mx-auto mt-24 grid max-w-5xl gap-5 sm:grid-cols-3">
          <TrustCard idx={1} title={t("pricing.trust1_title")} body={t("pricing.trust1_body")} />
          <TrustCard idx={2} title={t("pricing.trust2_title")} body={t("pricing.trust2_body")} />
          <TrustCard idx={3} title={t("pricing.trust3_title")} body={t("pricing.trust3_body")} />
        </section>

        <section className="mx-auto mt-24 max-w-3xl">
          <div className="mb-7 text-center">
            <h2 className="bg-gradient-to-br from-zinc-50 to-zinc-300 bg-clip-text font-display text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
              {t("pricing.faq_title")}
            </h2>
          </div>
          <div className="space-y-3">
            <FaqItem q={t("pricing.faq_q1")} a={t("pricing.faq_a1")} />
            <FaqItem q={t("pricing.faq_q2")} a={t("pricing.faq_a2")} />
            <FaqItem q={t("pricing.faq_q3")} a={t("pricing.faq_a3")} />
            <FaqItem q={t("pricing.faq_q4")} a={t("pricing.faq_a4")} />
          </div>
        </section>

        <section className="relative mx-auto mt-24 max-w-3xl overflow-hidden rounded-3xl border border-violet-500/40 bg-gradient-to-br from-violet-500/[0.14] via-violet-500/[0.06] to-cyan-500/[0.08] p-10 text-center shadow-[0_20px_60px_-30px_rgba(167,139,250,0.4)]">
          <div className="pointer-events-none absolute -left-20 -top-20 size-64 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-20 size-64 rounded-full bg-cyan-500/15 blur-3xl" />
          <h2 className="relative bg-gradient-to-br from-zinc-50 via-zinc-100 to-violet-200 bg-clip-text font-display text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
            {t("pricing.cta_final_title")}
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-[14.5px] leading-relaxed text-zinc-300">
            {t("pricing.cta_final_body")}
          </p>
          <div className="relative mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              data-pricing-cta="pricing_bottom_signup"
              className="group inline-flex items-center gap-2 rounded-xl bg-violet-500 px-6 py-3 text-[14px] font-bold text-zinc-50 shadow-[0_8px_24px_-8px_rgba(167,139,250,0.6)] transition-all hover:-translate-y-0.5 hover:bg-violet-400 hover:shadow-[0_12px_32px_-8px_rgba(167,139,250,0.8)]"
            >
              {t("pricing.cta_final_btn")}
              <Check className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="mailto:contact@mettrik.ai?subject=Question%20sur%20les%20plans%20Mettrik%20AI"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3 text-[14px] font-semibold text-zinc-200 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.08]"
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

function TrustCard({ idx, title, body }: { idx: number; title: string; body: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-5 transition-all hover:-translate-y-0.5 hover:border-violet-500/30 hover:shadow-[0_12px_32px_-12px_rgba(167,139,250,0.3)]">
      <div className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full bg-violet-500/[0.08] blur-2xl transition-opacity group-hover:bg-violet-500/[0.16]" />
      <div className="relative mb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-violet-300/70">
        {String(idx).padStart(2, "0")}
      </div>
      <h3 className="relative font-display text-[15px] font-bold tracking-tight text-zinc-100">{title}</h3>
      <p className="relative mt-2 text-[13px] leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition-all open:border-violet-500/30 open:bg-violet-500/[0.06] open:shadow-[0_8px_24px_-12px_rgba(167,139,250,0.3)] hover:border-white/[0.14]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-semibold text-zinc-100">
        {q}
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[13px] text-zinc-400 transition-all group-open:rotate-45 group-open:border-violet-500/40 group-open:bg-violet-500/15 group-open:text-violet-200">
          +
        </span>
      </summary>
      <p className="mt-3 text-[13px] leading-relaxed text-zinc-400">{a}</p>
    </details>
  );
}
