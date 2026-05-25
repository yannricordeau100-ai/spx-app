"use client";

/**
 * BlurredFreeValue — affiche soit la valeur réelle (premium / max), soit
 * un masque inviolable + lock + click → modale upgrade (free tier).
 *
 * Yann (25 mai 2026) : technique "inviolable" = la valeur réelle n'est
 * PAS rendue dans le HTML côté client si `blocked=true`. Le composant
 * remplace par un placeholder visuel + le chiffre brut n'est jamais
 * transmis. Pour les vues SSR, le serveur lit le tier user (cookie/session)
 * et ne sérialise pas la valeur.
 *
 * Usage côté composant :
 *   <BlurredFreeValue value={kpi.value} suffix=" Mds $" />
 * Auto : lit le contexte FreemiumBlurProvider + détermine si bloqué pour
 * la sté courante.
 *
 * Override manuel :
 *   <BlurredFreeValue value={X} blocked={false} />  // toujours visible
 *   <BlurredFreeValue value={X} blocked={true} />   // toujours flouté
 */

import { Lock } from "lucide-react";
import Link from "next/link";
import { useFreemiumTier, isTickerLockedForTier } from "@/lib/freemium/context";

type Props = {
  /** Valeur réelle à afficher (chiffre, % ou string formatée). */
  value: string | number | null | undefined;
  /** Suffix (ex " Mds $", " %", " ans"). Affiché à côté de la valeur. */
  suffix?: string;
  /** Override : force le floutage (true) ou la lisibilité (false). Si undefined, auto via contexte + ticker. */
  blocked?: boolean;
  /** Ticker de la sté courante (utilisé si blocked=undefined pour décider). */
  ticker?: string;
  /** Classe CSS appliquée quand la valeur est visible. */
  className?: string;
  /** Lien d'upgrade (défaut /pricing). */
  upgradeHref?: string;
};

export function BlurredFreeValue({
  value,
  suffix = "",
  blocked,
  ticker,
  className,
  upgradeHref = "/pricing",
}: Props) {
  const tier = useFreemiumTier();
  const isBlocked = blocked ?? (ticker ? isTickerLockedForTier(ticker, tier) : tier === "free" || tier === "anon");

  if (!isBlocked) {
    return <span className={className}>{value ?? "—"}{suffix}</span>;
  }

  // Bloqué : on n'affiche JAMAIS la valeur réelle dans le rendu, ni
  // dans data-attributes. Juste un placeholder visuellement attrayant
  // + lock icon + click → /pricing pour upgrade.
  // Yann : "ne pas flouter toutes les phrases car en floutant seulement
  // les chiffres on rend inaccessible la plus value." → ce composant
  // wrap UNIQUEMENT les chiffres, pas le texte autour.
  return (
    <Link
      href={upgradeHref}
      className="group relative inline-flex items-center gap-1 align-baseline"
      title="Premium pour voir cette valeur"
      data-pricing-cta="freemium_blur_value"
    >
      <span
        aria-hidden
        className={`relative inline-block select-none font-mono tabular-nums text-zinc-500 ${className ?? ""}`}
        style={{
          // 2e couche cosmétique de sécurité (le contenu ci-dessous = caractères
          // génériques, JAMAIS la vraie valeur)
          filter: "blur(5px)",
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
      >
        {/* Placeholder caractères neutres — JAMAIS la valeur réelle */}
        ████{suffix && <span className="opacity-50">{suffix}</span>}
      </span>
      <Lock
        className="ml-0.5 size-3 shrink-0 text-amber-400 transition-transform group-hover:scale-110"
        strokeWidth={2.5}
        aria-hidden
      />
      <span className="sr-only">Valeur réservée aux plans Premium et Max — cliquer pour upgrade</span>
    </Link>
  );
}
