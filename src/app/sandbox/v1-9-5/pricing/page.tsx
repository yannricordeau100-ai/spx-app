import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft, Check, Mail } from "lucide-react";
import { PricingCards } from "@/components/billing/pricing-cards";
import { PricingMatrix } from "@/components/billing/pricing-matrix";
import { DisclaimerFooter } from "@/components/legal/disclaimer-footer";
import { BrandWordmark } from "@/components/brand-wordmark";
import { FloatingLogosBg } from "@/components/billing/floating-logos-bg";
import { AuthNav } from "@/components/auth-nav";
import { CurrencyPicker } from "@/components/billing/currency-picker";
import { ScrollToTopOnMount } from "@/components/scroll-to-top-on-mount";
import { loadPricingCatalog } from "@/lib/billing/load-pricing";
import { loadAllTaglines } from "@/lib/billing/pricing-taglines";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dictionary";
import { isDeskOwner } from "@/lib/desk/auth";
import { LATEST_VERSION_SLUG } from "@/lib/version-routing";
import V18_TICKERS from "@/data/v1-8-tickers-sorted.json";

async function detectCurrency(): Promise<string> {
  try {
    const c = await cookies();
    const v = c.get("mettrik:currency")?.value?.toUpperCase();
    if (v && ["EUR", "USD", "GBP", "CHF", "SEK", "DKK", "CAD"].includes(v)) return v;
  } catch {}
  return "EUR";
}

export const metadata = {
  title: "Tarifs · Mettrik AI",
  description: "3 plans Mettrik AI : Gratuit, Premium, Max.",
  robots: { index: false, follow: false },
};

/**
 * /sandbox/v1-9-5/pricing — page tarifs V1.9.5 (= dernière version, alias
 * automatique via LATEST_VERSION_SLUG dans `src/lib/version-routing.ts`).
 *
 * Réutilise exactement les mêmes composants que /sandbox/v1-8/pricing
 * (PricingCards + PricingMatrix) pour rester en synchro. Le seul écart =
 * la navigation retour pointe vers `/sandbox/v1-9-5` (hub V1.9.5).
 *
 * Pour basculer ces routes vers une future version (V1.9.6, V2…), il
 * suffit de changer `LATEST_VERSION_SLUG` dans version-routing.ts et de
 * créer le dossier `src/app/sandbox/<nouveau-slug>/pricing/` qui pointe
 * sur les mêmes composants partagés.
 */
export default async function V195PricingPage() {
  const currency = await detectCurrency();
  const catalog = await loadPricingCatalog(currency);
  const locale = await getServerLocale();
  const taglines = await loadAllTaglines();
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
          href={`/sandbox/${LATEST_VERSION_SLUG}`}
          className="group inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          <BrandWordmark size="sm" animated={false} showRail={false} />
        </Link>
        <div className="flex items-center gap-3">
          {showCurrencyPicker && <CurrencyPicker current={currency} />}
          <AuthNav scope="home" />
        </div>
      </nav>

      <main className="relative mx-auto max-w-6xl px-4 pb-12 pt-1 sm:px-6 sm:pb-16 sm:pt-2">
        <ScrollToTopOnMount />
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-violet-200">
            {t("pricing.eyebrow")}
          </span>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl">
            {t("pricing.h1")}
          </h1>
          <p className="mt-4 whitespace-pre-line text-[15.5px] leading-relaxed text-zinc-400">
            {t("pricing.intro")}
          </p>
        </div>

        <div className="mx-auto mt-6 max-w-5xl">
          <PricingCards ctaTrackingPrefix="v195_top_" plans={catalog.plans} features={catalog.features} currency={currency} taglines={taglines} />
        </div>

        <section id="compare" className="mx-auto mt-20 max-w-5xl scroll-mt-20">
          <div className="mb-6 text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-zinc-50">
              {t("pricing.compare_title")}
            </h2>
            <p className="mt-2 text-[14px] text-zinc-400">
              {t("pricing.compare_sub")}
            </p>
          </div>
          <PricingMatrix plans={catalog.plans} features={catalog.features} currency={currency} />
        </section>

        <section className="mx-auto mt-20 grid max-w-5xl gap-5 sm:grid-cols-3">
          <TrustCard title={t("pricing.trust1_title")} body={t("pricing.trust1_body")} />
          <TrustCard title={t("pricing.trust2_title")} body={t("pricing.trust2_body")} />
          <TrustCard title={t("pricing.trust3_title")} body={t("pricing.trust3_body")} />
        </section>

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
              data-pricing-cta="v195_bottom_signup"
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
