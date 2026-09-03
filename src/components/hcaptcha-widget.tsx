"use client";

/**
 * HCaptchaWidget — captcha hCaptcha (alternative à Cloudflare Turnstile).
 *
 * Yann 13 mai 2026 : adopté en remplacement de Turnstile car Cloudflare a
 * besoin que les hostnames soient déclarés exactement dans le dashboard
 * CF, ce qui a fait échouer plusieurs tentatives. hCaptcha :
 *   - Compatible nativement Supabase Auth (option captchaToken)
 *   - Configuration en 5 min via dashboard.hcaptcha.com (sans installation)
 *   - Gratuit illimité jusqu'à 1M req/mo
 *   - Pas de tracking Google
 *
 * Setup Yann :
 *   1. dashboard.hcaptcha.com → New site → ajouter mettrik.ai + mettrik-staging.vercel.app
 *   2. Récupérer SITE KEY (public) + SECRET KEY (privée)
 *   3. Supabase Dashboard → Auth → Settings → Bot/Spam protection :
 *        - Activer "Enable Captcha protection"
 *        - Provider : hCaptcha
 *        - Captcha secret : <secret key>
 *   4. Vercel env vars : NEXT_PUBLIC_HCAPTCHA_SITE_KEY = <site key>
 *   5. (Optionnel) TURNSTILE_* peuvent être laissés ou supprimés
 *
 * Si la SITE KEY n'est pas définie, on tombe sur la clé de test hCaptcha
 * qui passe toujours (= dev mode, pas de vraie protection).
 */
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    hcaptcha?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          theme?: "dark" | "light";
          size?: "normal" | "compact" | "invisible";
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
        },
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
    onloadHCaptchaCallback?: () => void;
  }
}

// Test site key fournie par hCaptcha (always passes en dev).
const TEST_SITE_KEY = "10000000-ffff-ffff-ffff-000000000001";

/** Cle publique posee par le serveur dans le document (cf. app/layout.tsx),
 *  parce que la variable Vercel ne porte pas le prefixe NEXT_PUBLIC_. */
function cleRelayee(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const v = (window as unknown as { __hcaptchaSiteKey?: unknown }).__hcaptchaSiteKey;
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function getHCaptchaSiteKey(): string {
  return process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ?? cleRelayee() ?? TEST_SITE_KEY;
}

// Yann (5 juin 2026) : ne pas afficher le widget si on est sur la TEST key
// (sinon banner rouge "Cet hCaptcha est uniquement destiné aux tests" visible
// en prod). Render null + hidden field bypass pour ne pas casser le form.
export function isHCaptchaConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ?? cleRelayee());
}

const SCRIPT_ID = "hcaptcha-script";
const SCRIPT_SRC =
  "https://js.hcaptcha.com/1/api.js?onload=onloadHCaptchaCallback&render=explicit";

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject();
  if (window.hcaptcha) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    let t: ReturnType<typeof setTimeout> | null = null;
    window.onloadHCaptchaCallback = () => {
      if (t) clearTimeout(t);
      resolve();
    };
    t = setTimeout(() => {
      scriptPromise = null;
      reject(new Error("hcaptcha_timeout"));
    }, 8000);
    if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement("script");
      s.id = SCRIPT_ID;
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.onerror = () => {
        if (t) clearTimeout(t);
        scriptPromise = null;
        reject(new Error("hcaptcha_load_failed"));
      };
      document.head.appendChild(s);
    }
  });
  return scriptPromise;
}

export function HCaptchaWidget(props?: {
  siteKey?: string;
  fieldName?: string;
  theme?: "dark" | "light";
  size?: "normal" | "compact";
}) {
  const fieldName = props?.fieldName ?? "h-captcha-response";
  // Yann 3 sept 2026 : la cle relayee par le serveur n existe que dans le
  // navigateur. Si on la lisait pendant le rendu, le serveur et le client ne
  // produiraient pas le meme HTML (erreur d hydratation). On la lit donc
  // apres le montage.
  const [cleRelais, setCleRelais] = useState<string | undefined>(undefined);
  useEffect(() => { setCleRelais(cleRelayee()); }, []);
  const cleEnDur = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;
  const siteKey = props?.siteKey ?? cleEnDur ?? cleRelais ?? TEST_SITE_KEY;
  const theme = props?.theme ?? "dark";
  const size = props?.size ?? "normal";

  // Yann (5 juin 2026) : skip render si pas de vraie sitekey configurée.
  // Évite le banner rouge "uniquement destiné aux tests" en prod.
  const skipRender = !props?.siteKey && !cleEnDur && !cleRelais;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState<string>("");
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "expired">("loading");

  useEffect(() => {
    if (skipRender) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.hcaptcha) return;
        try {
          const id = window.hcaptcha.render(containerRef.current, {
            sitekey: siteKey,
            theme,
            size,
            callback: (tok: string) => {
              setToken(tok);
              setStatus("ready");
            },
            "error-callback": () => setStatus("error"),
            "expired-callback": () => {
              setToken("");
              setStatus("expired");
            },
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
      if (widgetIdRef.current && window.hcaptcha) {
        try {
          window.hcaptcha.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, theme, size]);

  if (skipRender) {
    return <input type="hidden" name={fieldName} value="bypass" />;
  }

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
          Captcha expiré. Reclique dessus.
        </p>
      )}
    </div>
  );
}
