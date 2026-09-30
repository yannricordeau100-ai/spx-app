"use client";

/**
 * Yann 30 sept 2026 : liste des societes 100 % visibles en gratuit, cote
 * client. Un seul appel a /api/visibles-gratuit par chargement de page,
 * partage entre tous les composants ; liste par defaut en attendant.
 */
import { useEffect, useState } from "react";
import { VISIBLES_GRATUIT_DEFAUT } from "./visibles-gratuit-defaut";

let promesse: Promise<Set<string>> | null = null;
let dernier: Set<string> = new Set(VISIBLES_GRATUIT_DEFAUT);

function charge(): Promise<Set<string>> {
  if (!promesse) {
    promesse = fetch("/api/visibles-gratuit")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (Array.isArray(j?.tickers)) dernier = new Set((j.tickers as string[]).map((t) => String(t).toUpperCase()));
        return dernier;
      })
      .catch(() => dernier);
  }
  return promesse;
}

export function useVisiblesGratuit(): ReadonlySet<string> {
  const [v, setV] = useState<ReadonlySet<string>>(dernier);
  useEffect(() => {
    let vivant = true;
    charge().then((s) => vivant && setV(s));
    return () => { vivant = false; };
  }, []);
  return v;
}
