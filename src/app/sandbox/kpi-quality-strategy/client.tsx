"use client";

import { useMemo, useState } from "react";
import { Download, Filter, AlertTriangle } from "lucide-react";
import type { HistEntry, GenericKpiEntry, CriticalEntry } from "./page";

type Tab = "audit" | "generic" | "critical";
type AuditFilter = "geq5" | "under5";

const CATEGORIES = [
  { key: "sp500", label: "SP500" },
  { key: "top307", label: "Top 307 V1.8" },
  { key: "v19", label: "V1.9 (924 stés)" },
  { key: "v175", label: "V1.7.5" },
  { key: "all", label: "Toutes les stés" },
] as const;

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
  geq5,
  under5,
  generic,
  critical,
}: {
  geq5: HistEntry[];
  under5: HistEntry[];
  generic: GenericKpiEntry[];
  critical: CriticalEntry[];
}) {
  const [tab, setTab] = useState<Tab>("audit");
  const [auditFilter, setAuditFilter] = useState<AuditFilter>("geq5");
  const [search, setSearch] = useState("");
  const [activatedGeneric, setActivatedGeneric] = useState<Set<string>>(new Set());

  const auditRows = useMemo(() => {
    const base = auditFilter === "geq5" ? geq5 : under5;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (r) =>
        r.ticker.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.sector.toLowerCase().includes(q) ||
        r.country.toLowerCase().includes(q),
    );
  }, [auditFilter, geq5, under5, search]);

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
          onClick={() => setTab("audit")}
          className={`rounded-full px-4 py-1.5 text-[12.5px] font-medium transition-colors ${
            tab === "audit"
              ? "bg-violet-500/20 text-violet-100 ring-1 ring-violet-500/30"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Audit historique ({geq5.length + under5.length} stés)
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
        <button
          onClick={() => setTab("critical")}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12.5px] font-medium transition-colors ${
            tab === "critical"
              ? "bg-rose-500/20 text-rose-100 ring-1 ring-rose-500/30"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <AlertTriangle className="size-3.5" />
          Stés critiques ({critical.length})
        </button>
      </div>

      {tab === "audit" && (
        <AuditPanel
          geq5={geq5}
          under5={under5}
          auditFilter={auditFilter}
          setAuditFilter={setAuditFilter}
          search={search}
          setSearch={setSearch}
          auditRows={auditRows}
        />
      )}
      {tab === "generic" && (
        <GenericPanel
          generic={generic}
          activated={activatedGeneric}
          onToggle={toggleGeneric}
        />
      )}
      {tab === "critical" && <CriticalPanel critical={critical} />}
    </div>
  );
}

function CriticalPanel({ critical }: { critical: CriticalEntry[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "top307">("all");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return critical.filter((c) => {
      if (filter === "top307" && !c.in_top307_v18) return false;
      if (!q) return true;
      return (
        c.ticker.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.sector.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q)
      );
    });
  }, [critical, filter, search]);

  // Top sectors among critical
  const sectorCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of critical) {
      const s = c.sector || "?";
      m.set(s, (m.get(s) || 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [critical]);

  return (
    <div>
      <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4">
        <div className="mb-2 flex items-center gap-2 font-display text-[14px] font-semibold text-rose-200">
          <AlertTriangle className="size-4" />
          Stés priorité 0 BLOCKER (153 stés)
        </div>
        <p className="text-[12px] leading-relaxed text-rose-100/80">
          Ces stés ont <strong>0 KPI spécifique extrait</strong> — tout est
          générique (Revenue, Op Margin, EPS, EBITDA, etc.). Après filtrage
          frontend, elles auront <strong>0 KPI affichable</strong> dans les
          Indicateurs clés. Re-extraction CONV-DATA en{" "}
          <strong>priorité 0 immédiate</strong> (tous les docs disponibles
          pour trouver des KPIs spécifiques sté ou secteur).
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {sectorCounts.slice(0, 10).map(([sector, count]) => (
          <div key={sector} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{sector}</div>
            <div className="mt-0.5 font-display text-[18px] font-bold text-rose-200">{count}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${filter === "all" ? "bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/25" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            Toutes ({critical.length})
          </button>
          <button
            onClick={() => setFilter("top307")}
            className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${filter === "top307" ? "bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/25" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            Top 307 V1.8 uniquement
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer (ticker, nom, secteur, pays)…"
            className="w-64 rounded-md border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-rose-400/50"
          />
          <button
            onClick={() => downloadCsv(filtered as unknown as Record<string, unknown>[], `mettrik-kpi-critical-${new Date().toISOString().slice(0, 10)}.csv`)}
            className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/[0.06] px-3 py-1.5 text-[12px] font-medium text-rose-200 transition-colors hover:bg-rose-500/15"
          >
            <Download className="size-3.5" />
            Export CSV ({filtered.length})
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-[12px]">
          <thead className="bg-white/[0.02] text-left font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-3 py-2">Ticker</th>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Pays</th>
              <th className="px-3 py-2">Secteur</th>
              <th className="px-3 py-2">Top 307</th>
              <th className="px-3 py-2">KPIs extraits (tous génériques)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filtered.slice(0, 500).map((c) => (
              <tr key={c.ticker} className="hover:bg-white/[0.02]">
                <td className="px-3 py-1.5 font-mono text-violet-300">{c.ticker}</td>
                <td className="px-3 py-1.5 text-zinc-100">{c.name}</td>
                <td className="px-3 py-1.5 text-zinc-400">{c.country}</td>
                <td className="px-3 py-1.5 text-zinc-400">{c.sector}</td>
                <td className="px-3 py-1.5">{c.in_top307_v18 ? "✅" : "—"}</td>
                <td className="px-3 py-1.5 text-[11px] text-zinc-500">
                  {(c.kpis_extracted || []).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 500 && (
          <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 py-2 text-center text-[11px] text-zinc-500">
            500 premières affichées sur {filtered.length}. Export CSV pour la liste complète.
          </div>
        )}
      </div>
    </div>
  );
}

function AuditPanel({
  geq5,
  under5,
  auditFilter,
  setAuditFilter,
  search,
  setSearch,
  auditRows,
}: {
  geq5: HistEntry[];
  under5: HistEntry[];
  auditFilter: AuditFilter;
  setAuditFilter: (f: AuditFilter) => void;
  search: string;
  setSearch: (s: string) => void;
  auditRows: HistEntry[];
}) {
  const top307Count = auditRows.filter((r) => r.in_top307_v18).length;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
          <button
            onClick={() => setAuditFilter("geq5")}
            className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
              auditFilter === "geq5"
                ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/25"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            ≥ 5 ans ({geq5.length})
          </button>
          <button
            onClick={() => setAuditFilter("under5")}
            className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
              auditFilter === "under5"
                ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/25"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            &lt; 5 ans ({under5.length})
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer (ticker, nom, secteur, pays)…"
            className="w-64 rounded-md border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-violet-400/50"
          />
          <button
            onClick={() => downloadCsv(auditRows as unknown as Record<string, unknown>[], `mettrik-kpi-history-${auditFilter}-${new Date().toISOString().slice(0, 10)}.csv`)}
            className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/[0.06] px-3 py-1.5 text-[12px] font-medium text-violet-200 transition-colors hover:bg-violet-500/15"
          >
            <Download className="size-3.5" />
            Export CSV ({auditRows.length})
          </button>
        </div>
      </div>

      <div className="mb-3 text-[11.5px] text-zinc-500">
        {auditRows.length} stés affichées — dont <strong className="text-zinc-300">{top307Count}</strong> dans le top 307 V1.8.{" "}
        {auditFilter === "geq5"
          ? "Ces stés ont assez d'historique pour des KPI spécifiques bien comparables. Priorité 2 (re-extract pour passer aux KPI spécifiques)."
          : "Ces stés ont peu d'historique. Priorité 1 (extraire le maximum possible des docs disponibles, accepter 3 ans en fallback)."}
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-[12px]">
          <thead className="bg-white/[0.02] text-left font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-3 py-2">Ticker</th>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Pays</th>
              <th className="px-3 py-2">Secteur</th>
              <th className="px-3 py-2">Hero KPI</th>
              <th className="px-3 py-2">Période</th>
              <th className="px-3 py-2 text-right">Pts</th>
              <th className="px-3 py-2 text-right">Années</th>
              <th className="px-3 py-2">Top 307</th>
              {auditFilter === "under5" && <th className="px-3 py-2">Bucket</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {auditRows.slice(0, 500).map((r) => (
              <tr key={r.ticker} className="hover:bg-white/[0.02]">
                <td className="px-3 py-1.5 font-mono text-violet-300">{r.ticker}</td>
                <td className="px-3 py-1.5 text-zinc-100">{r.name}</td>
                <td className="px-3 py-1.5 text-zinc-400">{r.country}</td>
                <td className="px-3 py-1.5 text-zinc-400">{r.sector}</td>
                <td className="px-3 py-1.5 text-zinc-300">{r.hero_kpi}</td>
                <td className="px-3 py-1.5 text-zinc-400">{r.period_type}</td>
                <td className="px-3 py-1.5 text-right text-zinc-300">{r.history_len}</td>
                <td className="px-3 py-1.5 text-right text-zinc-300">{r.years_coverage.toFixed(1)}</td>
                <td className="px-3 py-1.5">{r.in_top307_v18 ? "✅" : "—"}</td>
                {auditFilter === "under5" && (
                  <td className="px-3 py-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${(r.bucket || "").startsWith("3") ? "bg-amber-500/15 text-amber-300" : "bg-rose-500/15 text-rose-300"}`}>
                      {r.bucket}
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {auditRows.length > 500 && (
          <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 py-2 text-center text-[11px] text-zinc-500">
            500 premières lignes affichées sur {auditRows.length}. Utiliser Export CSV pour la liste complète.
          </div>
        )}
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
  const [activeCategory, setActiveCategory] = useState<string>("sp500");

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
      `À implémenter côté CONV-CONCEPTS/SYSTEMS : flag ` +
      `\`generic_kpi_categories\` côté ` +
      `\`v2-pipeline-enrich/<ticker>.json\` qui force l'affichage de ces KPI dans le bloc Indicateurs clés.`,
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
          restent en data et peuvent être <strong>activés</strong> pour une
          catégorie spécifique (SP500, Top 307, V1.9, etc.) via le bouton ci-dessous.
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
