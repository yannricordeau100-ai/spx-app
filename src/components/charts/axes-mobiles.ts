/**
 * Aides communes aux axes des graphiques sur mobile (5 oct 2026).
 * Le viewBox (~920 unites) est rendu autour de 340 px : un facteur AF_AXES
 * ramene les etiquettes d axes a ~9 a 10 px reels, et les etiquettes en
 * trop sont decimees (une sur N) pour ne jamais se chevaucher.
 */
import { useEffect, useState, type RefObject } from "react";

export const AF_AXES = 1.8;

/** Pixels ecran par unite du viewBox (tient compte du redimensionnement, des scale et rotate parents). */
export function useEchelleSvg(ref: RefObject<SVGSVGElement | null>, actif: boolean): number {
  const [e, setE] = useState(0.37);
  useEffect(() => {
    if (!actif) return;
    const mesure = () => {
      const m = ref.current?.getScreenCTM();
      if (!m) return;
      const k = Math.hypot(m.a, m.b);
      if (k > 0.05 && k < 5) setE((p) => (Math.abs(p - k) < 0.01 ? p : k));
    };
    mesure();
    const id = window.setInterval(mesure, 400);
    window.addEventListener("resize", mesure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", mesure);
    };
  }, [actif, ref]);
  return e;
}

/** Taille (unites du viewBox) pour que le texte fasse ~10 px reels sur mobile. */
export function policeValeur(mobile: boolean, echelle: number, base: number): number {
  if (!mobile) return base;
  return Math.min(base * 3.2, Math.max(base, 10 / echelle));
}

/** Pas de decimation : 1 = tout afficher, N = une etiquette sur N. */
export function pasEtiquettes(mobile: boolean, largeurDispo: number, caracteres: number, fontSize: number): number {
  if (!mobile || largeurDispo <= 0) return 1;
  const besoin = caracteres * 0.62 * fontSize + 10;
  return Math.max(1, Math.ceil(besoin / largeurDispo));
}

/** Garde l etiquette i ? On part du point le plus recent, qui garde la sienne. */
export function garde(i: number, nReel: number, pas: number): boolean {
  if (pas === 0) return false;
  return pas <= 1 || (nReel - 1 - i) % pas === 0;
}

/**
 * Trimestres decimes : un echantillon donne un ordre incoherent (T1 T4 T3 T2).
 * Des que la decimation s active (pas > 1), tous les libelles de trimestre sont
 * masques (0) et seules les annees de la bande du bas restent affichees.
 */
export function pasTrimestres(pas: number, labels: string[]): number {
  if (pas <= 1) return pas;
  const trim = labels.some((l) => /^([TQ][1-4]|[SH][12])\s+\d{2,4}$/.test(l ?? ""));
  if (!trim) return pas;
  // Echantillonnage actif : annees seules (bande du bas), aucun libelle de trimestre.
  return 0;
}
