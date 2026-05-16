"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Play,
  Trash2,
  Check,
  X,
  ImageIcon,
  ExternalLink,
  Sparkles,
  Search,
} from "lucide-react";
import type {
  ImageFindingRequest,
  ImageFinding,
} from "@/lib/desk/image-findings";

const ALL_LOCALES = ["fr", "en", "de", "nl", "sv", "da", "en-GB", "de-CH"] as const;
type Locale = (typeof ALL_LOCALES)[number];

const STATUS_META: Record<
  ImageFindingRequest["status"],
  { label: string; color: string }
> = {
  todo: { label: "À configurer", color: "#a1a1aa" },
  claude_pending: { label: "Attente Claude (tape : lance demande N)", color: "#a78bfa" },
  in_progress: { label: "Claude en cours", color: "#06b6d4" },
  pending_review: { label: "À approuver", color: "#f59e0b" },
  done: { label: "Publié", color: "#10b981" },
  error: { label: "Erreur", color: "#f43f5e" },
};

/**
 * Méta batch (source_platform) : permet de tagger d'où vient chaque image
 * (recherche web, X anonyme, X loggé) et de comparer les 3 voies sur la
 * même demande.
 */
const BATCH_META: Record<
  string,
  { label: string; short: string; color: string }
> = {
  web: { label: "Web (recherche libre)", short: "Web", color: "#10b981" },
  "x-anon": { label: "X anonyme (sans compte)", short: "X anon", color: "#f59e0b" },
  "x-authed-en": { label: "X compte · recherche EN", short: "X EN", color: "#06b6d4" },
  "x-authed-fr": { label: "X compte · recherche FR", short: "X FR", color: "#3b82f6" },
  "x-authed": { label: "X compte (legacy)", short: "X compte", color: "#06b6d4" },
  reddit: { label: "Reddit (r/dataisbeautiful, r/singularity)", short: "Reddit", color: "#fb923c" },
  substack: { label: "Substack analystes (Stratechery, Sherwood News, Big Technology…)", short: "Substack", color: "#ef4444" },
  "bing-images": { label: "Bing Images API (meta-search web)", short: "Bing", color: "#0ea5e9" },
  huggingface: { label: "Hugging Face leaderboards (benchmarks IA)", short: "HF", color: "#facc15" },
  x: { label: "X (legacy)", short: "X", color: "#a78bfa" },
};

function batchOf(platform: string | null | undefined) {
  if (!platform) return BATCH_META.web;
  return BATCH_META[platform] ?? { label: platform, short: platform, color: "#a1a1aa" };
}

/**
 * Parse les batches actifs depuis request.notes. Format attendu :
 * "ACTIVE_BATCHES: x-anon,x-authed | ... reste libre"
 * Retourne la liste des batches en cours (vide si aucun).
 */
function parseActiveBatches(notes: string | null): string[] {
  if (!notes) return [];
  const m = notes.match(/ACTIVE_BATCHES:\s*([^|\n]+)/);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ImageFindingsClient({
  initialRequests,
  initialFindings,
}: {
  initialRequests: ImageFindingRequest[];
  initialFindings: Record<string, ImageFinding[]>;
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [findings, setFindings] = useState(initialFindings);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ImageFindingRequest | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function refresh() {
    const r = await fetch("/api/desk/image-findings").then((x) => x.json());
    setRequests(r.rows);
    // refresh findings for expanded request only (to save round-trips)
    if (expandedId) {
      const f = await fetch(`/api/desk/image-findings/${expandedId}/findings`).then(
        (x) => x.json(),
      );
      setFindings((prev) => ({ ...prev, [expandedId]: f.rows }));
    }
  }

  async function upsert(p: Partial<ImageFindingRequest>) {
    const r = await fetch("/api/desk/image-findings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    if (!r.ok) alert(`Erreur : ${await r.text()}`);
    await refresh();
  }

  async function del(id: string) {
    if (!confirm("Supprimer cette demande et toutes ses images ?")) return;
    await fetch("/api/desk/image-findings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await refresh();
  }

  async function launchClaude(id: string) {
    const req = requests.find((r) => r.id === id);
    const num = req?.display_number ?? "?";
    const query = req?.query ?? "";
    if (!confirm(`Lancer la recherche Claude pour la demande #${num} ?\n\n"${query.slice(0, 120)}${query.length > 120 ? "…" : ""}"\n\nClique OK pour confirmer.`)) {
      return;
    }
    await fetch("/api/desk/image-findings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_claude_pending", id }),
    });
    await refresh();
    alert(
      "Demande marquée. Va dans ta conv Claude MAX 20× et tape :\n\n" +
        `lance la demande ${
          requests.find((r) => r.id === id)?.display_number ?? id.slice(0, 8)
        }\n\nClaude fera la recherche WebSearch X + insérera les images.`,
    );
  }

  async function updateFinding(reqId: string, p: Partial<ImageFinding>) {
    await fetch(`/api/desk/image-findings/${reqId}/findings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    const f = await fetch(`/api/desk/image-findings/${reqId}/findings`).then((x) => x.json());
    setFindings((prev) => ({ ...prev, [reqId]: f.rows }));
    await refresh();
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
              <ImageIcon className="mr-2 inline size-7 text-cyan-400" />
              Graphiques et Schémas de sources diverses
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
              Recherche manuelle de graphiques / schémas (principalement X /
              Twitter) liés à une ou plusieurs sociétés. Tu rédiges une demande
              avec query libre (ex : "graphs en français sur la part de Google
              sur l'IA"), Claude conv MAX 20× la lance, tu approuves les images
              une à une, elles s'affichent ensuite sur les pages sté
              concernées.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/15"
          >
            <Plus className="size-4" /> Nouvelle demande
          </button>
        </div>

        {showForm && (
          <RequestForm
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

        <div className="mt-8 space-y-3">
          {requests.length === 0 && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[12.5px] text-zinc-500">
              Aucune demande pour l'instant. Clique "Nouvelle demande" pour
              démarrer.
            </div>
          )}
          {requests.map((r) => (
            <RequestRow
              key={r.id}
              request={r}
              findings={findings[r.id] ?? []}
              expanded={expandedId === r.id}
              onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
              onLaunch={() => launchClaude(r.id)}
              onEdit={() => {
                setEditing(r);
                setShowForm(true);
              }}
              onDelete={() => del(r.id)}
              onUpdateFinding={(p) => updateFinding(r.id, p)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Request row + expansion ───────────────────────────────────── */
function RequestRow({
  request: r,
  findings,
  expanded,
  onToggle,
  onLaunch,
  onEdit,
  onDelete,
  onUpdateFinding,
}: {
  request: ImageFindingRequest;
  findings: ImageFinding[];
  expanded: boolean;
  onToggle: () => void;
  onLaunch: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateFinding: (p: Partial<ImageFinding>) => Promise<void>;
}) {
  const st = STATUS_META[r.status];

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
      <div
        className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 hover:bg-white/[0.02]"
        onClick={onToggle}
      >
        <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 font-mono text-[11.5px] font-bold text-cyan-200">
          #{r.display_number ?? "—"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Search className="size-3.5 text-zinc-500" />
            <span className="text-[13.5px] font-medium text-zinc-100">{r.query}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <span className="font-mono">
              Tickers : {r.target_tickers.length > 0 ? r.target_tickers.join(", ") : "(aucun)"}
            </span>
            <span>·</span>
            <span>Langues : {r.languages.join(", ")}</span>
            <span>·</span>
            <span>
              {r.findings_count} images ({r.approved_count} approuvées)
            </span>
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold"
          style={{ color: st.color, background: `${st.color}20` }}
        >
          {st.label}
        </span>
        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onLaunch}
            disabled={r.status === "in_progress"}
            className="inline-flex items-center gap-1 rounded-md border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-[11px] text-violet-100 hover:bg-violet-500/15 disabled:opacity-30"
            title="Lancer Claude conv MAX 20× (gratuit)"
          >
            <Play className="size-3" /> Lancer
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md p-1.5 text-zinc-300 hover:bg-white/10"
            title="Éditer"
          >
            <Sparkles className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md p-1.5 text-zinc-300 hover:bg-white/10"
            title="Supprimer"
          >
            <Trash2 className="size-3.5 text-rose-400" />
          </button>
        </div>
      </div>

      {expanded && (
        <ExpandedFindings
          findings={findings}
          activeBatches={parseActiveBatches(r.notes)}
          defaultLanguages={r.languages}
          defaultTickers={r.target_tickers}
          onUpdateFinding={onUpdateFinding}
        />
      )}
    </div>
  );
}

/* ─── Findings section with batch filter + in-progress banners ───── */
function ExpandedFindings({
  findings,
  activeBatches,
  defaultLanguages,
  defaultTickers,
  onUpdateFinding,
}: {
  findings: ImageFinding[];
  activeBatches: string[];
  defaultLanguages: string[];
  defaultTickers: string[];
  onUpdateFinding: (p: Partial<ImageFinding>) => Promise<void>;
}) {
  const [batchFilter, setBatchFilter] = useState<string>("all");

  // Buckets par batch (source_platform).
  const buckets: Record<string, ImageFinding[]> = {};
  for (const f of findings) {
    const k = f.source_platform || "web";
    (buckets[k] ??= []).push(f);
  }
  const allBatchKeys = Array.from(
    new Set([...Object.keys(buckets), ...activeBatches]),
  );

  const filtered =
    batchFilter === "all" ? findings : (buckets[batchFilter] ?? []);

  return (
    <div className="border-t border-white/[0.06] bg-black/30 p-4">
      {/* Bandeaux "recherche en cours" par batch actif */}
      {activeBatches.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {activeBatches.map((b) => {
            const meta = batchOf(b);
            const count = (buckets[b] ?? []).length;
            return (
              <div
                key={b}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px]"
                style={{
                  background: `${meta.color}10`,
                  borderColor: `${meta.color}44`,
                  color: meta.color,
                }}
              >
                <span className="relative flex size-2">
                  <span
                    className="absolute inline-flex size-full animate-ping rounded-full opacity-75"
                    style={{ background: meta.color }}
                  />
                  <span
                    className="relative inline-flex size-2 rounded-full"
                    style={{ background: meta.color }}
                  />
                </span>
                <span className="font-semibold">{meta.label}</span>
                <span className="text-zinc-400">
                  · recherche en cours · {count} images déjà trouvées
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Filtre batch */}
      {allBatchKeys.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10.5px] uppercase tracking-wider text-zinc-500">
            Filtrer par batch :
          </span>
          <button
            type="button"
            onClick={() => setBatchFilter("all")}
            className={`rounded-md px-2 py-1 text-[10.5px] font-semibold transition-colors ${
              batchFilter === "all"
                ? "bg-zinc-100 text-zinc-900"
                : "bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
            }`}
          >
            Tout ({findings.length})
          </button>
          {allBatchKeys.map((b) => {
            const meta = batchOf(b);
            const count = (buckets[b] ?? []).length;
            const active = batchFilter === b;
            return (
              <button
                key={b}
                type="button"
                onClick={() => setBatchFilter(b)}
                className={`rounded-md px-2 py-1 text-[10.5px] font-semibold transition-colors ${
                  active ? "text-white" : "text-zinc-300"
                }`}
                style={
                  active
                    ? { background: meta.color }
                    : { background: `${meta.color}1a` }
                }
              >
                {meta.short} ({count})
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="py-8 text-center text-[12px] text-zinc-500">
          {findings.length === 0
            ? 'Pas encore d\'images. Clique "Lancer" pour démarrer la recherche Claude conv (gratuit, MAX 20×).'
            : "Aucune image dans ce batch pour l'instant."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => (
            <FindingCard
              key={f.id}
              finding={f}
              defaultLanguages={defaultLanguages}
              defaultTickers={defaultTickers}
              onUpdate={onUpdateFinding}
              allLocales={ALL_LOCALES}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Finding card with approve/reject + langues per-image ────────── */
/**
 * Détermine le chemin du JPEG source (fallback) à partir d'un image_url SVG.
 * Convention de naming : `<base>-dark.svg` → `<base>.jpg` (raw originel).
 * Pour wave 1 (img-N.svg sans JPEG source) on retourne null (pas de fallback).
 */
function jpegFallbackPath(svgPath: string): string | null {
  if (!svgPath) return null;
  // Ne fallback que pour les SVG dans les dossiers wave-2X-raw/
  if (!svgPath.includes("-raw/")) return null;
  const m = svgPath.match(/^(.*?)-(dark|light)\.svg$/);
  if (!m) return null;
  return `${m[1]}.jpg`;
}

function isLowConfidence(notes: string | null): boolean {
  return !!(notes && notes.includes("[FLAG:LOW]"));
}

function FindingCard({
  finding: f,
  defaultLanguages,
  defaultTickers,
  onUpdate,
  allLocales,
}: {
  finding: ImageFinding;
  defaultLanguages: string[];
  defaultTickers: string[];
  onUpdate: (p: Partial<ImageFinding>) => Promise<void>;
  allLocales: readonly string[];
}) {
  const [busy, setBusy] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  async function patch(p: Partial<ImageFinding>) {
    setBusy(true);
    try {
      await onUpdate({ ...p, id: f.id });
    } finally {
      setBusy(false);
    }
  }

  const batch = batchOf(f.source_platform);
  const fallback = jpegFallbackPath(f.image_url);
  const displaySrc = imgFailed && fallback ? fallback : f.image_url;
  const isLow = isLowConfidence(f.reviewer_notes);
  const allLangsActive = allLocales.every((l) => f.languages.includes(l));

  return (
    <div
      className={`overflow-hidden rounded-xl border ${
        f.approved
          ? "border-emerald-500/40 bg-emerald-500/[0.04]"
          : f.rejected
            ? "border-rose-500/40 bg-rose-500/[0.04] opacity-60"
            : "border-white/[0.08] bg-white/[0.02]"
      }`}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-black/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={displaySrc}
          alt={f.title ?? "graph"}
          className="size-full object-contain"
          referrerPolicy="no-referrer"
          onError={() => {
            if (!imgFailed && fallback) setImgFailed(true);
          }}
        />
        <span
          className="absolute left-2 top-2 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ring-1"
          style={{ background: `${batch.color}30`, color: batch.color, borderColor: `${batch.color}66`, ringColor: `${batch.color}66` } as React.CSSProperties}
          title={batch.label}
        >
          {batch.short}
        </span>
        {imgFailed && fallback && (
          <span
            className="absolute right-2 top-2 rounded-md bg-amber-500/30 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-200 ring-1 ring-amber-500/50"
            title="Le SVG vectoriel n'a pas pu charger, image originale (JPEG) affichée"
          >
            fallback
          </span>
        )}
      </div>
      <div className="space-y-2 p-3">
        {f.title && (
          <div
            className={`text-[12.5px] font-semibold line-clamp-2 ${
              isLow
                ? "text-rose-300 underline decoration-rose-400 decoration-wavy underline-offset-4"
                : "text-zinc-100"
            }`}
            title={isLow ? "Pertinence incertaine — relis bien" : undefined}
          >
            {f.title}
          </div>
        )}
        {f.summary && (
          <div className="text-[11.5px] text-zinc-400 line-clamp-3">{f.summary}</div>
        )}
        {f.source_url && (
          <a
            href={f.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10.5px] text-cyan-300 hover:underline"
          >
            <ExternalLink className="size-3" />
            {f.source_handle ? `@${f.source_handle}` : "source"}
          </a>
        )}

        {/* Tickers cibles : modifiables par image */}
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Tickers :</div>
          <input
            type="text"
            defaultValue={f.target_tickers.join(", ")}
            onBlur={(e) =>
              patch({
                target_tickers: e.target.value
                  .split(",")
                  .map((t) => t.trim().toUpperCase())
                  .filter(Boolean),
              })
            }
            placeholder={defaultTickers.join(", ") || "AAPL"}
            className="w-full rounded border border-white/[0.08] bg-black/30 px-2 py-1 font-mono text-[11px] text-zinc-200"
          />
        </div>

        {/* Langues : checkboxes per-image + bouton "toutes" */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Langues :</div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (allLangsActive) {
                  patch({ languages: defaultLanguages });
                } else {
                  patch({ languages: [...allLocales] });
                }
              }}
              className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                allLangsActive
                  ? "bg-emerald-500/40 text-emerald-50"
                  : "border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/15"
              }`}
              title={allLangsActive ? "Revenir aux langues par défaut" : "Activer les 8 langues du site"}
            >
              {allLangsActive ? "✓ Toutes" : "+ Toutes"}
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {ALL_LOCALES.map((loc) => {
              const on = f.languages.includes(loc);
              const inheritedOn = defaultLanguages.includes(loc);
              return (
                <button
                  key={loc}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const next = on
                      ? f.languages.filter((l) => l !== loc)
                      : [...f.languages, loc];
                    patch({ languages: next });
                  }}
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors ${
                    on
                      ? "bg-emerald-500/25 text-emerald-100"
                      : inheritedOn
                        ? "bg-zinc-700/40 text-zinc-400 line-through"
                        : "bg-zinc-800/40 text-zinc-500"
                  }`}
                  title={inheritedOn && !on ? "Décochée pour cette image (héritée)" : ""}
                >
                  {loc}
                </button>
              );
            })}
          </div>
        </div>

        {/* Approve / Reject */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              patch({ approved: !f.approved, rejected: false, reviewed_at: new Date().toISOString() })
            }
            className={`flex-1 inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11.5px] font-semibold ${
              f.approved
                ? "bg-emerald-500/40 text-emerald-50"
                : "border border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/10"
            }`}
          >
            <Check className="size-3.5" />
            {f.approved ? "Approuvé" : "Approuver"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              patch({ rejected: !f.rejected, approved: false, reviewed_at: new Date().toISOString() })
            }
            className={`flex-1 inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11.5px] font-semibold ${
              f.rejected
                ? "bg-rose-500/40 text-rose-50"
                : "border border-rose-500/30 text-rose-200 hover:bg-rose-500/10"
            }`}
          >
            <X className="size-3.5" />
            {f.rejected ? "Rejeté" : "Rejeter"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Request form (create / edit) ──────────────────────────────── */
function RequestForm({
  row,
  onCancel,
  onSave,
}: {
  row: ImageFindingRequest | null;
  onCancel: () => void;
  onSave: (p: Partial<ImageFindingRequest>) => Promise<void>;
}) {
  const [query, setQuery] = useState(row?.query ?? "");
  const [tickers, setTickers] = useState((row?.target_tickers ?? []).join(", "));
  const [langs, setLangs] = useState<Locale[]>(
    (row?.languages as Locale[]) ?? ["fr", "en"],
  );
  const [notes, setNotes] = useState(row?.notes ?? "");

  return (
    <div className="mt-6 rounded-2xl border border-cyan-500/30 bg-cyan-500/[0.04] p-4">
      <div className="mb-3 text-[12.5px] font-semibold uppercase tracking-wider text-cyan-200">
        {row ? `Édition demande #${row.display_number}` : "Nouvelle demande"}
      </div>
      <label className="block text-[11.5px]">
        <div className="mb-1 text-zinc-400">Query libre (ce que Claude doit chercher sur X) *</div>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          placeholder={'Ex : "graphs en français sur la part de Google dans l’IA, posts X récents avec image attachée, derniers 6 mois"'}
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12.5px] text-zinc-100"
        />
      </label>
      <label className="mt-3 block text-[11.5px]">
        <div className="mb-1 text-zinc-400">Tickers cibles (séparés virgule)</div>
        <input
          value={tickers}
          onChange={(e) => setTickers(e.target.value.toUpperCase())}
          placeholder="GOOGL, META"
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[12.5px] text-zinc-100"
        />
      </label>
      <div className="mt-3">
        <div className="mb-1 text-[11.5px] text-zinc-400">Langues d'affichage par défaut :</div>
        <div className="flex flex-wrap gap-1">
          {ALL_LOCALES.map((l) => {
            const on = langs.includes(l);
            return (
              <button
                key={l}
                type="button"
                onClick={() =>
                  setLangs(on ? langs.filter((x) => x !== l) : [...langs, l])
                }
                className={`rounded-md px-2 py-1 text-[11px] font-medium uppercase ${
                  on ? "bg-cyan-500/30 text-cyan-100" : "bg-zinc-800/40 text-zinc-500"
                }`}
              >
                {l}
              </button>
            );
          })}
        </div>
      </div>
      <label className="mt-3 block text-[11.5px]">
        <div className="mb-1 text-zinc-400">Notes (optionnel)</div>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
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
          disabled={!query.trim()}
          onClick={() =>
            onSave({
              id: row?.id,
              query: query.trim(),
              target_tickers: tickers
                .split(",")
                .map((t) => t.trim().toUpperCase())
                .filter(Boolean),
              languages: langs,
              notes: notes || null,
              status: row?.status ?? "todo",
            })
          }
          className="rounded-lg bg-cyan-500/30 px-3 py-1.5 text-[12px] font-semibold text-cyan-100 hover:bg-cyan-500/40 disabled:opacity-30"
        >
          Sauvegarder
        </button>
      </div>
    </div>
  );
}
