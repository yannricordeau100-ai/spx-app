#!/usr/bin/env npx tsx
/**
 * test-ui-fix-templates.ts · CONV-MODULE-UI-AUDIT
 *
 * Tests unitaires rapides pour `src/lib/ui-fix-templates.ts`.
 * Pas de framework, juste des assert + log lisible. Exit 1 si échec.
 *
 * Inputs samples extraits de `src/data/v2-pipeline/NVDA.json` (vrai bug) :
 *   "Suite à une charge de 4,5 Mds$ sur l'inventaire H20, seulement 60 M$
 *    de revenus ont été générés en 2026"
 *
 * Usage : npx tsx scripts/test-ui-fix-templates.ts
 */

import {
  normalizeBToMds,
  normalizeUnitSpacing,
  addNbspBeforePct,
  normalizeNarrative,
  translateSubsector,
  translateChipLabel,
  translateFreshnessLabel,
} from "../src/lib/ui-fix-templates";

const NBSP = " ";
let pass = 0;
let fail = 0;

function eq(label: string, actual: string, expected: string) {
  if (actual === expected) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}`);
    console.log(`     attendu : ${JSON.stringify(expected)}`);
    console.log(`     reçu    : ${JSON.stringify(actual)}`);
  }
}

console.log("=== normalizeBToMds ===");
eq(
  "12B$ → 12 Mds $",
  normalizeBToMds("Le marché atteint 12B$ cette année."),
  "Le marché atteint 12 Mds $ cette année.",
);
eq(
  "5.4B € → 5.4 Mds €",
  normalizeBToMds("CapEx prévu : 5.4B €"),
  "CapEx prévu : 5.4 Mds €",
);
eq(
  "12 B$ avec espace → 12 Mds $",
  normalizeBToMds("Revenu 12 B$ Q4."),
  "Revenu 12 Mds $ Q4.",
);
eq(
  "Le mot 'BIOS' n'est pas converti",
  normalizeBToMds("Le BIOS de la machine."),
  "Le BIOS de la machine.",
);

console.log("\n=== normalizeUnitSpacing ===");
eq(
  "60M$ → 60 M $ (NBSP)",
  normalizeUnitSpacing("60M$ de revenus"),
  `60${NBSP}M${NBSP}$ de revenus`,
);
eq(
  "60 M$ → 60 M $ (NBSP partout)",
  normalizeUnitSpacing("60 M$ de revenus"),
  `60${NBSP}M${NBSP}$ de revenus`,
);
eq(
  "4,5 Mds$ → 4,5 Mds $ (NBSP)",
  normalizeUnitSpacing("charge de 4,5 Mds$ sur l'inventaire"),
  `charge de 4,5${NBSP}Mds${NBSP}$ sur l'inventaire`,
);
eq(
  "0.03 Mds $ déjà OK → idempotent (NBSP forcé)",
  normalizeUnitSpacing("KPI de 0.03 Mds $"),
  `KPI de 0.03${NBSP}Mds${NBSP}$`,
);

console.log("\n=== addNbspBeforePct ===");
eq(
  "10% → 10 % (NBSP)",
  addNbspBeforePct("croissance de 10%"),
  `croissance de 10${NBSP}%`,
);
eq(
  "100% / 50% multi-occurrence",
  addNbspBeforePct("100% des cas, 50% des stés"),
  `100${NBSP}% des cas, 50${NBSP}% des stés`,
);

console.log("\n=== normalizeNarrative (pipeline complet) ===");
const real = "Suite à une charge de 4,5 Mds$ sur l'inventaire H20, seulement 60 M$ de revenus ont été générés en 2026, soit 138% de marge.";
const want =
  `Suite à une charge de 4,5${NBSP}Mds${NBSP}$ sur l'inventaire H20, seulement 60${NBSP}M${NBSP}$ de revenus ont été générés en 2026, soit 138${NBSP}% de marge.`;
eq("phrase NVDA réelle (data v2-pipeline)", normalizeNarrative(real), want);

console.log("\n=== translateSubsector ===");
eq(
  "Compute & Networking → Calcul & réseau",
  translateSubsector("Compute & Networking"),
  "Calcul & réseau",
);
eq(
  "Compute &amp; Networking (HTML entity)",
  translateSubsector("Compute &amp; Networking"),
  "Calcul & réseau",
);
eq(
  "Semi & Equip → FR",
  translateSubsector("Semiconductors & Semiconductor Equipment"),
  "Semi & équipements",
);
eq(
  "Inconnu → renvoie tel quel",
  translateSubsector("Asset Management"),
  "Asset Management",
);

console.log("\n=== translateChipLabel ===");
eq("Sector → Secteur", translateChipLabel("Sector"), "Secteur");
eq("Sub-sector → Sous-secteur", translateChipLabel("Sub-sector"), "Sous-secteur");
eq("Founded → Fondée", translateChipLabel("Founded"), "Fondée");
eq("IPO non traduit (acronyme conservé)", translateChipLabel("IPO"), "IPO");

console.log("\n=== translateFreshnessLabel ===");
eq("Recent → Récent", translateFreshnessLabel("Recent"), "Récent");
eq("Fresh → À jour", translateFreshnessLabel("Fresh"), "À jour");
eq("Stale → Périmé", translateFreshnessLabel("Stale"), "Périmé");
eq("Unknown → Inconnu", translateFreshnessLabel("Unknown"), "Inconnu");

console.log(`\n=== ${pass} pass · ${fail} fail ===`);
process.exit(fail > 0 ? 1 : 0);
