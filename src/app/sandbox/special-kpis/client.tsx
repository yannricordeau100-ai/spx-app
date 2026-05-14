"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Play,
  Trash2,
  Copy,
  Eye,
  Save,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Sparkles,
} from "lucide-react";
import type {
  SpecialKpi,
  SpecialKpiStyle,
  SpecialKpiChart,
  SpecialKpiPoint,
} from "@/lib/desk/special-kpis";
import { SpecialKpiPreview } from "@/components/special-kpi-preview";

type Mode = "single" | "multi";

const STATUS_META: Record<
  SpecialKpi["status"],
  { label: string; color: string; bg: string }
> = {
  todo: { label: "À faire", color: "#a1a1aa", bg: "#a1a1aa20" },
  in_progress: { label: "En cours", color: "#06b6d4", bg: "#06b6d420" },
  done: { label: "Terminé", color: "#10b981", bg: "#10b98120" },
  error: { label: "Erreur", color: "#f43f5e", bg: "#f43f5e20" },
  manual_needed: { label: "Externe nécessaire", color: "#f59e0b", bg: "#f59e0b20" },
  claude_assigned: { label: "Assigné Claude conv", color: "#a78bfa", bg: "#a78bfa20" },
};

export function SpecialKpisClient({ initialRows }: { initialRows: SpecialKpi[] }) {
  const [rows, setRows] = useState<SpecialKpi[]>(initialRows);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SpecialKpi | null>(null);
  const [previewing, setPreviewing] = useState<SpecialKpi | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    const r = await fetch("/api/desk/special-kpis").then((x) => x.json());
    setRows(r.rows);
  }

  async function upsert(payload: Partial<SpecialKpi>) {
    const r = await fetch("/api/desk/special-kpis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      alert(`Erreur sauvegarde : ${await r.text()}`);
      return null;
    }
    await refresh();
    return (await r.json()).row as SpecialKpi;
  }

  async function del(id: string) {
    if (!confirm("Supprimer ce KPI ?")) return;
    await fetch("/api/desk/special-kpis", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await refresh();
  }

  async function runGroq(id: string) {
    setBusyId(id);
    try {
      const r = await fetch("/api/desk/special-kpis/run-groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const j = await r.json();
      if (!r.ok) alert(`Erreur Groq : ${j.error ?? "?"}`);
    } finally {
      setBusyId(null);
      await refresh();
    }
  }

  async function togglePublish(row: SpecialKpi) {
    await upsert({
      id: row.id,
      published: !row.published,
      published_at: !row.published ? new Date().toISOString() : null,
    });
  }

  function buildPromptForExternal(row: SpecialKpi): string {
    // On a déjà la version backend ; on recopie le texte pour copy/paste.
    const targets =
      row.mode === "multi" && row.target_tickers.length
        ? row.target_tickers.join(", ")
        : row.ticker ?? "(non défini)";
    return `Tu es un analyste financier. Trouve les valeurs historiques du KPI suivant pour Mettrik AI.

KPI : ${row.kpi_short} (${row.kpi_name_fr ?? row.kpi_name_en ?? ""})
Société(s) : ${targets}
Unité : ${row.kpi_unit ?? "à déduire"}
Style : ${row.style} (${row.chart_type})

Description : ${row.description ?? "(libre)"}

Cherche dans les rapports officiels (10-K/Q, 8-K, slides) en priorité, puis sources reconnues (IDC, Statista, Counterpoint...).
Pour chaque année des 5 dernières :
- Si officiel : uncertainty_pct = null, source = citation
- Si estimation : uncertainty_pct = ±X %, source = analyste/IDC, uncertainty_note explicite

Réponds en JSON strict :
{
  "values_by_period": [{"period":"2020","value":196.7,"uncertainty_pct":null,"source":"Apple 10-K FY20"}, ...],
  "hero_summary": "...",
  "interpretation": "...",
  "yoy_latest": "+5,2 %",
  "cagr_5y_pct": 3.8,
  "data_source": "..."
}
Pas de texte hors JSON. Pas d'em-dash.`;
  }

  return (
    <div className="relative min-h-screen bg-[#050505] text-zinc-100">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Link
          href="/sandbox"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="size-4" /> Retour sandbox
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold">
              <Sparkles className="mr-2 inline size-7 text-violet-400" />
              KPIs spéciaux
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
              KPIs qui nécessitent une recherche manuelle (10-K/Q + web) car non
              extraits par le pipeline LLM standard. Ex : iPhone units vendus,
              Netflix abonnés, livraisons par modèle Tesla. Lance l'extraction
              automatique (Groq Llama 3.3 70B gratuit) OU via Claude conv (MAX
              20×, copie le prompt) OU externe (ChatGPT/Claude web).
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3.5 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/15"
          >
            <Plus className="size-4" /> Nouveau KPI
          </button>
        </div>

        {showForm && (
          <KpiForm
            row={editing}
            onCancel={() => {
              setShowForm(false);
              setEditing(null);
            }}
            onSave={async (payload) => {
              await upsert(payload);
              setShowForm(false);
              setEditing(null);
            }}
          />
        )}

        <div className="mt-8 overflow-hidden rounded-2xl border border-white/[0.06]">
          <table className="w-full text-[12.5px]">
            <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-3 py-2.5 text-left">Cible</th>
                <th className="px-3 py-2.5 text-left">KPI</th>
                <th className="px-3 py-2.5 text-left">Style</th>
                <th className="px-3 py-2.5 text-left">Statut</th>
                <th className="px-3 py-2.5 text-center">Pts</th>
                <th className="px-3 py-2.5 text-center">Publié</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">
                    Aucun KPI spécial pour le moment. Clique sur "Nouveau KPI" pour démarrer.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const st = STATUS_META[r.status];
                const points = r.data?.values_by_period?.length ?? 0;
                return (
                  <tr key={r.id} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2 font-mono font-semibold">
                      {r.mode === "multi" ? (
                        <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10.5px] text-violet-200">
                          Multi ({r.target_tickers.length})
                        </span>
                      ) : (
                        r.ticker ?? "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-zinc-100">{r.kpi_short}</div>
                      <div className="text-[10.5px] text-zinc-500">{r.kpi_name_fr ?? r.kpi_name_en}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10.5px] text-zinc-300">
                        {r.style} · {r.chart_type}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10.5px] font-medium"
                        style={{ color: st.color, background: st.bg }}
                      >
                        {st.label}
                      </span>
                      {r.error_msg && (
                        <div className="mt-0.5 text-[10px] text-rose-300/80" title={r.error_msg}>
                          {r.error_msg.slice(0, 60)}…
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center font-mono">{points || "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => togglePublish(r)}
                        className={`inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          r.published ? "bg-emerald-500/60" : "bg-zinc-700"
                        }`}
                        title={r.published ? "Cliquer pour dépublier" : "Cliquer pour publier"}
                      >
                        <span
                          className={`block size-4 rounded-full bg-white transition-transform ${
                            r.published ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <IconBtn
                          onClick={() => setPreviewing(r)}
                          title="Preview"
                          disabled={points === 0}
                        >
                          <Eye className="size-3.5" />
                        </IconBtn>
                        <IconBtn
                          onClick={() => runGroq(r.id)}
                          title="Lancer Groq Llama 3.3 70B (gratuit)"
                          disabled={busyId === r.id}
                        >
                          {busyId === r.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Play className="size-3.5" />
                          )}
                        </IconBtn>
                        <IconBtn
                          onClick={() => {
                            navigator.clipboard.writeText(buildPromptForExternal(r));
                            alert("Prompt copié → colle dans Claude / ChatGPT externe");
                          }}
                          title="Copier prompt pour externe"
                        >
                          <Copy className="size-3.5" />
                        </IconBtn>
                        <IconBtn
                          onClick={() => {
                            setEditing(r);
                            setShowForm(true);
                          }}
                          title="Éditer"
                        >
                          <Save className="size-3.5" />
                        </IconBtn>
                        <IconBtn onClick={() => del(r.id)} title="Supprimer">
                          <Trash2 className="size-3.5 text-rose-400" />
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[11px] text-zinc-500">
          <strong>Toggle Publié</strong> = pousse sur la page société publique (hero / liste KPI / story selon le style).
          Tu peux voir l'aperçu avec l'œil avant de publier.
        </p>
      </div>

      {previewing && (
        <PreviewModal kpi={previewing} onClose={() => setPreviewing(null)} />
      )}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="rounded-md p-1.5 text-zinc-300 transition-colors hover:bg-white/10 hover:text-zinc-50 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/* ─── Form ─────────────────────────────────────────────────────────── */
function KpiForm({
  row,
  onCancel,
  onSave,
}: {
  row: SpecialKpi | null;
  onCancel: () => void;
  onSave: (p: Partial<SpecialKpi>) => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>(row?.mode ?? "single");
  const [ticker, setTicker] = useState(row?.ticker ?? "");
  const [targets, setTargets] = useState((row?.target_tickers ?? []).join(", "));
  const [kpiShort, setKpiShort] = useState(row?.kpi_short ?? "");
  const [kpiNameFr, setKpiNameFr] = useState(row?.kpi_name_fr ?? "");
  const [kpiNameEn, setKpiNameEn] = useState(row?.kpi_name_en ?? "");
  const [kpiUnit, setKpiUnit] = useState(row?.kpi_unit ?? "");
  const [kpiCat, setKpiCat] = useState(row?.kpi_category ?? "Volume");
  const [style, setStyle] = useState<SpecialKpiStyle>(row?.style ?? "classique");
  const [chart, setChart] = useState<SpecialKpiChart>(row?.chart_type ?? "curve");
  const [storyCat, setStoryCat] = useState(row?.story_category ?? "");
  const [desc, setDesc] = useState(row?.description ?? "");

  return (
    <div className="mt-6 rounded-2xl border border-violet-500/30 bg-violet-500/[0.04] p-4">
      <div className="mb-3 text-[12.5px] font-semibold uppercase tracking-wider text-violet-200">
        {row ? "Édition KPI" : "Nouveau KPI"}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-[11.5px]">
          <div className="mb-1 text-zinc-400">Mode</div>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12.5px] text-zinc-100"
          >
            <option value="single">1 sté</option>
            <option value="multi">Liste de tickers</option>
          </select>
        </label>
        {mode === "single" ? (
          <label className="text-[11.5px]">
            <div className="mb-1 text-zinc-400">Ticker</div>
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="AAPL"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[12.5px] text-zinc-100"
            />
          </label>
        ) : (
          <label className="text-[11.5px]">
            <div className="mb-1 text-zinc-400">Tickers (séparés virgule)</div>
            <input
              value={targets}
              onChange={(e) => setTargets(e.target.value.toUpperCase())}
              placeholder="AAPL, GOOGL, META"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[12.5px] text-zinc-100"
            />
          </label>
        )}
        <label className="text-[11.5px]">
          <div className="mb-1 text-zinc-400">KPI short (acronyme)</div>
          <input
            value={kpiShort}
            onChange={(e) => setKpiShort(e.target.value)}
            placeholder="iPhone Units"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12.5px] text-zinc-100"
          />
        </label>
        <label className="text-[11.5px]">
          <div className="mb-1 text-zinc-400">Nom FR</div>
          <input
            value={kpiNameFr}
            onChange={(e) => setKpiNameFr(e.target.value)}
            placeholder="Unités iPhone vendues"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12.5px] text-zinc-100"
          />
        </label>
        <label className="text-[11.5px]">
          <div className="mb-1 text-zinc-400">Nom EN</div>
          <input
            value={kpiNameEn}
            onChange={(e) => setKpiNameEn(e.target.value)}
            placeholder="iPhone units sold"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12.5px] text-zinc-100"
          />
        </label>
        <label className="text-[11.5px]">
          <div className="mb-1 text-zinc-400">Unité</div>
          <input
            value={kpiUnit}
            onChange={(e) => setKpiUnit(e.target.value)}
            placeholder="M unités"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12.5px] text-zinc-100"
          />
        </label>
        <label className="text-[11.5px]">
          <div className="mb-1 text-zinc-400">Catégorie</div>
          <select
            value={kpiCat}
            onChange={(e) => setKpiCat(e.target.value)}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12.5px] text-zinc-100"
          >
            <option>Revenue</option>
            <option>Volume</option>
            <option>User</option>
            <option>Demand</option>
            <option>Margin</option>
            <option>Cash</option>
            <option>Investment</option>
          </select>
        </label>
        <label className="text-[11.5px]">
          <div className="mb-1 text-zinc-400">Style</div>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as SpecialKpiStyle)}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12.5px] text-zinc-100"
          >
            <option value="classique">Classique (indicateur clé)</option>
            <option value="story">Story (carrousel)</option>
          </select>
        </label>
        <label className="text-[11.5px]">
          <div className="mb-1 text-zinc-400">Type de chart</div>
          <select
            value={chart}
            onChange={(e) => setChart(e.target.value as SpecialKpiChart)}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12.5px] text-zinc-100"
          >
            <option value="curve">Courbe</option>
            <option value="bars">Barres</option>
            <option value="variation">Variation</option>
          </select>
        </label>
        {style === "story" && (
          <label className="text-[11.5px]">
            <div className="mb-1 text-zinc-400">Catégorie story</div>
            <select
              value={storyCat}
              onChange={(e) => setStoryCat(e.target.value)}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12.5px] text-zinc-100"
            >
              <option value="">(aucune)</option>
              <option>Marché</option>
              <option>Adoption</option>
              <option>Capacité</option>
              <option>Innovation</option>
            </select>
          </label>
        )}
      </div>
      <label className="mt-3 block text-[11.5px]">
        <div className="mb-1 text-zinc-400">Description / consignes pour le LLM</div>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
          placeholder="Ex : trouver les unités d'iPhone vendues par année (5 dernières années). Apple a cessé de publier depuis FY18 → estimer via IDC/Counterpoint et noter incertitude."
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12.5px] text-zinc-100"
        />
      </label>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-white/5"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              id: row?.id,
              mode,
              ticker: mode === "single" ? ticker || null : null,
              target_tickers:
                mode === "multi"
                  ? targets
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean)
                  : [],
              kpi_short: kpiShort,
              kpi_name_fr: kpiNameFr || null,
              kpi_name_en: kpiNameEn || null,
              kpi_unit: kpiUnit || null,
              kpi_category: kpiCat,
              style,
              chart_type: chart,
              story_category: storyCat || null,
              description: desc || null,
            })
          }
          className="rounded-lg bg-violet-500/30 px-3 py-1.5 text-[12px] font-semibold text-violet-100 hover:bg-violet-500/40"
        >
          Sauvegarder
        </button>
      </div>
    </div>
  );
}

/* ─── Preview modal ─────────────────────────────────────────────────── */
function PreviewModal({ kpi, onClose }: { kpi: SpecialKpi; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-6 backdrop-blur-sm">
      <div className="relative mx-auto max-w-4xl rounded-2xl border border-white/10 bg-[#0a0a0a] p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-300 hover:bg-white/10"
        >
          <X className="size-5" />
        </button>
        <h2 className="font-display text-2xl font-semibold">
          Preview : {kpi.kpi_short}
        </h2>
        <p className="mt-1 text-[12.5px] text-zinc-400">
          Aperçu réel tel qu'il apparaîtra sur la page société {kpi.ticker} si publié.
        </p>
        <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/[0.03] p-4">
          <SpecialKpiPreview kpi={kpi} />
        </div>
        {kpi.data.values_by_period && kpi.data.values_by_period.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-lg border border-white/[0.06]">
            <table className="w-full text-[11.5px]">
              <thead className="bg-white/[0.03] text-zinc-400">
                <tr>
                  <th className="px-2 py-1.5 text-left">Période</th>
                  <th className="px-2 py-1.5 text-right">Valeur</th>
                  <th className="px-2 py-1.5 text-right">Incertitude</th>
                  <th className="px-2 py-1.5 text-left">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {kpi.data.values_by_period.map((p: SpecialKpiPoint, i: number) => (
                  <tr key={i}>
                    <td className="px-2 py-1 font-mono">{p.period}</td>
                    <td className="px-2 py-1 text-right font-mono">{p.value}</td>
                    <td className="px-2 py-1 text-right font-mono text-amber-300">
                      {p.uncertainty_pct ? `± ${p.uncertainty_pct} %` : "—"}
                    </td>
                    <td className="px-2 py-1 text-[10px] text-zinc-500">
                      {p.source ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
