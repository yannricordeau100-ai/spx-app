"use client";

import { useEffect, useState } from "react";
import { SIMULATE_COOKIE, type EffectiveTier } from "@/lib/desk/effective-tier-shared";

/**
 * LevelBadge : indicateur permanent du niveau d'environnement (1/2/3).
 *
 * Architecture multi-niveaux (Yann 18 mai 2026) :
 *   - Niveau 0 = prod publique (mettrik.ai) → AUCUN badge affiché (UI propre user-facing)
 *   - Niveau 1 = "shadow prod" (mettrik-niveau1.vercel.app) → badge orange
 *   - Niveau 2 = preview/dev partagé (mettrik-preview-*.vercel.app) → badge violet
 *   - Niveau 3 = dev local (localhost:3000) → badge gris
 *
 * La valeur du niveau vient de `process.env.NEXT_PUBLIC_NIVEAU` (server +
 * client). Si non défini, fallback heuristique côté client via hostname :
 *   - localhost OU *.local → niveau 3
 *   - mettrik-niveau1.* → niveau 1
 *   - mettrik.ai / www.mettrik.ai → niveau 0 (rien affiché)
 *   - autre vercel.app → niveau 2
 *
 * Badge positionné en bottom-right (n'interfère pas avec le top-nav, visible
 * sur 100 % des pages, ne suit pas le scroll = fixed).
 */

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
    label: "NIVEAU 2 · PREVIEW",
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

function readSimulateCookieClient(): EffectiveTier | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${SIMULATE_COOKIE}=`));
  if (!match) return null;
  const raw = decodeURIComponent(match.slice(SIMULATE_COOKIE.length + 1));
  if (raw === "anonymous" || raw === "free" || raw === "premium" || raw === "max") return raw;
  return null;
}

const SIM_LABELS: Record<EffectiveTier, string> = {
  anonymous: "Anonyme",
  free: "Gratuit",
  premium: "Premium",
  max: "Max",
};

export function LevelBadge() {
  const [level, setLevel] = useState<Level | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [sim, setSim] = useState<EffectiveTier | null>(null);

  useEffect(() => {
    const envLevel = readLevelEnv();
    const l = envLevel ?? detectLevelFromHost();
    setLevel(l);
    if (l !== 0) setSim(readSimulateCookieClient());
  }, []);

  if (level === null || level === 0) return null;
  const meta = LEVEL_META[level];

  return (
    <div className="fixed bottom-3 right-3 z-[9999] flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        title={meta.tooltip}
        aria-label={meta.label}
        className={`inline-flex items-center gap-1.5 rounded-full border ${meta.borderClass} ${meta.bgClass} ${meta.textClass} px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] backdrop-blur-md transition-all hover:scale-105 hover:shadow-lg`}
        style={{ WebkitBackdropFilter: "blur(8px)" }}
      >
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
        <span>{collapsed ? meta.shortLabel : meta.label}</span>
      </button>
      {sim && (
        <span
          title={`Simulation tier active : tu vois l'app comme un user ${SIM_LABELS[sim]}. Désactivable depuis /desk-mtk9x4kp.`}
          className="inline-flex items-center gap-1 rounded-full border border-violet-400/50 bg-violet-500/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-violet-100 backdrop-blur-md"
        >
          <span aria-hidden className="h-1 w-1 rounded-full bg-violet-300 shadow-[0_0_4px_rgba(167,139,250,0.8)]" />
          Sim : {SIM_LABELS[sim]}
        </span>
      )}
    </div>
  );
}

/**
 * Variante SSR-only : version qui injecte le niveau directement depuis
 * `process.env.NEXT_PUBLIC_NIVEAU` côté serveur (pas de flash). À utiliser
 * dans le layout root.
 */
export function LevelBadgeSSR() {
  const raw = process.env.NEXT_PUBLIC_NIVEAU;
  const fromEnv = (raw === "0" || raw === "1" || raw === "2" || raw === "3")
    ? (Number(raw) as Level)
    : null;
  if (fromEnv === 0) return null; // prod : rien
  if (fromEnv !== null) {
    const meta = LEVEL_META[fromEnv];
    return (
      <div
        title={meta.tooltip}
        aria-label={meta.label}
        role="status"
        className={`fixed bottom-3 right-3 z-[9999] inline-flex items-center gap-1.5 rounded-full border ${meta.borderClass} ${meta.bgClass} ${meta.textClass} px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] backdrop-blur-md`}
        style={{ WebkitBackdropFilter: "blur(8px)" }}
      >
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
        <span>{meta.label}</span>
      </div>
    );
  }
  // Pas d'env var → laisse le composant client deviner via hostname
  return <LevelBadge />;
}
