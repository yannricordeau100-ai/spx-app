/**
 * 7 oct 2026 (Yann) : une etiquette de valeur ne doit jamais recouvrir une
 * graduation de l axe ni un libelle d axe X, a l ecran comme dans l export.
 * Regle generale, appliquee apres le rendu sur les <text> du graphique (aucun
 * cas particulier) :
 *   - une graduation d axe Y (ancre « end ») qui touche un autre texte est
 *     masquee : le trait de grille reste, la valeur lisible prime ;
 *   - sinon, le texte le plus HAUT des deux (une valeur face a un libelle
 *     d axe X) est decale vers le haut du recouvrement ; s il touche encore
 *     quelque chose, il est masque.
 * Idempotent : chaque appel annule d abord ses propres retouches.
 */
import { useEffect, useLayoutEffect, type RefObject } from "react";

const MARQUE = "data-ac";

function reinitialiser(svg: SVGSVGElement) {
  svg.querySelectorAll<SVGTextElement>(`[${MARQUE}]`).forEach((t) => {
    t.removeAttribute("display");
    const y0 = t.getAttribute("data-ac-y0");
    if (y0 != null) t.setAttribute("y", y0);
    t.removeAttribute("data-ac-y0");
    t.removeAttribute(MARQUE);
  });
}

type Boite = { el: SVGTextElement; r: DOMRect; ancre: string };

function inter(a: DOMRect, b: DOMRect) {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return { w, h };
}

export function resoudreChevauchements(svg: SVGSVGElement | null): number {
  if (!svg || typeof document === "undefined") return 0;
  reinitialiser(svg);
  const m = svg.getScreenCTM();
  const echelle = m ? Math.hypot(m.a, m.b) : 0;
  if (!(echelle > 0.01)) return 0;
  const lire = (): Boite[] =>
    Array.from(svg.querySelectorAll<SVGTextElement>("text"))
      .filter((t) => (t.textContent || "").trim() && t.getAttribute("display") !== "none" && !t.closest("defs"))
      .map((el) => ({ el, r: el.getBoundingClientRect(), ancre: el.getAttribute("text-anchor") || "start" }))
      .filter((b) => b.r.width > 0 && b.r.height > 0);
  let retouches = 0;
  const touche = (a: DOMRect, b: DOMRect) => {
    const { w, h } = inter(a, b);
    // les boites de <text> incluent l interligne : on exige un vrai recouvrement des glyphes
    return w > 2 && h > 0.35 * Math.min(a.height, b.height);
  };
  for (let passe = 0; passe < 3; passe++) {
    const boites = lire();
    let change = false;
    for (let i = 0; i < boites.length && !change; i++) {
      for (let j = i + 1; j < boites.length && !change; j++) {
        const A = boites[i], B = boites[j];
        if (!touche(A.r, B.r)) continue;
        if (A.el.textContent === B.el.textContent && Math.abs(A.r.left - B.r.left) < 1 && Math.abs(A.r.top - B.r.top) < 1) continue;
        // graduation d axe Y (ancre end) : masquee
        const grad = A.ancre === "end" && B.ancre !== "end" ? A : B.ancre === "end" && A.ancre !== "end" ? B : null;
        if (grad) {
          grad.el.setAttribute("display", "none");
          grad.el.setAttribute(MARQUE, "1");
          retouches++; change = true; continue;
        }
        // sinon : le plus haut est decale vers le haut
        const haut = A.r.top <= B.r.top ? A : B;
        const { h } = inter(A.r, B.r);
        const dy = (h + 2) / echelle;
        if (haut.el.getAttribute("display") === "none") continue;
        if (haut.el.getAttribute(MARQUE) === "2") {
          // deja decale une fois et toujours en contact : masque
          haut.el.setAttribute("display", "none");
        } else {
          if (!haut.el.hasAttribute("data-ac-y0")) haut.el.setAttribute("data-ac-y0", haut.el.getAttribute("y") || "0");
          haut.el.setAttribute("y", String(parseFloat(haut.el.getAttribute("y") || "0") - dy));
          haut.el.setAttribute(MARQUE, "2");
        }
        retouches++; change = true;
      }
    }
    if (!change) break;
  }
  return retouches;
}

const useEffetSur = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** A appeler dans chaque graphique : relance la regle apres chaque rendu. */
export function useAntiChevauchement(ref: RefObject<SVGSVGElement | null>): void {
  useEffetSur(() => {
    resoudreChevauchements(ref.current);
  });
}
