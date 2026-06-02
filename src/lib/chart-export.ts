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
/**
 * Police "Avenir" pour PNG download (Yann 2 juin 2026).
 * Avenir système sur Mac/iOS, fallback élégant pour autres OS.
 * Si système n'a pas Avenir : Nunito Sans ressemble à 95%.
 * UNIQUEMENT pour le PNG download, PAS pour le rendu web (chart live).
 */
const PNG_FONT_FAMILY =
  '"Avenir", "Avenir Next", "Avenir Sans", "Nunito Sans", "Open Sans", -apple-system, sans-serif';

/**
 * Raccourcit le label d'axe Y pour le PNG download UNIQUEMENT.
 * Web reste verbeux ("$ en Milliards"), PNG devient compact ("$ Mds").
 * Yann 2 juin 2026 : "distinction entre PNG et web".
 */
function shortenYAxisLabel(label: string | null | undefined): string {
  if (!label) return "";
  const raw = label.trim();
  // Patterns longs → diminutifs
  const replacements: Array<[RegExp, string]> = [
    [/^\$\s*en\s+Milliards$/i, "$ Mds"],
    [/^€\s*en\s+Milliards$/i, "€ Mds"],
    [/^£\s*en\s+Milliards$/i, "£ Mds"],
    [/^¥\s*en\s+Milliards$/i, "¥ Mds"],
    [/^CHF\s*en\s+Milliards$/i, "CHF Mds"],
    [/^\$\s*en\s+Millions$/i, "$ M"],
    [/^€\s*en\s+Millions$/i, "€ M"],
    [/^£\s*en\s+Millions$/i, "£ M"],
    [/^¥\s*en\s+Millions$/i, "¥ M"],
    [/^CHF\s*en\s+Millions$/i, "CHF M"],
    [/^%\s*en\s+pourcentage$/i, "%"],
    [/^en\s+pourcentage$/i, "%"],
    [/^Pourcentage$/i, "%"],
  ];
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(raw)) return replacement;
  }
  // Déjà court : "Mds $", "M €", "%", etc → garder
  return raw;
}

/**
 * Détecte si une couleur (#hex / rgb()) est sombre.
 * Utilisé pour choisir entre logo Mettrik noir / blanc dans le watermark download.
 */
function isDarkColor(color: string): boolean {
  if (!color) return true;
  const c = color.trim().toLowerCase();
  // Hex #RGB or #RRGGBB
  const hex = c.startsWith("#") ? c.slice(1) : null;
  if (hex && (hex.length === 3 || hex.length === 6)) {
    const full = hex.length === 3
      ? hex.split("").map((x) => x + x).join("")
      : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    // luminance perçue (W3C)
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum < 0.5;
  }
  // rgb(a)
  const m = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) {
    const r = parseInt(m[1], 10);
    const g = parseInt(m[2], 10);
    const b = parseInt(m[3], 10);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum < 0.5;
  }
  return true; // fallback sombre (cas le plus fréquent Mettrik)
}

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
  // Yann 17 mai 2026 (v4) : defensive — supprime aussi tout <image> dont
  // href contient "brand-mini-logo" ou "mini-logo" (au cas où un wrapper
  // <g data-chart-logo> manquerait sur une variante future de chart).
  // Le ChartMiniLogo top-left (visible dans certaines screenshots Yann)
  // doit absolument disparaitre du PNG.
  clone.querySelectorAll("image").forEach((img) => {
    const href =
      img.getAttribute("href") ||
      img.getAttribute("xlink:href") ||
      "";
    if (/brand-mini-logo|\/mini-logo/i.test(href)) {
      // Si l'image est dans un wrapper <g>, retire le wrapper entier.
      const wrapper = img.closest("g");
      if (wrapper && wrapper.parentNode) {
        wrapper.parentNode.removeChild(wrapper);
      } else if (img.parentNode) {
        img.parentNode.removeChild(img);
      }
    }
  });

  // Yann 2 juin 2026 (v7) : raccourcir le label axe Y dans le PNG UNIQUEMENT.
  // Web reste verbeux ("$ en Milliards"), PNG devient compact ("$ Mds").
  // On traverse tous les <text> du clone et on remplace les patterns
  // longs par leur diminutif via shortenYAxisLabel().
  // Application aussi sur la police : tous les <text> du clone passent
  // en police Avenir (fix 1 — Yann 2 juin 2026 v7).
  clone.querySelectorAll("text").forEach((t) => {
    const txt = (t.textContent || "").trim();
    if (txt) {
      const short = shortenYAxisLabel(txt);
      if (short !== txt) {
        t.textContent = short;
      }
    }
    // Forcer police Avenir sur tous les textes du PNG (titre, axes,
    // labels valeurs, footer signature). Les <text> du chart d'origine
    // utilisaient "ui-monospace, monospace" ou des polices web ; on
    // override pour homogénéité PNG.
    t.setAttribute("font-family", PNG_FONT_FAMILY);
  });

  // Yann 2 juin 2026 (v6) : nettoyage agressif "point top-left" entouré
  // jaune sur capture Yann. Supprime tout <circle> isolé hors zone chart
  // (y < 20 dans le viewBox SVG d'origine) qui pourrait être un artefact
  // de mini-logo, indicateur de focus React, ou élément décoratif perdu.
  clone.querySelectorAll("circle").forEach((c) => {
    const cy = parseFloat(c.getAttribute("cy") || "0");
    const cx = parseFloat(c.getAttribute("cx") || "0");
    // Si le cercle est positionné dans la zone top-left du viewBox d'origine
    // (en dehors de la zone du chart) ET n'a pas de parent <g> qui le rend
    // explicite (data-events ou data-chart-point), c'est un artefact.
    if (cy < 24 && cx < 60) {
      const parent = c.closest("g");
      const isExplicit =
        parent?.hasAttribute("data-events") ||
        parent?.hasAttribute("data-chart-point") ||
        c.hasAttribute("data-chart-point");
      if (!isExplicit && c.parentNode) {
        c.parentNode.removeChild(c);
      }
    }
  });

  // Récupère le viewBox actuel.
  const vb = svg.viewBox.baseVal;
  const origX = vb?.x ?? 0;
  const origY = vb?.y ?? 0;
  const origW = vb?.width || svg.clientWidth || 920;
  const origH = vb?.height || svg.clientHeight || 360;

  // Padding ajouté autour du graph dans l'export.
  // Yann 2 juin 2026 (v7 polish FINAL) : PAD_TOP = 150 (+30 vs v6 pour
  // abaisser le graph de ~30px et donner plus d'air au titre).
  // PAD_BOTTOM = 64 (réduit de 80) pour signature TRÈS proche de la
  // dernière date X (distance verticale ~= distance horizontale entre
  // "0" et "5" de "2025", soit ~10px). Yann 2 juin 2026 v8.
  const PAD_TOP = 150;
  const PAD_SIDE = 36;
  const PAD_BOTTOM = 64;

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

  // ── Footer "KPIs & Data by [Mettrik combined logo]" (v7, 2 juin 2026) ──
  // Yann 2 juin 2026 v7 FINAL : logo "combined" (wordmark Mettrik AI
  // complet, pas juste le M). Alignement DROITE strict sur la fin du
  // graph (= dernière date axe X). Position ~25-30px en dessous du
  // chart bottom pour respirer.
  const isDarkTheme = isDarkColor(bgColor);
  // Logo "combined" = wordmark Mettrik AI complet.
  const logoFilename = isDarkTheme
    ? "/brand/mettrik-combined-white-bg-transparent.png"
    : "/brand/mettrik-combined-black-bg-transparent.png";

  // Yann 2 juin 2026 v9 : embed le logo en base64 data URI dans le SVG
  // (sinon le canvas ne charge pas l'image asynchrone avant rendu PNG
  // = logo invisible dans le download). Fetch synchrone du PNG public.
  let logoDataUrl: string = logoFilename;
  try {
    const logoBlob = await fetch(logoFilename).then((r) =>
      r.ok ? r.blob() : Promise.reject()
    );
    logoDataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(logoBlob);
    });
  } catch {
    /* fallback sur href URL si fetch fail */
  }

  const WM_LOGO_H = 36; // hauteur image combined logo
  const WM_LOGO_W = WM_LOGO_H * 3.6; // ratio ~3.6:1 du combined
  const WM_GAP = 10;
  const KPIS_DATA_BY_TEXT_W = 110; // espace pour "KPIs & Data by" en Avenir 14
  const wmTotalW = KPIS_DATA_BY_TEXT_W + WM_GAP + WM_LOGO_W;
  // Aligné DROITE sur la fin du graph (= bord droit dernière date axe X).
  const wmRightX = origX + origW;
  const wmStartX = wmRightX - wmTotalW;
  // Yann 2 juin 2026 v9 : signature TRÈS proche du label X (distance ~10px
  // identique au gap entre "0" et "5" du label "2025"). Les labels X
  // occupent l'espace origH+0 à origH+38 (T1/T2... puis année). On place
  // le watermark à origH+45 = ~10px sous la fin des labels.
  const wmY = origY + origH + 45;
  const wmTextCenterX = wmStartX + KPIS_DATA_BY_TEXT_W / 2;
  const wmLogoX = wmStartX + KPIS_DATA_BY_TEXT_W + WM_GAP;

  const wmTextEl = document.createElementNS(NS, "text");
  wmTextEl.setAttribute("x", String(wmTextCenterX));
  wmTextEl.setAttribute("y", String(wmY + WM_LOGO_H / 2 + 5));
  wmTextEl.setAttribute("text-anchor", "middle");
  // Police Avenir avec fallback chain (Yann 2 juin 2026 v7).
  wmTextEl.setAttribute("font-family", PNG_FONT_FAMILY);
  wmTextEl.setAttribute("font-size", "14");
  wmTextEl.setAttribute("font-weight", "600");
  wmTextEl.setAttribute("letter-spacing", "0.02em");
  wmTextEl.setAttribute("fill", titleColor);
  wmTextEl.setAttribute("opacity", "0.85");
  wmTextEl.textContent = "KPIs & Data by";
  clone.appendChild(wmTextEl);

  const wmLogoEl = document.createElementNS(NS, "image");
  wmLogoEl.setAttribute("x", String(wmLogoX));
  wmLogoEl.setAttribute("y", String(wmY));
  wmLogoEl.setAttribute("width", String(WM_LOGO_W));
  wmLogoEl.setAttribute("height", String(WM_LOGO_H));
  wmLogoEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
  wmLogoEl.setAttribute("href", logoDataUrl);
  wmLogoEl.setAttributeNS(
    "http://www.w3.org/1999/xlink",
    "xlink:href",
    logoDataUrl
  );
  wmLogoEl.setAttribute("opacity", "0.95");
  clone.appendChild(wmLogoEl);

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

  // ── Titre 2 lignes centrées au-dessus du PNG (Yann 2 juin 2026) ──
  // Refonte v7 — style Bourseko / Fiscal.ai :
  //   Ligne 1 (petite, ~20px) : [logo sté] [nom sté]
  //   Ligne 2 (grosse, ~26px) : [nom du KPI]
  // Les deux centrées, Fraunces serif élégant, même tonalité (gradient
  // titleColor). Logo sté à gauche du nom sté ligne 1.
  // options.title contient toujours "kpiText · stéText" :
  //   - ligne 1 = stéText (sans "Inc" déjà retiré côté data)
  //   - ligne 2 = kpiText
  // Yann 2 juin 2026 v9 : hiérarchie inversée — nom sté = focus #1 (gros),
  // titre du graph (KPI) = focus #2 juste en dessous.
  const TITLE_STE_FONT_SIZE = 34;       // ligne 1 (nom sté), focus #1
  const TITLE_KPI_FONT_SIZE = 18;       // ligne 2 (nom KPI), juste en dessous
  const TITLE_STE_CHAR_W = 16;          // estimation Avenir 800 34px
  const TITLE_KPI_CHAR_W = 9;           // estimation Avenir 600 18px
  const TITLE_LOGO_SIZE = 32;           // logo sté ligne 1 proportionnel au texte gros
  const TITLE_LOGO_GAP = 10;            // gap entre logo et nom sté
  const LINE1_Y = origY - PAD_TOP + 55;
  const LINE2_Y = origY - PAD_TOP + 90;

  // Yann 2 juin 2026 v7 : police Avenir (au lieu de Fraunces) pour le
  // PNG download UNIQUEMENT. Web reste sur Fraunces.
  const titleFontFamily = PNG_FONT_FAMILY;

  if (options.title) {
    // Split sur " · " (espace point milieu espace).
    const SEPARATOR = " · ";
    const sepIdx = options.title.indexOf(SEPARATOR);
    const hasSeparator = sepIdx > 0;

    const kpiText = hasSeparator ? options.title.slice(0, sepIdx) : options.title;
    const stéText = hasSeparator ? options.title.slice(sepIdx + SEPARATOR.length) : "";

    // Récupère le logo sté si dispo (DOM ou fallback).
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
            innerImg.naturalWidth >= 64
          ) {
            // Yann 2 juin 2026 v7 : seuil bumpé 32→64 px pour rejeter
            // les monogrammes/favicons low-res et forcer fallback vers
            // /logos/<TICKER>.png (qui a été corrigé batch 1-4).
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

        // 2) Fallback : /logos/<TICKER>.png (le VRAI logo, ex MSCI bleu).
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
          // Yann 2 juin 2026 v7 : seuil 64 px (cohérent avec DOM logo
          // ci-dessus). Si /logos/<TICKER>.png est < 64 px, c'est un
          // monogramme ou un favicon stale → on skip silencieusement.
          if (probe.naturalWidth >= 64) {
            stéLogoDataUrl = tempDataUrl;
          }
        }
      } catch {
        /* skip silencieux si logo sté indispo */
        stéLogoDataUrl = null;
      }
    }

    // ── Ligne 1 : logo + nom sté, centrée ──
    if (stéText) {
      const hasLogo = !!stéLogoDataUrl;
      const stéW = stéText.length * TITLE_STE_CHAR_W;
      const totalL1 = hasLogo
        ? TITLE_LOGO_SIZE + TITLE_LOGO_GAP + stéW
        : stéW;
      const midX = origX + origW / 2;
      const startL1 = midX - totalL1 / 2;

      if (hasLogo && stéLogoDataUrl) {
        const stéImgEl = document.createElementNS(NS, "image");
        stéImgEl.setAttribute("href", stéLogoDataUrl);
        stéImgEl.setAttributeNS(
          "http://www.w3.org/1999/xlink",
          "xlink:href",
          stéLogoDataUrl
        );
        stéImgEl.setAttribute("x", String(startL1));
        stéImgEl.setAttribute(
          "y",
          String(LINE1_Y - TITLE_LOGO_SIZE * 0.85)
        );
        stéImgEl.setAttribute("width", String(TITLE_LOGO_SIZE));
        stéImgEl.setAttribute("height", String(TITLE_LOGO_SIZE));
        stéImgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
        clone.appendChild(stéImgEl);
      }

      const stéTextStartX = hasLogo
        ? startL1 + TITLE_LOGO_SIZE + TITLE_LOGO_GAP
        : startL1;
      const stéEl = document.createElementNS(NS, "text");
      stéEl.setAttribute("x", String(stéTextStartX + stéW / 2));
      stéEl.setAttribute("y", String(LINE1_Y));
      stéEl.setAttribute("text-anchor", "middle");
      stéEl.setAttribute("font-family", titleFontFamily);
      stéEl.setAttribute("font-weight", "800");
      stéEl.setAttribute("font-style", "normal");
      stéEl.setAttribute("font-size", String(TITLE_STE_FONT_SIZE));
      stéEl.setAttribute("letter-spacing", "-0.01em");
      stéEl.setAttribute("fill", titleColor);
      stéEl.textContent = stéText;
      clone.appendChild(stéEl);
    }

    // ── Ligne 2 : nom du KPI, centrée, plus gros ──
    const kpiEl = document.createElementNS(NS, "text");
    kpiEl.setAttribute("x", String(origX + origW / 2));
    kpiEl.setAttribute("y", String(LINE2_Y));
    kpiEl.setAttribute("text-anchor", "middle");
    kpiEl.setAttribute("font-family", titleFontFamily);
    kpiEl.setAttribute("font-weight", "600");
    kpiEl.setAttribute("font-style", "normal");
    kpiEl.setAttribute("font-size", String(TITLE_KPI_FONT_SIZE));
    kpiEl.setAttribute("letter-spacing", "-0.02em");
    kpiEl.setAttribute("fill", titleColor);
    kpiEl.textContent = kpiText;
    clone.appendChild(kpiEl);
    void TITLE_KPI_CHAR_W; // réservé pour calculs futurs si besoin
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
