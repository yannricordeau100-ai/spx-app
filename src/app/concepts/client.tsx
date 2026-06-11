"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Mail, BarChart3, Search, Tag, Sliders, Layers, Home, Sparkles, AtSign, LineChart, Activity, Coins } from "lucide-react";
import { TICKERS } from "@/lib/data";
import { CONCEPT_COMPANIES as COMPANIES, getConceptCompany as getCompany } from "@/lib/concepts-data";
import { brand } from "@/lib/brand";
import { CompanyLogo } from "@/components/logos";
import { EmailLabClient } from "@/app/email-lab/client";
import { ChartLabContent } from "@/app/chart-lab/[ticker]/content";
import { MockupScreener } from "./mockups/screener";
import { MockupDividend } from "./mockups/dividend";
import { MockupCompareN } from "./mockups/compare-n";
import { MockupLanding } from "./mockups/landing";
import { MockupOnboarding } from "./mockups/onboarding";
import { MockupEmailTemplates } from "./mockups/email-templates";
import { MockupHeaderBarRedesign } from "./mockups/header-bar-redesign";
import { MockupPriceChartTests } from "./mockups/price-chart-tests";

type Tab =
  | "email" | "chart"
  | "mk-screener" | "mk-compare" | "mk-landing" | "mk-onboarding" | "mk-email-templates"
  | "mk-header-bar" | "mk-price-chart" | "mk-dividend";

const TABS: { id: Tab; label: string; Icon: typeof Mail; group?: "visuels" | "mockups" }[] = [
  { id: "email", label: "Email", Icon: Mail, group: "visuels" },
  { id: "chart", label: "Chart", Icon: BarChart3, group: "visuels" },
  { id: "mk-dividend", label: "Dividende", Icon: Coins, group: "mockups" },
  { id: "mk-email-templates", label: "Email templates", Icon: AtSign, group: "mockups" },
  { id: "mk-screener", label: "Screener", Icon: Sliders, group: "mockups" },
  { id: "mk-compare", label: "Compare N-vs-N", Icon: Layers, group: "mockups" },
  { id: "mk-landing", label: "Landing", Icon: Home, group: "mockups" },
  { id: "mk-onboarding", label: "Onboarding", Icon: Sparkles, group: "mockups" },
  { id: "mk-header-bar", label: "Header bar (variation %)", Icon: LineChart, group: "mockups" },
  { id: "mk-price-chart", label: "Mini chart prix", Icon: Activity, group: "mockups" },
];

export function ConceptsClient() {
  const [tab, setTab] = useState<Tab>("mk-dividend");
  const [ticker, setTicker] = useState<string>("META");
  const [query, setQuery] = useState<string>("");
  const [searchOpen, setSearchOpen] = useState<boolean>(false);

  const company = useMemo(() => getCompany(ticker), [ticker]);
  const filteredTickers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TICKERS;
    return TICKERS.filter((t) => {
      const c = COMPANIES[t];
      return (
        t.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.sector.toLowerCase().includes(q) ||
        (c.subsector ?? "").toLowerCase().includes(q)
      );
    });
  }, [query]);

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      {/* HEADER */}
      <div className="sticky top-0 z-30 border-b border-white/8 bg-[#050507]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            {/* /concepts est isolé : pas de lien retour vers l'app
                principale (la home Mettrik). Univers prototype séparé. */}
            <h1 className="font-display text-[17px] font-bold tracking-tight text-zinc-50">
              Concepts
            </h1>
            <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-violet-200">
              hub
            </span>
            <Link
              href="/concepts/pricing"
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11.5px] font-medium text-amber-200 transition-colors hover:border-amber-500/45 hover:bg-amber-500/15"
              title="Concept pricing"
            >
              <Tag className="size-3.5" />
              Pricing
            </Link>
            <Link
              href="/concepts/charts-news"
              className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/25 bg-violet-500/10 px-2.5 py-1 text-[11.5px] font-medium text-violet-200 transition-colors hover:border-violet-500/45 hover:bg-violet-500/15"
              title="3 styles charts × NVDA volatile + CAT stable"
            >
              <Tag className="size-3.5" />
              Charts
            </Link>
            <Link
              href="/concepts/charts-bars"
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11.5px] font-medium text-emerald-200 transition-colors hover:border-emerald-500/45 hover:bg-emerald-500/15"
              title="8 nouveaux styles de barres (4 néon + 4 sobres, 2D et 3D)"
            >
              <Tag className="size-3.5" />
              Barres 2D/3D
            </Link>
            <Link
              href="/concepts/logos"
              className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 text-[11.5px] font-medium text-cyan-200 transition-colors hover:border-cyan-500/45 hover:bg-cyan-500/15"
              title="8 protos logos Mettrik (horizontal + carré)"
            >
              <Tag className="size-3.5" />
              Logos
            </Link>
          </div>

          {/* TAB SWITCHER — 2 groupes : visuels (existants) + mockups (nouveaux) */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
              {TABS.filter((t) => t.group === "visuels").map((t) => {
                const isActive = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-all ${
                      isActive
                        ? "bg-violet-500/25 text-violet-100 shadow-[0_0_12px_rgba(167,139,250,0.35)]"
                        : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
                    }`}
                  >
                    <t.Icon className="size-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>
            <span className="text-zinc-600">·</span>
            <div className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/[0.04] p-1">
              {TABS.filter((t) => t.group === "mockups").map((t) => {
                const isActive = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    title={`Mockup : ${t.label}`}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-all ${
                      isActive
                        ? "bg-amber-500/25 text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.35)]"
                        : "text-amber-300/70 hover:bg-amber-500/10 hover:text-amber-100"
                    }`}
                  >
                    <t.Icon className="size-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SEARCH */}
          <div className="relative">
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[12.5px] text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white"
            >
              <Search className="size-3.5" />
              <span className="font-mono text-[11px] text-zinc-500">Rechercher :</span>
              <span className="font-mono font-semibold" style={{ color: brand(ticker).primary }}>
                {ticker}
              </span>
            </button>
            {searchOpen && (
              <>
                <button
                  onClick={() => setSearchOpen(false)}
                  className="fixed inset-0 z-30 cursor-default"
                  aria-label="Fermer recherche"
                />
                <div className="absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0c] shadow-2xl backdrop-blur-md">
                  <div className="border-b border-white/8 p-2">
                    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5">
                      <Search className="size-3.5 text-zinc-500" />
                      <input
                        autoFocus
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Ticker, nom, secteur..."
                        className="flex-1 bg-transparent text-[12.5px] text-zinc-100 placeholder-zinc-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto p-1">
                    {filteredTickers.length === 0 && (
                      <div className="px-3 py-4 text-center text-[12px] text-zinc-500">
                        Aucune société trouvée
                      </div>
                    )}
                    {filteredTickers.map((t) => {
                      const c = COMPANIES[t];
                      const isActive = ticker === t;
                      return (
                        <button
                          key={t}
                          onClick={() => {
                            setTicker(t);
                            setSearchOpen(false);
                            setQuery("");
                          }}
                          className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors ${
                            isActive
                              ? "bg-violet-500/15 text-violet-100"
                              : "text-zinc-200 hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className="size-8 shrink-0 rounded-md border border-white/10 bg-white/[0.03] p-1">
                            <CompanyLogo ticker={t} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider"
                                style={{ color: brand(t).primary }}>
                                {t}
                              </span>
                              <span className="text-[13px] font-medium">{c.name}</span>
                            </div>
                            <div className="text-[10.5px] text-zinc-500 truncate">
                              {c.sector} · {c.subsector}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* MAIN — pleine largeur, le contenu de chaque panel gère son propre padding */}
      <div>
        {tab === "email" && <EmailLabClient />}
        {tab === "chart" && (
          <ChartLabContent ticker={ticker} showHeader={false} showNavChrome={true} />
        )}
        {tab === "mk-dividend" && <MockupDividend />}
        {tab === "mk-screener" && <MockupScreener />}
        {tab === "mk-compare" && <MockupCompareN />}
        {tab === "mk-landing" && <MockupLanding />}
        {tab === "mk-onboarding" && <MockupOnboarding />}
        {tab === "mk-email-templates" && <MockupEmailTemplates />}
        {tab === "mk-header-bar" && company && <MockupHeaderBarRedesign company={company} />}
        {tab === "mk-price-chart" && company && <MockupPriceChartTests company={company} />}
      </div>
    </div>
  );
}
