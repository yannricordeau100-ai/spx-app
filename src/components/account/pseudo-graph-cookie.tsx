"use client";

import { useEffect } from "react";
import { setPseudoGraphCookie } from "@/lib/user-prefs";

/**
 * Yann 16 sept 2026 : aligne le cookie mettrik:pseudo_graph sur la valeur
 * serveur des que la page compte s affiche (le sync du layout ne remonte pas
 * apres l enregistrement du formulaire).
 */
export function PseudoGraphCookie({ valeur }: { valeur: string }) {
  useEffect(() => {
    setPseudoGraphCookie(valeur);
  }, [valeur]);
  return null;
}
