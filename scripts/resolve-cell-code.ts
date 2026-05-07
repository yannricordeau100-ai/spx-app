#!/usr/bin/env tsx
/**
 * resolve-cell-code.ts — résout un code de cellule du tableau back-office
 * data-status (ex: "B5D") vers son contenu actuel : bloc + conv + compteurs.
 *
 * Yann 8 mai 2026 : "si j'écris ce code à n'importe quelle conversation,
 * elle doit automatiquement comprendre de quelle case je parle, sachant
 * que le contenu va évoluer."
 *
 * Toutes les 4 convs (SYSTEMS, DATA, CONCEPTS, BRAND) lisent ce script
 * pour décoder un code reçu de Yann. Source de vérité unique.
 *
 * Format des codes :
 *   B<ligne><colonne>  où ligne = 1..N, colonne = S/D/C/B
 *   - S = CONV-SYSTEMS
 *   - D = CONV-DATA
 *   - C = CONV-CONCEPTS
 *   - B = CONV-BRAND
 *
 * Exemples :
 *   B1S = bloc 1 (KPIs) × CONV-SYSTEMS  → cellule vide (pas son scope)
 *   B1D = bloc 1 (KPIs) × CONV-DATA     → conv responsable, compteur live
 *
 * Usage CLI :
 *   npx tsx scripts/resolve-cell-code.ts B5D
 *   → affiche le bloc, la conv, le total et le détail cat 1/2/3
 *
 * Usage par les convs Claude : lire le module via le live dashboard
 *   `https://mettrik-staging.vercel.app/sandbox/data-status` ou exécuter
 *   ce script en CLI.
 */
import { computeDataStatus } from "../src/lib/v1-7/data-status";

const CONV_BY_LETTER: Record<string, "CONV-SYSTEMS" | "CONV-DATA" | "CONV-CONCEPTS" | "CONV-BRAND"> = {
  S: "CONV-SYSTEMS",
  D: "CONV-DATA",
  C: "CONV-CONCEPTS",
  B: "CONV-BRAND",
};

export type ResolvedCell = {
  code: string;
  block_id: string;
  block_label: string;
  conv: "CONV-SYSTEMS" | "CONV-DATA" | "CONV-CONCEPTS" | "CONV-BRAND";
  is_responsible: boolean;
  counts: { cat1: number; cat2: number; cat3: number; total: number } | null;
};

export function resolveCellCode(code: string): ResolvedCell | null {
  const m = code.trim().toUpperCase().match(/^B(\d+)([SDCB])$/);
  if (!m) return null;
  const lineNum = parseInt(m[1], 10);
  const colLetter = m[2];
  const conv = CONV_BY_LETTER[colLetter];
  if (!conv) return null;

  const status = computeDataStatus();
  const row = status.responsibility_matrix[lineNum - 1];
  if (!row) return null;

  const cell = row.by_conv[conv];
  return {
    code: code.toUpperCase(),
    block_id: row.block_id,
    block_label: row.block_label,
    conv,
    is_responsible: cell !== null,
    counts: cell
      ? { cat1: cell.cat1, cat2: cell.cat2, cat3: cell.cat3, total: cell.cat1 + cell.cat2 + cell.cat3 }
      : null,
  };
}

if (typeof require !== "undefined" && require.main === module) {
  const code = process.argv[2];
  if (!code) {
    console.error("Usage: npx tsx scripts/resolve-cell-code.ts <code>");
    console.error("Ex: npx tsx scripts/resolve-cell-code.ts B5D");
    process.exit(1);
  }
  const r = resolveCellCode(code);
  if (!r) {
    console.error(`❌ Code '${code}' invalide. Format attendu : B<ligne><colonne> où colonne ∈ {S,D,C,B}`);
    process.exit(1);
  }
  console.log(`📍 ${r.code}`);
  console.log(`   Bloc        : ${r.block_label} (${r.block_id})`);
  console.log(`   Conv        : ${r.conv}`);
  console.log(`   Responsable : ${r.is_responsible ? "OUI" : "non"}`);
  if (r.counts) {
    console.log(`   Compteurs   : ${r.counts.total} stés (cat1=${r.counts.cat1}, cat2=${r.counts.cat2}, cat3=${r.counts.cat3})`);
  } else {
    console.log(`   Compteurs   : (cellule vide, conv hors scope sur ce bloc)`);
  }
}
