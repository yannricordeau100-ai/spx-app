"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  Lock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Mail,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";
import type { Company } from "@/lib/data";
import { brand } from "@/lib/brand";
import { CompanyLogo } from "@/components/logos";

type Plan = "free" | "premium";

export function PricingClient({
  freeVersions,
  premiumVersions,
  freeTierTickers,
}: {
  freeVersions: Record<string, Company>;
  premiumVersions: Record<string, Company>;
  freeTierTickers: string[];
}) {
  const [plan, setPlan] = useState<Plan>("free");
  const [billing, setBilling] = useState<"month" | "year">("year");
  const [previewTicker, setPreviewTicker] = useState<string>("MSCI");
  const [showBlur, setShowBlur] = useState<boolean>(true);

  const allTickers = useMemo(() => Object.keys(premiumVersions), [premiumVersions]);
  const company =
    plan === "free" ? freeVersions[previewTicker] : premiumVersions[previewTicker];
  const isLockedForUser = plan === "free" && !freeTierTickers.includes(previewTicker);

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      {/* HEADER */}
      <div className="sticky top-0 z-30 border-b border-white/8 bg-[#050507]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/concepts"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[12.5px] text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white"
            >
              <ArrowLeft className="size-3.5" />
              Concepts
            </Link>
            <h1 className="font-display text-[17px] font-bold tracking-tight text-zinc-50">
              Pricing
            </h1>
            <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-violet-200">
              concept brouillon
            </span>
          </div>

          {/* Plan toggle (sim user state) */}
          <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
            <span className="ml-2 mr-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              voir comme
            </span>
            <button
              onClick={() => setPlan("free")}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-all ${
                plan === "free"
                  ? "bg-zinc-700 text-zinc-50"
                  : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
              }`}
            >
              user Free
            </button>
            <button
              onClick={() => setPlan("premium")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-all ${
                plan === "premium"
                  ? "bg-violet-500 text-white shadow-[0_0_12px_rgba(167,139,250,0.5)]"
                  : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
              }`}
            >
              <Sparkles className="size-3.5" />
              user Premium
            </button>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        {/* HERO */}
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl">
            Choisis ton plan Mettrik
          </h2>
          <p className="mt-4 text-[15.5px] leading-relaxed text-zinc-400">
            Accès gratuit aux 2 sociétés phares (Google + Meta) pour découvrir le produit.
            Premium pour débloquer toutes les sociétés, comparaisons illimitées, alertes.
          </p>
          {/* billing switch */}
          <div className="mt-7 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
            <button
              onClick={() => setBilling("month")}
              className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
                billing === "month" ? "bg-zinc-700 text-zinc-50" : "text-zinc-400"
              }`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setBilling("year")}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
                billing === "year" ? "bg-zinc-700 text-zinc-50" : "text-zinc-400"
              }`}
            >
              Annuel
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
                -37 %
              </span>
            </button>
          </div>
        </div>

        {/* PLAN CARDS */}
        <div className="mx-auto mt-10 grid max-w-5xl gap-5 lg:grid-cols-3">
          {/* FREE */}
          <PlanCard
            tier="free"
            title="Mettrik Free"
            tagline="Découvre la profondeur d'analyse Mettrik sur les 2 sociétés phares."
            price="0 €"
            priceUnit="à vie"
            features={[
              "Accès complet à Google (GOOGL)",
              "Accès complet à Meta (META)",
              "Comparaison Google ↔ Meta autorisée",
              "Tous les KPIs, risques, gouvernance, IA",
              "Sauvegarde de favoris (limité à 2)",
            ]}
            limitations={[
              "Pas d'accès au reste du S&P (verrouillé)",
              "Pas de comparaison hors Google / Meta",
              "Pas d'alertes par email",
            ]}
            cta="Continuer en Free"
            highlighted={plan === "free"}
          />

          {/* PREMIUM */}
          <PlanCard
            tier="premium"
            title="Mettrik Premium"
            tagline="Toutes les sociétés du S&P 500, comparaisons illimitées, alertes."
            price={billing === "month" ? "24,90 €" : "189 €"}
            priceUnit={billing === "month" ? "/ mois" : "/ an (15,75 € / mois)"}
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
            cta={billing === "month" ? "Choisir Premium · 24,90 € / mois" : "Choisir Premium · 189 € / an"}
            highlighted={plan === "premium"}
            badge="Recommandé"
          />

          {/* API */}
          <PlanCard
            tier="api"
            title="Mettrik API"
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
            ctaHref="mailto:hello@mettrik.ai?subject=Demande%20accès%20API%20Mettrik"
            highlighted={false}
          />
        </div>

        {/* DEMO BLOCK — voir l'expérience selon le plan */}
        <section className="mt-16">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-2xl font-bold tracking-tight text-zinc-50">
                Voir l'expérience selon le plan
              </h3>
              <p className="mt-1 text-[13.5px] text-zinc-400">
                Sélectionne une société. Si tu es en mode <span className="font-mono text-zinc-200">user Free</span> et que la société n'est pas <span className="font-mono text-emerald-300">Google</span> / <span className="font-mono text-emerald-300">Meta</span>, le contenu sensible est verrouillé.
              </p>
            </div>
            <button
              onClick={() => setShowBlur((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white"
            >
              {showBlur ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {showBlur ? "Désactiver le flou" : "Activer le flou"}
              <span className="ml-1 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-400">
                debug
              </span>
            </button>
          </div>

          {/* Société picker */}
          <div className="mb-5 flex flex-wrap gap-2">
            {allTickers.map((t) => {
              const isFree = freeTierTickers.includes(t);
              const isActive = previewTicker === t;
              const accent = brand(t).primary;
              return (
                <button
                  key={t}
                  onClick={() => setPreviewTicker(t)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                    isActive
                      ? "border-violet-500/50 bg-violet-500/15"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.07]"
                  }`}
                >
                  <div className="size-7 shrink-0 rounded-md border border-white/10 bg-white/[0.03] p-1">
                    <CompanyLogo ticker={t} />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                      {t}
                    </span>
                    <span className="text-[11px] text-zinc-300">
                      {premiumVersions[t]?.name}
                    </span>
                  </div>
                  <span
                    className={`ml-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wider ${
                      isFree
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {isFree ? (
                      <>
                        <Check className="size-3" /> free
                      </>
                    ) : (
                      <>
                        <Lock className="size-3" /> premium
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Mock company preview avec gibberish + flou */}
          {company && (
            <div className="relative">
              <CompanyMockPreview
                company={company}
                locked={isLockedForUser}
                blurred={isLockedForUser && showBlur}
              />
              {isLockedForUser && (
                <UpgradeOverlay
                  ticker={previewTicker}
                  price={billing === "month" ? "24,90 €" : "189 €"}
                  unit={billing === "month" ? "/ mois" : "/ an"}
                />
              )}
            </div>
          )}
        </section>

        {/* SECURITY NOTE */}
        <section className="mt-12 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 size-5 shrink-0 text-emerald-300" />
            <div>
              <h4 className="font-display text-[16px] font-bold text-zinc-50">
                Modèle de sécurité du verrouillage
              </h4>
              <p className="mt-2 text-[13px] leading-relaxed text-zinc-300">
                Le flou est <strong className="text-zinc-100">cosmétique</strong>.
                La vraie protection : pour toute société non incluse dans ton plan, le serveur
                <strong className="text-emerald-300"> ne t'envoie jamais le vrai contenu</strong>.
                Les chiffres et textes sont remplacés par du gibberish déterministe
                (mêmes longueurs, même structure) avant d'être sérialisés vers ton navigateur.
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-zinc-300">
                Conséquence : tu peux désactiver le flou (bouton <code className="rounded bg-zinc-800 px-1 font-mono text-[11px]">debug</code>),
                inspecter le code, copier-coller, demander à une IA de lire à travers, exporter la page :
                <strong className="text-emerald-300"> tu ne trouveras que du gibberish</strong>. Le vrai contenu reste sur le serveur.
              </p>
              <p className="mt-2 text-[12px] text-zinc-400">
                Implémentation : <code className="rounded bg-zinc-800 px-1 font-mono text-[11px]">src/lib/gibberify.ts</code>{" → "}
                <code className="rounded bg-zinc-800 px-1 font-mono text-[11px]">lockCompany(c)</code>
                {" "}appelé côté serveur, jamais sur le client.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ============================================================ */
/* PlanCard                                                       */
/* ============================================================ */
function PlanCard({
  tier,
  title,
  tagline,
  price,
  priceUnit,
  features,
  limitations,
  cta,
  ctaHref,
  highlighted,
  badge,
}: {
  tier: "free" | "premium" | "api";
  title: string;
  tagline: string;
  price: string;
  priceUnit: string;
  features: string[];
  limitations: string[];
  cta: string;
  ctaHref?: string;
  highlighted: boolean;
  badge?: string;
}) {
  const tierColor =
    tier === "premium" ? "#a78bfa" : tier === "api" ? "#22d3ee" : "#a1a1aa";
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
        <h3 className="font-display text-[20px] font-bold tracking-tight text-zinc-50">
          {title}
        </h3>
        <p className="mt-1 text-[13px] text-zinc-400">{tagline}</p>
      </div>
      <div className="mt-5">
        <span className="font-display text-[36px] font-bold leading-none tracking-tight text-zinc-50 tabular-nums">
          {price}
        </span>
        {priceUnit && (
          <span className="ml-1 text-[13px] text-zinc-400">{priceUnit}</span>
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
      {ctaHref ? (
        <a
          href={ctaHref}
          className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13.5px] font-semibold transition-all ${
            tier === "premium"
              ? "bg-violet-500 text-white hover:bg-violet-400 shadow-[0_0_18px_rgba(167,139,250,0.4)]"
              : tier === "api"
              ? "border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/15"
              : "border border-white/15 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07]"
          }`}
        >
          {tier === "api" && <Mail className="size-4" />}
          {cta}
        </a>
      ) : (
        <button
          className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13.5px] font-semibold transition-all ${
            tier === "premium"
              ? "bg-violet-500 text-white hover:bg-violet-400 shadow-[0_0_18px_rgba(167,139,250,0.4)]"
              : tier === "api"
              ? "border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/15"
              : "border border-white/15 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07]"
          }`}
        >
          {cta}
          {tier === "premium" && <ArrowRight className="size-4" />}
        </button>
      )}
    </div>
  );
}

/* ============================================================ */
/* CompanyMockPreview — version simplifiée du company-view pour la démo */
/* ============================================================ */
function CompanyMockPreview({
  company,
  locked,
  blurred,
}: {
  company: Company;
  locked: boolean;
  blurred: boolean;
}) {
  const accent = brand(company.ticker).primary;
  const hero = company.kpis?.[0];
  const blurClass = locked && blurred ? "blur-md select-none" : "";
  const others = (company.kpis ?? []).slice(1, 5);

  return (
    <div
      className={`relative rounded-2xl border bg-gradient-to-b from-[#0a0a0a] to-[#070707] p-6 ${
        locked ? "border-amber-500/20" : "border-[#1f1f1f]"
      }`}
    >
      {/* Header (logo + nom + secteur visibles même en locked — choix UX) */}
      <div className="flex items-start gap-4">
        <div className="size-14 shrink-0 rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-2">
          <CompanyLogo ticker={company.ticker} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="font-display text-[24px] font-bold tracking-tight text-zinc-50">
              {company.name}
            </h3>
            <span
              className="font-mono text-[12px] font-bold uppercase tracking-wider"
              style={{ color: accent }}
            >
              {company.ticker}
            </span>
          </div>
          <div className="mt-0.5 text-[12.5px] text-zinc-400">
            {company.sector} · {company.subsector}
          </div>
          <p className={`mt-2 text-[13px] italic text-zinc-400 ${blurClass}`}>
            "{company.tagline}"
          </p>
        </div>
      </div>

      {/* HERO KPI (locked = blur + gibberish) */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_2fr]">
        <div className="rounded-xl border border-[#1f1f1f] bg-[#0a0a0a]/50 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-zinc-500" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              KPI principal
            </span>
          </div>
          <div className={`mt-2 ${blurClass}`}>
            <span
              className="rounded px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider"
              style={{ background: `${accent}1a`, color: accent }}
            >
              {hero?.short ?? "—"}
            </span>
            <div className="mt-2 text-[14px] font-medium text-zinc-200">
              {hero?.name_fr ?? "—"}
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`font-display text-[42px] font-bold leading-none tabular-nums text-zinc-50 ${blurClass}`}
            >
              {hero?.value ?? "—"}
            </span>
            {hero?.unit && (
              <span className={`text-[14px] text-zinc-400 ${blurClass}`}>
                {hero.unit === "$B" ? "Mds $" : hero.unit}
              </span>
            )}
          </div>
          <div className={`mt-2 font-mono text-[12px] font-bold tabular-nums text-emerald-300 ${blurClass}`}>
            {hero?.yoy ?? "—"}
          </div>
        </div>

        <div className="rounded-xl border border-[#1f1f1f] bg-[#0a0a0a]/50 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-2">
            Signal
          </div>
          <div className={blurClass}>
            <p className="text-[14px] font-semibold text-zinc-100">{hero?.signal}</p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-zinc-400">
              {hero?.description}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-1.5">
            {hero?.history?.map((v, i) => {
              const max = Math.max(...(hero.history ?? [1]));
              const h = (v / max) * 50;
              return (
                <div key={i} className="flex flex-col items-center">
                  <div
                    className={`w-full rounded-sm ${blurClass}`}
                    style={{
                      height: `${Math.max(4, h)}px`,
                      background: `${accent}aa`,
                    }}
                  />
                  <div className={`mt-1 font-mono text-[9px] tabular-nums text-zinc-500 ${blurClass}`}>
                    {typeof v === "number" ? v.toFixed(0) : v}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI table mini */}
      {others.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border border-[#1f1f1f] bg-[#0a0a0a]/50">
          <div className="grid grid-cols-12 gap-3 border-b border-[#1a1a1a] bg-[#0c0c0c] px-4 py-2.5 font-sans text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
            <div className="col-span-5">Indicateur</div>
            <div className="col-span-3">Valeur</div>
            <div className="col-span-2">YoY</div>
            <div className="col-span-2">Signal</div>
          </div>
          {others.map((k, i) => (
            <div
              key={i}
              className="grid grid-cols-12 gap-3 border-t border-[#1a1a1a] px-4 py-2.5"
            >
              <div className={`col-span-5 ${blurClass}`}>
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                  {k.short}
                </span>{" "}
                <span className="text-[12.5px] text-zinc-200">{k.name_fr}</span>
              </div>
              <div className={`col-span-3 font-mono text-[12.5px] font-bold tabular-nums text-zinc-100 ${blurClass}`}>
                {k.value}
                {k.unit && <span className="ml-1 text-[10px] text-zinc-500">{k.unit === "$B" ? "Mds $" : k.unit}</span>}
              </div>
              <div className={`col-span-2 font-mono text-[12px] font-bold tabular-nums text-emerald-300 ${blurClass}`}>
                {k.yoy}
              </div>
              <div className={`col-span-2 truncate text-[11px] text-zinc-400 ${blurClass}`}>
                {k.signal}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================ */
/* UpgradeOverlay                                                 */
/* ============================================================ */
function UpgradeOverlay({
  ticker,
  price,
  unit,
}: {
  ticker: string;
  price: string;
  unit: string;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="pointer-events-auto rounded-2xl border border-amber-500/30 bg-[#0a0a0a]/95 p-6 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/15">
            <Lock className="size-5 text-amber-300" />
          </div>
          <div>
            <h4 className="font-display text-[18px] font-bold text-zinc-50">
              {ticker} · accès Premium
            </h4>
            <p className="text-[12.5px] text-zinc-400">
              Cette société est verrouillée dans le plan Free.
            </p>
          </div>
        </div>
        <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-2.5 text-[13.5px] font-semibold text-white transition-all hover:bg-violet-400 shadow-[0_0_18px_rgba(167,139,250,0.4)]">
          Passer à Premium · {price} {unit}
          <ArrowRight className="size-4" />
        </button>
        <p className="mt-2 text-center font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
          ou Annuel à 189 € (-37 %)
        </p>
      </div>
    </div>
  );
}
