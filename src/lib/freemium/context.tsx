"use client";

/**
 * FreemiumBlurProvider — wrapper global qui pose un contexte React lu par
 * tous les composants `<BlurredFreeValue>` et `<BlurredKpiChart>`.
 *
 * Yann (25 mai 2026) : floutage "inviolable" des chiffres clés pour les
 * utilisateurs en plan FREE. Inviolabilité = la valeur réelle N'EST PAS
 * envoyée côté client si l'utilisateur est en plan free pour une sté
 * verrouillée. Le serveur rend un placeholder (`***` ou skeleton). Pas
 * possible de voir la valeur via devtools / curl / source HTML.
 *
 * Stratégie applicative :
 *  - Provider posé dans le layout root (`src/app/layout.tsx`) ou dans la
 *    page société (`/sandbox/v1-9-5/[ticker]`)
 *  - Lit le tier user (cookie / session Supabase) côté server, passe en prop
 *  - Composants <BlurredFreeValue value={X} blocked={!hasAccess}> rendent
 *    soit la valeur réelle (premium / max), soit un masque CSS blur + lock
 *    icon + click → modale upgrade
 *  - Filter 1-clic = changement du `tier` au niveau Provider → tous les
 *    composants enfants se mettent à jour automatiquement
 *
 * Inviolabilité technique :
 *  - Le SSR rend le placeholder côté serveur si blocked=true. La vraie
 *    valeur n'est JAMAIS dans le HTML envoyé au client free.
 *  - Le filter:blur(8px) côté CSS est une 2e couche cosmétique pour les
 *    composants client (charts) où la valeur transite côté browser.
 *  - Pour les graphiques (chart-cycle, curve, bars) : props.values est
 *    passé en `Array<number | null>` où null = blocked, et le chart
 *    rend une zone gris masquée à la place de la donnée.
 */

import { createContext, useContext, type ReactNode } from "react";

export type UserTier = "anon" | "free" | "premium" | "max";

type FreemiumContextValue = {
  tier: UserTier;
  /** Permet à l'admin d'override depuis le panel floating (simulate-tier). */
  simulatedTier?: UserTier;
};

const FreemiumContext = createContext<FreemiumContextValue>({
  tier: "anon",
});

export function FreemiumBlurProvider({
  tier,
  simulatedTier,
  children,
}: {
  tier: UserTier;
  simulatedTier?: UserTier;
  children: ReactNode;
}) {
  return (
    <FreemiumContext.Provider value={{ tier, simulatedTier }}>
      {children}
    </FreemiumContext.Provider>
  );
}

/** Hook : récupère le tier effectif (simulé > réel). */
export function useFreemiumTier(): UserTier {
  const { tier, simulatedTier } = useContext(FreemiumContext);
  return simulatedTier ?? tier;
}

/**
 * Détermine si une sté est verrouillée pour le tier courant.
 *
 * Règle Yann : seules 2 stés sont accessibles en free (Google + Meta par
 * tradition V1, override BDD via `pricing_plan_features` plus tard).
 * Premium / Max → toutes les stés accessibles.
 *
 * @param ticker  Ticker de la sté affichée (ex "AAPL")
 * @param tier    Tier user effectif
 * @returns true si la sté est verrouillée (= chiffres à flouter), false sinon
 */
export function isTickerLockedForTier(ticker: string, tier: UserTier): boolean {
  // Yann 29 aout 2026 : le systeme de floutage s applique a TOUTES les
  // societes. L acces libre historique a GOOGL/GOOG/META (tradition V1) est
  // supprime : au palier gratuit comme en anonyme, chaque fiche montre le
  // meme decoupage floute, sans exception.
  void ticker;
  return tier !== "premium" && tier !== "max";
}
