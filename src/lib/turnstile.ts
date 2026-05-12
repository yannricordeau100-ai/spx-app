/**
 * Cloudflare Turnstile — captcha invisible côté serveur.
 *
 * Pourquoi Turnstile et pas reCAPTCHA / hCaptcha :
 *  - Invisible par défaut (pas de "je ne suis pas un robot" intrusif)
 *  - Gratuit illimité (vs reCAPTCHA payant au-delà de 10k/mo)
 *  - Pas de tracking Google
 *  - Anti-bot très solide (Cloudflare voit le trafic mondial)
 *  - Compatible Supabase Auth nativement
 *
 * SETUP YANN (5 min) :
 *  1. dashboard.cloudflare.com → Turnstile → Add Site
 *     Site name : "Mettrik AI" · Domain : mettrik.ai, mettrik-staging.vercel.app
 *     Widget mode : "Invisible" (recommandé) ou "Managed"
 *  2. Récupérer SITE KEY (public) + SECRET KEY (privée)
 *  3. Dans Vercel env vars Production + Preview + Development, ajouter :
 *       NEXT_PUBLIC_TURNSTILE_SITE_KEY = <site key>
 *       TURNSTILE_SECRET_KEY = <secret key>
 *
 * Tant que les keys ne sont pas posées, on tombe sur les TEST KEYS
 * publiques fournies par Cloudflare qui valident toujours (= captcha
 * effectif uniquement avec vraies keys).
 */

const TEST_SITE_KEY = "1x00000000000000000000AA"; // always passes
const TEST_SECRET_KEY = "1x0000000000000000000000000000000AA"; // always passes
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function getTurnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? TEST_SITE_KEY;
}

/**
 * Vérifie un token Turnstile côté serveur via l'API Cloudflare.
 * Retourne true si valide, false sinon. Inclut une protection contre
 * les bots qui ne soumettent pas de token (refus si null/vide).
 *
 * @param token : valeur du champ `cf-turnstile-response` envoyé par le form
 * @param ip : IP du visiteur (optionnel, renforce la vérification)
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  ip?: string | null,
): Promise<{ ok: boolean; reason?: string }> {
  // Yann 13 mai 2026 : RE-STRICT. Refus si pas de token (= bot ou widget
  // bloqué). Le widget côté client gère son propre fallback "Captcha
  // indisponible. Recharge la page" en cas de souci CF.
  if (!token || typeof token !== "string") {
    return { ok: false, reason: "no_token" };
  }
  const secret = process.env.TURNSTILE_SECRET_KEY ?? TEST_SECRET_KEY;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const r = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      // Évite le throttling : 5 sec max
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return { ok: false, reason: `http_${r.status}` };
    const data = (await r.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (!data.success) {
      return { ok: false, reason: (data["error-codes"] ?? []).join(",") || "rejected" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "fetch_failed" };
  }
}
