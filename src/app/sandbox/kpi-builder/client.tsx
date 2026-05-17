"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Play,
  Sparkles,
  X,
  Search,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
  RotateCw,
  Ban,
} from "lucide-react";

/* ─── Types partagés client / API F2 ─────────────────────────────── */

export type KpiBuilderStatus = "pending" | "processing" | "done" | "error";

export type KpiBuilderTicker = {
  ticker: string;
  name?: string | null;
};

export type KpiBuilderType =
  | "Revenue"
  | "Margin"
  | "Cash"
  | "Capex"
  | "Headcount"
  | "Custom";

export type KpiBuilderPayload = {
  description: string;
  tickers: string[];
  kpi: {
    short: string;
    name_en: string;
    name_fr?: string | null;
    explanation: string;
    type: KpiBuilderType;
    expected_unit: string;
    extraction_prompt: string;
    fallback_story_if_short_history: boolean;
  };
};

export type KpiRequestRow = {
  id: string;
  created_at: string;
  description: string;
  kpi_short: string;
  kpi_name_en: string;
  kpi_name_fr?: string | null;
  kpi_type: string;
  expected_unit: string;
  tickers: string[];
  tickers_processed: number;
  status: KpiBuilderStatus;
  fallback_story_if_short_history: boolean;
  explanation?: string | null;
  extraction_prompt?: string | null;
  error_message?: string | null;
};

const KPI_TYPES: KpiBuilderType[] = [
  "Revenue",
  "Margin",
  "Cash",
  "Capex",
  "Headcount",
  "Custom",
];

const EXPECTED_UNITS = [
  "Mds $",
  "M $",
  "Mds €",
  "M €",
  "Mds £",
  "Mds CHF",
  "%",
  "Nombre",
  "Ratio",
  "Jours",
  "Autre",
] as const;

const STATUS_META: Record<
  KpiBuilderStatus,
  { label: string; color: string }
> = {
  pending: { label: "En attente", color: "#a78bfa" },
  processing: { label: "En cours", color: "#06b6d4" },
  done: { label: "Terminé", color: "#10b981" },
  error: { label: "Erreur", color: "#f43f5e" },
};

/* ─── Composant principal ────────────────────────────────────────── */

export function KpiBuilderClient({
  initialRequests,
}: {
  initialRequests: KpiRequestRow[];
}) {
  const [requests, setRequests] = useState<KpiRequestRow[]>(initialRequests);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Formulaire
  const [description, setDescription] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionConfidence, setSuggestionConfidence] = useState<number | null>(
    null,
  );

  const [tickers, setTickers] = useState<KpiBuilderTicker[]>([]);
  const [selectedTickers, setSelectedTickers] = useState<Set<string>>(new Set());
  const [manualTicker, setManualTicker] = useState("");

  const [kpiShort, setKpiShort] = useState("");
  const [kpiNameEn, setKpiNameEn] = useState("");
  const [kpiNameFr, setKpiNameFr] = useState("");
  const [explanation, setExplanation] = useState("");
  const [kpiType, setKpiType] = useState<KpiBuilderType>("Revenue");
  const [expectedUnit, setExpectedUnit] = useState<string>("Mds $");
  const [extractionPrompt, setExtractionPrompt] = useState("");
  const [fallbackStory, setFallbackStory] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /* ─── Auto-refresh liste toutes 10s ────────────────────────────── */
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/desk-mtk9x4kp/kpi-requests", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as { rows?: KpiRequestRow[] };
        if (Array.isArray(json.rows)) setRequests(json.rows);
      } catch {
        // ignore : auto-refresh non bloquant
      }
    }, 10_000);
    return () => clearInterval(id);
  }, []);

  /* ─── Tickers : suggestion via API ─────────────────────────────── */
  async function suggestTickers() {
    if (!description.trim()) return;
    setSuggesting(true);
    setSuggestionConfidence(null);
    try {
      const res = await fetch("/api/desk-mtk9x4kp/kpi-search-tickers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim() }),
      });
      if (!res.ok) {
        alert(
          `Suggestion impossible : ${res.status} ${await res.text().catch(() => "")}`,
        );
        return;
      }
      const json = (await res.json()) as {
        tickers?: Array<string | KpiBuilderTicker>;
        confidence?: number;
      };
      const raw = Array.isArray(json.tickers) ? json.tickers : [];
      const normalised: KpiBuilderTicker[] = raw.map((t) =>
        typeof t === "string"
          ? { ticker: t.toUpperCase(), name: null }
          : { ticker: t.ticker.toUpperCase(), name: t.name ?? null },
      );
      setTickers(normalised);
      setSelectedTickers(new Set(normalised.map((t) => t.ticker)));
      if (typeof json.confidence === "number") {
        setSuggestionConfidence(json.confidence);
      }
    } catch (err) {
      alert(`Erreur réseau : ${(err as Error).message}`);
    } finally {
      setSuggesting(false);
    }
  }

  function toggleTicker(t: string) {
    setSelectedTickers((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function removeTicker(t: string) {
    setTickers((prev) => prev.filter((x) => x.ticker !== t));
    setSelectedTickers((prev) => {
      const next = new Set(prev);
      next.delete(t);
      return next;
    });
  }

  function addManualTicker() {
    const raw = manualTicker.trim().toUpperCase();
    if (!raw) return;
    if (tickers.some((t) => t.ticker === raw)) {
      setManualTicker("");
      return;
    }
    setTickers((prev) => [...prev, { ticker: raw, name: null }]);
    setSelectedTickers((prev) => new Set(prev).add(raw));
    setManualTicker("");
  }

  /* ─── Validation + submit ─────────────────────────────────────── */
  const selectedTickerList = useMemo(
    () => tickers.filter((t) => selectedTickers.has(t.ticker)).map((t) => t.ticker),
    [tickers, selectedTickers],
  );

  function validate(): string | null {
    if (!description.trim()) return "Décris ta demande en langage naturel.";
    if (selectedTickerList.length === 0)
      return "Sélectionne au moins un ticker.";
    if (!kpiShort.trim()) return "Le short du KPI est requis (ex : RPO).";
    if (!kpiNameEn.trim()) return "Le nom EN du KPI est requis.";
    if (!explanation.trim()) return "L'explication du KPI est requise.";
    if (!extractionPrompt.trim())
      return "Le prompt d'extraction LLM est requis.";
    return null;
  }

  async function launchExtraction() {
    const err = validate();
    if (err) {
      setSubmitError(err);
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    const payload: KpiBuilderPayload = {
      description: description.trim(),
      tickers: selectedTickerList,
      kpi: {
        short: kpiShort.trim(),
        name_en: kpiNameEn.trim(),
        name_fr: kpiNameFr.trim() ? kpiNameFr.trim() : null,
        explanation: explanation.trim(),
        type: kpiType,
        expected_unit: expectedUnit,
        extraction_prompt: extractionPrompt.trim(),
        fallback_story_if_short_history: fallbackStory,
      },
    };
    try {
      const res = await fetch("/api/desk-mtk9x4kp/kpi-add-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setSubmitError(
          `Erreur ${res.status} : ${await res.text().catch(() => "")}`,
        );
        return;
      }
      // Reset formulaire
      setDescription("");
      setTickers([]);
      setSelectedTickers(new Set());
      setKpiShort("");
      setKpiNameEn("");
      setKpiNameFr("");
      setExplanation("");
      setKpiType("Revenue");
      setExpectedUnit("Mds $");
      setExtractionPrompt("");
      setFallbackStory(true);
      setSuggestionConfidence(null);
      try {
        const r = await fetch("/api/desk-mtk9x4kp/kpi-requests", {
          cache: "no-store",
        });
        const j = (await r.json()) as { rows?: KpiRequestRow[] };
        if (Array.isArray(j.rows)) setRequests(j.rows);
      } catch {
        // ignore
      }
    } catch (e) {
      setSubmitError(`Erreur réseau : ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  /* ─── Actions sur lignes existantes ────────────────────────────── */
  async function cancelRequest(id: string) {
    if (
      !confirm("Annuler cette demande ? Les stés non encore traitées seront skip.")
    )
      return;
    await fetch("/api/desk-mtk9x4kp/kpi-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", id }),
    });
    const r = await fetch("/api/desk-mtk9x4kp/kpi-requests", {
      cache: "no-store",
    });
    const j = (await r.json()) as { rows?: KpiRequestRow[] };
    if (Array.isArray(j.rows)) setRequests(j.rows);
  }

  async function relaunchRequest(id: string) {
    if (!confirm("Relancer l'extraction sur les stés en erreur ?")) return;
    await fetch("/api/desk-mtk9x4kp/kpi-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "relaunch", id }),
    });
    const r = await fetch("/api/desk-mtk9x4kp/kpi-requests", {
      cache: "no-store",
    });
    const j = (await r.json()) as { rows?: KpiRequestRow[] };
    if (Array.isArray(j.rows)) setRequests(j.rows);
  }

  /* ─── Render ───────────────────────────────────────────────────── */
  return (
    <div className="relative min-h-screen bg-[#050505] text-zinc-100">
      {/* Halos glassmorphism violet/cyan */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-0"
        style={{
          background:
            "radial-gradient(60% 40% at 15% 10%, rgba(167,139,250,0.10) 0%, transparent 60%), " +
            "radial-gradient(50% 35% at 85% 90%, rgba(34,211,238,0.08) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-10">
        <Link
          href="/sandbox"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="size-4" /> Retour sandbox
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold">
              <Sparkles className="mr-2 inline size-7 text-violet-300" />
              Ajouter un KPI multi-stés
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
              Crée une demande d&apos;extraction d&apos;un nouveau KPI sur
              plusieurs sociétés à la fois. Décris ta demande en langage
              naturel, laisse Claude suggérer la liste de tickers, ajuste,
              renseigne la définition du KPI puis lance l&apos;extraction.
              Le résultat sera publié sur les fiches sté concernées.
            </p>
          </div>
        </div>

        {/* ════════ FORMULAIRE ════════ */}
        <section className="mt-8 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/[0.05] via-white/[0.02] to-cyan-500/[0.04] p-5 backdrop-blur-sm">
          <label className="block">
            <div className="mb-1 text-[12.5px] font-semibold uppercase tracking-wider text-violet-200">
              Description en langage naturel *
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder='Ex : "Ajoute le KPI RPO des grandes sociétés cloud / IA"'
              className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500/40 focus:outline-none"
            />
          </label>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={suggesting || !description.trim()}
              onClick={suggestTickers}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/15 disabled:opacity-30"
            >
              {suggesting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              Suggérer tickers
            </button>
            {suggestionConfidence !== null && (
              <span className="text-[11px] text-zinc-400">
                Confiance Claude :{" "}
                <span className="font-mono text-cyan-300">
                  {(suggestionConfidence * 100).toFixed(0)} %
                </span>
              </span>
            )}
            <span className="ml-auto text-[11px] text-zinc-500">
              {selectedTickerList.length} ticker
              {selectedTickerList.length > 1 ? "s" : ""} sélectionné
              {selectedTickerList.length > 1 ? "s" : ""}
            </span>
          </div>

          {tickers.length > 0 && (
            <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/20 p-3">
              <div className="mb-2 text-[10.5px] uppercase tracking-wider text-zinc-500">
                Tickers candidats
              </div>
              <ul className="grid max-h-64 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
                {tickers.map((t) => {
                  const on = selectedTickers.has(t.ticker);
                  return (
                    <li
                      key={t.ticker}
                      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${
                        on
                          ? "border-cyan-500/30 bg-cyan-500/[0.04]"
                          : "border-white/[0.06] bg-white/[0.01]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleTicker(t.ticker)}
                        className="size-3.5 rounded border-white/[0.15] bg-black/40 text-cyan-500"
                      />
                      <span className="font-mono text-[11.5px] font-semibold uppercase tracking-wider text-cyan-300">
                        {t.ticker}
                      </span>
                      {t.name && (
                        <span className="min-w-0 flex-1 truncate text-[11.5px] text-zinc-300">
                          {t.name}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeTicker(t.ticker)}
                        className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-rose-300"
                        title="Retirer"
                      >
                        <X className="size-3" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <input
              value={manualTicker}
              onChange={(e) => setManualTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addManualTicker();
                }
              }}
              placeholder="Ajouter ticker manuel (ex : ORCL)"
              className="w-56 rounded-md border border-white/[0.08] bg-black/30 px-2.5 py-1.5 font-mono text-[12px] text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-500/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={addManualTicker}
              disabled={!manualTicker.trim()}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-zinc-200 hover:bg-white/[0.08] disabled:opacity-30"
            >
              <Plus className="size-3.5" />
              Ajouter
            </button>
          </div>

          {/* Définition KPI */}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block">
              <div className="mb-1 text-[11px] uppercase tracking-wider text-violet-200">
                Short *{" "}
                <span className="text-zinc-500 normal-case">(ex : RPO)</span>
              </div>
              <input
                value={kpiShort}
                onChange={(e) => setKpiShort(e.target.value)}
                placeholder="RPO"
                className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 font-mono text-[13px] text-zinc-100"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-[11px] uppercase tracking-wider text-violet-200">
                Nom EN *{" "}
                <span className="text-zinc-500 normal-case">(canonique)</span>
              </div>
              <input
                value={kpiNameEn}
                onChange={(e) => setKpiNameEn(e.target.value)}
                placeholder="Remaining Performance Obligations"
                className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[13px] text-zinc-100"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-[11px] uppercase tracking-wider text-violet-200">
                Nom FR{" "}
                <span className="text-zinc-500 normal-case">
                  (optionnel, auto-traduit via Groq si vide)
                </span>
              </div>
              <input
                value={kpiNameFr}
                onChange={(e) => setKpiNameFr(e.target.value)}
                placeholder="Obligations de performance restantes"
                className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[13px] text-zinc-100"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="mb-1 text-[11px] uppercase tracking-wider text-violet-200">
                  Type *
                </div>
                <select
                  value={kpiType}
                  onChange={(e) => setKpiType(e.target.value as KpiBuilderType)}
                  className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[13px] text-zinc-100"
                >
                  {KPI_TYPES.map((t) => (
                    <option key={t} value={t} className="bg-zinc-900">
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <div className="mb-1 text-[11px] uppercase tracking-wider text-violet-200">
                  Unité attendue *
                </div>
                <select
                  value={expectedUnit}
                  onChange={(e) => setExpectedUnit(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[13px] text-zinc-100"
                >
                  {EXPECTED_UNITS.map((u) => (
                    <option key={u} value={u} className="bg-zinc-900">
                      {u}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <label className="mt-4 block">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-violet-200">
              <Info className="size-3 text-violet-300" />
              Explication *{" "}
              <span className="text-zinc-500 normal-case">
                (EN, affichée dans tooltip &quot;i&quot;)
              </span>
            </div>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={2}
              placeholder="Remaining Performance Obligations are contracted future revenues not yet recognized…"
              className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[13px] text-zinc-100"
            />
          </label>

          <label className="mt-4 block">
            <div className="mb-1 text-[11px] uppercase tracking-wider text-violet-200">
              Prompt d&apos;extraction LLM
            </div>
            <textarea
              value={extractionPrompt}
              onChange={(e) => setExtractionPrompt(e.target.value)}
              rows={3}
              placeholder='Ex : "Extract Remaining Performance Obligations from latest earnings call transcript or 10-Q filing. Return total RPO in billions USD and the share expected to be recognized within 12 months."'
              className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] text-zinc-100"
            />
          </label>

          <label className="mt-4 flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={fallbackStory}
              onChange={(e) => setFallbackStory(e.target.checked)}
              className="size-4 rounded border-white/[0.15] bg-black/40 text-violet-500"
            />
            <span className="text-[12px] text-zinc-200">
              Fallback Story si &lt;5y history
              <span className="ml-2 text-[10.5px] text-zinc-500">
                (le KPI rejoint le bloc Stories plutôt que hero/table si
                moins de 5 ans d&apos;historique)
              </span>
            </span>
          </label>

          {submitError && (
            <div className="mt-4 rounded-md border border-rose-500/40 bg-rose-500/[0.08] px-3 py-2 text-[12px] text-rose-200">
              {submitError}
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              disabled={submitting}
              onClick={launchExtraction}
              className="inline-flex items-center gap-2 rounded-lg border border-violet-500/50 bg-gradient-to-br from-violet-500/30 to-cyan-500/20 px-4 py-2.5 text-sm font-semibold text-violet-50 hover:from-violet-500/40 hover:to-cyan-500/30 disabled:opacity-30"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              Lancer extraction
            </button>
          </div>
        </section>

        {/* ════════ LISTE DES DEMANDES ════════ */}
        <section className="mt-10">
          <h2 className="mb-3 font-display text-[16px] font-bold tracking-tight text-zinc-100">
            Demandes existantes
            <span className="ml-2 font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
              auto-refresh 10s
            </span>
          </h2>

          {requests.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[12.5px] text-zinc-500">
              Aucune demande pour l&apos;instant. Crée-en une via le
              formulaire ci-dessus.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              <table className="w-full text-left text-[12px]">
                <thead className="border-b border-white/[0.06] bg-black/30 text-[10.5px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2">KPI</th>
                    <th className="px-3 py-2 text-right">Stés</th>
                    <th className="px-3 py-2">Statut</th>
                    <th className="px-3 py-2">Progression</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <RequestRow
                      key={r.id}
                      row={r}
                      expanded={expandedId === r.id}
                      onToggle={() =>
                        setExpandedId(expandedId === r.id ? null : r.id)
                      }
                      onCancel={() => cancelRequest(r.id)}
                      onRelaunch={() => relaunchRequest(r.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ─── Ligne tableau + détails dépliables ─────────────────────────── */
function RequestRow({
  row,
  expanded,
  onToggle,
  onCancel,
  onRelaunch,
}: {
  row: KpiRequestRow;
  expanded: boolean;
  onToggle: () => void;
  onCancel: () => void;
  onRelaunch: () => void;
}) {
  const st = STATUS_META[row.status];
  const total = row.tickers?.length ?? 0;
  const done = row.tickers_processed ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const date = new Date(row.created_at);
  const dateLabel = isNaN(date.getTime())
    ? row.created_at
    : date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      });

  return (
    <>
      <tr
        className="cursor-pointer border-b border-white/[0.04] hover:bg-white/[0.02]"
        onClick={onToggle}
      >
        <td className="px-3 py-2 font-mono text-[11px] text-zinc-400">
          {dateLabel}
        </td>
        <td className="px-3 py-2 text-zinc-200">
          <span className="line-clamp-1">{row.description}</span>
        </td>
        <td className="px-3 py-2">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-violet-300">
            {row.kpi_short}
          </span>
          <span className="ml-1.5 text-[11px] text-zinc-500">
            {row.expected_unit}
          </span>
        </td>
        <td className="px-3 py-2 text-right font-mono text-[11px] text-zinc-300">
          {total}
        </td>
        <td className="px-3 py-2">
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
            style={{ color: st.color, background: `${st.color}22` }}
          >
            {st.label}
          </span>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full bg-gradient-to-r from-violet-400 to-cyan-400"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="font-mono text-[10.5px] text-zinc-400">
              {done}/{total}
            </span>
          </div>
        </td>
        <td className="px-3 py-2">
          <div
            className="flex items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {row.status === "pending" && (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-500/15"
                title="Annuler"
              >
                <Ban className="size-3" /> Annuler
              </button>
            )}
            {row.status === "error" && (
              <button
                type="button"
                onClick={onRelaunch}
                className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-500/15"
                title="Re-lancer"
              >
                <RotateCw className="size-3" /> Re-lancer
              </button>
            )}
            <button
              type="button"
              onClick={onToggle}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-white/10"
              title={expanded ? "Replier" : "Voir détails"}
            >
              {expanded ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-white/[0.04] bg-black/30">
          <td colSpan={7} className="px-4 py-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-zinc-500">
                  KPI complet
                </div>
                <div className="mt-1 text-[12.5px] text-zinc-200">
                  <span className="font-mono font-semibold text-violet-300">
                    {row.kpi_short}
                  </span>{" "}
                  · {row.kpi_name_en}
                  {row.kpi_name_fr && (
                    <span className="text-zinc-400"> · {row.kpi_name_fr}</span>
                  )}
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">
                  Type : {row.kpi_type} · Unité : {row.expected_unit} ·
                  Fallback story :{" "}
                  {row.fallback_story_if_short_history ? "oui" : "non"}
                </div>
                {row.explanation && (
                  <div className="mt-2 text-[11.5px] italic text-zinc-400">
                    {row.explanation}
                  </div>
                )}
              </div>
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-zinc-500">
                  Tickers ({row.tickers?.length ?? 0})
                </div>
                <div className="mt-1 flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                  {(row.tickers ?? []).map((t) => (
                    <span
                      key={t}
                      className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10.5px] text-zinc-300"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                {row.extraction_prompt && (
                  <div className="mt-3">
                    <div className="text-[10.5px] uppercase tracking-wider text-zinc-500">
                      Prompt d&apos;extraction
                    </div>
                    <div className="mt-1 rounded border border-white/[0.06] bg-black/40 p-2 text-[11px] text-zinc-300">
                      {row.extraction_prompt}
                    </div>
                  </div>
                )}
                {row.error_message && (
                  <div className="mt-3 rounded border border-rose-500/40 bg-rose-500/[0.08] p-2 text-[11px] text-rose-200">
                    {row.error_message}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
