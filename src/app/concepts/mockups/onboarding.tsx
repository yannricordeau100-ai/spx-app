"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, Star, BarChart3, Mail } from "lucide-react";

/**
 * MOCKUP — Onboarding 4 étapes après signup.
 * Sert à montrer la valeur tout de suite, sans laisser le user perdu.
 */

const STEPS = [
  {
    icon: Sparkles,
    title: "Bienvenue sur Mettrik",
    description: "Découvre des sociétés du S&P 500 lues, scorées, comparées pour toi. Pas besoin de lire 200 pages de 10-K.",
    cta: "Commencer la visite",
  },
  {
    icon: BarChart3,
    title: "Une page société, c'est quoi ?",
    description: "Chaque société a 5-12 KPIs scorés (qualité 1-10), des risques notés (1-5), une analyse IA et des sources sourcées. Tu cliques un KPI, il devient le KPI principal et tu vois son histoire.",
    cta: "Visiter une page (GOOGL en démo)",
  },
  {
    icon: Star,
    title: "Garde tes sociétés favorites",
    description: "Click ⭐ sur la page d'une société pour l'ajouter à ta watchlist. Tu peux la suivre ensuite depuis ton compte.",
    cta: "Compris",
  },
  {
    icon: Mail,
    title: "Reçois ton digest hebdomadaire",
    description: "Chaque vendredi à 8h : un email résumant les variations clés des KPIs des sociétés que tu suis, en 2 minutes de lecture.",
    cta: "Activer le digest",
  },
];

export function MockupOnboarding() {
  const [step, setStep] = useState(0);
  const s = STEPS[step];

  return (
    <div className="min-h-screen bg-[#050507]">
      <div className="mb-4 mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3 text-[12px] text-amber-200">
          ⚠️ <strong>Mockup interactif</strong> — flow d'onboarding 4 étapes après signup. Click sur les flèches pour naviguer.
        </div>
      </div>

      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-16 sm:px-6">
        {/* Progress dots */}
        <div className="mb-10 flex gap-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-10 bg-violet-400" : i < step ? "w-1.5 bg-emerald-500" : "w-1.5 bg-white/10"}`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="w-full rounded-3xl border border-white/8 bg-white/[0.02] p-10 text-center backdrop-blur">
          <div className="inline-flex size-16 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/10">
            <s.icon className="size-8 text-violet-300" />
          </div>
          <h2 className="mt-6 font-display text-[28px] font-bold tracking-tight text-zinc-50">{s.title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-[14px] text-zinc-300">{s.description}</p>
          <button className="mt-7 inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-violet-400">
            {s.cta}
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Step navigation */}
        <div className="mt-8 flex items-center gap-3">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12.5px] text-zinc-300 transition-colors hover:bg-white/[0.07] disabled:opacity-30"
          >
            <ChevronLeft className="size-3.5" />Précédent
          </button>
          <span className="text-[11px] text-zinc-500">Étape {step + 1} / {STEPS.length}</span>
          <button
            onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))}
            disabled={step === STEPS.length - 1}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12.5px] text-zinc-300 transition-colors hover:bg-white/[0.07] disabled:opacity-30"
          >
            Suivant<ChevronRight className="size-3.5" />
          </button>
          <button className="ml-3 text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline">
            Passer l'intro
          </button>
        </div>
      </div>
    </div>
  );
}
