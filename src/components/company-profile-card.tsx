"use client";

import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Newspaper,
  Sparkles,
  BookOpen,
  Target,
  Package,
  Users as UsersIcon,
  Trophy,
  Cpu,
  Shield,
  AlertTriangle,
  MapPin,
} from "lucide-react";
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
  const { locale, t } = useT();
  const lang = (locale === "de" ? "de" : locale === "fr" ? "fr" : "en") as "fr" | "en" | "de";
  // Yann 14 mai 2026 : nouvelle description Gemini "PV" en 2 versions
  // (simple + avancée), prioritaire sur l'ancienne `company_description`
  // yfinance qui était générique.
  const mDesc = company.mettrik_description;
  const legacyDesc = company.company_description;
  const snap = company.financial_snapshot;
  const news = company.latest_news;

  const [descMode, setDescMode] = useState<"simple" | "advanced">("simple");

  // Yann 14 mai 2026 : retrait des blocs "Faits clés" + "Sociétés comparables"
  // (visuellement trop pauvres, infos déjà disponibles ailleurs : industrie
  // dans le bandeau ranks haut de page, comparables dans le filtre home).
  const hasAnything = mDesc || news || legacyDesc || snap;
  if (!hasAnything) return null;

  // Sections de la description (icônes + labels FR)
  const SIMPLE_SECTIONS = [
    { key: "activity", label: "Ce qu'elle fait", labelEn: "What it does", labelDe: "Was es macht", Icon: Target },
    { key: "products", label: "Produits & services", labelEn: "Products & services", labelDe: "Produkte & Services", Icon: Package },
    { key: "customers", label: "Clients", labelEn: "Customers", labelDe: "Kunden", Icon: UsersIcon },
    { key: "edge", label: "Sa force", labelEn: "Its edge", labelDe: "Stärken", Icon: Trophy },
  ] as const;
  const ADVANCED_SECTIONS = [
    { key: "positioning", label: "Positionnement", labelEn: "Positioning", labelDe: "Positionierung", Icon: MapPin },
    { key: "tech_products", label: "Technologies & produits", labelEn: "Tech & products", labelDe: "Technologien & Produkte", Icon: Cpu },
    { key: "moat", label: "Avantages durables", labelEn: "Moat", labelDe: "Wettbewerbsvorteile", Icon: Shield },
    { key: "risks", label: "Risques structurels", labelEn: "Structural risks", labelDe: "Strukturelle Risiken", Icon: AlertTriangle },
  ] as const;
  const sectionLabel = (s: { label: string; labelEn: string; labelDe: string }) =>
    lang === "de" ? s.labelDe : lang === "en" ? s.labelEn : s.label;

  return (
    <section id="sec-profile" className="mt-9 scroll-mt-24">
      <div className="mb-3 flex items-baseline justify-between">
        {/* Yann 14 mai 2026 : "Profil société & marché" → "Comprendre la société" */}
        <h2 className="font-display text-[20px] font-bold tracking-tight text-zinc-100">{t("company.profile.section_title")}</h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{t("company.profile.source")}</span>
      </div>

      {/* Layout principal : Description Mettrik (2/3) + Snapshot boursier (1/3).
          Yann 14 mai 2026 v2 : structure sections (~150 mots), look pro. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Description Mettrik : 2/3 width, sections nommées avec icônes */}
        {mDesc && (
          <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.025] to-transparent p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 font-display text-[14px] font-semibold uppercase tracking-wider text-zinc-200">
                <Sparkles className="size-3.5" style={{ color: accent }} />
                {t("company.profile.desc_title")}
              </h3>
              {/* Toggle Simple / Avancée */}
              <div className="inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.02] p-0.5">
                <button
                  type="button"
                  onClick={() => setDescMode("simple")}
                  className={
                    "rounded-full px-3 py-1 text-[10.5px] font-semibold uppercase tracking-wider transition-colors " +
                    (descMode === "simple"
                      ? "bg-white/10 text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-200")
                  }
                >
                  {t("company.profile.toggle_simple")}
                </button>
                <button
                  type="button"
                  onClick={() => setDescMode("advanced")}
                  className={
                    "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10.5px] font-semibold uppercase tracking-wider transition-colors " +
                    (descMode === "advanced"
                      ? "bg-white/10 text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-200")
                  }
                >
                  <BookOpen className="size-3" />
                  {t("company.profile.toggle_advanced")}
                </button>
              </div>
            </div>
            {/* Sections : 1 colonne sur mobile, 2 sur tablet+. Chaque section
                = icône + label + texte. Indent visuel avec border-l accent. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-3.5">
              {(descMode === "simple" ? SIMPLE_SECTIONS : ADVANCED_SECTIONS).map((s) => {
                const content = (
                  descMode === "simple"
                    ? mDesc.simple?.[lang] ?? mDesc.simple?.en
                    : mDesc.advanced?.[lang] ?? mDesc.advanced?.en
                ) as Record<string, string> | undefined;
                const text = content?.[s.key] ?? "";
                if (!text) return null;
                return (
                  <div key={s.key} className="pl-3" style={{ borderLeft: `2px solid ${accent}33` }}>
                    <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: accent }}>
                      <s.Icon className="size-3" />
                      {sectionLabel(s)}
                    </div>
                    <p className="text-[13px] leading-relaxed text-zinc-200">{text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Snapshot boursier : 1/3 width. Mis à jour quotidiennement via
            cron GitHub Actions (yfinance, gratuit). Yann 14 mai 2026. */}
        {snap && <SnapshotCard snap={snap} accent={accent} />}
      </div>

      {/* Dernière actualité — bloc séparé, full-width, conditionnel */}
      <div className="mt-4">
        {news ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 className="flex items-center gap-2 font-display text-[14px] font-semibold uppercase tracking-wider text-zinc-300">
                <Newspaper className="size-3.5" style={{ color: accent }} />
                {t("company.profile.news_title")}
              </h3>
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
                {fmtNewsDate(news.date, locale)}
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
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h3 className="mb-2 font-display text-[14px] font-semibold uppercase tracking-wider text-zinc-300">À propos</h3>
            <p className="text-[13.5px] leading-relaxed text-zinc-300 line-clamp-[10]">{legacyDesc}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Yann 14 mai 2026 : carte snapshot boursier extraite en composant
 *  pour la placer en colonne droite à côté de la description. Mis à jour
 *  quotidiennement via cron GitHub Actions (yfinance, gratuit). */
function SnapshotCard({
  snap,
  accent,
}: {
  snap: NonNullable<Company["financial_snapshot"]>;
  accent: string;
}) {
  const { t } = useT();
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.025] to-transparent p-5">
      <div className="mb-3">
        <h3 className="font-display text-[14px] font-semibold uppercase tracking-wider text-zinc-200">
          {t("company.snapshot.title")}
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12.5px]">
        <SnapRow label={t("company.snapshot.market_cap")} value={fmtMarketCap(snap.market_cap_usd, snap.currency)} accent={accent} />
        <SnapRow label={t("company.snapshot.pe_ttm")} value={fmtNum(snap.pe_ratio, 1)} accent={accent} />
        <SnapRow label={t("company.snapshot.eps_ttm")} value={fmtNum(snap.eps_ttm, 2)} accent={accent} />
        <SnapRow label={t("company.snapshot.beta")} value={fmtNum(snap.beta, 2)} accent={accent} />
        <SnapRow
          label={t("company.snapshot.dividend")}
          value={snap.dividend_yield_pct != null ? `${snap.dividend_yield_pct.toFixed(2)} %` : "—"}
          accent={accent}
        />
        <SnapRow
          label={t("company.snapshot.day_change")}
          value={fmtPct(snap.day_change_pct)}
          accent={accent}
          colorize={snap.day_change_pct}
        />
        <SnapRow label={t("company.snapshot.high_52w")} value={fmtNum(snap.high_52w, 2)} accent={accent} />
        <SnapRow label={t("company.snapshot.low_52w")} value={fmtNum(snap.low_52w, 2)} accent={accent} />
      </div>
    </div>
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

function fmtNewsDate(iso: string, locale: string = "fr"): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const tag = locale === "de" ? "de-DE" : locale === "en" || locale === "en-GB" ? (locale === "en-GB" ? "en-GB" : "en-US") : "fr-FR";
    return d.toLocaleDateString(tag, { day: "2-digit", month: "short", year: "numeric" });
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
