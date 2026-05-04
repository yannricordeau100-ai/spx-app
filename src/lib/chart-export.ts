/**
 * Export d'un SVG chart vers PNG côté client.
 *
 * Le watermark "Mettrik AI" est rendu directement dans le SVG (composant
 * <ChartWatermark />) → il fait partie du DOM affiché ET du PNG exporté.
 *
 * Workflow :
 *  1. Sérialiser le SVG via XMLSerializer.
 *  2. Le rendre dans un <Image> en mémoire.
 *  3. Le draw sur un <canvas> 2× pour une qualité retina.
 *  4. canvas.toBlob → trigger download via <a download>.
 */
export async function downloadSvgAsPng(
  svg: SVGSVGElement,
  filename: string,
  scale = 2
): Promise<void> {
  // Clone pour pouvoir injecter background sombre sans toucher au DOM live.
  const clone = svg.cloneNode(true) as SVGSVGElement;
  // Force xmlns pour que l'image soit bien interprétée par le navigateur.
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  // Background opaque (sinon PNG transparent → incompréhensible si partagé
  // sur fond clair).
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", "#050505");
  clone.insertBefore(bg, clone.firstChild);

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
