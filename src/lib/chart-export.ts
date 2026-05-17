/**
 * Export d'un SVG chart vers PNG côté client.
 *
 * Spec Yann (6 mai 2026, refonte 17 mai 2026) :
 *  - Le PNG doit ressembler PRESQUE au live (mêmes couleurs, mêmes courbes).
 *  - Le mini-logo "Mettrik AI" est désormais positionné **bottom-center**
 *    du graph (juste au-dessus de l'axe X), précédé d'un texte "Powered by"
 *    discret. L'ancien placement top-right chevauchait les data : grossière
 *    erreur corrigée. Taille réduite (height 16 px).
 *  - Le TITRE du KPI est injecté en haut du PNG. Police = **Fraunces 600
 *    italic** (au lieu de Manrope) : rendu éditorial classe + wow.
 *  - Logo société optionnel à droite du titre, si `options.ticker` fourni
 *    (PNG sourcé depuis `/logos/<TICKER>.png`). Fallback silencieux si
 *    fetch échoue.
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
 *  4. Insérer "Powered by" + mini-logo Mettrik en bas, centrés.
 *  5. Injecter le titre KPI au top (Fraunces italic) + logo sté optionnel.
 *  6. Sérialiser via XMLSerializer → <Image> → <canvas> 2× → blob → download.
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

  // ── Mini-logo Mettrik : repositionné bottom-center (17 mai 2026) ──
  // Avant : top-right, chevauchait les data → grossière erreur signalée.
  // Maintenant : juste au-dessus de l'axe X, centré horizontalement,
  // précédé d'un texte "Powered by" discret. Taille réduite (height 16 px).
  // Le ChartMiniLogo SVG live reste pour le rendu écran ; ici on le
  // CACHE et on insère <image> au nouveau placement pour le PNG exporté.
  const logoEl = clone.querySelector('[data-chart-logo="small"]') as SVGElement | null;
  if (logoEl) {
    logoEl.setAttribute("display", "none");
  }

  // Aspect ratio image = 1424:270 ≈ 5.27. Hauteur cible = 16 px (discret),
  // largeur ≈ 84 px. Position : bottom-center, ~14 px au-dessus de l'axe X.
  const logoH = 16;
  const logoW = logoH * (1424 / 270); // ≈ 84 px
  // Centrage du bloc "Powered by [gap 6] [logo]" :
  // textWidth_approx ≈ 60 px pour "Powered by" en font 11/500
  // total_width = 60 + 6 + logoW ≈ 150 px
  // logoCx (centre du logo) = origX + origW/2 + (60 + 6)/2 = +33 décalage à droite
  const POWERED_BY_TEXT_W = 60;
  const GAP = 6;
  const logoCx = origX + origW / 2 + (POWERED_BY_TEXT_W + GAP) / 2;
  const logoCy = origY + origH - 14;

  try {
    const logoBlob = await fetch("/brand-mini-logo.png").then((r) => r.blob());
    const logoDataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(logoBlob);
    });

    // "Powered by" text à gauche du logo (insérer AVANT le logo pour z-order).
    const poweredByEl = document.createElementNS(NS, "text");
    poweredByEl.setAttribute("x", String(logoCx - logoW / 2 - GAP));
    poweredByEl.setAttribute("y", String(logoCy + 4)); // baseline align approx
    poweredByEl.setAttribute("text-anchor", "end");
    poweredByEl.setAttribute(
      "font-family",
      "var(--font-manrope), Manrope, system-ui, sans-serif"
    );
    poweredByEl.setAttribute("font-size", "11");
    poweredByEl.setAttribute("font-weight", "500");
    poweredByEl.setAttribute("fill", isLight ? "#666" : "#888");
    poweredByEl.setAttribute("opacity", "0.85");
    poweredByEl.textContent = "Powered by";
    clone.appendChild(poweredByEl);

    const imgEl = document.createElementNS(NS, "image");
    imgEl.setAttribute("href", logoDataUrl);
    imgEl.setAttribute("x", String(logoCx - logoW / 2));
    imgEl.setAttribute("y", String(logoCy - logoH / 2));
    imgEl.setAttribute("width", String(logoW));
    imgEl.setAttribute("height", String(logoH));
    imgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
    clone.appendChild(imgEl);
  } catch {
    // Fallback : si le fetch échoue, on retire le `display:none` pour
    // remettre le ChartMiniLogo SVG visible (vaut mieux que pas de logo).
    if (logoEl) logoEl.removeAttribute("display");
  }

  // Embed les @font-face du document parent dans la balise <style> du SVG
  // cloné, pour que Fraunces (titre) et Manrope (watermark) rendent
  // identiquement entre live et PNG. Sans ça, var(--font-fraunces) ne
  // résoud pas dans le contexte SVG → fallback Georgia → rendu différent
  // de ce que voit l'utilisateur.
  const fontFaceCss: string[] = [];
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList | null = null;
      try { rules = sheet.cssRules; } catch { rules = null; }
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

  // Titre KPI en haut du PNG (centré horizontalement au-dessus du graph).
  // Police = Fraunces 600 italic (serif moderne haut de gamme, déjà utilisée
  // pour BrandWordmark home). Rendu éditorial "class + wow".
  let titleEl: SVGTextElement | null = null;
  if (options.title) {
    titleEl = document.createElementNS(NS, "text");
    titleEl.setAttribute("x", String(origX + origW / 2));
    titleEl.setAttribute("y", String(origY - PAD_TOP + 36));
    titleEl.setAttribute("text-anchor", "middle");
    titleEl.setAttribute(
      "font-family",
      "var(--font-fraunces), Fraunces, Georgia, 'Times New Roman', serif"
    );
    titleEl.setAttribute("font-weight", "600");
    titleEl.setAttribute("font-style", "italic");
    titleEl.setAttribute("font-size", "22");
    titleEl.setAttribute("letter-spacing", "-0.01em");
    titleEl.setAttribute("fill", titleColor);
    titleEl.textContent = options.title;
    clone.appendChild(titleEl);
  }

  // Logo société optionnel à droite du titre, si `options.ticker` fourni.
  // Source : `/logos/<TICKER>.png` (hardcodés top market cap dans /public/logos/).
  // Fallback silencieux si fetch fail (sté sans logo dispo).
  if (options.ticker && titleEl) {
    try {
      const stéLogoBlob = await fetch(`/logos/${options.ticker.toUpperCase()}.png`)
        .then((r) => (r.ok ? r.blob() : Promise.reject()));
      const stéLogoDataUrl: string = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.onerror = reject;
        fr.readAsDataURL(stéLogoBlob);
      });
      const stéLogoSize = 28;
      // getComputedTextLength() ne marche pas sur SVG cloné détaché du DOM.
      // Fallback : estimation char-width (Fraunces 600 italic 22px ≈ 10.5 px / char).
      const measuredWidth = titleEl.getComputedTextLength?.() ?? 0;
      const estimatedWidth = (options.title?.length ?? 0) * 10.5;
      const titleWidth = measuredWidth > 0 ? measuredWidth : estimatedWidth;
      const titleEnd = origX + origW / 2 + titleWidth / 2 + 12;
      const stéImgEl = document.createElementNS(NS, "image");
      stéImgEl.setAttribute("href", stéLogoDataUrl);
      stéImgEl.setAttribute("x", String(titleEnd));
      stéImgEl.setAttribute(
        "y",
        String(origY - PAD_TOP + 36 - stéLogoSize * 0.75)
      );
      stéImgEl.setAttribute("width", String(stéLogoSize));
      stéImgEl.setAttribute("height", String(stéLogoSize));
      stéImgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
      clone.appendChild(stéImgEl);
    } catch {
      /* skip silencieux si logo sté indispo */
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
