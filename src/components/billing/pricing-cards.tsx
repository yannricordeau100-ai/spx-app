"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Sparkles, ArrowRight, Crown } from "lucide-react";
import { PLANS as FALLBACK_PLANS, monthlyEquivalent, type PlanDisplay } from "@/lib/billing/plans";

/**
 * 3-card pricing avec toggle mensuel / annuel.
 *
 * Sales-optimized :
 *  - Carte centrale (Investisseur) mise en avant : highlight=true → bordure
 *    couleur, badge "Recommandé", scale légèrement + sombre.
 *  - Annuel par défaut (économies visibles immédiatement, ancrage prix bas).
 *  - Mention "2 mois offerts" en chip.
 *  - CTA contrasté (violet sur Investisseur, cyan sur Pro+, neutre sur Free).
 *  - Sous chaque CTA : "30 jours satisfait ou remboursé" → confiance.
 *
 * Cible le signup → checkout flow. Le clic CTA Investisseur / Pro+ part sur
 * `/api/billing/checkout?plan=premium_monthly|premium_annual` qui gère la
 * redirection Stripe. Le tier `pro_plus` n'est pas encore Stripe-configuré
 * → CTA "Nous contacter" temporairement (mailto).
 */
export function PricingCards({
  ctaTrackingPrefix = "",
  plans: plansProp,
}: {
  ctaTrackingPrefix?: string;
  /**
   * Plans à afficher. Yann 8 mai 2026 : prop optionnel pour permettre à
   * la page server de passer les plans depuis la BDD via `loadPricingCatalog()`.
   * Sans prop, fallback sur les plans hardcodés `plans.ts`.
   */
  plans?: PlanDisplay[];
}) {
  const PLANS = plansProp && plansProp.length > 0 ? plansProp : FALLBACK_PLANS;
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");

  return (
    <div>
      {/* Toggle mensuel / annuel : pillule double-onglet, beaucoup
          plus lisible que le slider précédent (la boule sortait
          visuellement du rail). Centre toujours bien le slider, et
          marque visuellement quel onglet est actif. */}
      <div className="mb-3 flex justify-center">
        <div
          role="tablist"
          aria-label="Période de facturation"
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={billing === "monthly"}
            onClick={() => setBilling("monthly")}
            className={`rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-colors ${
              billing === "monthly"
                ? "bg-violet-500/25 text-zinc-50 shadow-inner"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Mensuel
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={billing === "annual"}
            onClick={() => setBilling("annual")}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-colors ${
              billing === "annual"
                ? "bg-violet-500/25 text-zinc-50 shadow-inner"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Annuel
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wider text-emerald-300">
              -33%
            </span>
          </button>
        </div>
      </div>
      <p className="mb-6 text-center text-[11.5px] text-zinc-500">
        Les deux prix sont affichés sur chaque plan. Active l'annuel pour passer au tarif réduit.
      </p>

      {/* Cards 3 plans */}
      <div className="grid gap-5 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <PricingCard
            key={plan.tier}
            plan={plan}
            billing={billing}
            onSwitch={setBilling}
            prefix={ctaTrackingPrefix}
          />
        ))}
      </div>

      {/* Yann 9 mai 2026 : retire "Tous les plans payants : 30 jours satisfait
          ou remboursé. TVA incluse, facturation par R consulting (Suisse)." */}

      {/* Code promo en bas de page (best practice US 2024) : afficher
          uniquement aux utilisateurs ayant scrollé = déjà engagés. Évite
          la friction "j'attends d'avoir un code mieux". */}
      <PromoCodeBox />
    </div>
  );
}

/**
 * Bandeau code promo. Stocke dans localStorage et expose globalement
 * pour que les CTA de plan puissent l'inclure dans le POST checkout.
 */
function PromoCodeBox() {
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState(false);

  // Au mount : lit localStorage
  if (typeof window !== "undefined" && !code && !applied) {
    const saved = window.localStorage.getItem("mettrik_promo_code") ?? "";
    if (saved && !code) {
      // setState in render = ok if guarded, mais on évite via lazy init
    }
  }

  function apply() {
    if (!code) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("mettrik_promo_code", code.toUpperCase());
    }
    setApplied(true);
    setTimeout(() => setApplied(false), 3000);
  }

  function clear() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("mettrik_promo_code");
    }
    setCode("");
    setApplied(false);
  }

  return (
    <details className="mx-auto mt-10 max-w-md group">
      <summary className="flex cursor-pointer items-center justify-center gap-1.5 text-[11.5px] font-semibold text-zinc-400 hover:text-zinc-200">
        J'ai un code promotionnel
        <span className="text-zinc-600">↓</span>
      </summary>
      <div className="mt-3 flex items-stretch gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ex : LAUNCH20"
          className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[12.5px] uppercase tracking-wider text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none"
        />
        {!applied ? (
          <button type="button" onClick={apply} disabled={!code} className="rounded-lg bg-violet-500 px-4 py-2 text-[12px] font-bold text-zinc-50 disabled:opacity-50 hover:bg-violet-400">
            Appliquer
          </button>
        ) : (
          <button type="button" onClick={clear} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-[12px] font-bold text-emerald-200 hover:bg-emerald-500/15">
            ✓ Appliqué
          </button>
        )}
      </div>
      {applied && (
        <p className="mt-1.5 text-center text-[11px] text-emerald-300">
          Code « {code} » sera appliqué à ton checkout. Validité vérifiée à la sélection du plan.
        </p>
      )}
    </details>
  );
}

function PricingCard({
  plan,
  billing,
  onSwitch,
  prefix,
}: {
  plan: PlanDisplay;
  billing: "monthly" | "annual";
  /** Callback pour switcher la période depuis l'intérieur de la card. */
  onSwitch?: (b: "monthly" | "annual") => void;
  prefix: string;
}) {
  const isAnnual = billing === "annual";
  const isHighlight = plan.highlight;

  let ctaHref = "/signup";
  let ctaIsCheckout = false;
  if (plan.tier === "investisseur") {
    ctaHref = isAnnual ? "premium_annual" : "premium_monthly";
    ctaIsCheckout = true;
  } else if (plan.tier === "pro_plus") {
    ctaHref = "mailto:contact@mettrik.ai?subject=Demande%20Pro%2B%20Mettrik%20AI";
  }

  const features = topFeatures(plan.tier);

  return (
    <div
      className={`relative flex flex-col rounded-2xl p-6 transition-transform hover:scale-[1.01] ${
        isHighlight
          ? "border-2 bg-gradient-to-br from-violet-500/[0.08] to-violet-500/[0.02] shadow-2xl shadow-violet-500/10"
          : "border border-white/[0.08] bg-white/[0.02]"
      }`}
      style={isHighlight ? { borderColor: `${plan.accent}66` } : undefined}
    >
      {isHighlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-zinc-50" style={{ background: plan.accent }}>
          ★ Recommandé
        </div>
      )}
      {plan.tier === "pro_plus" && (
        <Crown className="absolute right-5 top-5 size-4" style={{ color: plan.accent }} />
      )}

      <h3 className="font-display text-[22px] font-bold tracking-tight" style={{ color: plan.accent }}>
        {plan.name}
      </h3>
      <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">{plan.tagline}</p>

      <div className="mt-5">
        {plan.price_monthly_eur === 0 ? (
          <>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-[44px] font-bold leading-none tracking-tight text-zinc-50">0</span>
              <span className="text-[15px] font-medium text-zinc-400">€</span>
              <span className="ml-1 text-[12px] text-zinc-500">/mois</span>
            </div>
            <div className="mt-1 text-[11.5px] text-zinc-500">{plan.annual_savings_label}</div>
          </>
        ) : (
          <>
            {/* Prix principal : celui sélectionné par le toggle (gros caractères) */}
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-[44px] font-bold leading-none tracking-tight text-zinc-50">
                {(isAnnual ? monthlyEquivalent(plan) : plan.price_monthly_eur).toFixed(2).replace(".", ",")}
              </span>
              <span className="text-[15px] font-medium text-zinc-400">€</span>
              <span className="ml-1 text-[12px] text-zinc-500">/mois</span>
            </div>
            <div className="mt-1 text-[11.5px] text-zinc-500">
              {isAnnual ? (
                <>
                  Soit <strong className="text-zinc-300">{plan.price_annual_eur} €</strong> facturés annuellement
                  <span className="ml-1 text-emerald-300">· {plan.annual_savings_label}</span>
                </>
              ) : (
                <>Sans engagement</>
              )}
            </div>

            {/* Comparatif compact : montre l'autre prix barré, donne envie de switcher */}
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 text-[11px]">
              <button
                type="button"
                onClick={() => onSwitch?.("monthly")}
                className={`rounded-md px-2 py-1.5 text-left transition-colors ${
                  isAnnual ? "text-zinc-500 hover:bg-white/[0.04]" : "bg-violet-500/15 text-zinc-100"
                }`}
                aria-pressed={!isAnnual}
              >
                <div className="text-[9.5px] font-bold uppercase tracking-wider opacity-70">Mensuel</div>
                <div className="font-mono">
                  <span className={isAnnual ? "" : "font-bold text-zinc-50"}>{plan.price_monthly_eur.toFixed(2).replace(".", ",")} €</span>
                  <span className="ml-1 opacity-60">/mois</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => onSwitch?.("annual")}
                className={`rounded-md px-2 py-1.5 text-left transition-colors ${
                  isAnnual ? "bg-violet-500/15 text-zinc-100" : "text-zinc-500 hover:bg-white/[0.04]"
                }`}
                aria-pressed={isAnnual}
              >
                <div className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider opacity-70">
                  Annuel
                  <span className="rounded-full bg-emerald-500/20 px-1 font-mono text-[8.5px] text-emerald-300">-33%</span>
                </div>
                <div className="font-mono">
                  <span className={isAnnual ? "font-bold text-zinc-50" : ""}>{monthlyEquivalent(plan).toFixed(2).replace(".", ",")} €</span>
                  <span className="ml-1 opacity-60">/mois</span>
                </div>
              </button>
            </div>
          </>
        )}
      </div>

      <CtaButton
        plan={plan.tier}
        ctaHref={ctaHref}
        ctaIsCheckout={ctaIsCheckout}
        ctaLabel={plan.cta_label}
        isHighlight={isHighlight}
        accent={plan.accent}
        prefix={prefix}
        billing={billing}
        stripePlan={ctaIsCheckout ? (ctaHref as "premium_monthly" | "premium_annual") : undefined}
      />

      <p className="mt-3 text-center text-[10.5px] text-zinc-500">{plan.audience}</p>

      <ul className="mt-5 space-y-2.5 border-t border-white/[0.06] pt-5">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-[12.5px] leading-snug text-zinc-300">
            <Check className="mt-0.5 size-3.5 shrink-0" style={{ color: plan.accent }} strokeWidth={2.5} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * CTA bouton qui POST le checkout avec le code promo lu depuis localStorage.
 * Pour les plans non payants (free → /signup, pro_plus → mailto), c'est
 * un Link standard.
 */
function CtaButton({
  plan,
  ctaHref,
  ctaIsCheckout,
  ctaLabel,
  isHighlight,
  accent,
  prefix,
  billing,
  stripePlan,
}: {
  plan: PlanDisplay["tier"];
  ctaHref: string;
  ctaIsCheckout: boolean;
  ctaLabel: string;
  isHighlight: boolean;
  accent: string;
  prefix: string;
  billing: "monthly" | "annual";
  stripePlan?: "premium_monthly" | "premium_annual";
}) {
  const className = `mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-bold transition-colors ${
    isHighlight
      ? "text-zinc-50 shadow-lg"
      : plan === "pro_plus"
        ? "border-2 text-zinc-50"
        : "border border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.07]"
  }`;
  const style = isHighlight
    ? { background: accent }
    : plan === "pro_plus"
      ? { borderColor: `${accent}80`, color: accent }
      : undefined;

  if (!ctaIsCheckout || !stripePlan) {
    return (
      <Link href={ctaHref} data-pricing-cta={`${prefix}${plan}_${billing}`} className={className} style={style}>
        {ctaLabel}
        <ArrowRight className="size-4" />
      </Link>
    );
  }

  return <CheckoutButtonInline className={className} style={style} stripePlan={stripePlan} ctaLabel={ctaLabel} prefix={prefix} plan={plan} billing={billing} />;
}

function CheckoutButtonInline({
  className,
  style,
  stripePlan,
  ctaLabel,
  prefix,
  plan,
  billing,
}: {
  className: string;
  style?: React.CSSProperties;
  stripePlan: "premium_monthly" | "premium_annual";
  ctaLabel: string;
  prefix: string;
  plan: string;
  billing: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      const promoCode = typeof window !== "undefined" ? window.localStorage.getItem("mettrik_promo_code") : null;
      const r = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: stripePlan, currency: "eur", promo_code: promoCode || undefined }),
      });
      if (r.status === 401) {
        window.location.href = `/?auth=signin&next=${encodeURIComponent("/pricing?selected=" + stripePlan)}`;
        return;
      }
      const data = await r.json();
      if (!r.ok || !data.url) {
        setErr(data.error ?? "Erreur");
        setBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setErr("Erreur réseau");
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <button type="button" onClick={go} disabled={busy} data-pricing-cta={`${prefix}${plan}_${billing}`} className={className} style={style}>
        {busy ? "Chargement…" : ctaLabel}
        <ArrowRight className="size-4" />
      </button>
      {err && <p className="mt-2 text-center text-[11px] text-rose-300">{err}</p>}
    </div>
  );
}

/** Top 5-6 highlights par tier pour la card (résumé, pas la matrice complète). */
function topFeatures(tier: PlanDisplay["tier"]): string[] {
  if (tier === "free") {
    return [
      "Accès complet à Google + Meta",
      "Comparaison Google ↔ Meta",
      "Tous les indicateurs et risques détaillés",
      "Sauvegarde de 2 favoris",
      "Sans carte bancaire requise",
    ];
  }
  if (tier === "investisseur") {
    return [
      "1 000+ sociétés américaines & européennes",
      "Citations dirigeants (transcripts)",
      "Risques scorés + gouvernance + IA",
      "Calendrier des résultats à venir",
      "5 alertes email sur seuils KPI",
      "50 favoris + 3 sociétés en comparaison",
    ];
  }
  return [
    "Tout du plan Investisseur, et :",
    "Sociétés favorites illimitées",
    "Alertes email illimitées",
    "Historique 10 ans + 20 ans",
    "Export PDF + CSV",
    "Accès API (lecture)",
    "Support prioritaire (réponse < 24 h)",
  ];
}
