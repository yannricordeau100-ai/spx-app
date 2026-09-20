"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DEMANDES_PAR_STE from "@/data/kpi-mt-demandes.json";
import KPI_SECTEURS_ETAT from "@/data/kpi-secteurs-etat.json";
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
  Bell,
  RotateCw,
} from "lucide-react";
import { ImageLightbox } from "@/components/desk/image-lightbox";
import type {
  ImageFindingRequest,
  ImageFinding,
} from "@/lib/desk/image-findings";

// Regle Yann 19 sept 2026 : jamais de source de plus de 18 mois.
// Copie locale du controle serveur (src/lib/desk/image-findings.ts) : ce fichier
// est un composant client, il ne peut pas importer le module admin Supabase.
// Le controle serveur reste celui qui fait foi.
function motifRejetSourceDateClient(v: unknown): string | null {
  if (v === null || v === undefined || String(v).trim() === "") return "source_date absente";
  let txt = String(v).trim();
  if (/^\d{4}$/.test(txt)) txt = `${txt}-01-01`;
  else if (/^\d{4}-\d{2}$/.test(txt)) txt = `${txt}-01`;
  const d = new Date(`${txt.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return `source_date illisible (${txt})`;
  const t = new Date();
  const lim = new Date(t.getTime());
  lim.setUTCHours(0, 0, 0, 0);
  lim.setUTCDate(1);
  lim.setUTCMonth(lim.getUTCMonth() - 18);
  lim.setUTCDate(Math.min(t.getUTCDate(), 28));
  if (d.getTime() < lim.getTime()) {
    return `source datee du ${txt.slice(0, 10)}, limite ${lim.toISOString().slice(0, 10)}`;
  }
  return null;
}

// Yann 18 mai 2026 : EN = langue canonique du site, affichée en premier
// (encadrée comme langue active du visiteur par défaut). FR + DE ensuite,
// autres locales en fallback EN.
const ALL_LOCALES = ["en", "fr", "de", "en-GB", "de-CH", "nl"] as const;
// Langue canonique encadrée comme "active" dans les chips per-finding.
const CANONICAL_LOCALE = "en";
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

/** Date de creation au format francais court, par exemple « 20 sept. 2026 ». */
function dateCourteFr(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Sujets des graphiques d une demande, resumes sur une seule ligne.
 * Le prefixe de societe (texte avant le premier deux-points) est retire
 * seulement s il est commun a la majorite des graphiques de la demande.
 * Trois sujets au maximum, puis « et N autres ».
 */
/**
 * Yann 20 sept 2026 : pour les demandes nees de la recherche des KPI d industrie,
 * le nom du KPI d industrie couvert est ecrit en gras sur la ligne de titre.
 * Les graphiques hors referentiel n ont pas de nom : ils restent dans les sujets.
 */
function kpisDIndustrie(rows: ImageFinding[]): string[] {
  const vus: string[] = [];
  for (const f of rows ?? []) {
    const n = (f.industry_kpi ?? "").trim();
    if (n && !vus.includes(n)) vus.push(n);
  }
  return vus;
}

function sujetsDesGraphiques(rows: ImageFinding[]): string {
  const titres = (rows ?? [])
    .map((f) => (f.title ?? "").trim())
    .filter((t) => t.length > 0);
  if (titres.length === 0) return "";

  // Comptage des prefixes candidats, pour ne retirer que le prefixe majoritaire.
  const compte: Record<string, number> = {};
  for (const t of titres) {
    const i = t.indexOf(":");
    if (i <= 0) continue;
    const prefixe = t.slice(0, i).trim();
    if (prefixe) compte[prefixe] = (compte[prefixe] ?? 0) + 1;
  }
  let prefixeMajoritaire = "";
  let meilleur = 0;
  for (const [prefixe, n] of Object.entries(compte)) {
    if (n > meilleur) {
      meilleur = n;
      prefixeMajoritaire = prefixe;
    }
  }
  const retirer = meilleur * 2 > titres.length ? prefixeMajoritaire : "";

  const sujets = titres.map((t) => {
    if (!retirer) return t;
    const i = t.indexOf(":");
    if (i <= 0) return t;
    if (t.slice(0, i).trim() !== retirer) return t;
    return t.slice(i + 1).trim() || t;
  });

  const visibles = sujets.slice(0, 3).join(", ");
  const reste = sujets.length - 3;
  return reste > 0 ? `${visibles} et ${reste} ${reste > 1 ? "autres" : "autre"}` : visibles;
}

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

/* ─── Sous-onglets (Yann 19 sept 2026) ──────────────────────────── */
type SousOnglet = "demandes" | "societes" | "secteurs";

const SOUS_ONGLETS: { id: SousOnglet; label: string }[] = [
  { id: "demandes", label: "Demandes" },
  { id: "societes", label: "Par société (KPI d’industrie à couvrir)" },
  { id: "secteurs", label: "Par secteur (séries d’industrie)" },
];

/** Pré-remplissage du formulaire « Nouvelle demande » depuis une ligne secteur. */
type PrefillDemande = { query: string; tickers: string; notes: string; cle: string };

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
  // Yann 18 mai 2026 : cloche notification erreur. Compteur badge rouge =
  // demandes avec error_msg non null OU status "error" en BDD.
  const [showNotifPopup, setShowNotifPopup] = useState(false);
  // Yann 18 sept 2026 : sous-onglet « Par société » (10 plus grosses capitalisations par zone, KPI d industrie et demandes preparees).
  // Yann 19 sept 2026 : sous-onglet « Par secteur » (séries d’industrie, traitement secteur par secteur).
  const [sousOnglet, setSousOnglet] = useState<SousOnglet>("demandes");
  // Pré-remplissage du formulaire de demande depuis le sous-onglet « Par secteur ».
  const [prefill, setPrefill] = useState<PrefillDemande | null>(null);

  // Nombre de graphiques moyen terme approuvés par ticker, calculé à partir
  // des findings déjà chargés côté serveur (aucun appel réseau supplémentaire).
  const approuvesParTicker = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const rows of Object.values(findings ?? {})) {
      for (const f of rows ?? []) {
        if (!f.approved || f.rejected) continue;
        for (const t of f.target_tickers ?? []) {
          const k = String(t).trim().toUpperCase();
          if (k) acc[k] = (acc[k] ?? 0) + 1;
        }
      }
    }
    return acc;
  }, [findings]);

  function preparerDemande(p: PrefillDemande) {
    setPrefill(p);
    setEditing(null);
    setShowForm(true);
    setSousOnglet("demandes");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const errorRequests = requests.filter(
    (r) => r.error_msg != null || r.status === "error",
  );

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

  /**
   * Bouton « +3 » : augmente de 3 le nombre de graphiques souhaite puis remet
   * la demande en attente pour qu une session la reprenne (meme declencheur
   * que le bouton « Lancer », action mark_claude_pending).
   */
  async function ajouterTroisGraphiques(id: string) {
    const req = requests.find((r) => r.id === id);
    if (!req) return;
    const cible = Math.min((req.desired_count ?? 3) + 3, 12);
    await fetch("/api/desk/image-findings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, desired_count: cible }),
    });
    await fetch("/api/desk/image-findings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_claude_pending", id }),
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
    // Yann 16 sept 2026 : la demande est mise en attente en base, donc
    // n importe quelle session Claude Code (compte Max 5x ou 20x) peut la
    // prendre. Aucun compte n est impose.
    alert(
      `Demande #${num} mise en attente.\n\n` +
        "Dans la conversation Claude Code ouverte sur le compte que tu utilises " +
        "en ce moment (Max 5x ou Max 20x), tape :\n\n" +
        `lance la demande ${
          requests.find((r) => r.id === id)?.display_number ?? id.slice(0, 8)
        }\n\nLa session lira la demande en base, fera la recherche et ` +
        "reconstruira chaque graphique au format Mettrik.",
    );
  }

  async function retriggerRequest(id: string) {
    // Re-lance la demande en repassant en claude_pending pour retrigger
    // le worker autonome (cf workflow image-findings-autorun.yml).
    await fetch("/api/desk/image-findings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_claude_pending", id }),
    });
    await refresh();
  }

  function scrollToRequest(id: string) {
    setShowNotifPopup(false);
    setExpandedId(id);
    setTimeout(() => {
      const el = document.getElementById(`req-row-${id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  async function updateFinding(reqId: string, p: Partial<ImageFinding>) {
    // Regle Yann 19 sept 2026 : jamais de source de plus de 18 mois
    // (controle cote client en plus du controle serveur, qui fait foi)
    if (!p.id || "source_date" in p) {
      const motif = motifRejetSourceDateClient(p.source_date);
      if (motif) {
        alert(`REJET source de plus de 18 mois : ${motif}`);
        return;
      }
    }
    const rep = await fetch(`/api/desk/image-findings/${reqId}/findings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    // L appelant a besoin de connaitre l echec (retour au titre precedent,
    // affichage du message) : on remonte une erreur au lieu de l ignorer.
    if (!rep.ok) throw new Error((await rep.text()) || "Enregistrement refusé");
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

        <div className="mb-4 flex flex-wrap gap-2">
          {SOUS_ONGLETS.map((o) => (
            <button key={o.id} type="button" onClick={() => setSousOnglet(o.id)} className={`rounded-full border px-3 py-1 text-[12.5px] ${sousOnglet === o.id ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100" : "border-white/10 text-zinc-400 hover:text-zinc-200"}`}>
              {o.label}
            </button>
          ))}
        </div>
        {sousOnglet === "societes" && <DemandesParSociete />}
        {sousOnglet === "secteurs" && (
          <DemandesParSecteur
            approuvesParTicker={approuvesParTicker}
            onPreparerDemande={preparerDemande}
          />
        )}
        <div className={sousOnglet !== "demandes" ? "hidden" : ""}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold">
              <ImageIcon className="mr-2 inline size-7 text-cyan-400" />
              Indicateurs variés - Moyen terme
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
              Recherche manuelle de graphiques / schémas (principalement X /
              Twitter) liés à une ou plusieurs sociétés. Tu rédiges une demande
              avec query libre (ex : "graphs en français sur la part de Google
              sur l'IA"), Claude conv MAX 20× la lance, tu approuves les images
              une à une, elles s'affichent ensuite sur les pages société
              concernées.
            </p>
          </div>
          <div className="relative flex shrink-0 items-center gap-2">
            <NotifBell
              count={errorRequests.length}
              onClick={() => setShowNotifPopup((v) => !v)}
            />
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
            {showNotifPopup && (
              <NotifPopup
                errors={errorRequests}
                onClose={() => setShowNotifPopup(false)}
                onGoTo={scrollToRequest}
                onRetrigger={retriggerRequest}
              />
            )}
          </div>
        </div>

        {showForm && (
          <RequestForm
            key={editing ? `edit-${editing.id}` : (prefill?.cle ?? "new")}
            row={editing}
            prefill={editing ? null : prefill}
            onCancel={() => {
              setShowForm(false);
              setEditing(null);
              setPrefill(null);
            }}
            onSave={async (payload) => {
              await upsert(payload);
              setShowForm(false);
              setEditing(null);
              setPrefill(null);
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
              id={`req-row-${r.id}`}
              request={r}
              findings={findings[r.id] ?? []}
              expanded={expandedId === r.id}
              onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
              onLaunch={() => launchClaude(r.id)}
              onAjouterTrois={() => ajouterTroisGraphiques(r.id)}
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
    </div>
  );
}

/* ─── Request row + expansion ───────────────────────────────────── */
function RequestRow({
  id,
  request: r,
  findings,
  expanded,
  onToggle,
  onLaunch,
  onAjouterTrois,
  onEdit,
  onDelete,
  onUpdateFinding,
}: {
  id?: string;
  request: ImageFindingRequest;
  findings: ImageFinding[];
  expanded: boolean;
  onToggle: () => void;
  onLaunch: () => void;
  onAjouterTrois: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateFinding: (p: Partial<ImageFinding>) => Promise<void>;
}) {
  const st = STATUS_META[r.status];
  // Le badge affiche toujours un numero : si display_number manque (demandes
  // anciennes), on retombe sur les 4 premiers caracteres de l identifiant.
  const numeroDemande = r.display_number ?? r.id.slice(0, 4);
  const dateCreation = dateCourteFr(r.created_at);
  // Sujets des graphiques deja trouves, affiches sur la ligne de titre.
  const sujets = sujetsDesGraphiques(findings);
  const kpisIndustrie = kpisDIndustrie(findings);

  return (
    <div id={id} className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
      <div
        className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 hover:bg-white/[0.02]"
        onClick={onToggle}
      >
        <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 font-mono text-[11.5px] font-bold text-cyan-200">
          #{numeroDemande}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <Search className="size-3.5 shrink-0 text-zinc-500" />
            <span className="truncate text-[13.5px] font-medium text-zinc-100">{r.query}</span>
            {kpisIndustrie.length > 0 && (
              <span
                className="shrink-0 truncate text-[11.5px] font-bold text-zinc-200"
                title={`KPI d’industrie : ${kpisIndustrie.join(", ")}`}
              >
                {kpisIndustrie.slice(0, 3).join(", ")}
                {kpisIndustrie.length > 3 ? ` et ${kpisIndustrie.length - 3} autres` : ""}
              </span>
            )}
            {sujets && (
              <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-500" title={sujets}>
                {sujets}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <span className="font-mono">
              Tickers : {r.target_tickers.length > 0 ? r.target_tickers.join(", ") : "(aucun)"}
            </span>
            {dateCreation && (
              <>
                <span>·</span>
                <span>Créée le {dateCreation}</span>
              </>
            )}
            <span>·</span>
            <span>Langues : {r.languages.join(", ")}</span>
            <span>·</span>
            <span>
              {r.findings_count} images ({r.approved_count} approuvées) sur{" "}
              {r.desired_count ?? 3} demandés
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
            onClick={onAjouterTrois}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/[0.08]"
            title="Demander 3 graphiques de plus et remettre la demande en attente"
          >
            +3
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

/**
 * Yann 21 sept 2026 : double systeme d affichage. Safari refusait d afficher
 * certains SVG locaux et montrait un carre avec un point d interrogation.
 * Chaque SVG a desormais un jumeau PNG (scripts/findings-png.js) : on sert le
 * PNG d abord, qui ne depend d aucun moteur de rendu vectoriel, et on revient
 * au SVG puis au JPEG d origine si le fichier manque.
 */
function chaineDeSecours(chemin: string): string[] {
  if (!chemin) return [];
  const liste: string[] = [];
  if (chemin.startsWith("/") && /\.svg$/i.test(chemin)) liste.push(chemin.replace(/\.svg$/i, ".png"));
  liste.push(chemin);
  const jpeg = jpegFallbackPath(chemin);
  if (jpeg) liste.push(jpeg);
  return liste;
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
  // Rang dans la chaine de secours : 0 = PNG, 1 = SVG, 2 = JPEG d origine.
  const [imgFailed, setImgFailed] = useState(0);
  // Ouverture de la fenetre d agrandissement du graphique.
  const [agrandi, setAgrandi] = useState(false);

  async function patch(p: Partial<ImageFinding>) {
    setBusy(true);
    try {
      await onUpdate({ ...p, id: f.id });
    } catch (e) {
      alert(`Erreur : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Meme mise a jour que patch(), mais l erreur remonte a l appelant pour
   * qu il puisse revenir a l ancienne valeur (edition du titre en ligne).
   */
  async function patchBrut(p: Partial<ImageFinding>) {
    await onUpdate({ ...p, id: f.id });
  }

  const batch = batchOf(f.source_platform);
  // Yann 18 mai 2026 : priorité au SVG local recréé (`image_local_path`),
  // car `image_url` = URL externe vers la source (PDF / article) et le
  // navigateur affiche la 1re page du PDF ou autre contenu non pertinent.
  // Fallback `image_url` uniquement si pas de SVG local. JPEG fallback en
  // dernier recours pour les batches wave-2X-raw/.
  const primarySrc = f.image_local_path || f.image_url;
  const secours = chaineDeSecours(primarySrc);
  // imgFailed compte les echecs successifs : on descend la chaine PNG, SVG, JPEG.
  const rang = imgFailed;
  const displaySrc = secours[Math.min(rang, secours.length - 1)] ?? primarySrc;
  const fallback = rang > 0;
  // Yann 27 aout 2026 : certaines passes enregistrent l adresse de la PAGE
  // source (huggingface.co/papers/..., x.com/.../status/...) au lieu d une
  // image. Le navigateur affichait alors une vignette cassee. On detecte le
  // cas et on montre un cartouche explicite avec le lien.
  const estUneImage =
    !!primarySrc &&
    (primarySrc.startsWith("/") ||
      /\.(png|jpe?g|gif|webp|svg|avif)(\?|#|$)/i.test(primarySrc));
  const isLow = isLowConfidence(f.reviewer_notes);
  const allLangsActive = allLocales.every((l) => f.languages.includes(l));

  return (
    <>
    {agrandi && estUneImage && (
      <ImageLightbox
        src={displaySrc}
        alt={f.title ?? "graphique"}
        onClose={() => setAgrandi(false)}
      />
    )}
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
        {!estUneImage && (
          <div className="flex size-full flex-col items-center justify-center gap-2 px-4 text-center">
            <span className="text-[12px] font-semibold text-amber-300">
              Image non récupérée
            </span>
            <span className="text-[11px] leading-snug text-zinc-400">
              La passe a enregistré l adresse de la page source, pas un fichier
              image. Rejoue la demande pour produire la capture.
            </span>
            {primarySrc && (
              <a
                href={primarySrc}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-cyan-400 underline"
              >
                ouvrir la source
              </a>
            )}
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {estUneImage && <img
          src={displaySrc}
          alt={f.title ?? "graphique"}
          title="Cliquer pour agrandir le graphique"
          className="size-full cursor-zoom-in object-contain"
          referrerPolicy="no-referrer"
          onClick={(e) => {
            // Le clic ne doit pas declencher les actions de la vignette.
            e.stopPropagation();
            setAgrandi(true);
          }}
          onError={() => {
            const suivant = imgFailed + 1;
            if (suivant < secours.length) setImgFailed(suivant);
          }}
        />}
        <span
          className="absolute left-2 top-2 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ring-1"
          style={{ background: `${batch.color}30`, color: batch.color, borderColor: `${batch.color}66`, ringColor: `${batch.color}66` } as React.CSSProperties}
          title={batch.label}
        >
          {batch.short}
        </span>
        {fallback && (
          <span
            className="absolute right-2 top-2 rounded-md bg-amber-500/30 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-200 ring-1 ring-amber-500/50"
            title="Le SVG vectoriel n'a pas pu charger, image originale (JPEG) affichée"
          >
            fallback
          </span>
        )}
      </div>
      <div className="space-y-2 p-3">
        <TitreModifiable
          titre={f.title}
          isLow={isLow}
          onEnregistrer={(titre) => patchBrut({ title: titre })}
        />
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
              title={allLangsActive ? "Revenir aux langues par défaut" : "Activer les 6 langues du site"}
            >
              {allLangsActive ? "✓ Toutes" : "+ Toutes"}
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {ALL_LOCALES.map((loc) => {
              const on = f.languages.includes(loc);
              const inheritedOn = defaultLanguages.includes(loc);
              const isCanonical = loc === CANONICAL_LOCALE;
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
                    isCanonical
                      ? on
                        ? "bg-cyan-500/30 text-cyan-50 ring-1 ring-cyan-400/70 shadow-[0_0_8px_rgba(34,211,238,0.25)]"
                        : "bg-cyan-500/10 text-cyan-200 ring-1 ring-cyan-400/40"
                      : on
                        ? "bg-emerald-500/25 text-emerald-100"
                        : inheritedOn
                          ? "bg-zinc-700/40 text-zinc-400 line-through"
                          : "bg-zinc-800/40 text-zinc-500"
                  }`}
                  title={
                    isCanonical
                      ? "Langue canonique (EN) — affichée par défaut aux visiteurs sans traduction dans leur locale"
                      : inheritedOn && !on
                        ? "Décochée pour cette image (héritée)"
                        : ""
                  }
                >
                  {loc}
                </button>
              );
            })}
          </div>
        </div>

        {/* Toggle "Afficher la lecture sur la fiche société" (Yann 17 mai
            2026) : default true ; si décoché, le summary est masqué sur
            ImageFindingsBlock public. Persiste en BDD via show_summary. */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={f.show_summary !== false}
            disabled={busy}
            onChange={(e) => patch({ show_summary: e.target.checked })}
            className="size-3.5 rounded border-white/[0.15] bg-black/40 text-emerald-500"
          />
          <span className="text-[10.5px] uppercase tracking-wider text-zinc-400">
            Afficher la lecture sur la fiche société
          </span>
        </label>

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
    </>
  );
}

/* ─── Titre du graphique modifiable en ligne ────────────────────── */
/**
 * Un clic sur le titre le transforme en champ de saisie. La touche Entree
 * valide, la touche Echap annule, la perte de focus enregistre aussi.
 * En cas d echec, on revient a l ancien titre et le message est affiche.
 */
function TitreModifiable({
  titre,
  isLow,
  onEnregistrer,
}: {
  titre: string | null;
  isLow: boolean;
  onEnregistrer: (titre: string) => Promise<void>;
}) {
  const [edition, setEdition] = useState(false);
  const [valeur, setValeur] = useState(titre ?? "");
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Evite un enregistrement parasite quand la sortie du champ vient d Echap.
  const annule = useRef(false);

  useEffect(() => {
    if (!edition) setValeur(titre ?? "");
  }, [titre, edition]);

  async function valider() {
    const propre = valeur.trim();
    if (propre === (titre ?? "").trim()) {
      setEdition(false);
      return;
    }
    setEnregistrement(true);
    setErreur(null);
    try {
      await onEnregistrer(propre);
      setEdition(false);
    } catch (e) {
      setValeur(titre ?? "");
      setEdition(false);
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setEnregistrement(false);
    }
  }

  if (edition) {
    return (
      <div className="space-y-1">
        <input
          type="text"
          autoFocus
          value={valeur}
          disabled={enregistrement}
          onChange={(e) => setValeur(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void valider();
            } else if (e.key === "Escape") {
              e.preventDefault();
              annule.current = true;
              setValeur(titre ?? "");
              setEdition(false);
            }
          }}
          onBlur={() => {
            if (annule.current) {
              annule.current = false;
              return;
            }
            void valider();
          }}
          placeholder="Titre du graphique"
          className={`w-full rounded border border-cyan-500/40 bg-black/40 px-2 py-1 text-[12.5px] font-semibold text-zinc-100 ${
            enregistrement ? "opacity-50" : ""
          }`}
        />
        <div className="text-[10px] text-zinc-500">
          {enregistrement
            ? "Enregistrement en cours..."
            : "Entrée pour valider, Échap pour annuler"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          // Le clic sur le titre ne doit pas declencher les actions de la vignette.
          e.stopPropagation();
          setErreur(null);
          setEdition(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setErreur(null);
            setEdition(true);
          }
        }}
        title={
          isLow
            ? "Pertinence incertaine, relis bien. Cliquer pour modifier le titre"
            : "Cliquer pour modifier le titre"
        }
        className={`cursor-text rounded px-0.5 text-[12.5px] font-semibold line-clamp-2 hover:bg-white/[0.05] ${
          titre
            ? isLow
              ? "text-rose-300 underline decoration-rose-400 decoration-wavy underline-offset-4"
              : "text-zinc-100"
            : "italic text-zinc-500"
        }`}
      >
        {titre || "Ajouter un titre"}
      </div>
      {erreur && (
        <div className="text-[10.5px] text-rose-300">
          Titre non enregistré : {erreur}
        </div>
      )}
    </div>
  );
}

/* ─── Request form (create / edit) ──────────────────────────────── */
function RequestForm({
  row,
  prefill,
  onCancel,
  onSave,
}: {
  row: ImageFindingRequest | null;
  prefill?: PrefillDemande | null;
  onCancel: () => void;
  onSave: (p: Partial<ImageFindingRequest>) => Promise<void>;
}) {
  const [query, setQuery] = useState(row?.query ?? prefill?.query ?? "");
  const [tickers, setTickers] = useState(
    row ? (row.target_tickers ?? []).join(", ") : (prefill?.tickers ?? ""),
  );
  const [langs, setLangs] = useState<Locale[]>(
    (row?.languages as Locale[]) ?? ["fr", "en"],
  );
  const [notes, setNotes] = useState(row?.notes ?? prefill?.notes ?? "");
  // Nombre de graphiques souhaite pour la demande (defaut 3, borne 1 a 12).
  const [nbGraphiques, setNbGraphiques] = useState<number>(row?.desired_count ?? 3);

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
      <label className="mt-3 block text-[11.5px]">
        <div className="mb-1 text-zinc-400">Nombre de graphiques (1 à 12)</div>
        <input
          type="number"
          min={1}
          max={12}
          value={nbGraphiques}
          onChange={(e) => {
            const v = Number(e.target.value);
            setNbGraphiques(Number.isFinite(v) ? Math.min(12, Math.max(1, Math.round(v))) : 3);
          }}
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
              desired_count: nbGraphiques,
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

/* ─── Cloche notification erreur (Yann 18 mai 2026) ─────────────── */
function NotifBell({ count, onClick }: { count: number; onClick: () => void }) {
  const hasErrors = count > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex size-9 items-center justify-center rounded-lg border transition-colors ${
        hasErrors
          ? "border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15"
          : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06]"
      }`}
      title={hasErrors ? `${count} demande(s) en erreur` : "Aucune erreur"}
    >
      <Bell className="size-5" style={{ width: 20, height: 20 }} />
      {hasErrors && (
        <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-[18px] text-white ring-2 ring-[#050505]">
          {count}
        </span>
      )}
    </button>
  );
}

function NotifPopup({
  errors,
  onClose,
  onGoTo,
  onRetrigger,
}: {
  errors: ImageFindingRequest[];
  onClose: () => void;
  onGoTo: (id: string) => void;
  onRetrigger: (id: string) => Promise<void>;
}) {
  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-[420px] overflow-hidden rounded-xl border border-rose-500/30 bg-[#0a0a0a] shadow-2xl shadow-rose-900/30">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-rose-500/10 px-3 py-2">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-rose-100">
          <Bell className="size-4" />
          Demandes en erreur ({errors.length})
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
          title="Fermer"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        {errors.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px] text-zinc-500">
            Aucune demande en erreur.
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {errors.map((r) => {
              const query = r.query.length > 80 ? r.query.slice(0, 80) + "…" : r.query;
              const msg = r.error_msg
                ? r.error_msg.length > 500
                  ? r.error_msg.slice(0, 500) + "…"
                  : r.error_msg
                : "(status error, pas de message détaillé)";
              return (
                <li key={r.id} className="px-3 py-2.5 hover:bg-white/[0.02]">
                  <button
                    type="button"
                    onClick={() => onGoTo(r.id)}
                    className="block w-full text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-rose-500/20 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-rose-200">
                        #{r.display_number ?? "—"}
                      </span>
                      <span className="line-clamp-1 text-[12px] font-medium text-zinc-100">
                        {query}
                      </span>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap break-words text-[11px] text-rose-300/90">
                      {msg}
                    </div>
                  </button>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onRetrigger(r.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-[10.5px] font-semibold text-violet-100 hover:bg-violet-500/15"
                      title="Repasse la demande en claude_pending pour retrigger le worker"
                    >
                      <RotateCw className="size-3" /> Re-lancer
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}


type DemandeMt = { kpi_short: string; titre: string; requete: string; pourquoi?: string; sources_pressenties?: string[]; note?: string };
type SteMt = { nom: string; cap_mds?: number; industrie?: string; code?: string; kpis?: { short: string; nom_fr?: string; couvert: boolean }[]; demandes: DemandeMt[] };

/** Yann 18 sept 2026 : liste par zone puis capitalisation decroissante, KPI d industrie
 *  couverts ou non, et demandes de KPI moyen terme preparees (fichier src/data/kpi-mt-demandes.json). */
function DemandesParSociete() {
  const data = DEMANDES_PAR_STE as unknown as { genere_le: string; zones: Record<string, Record<string, SteMt>> };
  const zones = Object.entries(data.zones);
  if (zones.length === 0) return <p className="text-sm text-zinc-500">Liste en préparation.</p>;
  return (
    <div className="space-y-8">
      <p className="text-[12.5px] text-zinc-500">Généré le {data.genere_le}. Hors ASML, GOOG, NVDA. Une demande par KPI d’industrie non couvert, plus quelques demandes complémentaires.</p>
      {zones.map(([zone, stes]) => (
        <section key={zone}>
          <h2 className="mb-3 font-display text-xl font-semibold text-zinc-50">{zone}</h2>
          <div className="space-y-3">
            {Object.entries(stes).map(([t, s]) => (
              <details key={t} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                <summary className="cursor-pointer text-[14px] text-zinc-100">
                  <span className="font-mono font-semibold text-violet-200">{t}</span> · {s.nom}
                  {s.cap_mds ? <span className="ml-2 font-mono text-[11px] text-zinc-500">{s.cap_mds} Mds $</span> : null}
                  {s.industrie ? <span className="ml-2 text-[12px] text-zinc-400">{s.industrie}{s.code ? ` (${s.code})` : ""}</span> : null}
                  <span className="ml-2 font-mono text-[11px] text-cyan-300">{s.demandes.length} demande{s.demandes.length > 1 ? "s" : ""}</span>
                </summary>
                {s.kpis && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.kpis.map((k) => (
                      <span key={k.short} className={`rounded-full border px-2 py-0.5 text-[11px] ${k.couvert ? "border-emerald-400/40 text-emerald-200" : "border-rose-400/40 text-rose-200"}`} title={k.nom_fr ?? k.short}>
                        {k.couvert ? "✓" : "✗"} {k.nom_fr ?? k.short}
                      </span>
                    ))}
                  </div>
                )}
                <ol className="mt-3 space-y-2">
                  {s.demandes.map((d, i) => (
                    <li key={i} className="rounded-lg border border-white/[0.06] p-2.5 text-[12.5px]">
                      <div className="font-semibold text-zinc-100">{d.titre} <span className="ml-1 font-mono text-[10.5px] text-zinc-500">{d.kpi_short}</span></div>
                      <div className="mt-1 text-zinc-300">{d.requete}</div>
                      {d.pourquoi && <div className="mt-1 text-[11.5px] text-zinc-500">{d.pourquoi}</div>}
                      {d.sources_pressenties && d.sources_pressenties.length > 0 && <div className="mt-1 text-[11px] text-zinc-500">Sources pressenties : {d.sources_pressenties.join(" · ")}</div>}
                      {d.note && <div className="mt-1 text-[11px] text-amber-300">{d.note}</div>}
                    </li>
                  ))}
                </ol>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ─── Sous-onglet « Par secteur (séries d’industrie) » ──────────── */
/**
 * Yann 19 sept 2026 : sépare les KPI créés un par un (onglet « Demandes »)
 * de ceux créés en série pour couvrir un KPI d’industrie manquant.
 * Source : src/data/kpi-secteurs-etat.json. Le nombre de graphiques moyen
 * terme approuvés vient des findings déjà chargés par la page.
 */
type SteSecteur = {
  code?: string;
  hero_actuel?: string;
  hero_nouveau?: string;
  statut?: string;
  note?: string;
  kpi_nom?: string;
  kpi_etat?: string;
};
type SecteurEtat = {
  statut?: string;
  kpi_star?: { star?: string[]; choix?: string; freq?: string };
  societes?: Record<string, SteSecteur>;
};

const SECTEUR_LABELS: Record<string, string> = {
  banques: "Banques",
  assurance: "Assurance",
  petrole_gaz: "Pétrole et gaz",
  utilities: "Services aux collectivités",
  assureurs_sante: "Assureurs santé",
  hotels_casinos: "Hôtels et casinos",
  mines: "Mines",
  services_petroliers: "Services pétroliers",
  gestion_actifs_credit: "Gestion d’actifs et crédit",
  logiciel: "Logiciel",
  courtiers_assurance: "Courtiers en assurance",
  siderurgie: "Sidérurgie",
  recherche_clinique: "Recherche clinique",
  croisieres: "Croisières",
  semi_conducteurs_equipements: "Semi-conducteurs et équipements",
};

function labelSecteur(id: string): string {
  if (SECTEUR_LABELS[id]) return SECTEUR_LABELS[id];
  const s = id.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const ETAT_KPI_META: Record<string, { label: string; cls: string }> = {
  heros: { label: "Héros", cls: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" },
  present: { label: "Présent, pas héros", cls: "border-amber-400/40 bg-amber-500/10 text-amber-200" },
  absent: { label: "Absent", cls: "border-rose-400/40 bg-rose-500/10 text-rose-200" },
};

function metaEtat(etat: string | undefined) {
  return (
    ETAT_KPI_META[etat ?? ""] ?? {
      label: etat ? etat : "État inconnu",
      cls: "border-white/15 bg-white/[0.04] text-zinc-300",
    }
  );
}

function DemandesParSecteur({
  approuvesParTicker,
  onPreparerDemande,
}: {
  approuvesParTicker: Record<string, number>;
  onPreparerDemande: (p: PrefillDemande) => void;
}) {
  const data = KPI_SECTEURS_ETAT as unknown as {
    maj_le?: string;
    cree_le?: string;
    regle?: string;
    secteurs: Record<string, SecteurEtat>;
  };
  const [secteurChoisi, setSecteurChoisi] = useState<string>("tous");
  const [sansApprouve, setSansApprouve] = useState(false);

  const secteurs = useMemo(
    () =>
      Object.entries(data.secteurs ?? {}).sort((a, b) =>
        labelSecteur(a[0]).localeCompare(labelSecteur(b[0]), "fr"),
      ),
    [data.secteurs],
  );

  const lignesParSecteur = useMemo(() => {
    return secteurs
      .filter(([id]) => secteurChoisi === "tous" || secteurChoisi === id)
      .map(([id, sec]) => {
        const lignes = Object.entries(sec.societes ?? {})
          .map(([ticker, ste]) => ({
            ticker,
            ste,
            approuves: approuvesParTicker[ticker.toUpperCase()] ?? 0,
          }))
          .filter((l) => (sansApprouve ? l.approuves === 0 : true))
          .sort((a, b) => a.ticker.localeCompare(b.ticker, "fr"));
        return { id, sec, lignes };
      })
      .filter((s) => s.lignes.length > 0);
  }, [secteurs, secteurChoisi, sansApprouve, approuvesParTicker]);

  const total = lignesParSecteur.reduce((n, s) => n + s.lignes.length, 0);

  if (secteurs.length === 0) {
    return <p className="text-sm text-zinc-500">Aucun secteur enregistré.</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-[12.5px] text-zinc-500">
        KPI d’industrie créés en série, secteur par secteur.
        {data.maj_le ? ` Mis à jour le ${data.maj_le}.` : ""} {total} société
        {total > 1 ? "s" : ""} affichée{total > 1 ? "s" : ""}.
      </p>

      <div className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex min-w-0 flex-col gap-1 text-[11.5px] sm:flex-row sm:items-center sm:gap-2">
          <span className="text-zinc-400">Secteur</span>
          <select
            value={secteurChoisi}
            onChange={(e) => setSecteurChoisi(e.target.value)}
            className="w-full min-w-0 rounded-lg border border-white/[0.08] bg-[#0b0b0b] px-2.5 py-1.5 text-[12.5px] text-zinc-100 sm:w-auto"
          >
            <option value="tous">Tous les secteurs</option>
            {secteurs.map(([id, sec]) => (
              <option key={id} value={id}>
                {labelSecteur(id)} ({Object.keys(sec.societes ?? {}).length})
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-start gap-2 text-[12px] text-zinc-300">
          <input
            type="checkbox"
            checked={sansApprouve}
            onChange={(e) => setSansApprouve(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-cyan-400"
          />
          <span>Seulement les sociétés sans KPI approuvé</span>
        </label>
      </div>

      {lignesParSecteur.length === 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[12.5px] text-zinc-500">
          Aucune société ne correspond à ces filtres.
        </div>
      )}

      {lignesParSecteur.map(({ id, sec, lignes }) => (
        <section key={id}>
          <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="font-display text-xl font-semibold text-zinc-50">
              {labelSecteur(id)}
            </h2>
            <span className="font-mono text-[11px] text-zinc-500">
              {lignes.length} société{lignes.length > 1 ? "s" : ""}
            </span>
            {sec.kpi_star?.choix && (
              <span className="text-[11.5px] text-cyan-300">
                KPI star : {sec.kpi_star.choix}
                {sec.kpi_star.freq ? ` (${sec.kpi_star.freq})` : ""}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {lignes.map(({ ticker, ste, approuves }) => {
              const meta = metaEtat(ste.kpi_etat);
              const kpi = ste.kpi_nom ?? ste.hero_nouveau ?? "KPI à définir";
              return (
                <div
                  key={ticker}
                  className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link
                        href={`/${ticker.toLowerCase()}`}
                        className="font-mono text-[13px] font-semibold text-violet-200 hover:text-violet-100"
                      >
                        {ticker}
                      </Link>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10.5px] ${meta.cls}`}
                      >
                        {meta.label}
                      </span>
                      <span className="font-mono text-[10.5px] text-zinc-500">
                        {approuves} graphique{approuves > 1 ? "s" : ""} approuvé
                        {approuves > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="mt-1 break-words text-[12.5px] text-zinc-200">
                      {kpi}
                    </div>
                    {ste.note && (
                      <div className="mt-1 break-words text-[11px] text-zinc-500">
                        {ste.note}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onPreparerDemande({
                        cle: `${id}-${ticker}`,
                        tickers: ticker.toUpperCase(),
                        query: `Graphiques et schémas du KPI d’industrie « ${kpi} » pour ${ticker} (secteur ${labelSecteur(id)}) : publications de la société, rapports investisseurs, posts X et analystes, image attachée, valeurs publiées, historique le plus long possible.`,
                        notes: `Série d’industrie ${labelSecteur(id)} · ${kpi} · état ${metaEtat(ste.kpi_etat).label.toLowerCase()}`,
                      })
                    }
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[12px] font-semibold text-cyan-100 hover:bg-cyan-500/20"
                  >
                    <Plus className="size-3.5" /> Préparer une demande
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
