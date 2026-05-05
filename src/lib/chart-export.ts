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

  // Inject le watermark grand format (home wordmark Mettrik AI, italic
  // Fraunces, gradient holographique violet→cyan→rose) en bas-droite,
  // semi-transparent. Visible UNIQUEMENT à l'export.
  const vb = svg.viewBox.baseVal;
  const W = vb?.width || 920;
  const H = vb?.height || 420;
  const NS = "http://www.w3.org/2000/svg";
  const wmGroup = document.createElementNS(NS, "g");
  wmGroup.setAttribute("data-chart-logo", "watermark");
  wmGroup.setAttribute("opacity", "0.55");
  // Gradient iridescent (mêmes stops que la home)
  const defs = document.createElementNS(NS, "defs");
  const grad = document.createElementNS(NS, "linearGradient");
  grad.setAttribute("id", "mettrik-watermark-grad");
  grad.setAttribute("x1", "0%");
  grad.setAttribute("y1", "0%");
  grad.setAttribute("x2", "100%");
  grad.setAttribute("y2", "100%");
  const stops = [
    { offset: "0%", color: "#ffffff" },
    { offset: "30%", color: "#d8d8e4" },
    { offset: "55%", color: "#a855f7" },
    { offset: "78%", color: "#22d3ee" },
    { offset: "100%", color: "#f472b6" },
  ];
  for (const s of stops) {
    const stopEl = document.createElementNS(NS, "stop");
    stopEl.setAttribute("offset", s.offset);
    stopEl.setAttribute("stop-color", s.color);
    grad.appendChild(stopEl);
  }
  defs.appendChild(grad);
  wmGroup.appendChild(defs);

  // Position : haut-droite (où Yann a dessiné le rectangle blanc sur les
  // 2 screenshots du 5 mai 2026). Padding 24px depuis bord droit + haut.
  const wmText = document.createElementNS(NS, "text");
  const wmFontSize = 56;
  wmText.setAttribute("x", String(W - 24));
  wmText.setAttribute("y", String(24 + wmFontSize * 0.85));
  wmText.setAttribute("text-anchor", "end");
  wmText.setAttribute("font-family", "Georgia, serif");
  wmText.setAttribute("font-style", "italic");
  wmText.setAttribute("font-weight", "800");
  wmText.setAttribute("font-size", String(wmFontSize));
  wmText.setAttribute("letter-spacing", "-0.04em");
  wmText.setAttribute("fill", "url(#mettrik-watermark-grad)");
  // Wordmark "Mettrik.AI" avec point entre Mettrik et AI (demande Yann
  // 5 mai 2026 : "rajoutant un point entre le k et le 'ai'").
  const tspan1 = document.createElementNS(NS, "tspan");
  tspan1.textContent = "Mettrik";
  wmText.appendChild(tspan1);
  const tspanDot = document.createElementNS(NS, "tspan");
  tspanDot.setAttribute("font-weight", "400");
  tspanDot.textContent = ".";
  wmText.appendChild(tspanDot);
  const tspan2 = document.createElementNS(NS, "tspan");
  tspan2.textContent = "AI";
  wmText.appendChild(tspan2);
  wmGroup.appendChild(wmText);
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
