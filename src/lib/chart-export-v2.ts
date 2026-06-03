/**
 * chart-export-v2.ts — Refonte modèle PDF Yann 3 juin 2026.
 *
 * Spec (PDF "modèle graph export MAI.pdf"):
 *   HEADER:
 *     - [Logo sté circulaire] [Nom sté] | [Titre du graphique]
 *       — Tout sur UNE SEULE LIGNE, gauche.
 *     - Sub-line centrée: "CAGR : X%"
 *   CHART:
 *     - Y-axis label "Mds $" en TOP-LEFT (au-dessus du tick max)
 *     - Y-axis ticks à gauche, labels axe X en bas, valeurs au-dessus des points
 *     - Courbe gradient cyan/blue avec glow, soft fill dégradé sous la courbe
 *   FOOTER:
 *     - Bottom-right: "KPIs & Data :" + logo Mettrik AI combined (petit)
 *
 * Robustesse:
 *   - Longueur nom sté variable: mesure dynamique, ellipsis si > 40% largeur
 *   - Longueur KPI variable: idem, ellipsis si dépasse
 *   - Anti-overlap: header padding adaptatif selon longueur (1 ou 2 lignes)
 *   - Dark/Light theme auto via data-theme attribute
 *   - Types graph: Courbes / Barres / Variation (SVG d'origine = source de vérité)
 */

const FONT_FAMILY =
  '"Avenir", "Avenir Next", "Avenir Sans", "Nunito Sans", "Open Sans", -apple-system, sans-serif';

export type ExportOptionsV2 = {
  /** Nom complet de la société, ex "Nvidia Corporation" */
  companyName: string;
  /** Ticker pour fetch logo (/logos/<TICKER>.png) */
  ticker: string;
  /** Nom du KPI, ex "Revenus iPhone" */
  kpiName: string;
  /** CAGR formatté, ex "+22.4 %" */
  cagr?: string;
  /** Nom du fichier de sortie */
  filename: string;
  /** Forcer thème (par défaut auto via data-theme) */
  forceTheme?: "dark" | "light";
};

function isDarkColor(color: string): boolean {
  const c = color.trim().toLowerCase();
  const hex = c.startsWith("#") ? c.slice(1) : null;
  if (hex && (hex.length === 3 || hex.length === 6)) {
    const full = hex.length === 3 ? hex.split("").map((x) => x + x).join("") : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
  }
  return true;
}

/** Mesure approximative d'une string avec une font/taille données. */
function approxTextWidth(text: string, fontSize: number, weight = 400): number {
  // Avenir: monospace approx 0.55 × fontSize en weight 400, 0.62 en weight 700+
  const charW = weight >= 700 ? fontSize * 0.62 : fontSize * 0.55;
  return text.length * charW;
}

/** Tronque avec "…" si dépasse maxWidth. */
function ellipsize(text: string, maxWidth: number, fontSize: number, weight = 400): string {
  const fullW = approxTextWidth(text, fontSize, weight);
  if (fullW <= maxWidth) return text;
  const charW = weight >= 700 ? fontSize * 0.62 : fontSize * 0.55;
  const maxChars = Math.max(3, Math.floor((maxWidth - charW * 2) / charW));
  return text.slice(0, maxChars).trimEnd() + "…";
}

/** Fetch une image et retourne data URL base64. */
async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const blob = await fetch(url).then((r) => (r.ok ? r.blob() : Promise.reject()));
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

/** Récupère le logo société depuis /logos/<TICKER>.png. */
async function getCompanyLogoDataUrl(ticker: string): Promise<string | null> {
  if (!ticker) return null;
  const url = `/logos/${ticker.toUpperCase()}.png`;
  const dataUrl = await fetchAsDataUrl(url);
  if (!dataUrl) return null;
  // Vérif taille mini
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

export async function downloadSvgAsPngV2(
  svg: SVGSVGElement,
  options: ExportOptionsV2,
  scale = 2,
): Promise<void> {
  // Theme detection
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
  const signatureColor = isLight ? "rgba(10,10,10,0.85)" : "rgba(250,250,250,0.85)";

  // Clone SVG sans toucher au DOM live
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  // Supprimer overlays UI export-hide
  const removeSelectors = [
    "[data-chart-logo]",
    "[data-chart-watermark]",
    '[data-export-hide="true"]',
  ];
  for (const sel of removeSelectors) {
    clone.querySelectorAll(sel).forEach((node) => {
      node.parentNode?.removeChild(node);
    });
  }

  // Force police Avenir sur tous les <text>
  clone.querySelectorAll("text").forEach((t) => {
    t.setAttribute("font-family", FONT_FAMILY);
  });

  // ViewBox d'origine
  const vb = svg.viewBox.baseVal;
  const origX = vb?.x ?? 0;
  const origY = vb?.y ?? 0;
  const origW = vb?.width || svg.clientWidth || 1100;
  const origH = vb?.height || svg.clientHeight || 480;

  // Padding adaptatif (header avec logo + nom + KPI + CAGR)
  const PAD_TOP = 140; // assez pour ligne 1 (32px logo + texte) + ligne 2 (CAGR)
  const PAD_SIDE = 40;
  const PAD_BOTTOM = 60; // pour signature bottom-right
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

  // ── HEADER LIGNE 1 : [Logo sté] [Nom sté] | [Titre KPI] ──
  const LOGO_SIZE = 56;
  const LOGO_GAP = 18;
  const TITLE_FONT_SIZE = 32;
  const TITLE_WEIGHT = 700;
  const CAGR_FONT_SIZE = 18;
  const CAGR_WEIGHT = 400;
  const SEPARATOR = " | ";

  const titleY = origY - PAD_TOP + 50;
  const titleStartX = origX;

  // Récupère logo sté
  const stéLogoDataUrl = await getCompanyLogoDataUrl(options.ticker);

  // Construire le titre composé: "Nom sté | Titre KPI"
  // Si trop long, ellipsize KPI puis nom
  const maxTitleWidth = origW - (stéLogoDataUrl ? LOGO_SIZE + LOGO_GAP : 0);
  const separatorWidth = approxTextWidth(SEPARATOR, TITLE_FONT_SIZE, TITLE_WEIGHT);

  let companyName = options.companyName;
  let kpiName = options.kpiName;
  const companyW = approxTextWidth(companyName, TITLE_FONT_SIZE, TITLE_WEIGHT);
  const kpiW = approxTextWidth(kpiName, TITLE_FONT_SIZE, TITLE_WEIGHT);

  if (companyW + separatorWidth + kpiW > maxTitleWidth) {
    // Strategy: 45% pour sté, 55% pour KPI (KPI souvent plus long)
    const stéMax = (maxTitleWidth - separatorWidth) * 0.45;
    const kpiMax = (maxTitleWidth - separatorWidth) * 0.55;
    companyName = ellipsize(companyName, stéMax, TITLE_FONT_SIZE, TITLE_WEIGHT);
    kpiName = ellipsize(kpiName, kpiMax, TITLE_FONT_SIZE, TITLE_WEIGHT);
  }

  // Logo sté (cercle) à gauche
  let textX = titleStartX;
  if (stéLogoDataUrl) {
    // Clip path circulaire pour le logo
    const clipId = `logoClip_${Math.random().toString(36).slice(2, 8)}`;
    const defs = document.createElementNS(NS, "defs");
    const clipPath = document.createElementNS(NS, "clipPath");
    clipPath.setAttribute("id", clipId);
    const circle = document.createElementNS(NS, "circle");
    circle.setAttribute("cx", String(titleStartX + LOGO_SIZE / 2));
    circle.setAttribute("cy", String(titleY - LOGO_SIZE / 2 + 6));
    circle.setAttribute("r", String(LOGO_SIZE / 2));
    clipPath.appendChild(circle);
    defs.appendChild(clipPath);
    clone.insertBefore(defs, clone.firstChild);

    // Background circle (gris très léger pour mieux voir le logo)
    const bgCircle = document.createElementNS(NS, "circle");
    bgCircle.setAttribute("cx", String(titleStartX + LOGO_SIZE / 2));
    bgCircle.setAttribute("cy", String(titleY - LOGO_SIZE / 2 + 6));
    bgCircle.setAttribute("r", String(LOGO_SIZE / 2));
    bgCircle.setAttribute("fill", isLight ? "#f5f5f5" : "#1a1a1a");
    clone.appendChild(bgCircle);

    const stéImg = document.createElementNS(NS, "image");
    stéImg.setAttribute("href", stéLogoDataUrl);
    stéImg.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", stéLogoDataUrl);
    stéImg.setAttribute("x", String(titleStartX));
    stéImg.setAttribute("y", String(titleY - LOGO_SIZE + 6));
    stéImg.setAttribute("width", String(LOGO_SIZE));
    stéImg.setAttribute("height", String(LOGO_SIZE));
    stéImg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    stéImg.setAttribute("clip-path", `url(#${clipId})`);
    clone.appendChild(stéImg);

    textX = titleStartX + LOGO_SIZE + LOGO_GAP;
  }

  // Texte "Nom sté | Titre KPI" en une seule <text>, avec <tspan> pour séparateur
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

  // ── LIGNE 2: CAGR centré sous le titre ──
  if (options.cagr) {
    const cagrY = titleY + 32;
    const cagrEl = document.createElementNS(NS, "text");
    cagrEl.setAttribute("x", String(origX + origW / 2));
    cagrEl.setAttribute("y", String(cagrY));
    cagrEl.setAttribute("text-anchor", "middle");
    cagrEl.setAttribute("font-family", FONT_FAMILY);
    cagrEl.setAttribute("font-size", String(CAGR_FONT_SIZE));
    cagrEl.setAttribute("font-weight", String(CAGR_WEIGHT));
    cagrEl.setAttribute("fill", subtitleColor);
    cagrEl.textContent = `CAGR : ${options.cagr}`;
    clone.appendChild(cagrEl);
  }

  // ── FOOTER bottom-right: "KPIs & Data :" + logo Mettrik combined ──
  const SIG_TEXT = "KPIs & Data :";
  const SIG_FONT_SIZE = 14;
  const SIG_LOGO_H = 28;
  const SIG_LOGO_W = SIG_LOGO_H * 3.6;
  const SIG_GAP = 10;
  const sigTextW = approxTextWidth(SIG_TEXT, SIG_FONT_SIZE, 500);
  const sigTotalW = sigTextW + SIG_GAP + SIG_LOGO_W;
  const sigRightX = origX + origW;
  const sigStartX = sigRightX - sigTotalW;
  const sigY = origY + origH + 28;

  const mettrikLogoUrl = isLight
    ? "/brand/mettrik-combined-black-bg-transparent.png"
    : "/brand/mettrik-combined-white-bg-transparent.png";
  const mettrikLogoDataUrl =
    (await fetchAsDataUrl(mettrikLogoUrl)) || mettrikLogoUrl;

  const sigTextEl = document.createElementNS(NS, "text");
  sigTextEl.setAttribute("x", String(sigStartX));
  sigTextEl.setAttribute("y", String(sigY + SIG_LOGO_H / 2 + 4));
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

  // ── Sérialisation SVG → PNG ──
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
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
  URL.revokeObjectURL(url);
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

/** Variante: retourne le data URL PNG au lieu de télécharger (pour preview inline) */
export async function svgToPngDataUrlV2(
  svg: SVGSVGElement,
  options: Omit<ExportOptionsV2, "filename">,
  scale = 2,
): Promise<string | null> {
  // Même logique mais return data URL au lieu de download
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
  const signatureColor = isLight ? "rgba(10,10,10,0.85)" : "rgba(250,250,250,0.85)";

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

  const PAD_TOP = 140;
  const PAD_SIDE = 40;
  const PAD_BOTTOM = 60;
  const newW = origW + PAD_SIDE * 2;
  const newH = origH + PAD_TOP + PAD_BOTTOM;
  const newX = origX - PAD_SIDE;
  const newY = origY - PAD_TOP;
  clone.setAttribute("viewBox", `${newX} ${newY} ${newW} ${newH}`);
  clone.setAttribute("width", String(newW));
  clone.setAttribute("height", String(newH));

  const NS = "http://www.w3.org/2000/svg";
  const bg = document.createElementNS(NS, "rect");
  bg.setAttribute("x", String(newX));
  bg.setAttribute("y", String(newY));
  bg.setAttribute("width", String(newW));
  bg.setAttribute("height", String(newH));
  bg.setAttribute("fill", bgColor);
  clone.insertBefore(bg, clone.firstChild);

  const LOGO_SIZE = 56;
  const LOGO_GAP = 18;
  const TITLE_FONT_SIZE = 32;
  const TITLE_WEIGHT = 700;
  const SEPARATOR = " | ";

  const titleY = origY - PAD_TOP + 50;
  const titleStartX = origX;
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

  let textX = titleStartX;
  if (stéLogoDataUrl) {
    const clipId = `logoClip_${Math.random().toString(36).slice(2, 8)}`;
    const defs = document.createElementNS(NS, "defs");
    const clipPath = document.createElementNS(NS, "clipPath");
    clipPath.setAttribute("id", clipId);
    const circle = document.createElementNS(NS, "circle");
    circle.setAttribute("cx", String(titleStartX + LOGO_SIZE / 2));
    circle.setAttribute("cy", String(titleY - LOGO_SIZE / 2 + 6));
    circle.setAttribute("r", String(LOGO_SIZE / 2));
    clipPath.appendChild(circle);
    defs.appendChild(clipPath);
    clone.insertBefore(defs, clone.firstChild);

    const bgCircle = document.createElementNS(NS, "circle");
    bgCircle.setAttribute("cx", String(titleStartX + LOGO_SIZE / 2));
    bgCircle.setAttribute("cy", String(titleY - LOGO_SIZE / 2 + 6));
    bgCircle.setAttribute("r", String(LOGO_SIZE / 2));
    bgCircle.setAttribute("fill", isLight ? "#f5f5f5" : "#1a1a1a");
    clone.appendChild(bgCircle);

    const stéImg = document.createElementNS(NS, "image");
    stéImg.setAttribute("href", stéLogoDataUrl);
    stéImg.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", stéLogoDataUrl);
    stéImg.setAttribute("x", String(titleStartX));
    stéImg.setAttribute("y", String(titleY - LOGO_SIZE + 6));
    stéImg.setAttribute("width", String(LOGO_SIZE));
    stéImg.setAttribute("height", String(LOGO_SIZE));
    stéImg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    stéImg.setAttribute("clip-path", `url(#${clipId})`);
    clone.appendChild(stéImg);

    textX = titleStartX + LOGO_SIZE + LOGO_GAP;
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
    cagrEl.setAttribute("y", String(titleY + 32));
    cagrEl.setAttribute("text-anchor", "middle");
    cagrEl.setAttribute("font-family", FONT_FAMILY);
    cagrEl.setAttribute("font-size", "18");
    cagrEl.setAttribute("font-weight", "400");
    cagrEl.setAttribute("fill", subtitleColor);
    cagrEl.textContent = `CAGR : ${options.cagr}`;
    clone.appendChild(cagrEl);
  }

  const SIG_TEXT = "KPIs & Data :";
  const SIG_FONT_SIZE = 14;
  const SIG_LOGO_H = 28;
  const SIG_LOGO_W = SIG_LOGO_H * 3.6;
  const SIG_GAP = 10;
  const sigTextW = approxTextWidth(SIG_TEXT, SIG_FONT_SIZE, 500);
  const sigTotalW = sigTextW + SIG_GAP + SIG_LOGO_W;
  const sigRightX = origX + origW;
  const sigStartX = sigRightX - sigTotalW;
  const sigY = origY + origH + 28;

  const mettrikLogoUrl = isLight
    ? "/brand/mettrik-combined-black-bg-transparent.png"
    : "/brand/mettrik-combined-white-bg-transparent.png";
  const mettrikLogoDataUrl =
    (await fetchAsDataUrl(mettrikLogoUrl)) || mettrikLogoUrl;

  const sigTextEl = document.createElementNS(NS, "text");
  sigTextEl.setAttribute("x", String(sigStartX));
  sigTextEl.setAttribute("y", String(sigY + SIG_LOGO_H / 2 + 4));
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

  void isDarkColor; // suppress unused
  void signatureColor;

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
    return null;
  }
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, newW, newH);
  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/png");
}
