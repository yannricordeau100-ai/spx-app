"use client";

import { Sparkles, BarChart3, Eye, Shield, Check, ArrowRight } from "lucide-react";

/**
 * MOCKUP — Landing page marketing publique.
 * Servirait à expliquer Mettrik aux visiteurs avant qu'ils s'inscrivent.
 */

export function MockupLanding() {
  return (
    <div className="bg-gradient-to-b from-[#050507] via-[#0a0a14] to-[#050507]">
      <div className="mb-4 mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3 text-[12px] text-amber-200">
          ⚠️ <strong>Mockup statique</strong> : landing page marketing à intégrer en remplacement de la home actuelle (qui est directement la liste des sociétés).
        </div>
      </div>

      {/* HERO */}
      <section className="relative overflow-hidden px-4 py-20 sm:px-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(167,139,250,0.18),transparent)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[11px] text-violet-200">
            <Sparkles className="size-3" />
            KPI Intelligence pour investisseurs
          </div>
          <h1 className="font-display text-[42px] font-bold leading-tight tracking-tight text-zinc-50 sm:text-[56px]">
            Chaque KPI lu, interprété,
            <br />
            <span className="bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">
              instantanément comparable.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[16px] text-zinc-300">
            Mettrik extrait, score et compare les KPIs des 100 plus grandes sociétés cotées. Plus besoin de lire 200 pages de 10-K : on l'a fait pour vous, et on vous dit ce qui compte vraiment.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-violet-400">
              Essayer gratuitement
              <ArrowRight className="size-4" />
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.03] px-5 py-2.5 text-[14px] font-medium text-zinc-200 transition-colors hover:bg-white/[0.07]">
              Voir une société (GOOGL)
            </button>
          </div>
          <div className="mt-4 text-[11px] text-zinc-500">
            Sans carte bancaire · Accès gratuit à GOOGL et META
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-zinc-500">Ils utilisent Mettrik</div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 opacity-60">
            <span className="text-[13px] font-semibold text-zinc-400">baggr.fr</span>
            <span className="text-[13px] font-semibold text-zinc-400">iq-invest</span>
            <span className="text-[13px] font-semibold text-zinc-400">family office X</span>
            <span className="text-[13px] font-semibold text-zinc-400">VC Y</span>
            <span className="text-[13px] font-semibold text-zinc-400">analyste Z</span>
          </div>
        </div>
      </section>

      {/* 3 COL VALUE PROP */}
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          {[
            { icon: BarChart3, title: "KPIs scorés", desc: "Score qualité 1-10 par KPI, basé sur cohérence avec la guidance, écart vs pairs, momentum sur 5 ans." },
            { icon: Eye, title: "Risques tracés", desc: "Chaque facteur de risque du 10-K extrait, scoré 1-5 selon position, intensité du langage, tendance et catégorie." },
            { icon: Shield, title: "Honnête sur les sources", desc: "Lien vers le 10-K source, date de la donnée, indicateur freshness. Pas de chiffre inventé." },
          ].map((c) => (
            <div key={c.title} className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
              <c.icon className="size-6 text-violet-300" />
              <h3 className="mt-3 text-[16px] font-semibold text-zinc-100">{c.title}</h3>
              <p className="mt-1.5 text-[13px] text-zinc-400">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING TEASER */}
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-[32px] font-bold tracking-tight text-zinc-50">Forfaits</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 text-left">
              <div className="text-[12px] font-mono uppercase text-zinc-500">Free</div>
              <div className="mt-2 text-[28px] font-bold">0 €</div>
              <ul className="mt-3 space-y-1 text-[12px] text-zinc-300">
                <li className="flex gap-2"><Check className="size-3 mt-1 text-emerald-400" />GOOGL + META complet</li>
                <li className="flex gap-2"><Check className="size-3 mt-1 text-emerald-400" />Comparaison entre les 2</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-violet-500/40 bg-violet-500/[0.06] p-5 text-left">
              <div className="text-[12px] font-mono uppercase text-violet-300">Premium</div>
              <div className="mt-2 text-[28px] font-bold">24,90 €<span className="text-[14px] font-normal text-zinc-400"> / mois</span></div>
              <ul className="mt-3 space-y-1 text-[12px] text-zinc-300">
                <li className="flex gap-2"><Check className="size-3 mt-1 text-emerald-400" />Toutes sociétés couvertes</li>
                <li className="flex gap-2"><Check className="size-3 mt-1 text-emerald-400" />Comparaison N-vs-N</li>
                <li className="flex gap-2"><Check className="size-3 mt-1 text-emerald-400" />Watchlists + alertes</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 text-left">
              <div className="text-[12px] font-mono uppercase text-zinc-500">Enterprise / API</div>
              <div className="mt-2 text-[20px] font-bold text-zinc-300">Sur devis</div>
              <ul className="mt-3 space-y-1 text-[12px] text-zinc-300">
                <li className="flex gap-2"><Check className="size-3 mt-1 text-emerald-400" />API complète</li>
                <li className="flex gap-2"><Check className="size-3 mt-1 text-emerald-400" />Multi-utilisateurs</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 px-4 py-8 text-center text-[11px] text-zinc-600 sm:px-6">
        Mettrik AI · KPI Intelligence · Le contenu de ce site ne constitue pas un conseil en investissement.
      </footer>
    </div>
  );
}
