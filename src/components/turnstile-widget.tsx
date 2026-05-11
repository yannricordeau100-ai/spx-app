"use client";

/**
 * TurnstileWidget — captcha invisible Cloudflare Turnstile.
 *
 * Usage dans un form :
 *   <form action={...}>
 *     <input name="email" ... />
 *     <TurnstileWidget />
 *     <button type="submit">Envoyer</button>
 *   </form>
 *
 * Le widget charge le script Turnstile au mount, rend un <div> invisible
 * (ou avec challenge selon config Cloudflare), et insère un champ caché
 * `cf-turnstile-response` dans le form. Le server action / route POST
 * vérifie ensuite ce token via verifyTurnstileToken().
 *
 * Yann 11 mai 2026 : ajouté pour anti-bot sur signup + contact +
 * éventuellement magic link / reset password.
 */
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TEST_SITE_KEY = "1x00000000000000000000AA";

export function TurnstileWidget({
  siteKey,
  fieldName = "cf-turnstile-response",
  theme = "dark",
  size = "normal",
}: {
  siteKey?: string;
  fieldName?: string;
  theme?: "dark" | "light" | "auto";
  size?: "normal" | "flexible" | "compact" | "invisible";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    const key = siteKey ?? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? TEST_SITE_KEY;
    // Charge le script si pas déjà présent
    const exists = document.querySelector(`script[src*="${SCRIPT_URL.split("?")[0]}"]`);
    if (!exists) {
      const s = document.createElement("script");
      s.src = SCRIPT_URL;
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }
    // Polling court : le script peut prendre 100-300ms à se charger
    let tries = 0;
    const iv = window.setInterval(() => {
      tries += 1;
      if (window.turnstile && ref.current && widgetIdRef.current === null) {
        widgetIdRef.current = window.turnstile.render(ref.current, {
          sitekey: key,
          theme,
          size,
          "response-field-name": fieldName,
        });
        window.clearInterval(iv);
      } else if (tries > 50) {
        window.clearInterval(iv);
      }
    }, 100);
    return () => window.clearInterval(iv);
  }, [siteKey, fieldName, theme, size]);

  return <div ref={ref} className="cf-turnstile" data-mettrik-captcha />;
}
