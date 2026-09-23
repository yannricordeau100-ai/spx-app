"use client";

import { useCallback, useEffect, useState } from "react";
import { BORNES, REGLAGE_INITIAL, type ReglageReference, type TypeReference } from "./modele";

const CLE_STOCKAGE = "mettrik.capacite.reference.v1";

function borner(type: TypeReference, v: number): number {
  const b = BORNES[type];
  const cale = Math.round(v / b.pas) * b.pas;
  return Math.min(b.max, Math.max(b.min, Number(cale.toFixed(1))));
}

function lire(): ReglageReference {
  // Toute lecture du stockage du navigateur est protégée : navigation privée,
  // cookies bloqués ou quota plein lèvent une exception.
  try {
    const brut = window.localStorage.getItem(CLE_STOCKAGE);
    if (!brut) return REGLAGE_INITIAL;
    const o = JSON.parse(brut) as Partial<ReglageReference>;
    const type: TypeReference = o.type === "inflation" ? "inflation" : "sans_risque";
    return {
      type,
      sansRisque:
        typeof o.sansRisque === "number" && Number.isFinite(o.sansRisque)
          ? borner("sans_risque", o.sansRisque)
          : REGLAGE_INITIAL.sansRisque,
      inflation:
        typeof o.inflation === "number" && Number.isFinite(o.inflation)
          ? borner("inflation", o.inflation)
          : REGLAGE_INITIAL.inflation,
    };
  } catch {
    return REGLAGE_INITIAL;
  }
}

function ecrire(r: ReglageReference): void {
  try {
    window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(r));
  } catch {
    // Le réglage reste valable pour la visite en cours, il ne sera
    // simplement pas retrouvé à la prochaine.
  }
}

/**
 * Réglage de la référence, mémorisé d'une visite à l'autre.
 * La première image rendue utilise toujours les valeurs par défaut, pour que
 * le serveur et le navigateur affichent la même chose ; la valeur mémorisée
 * est appliquée juste après le montage.
 */
export function useReferenceMemorisee(
  /**
   * Réglage imposé au premier rendu, utilisé par la page de concepts pour
   * qu'un contrôle par curl puisse voir les deux extrêmes sans navigateur.
   * Quand il est fourni, la valeur mémorisée n'est pas relue.
   */
  impose?: ReglageReference | null
): [ReglageReference, (r: ReglageReference) => void] {
  const [reglage, setReglageInterne] = useState<ReglageReference>(impose ?? REGLAGE_INITIAL);

  useEffect(() => {
    if (impose) return;
    setReglageInterne(lire());
    // Volontairement lu une seule fois, au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setReglage = useCallback((r: ReglageReference) => {
    const propre: ReglageReference = {
      type: r.type,
      sansRisque: borner("sans_risque", r.sansRisque),
      inflation: borner("inflation", r.inflation),
    };
    setReglageInterne(propre);
    ecrire(propre);
  }, []);

  return [reglage, setReglage];
}

/**
 * Variante contrôlée : les trois designs de la page de concepts partagent un
 * même réglage passé en propriété, alors que sur une fiche société le bloc
 * gère son réglage tout seul et le mémorise.
 */
export function useReglage(props: {
  reglage?: ReglageReference;
  onReglage?: (r: ReglageReference) => void;
}): [ReglageReference, (r: ReglageReference) => void] {
  const [interne, setInterne] = useReferenceMemorisee();
  return [props.reglage ?? interne, props.onReglage ?? setInterne];
}
