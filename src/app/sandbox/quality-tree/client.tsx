"use client";

import { useMemo, useState } from "react";
import type { QualityNode } from "@/lib/quality-tree";

const SEV_COLOR: Record<number, string> = {
  5: "bg-red-500/20 text-red-300 border-red-500/40",
  4: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  3: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  2: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  1: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

const AUDITOR_BADGE: Record<string, string> = {
  regex: "🔠 regex",
  "gemini-visual": "👁 Gemini",
  "data-structure": "🧱 data",
  "auto-test": "🧪 test",
  manual: "🤝 manuel",
};

export function QualityTreeClient({ tree }: { tree: QualityNode[] }) {
  const [search, setSearch] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(tree.filter((n) => n.level === 0 || n.level === 1).map((n) => n.id)));
  const [filterAuditor, setFilterAuditor] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<number>(0);
  const [filterVariant, setFilterVariant] = useState<string>("all");

  // Index by parent
  const childrenByParent = useMemo(() => {
    const m = new Map<string | null, QualityNode[]>();
    for (const n of tree) {
      const arr = m.get(n.parent) ?? [];
      arr.push(n);
      m.set(n.parent, arr);
    }
    return m;
  }, [tree]);

  // Filter set : noeuds qui matchent ; on auto-include leurs ancêtres
  const matchSet = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = new Set<string>();
    for (const n of tree) {
      const haystack = `${n.id} ${n.title} ${n.description} ${(n.anti_patterns || []).join(" ")}`.toLowerCase();
      const okSearch = !q || haystack.includes(q);
      const okAuditor = filterAuditor === "all" || n.auditor === filterAuditor;
      const okSev = !filterSeverity || (n.severity_if_fail ?? 0) >= filterSeverity;
      const okVariant = filterVariant === "all" || (n.variants && Object.prototype.hasOwnProperty.call(n.variants, filterVariant));
      if (okSearch && okAuditor && okSev && okVariant) matched.add(n.id);
    }
    // Inclure ancêtres
    const result = new Set(matched);
    for (const id of matched) {
      let cur = tree.find((n) => n.id === id);
      while (cur && cur.parent) {
        result.add(cur.parent);
        cur = tree.find((n) => n.id === cur!.parent);
      }
    }
    return result;
  }, [tree, search, filterAuditor, filterSeverity, filterVariant]);

  const toggle = (id: string) => {
    setOpenIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setOpenIds(new Set(tree.map((n) => n.id)));
  const collapseAll = () => setOpenIds(new Set());

  const stats = useMemo(() => {
    const total = tree.length;
    const leaves = tree.filter((n) => n.level >= 3).length;
    const withAutoFix = tree.filter((n) => n.auto_fix).length;
    const sev5 = tree.filter((n) => n.severity_if_fail === 5).length;
    return { total, leaves, withAutoFix, sev5 };
  }, [tree]);

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-5">
          <h1 className="font-display text-[30px] font-bold tracking-tight">Quality Tree · Page société</h1>
          <p className="mt-1 text-[13.5px] text-zinc-400">
            Registry unique des éléments contrôlables de la page sté. Tag d'ID stable pour communication 1-tag = 1 fix.
            Source : <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px]">src/lib/quality-tree.ts</code> · Doc :
            <code className="ml-1 rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px]">docs/CHART-RECIPE.md</code>
          </p>
        </header>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Nodes" value={stats.total} />
          <Stat label="Éléments contrôlables" value={stats.leaves} />
          <Stat label="Auto-fix dispo" value={stats.withAutoFix} accent="text-emerald-300" />
          <Stat label="Blocker (sev 5)" value={stats.sev5} accent="text-red-300" />
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Recherche dans IDs / titres / descriptions / anti-patterns…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[260px] rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[13px] text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none"
          />
          <select
            value={filterAuditor}
            onChange={(e) => setFilterAuditor(e.target.value)}
            className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[12px] text-zinc-200"
          >
            <option value="all">Tous auditeurs</option>
            <option value="regex">🔠 regex</option>
            <option value="gemini-visual">👁 Gemini visual</option>
            <option value="data-structure">🧱 data-structure</option>
            <option value="auto-test">🧪 auto-test</option>
            <option value="manual">🤝 manuel</option>
          </select>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(Number(e.target.value))}
            className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[12px] text-zinc-200"
          >
            <option value="0">Toutes sévérités</option>
            <option value="5">≥ 5 (blocker)</option>
            <option value="4">≥ 4</option>
            <option value="3">≥ 3</option>
            <option value="2">≥ 2</option>
          </select>
          <select
            value={filterVariant}
            onChange={(e) => setFilterVariant(e.target.value)}
            className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[12px] text-zinc-200"
          >
            <option value="all">Toutes variantes</option>
            <option value="fiscal_shifted">Fiscal décalé</option>
            <option value="cat">Cat 1/2/3/4</option>
            <option value="sector">Par secteur</option>
            <option value="no_wow">Sans wow</option>
            <option value="dual_class">Dual-class</option>
            <option value="young_ipo">IPO récente</option>
            <option value="no_dividend">Sans dividende</option>
            <option value="frequency">Fréquence pub</option>
          </select>
          <button
            onClick={expandAll}
            className="rounded-md border border-violet-500/40 bg-violet-500/[0.08] px-2 py-1 text-[12px] text-violet-200 hover:bg-violet-500/15"
          >
            Tout ouvrir
          </button>
          <button
            onClick={collapseAll}
            className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.07]"
          >
            Tout fermer
          </button>
        </div>

        <div className="rounded-lg border border-white/10 bg-[#080808] p-2">
          {(childrenByParent.get(null) || []).map((root) => (
            <TreeNode
              key={root.id}
              node={root}
              childrenByParent={childrenByParent}
              openIds={openIds}
              matchSet={matchSet}
              onToggle={toggle}
            />
          ))}
        </div>

        <p className="mt-4 text-[11.5px] text-zinc-500">
          Mécanisme : chaque feuille a un ID stable utilisable comme tag de communication.
          Exemple : <code className="rounded bg-white/[0.06] px-1 font-mono">hero.chart.y_axis.no_overlap_with_tabs</code>.
          Quand Yann signale "corrige NVDA &lt;id&gt;", le fix-dispatcher (Phase 5) appliquera le fix correspondant.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, accent = "text-zinc-100" }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-[#080808] px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-0.5 font-mono text-[20px] tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}

function TreeNode({
  node,
  childrenByParent,
  openIds,
  matchSet,
  onToggle,
}: {
  node: QualityNode;
  childrenByParent: Map<string | null, QualityNode[]>;
  openIds: Set<string>;
  matchSet: Set<string>;
  onToggle: (id: string) => void;
}) {
  const children = childrenByParent.get(node.id) || [];
  const hasChildren = children.length > 0;
  const isOpen = openIds.has(node.id);
  const isMatch = matchSet.has(node.id);

  if (!isMatch) return null;

  // Indent par level
  const pad = ["pl-0", "pl-3", "pl-7", "pl-11", "pl-14"][node.level] || "pl-14";

  // Couleurs par level
  const titleColor = node.level === 0 ? "text-zinc-100" : node.level === 1 ? "text-violet-200" : node.level === 2 ? "text-cyan-200" : "text-zinc-300";

  return (
    <div className={pad}>
      <div className="group flex items-start gap-2 py-1 hover:bg-white/[0.02]">
        {hasChildren ? (
          <button
            onClick={() => onToggle(node.id)}
            className="mt-1 inline-flex size-4 shrink-0 items-center justify-center rounded text-zinc-500 hover:text-zinc-100"
            aria-label={isOpen ? "Fermer" : "Ouvrir"}
          >
            {isOpen ? "▾" : "▸"}
          </button>
        ) : (
          <span className="mt-1 inline-block size-4 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className={`font-semibold ${titleColor}`} style={{ fontSize: node.level === 0 ? "16px" : node.level === 1 ? "14px" : "13px" }}>
              {node.title}
            </span>
            <code className="font-mono text-[10.5px] text-zinc-500">{node.id}</code>
            {node.severity_if_fail ? (
              <span className={`rounded border px-1 py-0.5 font-mono text-[10px] ${SEV_COLOR[node.severity_if_fail]}`}>
                S{node.severity_if_fail}
              </span>
            ) : null}
            {node.auditor ? (
              <span className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                {AUDITOR_BADGE[node.auditor] || node.auditor}
              </span>
            ) : null}
            {node.auto_fix ? (
              <span className="rounded border border-emerald-500/30 bg-emerald-500/[0.08] px-1.5 py-0.5 font-mono text-[10px] text-emerald-300" title={`Auto-fix : ${node.auto_fix}`}>
                ⚙ auto-fix
              </span>
            ) : null}
          </div>
          {node.description ? (
            <p className="mt-0.5 text-[12px] leading-snug text-zinc-400">{node.description}</p>
          ) : null}
          {(node.anti_patterns || []).length > 0 ? (
            <details className="mt-1">
              <summary className="cursor-pointer text-[11px] text-amber-300/80 hover:text-amber-200">
                Anti-patterns observés ({node.anti_patterns!.length})
              </summary>
              <ul className="mt-1 ml-3 list-disc space-y-0.5 text-[11px] text-zinc-400">
                {node.anti_patterns!.map((ap, i) => (
                  <li key={i}>{ap}</li>
                ))}
              </ul>
            </details>
          ) : null}
          {node.variants ? (
            <details className="mt-1">
              <summary className="cursor-pointer text-[11px] text-violet-300/80 hover:text-violet-200">
                Variantes ({Object.keys(node.variants).length})
              </summary>
              <ul className="mt-1 ml-3 list-disc space-y-0.5 text-[11px] text-zinc-400">
                {Object.entries(node.variants).map(([k, v]) => (
                  <li key={k}>
                    <strong className="text-violet-200">{k}</strong> : {typeof v === "string" ? v : JSON.stringify(v)}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {(node.code_hooks || []).length > 0 ? (
            <details className="mt-1">
              <summary className="cursor-pointer text-[11px] text-cyan-300/80 hover:text-cyan-200">
                Code ({node.code_hooks!.length})
              </summary>
              <ul className="mt-1 ml-3 list-disc space-y-0.5 font-mono text-[10.5px] text-zinc-500">
                {node.code_hooks!.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </div>
      {hasChildren && isOpen ? (
        <div className="border-l border-white/[0.06] ml-2">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              childrenByParent={childrenByParent}
              openIds={openIds}
              matchSet={matchSet}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
