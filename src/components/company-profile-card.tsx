"use client";

import { useState } from "react";
import { Building2, Users, Globe, TrendingUp, TrendingDown, ArrowRight, ExternalLink, Newspaper, Sparkles, BookOpen } from "lucide-react";
import Link from "next/link";
import type { Company } from "@/lib/data";
import { useT } from "@/lib/i18n/provider";

/**
 * Bloc "Profil société & marché" — agrège 4 informations de la sé qui
 * complètent les autres blocs (KPI, risques, gouvernance, etc.) :
 *
 *  1. Présentation longue de la société (company_description, 10-K Item 1).
 *  2. Faits clés (key_facts) : siège, employés, bourse de cotation, ISIN,
 *     industrie, site web officiel.
 *  3. Snapshot boursier (financial_snapshot) : market cap, P/E, EPS, β,
 *     dividende %, plus-haut/plus-bas 52 semaines, variation jour.
 *  4. Sociétés comparables (peers) : 3-5 sés mêmes sub-sector, cliquables.
 *
 * Affichage conditionnel par section : si une section n'a pas de données,
 * elle disparaît silencieusement (pas de placeholder vide). En V1.7 strict
 * la sé n'est admise que si Pass 3, donc au moins description + snapshot
 * devraient être présents.
 *
 * Source de chaque champ documentée dans des tooltips discrets pour
 * l'utilisateur qui veut savoir "d'où ça vient".
 */
export function CompanyProfileCard({ company, accent = "#a78bfa" }: { company: Company; accent?: string }) {
  const { locale } = useT();
  const lang = (locale === "de" ? "de" : locale === "fr" ? "fr" : "en") as "fr" | "en" | "de";
  // Yann 14 mai 2026 : nouvelle description Gemini "PV" en 2 versions
  // (simple + avancée), prioritaire sur l'ancienne `company_description`
  // yfinance qui était générique.
  const mDesc = company.mettrik_description;
  const legacyDesc = company.company_description;
  const snap = company.financial_snapshot;
  const facts = company.key_facts;
  const peers = company.peers;
  const news = company.latest_news;

  const [descMode, setDescMode] = useState<"simple" | "advanced">("simple");

  const hasAnything = mDesc || news || legacyDesc || snap || facts || (peers && peers.length > 0);
  if (!hasAnything) return null;

  return (
    <section id="sec-profile" className="mt-9 scroll-mt-24">
      <div className="mb-3 flex items-baseline justify-between">
        {/* Yann 14 mai 2026 : "Profil société & marché" → "Comprendre la société" */}
        <h2 className="font-display text-[20px] font-bold tracking-tight text-zinc-100">Comprendre la société</h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Source : Mettrik AI + yfinance</span>
      </div>

      {/* Nouveau : Description Mettrik PV (simple / avancée) — toggle */}
      {mDesc && (
        <div className="mb-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-display text-[14px] font-semibold uppercase tracking-wider text-zinc-300">
              <Sparkles className="size-3.5" style={{ color: accent }} />
              Description Mettrik
            </h3>
            {/* Toggle Simple / Avancée */}
            <div className="inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.02] p-0.5">
              <button
                type="button"
                onClick={() => setDescMode("simple")}
                className={
                  "rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider transition-colors " +
                  (descMode === "simple"
                    ? "bg-white/10 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-200")
                }
              >
                Simple
              </button>
              <button
                type="button"
                onClick={() => setDescMode("advanced")}
                className={
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider transition-colors " +
                  (descMode === "advanced"
                    ? "bg-white/10 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-200")
                }
              >
                <BookOpen className="size-3" />
                Avancée
              </button>
            </div>
          </div>
          <p className="text-[14px] leading-relaxed text-zinc-200">
            {mDesc[descMode]?.[lang] ?? mDesc[descMode]?.en ?? mDesc.simple?.[lang] ?? ""}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Dernière actualité (résumé Gemini, si dispo) ou fallback description legacy */}
        {news ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 lg:col-span-2">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 className="flex items-center gap-2 font-display text-[14px] font-semibold uppercase tracking-wider text-zinc-300">
                <Newspaper className="size-3.5" style={{ color: accent }} />
                Dernière actualité
              </h3>
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
                {fmtNewsDate(news.date)}
                {news.source ? ` · ${news.source}` : ""}
              </span>
            </div>
            <p className="mb-2 text-[14px] font-semibold leading-snug text-zinc-100">{news.headline}</p>
            <p className="text-[13px] leading-relaxed text-zinc-300">{news.summary}</p>
            {news.url && (
              <a
                href={news.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-[12px] underline-offset-2 hover:underline"
                style={{ color: accent }}
              >
                Lire la source
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        ) : !mDesc && legacyDesc ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 lg:col-span-2">
            <h3 className="mb-2 font-display text-[14px] font-semibold uppercase tracking-wider text-zinc-300">À propos</h3>
            <p className="text-[13.5px] leading-relaxed text-zinc-300 line-clamp-[10]">{legacyDesc}</p>
          </div>
        ) : null}

        {/* Snapshot boursier */}
        {snap && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h3 className="mb-3 font-display text-[14px] font-semibold uppercase tracking-wider text-zinc-300">Snapshot boursier</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12.5px]">
              <SnapRow label="Capitalisation" value={fmtMarketCap(snap.market_cap_usd, snap.currency)} accent={accent} />
              <SnapRow label="P / E (TTM)" value={fmtNum(snap.pe_ratio, 1)} accent={accent} />
              <SnapRow label="EPS (TTM)" value={fmtNum(snap.eps_ttm, 2)} accent={accent} />
              <SnapRow label="Beta" value={fmtNum(snap.beta, 2)} accent={accent} />
              <SnapRow label="Dividende" value={snap.dividend_yield_pct != null ? `${snap.dividend_yield_pct.toFixed(2)} %` : "—"} accent={accent} />
              <SnapRow
                label="Variation jour"
                value={fmtPct(snap.day_change_pct)}
                accent={accent}
                colorize={snap.day_change_pct}
              />
              <SnapRow label="Plus-haut 52 sem." value={fmtNum(snap.high_52w, 2)} accent={accent} />
              <SnapRow label="Plus-bas 52 sem." value={fmtNum(snap.low_52w, 2)} accent={accent} />
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Faits clés (1/3) — Yann 14 mai 2026 : ligne "Industrie" RETIRÉE
            (déjà visible dans le bandeau ranks en haut de page sté). */}
        {facts && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h3 className="mb-3 font-display text-[14px] font-semibold uppercase tracking-wider text-zinc-300">Faits clés</h3>
            <ul className="space-y-2 text-[12.5px] text-zinc-300">
              {facts.hq_city && facts.hq_country && (
                <li className="flex items-start gap-2">
                  <Building2 className="mt-0.5 size-3.5 shrink-0 text-zinc-500" />
                  <span>Siège : <span className="text-zinc-100">{facts.hq_city}, {facts.hq_country}</span></span>
                </li>
              )}
              {typeof facts.employees_count === "number" && facts.employees_count > 0 && (
                <li className="flex items-start gap-2">
                  <Users className="mt-0.5 size-3.5 shrink-0 text-zinc-500" />
                  <span>Employés : <span className="text-zinc-100 tabular-nums">{facts.employees_count.toLocaleString("fr-FR")}</span></span>
                </li>
              )}
              {facts.exchange && (
                <li className="flex items-start gap-2">
                  <TrendingUp className="mt-0.5 size-3.5 shrink-0 text-zinc-500" />
                  <span>Bourse : <span className="text-zinc-100">{prettyExchange(facts.exchange)}</span></span>
                </li>
              )}
              {facts.isin && (
                <li className="flex items-start gap-2 font-mono text-[11.5px]">
                  <span className="mt-0.5 size-3.5 shrink-0 text-center text-zinc-500">#</span>
                  <span>ISIN : <span className="text-zinc-100">{facts.isin}</span></span>
                </li>
              )}
              {facts.website && (
                <li className="flex items-start gap-2">
                  <Globe className="mt-0.5 size-3.5 shrink-0 text-zinc-500" />
                  <a
                    href={facts.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-zinc-100 underline-offset-2 hover:underline"
                    style={{ color: accent }}
                  >
                    Site officiel
                    <ExternalLink className="size-3" />
                  </a>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Peers (2/3) */}
        {peers && peers.length > 0 && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 lg:col-span-2">
            <h3 className="mb-3 font-display text-[14px] font-semibold uppercase tracking-wider text-zinc-300">
              Sociétés comparables
            </h3>
            <p className="mb-3 text-[11.5px] text-zinc-500">
              {peers.length} sés de la sous-industrie {peers[0]?.subsector || company.subsector}, classées par taille proche de {company.ticker}.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {peers.map((p) => (
                <Link
                  key={p.ticker}
                  href={`/sandbox/v1-7/${p.ticker.toLowerCase()}`}
                  className="group flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-violet-400/30 hover:bg-white/[0.04]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                      {p.ticker}
                    </div>
                    <div className="truncate text-[12px] text-zinc-200">{p.name}</div>
                    {typeof p.market_cap_usd === "number" && p.market_cap_usd > 0 && (
                      <div className="font-mono text-[10.5px] text-zinc-500">{fmtMarketCap(p.market_cap_usd)}</div>
                    )}
                  </div>
                  <ArrowRight className="size-3.5 shrink-0 text-zinc-600 transition-colors group-hover:text-violet-400" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function SnapRow({ label, value, accent, colorize }: { label: string; value: string; accent: string; colorize?: number | null | undefined }) {
  let color = "#fafafa";
  if (typeof colorize === "number") {
    if (colorize > 0) color = "#10b981";
    else if (colorize < 0) color = "#f43f5e";
  }
  return (
    <>
      <span className="text-zinc-400">{label}</span>
      <span className="text-right font-mono font-semibold tabular-nums" style={{ color }}>
        {value}
      </span>
    </>
  );
}

function fmtMarketCap(n: number | null | undefined, currency?: string | null): string {
  if (n == null || n <= 0) return "—";
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
  if (n >= 1e12) return `${(n / 1e12).toFixed(2).replace(".", ",")} T${sym}`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(".", ",")} Mds${sym}`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)} M${sym}`;
  return `${n.toLocaleString("fr-FR")} ${sym}`;
}

function fmtNum(n: number | null | undefined, decimals: number): string {
  if (n == null) return "—";
  return n.toFixed(decimals).replace(".", ",");
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2).replace(".", ",")} %`;
}

function fmtNewsDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

/**
 * Mappe les codes exchange yfinance vers des libellés clairs FR.
 * NMS = NASDAQ Global Select, NGM = NASDAQ Global Market, NCM = NASDAQ Capital Market,
 * NYQ = NYSE, ASE = NYSE American, PCX = NYSE Arca, BTS = BATS, OQX/OQB = OTC, etc.
 */
function prettyExchange(code: string): string {
  const map: Record<string, string> = {
    NMS: "NASDAQ",
    NGM: "NASDAQ",
    NCM: "NASDAQ",
    NAS: "NASDAQ",
    NASDAQ: "NASDAQ",
    NYQ: "NYSE",
    NYSE: "NYSE",
    ASE: "NYSE American",
    PCX: "NYSE Arca",
    BTS: "Cboe BZX",
    OQX: "OTC",
    OQB: "OTC",
    PNK: "OTC Pink",
    LSE: "London Stock Exchange",
    PAR: "Euronext Paris",
    AMS: "Euronext Amsterdam",
    BRU: "Euronext Bruxelles",
    LIS: "Euronext Lisbonne",
    GER: "Xetra (Francfort)",
    FRA: "Bourse de Francfort",
    SWX: "SIX Suisse",
    EBS: "SIX Suisse",
    MIL: "Borsa Italiana",
    MCE: "BME (Madrid)",
    STO: "Nasdaq Stockholm",
    HEL: "Nasdaq Helsinki",
    CPH: "Nasdaq Copenhague",
    OSL: "Oslo Børs",
    TOR: "TSX (Toronto)",
    TSX: "TSX (Toronto)",
    JPX: "Bourse de Tokyo",
    TYO: "Bourse de Tokyo",
    HKG: "Bourse de Hong Kong",
    SHH: "Bourse de Shanghai",
    SHZ: "Bourse de Shenzhen",
    KSC: "Bourse de Corée",
    ASX: "ASX (Australie)",
    TAI: "Bourse de Taïwan",
    SES: "SGX (Singapour)",
  };
  const trimmed = code.trim().toUpperCase();
  return map[trimmed] ?? code;
}
