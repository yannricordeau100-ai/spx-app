import type { NextConfig } from "next";
import path from "path";
import fs from "fs";

// 13 oct 2026 : une adresse inconnue (/page-qui-n-existe-pas) repondait HTTP 200
// a un visiteur connecte : la route [ticker] diffuse sa page de chargement
// (loading.tsx) avant que notFound() ne s execute, le statut est alors fige a
// 200. Le proxy tranche donc AVANT la page ; il lui faut la liste des routes de
// premier niveau (dossiers de src/app, lue au build, sans entretien a la main)
// et les fiches servies hors univers principal (cles de v1-7-public.json).
function routesRacine(): string[] {
  const app = path.join(process.cwd(), "src/app");
  const noms: string[] = [];
  try {
    for (const d of fs.readdirSync(app, { withFileTypes: true })) {
      if (!d.isDirectory() || d.name.startsWith("[") || d.name.startsWith("_") || d.name.startsWith("@")) continue;
      if (d.name.startsWith("(")) {
        for (const e of fs.readdirSync(path.join(app, d.name), { withFileTypes: true })) if (e.isDirectory() && !/^[[(_@]/.test(e.name)) noms.push(e.name);
      } else noms.push(d.name);
    }
  } catch {
    /* liste vide : le proxy ne renvoie alors aucun 404 (comportement d avant) */
  }
  return noms;
}
function tickersV17(): string[] {
  try {
    return Object.keys(JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/data/v1-7-public.json"), "utf8")));
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  env: {
    MTK_ROUTES_RACINE: routesRacine().join(","),
    MTK_TICKERS_V17: tickersV17().join(","),
  },
  // 8 oct 2026 : dossier de sortie reglable pour le controle des fuites
  // (build local d audit dans un dossier separe, sans toucher au serveur de
  // dev). Vercel ne pose pas NEXT_DIST_DIR : .next par defaut.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Yann 4 sept 2026 : les adresses courtes des pages legales tombaient sur la
  // page de connexion (le proxy ne les reconnaissait ni comme fiche ni comme
  // page publique). Elles menent desormais au bon contenu, ce qui compte aussi
  // pour les formulaires exterieurs, Google et Stripe demandant une adresse de
  // confidentialite accessible sans compte.
  async redirects() {
    return [
      { source: "/confidentialite", destination: "/legal/confidentialite", permanent: true },
      { source: "/politique-confidentialite", destination: "/legal/confidentialite", permanent: true },
      { source: "/cgu", destination: "/legal/conditions", permanent: true },
      { source: "/cgv", destination: "/legal/conditions", permanent: true },
      { source: "/conditions", destination: "/legal/conditions", permanent: true },
      { source: "/mentions-legales", destination: "/legal/mentions", permanent: true },
      { source: "/mentions", destination: "/legal/mentions", permanent: true },
    ];
  },
  // Audit securite 2 sept 2026 : en-tetes de protection (clickjacking, MIME
  // sniffing, fuite de referer, API navigateur inutiles). Pas de CSP stricte
  // pour l instant (Stripe, Supabase, polices, scripts inline Next) : une CSP
  // cassee bloquerait le paiement ; frame-ancestors suffit contre l iframe.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://js.stripe.com\" \"https://checkout.stripe.com\")" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
  turbopack: {
    // Force workspace root to this app, otherwise Turbopack picks up
    // /Users/yann/package-lock.json and resolves modules at the wrong level.
    root: path.resolve("."),
    // 8 oct 2026 (audit des fuites publiques) : tout JSON de src/data importe
    // par du code NAVIGATEUR passe par src/build/assainir-json-client.cjs (hors /scripts, exclu du
    // deploiement par .vercelignore),
    // qui retire notes internes (_note, _doc...), prenom, chemins et noms de
    // scripts. Le serveur lit les fichiers complets. Ne pas retirer.
    rules: {
      "*.json": {
        condition: { all: ["browser", { not: "foreign" }, { path: /^src\/data\// }] },
        loaders: [path.resolve("src/build/assainir-json-client.cjs")],
        as: "*.js",
      },
    },
  },
  // iPhone Personal Hotspot subnets vary (192.0.0.x, 172.20.10.x, etc.).
  allowedDevOrigins: [
    "192.0.0.2",
    "172.20.10.2",
    // Yann 1er sept 2026 : l IP du Mac sur le hotspot varie (.2, .3, ...),
    // on couvre la plage complete du reseau hotspot iPhone.
    "172.20.10.3",
    "172.20.10.4",
    "172.20.10.5",
    "192.168.1.49",
    "*.local",
  ],
  // Yann 21 mai (corrigé 26 mai 2026) : on EXCLUT uniquement les dossiers
  // jamais lus au runtime SSR (audits intermédiaires, batches Cerebras,
  // backfill, sec-data brut, backups). On GARDE v2-pipeline, v2-pipeline-enrich,
  // v2-pipeline-specific-kpis, transcripts et transcript-summaries car ils
  // sont lus par `src/lib/v1-7/load-company.ts` via fs.readFile à chaque
  // rendu de page société. Sans ces dossiers dans le bundle, TOUTES les
  // pages /sandbox/v1-{7-5|8|9-5}/<ticker> renvoient 404 (loadV17Company
  // → kind:"missing" → notFound()).
  // 27 sept 2026 : les theses et anti-theses sont lues a l execution par un
  // chemin construit (src/data/these|att/<ticker>.json) que le tracage ne voit
  // pas : aucune fiche ne les affichait en ligne. On les inclut explicitement.
  outputFileTracingIncludes: {
    // 1er oct 2026 (mission admin cours x KPI) : un fichier de cours par societe, lu a l execution.
    "/[ticker]": ["./src/data/these/**/*", "./src/data/att/**/*", "./src/data/cours-fmp/**/*", "./docs/cahier/moat-tendance-mettrik.json"],
    "/sandbox/**": ["./src/data/these/**/*", "./src/data/att/**/*"],
    // 9 oct 2026 : consignes d ajout de societes, lues a l execution par /sandbox/consignes-societes.
    "/sandbox/consignes-societes": ["./docs/CONSIGNES-NOUVELLES-SOCIETES.md"],
  },
  outputFileTracingExcludes: {
    "*": [
      // Audits intermédiaires + datasets jamais lus au runtime
      // Drafts de batchs : seul kpis-haut est lu au runtime (load-company.ts),
      // tout le reste est exclu du bundle des fonctions (fix deploy 21 juil 2026).
      "./.batches-drafts-safe/kpis-er/**/*",
      "./.batches-drafts-safe/kpis-stories-filings/**/*",
      "./.batches-drafts-safe/kpis-call2/**/*",
      "./.batches-drafts-safe/risks-batch2/**/*",
      "./.batches-drafts-safe/risks-batch4-snippets/**/*",
      "./.batches-drafts-safe/risks-batch4-sections/**/*",
      "./.batches-drafts-safe/risks-batch4-compact-per/**/*",
      "./.batches-drafts-safe/kpis-batch033/**/*",
      "./.batches-drafts-safe/gov-batch017/**/*",
      "./.batches-drafts-safe/gov-batch063/**/*",
      "./.batches-drafts-safe/kpis-batch019/**/*",
      "./.batches-drafts-safe/risks-batch-3-texts/**/*",
      "./.batches-drafts-safe/kpis-batch032-work/**/*",
      "./.batches-drafts-safe/tmp_txt/**/*",
      "./src/data/v2-pipeline/*.gemini.json",
      // Etapes intermediaires des reperes annuels : seul kpi-annuel-fiche est
      // lu au runtime, les deux autres servent a regenerer.
      "./src/data/kpi-annuel-10ans/**/*",
      "./src/data/kpi-effectifs/**/*",
      "./src/data/v2-pipeline-kpi-v2/**/*",
      "./src/data/v2-pipeline-exhaustive/**/*",
      "./src/data/v2-pipeline-i18n/**/*",
      "./src/data/companies/**/*",
      "./src/data/v1-9-complete/**/*",
      "./src/data/v2/**/*",
      "./src/data/governance-cerebras/**/*",
      "./src/data/repartition-cerebras/**/*",
      "./src/data/stories-backfill-residuel/**/*",
      "./src/data/stories-backfill-309-dstories-ko/**/*",
      "./sec-data/**/*",
      "./data-lake/**/*",
      "./backups/**/*",
    ],
  },
  // 8 oct 2026 (audit des fuites publiques, ligne 13) : avec le routage
  // optimiste (actif par defaut en Next 16), chaque fiche /<ticker> envoyait
  // au navigateur la liste de TOUS les dossiers freres de src/app (admin,
  // sandbox, concepts, desk-..., email-lab...). Desactive : le flux RSC ne
  // contient plus l arbre des routes. Ne pas reactiver.
  experimental: {
    optimisticRouting: false,
    // Build local d audit (NEXT_DIST_DIR pose) : moins de parallelisme pour ne
    // pas saturer la memoire du Mac. Sans effet sur Vercel.
    ...(process.env.NEXT_DIST_DIR ? { cpus: 2, turbopackPluginRuntimeStrategy: "workerThreads" as const } : {}),
  },
  // Build local d audit : la verification de types est faite a part (npx tsc --noEmit).
  ...(process.env.NEXT_DIST_DIR ? { typescript: { ignoreBuildErrors: true } } : {}),
};

export default nextConfig;
