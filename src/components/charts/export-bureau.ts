/**
 * 7 oct 2026 : l export PNG a toujours la mise en page ORDINATEUR, quel que
 * soit l ecran d ou il est lance. Les graphiques calculent leur disposition
 * mobile (polices d axes agrandies, etiquettes decimees, cadre elargi) avec
 * une media query ; pendant un export on la neutralise via ce petit magasin :
 * downloadVisibleChart() l active, attend le rendu, exporte, puis le relache.
 */
import { useSyncExternalStore } from "react";

let actif = false;
const abonnes = new Set<() => void>();

export function fixerExportBureau(v: boolean): void {
  if (actif === v) return;
  actif = v;
  abonnes.forEach((f) => f());
}

export function useExportBureau(): boolean {
  return useSyncExternalStore(
    (f) => { abonnes.add(f); return () => { abonnes.delete(f); }; },
    () => actif,
    () => false,
  );
}
