import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { signaleTokenInvalide } from "./lib/security/alerte";
import CLEAN_ALL from "./data/v1-9-5-clean-all-tickers.json";

// Yann 3 sept 2026 : seules les fiches de l univers en ligne (666) sont
// publiques sans compte. Tout autre chemin d un segment (/account, /admin,
// /desk-..., /whoami...) reste soumis a l authentification.
const TICKERS_PUBLICS = new Set<string>();
for (const t of (CLEAN_ALL as { tickers: string[] }).tickers) {
  const u = t.toUpperCase();
  TICKERS_PUBLICS.add(u);
  TICKERS_PUBLICS.add(u.replace(/\./g, "-"));
  TICKERS_PUBLICS.add(u.replace(/-/g, "."));
}
function estFichePublique(seg: string): boolean {
  return TICKERS_PUBLICS.has(seg.toUpperCase());
}

/**
 * Proxy Next 16 (ex-middleware.ts, renommé selon la nouvelle convention) :
 * refresh la session Supabase à chaque requête (cookies réécrits si le
 * token a expiré). Sans ce proxy, les sessions expirent silencieusement
 * entre 2 navigations.
 *
 * Convention @supabase/ssr : on lit les cookies du request, on
 * intercepte les setAll pour les écrire à la fois dans le request
 * (utile pour le getUser ci-dessous) et dans le response (renvoyé au
 * navigateur).
 */
/**
 * Routes accessibles SANS authentification.
 *
 * RÈGLE STRICTE : seule la home `/` est visible sans compte. Tout le
 * reste (pages sociétés, /concepts, /sandbox, /chart-lab, /account,
 * /favorites, /admin, /desk-*, /email-lab, etc.) exige une session.
 *
 * Exceptions techniques nécessaires au fonctionnement de l'auth :
 *   - /login, /signup : fallbacks redirect vers la modal home
 *   - /auth/* : callback OAuth + reset password
 *   - /api/* : endpoints API gérés au cas par cas (le proxy ne touche pas)
 *   - /favicon.ico, /robots.txt, /sitemap.xml : assets racine
 */
// --- Interrupteur maintenance pilote en base (Yann 1er sept 2026) ---
let maintenanceCache: { valeur: "on" | "off" | "env"; expire: number } = {
  valeur: "env",
  expire: 0,
};
async function modeMaintenanceEffectif(parEnv: boolean): Promise<boolean> {
  const maintenant = Date.now();
  if (maintenant > maintenanceCache.expire) {
    // Valeur par defaut si la lecture echoue : suivre l env.
    maintenanceCache = { valeur: "env", expire: maintenant + 20_000 };
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (url && cle) {
        const r = await fetch(
          `${url}/rest/v1/desk_page_content?select=content_fr&page_key=eq.maintenance&section_key=eq.reglages`,
          {
            headers: { apikey: cle, Authorization: `Bearer ${cle}` },
            signal: AbortSignal.timeout(1500),
          },
        );
        if (r.ok) {
          const lignes = (await r.json()) as { content_fr?: string }[];
          const brut = lignes?.[0]?.content_fr;
          if (brut) {
            const reglage = JSON.parse(brut) as {
              mode?: string;
              programme?: { mode?: string; quand?: string };
            };
            let mode = reglage?.mode;
            // Bascule programmee : passee l heure dite, le mode programme
            // remplace le mode courant (ex : ouverture du site a 9h00 pile).
            const prog = reglage?.programme;
            if (
              prog?.quand &&
              (prog.mode === "on" || prog.mode === "off") &&
              Date.now() >= Date.parse(prog.quand)
            ) {
              mode = prog.mode;
            }
            if (mode === "on" || mode === "off" || mode === "env") {
              maintenanceCache.valeur = mode;
            }
          }
        }
      }
    } catch {
      // silence : l env fait foi
    }
  }
  if (maintenanceCache.valeur === "on") return true;
  if (maintenanceCache.valeur === "off") return false;
  return parEnv;
}

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/login" || pathname === "/signup") return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/api/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml" || pathname === "/llms.txt" || pathname === "/llms-full.txt") return true;
  // Assets statiques de public/ (.png, .jpg, .svg, .webp, .ico, etc.) :
  // toujours publics, sinon le proxy renvoie sur /login et casse les
  // <image> embeds (notamment /brand-mini-logo.png utilisé par le PNG
  // download des charts). Yann 6 mai 2026.
  if (/\.(png|jpe?g|svg|webp|gif|ico|woff2?|ttf|otf)$/i.test(pathname)) return true;
  // /whoami = diag temporaire pour résoudre le 404 desk
  // /whoami retire de la liste publique (audit 2 sept 2026) : exposait l email proprietaire.
  // /legal/* = pages légales (mentions, CGU, CGV, confidentialité) — publiques
  // car obligatoires accessibles sans inscription (RGPD + UX).
  if (pathname === "/legal" || pathname.startsWith("/legal/")) return true;
  // /pricing = page publique tarifs (voir avant de s'inscrire).
  if (pathname === "/pricing") return true;
  // /faq = questions frequentes publiques (Yann 2 sept 2026), indexable.
  if (pathname === "/faq") return true;
  // /k/<ticker>/<code> = micro-lien de partage d un KPI (apercu pour X, LinkedIn...). Public.
  if (pathname.startsWith("/k/")) return true;
  // /maintenance = page de maintenance, toujours publique (sinon pas affichable).
  if (pathname === "/maintenance") return true;
  // /parrainage = page publique (visible sans compte, propose le sign-in à l'intérieur).
  if (pathname === "/parrainage") return true;
  // /contact : PUBLIC depuis le 2 sept 2026 (audit lancement). Les pages
  // legales, la FAQ et le pied de page y renvoient pour les droits RGPD :
  // un formulaire reserve aux inscrits n est pas conforme. Anti-spam par
  // captcha cote serveur quand la cle Turnstile est configuree.
  if (pathname === "/contact") return true;
  // Yann (12 mai 2026) : les HUBS V1.7/V1.8 restent publics, MAIS les
  // pages société individuelles sont gatées (signup requis). Avant, tout
  // /sandbox/v1-8/<ticker> était accessible sans compte → Yann a vu un
  // visiteur déconnecté tout voir sur /sandbox/v1-8/nvda.
  // → On garde public uniquement la liste/hub + les sous-pages "utilitaires"
  // (pricing, contact, pages-toggle, etc.), pas les /[ticker].
  // Yann 29 mai 2026 Phase 2A : seule V1.9.5 reste canonique.
  // V1.5/V1.6/V1.7/V1.7.5/V1.8/V1.9 routes supprimées + redirect 308 proxy.
  // V1.0 reste isolée (routes /<ticker> racine).
  if (pathname === "/sandbox/v1-9-5") return true; // V1.9.5 hub
  // (retire du public le 2 sept 2026 : outil interne, connexion requise)
  // Sous-routes publiques (sandbox utilitaires V1.9.5) : tout ce qui n'est
  // PAS une page société (= /sandbox/v1-9-5/<ticker>).
  if (pathname.startsWith("/sandbox/v1-9-5/")) {
    const tail = pathname.replace(/^\/sandbox\/v1-9-5\//, "");
    const firstSeg = tail.split("/")[0] ?? "";
    // Liste blanche des sous-routes utilitaires (non-tickers)
    // /contact retiré (auth requise, Yann 13 mai 2026).
    const UTIL_SUBPATHS = new Set([
      "pricing",
      // pages-toggle, freshness-audit, i18n-audit, geo-test, data-status,
      // languages-toggle : retires du public le 2 sept 2026 (outils internes).
      // Yann 27 mai 2026 : languages-toggle est un outil GLOBAL (affecte
      // toute l'app, pas seulement V1.8). La page canonique est désormais
      // /sandbox/languages-toggle (cf src/app/sandbox/languages-toggle).
      // L'ancien path /sandbox/v1-8/languages-toggle est conservé pour
      // backward-compat via rewrite ci-dessous.
    ]);
    if (UTIL_SUBPATHS.has(firstSeg)) return true;
    // Yann 3 sept 2026 : les fiches societe sont VISIBLES SANS COMPTE, floutees
    // (palier anonyme caviarde cote serveur). Objectif : referencement Google
    // et moteurs IA (GEO). Les inscrits gratuits voient Google, Meta et
    // Booking en clair ; le reste se deverrouille avec Premium / Max.
    return tail.split("/").length === 1 && estFichePublique(firstSeg);
  }
  // Idem pour l URL canonique courte /<ticker> (ex /aapl, /mc.pa).
  if (/^\/[^/]+$/.test(pathname) && estFichePublique(pathname.slice(1))) return true;
  // /sandbox/data-status = dashboard interne agrégé (compteurs sec-data,
  // pipeline, audit V1.7, crédits LLM). Public car Yann le consulte
  // souvent sans vouloir signer. Aucune PII, aucune donnée client.
  // (retire du public le 2 sept 2026 : outil interne, connexion requise)
  // /sandbox/i18n-audit = audit des traductions par langue (Yann visualise
  // ce qui est couvert et ce qui manque). Pas de PII, public.
  // (retire du public le 2 sept 2026 : outil interne, connexion requise)
  // /sandbox/geo-test = page de test détection géographique (visualise pays
  // détecté + langue + devise déduites). Public, pas de PII.
  // (retire du public le 2 sept 2026 : outil interne, connexion requise)
  // /sandbox/visual-audit : RETIRE de la whitelist le 2 sept 2026 (audit
  // anti-triche) : la page publiait des URL contenant le token d audit.
  // Desormais soumise a l auth comme le reste.
  // /sandbox/quality-tree = registry unique des éléments contrôlables (IDs stables).
  // (retire du public le 2 sept 2026 : outil interne, connexion requise)
  // /sandbox/kpi-search = moteur de recherche KPIs Mettrik (7634 indexés sur
  // 640 stés V1.9.5). Pas de PII, public pour QA + démo. Yann 3 juin 2026.
  // (retire du public le 2 sept 2026 : outil interne, connexion requise)
  // /sandbox/languages-toggle = activer/désactiver les locales pour l'app
  // (outil global, ne dépend pas d'une version de fiche sté). Yann 27 mai 2026.
  // (retire du public le 2 sept 2026 : outil interne, connexion requise)
  // /sandbox/logos-compare = page comparaison avant/apres Logo.dev pour
  // validation visuelle Yann (Yann 3 juin 2026). Public car validation
  // visuelle ponctuelle, aucune PII.
  // (retire du public le 2 sept 2026 : outil interne, connexion requise)
  // /sandbox/chart-export-tests = page tests modele PNG export (Yann 3 juin 2026).
  // Public pour validation visuelle, aucune PII.
  // (retire du public le 2 sept 2026 : outil interne, connexion requise)
  // /sandbox/ready-by-category = counts stés prêtes par catégorie + pays.
  // (retire du public le 2 sept 2026 : outil interne, connexion requise)
  // /sandbox/earnings-schedule = calendrier prochaines executions cron earnings
  // refresh + couverture. Yann 4 juin 2026.
  // (retire du public le 2 sept 2026 : outil interne, connexion requise)
  // /sandbox/vip-inspection : RETIRE de la whitelist le 2 sept 2026 (audit
  // anti-triche) : la page revelait le mecanisme du parametre d audit.
  // /sandbox/coverage-matrix = matrice temps réel des blocs data par sté.
  // Lecture dynamique de v2-pipeline. Public pour Yann suivi enrichissement.
  // (retire du public le 2 sept 2026 : outil interne, connexion requise)
  // /sandbox/top307-breakdown = tableau top 307 V1.8 avec pays + MC + rangs
  // (monde / US / FR / CH / DE). Public pour Yann.
  // /populaire-investisseurs = actions les plus consultées par langue
  // (Wikipedia pageviews). Public, top-nav link.
  if (pathname === "/populaire-investisseurs") return true;
  // /concepts/* = prototypes / mockups visuels CONV-CONCEPTS. Public car
  // utilisés pour vérification visuelle (Yann 13 mai 2026, pour chart-test).
  // (retire du public le 2 sept 2026 : outil interne, connexion requise)
  return false;
}

/**
 * i18n routing path-based :
 *   - `/fr/<route>` : URL visible reste `/fr/...`, contenu rendu en FR
 *     via cookie `NEXT_LOCALE=fr` posé ici. Internal rewrite vers `/<route>`
 *     pour que Next match le bon segment de l'app.
 *   - `/<route>`     : pas de préfixe = anglais par défaut (ou détection
 *     navigateur/pays via getServerLocale).
 *
 * Effet net : un visiteur peut partager `https://mettrik.ai/fr/googl` et
 * la personne en face voit la page en français, peu importe sa locale auto.
 */
// Yann 29 mai 2026 — Phase 1 V1 FR-only : on retire le routing préfixé
// `/fr/...`. Toutes les URLs sont servies en FR par défaut, sans préfixe.
// `stripFrPrefix` est conservée pour préserver les anciennes URLs en
// redirigeant `/fr/<route>` → `/<route>` (308) côté handler ci-dessous.
const FR_PREFIX = "/fr";
function stripFrPrefix(pathname: string): { stripped: string; hadPrefix: boolean } {
  if (pathname === FR_PREFIX) return { stripped: "/", hadPrefix: true };
  if (pathname.startsWith(FR_PREFIX + "/")) {
    return { stripped: pathname.slice(FR_PREFIX.length), hadPrefix: true };
  }
  return { stripped: pathname, hadPrefix: false };
}

export async function proxy(request: NextRequest) {
  // 1. Détecte / strip le préfixe /fr AVANT tout le reste pour que les
  //    auth gates et desk gates voient la route "réelle" sans confusion.
  const originalPathname = request.nextUrl.pathname;
  const { stripped: routePathname, hadPrefix: hadFrPrefix } = stripFrPrefix(originalPathname);

  // 1.0bis. Yann 29 mai 2026 — Phase 1 V1 FR-only : si une URL `/fr/<route>`
  // est encore touchée (anciens backlinks, share Yann), on redirige 308
  // vers `/<route>` (canonique). Plus de routing préfixé /fr/*.
  if (hadFrPrefix) {
    const url = request.nextUrl.clone();
    url.pathname = routePathname;
    return NextResponse.redirect(url, 308);
  }
  // Plus aucun chemin n'est en "FR-locale via préfixe" : tout est FR par défaut.
  const isFrLocale = false;

  // 1.bis Détection auto LANGUE + DEVISE par IP (header Vercel
  // `x-vercel-ip-country`, injecté gratuitement par le edge runtime).
  //
  // RÈGLES (Yann 10 mai 2026) — visiteur NON CONNECTÉ uniquement :
  //   - Langue : si pays officiellement francophone → fr ; germanophone →
  //     de (CH-de → de-CH) ; néerlandophone → nl ; pays UK Commonwealth → en-GB ; sinon → en.
  //   - Devise : si pays a sa devise propre dans nos 10 → utiliser celle-ci ;
  //     sinon : Europe + Afrique → EUR ; reste → USD.
  //
  // Mécanique :
  //   - On lit le cookie NEXT_LOCALE. S'il existe = pref user déjà set
  //     (ou login persisté) → on respecte, on touche pas.
  //   - On lit le cookie mettrik:currency. Idem.
  //   - Si l'un ou l'autre manque → on pose la valeur déduite via IP.
  //     Le cookie expire dans 1 an, persiste tant que le visiteur ne change pas.
  //   - Si user connecté : Supabase user_metadata supplante (géré côté
  //     provider client + page account).
  const hasLocaleCookie = !!request.cookies.get("NEXT_LOCALE")?.value;
  // Yann 15 mai 2026 : auto-reset cookie devise si USD posé alors que
  // l'IP est en Europe/Afrique. Plusieurs users ont USD persisté depuis
  // une session de test ancienne (tunnel US, navigateur partagé, etc.).
  // Sans ça, ils voient des $ à vie sur une app FR/CH.
  const currentCurrency = request.cookies.get("mettrik:currency")?.value?.toUpperCase();
  const country = (request.headers.get("x-vercel-ip-country") ?? "").toUpperCase();
  const EU_AF_NON_USD = new Set([
    "CH","FR","DE","IT","ES","BE","LU","NL","SE","DK","NO","FI","PL","AT",
    "IE","GR","PT","CZ","HU","SK","SI","RO","BG","HR","EE","LT","LV","MT",
    "CY","IS","LI","MC","AD","SM","VA",
    // Africa (large EUR-leaning)
    "MA","DZ","TN","SN","CI","BF","TG","BJ","ML","NE","CM","GA","CG","CD",
  ]);
  // Yann (26 mai 2026) : RETIRÉ la logique wrongCurrencyCookie qui forçait
  // USD → EUR/CHF quand IP était en EU/Afrique. Bug : un user EU qui clique
  // manuellement USD dans le CurrencyPicker se voyait écrasé par le proxy
  // → USD impossible à sélectionner pour Yann (en Suisse). Maintenant on
  // respecte STRICTEMENT le cookie posé par l'utilisateur.
  const hasCurrencyCookie = !!request.cookies.get("mettrik:currency")?.value;
  const isApiOrAsset =
    originalPathname.startsWith("/api/") ||
    originalPathname.startsWith("/auth/") ||
    originalPathname.startsWith("/_next/") ||
    originalPathname === "/favicon.ico" ||
    originalPathname === "/robots.txt" ||
    originalPathname === "/sitemap.xml" || originalPathname === "/llms.txt" || originalPathname === "/llms-full.txt";
  let detectedLocaleForCookie: string | null = null;
  let detectedCurrencyForCookie: string | null = null;
  if (!isApiOrAsset && (!hasLocaleCookie || !hasCurrencyCookie)) {
    // country déjà calculé plus haut pour le check wrongCurrencyCookie
    // Yann 11 mai 2026 : langue OS prioritaire sur géo IP (parité avec le
    // thème qui utilise prefers-color-scheme). Le navigateur transmet la
    // langue OS dans Accept-Language (ex "fr-FR,fr;q=0.9,en-US;q=0.8").
    // Si on match une de nos locales supportées en 1er, on prend.
    // Fallback : country (Vercel geo IP), puis DEFAULT_LOCALE.
    const acceptLang = (request.headers.get("accept-language") ?? "").toLowerCase();
    const osPrimary = acceptLang.split(",")[0]?.trim() ?? "";
    function localeFromAcceptLang(): string | null {
      // Ordre de check : codes exacts (fr-FR, en-GB, de-CH) avant codes simples
      if (osPrimary.startsWith("fr")) return "fr";
      if (osPrimary === "en-gb" || osPrimary.startsWith("en-gb")) return "en-GB";
      if (osPrimary === "de-ch" || osPrimary.startsWith("de-ch")) return "de-CH";
      if (osPrimary.startsWith("de")) return "de";
      if (osPrimary.startsWith("nl")) return "nl";
      if (osPrimary.startsWith("en")) return "en";
      return null;
    }
    try {
      const { COUNTRY_TO_LOCALE, DEFAULT_LOCALE } = await import("./lib/i18n/types");
      const { getCurrencyForCountry } = await import("./lib/currency");
      if (!hasLocaleCookie) {
        // PRIORITÉ 1 : langue OS via Accept-Language
        const fromOs = localeFromAcceptLang();
        let baseLocale: string;
        if (fromOs) {
          baseLocale = fromOs;
          // Cas spéciaux multilingues : si on est dans un pays multilingue
          // ET que la langue OS ne dit rien de plus précis, on garde fromOs
          // tel quel (déjà mappé sur la bonne variante).
        } else {
          // PRIORITÉ 2 : géo IP (pays) si dispo
          baseLocale = country ? (COUNTRY_TO_LOCALE[country] ?? DEFAULT_LOCALE) : DEFAULT_LOCALE;
          // Raffinement BE/CH inchangé : pour les pays multilingues, on
          // utilise la nuance Accept-Language même si OS basique n'a pas matché.
          if (country === "CH" || country === "BE") {
            if (country === "CH") {
              if (osPrimary.startsWith("fr")) baseLocale = "fr";
              else if (osPrimary.startsWith("de")) baseLocale = "de-CH";
              else if (osPrimary.startsWith("it")) baseLocale = "en";
              else baseLocale = "de-CH";
            } else if (country === "BE") {
              if (osPrimary.startsWith("nl")) baseLocale = "nl";
              else if (osPrimary.startsWith("de")) baseLocale = "de";
              else baseLocale = "fr";
            }
          }
        }
        detectedLocaleForCookie = baseLocale;
      }
      if (!hasCurrencyCookie && country) {
        detectedCurrencyForCookie = getCurrencyForCountry(country);
      }
    } catch {
      // Si erreur d'import edge runtime : skip silencieux, fallback EN/USD.
    }

    // Yann 29 mai 2026 — Phase 1 V1 FR-only : on ne redirige plus vers
    // `/fr/<route>` puisque le préfixe a été retiré. Tout est FR par défaut.
  }

  // -1.5. Redirect 301 ancien path admin V1.8 → path canonique sandbox
  //       (Yann 27 mai 2026) : languages-toggle est un outil GLOBAL,
  //       pas spécifique à une version. Path canonique = /sandbox/languages-toggle.
  //       L'ancien /sandbox/v1-8/languages-toggle reste accessible via 301
  //       pour ne pas casser les bookmarks (rewrite, pas redirect visible).
  if (routePathname === "/sandbox/v1-8/languages-toggle") {
    const url = request.nextUrl.clone();
    url.pathname = `${isFrLocale ? "/fr" : ""}/sandbox/languages-toggle`;
    return NextResponse.redirect(url, 301);
  }

  // -1.5bis. Yann 29 mai 2026 — Mission C : path UNIQUE et version-agnostic
  //          pour gérer les blocs page société = `/admin/blocks` (Mission C).
  //          Anciens paths sandbox redirigés en 308 (permanent + méthode
  //          préservée) :
  //            - /sandbox/v1-8/blocks-toggle   → /admin/blocks
  //            - /sandbox/v1-8/blocks-per-ste  → /admin/blocks
  if (
    routePathname === "/sandbox/v1-8/blocks-toggle" ||
    routePathname === "/sandbox/v1-8/blocks-per-ste"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/blocks";
    return NextResponse.redirect(url, 308);
  }

  // -1.5ter. Yann 29 mai 2026 — Phase 2A restructure : V1.5/V1.6/V1.7/V1.7.5/V1.8/V1.9
  //          sont obsolètes. Seule V1.9.5 reste canonique (cf RULES-GOLDEN §0).
  //          Redirect 308 (permanent + méthode préservée) de toutes les
  //          anciennes versions vers leur équivalent V1.9.5.
  //          V1.0 (routes `/<ticker>` racine) reste isolée et inchangée.
  {
    const legacyMatch = routePathname.match(
      /^\/sandbox\/v1-(?:6|7|7-5|8|9)(\/.*)?$/
    );
    if (legacyMatch) {
      const tail = legacyMatch[1] ?? "";
      const url = request.nextUrl.clone();
      url.pathname = `/sandbox/v1-9-5${tail}`;
      return NextResponse.redirect(url, 308);
    }
  }

  // V1.0 (routes `/<ticker>` racine = cat/googl/meta/msci/spgi) RESTE
  // COMPLÈTEMENT ISOLÉE (Yann 29 mai 2026). Pas de redirect. V1.0 fonctionne
  // en standalone avec ses propres datasets et composants. Toute autre
  // version (V1.5/V1.6/V1.7/V1.7.5/V1.8/V1.9) → redirect 308 vers V1.9.5
  // canonique (cf bloc -1.5ter ci-dessus).

  // 0. Maintenance mode (cf. règle Yann 3 mai 2026) : sur prod (mettrik.ai),
  //    SEULE la page /maintenance est accessible. Yann 10 mai 2026 : on
  //    cible exclusivement le domaine mettrik.ai (apex + www) pour éviter
  //    que Vercel injecte MAINTENANCE_MODE=on sur les alias staging custom
  //    (mettrik-staging.vercel.app). La règle est attachée au domaine, pas
  //    seulement à l'env var.
  const host = (request.headers.get("host") ?? "").toLowerCase();
  const isProdDomain = host === "mettrik.ai" || host === "www.mettrik.ai";
  const maintenanceMode = (process.env.MAINTENANCE_MODE ?? "").toLowerCase();
  const maintenanceParEnv =
    maintenanceMode === "on" || maintenanceMode === "true" || maintenanceMode === "1";
  // Yann 1er sept 2026 : interrupteur de lancement SANS redeploiement.
  // /sandbox/lancement ecrit (maintenance, reglages) dans desk_page_content ;
  // le proxy lit ce reglage ici avec un cache memoire de 20 s par instance
  // edge. "on"/"off" priment sur la variable Vercel, "env" (ou absence de
  // ligne) = comportement historique. En cas d erreur reseau : la variable
  // d environnement fait foi, le site ne casse jamais.
  const isMaintenanceOn =
    isProdDomain && (await modeMaintenanceEffectif(maintenanceParEnv));
  if (isMaintenanceOn) {
    const isMaintenancePage = routePathname === "/maintenance";
    // Strictement les routes techniques nécessaires au rendu du site lui-même.
    // /api/* nécessaire pour les appels que la page maintenance pourrait faire
    // (analytics, OG image SSR, etc.) et que le runtime Next utilise.
    // Yann 31 aout 2026 : les FICHIERS STATIQUES manquaient a cette liste.
    // Consequence visible : sur mettrik.ai, /brand/mettrik-ai-white-purple.png
    // etait redirige vers la page de maintenance, l image ne se chargeait pas
    // et la page s affichait sans logo. Tout ce qui porte une extension de
    // fichier ou vient de /brand, /logos, /_next, /fonts passe desormais.
    const estFichierStatique =
      /\.(png|jpe?g|gif|webp|avif|svg|ico|css|js|map|woff2?|ttf|otf|txt|xml|json|pdf|mp4|webm)$/i.test(
        routePathname,
      ) ||
      routePathname.startsWith("/_next/") ||
      routePathname.startsWith("/brand/") ||
      routePathname.startsWith("/logos/") ||
      routePathname.startsWith("/fonts/") ||
      routePathname.startsWith("/findings/");
    const isTechnicalRoute =
      routePathname.startsWith("/api/") ||
      estFichierStatique ||
      routePathname === "/favicon.ico" ||
      routePathname === "/robots.txt" ||
      routePathname === "/sitemap.xml" || routePathname === "/llms.txt" || routePathname === "/llms-full.txt";
    if (!isMaintenancePage && !isTechnicalRoute) {
      const url = request.nextUrl.clone();
      url.pathname = isFrLocale ? "/fr/maintenance" : "/maintenance";
      url.search = "";
      return NextResponse.redirect(url, 307); // 307 = temporary, ne casse pas le SEO long terme
    }
  }

  let response = NextResponse.next({ request });

  // Yann 29 mai 2026 — Phase 1 V1 FR-only : on force NEXT_LOCALE=fr sur
  // toutes les requêtes (UI, assets, API). Plus aucune auto-détection
  // locale, plus aucun cookie autre que "fr" pour la langue. Les autres
  // locales seront ré-activées en V2 quand Yann valide.
  if (!isApiOrAsset) {
    request.cookies.set("NEXT_LOCALE", "fr");
    response.cookies.set("NEXT_LOCALE", "fr", {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    });
  }
  // Note : `detectedLocaleForCookie` n'est plus utilisé pour poser un
  // cookie, mais on garde la variable pour ne pas casser le code en aval
  // (sera retirée plus tard si vraiment plus utile).
  void detectedLocaleForCookie;
  if (detectedCurrencyForCookie) {
    request.cookies.set("mettrik:currency", detectedCurrencyForCookie);
    response.cookies.set("mettrik:currency", detectedCurrencyForCookie, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT : appelle getUser() pour forcer le refresh du token
  // (sinon les cookies ne sont pas mis à jour).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ────────────────────────────────────────────────────────────────────
  // ARCHITECTURE 3 NIVEAUX (Yann 16-17 mai 2026)
  //  - LIVE : www.mettrik.ai / mettrik.ai → public
  //      4 versions utilisateur :
  //        * visitor (non inscrit) → routes whitelistées par isPublicPath
  //        * free (inscrit plan Free)
  //        * premium (plan Premium)
  //        * max (plan Max)
  //      Chaque version × 3 langues × variantes pays
  //  - PRE-LIVE : pre.mettrik.ai → gated admin (compte Yann uniquement)
  //  - DEV : staging.mettrik.ai / mettrik-staging.vercel.app / localhost → gated admin
  // Niveau détecté depuis le hostname. Yann a explicitement demandé que
  // pre + dev soient fermés au grand public.
  // ────────────────────────────────────────────────────────────────────
  const adminEmail = (process.env.DESK_OWNER_EMAIL ?? "yannricordeau100@gmail.com")
    .toLowerCase()
    .trim();
  const isLiveHost = host === "www.mettrik.ai" || host === "mettrik.ai";
  const isPreLiveHost = host === "pre.mettrik.ai";
  const isDevHost = !isLiveHost && !isPreLiveHost;
  const currentLevel = isLiveHost ? "live" : isPreLiveHost ? "pre-live" : "dev";

  // Gate admin pour pre-live + dev : route gated par email admin uniquement
  // (excepté : /api/version qui doit répondre sans auth pour health checks).
  // En dev : on autorise localhost + mettrik-staging.vercel.app sans gate pour
  // permettre les previews Vercel et le dev local.
  const isPreLiveOrCustomDev =
    isPreLiveHost ||
    host === "staging.mettrik.ai" ||
    host === "dev.mettrik.ai";
  if (isPreLiveOrCustomDev) {
    const userEmail = (user?.email ?? "").toLowerCase().trim();
    const isAdmin = !!user && userEmail === adminEmail;
    // Bypass pour les routes techniques absolument nécessaires
    const isTechRoute =
      routePathname === "/api/version" ||
      routePathname === "/favicon.ico" ||
      routePathname === "/robots.txt" ||
      routePathname === "/sitemap.xml" || routePathname === "/llms.txt" || routePathname === "/llms-full.txt" ||
      routePathname.startsWith("/_next/");
    if (!isAdmin && !isTechRoute) {
      const reqSearch = request.nextUrl.search;
      // Si pas connecté → renvoyer vers la home avec auth=signin
      if (!user) {
        const url = request.nextUrl.clone();
        url.pathname = isFrLocale ? "/fr" : "/";
        const original = originalPathname + (reqSearch ?? "");
        url.search = `?auth=signin&next=${encodeURIComponent(original)}`;
        return NextResponse.redirect(url);
      }
      // Connecté mais pas admin → 404 silencieux
      const url = request.nextUrl.clone();
      url.pathname = "/_not-found-desk";
      return NextResponse.rewrite(url);
    }
  }

  // Auth gate : un visiteur non inscrit ne peut voir QUE la home.
  // Yann (11 mai 2026) : redirige vers `/?auth=signin&next=...` pour
  // déclencher la pop-up directement. L'ancien comportement avec
  // simple `?next=` montrait un banner discret que Yann ne voyait pas.
  // NOTE i18n : on check le routePathname (sans préfixe /fr) pour que la
  // gate ait le même comportement quelle que soit la langue. Le `next=`
  // garde le préfixe /fr d'origine pour que le user retombe en FR après login.
  const { search } = request.nextUrl;
  const pathname = routePathname;
  // Bypass audit visuel : token dans query param ?audit_token=... matche
  // VISUAL_AUDIT_TOKEN env → laisse passer sans auth pour permettre les
  // screenshots Gemini (script scripts/visual-audit-gemini.py).
  const auditToken = request.nextUrl.searchParams.get("audit_token");
  const expectedAuditToken = process.env.VISUAL_AUDIT_TOKEN;
  const isAuditBypass = !!(auditToken && expectedAuditToken && auditToken === expectedAuditToken);
  // Alerte rouge (Yann 2 sept 2026) : un token PRESENTE mais FAUX = tentative
  // de forcage de la porte creteur. Email au proprietaire, dedup 1 h.
  if (auditToken && !isAuditBypass) {
    signaleTokenInvalide(pathname, (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim());
  }
  if (!user && !isPublicPath(pathname) && !isAuditBypass) {
    const url = request.nextUrl.clone();
    url.pathname = isFrLocale ? "/fr" : "/";
    const original = originalPathname + (search ?? "");
    url.search = `?auth=signin&next=${encodeURIComponent(original)}`;
    return NextResponse.redirect(url);
  }

  // Desk gate : URL secrète /desk-<slug> accessible uniquement au propriétaire.
  // Toute autre personne (même connectée) prend un 404 silencieux pour ne
  // pas révéler l'existence de la page. Comparaison email case-insensitive
  // car Supabase peut renvoyer l'email avec une casse normalisée.
  const deskSlug = process.env.DESK_SLUG ?? "mtk9x4kp";
  const deskOwner = (process.env.DESK_OWNER_EMAIL ?? "yannricordeau100@gmail.com").toLowerCase().trim();
  if (pathname === `/desk-${deskSlug}` || pathname.startsWith(`/desk-${deskSlug}/`)) {
    const userEmail = (user?.email ?? "").toLowerCase().trim();
    if (!user || userEmail !== deskOwner) {
      // Si pas connecté → renvoyer vers la home avec auth=signin pour que
      // l'utilisateur puisse se connecter sans deviner pourquoi le 404.
      // Si connecté avec mauvais email → 404 silencieux (page n'existe pas).
      if (!user) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        url.search = `?auth=signin&next=${encodeURIComponent(pathname)}`;
        return NextResponse.redirect(url);
      }
      const url = request.nextUrl.clone();
      url.pathname = "/_not-found-desk";
      return NextResponse.rewrite(url);
    }
  }

  // Header X-Mettrik-Version (Yann 16 mai 2026, archi 3 niveaux) :
  // injecté sur TOUTES les réponses, invisible côté HTML public mais
  // visible via curl ou DevTools Network tab. Permet de tracer quelle
  // version est servie + quel niveau (live / pre-live / dev).
  // Mode léger (lit env var) pour éviter un appel BDD à chaque request.
  // La vraie source de vérité reste desk_releases en BDD.
  const buildVersion = process.env.NEXT_PUBLIC_BUILD_VERSION ?? "dev";
  const headerValue = `${currentLevel}/${buildVersion}`;
  response.headers.set("x-mettrik-version", headerValue);
  response.headers.set("x-mettrik-level", currentLevel);

  // i18n : si on est sur /fr/*, on REWRITE vers /<route> pour que Next
  // résolve le bon segment d'app. URL visible côté browser reste /fr/<route>.
  // Le cookie NEXT_LOCALE=fr posé plus haut fait que la page rend en FR.
  if (isFrLocale) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = routePathname;
    const rewriteResponse = NextResponse.rewrite(rewriteUrl, { request });
    // Recopier les cookies posés par supabase (refresh token) + le NEXT_LOCALE.
    response.cookies.getAll().forEach((c) => {
      rewriteResponse.cookies.set(c.name, c.value, c);
    });
    rewriteResponse.headers.set("x-mettrik-version", headerValue);
    rewriteResponse.headers.set("x-mettrik-level", currentLevel);
    return rewriteResponse;
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match toutes les routes SAUF :
     *   - _next/static (assets statiques)
     *   - _next/image (images optimisées)
     *   - favicon.ico, sitemap.xml, robots.txt
     *   - API publiques sans auth (chart-lab data si on en avait)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
