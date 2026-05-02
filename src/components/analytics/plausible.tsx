/**
 * Plausible Analytics — stub privacy-first (pas de cookie banner requis).
 *
 * STATUS : prêt, env var `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` en `todo`. Activé
 * automatiquement dès qu'on crée le compte Plausible (free trial 30j ou ~9 €/mois).
 *
 * Pourquoi Plausible (vs Google Analytics) :
 *   - Pas de cookies, pas de tracking individuel → pas de banner RGPD requis
 *   - Léger (1 KB script vs 50 KB pour GA)
 *   - Conforme RGPD / Privacy Act sans configuration
 *   - Hébergé en UE
 *
 * Usage : <PlausibleScript /> dans le layout root.
 */

import Script from "next/script";

export function PlausibleScript() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain || domain === "TODO") return null;

  return (
    <>
      <Script
        defer
        data-domain={domain}
        src="https://plausible.io/js/script.tagged-events.outbound-links.js"
        strategy="afterInteractive"
      />
      {/* Helper global window.plausible() pour tracker des events custom */}
      <Script id="plausible-init" strategy="afterInteractive">
        {`window.plausible = window.plausible || function() { (window.plausible.q = window.plausible.q || []).push(arguments) }`}
      </Script>
    </>
  );
}

/* Usage côté client pour tracker un event custom :
 *
 *   import { trackEvent } from "@/components/analytics/plausible";
 *   trackEvent("Checkout Started", { plan: "premium_monthly" });
 */
type PlausibleWindow = Window & {
  plausible?: (event: string, options?: { props?: Record<string, string | number | boolean> }) => void;
};

export function trackEvent(name: string, props?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  const w = window as PlausibleWindow;
  if (typeof w.plausible === "function") {
    w.plausible(name, props ? { props } : undefined);
  }
}
