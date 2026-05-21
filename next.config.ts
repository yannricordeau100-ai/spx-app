import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Force workspace root to this app, otherwise Turbopack picks up
    // /Users/yann/package-lock.json and resolves modules at the wrong level.
    root: path.resolve("."),
  },
  // iPhone Personal Hotspot subnets vary (192.0.0.x, 172.20.10.x, etc.).
  allowedDevOrigins: [
    "192.0.0.2",
    "172.20.10.2",
    "192.168.1.49",
    "*.local",
  ],
  // Yann 21 mai 2026 : Serverless Function bundle dépassait 250 MB à cause
  // de l'inclusion automatique de src/data/v2-pipeline (111 MB) et
  // src/data/v2-pipeline-enrich (49 MB). Ces dossiers sont lus via
  // fs.readFile au runtime (pas import static) donc inutile de les bundler.
  outputFileTracingExcludes: {
    "*": [
      "./src/data/v2-pipeline/**/*",
      "./src/data/v2-pipeline-enrich/**/*",
      "./src/data/v2-pipeline-kpi-v2/**/*",
      "./src/data/v2-pipeline-specific-kpis/**/*",
      "./src/data/v2-pipeline-exhaustive/**/*",
      "./src/data/v2/**/*",
      "./src/data/transcripts/**/*",
      "./src/data/transcript-summaries/**/*",
      "./src/data/governance-cerebras/**/*",
      "./src/data/repartition-cerebras/**/*",
      "./src/data/stories-backfill-residuel/**/*",
      "./src/data/stories-backfill-309-dstories-ko/**/*",
      "./sec-data/**/*",
      "./backups/**/*",
    ],
  },
};

export default nextConfig;
