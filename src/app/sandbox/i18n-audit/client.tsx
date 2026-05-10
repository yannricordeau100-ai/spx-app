"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Check, AlertTriangle } from "lucide-react";
import type { LangStat } from "./page";

const LOCALE_META: Record<string, { flag: string; label: string }> = {
  fr: { flag: "🇫🇷", label: "Français" },
  en: { flag: "🇺🇸", label: "English (US)" },
  de: { flag: "🇩🇪", label: "Deutsch" },
  nl: { flag: "🇳🇱", label: "Nederlands" },
  sv: { flag: "🇸🇪", label: "Svenska" },
  da: { flag: "🇩🇰", label: "Dansk" },
  "en-GB": { flag: "🇬🇧", label: "English (UK)" },
  "de-CH": { flag: "🇨🇭", label: "Schweizerdeutsch" },
};

export function I18nAuditClient({ stats }: { stats: LangStat[] }) {
  const [openLang, setOpenLang] = useState(false);
  const [selected, setSelected] = useState<string>("fr");

  const current = useMemo(
    () => stats.find((s) => s.locale === selected) ?? stats[0],
    [stats, selected]
  );

  const overallPct = useMemo(() => {
    const totalCovered = current.groups.reduce((a, g) => a + g.covered, 0);
    const totalAll = current.groups.reduce((a, g) => a + g.total, 0);
    return totalAll > 0 ? Math.round((totalCovered / totalAll) * 100) : 0;
  }, [current]);

  return (
    <div className="min-h-screen bg-[#050507] px-4 py-10 text-zinc-100 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <div className="font-mono text-[10.5px] uppercase tracking-wider text-violet-300">
            Sandbox · Audit i18n
          </div>
          <h1 className="mt-1 font-display text-[32px] font-bold tracking-tight text-zinc-50 sm:text-[40px]">
            Couverture des traductions
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] text-zinc-400">
            Pour chaque langue, voici les groupes de pages et leur taux de
            traduction. Sélecteur en haut à droite. en-GB et de-CH bénéficient
            d&apos;un fallback automatique sur en et de.
          </p>
        </header>

        {/* Sélecteur de langue (dropdown) */}
        <div className="mb-6 flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
            Langue
          </span>
          <div className="relative">
            <button
              onClick={() => setOpenLang((o) => !o)}
              className="inline-flex min-w-[200px] items-center justify-between gap-2 rounded-full border border-white/15 bg-black/45 px-4 py-2 font-mono text-[12.5px] tabular-nums text-zinc-100 backdrop-blur-md transition-all hover:border-white/30"
              style={{ boxShadow: openLang ? "0 0 12px rgba(167, 139, 250, 0.35)" : "none" }}
            >
              <span className="flex items-center gap-2">
                <span className="text-[18px]">{LOCALE_META[selected]?.flag ?? "🌐"}</span>
                <span className="font-semibold">{LOCALE_META[selected]?.label ?? selected}</span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  {overallPct} %
                </span>
              </span>
              <ChevronDown
                className="size-3 text-zinc-400 transition-transform"
                style={{ transform: openLang ? "rotate(180deg)" : "" }}
              />
            </button>

            {openLang && (
              <ul
                className="absolute left-0 top-[110%] z-50 w-[260px] overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0e]/95 p-1 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-md"
                role="listbox"
              >
                {stats.map((s) => {
                  const meta = LOCALE_META[s.locale] ?? { flag: "🌐", label: s.locale };
                  const totalCovered = s.groups.reduce((a, g) => a + g.covered, 0);
                  const totalAll = s.groups.reduce((a, g) => a + g.total, 0);
                  const pct = totalAll > 0 ? Math.round((totalCovered / totalAll) * 100) : 0;
                  const isActive = s.locale === selected;
                  return (
                    <li key={s.locale}>
                      <button
                        onClick={() => {
                          setSelected(s.locale);
                          setOpenLang(false);
                        }}
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-white/[0.06]"
                        style={
                          isActive
                            ? { background: "rgba(167, 139, 250, 0.18)", color: "#fff" }
                            : { color: "#d4d4d8" }
                        }
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-[18px]">{meta.flag}</span>
                          <span className="font-semibold">{meta.label}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span
                            className={
                              "rounded-full px-2 py-0.5 font-mono text-[10px] tabular-nums " +
                              (pct === 100
                                ? "bg-emerald-500/15 text-emerald-300"
                                : pct >= 80
                                ? "bg-amber-500/15 text-amber-300"
                                : "bg-rose-500/15 text-rose-300")
                            }
                          >
                            {pct} %
                          </span>
                          {isActive && <Check className="size-3 text-violet-300" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Tableau des groupes pour la langue sélectionnée */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur">
          <table className="w-full table-fixed text-[13px]">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.04]">
                <th className="px-4 py-3 text-left font-mono text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                  Page / Groupe
                </th>
                <th className="px-4 py-3 text-right font-mono text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                  Couvert
                </th>
                <th className="px-4 py-3 text-right font-mono text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                  Total clés
                </th>
                <th className="px-4 py-3 text-right font-mono text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {current.groups.map((g) => {
                const pct = g.total > 0 ? Math.round((g.covered / g.total) * 100) : 0;
                const ok = pct === 100;
                return (
                  <tr key={g.id} className="border-b border-white/5 transition-colors hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-medium text-zinc-100">{g.label}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-300">
                      {g.covered}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-400">
                      {g.total}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums " +
                          (ok
                            ? "bg-emerald-500/15 text-emerald-300"
                            : pct >= 80
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-rose-500/15 text-rose-300")
                        }
                      >
                        {ok ? <Check className="size-3" /> : <AlertTriangle className="size-3" />}
                        {pct} %
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Détail des clés manquantes (si la langue choisie n'est pas 100%) */}
        {(() => {
          const allMissing = current.groups.flatMap((g) =>
            g.missingKeys.map((k) => ({ group: g.label, key: k }))
          );
          if (allMissing.length === 0) {
            return (
              <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
                <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-emerald-300">
                  <Check className="size-3.5" /> Couverture complète
                </div>
                <p className="mt-1 text-[13px] text-emerald-100/80">
                  Toutes les clés UI fixes sont traduites en{" "}
                  {LOCALE_META[current.locale]?.label}. Le contenu propre à
                  chaque société (descriptions, signal text) est piloté par les
                  datasets et se traduit au fur et à mesure de leur enrichissement.
                </p>
              </div>
            );
          }
          return (
            <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-amber-300">
                <AlertTriangle className="size-3.5" /> {allMissing.length} clés manquantes
              </div>
              <ul className="mt-2 max-h-[400px] overflow-y-auto space-y-0.5 font-mono text-[11px] text-amber-100/85">
                {allMissing.map((m, i) => (
                  <li key={i}>
                    <span className="text-amber-300/70">[{m.group}]</span> {m.key}
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}

        {/* Note technique */}
        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">
            Note technique
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-300">
            Les variantes <code className="rounded bg-white/[0.06] px-1 font-mono">en-GB</code>{" "}
            (anglais UK) et{" "}
            <code className="rounded bg-white/[0.06] px-1 font-mono">de-CH</code>{" "}
            (suisse allemand) fallback automatiquement sur{" "}
            <code className="rounded bg-white/[0.06] px-1 font-mono">en</code> et{" "}
            <code className="rounded bg-white/[0.06] px-1 font-mono">de</code>{" "}
            quand une clé n&apos;a pas de traduction propre — c&apos;est pour
            ça que leur couverture affiche 100 %.
          </p>
        </div>
      </div>
    </div>
  );
}
