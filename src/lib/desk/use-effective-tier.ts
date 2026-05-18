"use client";

/**
 * Hook client `useEffectiveTier()` — version client-side du système
 * "view as" admin (cf. effective-tier.ts pour la version server).
 *
 * Lit le cookie `mettrik:simulate-as` côté navigateur si on est sur
 * niveau 1/2/3 (hostname check). Retourne null sur niveau 0 prod
 * (sécurité : ignore le cookie en prod, même si admin).
 */

import { useEffect, useState } from "react";
import { SIMULATE_COOKIE, type EffectiveTier } from "./effective-tier-shared";

const VALID: ReadonlySet<EffectiveTier> = new Set(["anonymous", "free", "premium", "max"]);

function detectLevelClient(): 0 | 1 | 2 | 3 {
  if (typeof window === "undefined") return 0;
  const h = window.location.hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return 3;
  if (h === "mettrik.ai" || h === "www.mettrik.ai") return 0;
  if (h.startsWith("mettrik-niveau1") || h.startsWith("niveau1.")) return 1;
  if (h.endsWith(".vercel.app")) return 2;
  return 0;
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

function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

/**
 * Retourne le tier simulé courant (ou null si pas de simulation ou si
 * on est en niveau 0 prod).
 */
export function useSimulatedTier(): EffectiveTier | null {
  const [tier, setTier] = useState<EffectiveTier | null>(null);
  useEffect(() => {
    const level = detectLevelClient();
    if (level === 0) {
      setTier(null);
      return;
    }
    const raw = readCookie(SIMULATE_COOKIE);
    if (raw && VALID.has(raw as EffectiveTier)) {
      setTier(raw as EffectiveTier);
    } else {
      setTier(null);
    }
  }, []);
  return tier;
}

/** Active une simulation. */
export function setSimulateTier(tier: EffectiveTier | null): void {
  if (tier === null) {
    deleteCookie(SIMULATE_COOKIE);
  } else {
    writeCookie(SIMULATE_COOKIE, tier);
  }
  // Force reload pour que tous les composants Server lisent le nouveau cookie
  if (typeof window !== "undefined") {
    window.location.reload();
  }
}

/**
 * Hook combiné : tier effectif = simulé (si admin niveau 1/2/3) ou réel.
 *
 * Usage :
 *   const tier = useEffectiveTier(realTier);
 *   if (tier === null) → version anonyme
 *   if (tier === "free") → version Free
 *   etc.
 */
export function useEffectiveTier(
  realTier: "free" | "premium" | "max" | null,
): "free" | "premium" | "max" | null {
  const sim = useSimulatedTier();
  if (sim === null) return realTier;
  if (sim === "anonymous") return null;
  return sim;
}
