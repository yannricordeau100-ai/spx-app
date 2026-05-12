import Link from "next/link";
import { CreditCard, FlaskConical, Library, Sparkles, Globe2, Database, Tag, FileEdit } from "lucide-react";
import { CONCEPT_COMPANIES } from "@/lib/concepts-data";
import { CompanyLogo } from "@/components/logos";
import { brand } from "@/lib/brand";

export const metadata = {
  title: "Sandbox · Mettrik",
  robots: { index: false, follow: false },
};

const ITEMS = [
  {
    href: "/sandbox/billing",
    icon: CreditCard,
    label: "Billing test",
    desc: "Test du flow Stripe Checkout en mode test (carte 4242…). Webhook + table subscriptions internes.",
  },
  {
    href: "/concepts",
    icon: FlaskConical,
    label: "Concepts (visuels)",
    desc: "Hub des prototypes visuels : Email lab, Chart lab, modes Clair 1/2/3.",
  },
  {
    href: "/desk-mtk9x4kp",
    icon: Library,
    label: "Desk interne",
    desc: "Bureau de travail privé : notes, todos, GICS, pipeline V2, etc. Accès restreint.",
  },
  {
    href: "/desk-mtk9x4kp/pricing",
    icon: Tag,
    label: "Réglage pricing",
    desc: "Back office tarifs : plans, prix multi-devises, fonctionnalités, codes promo, sync Stripe.",
  },
  {
    href: "/desk-mtk9x4kp/page-content?page=home",
    icon: FileEdit,
    label: "Édition textes home",
    desc: "Modifier tagline, sous-titre, KPI Intelligence et 4 punchlines rotatives de la page d'accueil V1.8.",
  },
];

/* ─────────────────────────────────────────────────────────────── */
/* Bloc V1 — App actuelle, 5 sociétés handcrafted depuis 10-K PDF   */
/* ─────────────────────────────────────────────────────────────── */
const V1_TICKERS = ["META", "GOOGL", "MSCI", "SPGI", "CAT"];

/* ─────────────────────────────────────────────────────────────── */
/* Bloc V1.5 cat 2 — FPI (étrangères cotées US via ADR), pipeline      */
/* en attente d'extraction KPI. Liste preview de 10 candidates.      */
/* ─────────────────────────────────────────────────────────────── */
type FPICandidate = {
  ticker: string;
  name: string;
  country: string;
  sector: string;
  currency: string;
  filing: "20-F";
};

const V2_CAT2_CANDIDATES: FPICandidate[] = [
  { ticker: "TSM",  name: "Taiwan Semiconductor", country: "TW", sector: "Semiconductors",   currency: "TWD", filing: "20-F" },
  { ticker: "ASML", name: "ASML Holding",          country: "NL", sector: "Semiconductors",   currency: "EUR", filing: "20-F" },
  { ticker: "NVO",  name: "Novo Nordisk",          country: "DK", sector: "Pharma",           currency: "DKK", filing: "20-F" },
  { ticker: "BABA", name: "Alibaba Group",         country: "CN", sector: "E-commerce/Cloud", currency: "CNY", filing: "20-F" },
  { ticker: "SAP",  name: "SAP SE",                country: "DE", sector: "Software",         currency: "EUR", filing: "20-F" },
  { ticker: "SHEL", name: "Shell plc",             country: "UK", sector: "Energy",           currency: "USD", filing: "20-F" },
  { ticker: "TM",   name: "Toyota Motor",          country: "JP", sector: "Auto",             currency: "JPY", filing: "20-F" },
  { ticker: "SE",   name: "Sea Limited",           country: "SG", sector: "Internet",         currency: "USD", filing: "20-F" },
  { ticker: "HSBC", name: "HSBC Holdings",         country: "UK", sector: "Banks",            currency: "USD", filing: "20-F" },
  { ticker: "BP",   name: "BP plc",                country: "UK", sector: "Energy",           currency: "USD", filing: "20-F" },
];

export default function SandboxPage() {
  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-8 flex items-baseline gap-3">
          <Sparkles className="size-5 text-violet-300" />
          <h1 className="font-display text-[28px] font-bold tracking-tight">Sandbox</h1>
          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-violet-200">
            isolé de l&apos;app prod
          </span>
        </div>
        <p className="mb-8 max-w-2xl text-[14px] text-zinc-400">
          Environnement de prototypage. Tout ce qui est dev ici (paiement, paywall, nouveaux modules)
          ne touche pas la vraie app tant que le code n&apos;est pas explicitement promu.
        </p>

        {/* ═══════ DATASETS V1 + V2 ═══════ */}
        <section className="mb-10">
          <h2 className="mb-1 font-display text-[18px] font-bold tracking-tight text-zinc-100">
            Datasets — V1 actuelle vs V1.5 cat 2 (FPI)
          </h2>
          <p className="mb-5 text-[12.5px] text-zinc-400">
            Comparaison des deux datasets : la V1 live (5 sociétés handcrafted depuis 10-K PDF)
            et la V1.5 cat 2 (FPI étrangères cotées US, pipeline d&apos;extraction KPI à venir).
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* ─────────────── BLOC V1 ─────────────── */}
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-5">
              <div className="mb-3 flex items-baseline gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  <Database className="size-4" />
                </div>
                <div>
                  <h3 className="font-display text-[15.5px] font-bold text-zinc-50">V1 · App live (5 sociétés)</h3>
                  <p className="text-[11.5px] text-zinc-400">
                    Données extraites manuellement depuis 10-K PDF. KPI handcrafted, hero choisi, market positions, risks, governance, AI positioning.
                  </p>
                </div>
              </div>

              <ul className="mt-4 grid gap-1.5 sm:grid-cols-1">
                {V1_TICKERS.map((t) => {
                  const c = CONCEPT_COMPANIES[t];
                  if (!c) return null;
                  const accent = brand(t).primary;
                  return (
                    <li key={t}>
                      <Link
                        href={`/${t.toLowerCase()}`}
                        className="group flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 transition-colors hover:border-emerald-500/30 hover:bg-white/[0.05]"
                      >
                        <div className="size-7 shrink-0 rounded-md border border-white/10 bg-white/[0.03] p-1">
                          <CompanyLogo ticker={t} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
                              {t}
                            </span>
                            <span className="text-[12.5px] font-medium text-zinc-100">{c.name}</span>
                          </div>
                          <div className="text-[10.5px] text-zinc-500">
                            {c.kpis.length} KPI · {c.kpis.filter((k) => k.is_short_history).length} stories · {c.sector}
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-emerald-300/70 group-hover:text-emerald-200">→ /{t.toLowerCase()}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 rounded-md border border-emerald-500/15 bg-emerald-500/[0.04] p-2.5 text-[11px] text-emerald-200/80">
                Status : ✓ live · KPI Hero + Indicateurs clés + Stories tagués · ordre d&apos;affichage figé
              </div>
            </div>

            {/* ─────────────── BLOC V1.5 cat 2 ─────────────── */}
            {/* Collapsible : header + boutons toujours visibles, détails (liste FPI
                + adaptations) dans un <details>. Économise ~70% de hauteur par défaut. */}
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-5">
              <div className="mb-3 flex items-baseline gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300">
                  <Globe2 className="size-4" />
                </div>
                <div>
                  <h3 className="font-display text-[15.5px] font-bold text-zinc-50">V1.5 cat 2 · FPI étrangères</h3>
                  <p className="text-[11.5px] text-zinc-400">
                    1 652 sociétés étrangères cotées US (ADR), 20-F + 6-K téléchargés. Pipeline d&apos;extraction KPI à exécuter.
                  </p>
                </div>
              </div>

              <details className="group mt-3 rounded-md border border-amber-500/15 bg-amber-500/[0.04] open:bg-amber-500/[0.06]">
                <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-[11px] font-mono uppercase tracking-wider text-amber-200/80 hover:text-amber-100">
                  <span>Voir les 10 candidates + adaptations vs US</span>
                  <span className="transition-transform group-open:rotate-180">▾</span>
                </summary>
                <div className="px-3 pb-3 pt-1">
                  <ul className="mt-2 grid gap-1.5">
                    {V2_CAT2_CANDIDATES.map((c) => (
                      <li key={c.ticker} className="flex items-center gap-3 rounded-md border border-white/8 bg-white/[0.02] px-3 py-2">
                        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded border border-white/10 bg-white/[0.03] font-mono text-[10px] font-bold uppercase text-zinc-300">
                          {c.country}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                              {c.ticker}
                            </span>
                            <span className="text-[12.5px] font-medium text-zinc-100">{c.name}</span>
                          </div>
                          <div className="text-[10.5px] text-zinc-500">
                            {c.sector} · devise {c.currency} · {c.filing}
                          </div>
                        </div>
                        <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] uppercase text-amber-300">
                          pipeline·todo
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[11px] text-zinc-500">
                    <strong className="text-amber-200">50 sociétés FPI</strong> implémentées dans la sandbox V1.5 (10 raffinées + 11 enrichies + 29 minimales).
                    + 1 602 autres FPI disponibles dans <code className="text-zinc-400">cat2-foreign-adr/</code> à activer.
                  </p>
                  <div className="mt-3 space-y-1.5 text-[11px] text-amber-100/80">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-amber-300/70">Adaptations vs US :</div>
                    <ul className="list-inside list-disc space-y-0.5 pl-1">
                      <li>20-F annuel → équivalent 10-K, parser dédié</li>
                      <li>6-K + IR direct → quarterly reconstitué, partiel</li>
                      <li>Pas de DEF 14A ni Forms 3/4/5 (insider)</li>
                      <li>Conversion devise (TWD/EUR/JPY/CNY/DKK)</li>
                      <li>Bloc Stories prioritaire si history &lt; 5 ans</li>
                    </ul>
                  </div>
                </div>
              </details>

              <div className="mt-4 grid gap-2">
                <Link
                  href="/"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/15 px-4 py-2.5 font-mono text-[11.5px] font-semibold uppercase tracking-wider text-violet-100 transition-all hover:border-violet-500/70 hover:bg-violet-500/25"
                >
                  Ouvrir 1.0 (5 sociétés handcrafted · GOOGL META MSCI SPGI CAT)
                  <span className="text-base">→</span>
                </Link>
                <Link
                  href="/sandbox/v2"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/15 px-4 py-2.5 font-mono text-[11.5px] font-semibold uppercase tracking-wider text-amber-100 transition-all hover:border-amber-500/70 hover:bg-amber-500/25"
                >
                  Ouvrir 1.5 (50 sociétés DRAFT seed)
                  <span className="text-base">→</span>
                </Link>
                <Link
                  href="/sandbox/v1-6"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-4 py-2.5 font-mono text-[11.5px] font-semibold uppercase tracking-wider text-cyan-100 transition-all hover:border-cyan-500/70 hover:bg-cyan-500/25"
                >
                  Ouvrir 1.6 (toutes stés extraites · 1606)
                  <span className="text-base">→</span>
                </Link>
                <Link
                  href="/sandbox/v1-7"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-4 py-2.5 font-mono text-[11.5px] font-semibold uppercase tracking-wider text-emerald-100 transition-all hover:border-emerald-500/80 hover:bg-emerald-500/30"
                >
                  Ouvrir 1.7 (Pass 3 strict, fiches complètes)
                  <span className="text-base">→</span>
                </Link>
                <Link
                  href="/sandbox/v1-8"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/50 bg-rose-500/15 px-4 py-2.5 font-mono text-[11.5px] font-semibold uppercase tracking-wider text-rose-100 transition-all hover:border-rose-500/80 hover:bg-rose-500/25"
                >
                  Ouvrir 1.8 (Pass 3 + blocs manquants en rouge)
                  <span className="text-base">→</span>
                </Link>
                <Link
                  href="/sandbox/data-status"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-500/50 bg-violet-500/15 px-4 py-2.5 font-mono text-[11.5px] font-semibold uppercase tracking-wider text-violet-100 transition-all hover:border-violet-500/80 hover:bg-violet-500/25"
                >
                  Statut des données (qui fait quoi, Pass 3 par cat, audit)
                  <span className="text-base">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════ ITEMS EXISTANTS ═══════ */}
        <section className="mb-10">
          <h2 className="mb-3 font-display text-[15.5px] font-bold tracking-tight text-zinc-100">
            Outils sandbox
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-start gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-violet-500/30 hover:bg-white/[0.04]"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300">
                  <item.icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-semibold text-zinc-50 group-hover:text-violet-200">{item.label}</h3>
                  <p className="mt-1 text-[12.5px] text-zinc-400">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5 text-[12px] text-zinc-400">
          <h3 className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">Architecture</h3>
          <ul className="space-y-1.5">
            <li>• <code className="text-zinc-300">/src/app/sandbox/*</code> : routes isolées, jamais visibles publiquement</li>
            <li>• <code className="text-zinc-300">/src/lib/billing/*</code> : helpers Stripe (réutilisables en prod après promotion)</li>
            <li>• <code className="text-zinc-300">/src/components/billing/*</code> : composants réutilisables (Paywall, etc.)</li>
            <li>• <code className="text-zinc-300">/src/lib/desk/*</code> : helpers desk (auth, GICS taxonomy)</li>
            <li>• Migration SQL : <code className="text-zinc-300">/supabase/migrations/20251127_desk_and_billing.sql</code></li>
            <li>• <code className="text-zinc-300">/sec-data/cat2-foreign-adr/</code> : 1 652 FPI téléchargés (20-F + 6-K), pipeline KPI à activer</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
