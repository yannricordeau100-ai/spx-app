"use client";

/**
 * AdminFloatingPanel — panel admin permanent bottom-right (Yann 19 mai 2026).
 *
 * Fusionne 3 dropdowns + l'ancien LevelBadge en 1 seul composant compact :
 *
 *   1. "Voir l'app comme :" → simulate-tier (cookie mettrik:simulate-as)
 *      Options : (admin réel) / Anonyme / Gratuit / Premium / Max
 *
 *   2. "Version :" → swap entre V1.7, V1.7.5, V1.8
 *      - Si URL est /sandbox/v1-X/<ticker> → rewrite vers /sandbox/v1-Y/<ticker>
 *      - Si URL est /sandbox/v1-X → navigate vers /sandbox/v1-Y
 *      - Sinon → pose cookie mettrik:version=v1-Y + reload
 *
 *   3. "Niveau :" → swap hostname (mettrik-niveau1 ↔ mettrik-niveau2)
 *      Conserve pathname + search.
 *
 * Visibilité :
 *   - Niveau 0 (prod publique) : CACHÉ totalement
 *   - Niveau 1 / 2 / 3         : VISIBLE (panel + badge intégré)
 *
 * Affichage par défaut = mode MINI (badge niveau seul). Click sur l'icône
 * cog → mode EXPAND (panel complet avec 3 dropdowns + sub-badges univers / sim).
 */

import { VERSION } from "@/lib/version";
import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Settings2, X } from "lucide-react";
import { useSimulatedTier, setSimulateTier } from "@/lib/desk/use-effective-tier";
import type { EffectiveTier } from "@/lib/desk/effective-tier-shared";

type Level = 0 | 1 | 2 | 3;

const LEVEL_META: Record<Exclude<Level, 0>, {
  label: string;
  shortLabel: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  dotClass: string;
  tooltip: string;
}> = {
  1: {
    label: "NIVEAU 1 · SHADOW PROD",
    shortLabel: "N1",
    bgClass: "bg-orange-500/15",
    borderClass: "border-orange-400/40",
    textClass: "text-orange-100",
    dotClass: "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.7)]",
    tooltip:
      "Niveau 1 (shadow prod) : clone fidèle de la prod, sandbox de validation Yann. Stripe en test mode, Resend en dry-run, Supabase séparée. Aucune action ici ne pollue la vraie prod.",
  },
  2: {
    label: `NIVEAU 2 · PREVIEW · v${VERSION}`,
    shortLabel: "N2",
    bgClass: "bg-violet-500/15",
    borderClass: "border-violet-400/40",
    textClass: "text-violet-100",
    dotClass: "bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.7)]",
    tooltip:
      "Niveau 2 (preview) : features en cours sur branches, données de test, à ne pas considérer comme du fini.",
  },
  3: {
    label: "NIVEAU 3 · LOCAL",
    shortLabel: "N3",
    bgClass: "bg-zinc-500/15",
    borderClass: "border-zinc-400/40",
    textClass: "text-zinc-100",
    dotClass: "bg-zinc-300 shadow-[0_0_8px_rgba(212,212,216,0.5)]",
    tooltip:
      "Niveau 3 (dev local) : bac à sable absolu sur ton Mac, modifs en cours non encore poussées.",
  },
};

const SIM_LABELS: Record<EffectiveTier, string> = {
  anonymous: "Anonyme",
  free: "Gratuit",
  premium: "Premium",
  max: "Max",
};

const TIER_OPTIONS: Array<{ value: EffectiveTier; label: string }> = [
  { value: "anonymous", label: "Anonyme" },
  { value: "free", label: "Gratuit" },
  { value: "premium", label: "Premium" },
  { value: "max", label: "Max" },
];

// Versions disponibles (hardcodé). Yann 21 mai 2026 : V1.9.5 = défaut,
// stés validées qualité audit strict. V1.9.5 en haut de la liste.
const VERSION_OPTIONS: Array<{ slug: string; label: string }> = [
  { slug: "v1-9-5", label: "V1.9.5" },
  { slug: "v1-9", label: "V1.9" },
  { slug: "v1-8", label: "V1.8" },
  { slug: "v1-7-5", label: "V1.7.5" },
  { slug: "v1-7", label: "V1.7" },
];

const VERSION_COOKIE = "mettrik:version";

function detectLevelFromHost(): Level {
  if (typeof window === "undefined") return 0;
  const host = window.location.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) return 3;
  if (host === "mettrik.ai" || host === "www.mettrik.ai") return 0;
  if (host.startsWith("mettrik-niveau1") || host.startsWith("niveau1.")) return 1;
  if (host.endsWith(".vercel.app")) return 2;
  return 0;
}

function readLevelEnv(): Level | null {
  const raw = process.env.NEXT_PUBLIC_NIVEAU;
  if (raw === "0" || raw === "1" || raw === "2" || raw === "3") {
    return Number(raw) as Level;
  }
  return null;
}

function detectVersionFromPath(pathname: string): string | null {
  // CRITIQUE : préfixes longs AVANT courts (v1-9-5 avant v1-9, v1-7-5 avant v1-7)
  if (pathname.startsWith("/sandbox/v1-9-5")) return "v1-9-5";
  if (pathname.startsWith("/sandbox/v1-9")) return "v1-9";
  if (pathname.startsWith("/sandbox/v1-8")) return "v1-8";
  if (pathname.startsWith("/sandbox/v1-7-5")) return "v1-7-5";
  if (pathname.startsWith("/sandbox/v1-7")) return "v1-7";
  if (pathname.startsWith("/sandbox/v1-6")) return "v1-6";
  return null;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(name.length + 1));
}

function writeCookie(name: string, value: string, days = 30): void {
  if (typeof document === "undefined") return;
  const exp = new Date();
  exp.setDate(exp.getDate() + days);
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp.toUTCString()}; path=/; samesite=lax`;
}

function switchVersion(newSlug: string): void {
  if (typeof window === "undefined") return;
  const pathname = window.location.pathname;
  const currentSlug = detectVersionFromPath(pathname);

  if (currentSlug) {
    // On est sur /sandbox/v1-X(/...) → rewrite vers /sandbox/<newSlug>(/...)
    const remainder = pathname.slice(`/sandbox/${currentSlug}`.length);
    const target = `/sandbox/${newSlug}${remainder}${window.location.search}`;
    window.location.href = target;
    return;
  }

  // Pas sur une route sandbox versionnée → pose le cookie + reload
  writeCookie(VERSION_COOKIE, newSlug);
  window.location.reload();
}

function switchLevel(target: 1 | 2): void {
  if (typeof window === "undefined") return;
  const host = `mettrik-niveau${target}.vercel.app`;
  const target_url = `https://${host}${window.location.pathname}${window.location.search}`;
  window.location.href = target_url;
}

export function AdminFloatingPanel() {
  const [level, setLevel] = useState<Level | null>(null);
  const [expanded, setExpanded] = useState(false);
  const sim = useSimulatedTier();
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    const envLevel = readLevelEnv();
    const l = envLevel ?? detectLevelFromHost();
    setLevel(l);
    if (l !== 0) {
      const updateVersion = () => setVersion(detectVersionFromPath(window.location.pathname));
      updateVersion();
      const onNav = () => updateVersion();
      window.addEventListener("popstate", onNav);
      return () => window.removeEventListener("popstate", onNav);
    }
  }, []);

  const meta = useMemo(() => {
    if (level === null || level === 0) return null;
    return LEVEL_META[level];
  }, [level]);

  // Niveau 0 (prod publique) → rien
  if (level === null || level === 0 || meta === null) return null;

  const activeSimLabel = sim ? SIM_LABELS[sim] : null;
  const versionLabel = version ? VERSION_OPTIONS.find((v) => v.slug === version)?.label ?? version : null;
  // Slug courant pour la valeur sélectionnée dans le dropdown : URL > cookie
  const currentVersionSlug = version ?? (typeof document !== "undefined" ? readCookie(VERSION_COOKIE) : null) ?? "";

  return (
    <div className="fixed bottom-3 right-3 z-[9999] flex flex-col items-end gap-1">
      {/* Badge niveau + bouton expand : toujours visible */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          title={meta.tooltip}
          aria-label={meta.label}
          aria-expanded={expanded}
          className={`inline-flex items-center gap-1.5 rounded-full border ${meta.borderClass} ${meta.bgClass} ${meta.textClass} px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] backdrop-blur-md transition-all hover:scale-105 hover:shadow-lg`}
          style={{ WebkitBackdropFilter: "blur(8px)" }}
        >
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
          <span>{meta.label}</span>
          {expanded ? (
            <X className="size-3 ml-1 opacity-70" aria-hidden />
          ) : (
            <Settings2 className="size-3 ml-1 opacity-70" aria-hidden />
          )}
        </button>
      </div>

      {/* Sub-badges univers + simulation : visibles en mode mini ET expand */}
      {versionLabel && (
        <span
          title={`Tu consultes l'univers ${versionLabel}. Indicateur visible en niveau 1/2/3, surtout utile en preview pour distinguer les versions en cours de test.`}
          className="inline-flex items-center gap-1 rounded-full border border-sky-400/40 bg-sky-500/12 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-sky-100 backdrop-blur-md"
        >
          <span aria-hidden className="h-1 w-1 rounded-full bg-sky-300 shadow-[0_0_4px_rgba(125,211,252,0.8)]" />
          Univers : {versionLabel}
        </span>
      )}
      {activeSimLabel && (
        <span
          title={`Simulation tier active : tu vois l'app comme un user ${activeSimLabel}.`}
          className="inline-flex items-center gap-1 rounded-full border border-violet-400/50 bg-violet-500/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-violet-100 backdrop-blur-md"
        >
          <span aria-hidden className="h-1 w-1 rounded-full bg-violet-300 shadow-[0_0_4px_rgba(167,139,250,0.8)]" />
          Sim : {activeSimLabel}
        </span>
      )}

      {/* Panel développé : 3 dropdowns */}
      {expanded && (
        <div
          className="mt-1 w-[260px] rounded-xl border border-violet-500/30 bg-[#0c0c10]/95 p-3 shadow-2xl backdrop-blur-md"
          style={{ WebkitBackdropFilter: "blur(10px)" }}
          role="group"
          aria-label="Panel admin"
        >
          {/* 1. Voir l'app comme */}
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-violet-200">
              {sim ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
              Voir l&apos;app comme
            </span>
            <select
              value={sim ?? ""}
              onChange={(e) => {
                const v = e.target.value as EffectiveTier | "";
                setSimulateTier(v === "" ? null : v);
              }}
              className="w-full rounded-md border border-white/15 bg-[#06060a] px-2 py-1.5 text-[11px] text-zinc-100 focus:border-violet-400 focus:outline-none"
            >
              <option value="">(admin réel)</option>
              {TIER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {/* 2. Version */}
          <label className="mt-2 block">
            <span className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-sky-200">
              <span aria-hidden className="h-1 w-1 rounded-full bg-sky-300" />
              Version
            </span>
            <select
              value={currentVersionSlug}
              onChange={(e) => {
                const slug = e.target.value;
                if (slug) switchVersion(slug);
              }}
              className="w-full rounded-md border border-white/15 bg-[#06060a] px-2 py-1.5 text-[11px] text-zinc-100 focus:border-sky-400 focus:outline-none"
            >
              <option value="">(non défini)</option>
              {VERSION_OPTIONS.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {/* 3. Niveau */}
          <label className="mt-2 block">
            <span className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-orange-200">
              <span aria-hidden className="h-1 w-1 rounded-full bg-orange-300" />
              Niveau
            </span>
            <select
              value={level === 1 || level === 2 ? String(level) : ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "1") switchLevel(1);
                else if (v === "2") switchLevel(2);
              }}
              className="w-full rounded-md border border-white/15 bg-[#06060a] px-2 py-1.5 text-[11px] text-zinc-100 focus:border-orange-400 focus:outline-none"
            >
              <option value="" disabled>
                (sélectionner)
              </option>
              <option value="1">Niveau 1 · Shadow prod</option>
              <option value="2">Niveau 2 · Preview</option>
            </select>
            {level === 3 && (
              <span className="mt-1 block text-[9px] text-zinc-500">
                Tu es en local. Bascule = navigue vers le hostname distant.
              </span>
            )}
          </label>
        </div>
      )}
    </div>
  );
}
