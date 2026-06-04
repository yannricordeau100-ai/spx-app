/**
 * chart-export-v2.ts — Refonte modèle PDF Yann 3 juin 2026 v2.
 *
 * Itération sur feedback Yann (22h47 3 juin):
 *   - Logo sté plus PETIT vs texte (ratio modèle PDF respecté)
 *   - Signature: "KPIs & Data :" → "Powered by"
 *   - Logo Mettrik AI signature: AGRANDI (50px au lieu de 28px)
 *   - Y-axis label: bigger + plus haut + centré sur axe (50/50)
 *   - Bottom-center: [X logo] @Mettrik_AI au même niveau que signature
 *
 * HEADER (centré):
 *   - [Logo cercle 54px] [Nom sté] | [Titre graph]   (sur 1 ligne)
 *   - CAGR : X%  (sous-titre)
 * CHART:
 *   - Y-axis unit en haut, centré sur l'axe Y (50% gauche / 50% droite)
 *   - Whisker line sous les valeurs (PDF model)
 * FOOTER (bottom):
 *   - LEFT (vide ou breadcrumb futur)
 *   - CENTER: [X logo] @Mettrik_AI
 *   - RIGHT: Powered by [Logo Mettrik AI agrandi]
 */

const FONT_FAMILY =
  '"Avenir", "Avenir Next", "Avenir Sans", "Nunito Sans", "Open Sans", -apple-system, sans-serif';

// X (Twitter) logo SVG path inline — couleur appliquée via fill
const X_LOGO_SVG = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;

const X_LOGO_DATA_URL = (color: string) =>
  "data:image/svg+xml;base64," +
  btoa(unescape(encodeURIComponent(X_LOGO_SVG(color))));

export type ExportOptionsV2 = {
  companyName: string;
  ticker: string;
  kpiName: string;
  cagr?: string;
  filename: string;
  forceTheme?: "dark" | "light";
};

function approxTextWidth(text: string, fontSize: number, weight = 400): number {
  const charW = weight >= 700 ? fontSize * 0.62 : fontSize * 0.55;
  return text.length * charW;
}

function ellipsize(
  text: string,
  maxWidth: number,
  fontSize: number,
  weight = 400,
): string {
  const fullW = approxTextWidth(text, fontSize, weight);
  if (fullW <= maxWidth) return text;
  const charW = weight >= 700 ? fontSize * 0.62 : fontSize * 0.55;
  const maxChars = Math.max(3, Math.floor((maxWidth - charW * 2) / charW));
  return text.slice(0, maxChars).trimEnd() + "…";
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const blob = await fetch(url).then((r) =>
      r.ok ? r.blob() : Promise.reject(),
    );
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function getCompanyLogoDataUrl(ticker: string): Promise<string | null> {
  if (!ticker) return null;
  const safe = ticker.toUpperCase().replace(/\./g, "-");
  const url = `/logos/${safe}.png`;
  const dataUrl = await fetchAsDataUrl(url);
  if (!dataUrl) return null;
  try {
    const probe = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = dataUrl;
    });
    if (probe.naturalWidth < 32) return null;
    return dataUrl;
  } catch {
    return null;
  }
}

// ── COMPOSITION SVG → PNG (logique commune) ───────────────────────────
async function composeAndExport(
  svg: SVGSVGElement,
  options: Omit<ExportOptionsV2, "filename"> & { filename?: string },
  scale: number,
): Promise<{ canvas: HTMLCanvasElement; newW: number; newH: number } | null> {
  const themeAttr =
    options.forceTheme ||
    (typeof document !== "undefined"
      ? document.documentElement.getAttribute("data-theme")
      : null) ||
    "dark";
  const isLight = themeAttr === "light";
  const bgColor = isLight ? "#ffffff" : "#050505";
  const titleColor = isLight ? "#0a0a0a" : "#fafafa";
  const subtitleColor = isLight ? "rgba(10,10,10,0.7)" : "rgba(250,250,250,0.7)";
  const signatureColor = isLight
    ? "rgba(10,10,10,0.85)"
    : "rgba(250,250,250,0.85)";
  const xHandleColor = isLight ? "#0a0a0a" : "#fafafa";

  // Clone SVG sans toucher au DOM live
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  ["[data-chart-logo]", "[data-chart-watermark]", '[data-export-hide="true"]'].forEach(
    (sel) => {
      clone.querySelectorAll(sel).forEach((node) => {
        node.parentNode?.removeChild(node);
      });
    },
  );

  clone.querySelectorAll("text").forEach((t) => {
    t.setAttribute("font-family", FONT_FAMILY);
  });

  const vb = svg.viewBox.baseVal;
  const origX = vb?.x ?? 0;
  const origY = vb?.y ?? 0;
  const origW = vb?.width || svg.clientWidth || 1100;
  const origH = vb?.height || svg.clientHeight || 480;

  // Padding (header + signature haute)
  const PAD_TOP = 150;
  const PAD_SIDE = 40;
  const PAD_BOTTOM = 90; // espace pour signature haute + X handle bottom-center
  const newW = origW + PAD_SIDE * 2;
  const newH = origH + PAD_TOP + PAD_BOTTOM;
  const newX = origX - PAD_SIDE;
  const newY = origY - PAD_TOP;
  clone.setAttribute("viewBox", `${newX} ${newY} ${newW} ${newH}`);
  clone.setAttribute("width", String(newW));
  clone.setAttribute("height", String(newH));

  const NS = "http://www.w3.org/2000/svg";

  // BACKGROUND opaque
  const bg = document.createElementNS(NS, "rect");
  bg.setAttribute("x", String(newX));
  bg.setAttribute("y", String(newY));
  bg.setAttribute("width", String(newW));
  bg.setAttribute("height", String(newH));
  bg.setAttribute("fill", bgColor);
  clone.insertBefore(bg, clone.firstChild);

  // ── HEADER : [Logo carre-arrondi 62px] [Nom sté] | [Titre KPI] CENTRÉ ──
  // Yann 4 juin 2026 : (a) Logo decale vers le bas pour occuper hauteur
  // titre + ligne CAGR (titleY a titleY+30). (b) Carre-arrondi au lieu de
  // cercle pour eliminer bordures noires des PNG non-carres (TotalEnergies).
  const LOGO_SIZE = 90;
  const LOGO_CORNER_RADIUS = 18;
  const LOGO_GAP = 22;
  const TITLE_FONT_SIZE = 32;
  const TITLE_WEIGHT = 600;
  const SEPARATOR = " | ";

  const titleY = origY - PAD_TOP + 60;
  const stéLogoDataUrl = await getCompanyLogoDataUrl(options.ticker);

  const maxTitleWidth = origW - (stéLogoDataUrl ? LOGO_SIZE + LOGO_GAP : 0);
  const separatorWidth = approxTextWidth(SEPARATOR, TITLE_FONT_SIZE, TITLE_WEIGHT);

  let companyName = options.companyName;
  let kpiName = options.kpiName;
  const companyW = approxTextWidth(companyName, TITLE_FONT_SIZE, TITLE_WEIGHT);
  const kpiW = approxTextWidth(kpiName, TITLE_FONT_SIZE, TITLE_WEIGHT);

  if (companyW + separatorWidth + kpiW > maxTitleWidth) {
    const stéMax = (maxTitleWidth - separatorWidth) * 0.45;
    const kpiMax = (maxTitleWidth - separatorWidth) * 0.55;
    companyName = ellipsize(companyName, stéMax, TITLE_FONT_SIZE, TITLE_WEIGHT);
    kpiName = ellipsize(kpiName, kpiMax, TITLE_FONT_SIZE, TITLE_WEIGHT);
  }

  // Centrage: largeur totale (logo + gap + texte) puis centrer
  const textTotalW =
    approxTextWidth(companyName, TITLE_FONT_SIZE, TITLE_WEIGHT) +
    separatorWidth +
    approxTextWidth(kpiName, TITLE_FONT_SIZE, TITLE_WEIGHT);
  const blockTotalW = (stéLogoDataUrl ? LOGO_SIZE + LOGO_GAP : 0) + textTotalW;
  const blockStartX = origX + (origW - blockTotalW) / 2;
  let textX = blockStartX;

  if (stéLogoDataUrl) {
    // Yann 4 juin 2026 : carre-arrondi (clipPath rect au lieu de circle)
    // pour eliminer les coins noirs des PNG non-carres.
    // Y position : couvre titre (de titleY-30) + CAGR (jusqu'a titleY+32)
    // soit une zone verticale d'environ 62px = LOGO_SIZE.
    const logoX = blockStartX;
    const logoY = titleY - 30;
    const clipId = `logoClip_${Math.random().toString(36).slice(2, 8)}`;
    const defs = document.createElementNS(NS, "defs");
    const clipPath = document.createElementNS(NS, "clipPath");
    clipPath.setAttribute("id", clipId);
    const clipRect = document.createElementNS(NS, "rect");
    clipRect.setAttribute("x", String(logoX));
    clipRect.setAttribute("y", String(logoY));
    clipRect.setAttribute("width", String(LOGO_SIZE));
    clipRect.setAttribute("height", String(LOGO_SIZE));
    clipRect.setAttribute("rx", String(LOGO_CORNER_RADIUS));
    clipRect.setAttribute("ry", String(LOGO_CORNER_RADIUS));
    clipPath.appendChild(clipRect);
    defs.appendChild(clipPath);
    clone.insertBefore(defs, clone.firstChild);

    const bgRect = document.createElementNS(NS, "rect");
    bgRect.setAttribute("x", String(logoX));
    bgRect.setAttribute("y", String(logoY));
    bgRect.setAttribute("width", String(LOGO_SIZE));
    bgRect.setAttribute("height", String(LOGO_SIZE));
    bgRect.setAttribute("rx", String(LOGO_CORNER_RADIUS));
    bgRect.setAttribute("ry", String(LOGO_CORNER_RADIUS));
    bgRect.setAttribute("fill", isLight ? "#ffffff" : "#0a0a0a");
    clone.appendChild(bgRect);

    const stéImg = document.createElementNS(NS, "image");
    stéImg.setAttribute("href", stéLogoDataUrl);
    stéImg.setAttributeNS(
      "http://www.w3.org/1999/xlink",
      "xlink:href",
      stéLogoDataUrl,
    );
    stéImg.setAttribute("x", String(logoX));
    stéImg.setAttribute("y", String(logoY));
    stéImg.setAttribute("width", String(LOGO_SIZE));
    stéImg.setAttribute("height", String(LOGO_SIZE));
    stéImg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    stéImg.setAttribute("clip-path", `url(#${clipId})`);
    clone.appendChild(stéImg);

    textX = blockStartX + LOGO_SIZE + LOGO_GAP;
  }

  const titleEl = document.createElementNS(NS, "text");
  titleEl.setAttribute("x", String(textX));
  titleEl.setAttribute("y", String(titleY));
  titleEl.setAttribute("text-anchor", "start");
  titleEl.setAttribute("font-family", FONT_FAMILY);
  titleEl.setAttribute("font-size", String(TITLE_FONT_SIZE));
  titleEl.setAttribute("font-weight", String(TITLE_WEIGHT));
  titleEl.setAttribute("letter-spacing", "-0.01em");
  titleEl.setAttribute("fill", titleColor);
  const stéSpan = document.createElementNS(NS, "tspan");
  stéSpan.textContent = companyName;
  titleEl.appendChild(stéSpan);
  const sepSpan = document.createElementNS(NS, "tspan");
  sepSpan.setAttribute("fill", subtitleColor);
  sepSpan.setAttribute("font-weight", "400");
  sepSpan.textContent = SEPARATOR;
  titleEl.appendChild(sepSpan);
  const kpiSpan = document.createElementNS(NS, "tspan");
  kpiSpan.textContent = kpiName;
  titleEl.appendChild(kpiSpan);
  clone.appendChild(titleEl);

  if (options.cagr) {
    const cagrEl = document.createElementNS(NS, "text");
    cagrEl.setAttribute("x", String(origX + origW / 2));
    cagrEl.setAttribute("y", String(titleY + 30));
    cagrEl.setAttribute("text-anchor", "middle");
    cagrEl.setAttribute("font-family", FONT_FAMILY);
    cagrEl.setAttribute("font-size", "18");
    cagrEl.setAttribute("font-weight", "400");
    cagrEl.setAttribute("fill", subtitleColor);
    cagrEl.textContent = `CAGR : ${options.cagr}`;
    clone.appendChild(cagrEl);
  }

  // ── FOOTER ──
  // RIGHT: "Powered by" + Mettrik logo combined AGRANDI
  const SIG_TEXT = "Powered by";
  const SIG_FONT_SIZE = 16;
  const SIG_LOGO_H = 50; // AGRANDI (28 -> 50)
  const SIG_LOGO_W = SIG_LOGO_H * 3.6;
  // Yann 4 juin 2026 : texte signature TRES colle au logo Mettrik AI
  // (= largeur 1 espace clavier ~ 4px, au lieu de 8). Effet visuel : le
  // texte "Powered by" et le logo forment un bloc compact.
  const SIG_GAP = 4;
  const sigTextW = approxTextWidth(SIG_TEXT, SIG_FONT_SIZE, 500);
  const sigTotalW = sigTextW + SIG_GAP + SIG_LOGO_W;
  const sigRightX = origX + origW;
  const sigStartX = sigRightX - sigTotalW;
  const sigY = origY + origH + 25;

  const mettrikLogoUrl = isLight
    ? "/brand/mettrik-ai-black-purple.png"
    : "/brand/mettrik-ai-white-purple.png";
  const mettrikLogoDataUrl =
    (await fetchAsDataUrl(mettrikLogoUrl)) || mettrikLogoUrl;

  const sigTextEl = document.createElementNS(NS, "text");
  sigTextEl.setAttribute("x", String(sigStartX));
  sigTextEl.setAttribute("y", String(sigY + SIG_LOGO_H / 2 + 5));
  sigTextEl.setAttribute("text-anchor", "start");
  sigTextEl.setAttribute("font-family", FONT_FAMILY);
  sigTextEl.setAttribute("font-size", String(SIG_FONT_SIZE));
  sigTextEl.setAttribute("font-weight", "500");
  sigTextEl.setAttribute("fill", signatureColor);
  sigTextEl.textContent = SIG_TEXT;
  clone.appendChild(sigTextEl);

  const sigLogoEl = document.createElementNS(NS, "image");
  sigLogoEl.setAttribute("href", mettrikLogoDataUrl);
  sigLogoEl.setAttributeNS(
    "http://www.w3.org/1999/xlink",
    "xlink:href",
    mettrikLogoDataUrl,
  );
  sigLogoEl.setAttribute("x", String(sigStartX + sigTextW + SIG_GAP));
  sigLogoEl.setAttribute("y", String(sigY));
  sigLogoEl.setAttribute("width", String(SIG_LOGO_W));
  sigLogoEl.setAttribute("height", String(SIG_LOGO_H));
  sigLogoEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
  clone.appendChild(sigLogoEl);

  // CENTER: [X logo] @Mettrik_AI au MEME niveau horizontal que sig droite
  const X_HANDLE_TEXT = "@Mettrik_AI";
  const X_HANDLE_FONT_SIZE = 18;
  const X_LOGO_H = 22;
  const X_LOGO_W = 22;
  const X_GAP = 8;
  const handleTextW = approxTextWidth(X_HANDLE_TEXT, X_HANDLE_FONT_SIZE, 600);
  const handleTotalW = X_LOGO_W + X_GAP + handleTextW;
  const handleStartX = origX + origW / 2 - handleTotalW / 2;
  // Aligné verticalement avec le centre de la signature droite
  const handleY = sigY + SIG_LOGO_H / 2 - X_LOGO_H / 2;

  const xLogoEl = document.createElementNS(NS, "image");
  const xLogoDataUrl = X_LOGO_DATA_URL(xHandleColor);
  xLogoEl.setAttribute("href", xLogoDataUrl);
  xLogoEl.setAttributeNS(
    "http://www.w3.org/1999/xlink",
    "xlink:href",
    xLogoDataUrl,
  );
  xLogoEl.setAttribute("x", String(handleStartX));
  xLogoEl.setAttribute("y", String(handleY));
  xLogoEl.setAttribute("width", String(X_LOGO_W));
  xLogoEl.setAttribute("height", String(X_LOGO_H));
  xLogoEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
  clone.appendChild(xLogoEl);

  const xHandleEl = document.createElementNS(NS, "text");
  xHandleEl.setAttribute("x", String(handleStartX + X_LOGO_W + X_GAP));
  xHandleEl.setAttribute("y", String(handleY + X_LOGO_H / 2 + 6));
  xHandleEl.setAttribute("text-anchor", "start");
  xHandleEl.setAttribute("font-family", FONT_FAMILY);
  xHandleEl.setAttribute("font-size", String(X_HANDLE_FONT_SIZE));
  xHandleEl.setAttribute("font-weight", "600");
  xHandleEl.setAttribute("fill", signatureColor);
  xHandleEl.textContent = X_HANDLE_TEXT;
  clone.appendChild(xHandleEl);

  // Sérialisation
  const xml = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(e);
    img.src = svgUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = newW * scale;
  canvas.height = newH * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    URL.revokeObjectURL(svgUrl);
    return null;
  }
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, newW, newH);
  URL.revokeObjectURL(svgUrl);
  return { canvas, newW, newH };
}

export async function downloadSvgAsPngV2(
  svg: SVGSVGElement,
  options: ExportOptionsV2,
  scale = 2,
): Promise<void> {
  const result = await composeAndExport(svg, options, scale);
  if (!result) return;
  const blob: Blob | null = await new Promise((resolve) =>
    result.canvas.toBlob((b) => resolve(b), "image/png"),
  );
  if (!blob) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = options.filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }, 100);
}

export async function svgToPngDataUrlV2(
  svg: SVGSVGElement,
  options: Omit<ExportOptionsV2, "filename">,
  scale = 2,
): Promise<string | null> {
  const result = await composeAndExport(svg, options, scale);
  if (!result) return null;
  return result.canvas.toDataURL("image/png");
}
