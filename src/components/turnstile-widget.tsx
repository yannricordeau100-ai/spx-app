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
          language?: string;
          callback?: (token: string) => void;
          "error-callback"?: (code?: string) => void;
          "expired-callback"?: () => void;
          "timeout-callback"?: () => void;
          "before-interactive-callback"?: () => void;
          "after-interactive-callback"?: () => void;
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
  /** Yann 16 sept 2026 : « jetonFrais() » remet le captcha a zero et attend un
   *  jeton neuf. A appeler juste avant chaque envoi : un jeton ne vaut qu une
   *  verification et expire au bout de quelques minutes. */
  apiRef?: { current: { jetonFrais: () => Promise<string> } | null };
  /** Yann 21 sept 2026 : langue officielle du widget Cloudflare. */
  language?: string;
  /** Yann 21 sept 2026 : « cadre » = habillage sobre aligne sur les champs du
   *  formulaire sombre (bordure discrete, pleine largeur). Reserve aux pages
   *  d authentification ; les autres emplacements gardent le rendu d origine. */
  cadre?: boolean;
}) {
  const fieldName = props?.fieldName ?? "cf-turnstile-response";
  // Yann 14 sept 2026 : cle publique relayee par app/layout.tsx quand elle est
  // posee sous NEXT_PB_TURNSTILE_SITE_KEY (Vercel refuse « sensible » sur NEXT_PUBLIC_).
  const [cleRelais, setCleRelais] = useState<string | undefined>(undefined);
  useEffect(() => {
    const v = (window as unknown as { __turnstileSiteKey?: unknown }).__turnstileSiteKey;
    setCleRelais(typeof v === "string" && v.length > 0 ? v : undefined);
  }, []);
  // Priorite a la cle relayee (widget « Mettrik » cree le 14 sept 2026), puis l ancienne NEXT_PUBLIC_.
  const siteKey = props?.siteKey ?? cleRelais ?? getTurnstileSiteKey();
  const theme = props?.theme ?? "dark";
  // Yann 16 sept 2026 : « flexible » = la carte Cloudflare prend la largeur
  // disponible au lieu de deborder de la fenetre de connexion.
  const size = props?.size ?? "flexible";
  // Yann 19 sept 2026 : « invisible » = aucun cadre Cloudflare affiche (mode
  // « interaction-only »). Le widget ne se montre que si Cloudflare reclame
  // vraiment un geste de l utilisateur. Sert au changement de mot de passe
  // depuis Mon compte, ou Supabase exige un jeton sans qu on veuille du visuel.
  const invisible = size === "invisible";
  const language = props?.language ?? "fr";
  const cadre = (props?.cadre ?? false) && !invisible;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState<string>("");
  const attente = useRef<((t: string) => void) | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "expired">("loading");
  // Yann 15 sept 2026 : le code d erreur Cloudflare est affiche, il dit la cause
  // (110200 = domaine non autorise sur le widget, 300xxx = reseau ou extension).
  const [codeErreur, setCodeErreur] = useState<string>("");
  const [interactionRequise, setInteractionRequise] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        try {
          const id = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme,
            size: invisible ? "flexible" : (size as "normal" | "flexible" | "compact"),
            appearance: invisible ? "interaction-only" : "always",
            language,
            callback: (tok: string) => {
              setToken(tok);
              setStatus("ready");
              if (attente.current) {
                const f = attente.current;
                attente.current = null;
                f(tok);
              }
            },
            "error-callback": (code?: string) => {
              setCodeErreur(String(code ?? ""));
              setStatus("error");
            },
            "expired-callback": () => {
              setToken("");
              setStatus("expired");
            },
            "timeout-callback": () => setStatus("expired"),
            "before-interactive-callback": () => setInteractionRequise(true),
            "after-interactive-callback": () => setInteractionRequise(false),
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
  }, [siteKey, theme, size, language]);

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
  useEffect(() => {
    const ref = props?.apiRef;
    if (!ref) return;
    ref.current = {
      jetonFrais: () =>
        new Promise<string>((resolve, reject) => {
          if (!widgetIdRef.current || !window.turnstile) {
            reject(new Error("captcha_non_pret"));
            return;
          }
          attente.current = resolve;
          try {
            window.turnstile.reset(widgetIdRef.current);
          } catch {
            attente.current = null;
            reject(new Error("captcha_reset_impossible"));
            return;
          }
          window.setTimeout(() => {
            if (attente.current) {
              attente.current = null;
              reject(new Error("captcha_timeout"));
            }
          }, 15000);
        }),
    };
    return () => {
      ref.current = null;
    };
  }, [props, props?.apiRef]);

  const premierSignal = useRef(true);
  useEffect(() => {
    if (premierSignal.current) { premierSignal.current = false; return; }
    setToken("");
    if (widgetIdRef.current && window.turnstile) {
      try { window.turnstile.reset(widgetIdRef.current); } catch { /* widget deja retire */ }
    }
  }, [props?.signalReset]);

  // Yann 19 sept 2026 : en mode invisible sans geste demande, le cadre
  // Cloudflare (environ 70 px) doit disparaitre COMPLETEMENT du flux, sinon il
  // laisse un vide sous le dernier champ du formulaire. Le conteneur reste dans
  // le DOM et visible (pas de display:none ni de visibility:hidden, Cloudflare
  // refuse de rendre sinon), mais l enveloppe sort du flux : position absolue,
  // taille nulle, debordement masque, donc zero hauteur et zero espacement.
  const masque = invisible && !interactionRequise;

  return (
    <div
      className={
        masque
          ? "pointer-events-none absolute left-0 top-0 h-0 w-0 overflow-hidden"
          : "w-full max-w-full"
      }
      aria-hidden={masque || undefined}
    >
      {cadre ? (
        // Yann 21 sept 2026 : habillage sobre pour les formulaires sombres.
        // Le cadre (bordure + fond + marge interieure) n apparait qu a partir
        // de 420 px de large : en dessous, la place disponible dans la fenetre
        // d authentification tombe a la largeur minimale du widget Cloudflare
        // (300 px), et la moindre marge rognerait la case a cocher. Aucun
        // overflow masque, aucun pointer-events desactive ici : la case reste
        // cliquable en toutes circonstances.
        <div
          className={`rounded-lg border-0 bg-transparent p-0 transition-colors min-[420px]:border min-[420px]:bg-white/[0.03] min-[420px]:p-2 ${
            token ? "min-[420px]:border-emerald-400/30" : "min-[420px]:border-white/10"
          }`}
        >
          <div ref={containerRef} className="w-full min-w-0" />
        </div>
      ) : (
        <div
          ref={containerRef}
          className={
            invisible
              ? interactionRequise
                ? "mx-auto w-full max-w-[330px] overflow-hidden"
                : "h-0 w-0 overflow-hidden"
              : size === "compact"
                ? "mx-auto w-[150px] min-h-[140px]"
                : "mx-auto w-full max-w-[330px] overflow-hidden"
          }
        />
      )}
      <input type="hidden" name={fieldName} value={token} />
      {status === "error" && !invisible && (
        <p className="mt-1.5 text-[11px] text-rose-400">
          Captcha indisponible{codeErreur ? ` (code ${codeErreur})` : ""}. Recharge la page.
        </p>
      )}
      {status === "expired" && !invisible && (
        <p className="mt-1.5 text-[11px] text-amber-400">
          Captcha expiré. Recommence l'opération.
        </p>
      )}
    </div>
  );
}
