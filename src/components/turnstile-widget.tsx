"use client";

/**
 * TurnstileWidget — captcha Cloudflare Turnstile.
 *
 * Yann 13 mai 2026 : RÉACTIVATION en mode "managed" / "always visible".
 * Cycle de vie strict pour éviter le bug Mac freeze précédent :
 *  - script chargé 1 fois par session (idempotent)
 *  - widget monté via window.turnstile.render() avec callback
 *  - démonté via window.turnstile.remove() à l'unmount React
 *  - aucun setInterval / polling
 *  - timeout 8 sec : si le script CF ne se charge pas, affiche un fallback
 *    "réessaye dans 10 sec" plutôt que de bloquer.
 */
import { useEffect, useRef, useState } from "react";
import { getTurnstileSiteKey } from "@/lib/turnstile";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          theme?: "dark" | "light" | "auto";
          size?: "normal" | "flexible" | "compact";
          appearance?: "always" | "execute" | "interaction-only";
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          "timeout-callback"?: () => void;
        },
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit";

let scriptLoadingPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject();
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;
  scriptLoadingPromise = new Promise<void>((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    window.onloadTurnstileCallback = () => {
      if (timeoutId) clearTimeout(timeoutId);
      resolve();
    };
    timeoutId = setTimeout(() => {
      scriptLoadingPromise = null;
      reject(new Error("turnstile_script_timeout"));
    }, 8000);
    if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement("script");
      s.id = SCRIPT_ID;
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.onerror = () => {
        if (timeoutId) clearTimeout(timeoutId);
        scriptLoadingPromise = null;
        reject(new Error("turnstile_script_load_failed"));
      };
      document.head.appendChild(s);
    }
  });
  return scriptLoadingPromise;
}

export function TurnstileWidget(props?: {
  siteKey?: string;
  fieldName?: string;
  theme?: "dark" | "light" | "auto";
  size?: "normal" | "flexible" | "compact" | "invisible";
  /** Yann 14 sept 2026 : incrementer ce nombre remet le captcha a zero (un
   *  jeton ne vaut qu une verification cote Supabase). */
  signalReset?: number;
}) {
  const fieldName = props?.fieldName ?? "cf-turnstile-response";
  // Yann 14 sept 2026 : cle publique relayee par app/layout.tsx quand elle est
  // posee sous NEXT_PB_TURNSTILE_SITE_KEY (Vercel refuse « sensible » sur NEXT_PUBLIC_).
  const [cleRelais, setCleRelais] = useState<string | undefined>(undefined);
  useEffect(() => {
    const v = (window as unknown as { __turnstileSiteKey?: unknown }).__turnstileSiteKey;
    setCleRelais(typeof v === "string" && v.length > 0 ? v : undefined);
  }, []);
  const siteKey = props?.siteKey ?? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? cleRelais ?? getTurnstileSiteKey();
  const theme = props?.theme ?? "dark";
  const size = (props?.size === "invisible" ? "normal" : props?.size) ?? "normal";

  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState<string>("");
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "expired">("loading");

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        try {
          const id = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme,
            size: size as "normal" | "flexible" | "compact",
            appearance: "always",
            callback: (tok: string) => {
              setToken(tok);
              setStatus("ready");
            },
            "error-callback": () => setStatus("error"),
            "expired-callback": () => {
              setToken("");
              setStatus("expired");
            },
            "timeout-callback": () => setStatus("expired"),
          });
          widgetIdRef.current = id;
        } catch {
          setStatus("error");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, theme, size]);

  // Remise a zero apres chaque envoi du formulaire parent et sur signalReset :
  // Turnstile rend le meme jeton tant que le widget n est pas reinitialise.
  useEffect(() => {
    const form = containerRef.current?.closest("form");
    if (!form) return;
    const apresEnvoi = () => {
      window.setTimeout(() => {
        setToken("");
        if (widgetIdRef.current && window.turnstile) {
          try { window.turnstile.reset(widgetIdRef.current); } catch { /* widget deja retire */ }
        }
      }, 0);
    };
    form.addEventListener("submit", apresEnvoi);
    return () => form.removeEventListener("submit", apresEnvoi);
  }, []);
  const premierSignal = useRef(true);
  useEffect(() => {
    if (premierSignal.current) { premierSignal.current = false; return; }
    setToken("");
    if (widgetIdRef.current && window.turnstile) {
      try { window.turnstile.reset(widgetIdRef.current); } catch { /* widget deja retire */ }
    }
  }, [props?.signalReset]);

  return (
    <div className="inline-block">
      <div ref={containerRef} />
      <input type="hidden" name={fieldName} value={token} />
      {status === "error" && (
        <p className="mt-1 text-[11px] text-rose-400">
          Captcha indisponible. Recharge la page.
        </p>
      )}
      {status === "expired" && (
        <p className="mt-1 text-[11px] text-amber-400">
          Captcha expiré. Recommence l'opération.
        </p>
      )}
    </div>
  );
}
