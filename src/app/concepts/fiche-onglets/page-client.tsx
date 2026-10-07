"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import { brand } from "@/lib/brand";
import { FreemiumBlurProvider } from "@/lib/freemium/context";
import { CompanyHeader } from "@/components/company-header";
import { BandeauIpoRecente } from "@/components/young-ipo-warning";
import type { FicheDemo } from "./data";
import { styleParSlug, RAIL_PX, type StyleId } from "./liste";
import { Contenu, ongletsDe } from "./contenu";
import { RailIcones, RailSurvol, RailLegende, RailGroupes, RailProgression, RailFlottant, CartesCompactes } from "./rails";
import { BarreSouligne, BarrePilules, ColonneVerticale, BarreIcones, BarreApplication, GrilleCartes } from "./barres";

function Fiche({ f, style, admin }: { f: FicheDemo; style: StyleId; admin: React.ReactNode }) {
  const onglets = useMemo(() => ongletsDe(f, Boolean(admin)), [f, admin]);
  const [actif, setActif] = useState(onglets[0]?.id ?? "apercu");
  const accent = brand(f.company.ticker).primary;
  const haut = useRef<HTMLDivElement>(null);
  const choisir = (id: string) => {
    setActif(id);
    // Garde la barre en vue : si l'en-tete est sorti de l'ecran, on remonte au debut du contenu.
    const el = haut.current;
    if (el && el.getBoundingClientRect().top < 0 && style !== "app-mobile") el.scrollIntoView({ block: "start" });
  };
  const idx = onglets.findIndex((o) => o.id === actif);
  const x0 = useRef<[number, number] | null>(null);
  const balayage = {
    onTouchStart: (e: React.TouchEvent) => { x0.current = [e.touches[0].clientX, e.touches[0].clientY]; },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = x0.current; x0.current = null;
      if (!s || style !== "app-mobile") return;
      const dx = e.changedTouches[0].clientX - s[0];
      const dy = e.changedTouches[0].clientY - s[1];
      if (Math.abs(dx) < 70 || Math.abs(dy) > 50) return;
      const n = dx < 0 ? idx + 1 : idx - 1;
      if (onglets[n]) setActif(onglets[n].id);
    },
  };
  const barre = { onglets, actif, onChoisir: choisir, accent };
  const corps = (
    <motion.div key={actif} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="min-w-0">
      <Contenu f={f} id={actif} admin={admin} />
    </motion.div>
  );
  return (
    <FreemiumBlurProvider tier="max">
      <CompanyHeader company={f.company} />
      <BandeauIpoRecente ipo={f.company.ipo} />
      <div ref={haut} className="scroll-mt-0" />
      {style === "souligne" && (<><BarreSouligne {...barre} /><div className="mt-6">{corps}</div></>)}
      {style === "pilules" && (<><BarrePilules {...barre} /><div className="mt-6">{corps}</div></>)}
      {style === "icones-compteurs" && (<><BarreIcones {...barre} /><div className="mt-6">{corps}</div></>)}
      {style === "cartes" && (<><GrilleCartes {...barre} /><div className="mt-6">{corps}</div></>)}
      {style === "cartes-compactes" && (<><CartesCompactes {...barre} /><div className="mt-6">{corps}</div></>)}
      {style in RAIL_PX && (
        <>
          {style === "rail-icones" && <RailIcones {...barre} />}
          {style === "rail-survol" && <RailSurvol {...barre} />}
          {style === "rail-legende" && <RailLegende {...barre} />}
          {style === "rail-groupes" && <RailGroupes {...barre} />}
          {style === "rail-progression" && <RailProgression {...barre} />}
          {style === "rail-flottant" && <RailFlottant {...barre} />}
          <div className="mt-6 pb-24 md:pb-0">{corps}</div>
        </>
      )}
      {style === "vertical" && (
        <div className="mt-6 grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          <ColonneVerticale {...barre} />
          {corps}
        </div>
      )}
      {style === "app-mobile" && (
        <>
          <div className="mt-6 pb-28 sm:pb-32" {...balayage}>{corps}</div>
          <BarreApplication {...barre} />
        </>
      )}
    </FreemiumBlurProvider>
  );
}

export function FicheOngletsClient({ style, fiches, adminBlocs = null }: { style: StyleId; fiches: FicheDemo[]; adminBlocs?: Record<string, React.ReactNode> | null }) {
  const meta = styleParSlug(style);
  const [t, setT] = useState(fiches[0]?.ticker ?? "");
  const f = fiches.find((x) => x.ticker === t) ?? fiches[0];
  const [aide, setAide] = useState(true);
  useEffect(() => { setAide(window.innerWidth >= 768); }, []);
  if (!f) return <div className="p-10 text-zinc-400">Aucune société chargée.</div>;
  const glow = brand(f.company.ticker).glow;
  const rail = RAIL_PX[style];
  return (
    <div className="relative min-h-screen bg-[#050505] text-zinc-100 md:pl-[var(--rail,0px)]" style={rail ? ({ "--rail": `${rail}px` } as React.CSSProperties) : undefined}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px]" style={{ background: `radial-gradient(ellipse 80% 50% at 50% -10%, ${glow}, transparent 60%)` }} />
      <main className={`relative px-4 py-6 sm:px-6 sm:py-8 ${rail ? "w-full" : "mx-auto max-w-6xl"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/concepts/fiche-onglets" className="group inline-flex items-center gap-2 text-[12px] text-zinc-500 hover:text-zinc-200">
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            Tous les styles d’onglets
          </Link>
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
            {fiches.map((x) => (
              <button key={x.ticker} type="button" onClick={() => setT(x.ticker)}
                className={`rounded-full px-3.5 py-1 text-[12.5px] font-medium transition-colors ${x.ticker === f.ticker ? "bg-violet-500/25 text-violet-100" : "text-zinc-400 hover:text-zinc-100"}`}>
                {x.company.name} ({x.ticker})
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-violet-400/20 bg-violet-500/[0.04] p-4 sm:p-5">
          <button type="button" onClick={() => setAide((a) => !a)} className="flex w-full items-baseline justify-between gap-3 text-left">
            <span className="font-display text-[20px] font-bold tracking-tight">Style : {meta.nom}</span>
            <span className="shrink-0 text-[11.5px] text-violet-300/80">{aide ? "Masquer" : "Voir l’explication"}</span>
          </button>
          {aide && (
            <div className="mt-2">
              <p className="max-w-3xl text-[13.5px] leading-relaxed text-zinc-300">{meta.explication}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3.5">
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">Points forts</div>
                  <ul className="space-y-1 text-[12.5px] leading-snug text-zinc-300">{meta.forts.map((x) => <li key={x}>+ {x}</li>)}</ul>
                </div>
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-3.5">
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-rose-300">Limites</div>
                  <ul className="space-y-1 text-[12.5px] leading-snug text-zinc-300">{meta.limites.map((x) => <li key={x}>- {x}</li>)}</ul>
                </div>
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-3.5">
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-300">Sur mobile</div>
                  <p className="text-[12.5px] leading-snug text-zinc-300">{meta.mobile}</p>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="mt-6">
          <Fiche key={`${style}-${f.ticker}`} f={f} style={style} admin={adminBlocs?.[f.ticker] ?? null} />
        </div>
      </main>
    </div>
  );
}
