/**
 * Apercu des TAM de la fiche (9 oct 2026). Convertit un candidat du Cahier en
 * MarketPosition, exactement comme scripts/tam-pose.py. Pur, utilisable cote client.
 * Un candidat sans valeur de TAM (tam null) n est ni validable ni publiable.
 */
import type { TamCandidat } from "@/lib/cahier";
import type { MarketPosition } from "@/lib/data";

/** 9 oct 2026 : plus de limite, tous les TAM valides sont affiches, tries par revenu de segment decroissant. */
export function enMilliards(p: { segment_revenue: number; segment_unit: string }): number {
  const u = (p.segment_unit ?? "").replace(/[\s$€£]/g, "");
  const f = /^(M|m|Mn|Mio)$/.test(u) ? 1e-3 : /^(K|k)$/.test(u) ? 1e-6 : 1;
  return p.segment_revenue * f;
}
export function trierPositions<T extends { segment_revenue: number; segment_unit: string }>(pos: T[]): T[] {
  return [...pos].sort((a, b) => enMilliards(b) - enMilliards(a));
}

export function tamValide(c: TamCandidat): boolean {
  return typeof c.tam === "number" && Number.isFinite(c.tam) && c.tam > 0 && typeof c.segment_revenu === "number" && Number.isFinite(c.segment_revenu);
}

function unite(u: string | null | undefined): string {
  const x = (u ?? "").trim();
  return ({ "Mds $": "$B", "M $": "$M", "Mds €": "€B", "M €": "€M" } as Record<string, string>)[x] ?? x;
}

export function candidatVersPosition(c: TamCandidat): MarketPosition {
  const src = c.tam_source ?? {};
  return {
    segment_name: c.segment,
    segment_revenue: c.segment_revenu,
    segment_unit: unite(c.segment_unite),
    tam: c.tam,
    tam_unit: unite(c.tam_unite),
    ...(c.tam_fourchette ? { tam_range: c.tam_fourchette } : {}),
    source: src.titre || src.url || "source",
    source_note: `${c.tam_intitule ?? ""}. ${c.commentaire ?? ""} Source : ${src.url ?? ""}`.trim(),
    ...(typeof c.croissance_marche_pct === "number" ? { market_cagr: c.croissance_marche_pct } : {}),
  } as MarketPosition;
}
