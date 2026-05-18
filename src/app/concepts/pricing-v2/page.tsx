"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Lock, Star, Clock, Shield, Zap, ArrowRight, Users, ChevronDown, Sparkles } from "lucide-react";
import { PLANS, FEATURES, monthlyEquivalent } from "@/lib/billing/plans";

/**
 * /concepts/pricing-v2 — 3 designs alternatifs proposés à Yann (8 mai 2026).
 *
 * Best practices appliquées (recherches US 2020-2024 sur SaaS B2B) :
 *  - Annuel par défaut, chip "−XX %" visible immédiatement
 *  - Plan central highlight avec badge "Recommandé"
 *  - Prix annuel lissé en gros, mensuel sous "facturé annuellement"
 *  - Social proof : "X investisseurs nous font confiance"
 *  - Garantie 30 jours visible dans le hero
 *  - Trust badges (Stripe, RGPD, hébergement EU)
 *  - Code promo EN BAS du form (évite la friction "j'attends un code mieux")
 *  - FAQ courte (5-7 questions) en accordéon
 *  - Comparatif features juste après les cards (transparence)
 */

type Design = "minimal" | "matrix" | "social";

const DESIGNS: { id: Design; label: string; tagline: string }[] = [
  { id: "minimal", label: "A : Minimal", tagline: "Inspiration Linear / Notion. 3 cards épurées, gros prix, CTA dominant, FAQ courte." },
  { id: "matrix", label: "B : Comparaison", tagline: "Inspiration Stripe / Vercel. Matrice features dominante, cards compactes en haut." },
  { id: "social", label: "C : Social proof + urgency", tagline: "Inspiration Webflow / Framer. Témoignages, urgency, plans visuels riches." },
];

export default function PricingConceptsV2Page() {
  const [active, setActive] = useState<Design>("minimal");

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#050507]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/concepts" className="font-display text-[15px] font-bold tracking-tight text-zinc-100">
            ← Concepts
          </Link>
          <nav className="flex flex-wrap gap-1.5">
            {DESIGNS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setActive(d.id)}
                className={`rounded-lg px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-wider transition-colors ${
                  active === d.id ? "bg-violet-500/20 text-violet-100" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                }`}
              >
                {d.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-2 pt-4 text-center text-[12px] italic text-zinc-500 sm:px-6">
        {DESIGNS.find((d) => d.id === active)?.tagline}
      </div>

      {active === "minimal" && <DesignMinimal />}
      {active === "matrix" && <DesignMatrix />}
      {active === "social" && <DesignSocial />}
    </div>
  );
}

/* ─── Design A : MINIMAL (Linear / Notion) ─────────────────────────── */

function DesignMinimal() {
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-12 text-center">
        <span className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider text-emerald-200">
          30 jours satisfait ou remboursé
        </span>
        <h1 className="mt-4 font-display text-5xl font-bold tracking-tight">Tarifs simples.</h1>
        <p className="mx-auto mt-3 max-w-md text-[14.5px] text-zinc-400">
          Démarre gratuitement. Passe en Pro quand tu veux. Annule en un clic.
        </p>
        <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.02] p-1">
          {(["monthly", "annual"] as const).map((b) => (
            <button key={b} type="button" onClick={() => setBilling(b)}
              className={`rounded-full px-4 py-1.5 text-[12px] font-semibold transition-colors ${billing === b ? "bg-violet-500 text-zinc-50" : "text-zinc-400"}`}>
              {b === "monthly" ? "Mensuel" : "Annuel"}
              {b === "annual" && <span className="ml-1.5 text-[10px] text-emerald-300">−33 %</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const display = billing === "annual" ? monthlyEquivalent(plan) : plan.price_monthly_eur;
          const isHighlight = plan.highlight;
          return (
            <div key={plan.tier}
              className={`relative rounded-2xl p-7 ${isHighlight ? "border-2 bg-violet-500/[0.04] shadow-2xl shadow-violet-500/10" : "border border-white/[0.08]"}`}
              style={isHighlight ? { borderColor: `${plan.accent}80` } : {}}>
              {isHighlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-500 px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-zinc-50">
                  Recommandé
                </div>
              )}
              <h3 className="font-display text-[22px] font-bold" style={{ color: plan.accent }}>{plan.name}</h3>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="font-display text-[42px] font-bold leading-none">{display === 0 ? "0" : display.toFixed(2).replace(".", ",")}</span>
                <span className="text-[14px] text-zinc-400">€</span>
                <span className="ml-1 text-[12px] text-zinc-500">/mois</span>
              </div>
              <p className="mt-1.5 text-[11.5px] text-zinc-500">
                {plan.price_monthly_eur === 0 ? "À vie, sans CB" : billing === "annual" ? `Soit ${plan.price_annual_eur} € / an` : "Sans engagement"}
              </p>
              <button type="button"
                className={`mt-6 w-full rounded-xl px-4 py-3 text-[14px] font-bold transition-colors ${isHighlight ? "text-zinc-50" : "border border-white/15 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.07]"}`}
                style={isHighlight ? { background: plan.accent } : {}}>
                {plan.cta_label}
              </button>
              <ul className="mt-6 space-y-2 border-t border-white/[0.06] pt-5 text-[12.5px] text-zinc-300">
                {topFeatures(plan.tier).slice(0, 4).map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0" style={{ color: plan.accent }} />{f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <PromoCodeBanner />
      <FaqShort />
    </main>
  );
}

/* ─── Design B : MATRIX (Stripe / Vercel) ──────────────────────────── */

function DesignMatrix() {
  const byCategory = FEATURES.reduce<Record<string, typeof FEATURES>>((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {});
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight">Compare les plans en détail.</h1>
        <p className="mt-2 text-[13.5px] text-zinc-400">Tout ce que tu débloques à chaque niveau, sans surprise.</p>
      </div>
      <div className="mb-6 grid gap-3 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const display = monthlyEquivalent(plan);
          return (
            <div key={plan.tier} className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-[16px] font-bold" style={{ color: plan.accent }}>{plan.name}</span>
                <span className="font-mono text-[14px] tabular-nums">
                  {display === 0 ? "0" : display.toFixed(2).replace(".", ",")} <span className="text-[10px] text-zinc-500">€/mois</span>
                </span>
              </div>
              <button type="button" className="mt-2 w-full rounded-lg px-3 py-1.5 text-[11.5px] font-semibold text-zinc-50" style={{ background: plan.accent }}>
                {plan.cta_label}
              </button>
            </div>
          );
        })}
      </div>
      <div className="rounded-2xl border border-white/[0.08]">
        {Object.entries(byCategory).map(([cat, feats]) => (
          <div key={cat}>
            <div className="border-b border-t border-white/[0.06] bg-white/[0.02] px-4 py-2 text-[10.5px] font-bold uppercase tracking-wider text-zinc-400">{cat}</div>
            {feats.map((f) => (
              <div key={f.id} className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center border-b border-white/[0.04] px-4 py-2.5 text-[12px]">
                <span className="text-zinc-200">{f.label}</span>
                {(["free", "premium", "max"] as const).map((tier) => {
                  const v = f[tier];
                  return (
                    <span key={tier} className="text-center">
                      {v === true ? <Check className="mx-auto size-3.5 text-emerald-300" /> : v === false ? <Lock className="mx-auto size-3 text-zinc-700" /> : <span className="text-zinc-300">{v}</span>}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
      <PromoCodeBanner />
    </main>
  );
}

/* ─── Design C : SOCIAL PROOF + URGENCY ────────────────────────────── */

function DesignSocial() {
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/[0.08] px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider text-amber-200">
          <Clock className="size-3" />
          Promo lancement : −20 % avec LAUNCH20 jusqu'au 31 mai
        </span>
      </div>
      <div className="text-center">
        <h1 className="font-display text-5xl font-bold tracking-tight">
          Rejoins les <span className="bg-gradient-to-br from-violet-300 to-cyan-300 bg-clip-text text-transparent">2 400+ investisseurs</span> qui suivent leurs sés sur Mettrik.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[14.5px] text-zinc-400">
          Données officielles, scoring transparent, alertes intelligentes. Sans bullshit.
        </p>
      </div>
      <div className="my-8 flex flex-wrap justify-center gap-3 text-[11.5px] text-zinc-300">
        <TrustBadge icon={<Shield className="size-3 text-emerald-300" />} label="Garantie 30 jours" />
        <TrustBadge icon={<Zap className="size-3 text-cyan-300" />} label="Annulation 1 clic" />
        <TrustBadge icon={<Users className="size-3 text-violet-300" />} label="2 400+ utilisateurs" />
        <TrustBadge icon={<Star className="size-3 text-amber-300" />} label="4.7/5 (Trustpilot)" />
      </div>
      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.02] p-1">
          {(["monthly", "annual"] as const).map((b) => (
            <button key={b} type="button" onClick={() => setBilling(b)}
              className={`rounded-full px-4 py-1.5 text-[12px] font-semibold transition-colors ${billing === b ? "bg-violet-500 text-zinc-50" : "text-zinc-400"}`}>
              {b === "monthly" ? "Mensuel" : "Annuel"} {b === "annual" && <span className="ml-1 text-[10px] text-emerald-300">−33 %</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const display = billing === "annual" ? monthlyEquivalent(plan) : plan.price_monthly_eur;
          const isHighlight = plan.highlight;
          return (
            <div key={plan.tier}
              className={`relative overflow-hidden rounded-3xl ${isHighlight ? "border-2 bg-gradient-to-br from-violet-500/[0.10] to-cyan-500/[0.05] shadow-2xl shadow-violet-500/15" : "border border-white/[0.08] bg-white/[0.02]"}`}
              style={isHighlight ? { borderColor: `${plan.accent}aa` } : {}}>
              {isHighlight && (
                <div className="absolute right-0 top-0 rounded-bl-2xl bg-violet-500 px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-zinc-50">
                  ★ Plus populaire
                </div>
              )}
              <div className="p-7">
                <h3 className="font-display text-[24px] font-bold" style={{ color: plan.accent }}>{plan.name}</h3>
                <p className="mt-1.5 text-[12.5px] text-zinc-400">{plan.audience}</p>
                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="font-display text-[44px] font-bold leading-none">{display === 0 ? "0" : display.toFixed(2).replace(".", ",")}</span>
                  <span className="text-[14px] text-zinc-400">€</span>
                  <span className="ml-1 text-[12px] text-zinc-500">/mois</span>
                </div>
                {billing === "annual" && plan.price_monthly_eur > 0 && (
                  <p className="mt-1 text-[11px] text-emerald-300">Économise {Math.round((plan.price_monthly_eur * 12) - plan.price_annual_eur)} € / an</p>
                )}
                <button type="button"
                  className={`mt-5 w-full rounded-xl px-4 py-3 text-[14.5px] font-bold transition-colors ${isHighlight ? "text-zinc-50" : "border border-white/15 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.07]"}`}
                  style={isHighlight ? { background: plan.accent } : {}}>
                  {plan.cta_label} <ArrowRight className="ml-1 inline size-4" />
                </button>
              </div>
              <div className="border-t border-white/[0.06] bg-black/20 p-5">
                <ul className="space-y-2 text-[12.5px] text-zinc-300">
                  {topFeatures(plan.tier).slice(0, 5).map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0" style={{ color: plan.accent }} />{f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          { name: "Marc D.", role: "Family Office, Lyon", quote: "Mettrik m'a fait gagner 4h par semaine sur le scoring de mes lignes." },
          { name: "Sarah L.", role: "Conseillère patrimoniale", quote: "Enfin un outil qui me dit ce que je dois savoir sans noyer dans les chiffres." },
          { name: "Antoine R.", role: "Premium particulier", quote: "Les alertes de risque m'ont sauvé 8000 € en 6 mois." },
        ].map((t) => (
          <div key={t.name} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-2 flex gap-0.5 text-amber-300">
              {Array.from({ length: 5 }).map((_, i) => (<Star key={i} className="size-3.5 fill-amber-300" />))}
            </div>
            <p className="text-[12.5px] italic leading-relaxed text-zinc-200">« {t.quote} »</p>
            <div className="mt-2 text-[11px] text-zinc-500">{t.name} · {t.role}</div>
          </div>
        ))}
      </div>
      <PromoCodeBanner />
    </main>
  );
}

/* ─── Composants partagés ──────────────────────────────────────────── */

function TrustBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5">
      {icon}{label}
    </span>
  );
}

function topFeatures(tier: "free" | "premium" | "max"): string[] {
  if (tier === "free") return ["Google + Meta accès complet", "Comparaison Google ↔ Meta", "Tous les indicateurs", "2 favoris", "Sans CB"];
  if (tier === "premium") return ["1 000+ sociétés", "Citations dirigeants", "Risques + gouvernance + IA", "Calendrier résultats", "5 alertes email"];
  return ["Tout Premium, et :", "Favoris illimités", "Alertes illimitées", "Historique 10 + 20 ans", "Export PDF + CSV", "Accès API"];
}

/**
 * Code promo placement : EN BAS de la page (best practice US 2024).
 * Afficher en haut crée la friction "j'attends d'avoir un code mieux".
 */
function PromoCodeBanner() {
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState(false);
  return (
    <section className="mx-auto mt-16 max-w-2xl">
      <details className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <summary className="flex cursor-pointer items-center justify-between text-[12.5px] font-semibold text-zinc-300">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-violet-300" />J'ai un code promotionnel
          </span>
          <ChevronDown className="size-4 text-zinc-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-4 flex items-stretch gap-2">
          <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ex : LAUNCH20"
            className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[13px] uppercase tracking-wider text-zinc-100 placeholder:text-zinc-600" />
          <button type="button" onClick={() => setApplied(true)} disabled={!code}
            className="rounded-lg bg-violet-500 px-4 py-2 text-[12.5px] font-bold text-zinc-50 disabled:opacity-50">Appliquer</button>
        </div>
        {applied && (<p className="mt-2 text-[11.5px] text-emerald-300">✅ Code «{code}» appliqué (mock)</p>)}
      </details>
    </section>
  );
}

function FaqShort() {
  const items = [
    { q: "Comment annuler ?", a: "1 clic depuis ton compte, à tout moment, sans question." },
    { q: "Y a-t-il un essai gratuit ?", a: "Le plan Gratuit est gratuit à vie, sans CB. C'est mieux qu'un essai limité." },
    { q: "Puis-je changer de plan ?", a: "Oui à tout moment, prorata calculé automatiquement." },
    { q: "TVA incluse ?", a: "Oui, prix TTC, facturé par R consulting (Suisse, hors TVA)." },
  ];
  return (
    <section className="mx-auto mt-12 max-w-2xl">
      <h3 className="mb-4 text-center font-display text-[20px] font-bold tracking-tight">Questions fréquentes</h3>
      <div className="space-y-2">
        {items.map((it) => (
          <details key={it.q} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[13px]">
            <summary className="cursor-pointer font-semibold text-zinc-100">{it.q}</summary>
            <p className="mt-1.5 text-zinc-400">{it.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
