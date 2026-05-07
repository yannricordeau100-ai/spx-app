import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/login" || pathname === "/signup") return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/api/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml") return true;
  // Assets statiques de public/ (.png, .jpg, .svg, .webp, .ico, etc.) :
  // toujours publics, sinon le proxy renvoie sur /login et casse les
  // <image> embeds (notamment /brand-mini-logo.png utilisé par le PNG
  // download des charts). Yann 6 mai 2026.
  if (/\.(png|jpe?g|svg|webp|gif|ico|woff2?|ttf|otf)$/i.test(pathname)) return true;
  // /whoami = diag temporaire pour résoudre le 404 desk
  if (pathname === "/whoami") return true;
  // /legal/* = pages légales (mentions, CGU, CGV, confidentialité) — publiques
  // car obligatoires accessibles sans inscription (RGPD + UX).
  if (pathname === "/legal" || pathname.startsWith("/legal/")) return true;
  // /pricing = page publique tarifs (voir avant de s'inscrire).
  if (pathname === "/pricing") return true;
  // /maintenance = page de maintenance, toujours publique (sinon pas affichable).
  if (pathname === "/maintenance") return true;
  // /parrainage = page publique (visible sans compte, propose le sign-in à l'intérieur).
  if (pathname === "/parrainage") return true;
  // /contact = formulaire de contact public.
  if (pathname === "/contact") return true;
  // /sandbox/v1-7 et /sandbox/v1-7/<ticker> = hub V1.7 + fiches société
  // Pass 3 strict, publics (showcase qualité top-top, accessible sans auth
  // pour démo investisseur). Décision Yann 4 mai 2026.
  if (pathname === "/sandbox/v1-7" || pathname.startsWith("/sandbox/v1-7/")) return true;
  // /sandbox/v1-8 et /sandbox/v1-8/<ticker> = même chose mais filtre relaxé
  // (Pass 3 Sonnet + hero usable). Yann 7 mai 2026 — public.
  if (pathname === "/sandbox/v1-8" || pathname.startsWith("/sandbox/v1-8/")) return true;
  // /sandbox/data-status = dashboard interne agrégé (compteurs sec-data,
  // pipeline, audit V1.7, crédits LLM). Public car Yann le consulte
  // souvent sans vouloir signer. Aucune PII, aucune donnée client.
  if (pathname === "/sandbox/data-status") return true;
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
  const { stripped: routePathname, hadPrefix: isFrLocale } = stripFrPrefix(originalPathname);

  // 1.bis Détection langue automatique par IP (Vercel x-vercel-ip-country).
  // Si visiteur arrive sur une route SANS préfixe et SANS cookie NEXT_LOCALE,
  // on regarde son pays via header IP. Si le pays parle FR (FR/BE/LU/MC),
  // redirect vers /fr/<route>. Sinon laisser passer (EN par défaut).
  // Exceptions : /api, /auth, /_next, assets.
  const hasLocaleCookie = !!request.cookies.get("NEXT_LOCALE")?.value;
  const isApiOrAsset =
    originalPathname.startsWith("/api/") ||
    originalPathname.startsWith("/auth/") ||
    originalPathname.startsWith("/_next/") ||
    originalPathname === "/favicon.ico" ||
    originalPathname === "/robots.txt" ||
    originalPathname === "/sitemap.xml";
  if (!isFrLocale && !hasLocaleCookie && !isApiOrAsset) {
    const country = request.headers.get("x-vercel-ip-country") ?? "";
    // Liste des pays qu'on redirige vers /fr (les seuls actuellement traduits).
    // Quand DE/NL/SV/DA seront traduits, on étendra cette logique.
    const FR_COUNTRIES = ["FR", "BE", "LU", "MC"];
    if (FR_COUNTRIES.includes(country.toUpperCase())) {
      const url = request.nextUrl.clone();
      url.pathname = "/fr" + (originalPathname === "/" ? "" : originalPathname);
      return NextResponse.redirect(url, 307);
    }
  }

  // 0. Maintenance mode (cf. règle Yann 3 mai 2026) : sur prod (mettrik.ai),
  //    SEULE la page /maintenance est accessible. Toute autre URL user-facing
  //    redirige vers /maintenance, y compris /desk-*, /admin, /whoami qui
  //    étaient temporairement whitelistés. Quand Yann veut accéder à son
  //    desk en prod, il désactive MAINTENANCE_MODE depuis Vercel ou bosse
  //    sur staging (où MAINTENANCE_MODE n'est jamais activé).
  //    Seules exceptions strictement techniques : assets statiques (favicon,
  //    robots, sitemap) et endpoints API internes nécessaires au runtime
  //    Next/Vercel (sans /api Next ne peut pas servir la page).
  const maintenanceMode = (process.env.MAINTENANCE_MODE ?? "").toLowerCase();
  const isMaintenanceOn = maintenanceMode === "on" || maintenanceMode === "true" || maintenanceMode === "1";
  if (isMaintenanceOn) {
    const isMaintenancePage = routePathname === "/maintenance";
    // Strictement les routes techniques nécessaires au rendu du site lui-même.
    // /api/* nécessaire pour les appels que la page maintenance pourrait faire
    // (analytics, OG image SSR, etc.) et que le runtime Next utilise.
    const isTechnicalRoute =
      routePathname.startsWith("/api/") ||
      routePathname === "/favicon.ico" ||
      routePathname === "/robots.txt" ||
      routePathname === "/sitemap.xml";
    if (!isMaintenancePage && !isTechnicalRoute) {
      const url = request.nextUrl.clone();
      url.pathname = isFrLocale ? "/fr/maintenance" : "/maintenance";
      url.search = "";
      return NextResponse.redirect(url, 307); // 307 = temporary, ne casse pas le SEO long terme
    }
  }

  let response = NextResponse.next({ request });

  // Si /fr/* : pose le cookie NEXT_LOCALE=fr sur la response ET aussi sur
  // request.cookies (pour que getServerLocale() le lise dans le même request).
  if (isFrLocale) {
    request.cookies.set("NEXT_LOCALE", "fr");
    response.cookies.set("NEXT_LOCALE", "fr", {
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

  // Auth gate : un visiteur non inscrit ne peut voir QUE la home.
  // Redirige vers `/?next=<chemin>` (SANS `auth=signin`) pour éviter
  // l'auto-pop de la modal en pleine face. La home affichera un banner
  // discret invitant à se connecter, et c'est l'user qui déclenche la
  // modal en cliquant.
  // NOTE i18n : on check le routePathname (sans préfixe /fr) pour que la
  // gate ait le même comportement quelle que soit la langue. Le `next=`
  // garde le préfixe /fr d'origine pour que le user retombe en FR après login.
  const { search } = request.nextUrl;
  const pathname = routePathname;
  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = isFrLocale ? "/fr" : "/";
    const original = originalPathname + (search ?? "");
    url.search = `?next=${encodeURIComponent(original)}`;
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
