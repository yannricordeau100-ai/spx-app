"use client";

import { useEffect } from "react";
import { detectLevelFromHost } from "@/lib/desk/effective-tier-shared";

/**
 * Repere visuel temporaire (7 oct 2026, demande de Yann) : pose la classe
 * `ev-repere` sur <html> UNIQUEMENT en niveau 2 (preversion, *.vercel.app ou
 * NEXT_PUBLIC_NIVEAU=2). Sur mettrik.ai (niveau 0), en local (3) et en niveau
 * 1 la classe n est jamais posee : la regle CSS correspondante (globals.css)
 * reste donc sans effet. Les elements issus d une journee investisseurs ou
 * d une conference portent data-evenement="1".
 */
export function EvenementsRepere() {
  useEffect(() => {
    const env = process.env.NEXT_PUBLIC_NIVEAU;
    const niveau = env === "0" || env === "1" || env === "2" || env === "3"
      ? Number(env)
      : detectLevelFromHost(window.location.hostname);
    const racine = document.documentElement;
    if (niveau === 2) racine.classList.add("ev-repere");
    else racine.classList.remove("ev-repere");
    return () => racine.classList.remove("ev-repere");
  }, []);
  return null;
}
