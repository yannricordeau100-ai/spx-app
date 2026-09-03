import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
