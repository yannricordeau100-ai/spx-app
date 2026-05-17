/**
 * Export d'un SVG chart vers PNG côté client.
 *
 * Spec Yann (6 mai 2026, refonte 17 mai 2026, refonte v3 17 mai 2026) :
 *  - Le PNG doit ressembler PRESQUE au live (mêmes couleurs, mêmes courbes).
 *  - Le watermark "Powered by Mettrik" est désormais **texte SVG inline**
 *    (zéro fetch PNG). Deux mots cote-à-cote :
 *      • "Powered by" en Manrope 500 (theme-aware)
 *      • "Mettrik"    en Fraunces 600 italic (theme-aware, MÊME taille)
 *    Positionné bottom-center juste au-dessus de l'axe X.
 *  - Le TITRE du KPI est en **Bricolage Grotesque 700** (24px, letter-spacing
 *    -0.025em, NON italic). Disposition : "Revenus Google Cloud [LOGO]
 *    Alphabet Inc." avec logo sté COMME SÉPARATEUR central entre les 2 parties
 *    si options.title contient " · " (espace point milieu espace).
 *  - Logo sté monochrome (filter feColorMatrix) : noir en thème clair, blanc
 *    en thème sombre. Même tonalité que titleColor.
 *  - Suppression DOM complète (removeChild) de tout élément `[data-chart-logo]`,
 *    `[data-chart-watermark]`, `[data-export-hide="true"]` dans le clone pour
 *    garantir aucun résidu visuel non désiré.
 *  - Plus d'espace vide autour du graph (padding 36 px de chaque côté +
 *    52 px en haut pour titre + watermark).
 *  - Si le site est en thème clair, le PNG sort en thème clair.
 *  - JAMAIS d'icône "télécharger" dans le PNG.
 *
 * Workflow :
 *  1. Cloner le SVG.
 *  2. Supprimer les éléments marqués `[data-chart-logo|watermark|export-hide]`.
 *  3. Étendre le viewBox top/sides pour le titre + le padding.
 *  4. Insérer un rect background (couleur selon thème).
 *  5. Insérer <defs> avec filtres monochromes.
 *  6. Insérer watermark "Powered by Mettrik" texte SVG inline en bas.
 *  7. Injecter le titre KPI au top (Bricolage 700 24px) + logo sté monochrome
 *     en séparateur central si options.title contient " · ".
 *  8. Sérialiser via XMLSerializer → <Image> → <canvas> 2× → blob → download.
 */
export async function downloadSvgAsPng(
  svg: SVGSVGElement,
  filename: string,
  options: { title?: string; ticker?: string } = {},
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

  // ── Suppression DOM des éléments marqués pour exclusion export ──
  // Yann 17 mai 2026 (v3) : `display:none` ne suffit pas — certains
  // navigateurs / serializers gardent l'élément en pixel data. Solution
  // robuste : retrait DOM complet via removeChild. Sélecteur élargi pour
  // futures extensibilité (any [data-chart-logo], [data-chart-watermark],
  // [data-export-hide="true"]).
  const removeSelectors = [
    "[data-chart-logo]",
    "[data-chart-watermark]",
    '[data-export-hide="true"]',
  ];
  for (const sel of removeSelectors) {
    const nodes = clone.querySelectorAll(sel);
    nodes.forEach((node) => {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });
  }

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

  // ── <defs> isolé pour les filtres monochromes ──
  // Si le SVG live a déjà un <defs>, on en crée un NOUVEAU séparé (pas de
  // conflit d'ID tant que nos IDs sont uniques : mettrik-mono-light /
  // mettrik-mono-dark sont nos namespacing).
  // matrix 4x5 : 3 premières lignes mappent RGB sur 0 (clair) ou 1 (sombre),
  // dernière colonne = offset, dernière ligne préserve alpha.
  const defsEl = document.createElementNS(NS, "defs");

  const filterLight = document.createElementNS(NS, "filter");
  filterLight.setAttribute("id", "mettrik-mono-light");
  // mono-light : tout en noir (R=G=B=0, alpha préservé)
  const matrixLight = document.createElementNS(NS, "feColorMatrix");
  matrixLight.setAttribute("type", "matrix");
  matrixLight.setAttribute(
    "values",
    "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
  );
  filterLight.appendChild(matrixLight);

  const filterDark = document.createElementNS(NS, "filter");
  filterDark.setAttribute("id", "mettrik-mono-dark");
  // mono-dark : tout en blanc (R=G=B=1, alpha préservé)
  const matrixDark = document.createElementNS(NS, "feColorMatrix");
  matrixDark.setAttribute("type", "matrix");
  matrixDark.setAttribute(
    "values",
    "0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"
  );
  filterDark.appendChild(matrixDark);

  defsEl.appendChild(filterLight);
  defsEl.appendChild(filterDark);
  // Insère après le bg rect (= 2e position pour ne pas être recouvert).
  clone.insertBefore(defsEl, bg.nextSibling);

  const monoFilterId = isLight ? "mettrik-mono-light" : "mettrik-mono-dark";

  // ── Watermark "Powered by Mettrik" texte SVG inline (v3, 17 mai 2026) ──
  // Plus de fetch PNG, plus d'<image>. Deux <text> côte-à-côte centrés.
  // Position verticale : juste au-dessus de la ligne axe X (zone plot).
  const logoCy = origY + origH * 0.78;

  // Tailles approximatives pour centrer le bloc complet.
  // Manrope 500 13px : ~6.5 px/char × "Powered by" (10 chars) ≈ 65 px
  // Fraunces 600 italic 13px : ~6.5 px/char × "Mettrik" (7 chars) ≈ 46 px
  // Gap entre les deux : 4 px (caractères ont déjà padding visuel).
  const POWERED_BY_TEXT_W = 65;
  const METTRIK_TEXT_W = 46;
  const WM_GAP = 4;
  const wmTotalW = POWERED_BY_TEXT_W + WM_GAP + METTRIK_TEXT_W;
  const wmStartX = origX + origW / 2 - wmTotalW / 2;
  const wmPoweredByCenterX = wmStartX + POWERED_BY_TEXT_W / 2;
  const wmMettrikCenterX =
    wmStartX + POWERED_BY_TEXT_W + WM_GAP + METTRIK_TEXT_W / 2;

  const wmPoweredByEl = document.createElementNS(NS, "text");
  wmPoweredByEl.setAttribute("x", String(wmPoweredByCenterX));
  wmPoweredByEl.setAttribute("y", String(logoCy + 4));
  wmPoweredByEl.setAttribute("text-anchor", "middle");
  wmPoweredByEl.setAttribute(
    "font-family",
    "var(--font-manrope), Manrope, system-ui, sans-serif"
  );
  wmPoweredByEl.setAttribute("font-size", "13");
  wmPoweredByEl.setAttribute("font-weight", "500");
  wmPoweredByEl.setAttribute("fill", titleColor);
  wmPoweredByEl.setAttribute("opacity", "0.8");
  wmPoweredByEl.textContent = "Powered by";
  clone.appendChild(wmPoweredByEl);

  const wmMettrikEl = document.createElementNS(NS, "text");
  wmMettrikEl.setAttribute("x", String(wmMettrikCenterX));
  wmMettrikEl.setAttribute("y", String(logoCy + 4));
  wmMettrikEl.setAttribute("text-anchor", "middle");
  wmMettrikEl.setAttribute(
    "font-family",
    "var(--font-fraunces), Fraunces, Georgia, 'Times New Roman', serif"
  );
  wmMettrikEl.setAttribute("font-size", "13");
  wmMettrikEl.setAttribute("font-weight", "600");
  wmMettrikEl.setAttribute("font-style", "italic");
  wmMettrikEl.setAttribute("fill", titleColor);
  wmMettrikEl.setAttribute("opacity", "0.8");
  wmMettrikEl.textContent = "Mettrik";
  clone.appendChild(wmMettrikEl);

  // Embed les @font-face du document parent dans la balise <style> du SVG
  // cloné, pour que Bricolage Grotesque (titre), Fraunces (watermark) et
  // Manrope (watermark) rendent identiquement entre live et PNG.
  const fontFaceCss: string[] = [];
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList | null = null;
      try {
        rules = sheet.cssRules;
      } catch {
        rules = null;
      }
      if (!rules) continue;
      for (const rule of Array.from(rules)) {
        if ((rule as CSSRule).constructor.name === "CSSFontFaceRule") {
          fontFaceCss.push(rule.cssText);
        }
      }
    }
  } catch {
    // Cross-origin sheets : ignore. Fallback chains restent valides.
  }
  if (fontFaceCss.length > 0) {
    const styleEl = document.createElementNS(NS, "style");
    styleEl.textContent = fontFaceCss.join("\n");
    clone.insertBefore(styleEl, clone.firstChild);
  }

  // ── Titre KPI en haut du PNG (Bricolage Grotesque 700, 24px) ──
  // Yann 17 mai 2026 (v3) : Fraunces "pas sexy ni sérieux" → Bricolage 700,
  // letter-spacing tighter (-0.025em), fintech editorial moderne premium.
  // Disposition : si options.title contient " · ", split en 2 parties avec
  // logo sté COMME SÉPARATEUR central. Sinon fallback rendu monolithique.
  const TITLE_FONT_SIZE = 24;
  const TITLE_CHAR_WIDTH = 12; // estimation Bricolage 700 24px
  const TITLE_Y = origY - PAD_TOP + 36;
  const TITLE_LOGO_SIZE = 32; // séparateur visuel
  const TITLE_LOGO_GAP = 14; // gap de chaque côté du logo

  const titleFontFamily =
    "var(--font-bricolage), 'Bricolage Grotesque', system-ui, sans-serif";

  if (options.title) {
    // Tente split sur " · " (espace point milieu espace).
    const SEPARATOR = " · ";
    const sepIdx = options.title.indexOf(SEPARATOR);
    const hasSeparator = sepIdx > 0;

    // Récupère le logo sté si dispo (DOM ou fallback). Nécessaire pour
    // décider du layout (avec ou sans logo séparateur).
    let stéLogoDataUrl: string | null = null;

    if (options.ticker) {
      try {
        // 1) Tentative DOM : SVG inline ou img de CompanyHeader.
        const logoWrapper = document.querySelector('[data-logo="true"]');
        if (logoWrapper) {
          const innerSvg = logoWrapper.querySelector("svg");
          const innerImg = logoWrapper.querySelector("img");
          if (innerSvg) {
            const svgClone = innerSvg.cloneNode(true) as SVGElement;
            if (!svgClone.getAttribute("xmlns")) {
              svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            }
            const svgXml = new XMLSerializer().serializeToString(svgClone);
            stéLogoDataUrl =
              "data:image/svg+xml;base64," +
              btoa(unescape(encodeURIComponent(svgXml)));
          } else if (
            innerImg instanceof HTMLImageElement &&
            innerImg.naturalWidth >= 32
          ) {
            const canvas = document.createElement("canvas");
            canvas.width = innerImg.naturalWidth;
            canvas.height = innerImg.naturalHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(innerImg, 0, 0);
              stéLogoDataUrl = canvas.toDataURL("image/png");
            }
          }
        }

        // 2) Fallback : /logos/<TICKER>.png, mais skip si trop basse résolution.
        if (!stéLogoDataUrl) {
          const stéLogoBlob = await fetch(
            `/logos/${options.ticker.toUpperCase()}.png`
          ).then((r) => (r.ok ? r.blob() : Promise.reject()));
          const tempDataUrl: string = await new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result as string);
            fr.onerror = reject;
            fr.readAsDataURL(stéLogoBlob);
          });
          const probe = await new Promise<HTMLImageElement>(
            (resolve, reject) => {
              const im = new Image();
              im.onload = () => resolve(im);
              im.onerror = reject;
              im.src = tempDataUrl;
            }
          );
          if (probe.naturalWidth >= 32) {
            stéLogoDataUrl = tempDataUrl;
          }
        }
      } catch {
        /* skip silencieux si logo sté indispo */
        stéLogoDataUrl = null;
      }
    }

    if (hasSeparator) {
      const kpiText = options.title.slice(0, sepIdx);
      const stéText = options.title.slice(sepIdx + SEPARATOR.length);

      const kpiW = kpiText.length * TITLE_CHAR_WIDTH;
      const stéW = stéText.length * TITLE_CHAR_WIDTH;

      // Layout : kpiText [gap] (logo si dispo) [gap] stéText, centré.
      const hasLogo = !!stéLogoDataUrl;
      const totalW = hasLogo
        ? kpiW + TITLE_LOGO_GAP + TITLE_LOGO_SIZE + TITLE_LOGO_GAP + stéW
        : kpiW + TITLE_LOGO_GAP + stéW;

      const midX = origX + origW / 2;
      const startX = midX - totalW / 2;

      const kpiCenterX = startX + kpiW / 2;
      const logoCenterX = hasLogo
        ? startX + kpiW + TITLE_LOGO_GAP + TITLE_LOGO_SIZE / 2
        : 0;
      const stéCenterX = hasLogo
        ? startX + kpiW + TITLE_LOGO_GAP + TITLE_LOGO_SIZE + TITLE_LOGO_GAP +
          stéW / 2
        : startX + kpiW + TITLE_LOGO_GAP + stéW / 2;

      // Texte KPI (gauche)
      const kpiEl = document.createElementNS(NS, "text");
      kpiEl.setAttribute("x", String(kpiCenterX));
      kpiEl.setAttribute("y", String(TITLE_Y));
      kpiEl.setAttribute("text-anchor", "middle");
      kpiEl.setAttribute("font-family", titleFontFamily);
      kpiEl.setAttribute("font-weight", "700");
      kpiEl.setAttribute("font-style", "normal");
      kpiEl.setAttribute("font-size", String(TITLE_FONT_SIZE));
      kpiEl.setAttribute("letter-spacing", "-0.025em");
      kpiEl.setAttribute("fill", titleColor);
      kpiEl.textContent = kpiText;
      clone.appendChild(kpiEl);

      // Logo sté (séparateur central, monochrome via filter)
      if (hasLogo && stéLogoDataUrl) {
        const logoG = document.createElementNS(NS, "g");
        logoG.setAttribute("filter", `url(#${monoFilterId})`);
        const stéImgEl = document.createElementNS(NS, "image");
        stéImgEl.setAttribute("href", stéLogoDataUrl);
        stéImgEl.setAttribute("x", String(logoCenterX - TITLE_LOGO_SIZE / 2));
        stéImgEl.setAttribute(
          "y",
          String(TITLE_Y - TITLE_LOGO_SIZE * 0.75)
        );
        stéImgEl.setAttribute("width", String(TITLE_LOGO_SIZE));
        stéImgEl.setAttribute("height", String(TITLE_LOGO_SIZE));
        stéImgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
        logoG.appendChild(stéImgEl);
        clone.appendChild(logoG);
      }

      // Texte sté (droite)
      const stéEl = document.createElementNS(NS, "text");
      stéEl.setAttribute("x", String(stéCenterX));
      stéEl.setAttribute("y", String(TITLE_Y));
      stéEl.setAttribute("text-anchor", "middle");
      stéEl.setAttribute("font-family", titleFontFamily);
      stéEl.setAttribute("font-weight", "700");
      stéEl.setAttribute("font-style", "normal");
      stéEl.setAttribute("font-size", String(TITLE_FONT_SIZE));
      stéEl.setAttribute("letter-spacing", "-0.025em");
      stéEl.setAttribute("fill", titleColor);
      stéEl.textContent = stéText;
      clone.appendChild(stéEl);
    } else {
      // Fallback monolithique (pas de séparateur " · " trouvé).
      const titleEl = document.createElementNS(NS, "text");
      titleEl.setAttribute("x", String(origX + origW / 2));
      titleEl.setAttribute("y", String(TITLE_Y));
      titleEl.setAttribute("text-anchor", "middle");
      titleEl.setAttribute("font-family", titleFontFamily);
      titleEl.setAttribute("font-weight", "700");
      titleEl.setAttribute("font-style", "normal");
      titleEl.setAttribute("font-size", String(TITLE_FONT_SIZE));
      titleEl.setAttribute("letter-spacing", "-0.025em");
      titleEl.setAttribute("fill", titleColor);
      titleEl.textContent = options.title;
      clone.appendChild(titleEl);

      // Si logo sté dispo en mode monolithique : ajouter à droite (legacy behavior).
      if (stéLogoDataUrl) {
        const titleWidth = options.title.length * TITLE_CHAR_WIDTH;
        const titleEnd = origX + origW / 2 + titleWidth / 2 + 12;
        const logoG = document.createElementNS(NS, "g");
        logoG.setAttribute("filter", `url(#${monoFilterId})`);
        const stéImgEl = document.createElementNS(NS, "image");
        stéImgEl.setAttribute("href", stéLogoDataUrl);
        stéImgEl.setAttribute("x", String(titleEnd));
        stéImgEl.setAttribute(
          "y",
          String(TITLE_Y - TITLE_LOGO_SIZE * 0.75)
        );
        stéImgEl.setAttribute("width", String(TITLE_LOGO_SIZE));
        stéImgEl.setAttribute("height", String(TITLE_LOGO_SIZE));
        stéImgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
        logoG.appendChild(stéImgEl);
        clone.appendChild(logoG);
      }
    }
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
