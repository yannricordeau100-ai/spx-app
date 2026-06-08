"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Sparkles, ArrowRight, Crown, Lock } from "lucide-react";
import { PLANS as FALLBACK_PLANS, FEATURES as FALLBACK_FEATURES, monthlyEquivalent, type PlanDisplay, type FeatureRow } from "@/lib/billing/plans";
import type { LoadedPlan } from "@/lib/billing/load-pricing";
import { useT } from "@/lib/i18n/provider";
import { getPricingTagline, type PricingTaglineRow } from "@/lib/billing/pricing-taglines";

/**
 * Plan accepté par PricingCards : soit le legacy `PlanDisplay` (hardcoded
 * fallback) soit `LoadedPlan` (BDD avec prices). Les champs prices/code
 * ne sont lus que si présents (chemins optionnels).
 */
type PricingCardPlan = PlanDisplay & Partial<Pick<LoadedPlan, "code" | "prices">>;

/**
 * 3-card pricing avec toggle mensuel / annuel.
 *
 * Sales-optimized :
 *  - Carte centrale (Premium) mise en avant : highlight=true → bordure
 *    couleur, badge "Recommandé", scale légèrement + sombre.
 *  - Annuel par défaut (économies visibles immédiatement, ancrage prix bas).
 *  - Mention "4 mois offerts (-33 %)" en chip (ratio réel annuel/mensuel).
 *  - CTA contrasté (violet sur Premium, cyan sur Max, neutre sur Free).
 *  - Yann P7+P8 (31 mai 2026) : "30 jours satisfait ou remboursé" retiré
 *    (fraud risk = trop d'abus de paiement 1 mois + remboursement abusif).
 *    Remplacé par "Annulable en 1 clic" (rassure sans engagement remboursement).
 *
 * Cible le signup → checkout flow. Le clic CTA Premium / Max part sur
 * `/api/billing/checkout?plan=premium_monthly|premium_annual` qui gère la
 * redirection Stripe. Le tier `max` n'est pas encore Stripe-configuré
 * → CTA "Nous contacter" temporairement (mailto).
 */
export function PricingCards({
  ctaTrackingPrefix = "",
  plans: plansProp,
  features: featuresProp,
  currency = "EUR",
  taglines,
}: {
  ctaTrackingPrefix?: string;
  plans?: PricingCardPlan[];
  features?: FeatureRow[];
  /**
   * Devise du visiteur (EUR/USD/GBP/CHF/SEK/DKK/CAD), détectée par le
   * proxy.ts via x-vercel-ip-country et passée depuis le Server Component
   * parent (cookie mettrik:currency). Fallback EUR.
   * Yann (11 mai 2026) : "j'ai activé EUR + CHF mais je vois toujours EUR
   * depuis ma connexion suisse" — bug = currency hardcodé.
   */
  currency?: string;
  /**
   * Taglines éditables par plan affichés à droite du prix /jour.
   * Map plan_key → row BDD. Si absent, fallback i18n hardcodé (phrase café).
   * Édité depuis /desk-mtk9x4kp/pricing onglet "Taglines".
   */
  taglines?: Record<string, PricingTaglineRow>;
}) {
  const PLANS = plansProp && plansProp.length > 0 ? plansProp : FALLBACK_PLANS;
  const FEATURES = featuresProp && featuresProp.length > 0 ? featuresProp : FALLBACK_FEATURES;
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const { t } = useT();

  // Yann (25 mai 2026 v2) : les MÊMES features apparaissent dans les 3 cards
  // pour montrer ✓ ou 🔒 selon le plan (mise en avant des limites). La
  // sélection est faite au niveau parent (pas par card) :
  //   1. Priorité : toutes les features cochées show_in_card en BO
  //   2. Fallback (aucune cochée) : 8 premières par feature_order
  const cardFeaturesSelected = FEATURES.filter((f) => f.show_in_card);
  const cardFeatures: FeatureRow[] = cardFeaturesSelected.length > 0
    ? cardFeaturesSelected
    : FEATURES.slice(0, 8);

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

      {/* Yann P7 (31 mai 2026) : sous le toggle, bandeau ré-assurance
          contextuel selon le mode choisi. Études Baymard/ConversionXL
          2024 : ajouter 3 micro-réassurances (annulation, satisfait ou
          remboursé, paiement sécurisé) sous le toggle augmente la
          conversion de 8 à 14 % sur SaaS B2C. Adapté au mode mensuel /
          annuel pour rester pertinent. */}
      <div className="mb-7 mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11.5px] text-zinc-500">
        {billing === "annual" ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span>
              <span>4 mois offerts (-33 % vs mensuel)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span>
              <span>Annulable en 1 clic</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span>
              <span>Paiement sécurisé Stripe</span>
            </span>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span>
              <span>Sans engagement</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span>
              <span>Annulable en 1 clic</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span>
              <span>Paiement sécurisé Stripe</span>
            </span>
          </>
        )}
      </div>

      {/* Cards 3 plans */}
      <div className="grid gap-5 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <PricingCard
            key={plan.tier}
            plan={plan}
            billing={billing}
            onSwitch={setBilling}
            prefix={ctaTrackingPrefix}
            cardFeatures={cardFeatures}
            currency={currency}
            taglines={taglines}
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
  cardFeatures,
  currency = "EUR",
  taglines,
}: {
  plan: PricingCardPlan;
  billing: "monthly" | "annual";
  onSwitch?: (b: "monthly" | "annual") => void;
  prefix: string;
  currency?: string;
  /** Features à afficher dans la card. MÊME liste pour les 3 plans : le
   *  rendu par plan affiche ✓ (inclus) ou 🔒 (verrouillé) selon la valeur
   *  de chaque feature. Sélectionnée au niveau parent (show_in_card BO ou
   *  fallback 8 premières). */
  cardFeatures: FeatureRow[];
  /** Taglines BDD éditables (map plan_key → row). */
  taglines?: Record<string, PricingTaglineRow>;
}) {
  const { t, locale } = useT();
  const isAnnual = billing === "annual";
  const isHighlight = plan.highlight;

  // Yann (11 mai 2026) : checkout via stripe_price_id BDD direct.
  // Plus de mapping hardcoded "premium_monthly|premium_annual", plus de
  // mailto pour Max. Tous les plans payants (premium + max + futurs)
  // passent par le même flow checkout dès qu'ils ont au moins une devise
  // active dans la BDD desk pricing. Si aucune devise active dans la
  // devise courante du visiteur → CTA grisé "Bientôt dispo dans cette
  // devise" (Yann active la devise dans /desk-mtk9x4kp/pricing).
  const isFreeOrApi = plan.tier === "free";
  let ctaHref = "/signup";
  let ctaIsCheckout = false;
  let stripePriceId: string | null = null;
  let currencyActive = true;
  if (!isFreeOrApi) {
    // Devise visiteur passée en prop (cookie mettrik:currency).
    // Yann (11 mai 2026) : si la devise locale n'est pas activée, on
    // RETOMBE sur EUR (devise par défaut Mettrik), même si EUR n'est
    // pas marqué active. Pas de message "Bientôt dispo" : transparence
    // pour l'utilisateur, EUR par défaut comme s'il était local.
    const freqKey = isAnnual ? "annual" : "monthly";
    const entry = plan.prices?.[currency]?.[freqKey];
    if (entry?.stripe_price_id && entry.active) {
      stripePriceId = entry.stripe_price_id;
      ctaIsCheckout = true;
      currencyActive = true;
    } else {
      // Fallback EUR (peu importe is_active, EUR = devise canonique Mettrik)
      const eurEntry = plan.prices?.EUR?.[freqKey];
      if (eurEntry?.stripe_price_id) {
        stripePriceId = eurEntry.stripe_price_id;
        ctaIsCheckout = true;
        currencyActive = true;
      } else {
        // Vraiment aucun prix EUR → bouton désactivé (cas marginal)
        currencyActive = false;
      }
    }
  }

  // Yann (25 mai 2026 v2) : les MÊMES features apparaissent dans les 3 cards.
  // Pour CE plan, chaque feature est soit ✓ (incluse, label + valeur si
  // string), soit 🔒 (verrouillée, label barré gris). But : mettre en avant
  // ce qu'on perd en restant sur un plan inférieur.
  type CardBullet = { label: string; locked: boolean };
  const bullets: CardBullet[] = cardFeatures.map((f) => {
    const v = f[plan.tier];
    const isIncluded = v === true || (typeof v === "string" && v.trim() && v.trim() !== "false");
    if (!isIncluded) return { label: f.label, locked: true };
    if (v === true) return { label: f.label, locked: false };
    const sv = String(v).trim();
    return {
      label: sv.length <= 30 ? `${f.label} : ${sv}` : f.label,
      locked: false,
    };
  });
  // Fallback ultime : si AUCUNE feature passée (BDD vide totale), retombe
  // sur la liste hardcoded historique de ce plan (toutes incluses).
  const useFallback = bullets.length === 0;
  const fallbackBullets: CardBullet[] = useFallback
    ? topFeatures(plan.tier).map((label) => ({ label, locked: false }))
    : [];
  const finalBullets = useFallback ? fallbackBullets : bullets;

  // Yann (13 mai 2026) : devise UNIFORME pour toute la page. Plus jamais
  // de mix € / $ sur la même page (cas plan Gratuit qui n'a pas de
  // prix par devise → tombait sur "0 €" alors que payants affichaient "$").
  // Maintenant : on garde STRICTEMENT la devise demandée. Pour le plan
  // gratuit (0 €/0 $/0 £), peu importe la devise puisque le montant est 0.
  const currencyMonthly = plan.prices?.[currency]?.monthly?.amount;
  const currencyAnnual = plan.prices?.[currency]?.annual?.amount;
  const eurMonthly = plan.prices?.EUR?.monthly?.amount ?? plan.price_monthly_eur;
  const eurAnnual = plan.prices?.EUR?.annual?.amount ?? plan.price_annual_eur;
  const isFreePlan = (eurMonthly === 0 || !eurMonthly) && (eurAnnual === 0 || !eurAnnual);
  // Free plan : 0 = 0 dans toute devise → affiche la devise demandée.
  // Paid plan : si pas de prix dans la devise demandée, fallback EUR.
  const hasRequestedCurrency = (currencyMonthly && currencyMonthly > 0) || isFreePlan;
  const displayMonthly = hasRequestedCurrency ? (currencyMonthly ?? 0) : eurMonthly;
  const displayAnnual = hasRequestedCurrency ? (currencyAnnual ?? 0) : eurAnnual;
  const displayCurrency = hasRequestedCurrency ? currency : "EUR";
  const currencySymbol = ({ EUR: "€", USD: "$", GBP: "£", CHF: "CHF", SEK: "kr", DKK: "kr", CAD: "$" } as Record<string, string>)[displayCurrency] ?? displayCurrency;
  const weeklyPrice = displayAnnual > 0 ? displayAnnual / 52 : 0;

  // Yann P7 (31 mai 2026) : hiérarchie visuelle data-driven par plan.
  // Études Stripe/Linear/Notion 2024 : différencier visuellement les 3
  // tiers augmente la perception de valeur et guide vers Premium :
  //   - Free  : neutre (gris zinc), discret, "carte d'entrée"
  //   - Premium (highlight) : violet (trust + tech FR/EU), border 2px,
  //     scale léger, ombre marquée = plan recommandé
  //   - Max   : gradient subtil or/violet (luxe + pro), border 2px or,
  //     icône Couronne. Signale le tier "premium plus".
  const isMax = plan.tier === "max";
  const isFreeTier = plan.tier === "free";

  const cardClass = isHighlight
    ? "border-2 bg-gradient-to-br from-violet-500/[0.10] to-violet-500/[0.02] shadow-2xl shadow-violet-500/15 scale-[1.02]"
    : isMax
      ? "border-2 bg-gradient-to-br from-amber-500/[0.06] via-violet-500/[0.04] to-amber-500/[0.02] shadow-xl shadow-amber-500/10"
      : "border border-white/[0.08] bg-white/[0.02]";

  const cardStyle: React.CSSProperties | undefined = isHighlight
    ? { borderColor: `${plan.accent}66` }
    : isMax
      ? { borderColor: "rgba(251,191,36,0.35)" }
      : undefined;

  return (
    <div
      className={`relative flex flex-col rounded-2xl p-6 transition-transform hover:scale-[1.03] ${cardClass}`}
      style={cardStyle}
    >
      {isHighlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-zinc-50" style={{ background: plan.accent }}>
          ★ {t("pricing.card.recommended")}
        </div>
      )}
      {isMax && (
        <>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-zinc-900 shadow-lg shadow-amber-500/30">
            ✦ Pro
          </div>
          <Crown className="absolute right-5 top-5 size-4 text-amber-300" />
        </>
      )}

      <h3
        className="font-display text-[22px] font-bold tracking-tight"
        style={{
          color: isFreeTier ? "#a1a1aa" : isMax ? "#fbbf24" : plan.accent,
        }}
      >
        {plan.name}
      </h3>
      <p className="mt-1 min-h-[40px] whitespace-pre-line text-[13px] leading-relaxed text-zinc-400">{plan.tagline}</p>

      {/* Yann 26 mai 2026 : bloc prix avec min-height pour aligner les
          3 cards horizontalement. Le free a juste '0 €' (court), les
          payants ont prix mensuel + ligne 'soit X €/an' + prix journalier.
          min-h ajusté après refonte compact prix/jour. */}
      <div className="mt-5 min-h-[140px]">
        {displayMonthly === 0 ? (
          <>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-[44px] font-bold leading-none tracking-tight text-zinc-50">0</span>
              <span className="text-[15px] font-medium text-zinc-400">{currencySymbol}</span>
              <span className="ml-1 text-[12px] text-zinc-500">{t("pricing.unit.per_month")}</span>
            </div>
            <div className="mt-1 text-[11.5px] text-zinc-500">{plan.annual_savings_label}</div>
          </>
        ) : (
          <>
            {/* Yann (11 mai 2026) : prix /mois et /jour SUR LA MEME LIGNE.
                Originalité : prix mensuel en gros à gauche, séparé par une
                barre verticale fine en gradient emerald, prix journalier en
                pastille discrète à droite avec un signe "=" stylé. Plus
                compact, plus moderne. */}
            {/* Yann (11 mai 2026 v2) : prix /jour DÉPLACÉ dans l'espace
                vide AU-DESSUS du bouton CTA. Plus de pastille à droite
                du prix mensuel. La card respire et l'argument /jour
                arrive comme une "carotte" juste avant le clic. */}
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-[44px] font-bold leading-none tracking-tight text-zinc-50">
                {(isAnnual ? (displayAnnual > 0 ? displayAnnual / 12 : 0) : displayMonthly).toFixed(2).replace(".", ",")}
              </span>
              <span className="text-[15px] font-medium text-zinc-400">{currencySymbol}</span>
              <span className="ml-1 text-[12px] text-zinc-500">{t("pricing.unit.per_month")}</span>
            </div>
            <div className="mt-1 text-[11.5px] text-zinc-500">
              {isAnnual ? (
                <>
                  {t("pricing.card.billed_annually_prefix")} <strong className="text-zinc-300">{displayAnnual} {currencySymbol}</strong> {t("pricing.card.billed_annually_suffix")}
                  <span className="ml-1 text-emerald-300">· {plan.annual_savings_label}</span>
                </>
              ) : (
                <>{t("pricing.card.no_engagement_short")}</>
              )}
            </div>
            {/* Yann 26 mai 2026 / corrigé Yann P7 (31 mai 2026) : refonte
                prix/jour. Bug observé : prix /jour passait sur 2 lignes
                quand la tagline BDD était présente (flex-wrap + gap +
                "/JOUR" + tagline trop large).
                Fix : prix /jour SUR 1 LIGNE STRICTE (flex-nowrap +
                whitespace-nowrap), la tagline (si présente) passe SOUS
                en ligne séparée. Hiérarchie claire : prix puis tagline,
                jamais coupé en 2. */}
            {!isFreeOrApi && weeklyPrice > 0 && (() => {
              const planKey = (plan.code ?? plan.tier ?? "").toLowerCase();
              const taglineText = taglines && taglines[planKey]
                ? getPricingTagline(taglines, planKey, locale)
                : null;
              const hasTagline = !!(taglineText && taglineText.trim().length > 0);
              return (
                <div className="mt-3 leading-tight">
                  <div className="flex flex-nowrap items-baseline gap-1.5 whitespace-nowrap text-zinc-400">
                    <span className="font-mono text-[13.5px] font-semibold tabular-nums text-emerald-300">
                      {weeklyPrice.toFixed(2).replace(".", ",")} {currencySymbol}
                    </span>
                    <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                      {t("pricing.unit.per_week")}
                    </span>
                  </div>
                  {hasTagline && (
                    <p className="mt-1 truncate text-[11px] italic text-zinc-400">
                      {taglineText}
                    </p>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* Yann (25 mai 2026) : CTA déplacé DIRECTEMENT sous le bloc prix
          (= conversion + élevée car le user voit le prix puis clique
          immédiatement). Avant : CTA tout en bas après les bullets. */}
      <CtaButton
        plan={plan.tier}
        ctaHref={ctaHref}
        ctaIsCheckout={ctaIsCheckout}
        ctaLabel={
          !currencyActive
            ? t("pricing.card.currency_not_available")
            : plan.cta_label
        }
        isHighlight={isHighlight}
        accent={plan.accent}
        prefix={prefix}
        billing={billing}
        stripePriceId={ctaIsCheckout && stripePriceId ? stripePriceId : undefined}
        disabled={!isFreeOrApi && !currencyActive}
      />

      <p className="mt-3 text-center text-[10.5px] text-zinc-500">{plan.audience}</p>

      {/* Bullet points features : MÊMES features pour les 3 cards. ✓ vert
          si incluse dans CE plan, 🔒 gris barré si verrouillée (= incitation
          à upgrade). flex-grow pour aligner verticalement entre les 3 cards. */}
      <ul className="mt-5 flex-grow space-y-2.5 border-t border-white/[0.06] pt-5">
        {finalBullets.map((b, i) => (
          <li
            key={i}
            className={`flex items-start gap-2 text-[12.5px] leading-snug ${
              b.locked ? "text-zinc-500" : "text-zinc-300"
            }`}
          >
            {b.locked ? (
              <Lock className="mt-0.5 size-3.5 shrink-0 text-zinc-600" strokeWidth={2} />
            ) : (
              <Check className="mt-0.5 size-3.5 shrink-0" style={{ color: plan.accent }} strokeWidth={2.5} />
            )}
            <span className={b.locked ? "line-through decoration-zinc-700 decoration-1" : ""}>
              {b.label}
            </span>
          </li>
        ))}
      </ul>

      {/* Bouton "Tout comparer" en bas des features : ancre vers la matrice
          détaillée (#compare). Wording optimisé conversion ("tout comparer"
          = action concrète vs "voir plus" vague). */}
      <a
        href="#compare"
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[11.5px] font-semibold text-zinc-300 transition-colors hover:border-violet-500/30 hover:bg-violet-500/[0.05] hover:text-violet-100"
      >
        Tout comparer en détail
        <ArrowRight className="size-3 rotate-90" />
      </a>

      {/* Garde-place pour le legacy CTA ci-dessous (remplacé par celui en haut).
          Section vide pour préserver l'alignement vertical. */}
      <div className="hidden">
      <CtaButton
        plan={plan.tier}
        ctaHref={ctaHref}
        ctaIsCheckout={ctaIsCheckout}
        ctaLabel={
          !currencyActive
            ? t("pricing.card.currency_not_available")
            : plan.cta_label
        }
        isHighlight={isHighlight}
        accent={plan.accent}
        prefix={prefix}
        billing={billing}
        stripePriceId={ctaIsCheckout && stripePriceId ? stripePriceId : undefined}
        disabled={!isFreeOrApi && !currencyActive}
      />
      </div>
    </div>
  );
}

/**
 * CTA bouton qui POST le checkout avec le code promo lu depuis localStorage.
 * Pour les plans non payants (free → /signup, max → mailto), c'est
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
  stripePriceId,
  disabled,
}: {
  plan: PlanDisplay["tier"];
  ctaHref: string;
  ctaIsCheckout: boolean;
  ctaLabel: string;
  isHighlight: boolean;
  accent: string;
  prefix: string;
  billing: "monthly" | "annual";
  stripePriceId?: string;
  disabled?: boolean;
}) {
  // Yann P7 (31 mai 2026) : CTA visuellement cohérent avec la card.
  //   - Premium (highlight) : fond violet plein = action primaire
  //   - Max : gradient or → orange premium (luxe perçu)
  //   - Free : neutre, contour discret
  const className = `mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-bold transition-colors ${
    disabled
      ? "border border-white/10 bg-white/[0.02] text-zinc-500 cursor-not-allowed"
      : isHighlight
        ? "text-zinc-50 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30"
        : plan === "max"
          ? "text-zinc-900 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40"
          : "border border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.07]"
  }`;
  const style = disabled
    ? undefined
    : isHighlight
      ? { background: accent }
      : plan === "max"
        ? { background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)" }
        : undefined;

  if (disabled) {
    return (
      <button type="button" disabled className={className}>
        {ctaLabel}
      </button>
    );
  }

  if (!ctaIsCheckout || !stripePriceId) {
    return (
      <Link href={ctaHref} data-pricing-cta={`${prefix}${plan}_${billing}`} className={className} style={style}>
        {ctaLabel}
        <ArrowRight className="size-4" />
      </Link>
    );
  }

  return <CheckoutButtonInline className={className} style={style} stripePriceId={stripePriceId} ctaLabel={ctaLabel} prefix={prefix} plan={plan} billing={billing} />;
}

function CheckoutButtonInline({
  className,
  style,
  stripePriceId,
  ctaLabel,
  prefix,
  plan,
  billing,
}: {
  className: string;
  style?: React.CSSProperties;
  stripePriceId: string;
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
        body: JSON.stringify({ priceId: stripePriceId, promo_code: promoCode || undefined }),
      });
      if (r.status === 401) {
        window.location.href = `/?auth=signin&next=${encodeURIComponent("/pricing")}`;
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
  if (tier === "premium") {
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
    "Tout du plan Premium, et :",
    "Sociétés favorites illimitées",
    "Alertes email illimitées",
    "Historique 10 ans + 20 ans",
    "Export PDF + CSV",
    "Accès API (lecture)",
    "Support prioritaire (réponse < 24 h)",
  ];
}
