#!/usr/bin/env node
/**
 * Build kpi-templates-by-gics.ts → kpi-templates-by-gics.json
 *
 * Le pipeline Python lit le JSON. Régénéré avant chaque run pipeline.
 *
 * Usage : node scripts/build-kpi-templates-json.mjs
 */
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Import le module TS via tsx ou ts-node, sinon on dynamic-importe le compiled JS
// Plus simple : utiliser un loader ts esm
const projectRoot = resolve(__dirname, "..");

(async () => {
  // Dynamic import du .ts via require pas possible. On utilise tsx en runtime.
  // Pour simplifier : on lit le source TS, extrait les exports via regex (suffisant
  // pour ce template car les datas sont des objets littéraux statiques).
  const { readFileSync } = await import("fs");
  const tsSource = readFileSync(
    resolve(projectRoot, "src/lib/kpi-templates-by-gics.ts"),
    "utf-8",
  );

  // Approche pragmatique : eval-isolé du code TS après stripping des annotations TS.
  // Pour les types simples qu'on a (interfaces + Record + objects), ça marche.
  const stripped = tsSource
    .replace(/import\s+type\s+[^;]+;/g, "")
    .replace(/export\s+type\s+[^=]+=\s*[^;]+;/g, "")
    .replace(/:\s*[A-Z][^,=)]+(?=[,=)])/g, "") // strip type annotations
    .replace(/<[A-Za-z, ]+>/g, "") // strip generics
    .replace(/export\s+function\s+/g, "function ")
    .replace(/export\s+const\s+/g, "const ");

  // Build module dynamically
  const moduleCode = `
    ${stripped};
    return { UNIVERSAL_KPIS, KPI_TEMPLATES, PIPELINE_NOTES };
  `;
  const moduleFn = new Function(moduleCode);
  const result = moduleFn();

  const outPath = resolve(projectRoot, "src/lib/kpi-templates-by-gics.json");
  writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`✅ Built ${outPath}`);
  console.log(
    `   ${Object.keys(result.KPI_TEMPLATES).length} secteurs, ${result.UNIVERSAL_KPIS.length} KPI universels`,
  );
})();
