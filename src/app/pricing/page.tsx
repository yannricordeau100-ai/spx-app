import Link from "next/link";
import { Check, Lock, Sparkles, ArrowRight, Mail, ArrowLeft } from "lucide-react";
import { DisclaimerFooter } from "@/components/legal/disclaimer-footer";

/**
 * Page tarifs publique. Squelette avec placeholders — le contenu marketing
 * définitif sera fourni par Yann.
 *
 * Plans validés :
 *   - Free : Google + Meta exclusifs, à vie, comparaison entre les deux.
 *   - Premium : 24,90 € / mois OU 189 € / an. Toutes sociétés + features Pro.
 *   - API : "Nous contacter" (mailto contact@mettrik.ai).
 *
 * Ne nécessite pas auth (déclaré public dans proxy.ts).
 * Layout : 3 cartes, hero, billing toggle (mensuel/annuel), section
 * comparaison features, FAQ basique, CTA final.
 */
export const metadata = {
  title: "Tarifs · Mettrik AI",
  description: "Choisis ton plan Mettrik AI : Free (Google + Meta) ou Premium (toutes sociétés). 24,90 € / mois ou 189 € / an.",
};

export default function PricingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505]">
      {/* Halo brand discret en haut */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[600px]"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(167,139,250,0.18), transparent 60%)",
        }}
      />

      {/* Top nav minimal */}
      <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <Link
          href="/"
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
            S'inscrire
          </Link>
        </div>
      </nav>

      <main className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        {/* HERO */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-violet-200">
            {/* PLACEHOLDER : tagline tarifs */}
            Tarifs simples, accès puissant
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl">
            {/* PLACEHOLDER : H1 marketing */}
            Choisis ton plan Mettrik AI
          </h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-zinc-400">
            {/* PLACEHOLDER : sous-titre marketing 2-3 lignes */}
            Accès gratuit aux 2 sociétés phares pour découvrir le produit. Premium pour
            débloquer toutes les sociétés du S&amp;P 500 et plus, comparaisons illimitées,
            alertes email sur seuils KPI.
          </p>
        </div>

        {/* PLAN CARDS */}
        <div className="mx-auto mt-12 grid max-w-5xl gap-5 lg:grid-cols-3">
          {/* FREE */}
          <PlanCard
            tier="free"
            title="Free"
            tagline="Découvre la profondeur d'analyse Mettrik AI sur les 2 sociétés phares."
            price="0 €"
            priceUnit="à vie"
            features={[
              "Accès complet à Google (GOOGL)",
              "Accès complet à Meta (META)",
              "Comparaison Google ↔ Meta",
              "Tous les KPIs, risques, gouvernance, IA",
              "Sauvegarde de favoris (limité à 2)",
            ]}
            limitations={[
              "Pas d'accès au reste du S&P 500",
              "Pas de comparaison hors Google / Meta",
              "Pas d'alertes par email",
            ]}
            cta="Continuer en Free"
            ctaHref="/signup"
          />

          {/* PREMIUM */}
          <PlanCard
            tier="premium"
            title="Premium"
            tagline="Toutes les sociétés du S&P 500, comparaisons illimitées, alertes."
            price="24,90 €"
            priceUnit="/ mois"
            secondaryPrice="ou 189 € / an"
            secondaryNote="(15,75 € / mois, économise 37 %)"
            features={[
              "Toutes les sociétés (S&P 500 et plus)",
              "Comparaisons illimitées (N vs N)",
              "Alertes email sur seuils KPI",
              "Digest hebdomadaire personnalisé",
              "Favoris illimités",
              "Accès aux KPI composites Mettrik",
              "Historique 10 ans (vs 5 en Free)",
              "Export PDF des analyses",
            ]}
            limitations={[]}
            cta="Choisir Premium"
            ctaHref="/signup?plan=premium"
            badge="Recommandé"
            highlighted
          />

          {/* API */}
          <PlanCard
            tier="api"
            title="API"
            tagline="Accès programmatique pour ton équipe data, fonds, ou produit."
            price="Sur mesure"
            priceUnit=""
            features={[
              "API REST (lecture KPIs, risques, gouvernance)",
              "Webhooks sur événements (earnings, revisions)",
              "Volumes adaptés à ton usage",
              "SLA dédié",
              "Onboarding personnalisé",
            ]}
            limitations={[]}
            cta="Nous contacter"
            ctaHref="mailto:contact@mettrik.ai?subject=Demande%20accès%20API%20Mettrik%20AI"
          />
        </div>

        {/* COMPARISON / FEATURES — placeholder */}
        <section className="mt-20">
          <h2 className="font-display text-2xl font-bold tracking-tight text-zinc-50">
            {/* PLACEHOLDER : titre section features */}
            Pourquoi Mettrik AI
          </h2>
          <p className="mt-2 text-[14px] text-zinc-400">
            {/* PLACEHOLDER : intro 1-2 lignes */}
            Là où les autres affichent des chiffres bruts, Mettrik AI lit le 10-K, identifie
            ce qui change, et te dit pourquoi.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <FeatureBlock
              title="KPI lus, pas listés"
              text="Chaque indicateur vient avec un signal éditorial : moteur de croissance, point de vigilance, à surveiller."
            />
            <FeatureBlock
              title="Risques sourcés 10-K"
              text="Score 1-5 par risque, citation littérale du 10-K, tendance vs N-1. Pas d'invention."
            />
            <FeatureBlock
              title="Comparaisons honnêtes"
              text="Pairs détectés automatiquement. CAGR, momentum, position relative. Pas de moyenne sectorielle bancale."
            />
          </div>
        </section>

        {/* FAQ — placeholder */}
        <section className="mt-20">
          <h2 className="font-display text-2xl font-bold tracking-tight text-zinc-50">
            Questions fréquentes
          </h2>
          <div className="mt-6 space-y-3">
            <FaqItem
              q="Puis-je passer de Free à Premium plus tard ?"
              a="Oui. Aucune perte de données : tes favoris et préférences sont conservés."
            />
            <FaqItem
              q="L'engagement est-il mensuel ?"
              a="Oui. Annulation possible à tout moment, effet en fin de période en cours."
            />
            <FaqItem
              q="Quelle est la différence avec un broker ?"
              a="Mettrik AI n'est pas un broker. C'est de l'intelligence KPI, pas du courtage. Aucune transaction passée chez nous."
            />
            <FaqItem
              q="Mes données sont-elles à jour ?"
              a="Sources : 10-K et 10-Q officiels SEC, mis à jour à chaque trimestre. L'indicateur 'à jour' affiche la dernière date connue."
            />
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="mt-20 rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-500/8 to-violet-500/2 p-10 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
            {/* PLACEHOLDER : CTA final */}
            Commence gratuit, monte en Premium quand tu veux.
          </h2>
          <p className="mt-3 text-[15px] text-zinc-300">
            Aucune carte bancaire requise pour Free. Premium en moins d'une minute.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-violet-500 px-6 py-3 text-[15px] font-semibold text-white shadow-[0_0_24px_rgba(167,139,250,0.45)] transition-all hover:bg-violet-400"
          >
            Créer un compte
            <ArrowRight className="size-4" />
          </Link>
        </section>
      </main>

      <DisclaimerFooter variant="full" />
    </div>
  );
}

/* ============================================================ */
function PlanCard({
  tier,
  title,
  tagline,
  price,
  priceUnit,
  secondaryPrice,
  secondaryNote,
  features,
  limitations,
  cta,
  ctaHref,
  badge,
  highlighted = false,
}: {
  tier: "free" | "premium" | "api";
  title: string;
  tagline: string;
  price: string;
  priceUnit: string;
  secondaryPrice?: string;
  secondaryNote?: string;
  features: string[];
  limitations: string[];
  cta: string;
  ctaHref: string;
  badge?: string;
  highlighted?: boolean;
}) {
  const tierColor = tier === "premium" ? "#a78bfa" : tier === "api" ? "#22d3ee" : "#a1a1aa";
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 transition-all ${
        highlighted
          ? "border-violet-500/40 bg-gradient-to-b from-violet-500/8 to-violet-500/2 shadow-[0_0_24px_rgba(167,139,250,0.15)]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      {badge && (
        <span
          className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border px-3 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: `${tierColor}20`,
            color: tierColor,
            borderColor: `${tierColor}50`,
          }}
        >
          <Sparkles className="size-3" />
          {badge}
        </span>
      )}
      <div>
        <h3 className="font-display text-[20px] font-bold tracking-tight text-zinc-50">{title}</h3>
        <p className="mt-1 text-[13px] text-zinc-400">{tagline}</p>
      </div>
      <div className="mt-5">
        <span className="font-display text-[36px] font-bold leading-none tracking-tight text-zinc-50 tabular-nums">
          {price}
        </span>
        {priceUnit && <span className="ml-1 text-[13px] text-zinc-400">{priceUnit}</span>}
        {secondaryPrice && (
          <div className="mt-1 text-[13px] font-medium text-zinc-300">
            {secondaryPrice}
            {secondaryNote && <span className="ml-1 text-[11.5px] text-zinc-500">{secondaryNote}</span>}
          </div>
        )}
      </div>
      <ul className="mt-6 flex-1 space-y-2.5">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px] text-zinc-300">
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
            <span>{f}</span>
          </li>
        ))}
        {limitations.map((l, i) => (
          <li key={"l-" + i} className="flex items-start gap-2 text-[12.5px] text-zinc-500">
            <Lock className="mt-0.5 size-3.5 shrink-0 text-zinc-600" />
            <span>{l}</span>
          </li>
        ))}
      </ul>
      <Link
        href={ctaHref}
        className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13.5px] font-semibold transition-all ${
          tier === "premium"
            ? "bg-violet-500 text-white shadow-[0_0_18px_rgba(167,139,250,0.4)] hover:bg-violet-400"
            : tier === "api"
            ? "border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/15"
            : "border border-white/15 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07]"
        }`}
      >
        {tier === "api" && <Mail className="size-4" />}
        {cta}
        {tier === "premium" && <ArrowRight className="size-4" />}
      </Link>
    </div>
  );
}

function FeatureBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-[#1f1f1f] bg-[#0a0a0a]/50 p-5">
      <div className="font-display text-[15px] font-bold text-zinc-100">{title}</div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-zinc-400">{text}</p>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-[#1f1f1f] bg-[#0a0a0a]/50 p-4 transition-colors hover:border-[#2a2a2a]">
      <summary className="flex cursor-pointer items-center justify-between gap-3 text-[14px] font-semibold text-zinc-100">
        {q}
        <span className="text-[18px] text-zinc-400 transition-transform group-open:rotate-45">+</span>
      </summary>
      <p className="mt-3 text-[13px] leading-relaxed text-zinc-300">{a}</p>
    </details>
  );
}
