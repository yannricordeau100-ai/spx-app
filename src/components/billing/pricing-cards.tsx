"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Sparkles, ArrowRight, Crown } from "lucide-react";
import { PLANS as FALLBACK_PLANS, FEATURES as FALLBACK_FEATURES, monthlyEquivalent, type PlanDisplay, type FeatureRow } from "@/lib/billing/plans";
import type { LoadedPlan } from "@/lib/billing/load-pricing";

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
  features: featuresProp,
  currency = "EUR",
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
}) {
  const PLANS = plansProp && plansProp.length > 0 ? plansProp : FALLBACK_PLANS;
  const FEATURES = featuresProp && featuresProp.length > 0 ? featuresProp : FALLBACK_FEATURES;
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
            features={FEATURES}
            currency={currency}
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
  features,
  currency = "EUR",
}: {
  plan: PricingCardPlan;
  billing: "monthly" | "annual";
  onSwitch?: (b: "monthly" | "annual") => void;
  prefix: string;
  currency?: string;
  /** Catalogue features (BDD ou fallback) pour générer les bullets dynamiquement. */
  features?: FeatureRow[];
}) {
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

  // Yann 9 mai 2026 : les bullet points doivent venir du catalogue
  // BDD pricing_features (= ce que Yann édite en back office), pas
  // d'une liste hardcodée. Pour chaque feature active, on prend la
  // valeur du plan : true → label seul, "string" → "label : string",
  // false → on skip. Limite à 8 max pour pas tasser la card.
  const planFeatures = features && features.length > 0 ? features : [];
  const bulletFeatures: string[] = planFeatures
    .map((f) => {
      const v = f[plan.tier];
      if (v === false || v === null || v === undefined) return null;
      if (v === true) return f.label;
      const sv = String(v).trim();
      if (!sv || sv === "false") return null;
      // Si la string commence par un nombre ou ressemble à une quantité,
      // mettre "label : valeur". Sinon, juste "label" (la valeur EST déjà
      // une description).
      return sv.length <= 30 ? `${f.label} : ${sv}` : f.label;
    })
    .filter((s): s is string => Boolean(s))
    .slice(0, 8);
  const bulletList = bulletFeatures.length > 0 ? bulletFeatures : topFeatures(plan.tier);

  // Yann (11 mai 2026) : prix dans la devise du visiteur, pas EUR forcé.
  // Lookup BDD plan.prices[currency], fallback EUR si pas activé.
  const currencyMonthly = plan.prices?.[currency]?.monthly?.amount;
  const currencyAnnual = plan.prices?.[currency]?.annual?.amount;
  const eurMonthly = plan.prices?.EUR?.monthly?.amount ?? plan.price_monthly_eur;
  const eurAnnual = plan.prices?.EUR?.annual?.amount ?? plan.price_annual_eur;
  // Si la devise demandée a un prix actif → l'utiliser, sinon fallback EUR
  const displayMonthly = (currencyMonthly && currencyMonthly > 0) ? currencyMonthly : eurMonthly;
  const displayAnnual = (currencyAnnual && currencyAnnual > 0) ? currencyAnnual : eurAnnual;
  const displayCurrency = (currencyMonthly && currencyMonthly > 0) ? currency : "EUR";
  const currencySymbol = ({ EUR: "€", USD: "$", GBP: "£", CHF: "CHF", SEK: "kr", DKK: "kr", CAD: "$" } as Record<string, string>)[displayCurrency] ?? displayCurrency;
  const dailyPrice = displayAnnual > 0 ? displayAnnual / 365 : 0;

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
      <p className="mt-1 min-h-[40px] whitespace-pre-line text-[13px] leading-relaxed text-zinc-400">{plan.tagline}</p>

      {/* Bloc prix avec min-height pour aligner les CTA des 3 cards
          horizontalement (le free a juste '0 €' alors que les payants
          ont prix mensuel + pill prix/jour + ligne 'soit X €/an'). */}
      <div className="mt-5 min-h-[180px]">
        {displayMonthly === 0 ? (
          <>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-[44px] font-bold leading-none tracking-tight text-zinc-50">0</span>
              <span className="text-[15px] font-medium text-zinc-400">{currencySymbol}</span>
              <span className="ml-1 text-[12px] text-zinc-500">/mois</span>
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
            <div className="flex items-end justify-between gap-3">
              {/* Prix mensuel (gauche, gros) */}
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-[40px] font-bold leading-none tracking-tight text-zinc-50">
                  {(isAnnual ? (displayAnnual > 0 ? displayAnnual / 12 : 0) : displayMonthly).toFixed(2).replace(".", ",")}
                </span>
                <span className="text-[14px] font-medium text-zinc-400">{currencySymbol}</span>
                <span className="ml-0.5 text-[11px] text-zinc-500">/mois</span>
              </div>
              {/* Séparateur vertical en gradient emerald */}
              <div className="h-10 w-px self-center bg-gradient-to-b from-transparent via-emerald-500/40 to-transparent" />
              {/* Prix /jour (droite, pastille) */}
              <div className="flex flex-col items-end leading-tight">
                <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em] text-emerald-400/70">
                  équivaut à
                </span>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <span className="font-display text-[20px] font-bold leading-none tracking-tight text-emerald-200">
                    {dailyPrice.toFixed(2).replace(".", ",")}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-300/80">{currencySymbol}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/80">/j</span>
                </div>
              </div>
            </div>
            <div className="mt-2 text-[11.5px] text-zinc-500">
              {isAnnual ? (
                <>
                  Soit <strong className="text-zinc-300">{displayAnnual} {currencySymbol}</strong> facturés annuellement
                  <span className="ml-1 text-emerald-300">· {plan.annual_savings_label}</span>
                </>
              ) : (
                <>Sans engagement</>
              )}
            </div>
            {/* Yann 9 mai 2026 : retire le bi-bloc Mensuel/Annuel a
                l'interieur des cards (le toggle global au-dessus
                suffit). */}
          </>
        )}
      </div>

      <CtaButton
        plan={plan.tier}
        ctaHref={ctaHref}
        ctaIsCheckout={ctaIsCheckout}
        ctaLabel={
          !currencyActive
            ? "Bientôt dispo dans cette devise"
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

      {/* Bullet points features : viennent du catalogue BDD
          pricing_features (édité dans /desk-mtk9x4kp/pricing). Si la
          BDD est vide, fallback sur la liste statique topFeatures(). */}
      <ul className="mt-5 space-y-2.5 border-t border-white/[0.06] pt-5">
        {bulletList.map((f, i) => (
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
  const className = `mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-bold transition-colors ${
    disabled
      ? "border border-white/10 bg-white/[0.02] text-zinc-500 cursor-not-allowed"
      : isHighlight
        ? "text-zinc-50 shadow-lg"
        : plan === "pro_plus"
          ? "border-2 text-zinc-50"
          : "border border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.07]"
  }`;
  const style = disabled
    ? undefined
    : isHighlight
      ? { background: accent }
      : plan === "pro_plus"
        ? { borderColor: `${accent}80`, color: accent }
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
    "Tout du plan Premium, et :",
    "Sociétés favorites illimitées",
    "Alertes email illimitées",
    "Historique 10 ans + 20 ans",
    "Export PDF + CSV",
    "Accès API (lecture)",
    "Support prioritaire (réponse < 24 h)",
  ];
}
