/**
 * Export d'un SVG chart vers PNG côté client.
 *
 * Distinction site / download :
 *   - Sur le SVG live, le logo "Mettrik AI" est rendu en miniature en haut
 *     à gauche, marqué `data-chart-logo="small"`.
 *   - À l'export, on CACHE ce mini-logo et on INJECTE un grand watermark
 *     du même logo (italic Fraunces, iridescent), centré-droit semi-
 *     transparent. Ainsi : 1 seul logo visible à la fois.
 *
 * Workflow :
 *  1. Cloner le SVG.
 *  2. Hide le mini-logo, append le watermark large.
 *  3. Sérialiser via XMLSerializer.
 *  4. Render dans un <Image> en mémoire.
 *  5. Draw sur un <canvas> 2× pour une qualité retina.
 *  6. canvas.toBlob → trigger download via <a download>.
 */
export async function downloadSvgAsPng(
  svg: SVGSVGElement,
  filename: string,
  scale = 2
): Promise<void> {
  // Clone pour pouvoir injecter / cacher des éléments sans toucher au DOM live.
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  // Background opaque (sinon PNG transparent illisible sur fond clair).
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", "#050505");
  clone.insertBefore(bg, clone.firstChild);

  // Cache le mini-logo "site only" → un seul logo apparaît dans l'export.
  clone.querySelectorAll('[data-chart-logo="small"]').forEach((el) => {
    (el as SVGElement).setAttribute("display", "none");
  });

  // Watermark download-only : wordmark "Mettrik•AI" italic Fraunces 800,
  // tout blanc (style home + monochrome demandé Yann 5 mai 2026), avec
  // un point design = petit cercle blanc plein entre "Mettrik" et "AI"
  // (rappel du i-pulse-dot violet de la home).
  // Position : top-right au-dessus de PAD_TOP donc clean (jamais de
  // courbe/barre/texte d'axe à cet endroit).
  const vb = svg.viewBox.baseVal;
  const W = vb?.width || 920;
  const NS = "http://www.w3.org/2000/svg";

  const wmGroup = document.createElementNS(NS, "g");
  wmGroup.setAttribute("data-chart-logo", "watermark");
  wmGroup.setAttribute("opacity", "0.92");

  // Mesures : font-size réduit de 56 → 28 (plus petit). Position au-dessus
  // de la zone graph, donc dans la marge top où il n'y a JAMAIS de pixel
  // bleu/blanc du chart.
  const wmFontSize = 28;
  const padX = 14;
  const yBaseline = 28; // baseline du texte près du haut du SVG
  const xRight = W - padX;
  // Approx widths (italic Georgia 800) pour aligner les 3 sub-éléments
  const aiWidth = wmFontSize * 0.95;       // largeur "AI"
  const dotR = 3.2;
  const dotGap = 5;
  const dotCx = xRight - aiWidth - dotGap - dotR;
  const dotCy = yBaseline - wmFontSize * 0.32; // visuellement centré x-height

  // "AI" anchored end à droite
  const ai = document.createElementNS(NS, "text");
  ai.setAttribute("x", String(xRight));
  ai.setAttribute("y", String(yBaseline));
  ai.setAttribute("text-anchor", "end");
  ai.setAttribute("font-family", "Georgia, serif");
  ai.setAttribute("font-style", "italic");
  ai.setAttribute("font-weight", "800");
  ai.setAttribute("font-size", String(wmFontSize));
  ai.setAttribute("letter-spacing", "-0.04em");
  ai.setAttribute("fill", "#ffffff");
  ai.textContent = "AI";
  wmGroup.appendChild(ai);

  // Dot design : cercle blanc plein, légèrement glow pour rappel home
  const dot = document.createElementNS(NS, "circle");
  dot.setAttribute("cx", String(dotCx));
  dot.setAttribute("cy", String(dotCy));
  dot.setAttribute("r", String(dotR));
  dot.setAttribute("fill", "#ffffff");
  wmGroup.appendChild(dot);

  // "Mettrik" anchored end juste à gauche du dot
  const mettrik = document.createElementNS(NS, "text");
  const mettrikRightEdge = dotCx - dotR - dotGap;
  mettrik.setAttribute("x", String(mettrikRightEdge));
  mettrik.setAttribute("y", String(yBaseline));
  mettrik.setAttribute("text-anchor", "end");
  mettrik.setAttribute("font-family", "Georgia, serif");
  mettrik.setAttribute("font-style", "italic");
  mettrik.setAttribute("font-weight", "800");
  mettrik.setAttribute("font-size", String(wmFontSize));
  mettrik.setAttribute("letter-spacing", "-0.04em");
  mettrik.setAttribute("fill", "#ffffff");
  mettrik.textContent = "Mettrik";
  wmGroup.appendChild(mettrik);

  clone.appendChild(wmGroup);

  const xml = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(e);
    img.src = url;
  });

  // Dimensions cibles : viewBox du SVG ou bounding rect.
  const viewBox = svg.viewBox.baseVal;
  const w = viewBox?.width || svg.clientWidth || 1840;
  const h = viewBox?.height || svg.clientHeight || 920;

  const canvas = document.createElement("canvas");
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    URL.revokeObjectURL(url);
    return;
  }
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, w, h);

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png")
  );
  URL.revokeObjectURL(url);
  if (!blob) return;

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }, 100);
}

/**
 * Helper pour calculer les groupes d'années consécutives dans une liste de
 * labels trimestriels ("T1 21", "T2 21", ..., "T4 24"). Retourne une liste
 * de groupes { startIdx, endIdx, year }. Les labels non trimestriels
 * (ex : "TTM", "2024") sont ignorés (pas de groupe créé).
 */
export type YearGroup = { startIdx: number; endIdx: number; year: string };

export function buildYearGroups(labels: string[]): YearGroup[] {
  const groups: YearGroup[] = [];
  for (let i = 0; i < labels.length; i++) {
    const m = labels[i]?.match(/^T[1-4]\s+(\d{2,4})$/);
    if (!m) continue;
    const year = m[1];
    const last = groups[groups.length - 1];
    if (last && last.year === year && last.endIdx === i - 1) {
      last.endIdx = i;
    } else {
      groups.push({ startIdx: i, endIdx: i, year });
    }
  }
  return groups;
}
