import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Star, Building2, BarChart3 } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listCompanyFavorites, listKpiFavorites } from "@/app/favorites/actions";
import { COMPANIES } from "@/lib/data";
import { brand } from "@/lib/brand";

export default async function FavoritesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=signin&next=/account/favorites");

  const sp = await searchParams;
  const tab = sp.tab === "kpis" ? "kpis" : "companies";

  const [companies, kpis] = await Promise.all([
    listCompanyFavorites(),
    listKpiFavorites(),
  ]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[700px] bg-radial-glow" />
      <div className="pointer-events-none absolute inset-0 bg-grid" />

      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Link
          href="/account"
          className="group inline-flex items-center gap-2 text-[13px] text-zinc-400 transition-colors hover:text-zinc-100"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          Retour au compte
        </Link>

        <h1 className="mt-6 flex items-center gap-2.5 text-[28px] font-semibold text-zinc-50">
          <Star className="size-6 fill-amber-300 text-amber-300" strokeWidth={1.5} />
          Mes favoris
        </h1>
        <p className="mt-1 text-[14px] text-zinc-400">
          Sociétés et KPI que tu suis activement. Stockés séparément pour suivre des
          KPI précis sans toute la sté.
        </p>

        {/* Tabs */}
        <div className="mt-6 inline-flex gap-1 rounded-full border border-[#1f1f1f] bg-[#0a0a0a] p-1">
          <Link
            href="/account/favorites?tab=companies"
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              tab === "companies"
                ? "bg-violet-500/20 text-violet-100"
                : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            <Building2 className="size-3.5" />
            Sociétés ({companies.length})
          </Link>
          <Link
            href="/account/favorites?tab=kpis"
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              tab === "kpis"
                ? "bg-violet-500/20 text-violet-100"
                : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            <BarChart3 className="size-3.5" />
            KPIs ({kpis.length})
          </Link>
        </div>

        {/* Content */}
        <div className="mt-6">
          {tab === "companies" ? (
            companies.length === 0 ? (
              <EmptyState
                title="Aucune société en favori"
                description="Clique l'étoile sur une société depuis la page d'accueil pour l'ajouter ici."
                href="/"
                cta="Voir les sociétés"
              />
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {companies.map((f) => {
                  const c = COMPANIES[f.ticker];
                  if (!c) return null;
                  const accent = brand(f.ticker).primary;
                  return (
                    <li key={f.id}>
                      <Link
                        href={`/${f.ticker.toLowerCase()}`}
                        className="block rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4 transition-colors hover:border-[#2a2a2a]"
                      >
                        <div className="font-mono text-xs" style={{ color: accent }}>
                          {f.ticker}
                        </div>
                        <div className="mt-1 text-[15px] font-medium text-zinc-100">
                          {c.name}
                        </div>
                        <div className="mt-1.5 text-[12px] text-zinc-400">
                          {c.sector} · {c.subsector}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )
          ) : kpis.length === 0 ? (
            <EmptyState
              title="Aucun KPI en favori"
              description="Clique l'étoile sur n'importe quelle ligne du tableau KPI ou sur une carte super-KPI pour l'ajouter ici."
              href="/"
              cta="Explorer les KPI"
            />
          ) : (
            <ul className="grid grid-cols-1 gap-3">
              {kpis.map((f) => {
                const c = COMPANIES[f.ticker];
                const accent = brand(f.ticker).primary;
                const kpiName =
                  c?.kpis.find((k) => k.short === f.kpi_short)?.name_fr ?? f.kpi_short;
                return (
                  <li key={f.id}>
                    <Link
                      href={`/${f.ticker.toLowerCase()}`}
                      className="flex items-center gap-3 rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4 transition-colors hover:border-[#2a2a2a]"
                    >
                      <span
                        className="rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider"
                        style={{
                          background: `${accent}1a`,
                          color: accent,
                          border: `1px solid ${accent}33`,
                        }}
                      >
                        {f.kpi_short}
                      </span>
                      <div className="flex-1">
                        <div className="text-[14px] font-medium text-zinc-100">
                          {kpiName}
                          {f.is_super && (
                            <span className="ml-2 rounded-md border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-violet-200">
                              Super
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[12px] text-zinc-400">
                          {c?.name ?? f.ticker} · {f.ticker}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#2a2a2a] bg-[#070707] p-10 text-center">
      <Star className="mx-auto size-8 text-zinc-600" />
      <div className="mt-3 text-[15px] font-semibold text-zinc-100">{title}</div>
      <p className="mt-1 text-[13px] text-zinc-400">{description}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] px-4 py-2 text-[13px] font-medium text-zinc-200 transition-colors hover:border-violet-500/50 hover:text-violet-200"
      >
        {cta}
      </Link>
    </div>
  );
}
