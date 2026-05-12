"use client";

/**
 * TurnstileWidget — captcha invisible Cloudflare Turnstile.
 *
 * Yann 12 mai 2026 : URGENCE Mac freeze. Le widget Cloudflare créait un
 * polling 100ms qui ne s'arrêtait jamais correctement quand le script CF
 * ne se chargeait pas (réseau, firewall, adblocker). Memory leak + UI
 * bloquée. Désactivation complète : retourne null, ne charge plus rien.
 *
 * Le captcha côté serveur (verifyTurnstileToken) est aussi en mode
 * dégradé : si pas de token, OK (laisse passer). Tant que Cloudflare
 * n'est pas reconfirmé (hostname, sitekey valide pour le domaine), on
 * reste en mode no-op.
 *
 * Pour réactiver :
 * 1. Vérifier dashboard Cloudflare → Turnstile → site mettrik-staging.vercel.app
 *    + mettrik.ai bien dans les hostnames autorisés
 * 2. Restaurer cette implémentation (git revert ce fichier)
 * 3. Restaurer le check strict côté serveur (cf src/lib/turnstile.ts)
 */

export function TurnstileWidget(_props?: {
  siteKey?: string;
  fieldName?: string;
  theme?: "dark" | "light" | "auto";
  size?: "normal" | "flexible" | "compact" | "invisible";
}) {
  // No-op : rend rien, n'enregistre aucun event, pas de polling.
  return null;
}
