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
          execution?: "render" | "execute";
          language?: string;
          "response-field"?: boolean;
          callback?: (token: string) => void;
          "error-callback"?: (code?: string) => void | boolean;
          "expired-callback"?: () => void;
          "timeout-callback"?: () => void;
          "before-interactive-callback"?: () => void;
          "after-interactive-callback"?: () => void;
          "unsupported-callback"?: () => void;
          "refresh-expired"?: "auto" | "manual" | "never";
          retry?: "auto" | "never";
          "retry-interval"?: number;
        },
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
      execute: (widgetId: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit";

// Yann 22 sept 2026 : le script Cloudflare pose LUI MEME, en mode « flexible »,
// les styles « width:100% ; max-width:100vw ; min-width:300px ; height:65px » sur
// l enveloppe du cadre incorpore (verifie dans api.js servi par Cloudflare).
// C est ce « min-width:300px » qui fait deborder le widget vers la droite des
// que la place disponible tombe sous 300 px : le widget garde 300 px, le cadre
// est plus etroit, le logo Cloudflare sort a droite. On mesure donc la place
// reelle avant de rendre, et on bascule sur la taille compacte (150 px) quand
// les 300 px ne tiennent pas.
const LARGEUR_MINI_FLEXIBLE = 300;

// Le site applique « body { zoom: 1.1 } ». getBoundingClientRect rend des pixels
// ecran (donc agrandis de 10 %), alors que le « min-width:300px » de Cloudflare
// s applique en pixels de mise en page du sous arbre zoome. On divise donc la
// mesure par le zoom cumule pour comparer les deux dans la meme unite.
function largeurDeMiseEnPage(el: HTMLElement): number {
  const rect = el.getBoundingClientRect();
  const propre = (el as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom;
  let zoom = typeof propre === "number" && propre > 0 ? propre : 0;
  if (!zoom) {
    zoom = 1;
    let n: HTMLElement | null = el;
    while (n) {
      const v = parseFloat(window.getComputedStyle(n).zoom || "1");
      if (Number.isFinite(v) && v > 0) zoom *= v;
      n = n.parentElement;
    }
  }
  return rect.width / zoom;
}

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
  // Yann 24 sept 2026 : captcha INVISIBLE par defaut, partout. Il ne tourne
  // qu au clic sur le bouton d envoi et ne s affiche que si Cloudflare exige
  // une verification (comme sur les autres sites).
  const size = props?.size ?? "invisible";
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
  const [essaiEnvoi, setEssaiEnvoi] = useState(false);
  const champRef = useRef<HTMLInputElement | null>(null);
  const relances = useRef(0);
  const jetonPasse = useRef<string>("");
  const invisibleRef = useRef(false);
  invisibleRef.current = invisible;
  // Taille retenue apres mesure de la place disponible. `null` = pas encore
  // mesuree : on ne rend pas le widget tant qu on ne sait pas s il tient.
  const [tailleMesuree, setTailleMesuree] = useState<"flexible" | "compact" | null>(null);

  // Mesure au montage puis a chaque changement de largeur du conteneur, donc a
  // toutes les largeurs de fenetre entre 320 et 1600 px, sans point de rupture
  // ecrit en dur. Aucun overflow masque, aucun transform: la zone cliquable
  // reste exactement celle qui est dessinee.
  const auto = !invisible && size === "flexible";
  useEffect(() => {
    if (!auto) return;
    const el = containerRef.current;
    if (!el) return;
    const mesurer = () => {
      // Le conteneur est vide tant que Cloudflare n a rien dessine dedans, donc
      // sa largeur propre peut valoir zero. On remonte alors aux ancetres pour
      // trouver la premiere largeur reelle : sans cela, la mesure ne repondait
      // jamais et le widget n etait JAMAIS rendu, ce qui empechait toute
      // connexion et toute inscription (regression du 22 sept 2026).
      let dispo = Math.floor(largeurDeMiseEnPage(el));
      let parent: HTMLElement | null = el.parentElement;
      let garde = 0;
      while (dispo <= 0 && parent && garde < 8) {
        dispo = Math.floor(largeurDeMiseEnPage(parent));
        parent = parent.parentElement;
        garde += 1;
      }
      if (dispo <= 0) return; // vraiment rien de mesurable : le repli ci dessous tranchera
      setTailleMesuree(dispo >= LARGEUR_MINI_FLEXIBLE ? "flexible" : "compact");
    };
    mesurer();
    // Filet de securite : quoi qu il arrive, le widget doit apparaitre. Si
    // aucune mesure exploitable n est obtenue en 400 ms, on rend en pleine
    // largeur. Mieux vaut un widget qui deborde de quelques pixels qu un
    // formulaire de connexion sans captcha, donc inutilisable.
    const filet = window.setTimeout(() => {
      setTailleMesuree((t) => t ?? "flexible");
    }, 400);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(mesurer) : null;
    if (ro) ro.observe(el);
    window.addEventListener("resize", mesurer);
    return () => {
      window.clearTimeout(filet);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", mesurer);
    };
  }, [auto]);

  // Taille finalement envoyee a Cloudflare.
  const tailleRendue: "normal" | "flexible" | "compact" | null = invisible
    ? "flexible"
    : auto
      ? tailleMesuree
      : (size as "normal" | "flexible" | "compact");
  const compacte = tailleRendue === "compact";

  useEffect(() => {
    let cancelled = false;
    if (!tailleRendue) return; // mesure en cours : on ne rend pas encore
    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        try {
          const id = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme,
            size: tailleRendue,
            appearance: invisible ? "interaction-only" : "always",
            ...(invisible ? { execution: "execute" as const } : {}),
            language,
            // 28 sept 2026 (boucle de connexion) : Cloudflare ajoutait son propre
            // champ cache « cf-turnstile-response » en plus du notre ; le
            // formulaire relisait parfois l ancien jeton deja consomme.
            "response-field": false,
            callback: (tok: string) => {
              relances.current = 0;
              setToken(tok);
              if (champRef.current) champRef.current.value = tok;
              setStatus("ready");
              if (attente.current) {
                const f = attente.current;
                attente.current = null;
                f(tok);
              }
            },
            // 27 sept 2026 (URGENT, code 600010 a la connexion) : les erreurs
            // 300xxx / 600xxx sont des echecs passagers du defi Cloudflare
            // (reseau, navigateur, defi a rejouer). On relance nous-memes jusqu a
            // 3 fois avant d afficher quoi que ce soit, puis on propose
            // « Réessayer » au lieu d exiger un rechargement de la page.
            "error-callback": (code?: string) => {
              const c = String(code ?? "");
              const passager = /^(3|6)\d{5}$/.test(c) || c === "";
              if (passager && relances.current < 3 && widgetIdRef.current && window.turnstile) {
                relances.current += 1;
                const wid = widgetIdRef.current;
                window.setTimeout(() => {
                  try {
                    window.turnstile?.reset(wid);
                    if (invisibleRef.current && attente.current) window.turnstile?.execute(wid);
                  } catch { /* widget retire entre temps */ }
                }, 800 * relances.current);
                return true;
              }
              setCodeErreur(c);
              setStatus("error");
              // Analytics « Problemes vus par les visiteurs » (15 oct 2026).
              window.dispatchEvent(new CustomEvent("mtk:probleme", { detail: { cat: "captcha", nom: `Turnstile ${c || "erreur"}` } }));
              return true;
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
        if (!cancelled) {
          setStatus("error");
          window.dispatchEvent(new CustomEvent("mtk:probleme", { detail: { cat: "captcha", nom: "Turnstile non charge" } }));
        }
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
  }, [siteKey, theme, size, language, tailleRendue, invisible]);

  // Remise a zero apres chaque envoi du formulaire parent et sur signalReset :
  // Turnstile rend le meme jeton tant que le widget n est pas reinitialise.
  useEffect(() => {
    const form = containerRef.current?.closest("form");
    if (!form) return;
    const apresEnvoi = () => {
      window.setTimeout(() => {
        setToken("");
        if (champRef.current) champRef.current.value = "";
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
            if (invisibleRef.current) window.turnstile.execute(widgetIdRef.current);
          } catch {
            attente.current = null;
            reject(new Error("captcha_reset_impossible"));
            return;
          }
          // 28 sept 2026 : la case peut demander un geste humain : 2 minutes.
          window.setTimeout(() => {
            if (attente.current) {
              attente.current = null;
              reject(new Error("captcha_timeout"));
            }
          }, 120000);
        }),
    };
    return () => {
      ref.current = null;
    };
  }, [props, props?.apiRef]);

  // Mode invisible : au clic sur le bouton d envoi, si aucun jeton n est pret,
  // on suspend l envoi, on lance la verification Cloudflare (invisible sauf
  // si un geste est exige), puis on renvoie le formulaire avec le jeton.
  useEffect(() => {
    if (!invisible) return;
    const form = containerRef.current?.closest("form");
    if (!form) return;
    const auClic = (ev: Event) => {
      // 28 sept 2026 : un jeton ne laisse passer qu UN envoi. S il a deja servi
      // (echec precedent, jeton refuse), on en redemande un neuf.
      const v = champRef.current?.value;
      if (v && v !== jetonPasse.current) { jetonPasse.current = v; return; } // jeton neuf : l envoi continue
      if (!widgetIdRef.current || !window.turnstile) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      setEssaiEnvoi(true);
      attente.current = () => {
        window.setTimeout(() => form.requestSubmit(), 0);
      };
      try {
        window.turnstile.reset(widgetIdRef.current);
        window.turnstile.execute(widgetIdRef.current);
      } catch {
        attente.current = null;
      }
    };
    form.addEventListener("submit", auClic, true);
    return () => form.removeEventListener("submit", auClic, true);
  }, [invisible, tailleRendue]);

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
        // Yann 21 sept 2026, revu le 22 sept 2026 : habillage sobre pour les
        // formulaires sombres, aligne sur la largeur des champs. Le cadre est
        // desormais present a TOUTES les largeurs : ce n est plus lui qui doit
        // disparaitre quand la place manque, c est le widget qui passe en
        // taille compacte (mesure ci dessus). Aucun overflow masque, aucun
        // transform, aucun pointer-events desactive : la case a cocher reste
        // entierement visible et cliquable.
        <div
          className={`w-full max-w-full rounded-lg border bg-white/[0.03] p-2 transition-colors ${
            token ? "border-emerald-400/30" : "border-white/10"
          }`}
        >
          <div
            ref={containerRef}
            className={`cf-turnstile-zone flex w-full min-w-0 max-w-full justify-center ${compacte ? "min-h-[140px]" : "min-h-[65px]"}`}
          />
        </div>
      ) : (
        <div
          ref={containerRef}
          className={"cf-turnstile-zone " + (
            invisible
              ? interactionRequise
                ? "mx-auto w-full max-w-[330px] overflow-hidden"
                : "h-0 w-0 overflow-hidden"
              : compacte
                ? "mx-auto flex w-full max-w-[330px] min-w-0 justify-center min-h-[140px]"
                : "mx-auto flex w-full max-w-[330px] min-w-0 justify-center min-h-[65px]"
          )}
        />
      )}
      <input ref={champRef} type="hidden" name={fieldName} value={token} readOnly />
      {status === "error" && (!invisible || essaiEnvoi) && (
        <p className="mt-1.5 text-[11px] text-rose-400">
          La vérification anti-robot n&apos;a pas abouti{codeErreur ? ` (code ${codeErreur})` : ""}.{" "}
          <button
            type="button"
            className="underline underline-offset-2 hover:text-rose-300"
            onClick={() => {
              relances.current = 0;
              setCodeErreur("");
              setStatus("loading");
              if (widgetIdRef.current && window.turnstile) {
                try {
                  window.turnstile.reset(widgetIdRef.current);
                  if (invisibleRef.current) window.turnstile.execute(widgetIdRef.current);
                } catch { /* widget retire */ }
              }
            }}
          >
            Réessayer
          </button>
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

/* ------------------------------------------------------------------------ */
/* Captcha AU CLIC (Yann 15 oct 2026)                                        */
/* ------------------------------------------------------------------------ */
// Regle : rien de visible tant que l utilisateur n a pas clique sur « Envoyer ».
// Au clic, le widget est rendu (API officielle : render explicite,
// appearance « interaction-only », execution « render ») dans un conteneur
// normal, en flux, jamais masque ni de taille nulle. Si Cloudflare n exige
// aucun geste, le cadre ne s affiche pas, le jeton arrive par le callback et
// le message part. Si Cloudflare exige un geste, le cadre apparait a cet
// endroit. Le jeton est attendu par callback, jamais lu dans un champ.
// Delai : 20 s, reportes de 20 s quand Cloudflare demande un geste humain.

export type CaptchaAuClicApi = { obtenirJeton: () => Promise<string> };

const DELAI_CAPTCHA_MS = 20000;

export function TurnstileAuClic(props: {
  apiRef: { current: CaptchaAuClicApi | null };
  theme?: "dark" | "light" | "auto";
  language?: string;
  siteKey?: string;
}) {
  const { apiRef } = props;
  const theme = props.theme ?? "dark";
  const language = props.language ?? "fr";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const finRef = useRef<((err: Error | null, tok?: string) => void) | null>(null);
  const [phase, setPhase] = useState<"repos" | "verif" | "interaction" | "echec">("repos");
  const [codeErreur, setCodeErreur] = useState("");
  const proprietes = useRef(props);
  proprietes.current = props;

  // Le script seul ne cree aucune iframe : on le precharge pour gagner du
  // temps au clic.
  useEffect(() => {
    loadScript().catch(() => { /* retente au clic */ });
  }, []);

  const retirerWidget = () => {
    if (widgetIdRef.current && window.turnstile) {
      try { window.turnstile.remove(widgetIdRef.current); } catch { /* deja retire */ }
    }
    widgetIdRef.current = null;
  };

  useEffect(() => {
    apiRef.current = {
      obtenirJeton: () =>
        new Promise<string>((resolve, reject) => {
          // Un envoi precedent encore en attente est abandonne.
          if (finRef.current) finRef.current(new Error("captcha_relance"));
          retirerWidget();
          setCodeErreur("");
          setPhase("verif");
          let minuteur: ReturnType<typeof setTimeout> | null = null;
          let termine = false;
          const fin = (err: Error | null, tok?: string) => {
            if (termine) return;
            termine = true;
            finRef.current = null;
            if (minuteur) clearTimeout(minuteur);
            retirerWidget();
            if (err) {
              if (err.message !== "captcha_relance") setPhase("echec");
              reject(err);
            } else {
              setPhase("repos");
              resolve(tok as string);
            }
          };
          finRef.current = fin;
          const armer = () => {
            if (minuteur) clearTimeout(minuteur);
            minuteur = setTimeout(() => fin(new Error("captcha_timeout")), DELAI_CAPTCHA_MS);
          };
          armer();
          loadScript()
            .then(() => {
              if (termine) return;
              const el = containerRef.current;
              if (!el || !window.turnstile) {
                fin(new Error("captcha_non_pret"));
                return;
              }
              const relais = (window as unknown as { __turnstileSiteKey?: unknown }).__turnstileSiteKey;
              const siteKey =
                proprietes.current.siteKey ??
                (typeof relais === "string" && relais.length > 0 ? relais : getTurnstileSiteKey());
              const largeur = Math.floor(largeurDeMiseEnPage(el));
              const size: "flexible" | "compact" =
                largeur > 0 && largeur < LARGEUR_MINI_FLEXIBLE ? "compact" : "flexible";
              try {
                widgetIdRef.current = window.turnstile.render(el, {
                  sitekey: siteKey,
                  theme,
                  size,
                  appearance: "interaction-only",
                  execution: "render",
                  language,
                  "response-field": false,
                  "refresh-expired": "never",
                  "retry-interval": 2000,
                  callback: (tok: string) => {
                    if (tok) fin(null, tok);
                  },
                  "error-callback": (code?: string) => {
                    const c = String(code ?? "");
                    // 3xxxxx / 6xxxxx : echecs passagers, Cloudflare relance
                    // seul (retry « auto ») tant que le delai court.
                    if (!/^(3|6)\d{5}$/.test(c)) {
                      setCodeErreur(c);
                      fin(new Error("captcha_erreur_" + c));
                    }
                    return true;
                  },
                  "timeout-callback": () => fin(new Error("captcha_timeout")),
                  "unsupported-callback": () => fin(new Error("captcha_navigateur")),
                  "before-interactive-callback": () => {
                    setPhase("interaction");
                    armer();
                  },
                  "after-interactive-callback": () => setPhase("verif"),
                });
              } catch {
                fin(new Error("captcha_rendu_impossible"));
              }
            })
            .catch(() => fin(new Error("captcha_script")));
        }),
    };
    return () => {
      apiRef.current = null;
      if (finRef.current) finRef.current(new Error("captcha_relance"));
      retirerWidget();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiRef, theme, language]);

  const actif = phase === "verif" || phase === "interaction";
  return (
    <div className="w-full max-w-full" data-captcha-au-clic={phase}>
      {/* Conteneur en flux, jamais masque : vide (hauteur nulle) tant que rien
          n est rendu ; Cloudflare n y dessine le cadre que s il exige un geste. */}
      <div
        ref={containerRef}
        className={`cf-turnstile-zone mx-auto flex w-full min-w-0 max-w-[330px] justify-center ${phase === "interaction" ? "my-1" : ""}`}
      />
      {actif && (
        <p role="status" className="mt-1.5 text-center text-[11.5px] text-zinc-400">
          {phase === "interaction"
            ? "Vérification anti-robot : cochez la case ci-dessus pour envoyer."
            : "Vérification anti-robot en cours…"}
        </p>
      )}
      {phase === "echec" && (
        <p role="alert" className="mt-1.5 text-center text-[11.5px] text-rose-400">
          Vérification anti-robot non terminée{codeErreur ? ` (code ${codeErreur})` : ""}, recommencez en cliquant à nouveau sur Envoyer.
        </p>
      )}
    </div>
  );
}
