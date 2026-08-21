"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownWideNarrow, ArrowDownAZ, Download, Filter } from "lucide-react";
import type { SteRow, GenericKpiEntry, UniverseKey } from "./page";

type Tab = "stes" | "generic";
type UniverseFilter = "all" | UniverseKey;
type SortMode = "cap" | "alpha";

const UNIVERSE_FILTERS: { key: UniverseFilter; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "sp500", label: "SP500" },
  { key: "cac40", label: "CAC" },
  { key: "dax40", label: "DAX" },
  { key: "smi", label: "SMI" },
  { key: "soxx", label: "SOXX" },
];

const UNIVERSE_BADGE: Record<UniverseKey, string> = {
  sp500: "SP500",
  cac40: "CAC",
  dax40: "DAX",
  smi: "SMI",
  soxx: "SOXX",
};

// Catégories d'activation de la library générique (nettoyées août 2026 :
// Top 307 V1.8 / V1.9 924 stés / V1.7.5 supprimées, périmées).
const CATEGORIES = [
  { key: "all", label: "Toutes les stés" },
  { key: "sp500", label: "SP500" },
  { key: "cac40", label: "CAC 40" },
  { key: "dax40", label: "DAX 40" },
  { key: "smi", label: "SMI" },
  { key: "soxx", label: "SOXX" },
] as const;

type KpiOption = { short: string; name_fr: string };

type HeroState = {
  hero: string;
  options: KpiOption[] | null;
  loading: boolean;
  status: "idle" | "applying" | "applied" | "error";
  message?: string;
};

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[,;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  }
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function KpiQualityStrategyClient({
  rows,
  capsSource,
  generic,
}: {
  rows: SteRow[];
  capsSource: "att-state" | "alpha";
  generic: GenericKpiEntry[];
}) {
  const [tab, setTab] = useState<Tab>("stes");
  const [activatedGeneric, setActivatedGeneric] = useState<Set<string>>(new Set());

  const toggleGeneric = (short: string) => {
    setActivatedGeneric((prev) => {
      const next = new Set(prev);
      if (next.has(short)) next.delete(short);
      else next.add(short);
      return next;
    });
  };

  return (
    <div className="mt-8">
      {/* Tabs */}
      <div className="mb-6 inline-flex rounded-full border border-white/[0.06] bg-white/[0.02] p-1">
        <button
          onClick={() => setTab("stes")}
          className={`rounded-full px-4 py-1.5 text-[12.5px] font-medium transition-colors ${
            tab === "stes"
              ? "bg-violet-500/20 text-violet-100 ring-1 ring-violet-500/30"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Stés univers ({rows.length})
        </button>
        <button
          onClick={() => setTab("generic")}
          className={`rounded-full px-4 py-1.5 text-[12.5px] font-medium transition-colors ${
            tab === "generic"
              ? "bg-violet-500/20 text-violet-100 ring-1 ring-violet-500/30"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Library KPI génériques ({generic.length})
        </button>
      </div>

      {tab === "stes" && <StesPanel rows={rows} capsSource={capsSource} />}
      {tab === "generic" && (
        <GenericPanel
          generic={generic}
          activated={activatedGeneric}
          onToggle={toggleGeneric}
        />
      )}
    </div>
  );
}

function StesPanel({ rows, capsSource }: { rows: SteRow[]; capsSource: "att-state" | "alpha" }) {
  const router = useRouter();
  const [filter, setFilter] = useState<UniverseFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("cap");
  const [search, setSearch] = useState("");
  const [heroState, setHeroState] = useState<Record<string, HeroState>>({});

  // Correction du hero affiché par les overrides Supabase (couche gagnante
  // au rendu : appliquée tout à la fin de loadV17Company).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/desk/hero")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { overrides?: Record<string, string> } | null) => {
        if (cancelled || !d?.overrides) return;
        setHeroState((prev) => {
          const next = { ...prev };
          for (const [t, h] of Object.entries(d.overrides!)) {
            next[t] = { ...(next[t] ?? emptyHero()), hero: h };
          }
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const emptyHero = (): HeroState => ({
    hero: "",
    options: null,
    loading: false,
    status: "idle",
  });

  const stateFor = (r: SteRow): HeroState => {
    const s = heroState[r.ticker];
    if (s) return s.hero ? s : { ...s, hero: r.hero };
    return { ...emptyHero(), hero: r.hero };
  };

  // Chargement paresseux des options : KPI réels de la sté (short + name_fr)
  // depuis les données réellement chargées (loadV17Company côté API).
  const ensureOptions = (r: SteRow) => {
    const cur = stateFor(r);
    if (cur.options || cur.loading) return;
    setHeroState((p) => ({ ...p, [r.ticker]: { ...cur, loading: true } }));
    fetch(`/api/desk/hero?ticker=${encodeURIComponent(r.ticker)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((d: { hero_kpi?: string | null; kpis?: KpiOption[] }) => {
        setHeroState((p) => ({
          ...p,
          [r.ticker]: {
            ...(p[r.ticker] ?? cur),
            hero: d.hero_kpi || cur.hero,
            options: d.kpis ?? [],
            loading: false,
          },
        }));
      })
      .catch(() => {
        setHeroState((p) => ({
          ...p,
          [r.ticker]: {
            ...(p[r.ticker] ?? cur),
            loading: false,
            status: "error",
            message: "chargement KPI impossible",
          },
        }));
      });
  };

  const applyHero = (r: SteRow, heroKpi: string) => {
    const cur = stateFor(r);
    if (!heroKpi || heroKpi === cur.hero) return;
    setHeroState((p) => ({
      ...p,
      [r.ticker]: { ...cur, hero: heroKpi, status: "applying", message: undefined },
    }));
    fetch("/api/desk/hero", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: r.ticker, hero_kpi: heroKpi }),
    })
      .then(async (res) => {
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
        setHeroState((p) => ({
          ...p,
          [r.ticker]: { ...(p[r.ticker] ?? cur), hero: heroKpi, status: "applied", message: "appliqué" },
        }));
        router.refresh();
        setTimeout(() => {
          setHeroState((p) => {
            const s = p[r.ticker];
            if (!s || s.status !== "applied") return p;
            return { ...p, [r.ticker]: { ...s, status: "idle", message: undefined } };
          });
        }, 2500);
      })
      .catch((err: Error) => {
        setHeroState((p) => ({
          ...p,
          [r.ticker]: { ...(p[r.ticker] ?? cur), hero: cur.hero, status: "error", message: err.message },
        }));
      });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (filter !== "all" && !r.universes.includes(filter)) return false;
      if (!q) return true;
      return (
        r.ticker.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.sector.toLowerCase().includes(q)
      );
    });
    list = [...list].sort((a, b) =>
      sortMode === "cap"
        ? a.capRank - b.capRank || a.ticker.localeCompare(b.ticker)
        : a.ticker.localeCompare(b.ticker),
    );
    return list;
  }, [rows, filter, search, sortMode]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
          {UNIVERSE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                filter === f.key
                  ? "bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/25"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {f.label}
              {f.key !== "all" && (
                <span className="ml-1 text-[10px] text-zinc-500">
                  {rows.filter((r) => r.universes.includes(f.key as UniverseKey)).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSortMode(sortMode === "cap" ? "alpha" : "cap")}
            title={
              capsSource === "att-state"
                ? "Capi : ordre .conv-state/att-state.json (capi décroissante)"
                : "Source capi indisponible : fallback alphabétique"
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[12px] font-medium text-zinc-300 transition-colors hover:text-zinc-100"
          >
            {sortMode === "cap" ? (
              <>
                <ArrowDownWideNarrow className="size-3.5" /> Tri : capi décroissante
              </>
            ) : (
              <>
                <ArrowDownAZ className="size-3.5" /> Tri : alphabétique
              </>
            )}
          </button>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer (ticker, nom, secteur)…"
            className="w-64 rounded-md border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-violet-400/50"
          />
          <button
            onClick={() =>
              downloadCsv(
                filtered.map((r) => ({
                  ticker: r.ticker,
                  name: r.name,
                  sector: r.sector,
                  universes: r.universes.map((u) => UNIVERSE_BADGE[u]).join("|"),
                  hero_kpi: stateFor(r).hero,
                })),
                `mettrik-stes-univers-${new Date().toISOString().slice(0, 10)}.csv`,
              )
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/[0.06] px-3 py-1.5 text-[12px] font-medium text-violet-200 transition-colors hover:bg-violet-500/15"
          >
            <Download className="size-3.5" />
            Export CSV ({filtered.length})
          </button>
        </div>
      </div>

      <div className="mb-3 text-[11.5px] text-zinc-500">
        {filtered.length} stés affichées sur {rows.length} (app ∩ SP500 ∪ CAC 40 ∪ DAX 40 ∪ SMI ∪ SOXX).
        Le menu Hero KPI charge les KPI réels de la sté au clic ; choisir un KPI
        change le hero en direct (override prioritaire au rendu).
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-[12px]">
          <thead className="bg-white/[0.02] text-left font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-3 py-2 text-right">#</th>
              <th className="px-3 py-2">Ticker</th>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Secteur</th>
              <th className="px-3 py-2">Univers</th>
              <th className="px-3 py-2">Hero KPI</th>
              <th className="px-3 py-2">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filtered.map((r, i) => {
              const s = stateFor(r);
              return (
                <tr key={r.ticker} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-1.5 text-right font-mono text-[11px] text-zinc-500">
                    {i + 1}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-violet-300">{r.ticker}</td>
                  <td className="px-3 py-1.5 text-zinc-100">{r.name}</td>
                  <td className="px-3 py-1.5 text-zinc-400">{r.sector}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {r.universes.map((u) => (
                        <span
                          key={u}
                          className="rounded bg-violet-500/10 px-1.5 py-0.5 font-mono text-[10px] text-violet-300 ring-1 ring-violet-500/20"
                        >
                          {UNIVERSE_BADGE[u]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      value={s.hero}
                      onFocus={() => ensureOptions(r)}
                      onMouseDown={() => ensureOptions(r)}
                      onChange={(e) => applyHero(r, e.target.value)}
                      disabled={s.status === "applying"}
                      className="w-64 max-w-full rounded-md border border-white/10 bg-white/[0.02] px-2 py-1 text-[12px] text-zinc-100 outline-none transition-colors focus:border-violet-400/50 disabled:opacity-50"
                    >
                      {s.options ? (
                        s.options.map((k) => (
                          <option key={k.short} value={k.short} className="bg-zinc-950">
                            {k.short} · {k.name_fr}
                          </option>
                        ))
                      ) : (
                        <option value={s.hero} className="bg-zinc-950">
                          {s.loading ? "Chargement des KPI…" : s.hero || "?"}
                        </option>
                      )}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    {s.status === "applying" && (
                      <span className="text-[11px] text-amber-300">application…</span>
                    )}
                    {s.status === "applied" && (
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] text-emerald-300">
                        appliqué ✓
                      </span>
                    )}
                    {s.status === "error" && (
                      <span className="text-[11px] text-rose-300" title={s.message}>
                        erreur : {s.message}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GenericPanel({
  generic,
  activated,
  onToggle,
}: {
  generic: GenericKpiEntry[];
  activated: Set<string>;
  onToggle: (short: string) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const families = useMemo(() => {
    const set = new Set<string>();
    generic.forEach((g) => set.add(g.family));
    return Array.from(set);
  }, [generic]);

  const handleActivate = () => {
    if (activated.size === 0) {
      alert("Sélectionne au moins 1 KPI à activer (clic sur les lignes).");
      return;
    }
    alert(
      `[Stub] Activer ${activated.size} KPI(s) pour la catégorie "${activeCategory}".\n\n` +
      `KPIs : ${Array.from(activated).join(", ")}\n\n` +
      `À implémenter : flag \`generic_kpi_categories\` côté ` +
      `\`v2-pipeline-enrich/<ticker>.json\` qui force l'affichage de ces KPI ` +
      `dans le bloc Indicateurs clés.`,
    );
  };

  return (
    <div>
      <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
        <div className="mb-2 font-display text-[14px] font-semibold text-amber-200">
          📚 Library KPI génériques (bas/milieu de gamme)
        </div>
        <p className="text-[12px] leading-relaxed text-amber-100/80">
          Ces KPIs sont présents par défaut chez 95 % des sociétés (Revenue, Op
          Margin, EPS, Net Income, EBITDA, FCF, etc.). Ils sont{" "}
          <strong>masqués par défaut dans l&apos;app</strong> car ils n&apos;apportent
          aucune PV différentiante vs un screener gratuit Yahoo/Google. Mais ils
          restent en data et peuvent être <strong>activés</strong> pour un
          univers spécifique via le bouton ci-dessous.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="size-3.5 text-zinc-500" />
          <span className="text-[11.5px] text-zinc-500">Activer pour :</span>
          <select
            value={activeCategory}
            onChange={(e) => setActiveCategory(e.target.value)}
            className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1 text-[12px] text-zinc-100 outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key} className="bg-zinc-950">{c.label}</option>
            ))}
          </select>
          <button
            onClick={handleActivate}
            className="rounded-md border border-violet-500/30 bg-violet-500/[0.1] px-3 py-1 text-[12px] font-medium text-violet-100 transition-colors hover:bg-violet-500/20"
          >
            Activer la sélection ({activated.size})
          </button>
        </div>
        <button
          onClick={() => downloadCsv(generic as unknown as Record<string, unknown>[], `mettrik-kpi-generic-library-${new Date().toISOString().slice(0, 10)}.csv`)}
          className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/[0.06] px-3 py-1.5 text-[12px] font-medium text-violet-200 transition-colors hover:bg-violet-500/15"
        >
          <Download className="size-3.5" />
          Export CSV
        </button>
      </div>

      {families.map((family) => (
        <div key={family} className="mb-6">
          <h3 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-violet-300">
            {family}
          </h3>
          <div className="rounded-xl border border-white/[0.06]">
            <table className="w-full text-[12px]">
              <thead className="bg-white/[0.02] text-left font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="w-12 px-3 py-2">Activer</th>
                  <th className="px-3 py-2">Short</th>
                  <th className="px-3 py-2">Nom FR</th>
                  <th className="px-3 py-2">Nom EN</th>
                  <th className="px-3 py-2">Rationale FR</th>
                  <th className="px-3 py-2">Rationale EN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {generic.filter((g) => g.family === family).map((g) => {
                  const isOn = activated.has(g.short);
                  return (
                    <tr
                      key={g.short}
                      onClick={() => onToggle(g.short)}
                      className={`cursor-pointer transition-colors ${isOn ? "bg-violet-500/[0.06]" : "hover:bg-white/[0.02]"}`}
                    >
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={isOn}
                          onChange={() => onToggle(g.short)}
                          className="size-4 cursor-pointer accent-violet-500"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-violet-300">{g.short}</td>
                      <td className="px-3 py-2 text-zinc-100">{g.name_fr}</td>
                      <td className="px-3 py-2 text-zinc-300">{g.name_en}</td>
                      <td className="max-w-md px-3 py-2 text-[11px] text-zinc-500">{g.rationale_fr}</td>
                      <td className="max-w-md px-3 py-2 text-[11px] text-zinc-500">{g.rationale_en}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
