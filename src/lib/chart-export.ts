/**
 * Export d'un SVG chart vers PNG côté client.
 *
 * Spec Yann (6 mai 2026) :
 *  - Le PNG doit ressembler PRESQUE au live (mêmes couleurs, mêmes courbes).
 *  - Le mini-logo "Mettrik AI" reste visible MAIS à 80 % d'opacité (= 20 %
 *    transparence demandée). Aux mêmes coordonnées que le live.
 *  - Le TITRE du KPI est injecté en haut du PNG (le live l'affiche en HTML
 *    hors SVG donc absent du capture par défaut).
 *  - Plus d'espace vide autour du graph (padding 36 px de chaque côté +
 *    52 px en haut pour titre + watermark).
 *  - Si le site est en thème clair (data-theme="light" sur <html>), le PNG
 *    sort en thème clair (background blanc, texte sombre).
 *  - JAMAIS d'icône "télécharger" dans le PNG (le bouton est HTML, pas SVG,
 *    donc déjà exclu par capture).
 *  - Les onglets de fréquence (A M S J H m s) sont en HTML, pas dans le
 *    SVG, donc absents du PNG par construction.
 *
 * Workflow :
 *  1. Cloner le SVG.
 *  2. Étendre le viewBox top/sides pour le titre + le padding.
 *  3. Insérer un rect background (couleur selon thème).
 *  4. Réduire l'opacité du mini-logo à 0.8.
 *  5. Injecter le titre KPI au top.
 *  6. Sérialiser via XMLSerializer → <Image> → <canvas> 2× → blob → download.
 */
export async function downloadSvgAsPng(
  svg: SVGSVGElement,
  filename: string,
  options: { title?: string } = {},
  scale = 2
): Promise<void> {
  // Détection du thème depuis <html data-theme>. Default = dark.
  const themeAttr =
    typeof document !== "undefined"
      ? document.documentElement.getAttribute("data-theme")
      : null;
  const isLight = themeAttr === "light";

  const bgColor = isLight ? "#ffffff" : "#050505";
  const titleColor = isLight ? "#0a0a0a" : "#fafafa";

  // Clone pour pouvoir injecter / modifier sans toucher au DOM live.
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  // Récupère le viewBox actuel.
  const vb = svg.viewBox.baseVal;
  const origX = vb?.x ?? 0;
  const origY = vb?.y ?? 0;
  const origW = vb?.width || svg.clientWidth || 920;
  const origH = vb?.height || svg.clientHeight || 360;

  // Padding ajouté autour du graph dans l'export.
  const PAD_TOP = 80; // espace pour titre + watermark
  const PAD_SIDE = 36; // espace gauche/droite
  const PAD_BOTTOM = 28; // espace bas

  // Nouveau viewBox englobant le contenu original + le padding.
  const newW = origW + PAD_SIDE * 2;
  const newH = origH + PAD_TOP + PAD_BOTTOM;
  const newX = origX - PAD_SIDE;
  const newY = origY - PAD_TOP;
  clone.setAttribute("viewBox", `${newX} ${newY} ${newW} ${newH}`);
  clone.setAttribute("width", String(newW));
  clone.setAttribute("height", String(newH));

  const NS = "http://www.w3.org/2000/svg";

  // Background opaque (sinon PNG transparent illisible). Couvre le viewBox étendu.
  const bg = document.createElementNS(NS, "rect");
  bg.setAttribute("x", String(newX));
  bg.setAttribute("y", String(newY));
  bg.setAttribute("width", String(newW));
  bg.setAttribute("height", String(newH));
  bg.setAttribute("fill", bgColor);
  clone.insertBefore(bg, clone.firstChild);

  // Réduit l'opacité du mini-logo à 0.8 (= 20 % transparence demandée par
  // Yann le 6 mai 2026). Reste à la même position que le live.
  clone.querySelectorAll('[data-chart-logo="small"]').forEach((el) => {
    (el as SVGElement).setAttribute("opacity", "0.8");
  });

  // Titre KPI en haut du PNG (centré horizontalement au-dessus du graph).
  if (options.title) {
    const titleEl = document.createElementNS(NS, "text");
    titleEl.setAttribute("x", String(origX + origW / 2));
    titleEl.setAttribute("y", String(origY - PAD_TOP + 36));
    titleEl.setAttribute("text-anchor", "middle");
    titleEl.setAttribute(
      "font-family",
      "var(--font-manrope), -apple-system, BlinkMacSystemFont, sans-serif"
    );
    titleEl.setAttribute("font-weight", "700");
    titleEl.setAttribute("font-size", "20");
    titleEl.setAttribute("letter-spacing", "-0.01em");
    titleEl.setAttribute("fill", titleColor);
    titleEl.textContent = options.title;
    clone.appendChild(titleEl);
  }

  const xml = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(e);
    img.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = newW * scale;
  canvas.height = newH * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    URL.revokeObjectURL(url);
    return;
  }
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, newW, newH);

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
