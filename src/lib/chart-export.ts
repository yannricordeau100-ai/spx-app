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
 * Police "Avenir" pour PNG download (Yann 2 juin 2026, fallback affiné
 * 8 juin 2026 PRIO 2).
 *
 * IMPORTANT : Avenir / Avenir Next est une police SYSTÈME Apple (licenciée),
 * NON embarquable dans le SVG/PNG. Elle rend donc parfaitement sur le Mac de
 * Yann (présente nativement) mais dépend du système ailleurs. Pour les autres
 * environnements, le meilleur fallback FIN est Manrope (la police body de
 * l'app, déjà chargée via @font-face → embarquée dans le PNG par le bloc
 * fontFaceCss plus bas) en weight 300, puis Nunito Sans / Open Sans.
 * UNIQUEMENT pour le PNG download, PAS pour le rendu web (chart live).
 */
const PNG_FONT_FAMILY =
  '"Avenir", "Avenir Next", "Avenir Sans", "Manrope", "Nunito Sans", "Open Sans", -apple-system, sans-serif';

/**
 * Yann 2 juin 2026 v9 : devient OBSOLÈTE. Le live et le PNG utilisent
 * tous deux le format court "Mds $" via chartAxisHeader. Cette fonction
 * garde sa rétro-compat (datasets pré-v9 avec "$ en Milliards" résiduels)
 * mais ne fait plus de transformation dans la majorité des cas.
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
  options: {
    title?: string;
    ticker?: string;
    /** Yann 10 juin 2026 (Point 3) : CAGR annualise deja formate cote
     *  composant (ex "CAGR +47,8 %/an"). Affiche en ligne discrete sous le
     *  titre. Le calcul d'annualisation + le libelle locale-aware ("/an" |
     *  "/yr") sont faits par l'appelant (company-view) qui connait
     *  history + period_type. Si absent, aucune ligne CAGR n'est rendue. */
    cagr?: string;
    /** Yann 10 juin 2026 (Point 6) : locale courante de la page au moment de
     *  l'export. Utilisee pour tout texte genere cote export. "KPIs Powered
     *  by" reste en anglais (signature de marque). Default = fr. */
    locale?: "fr" | "en" | "en-GB" | "de" | "de-CH" | "nl";
    /** Yann 8 juin 2026 (PRIO 3) : suffixe de fréquence "par x" déjà localisé
     *  (ex "par mois", "per week"), fourni UNIQUEMENT quand la fréquence du
     *  graph ≠ année. Ce segment est inclus tel quel à la fin du sous-titre
     *  KPI (options.title) ; on le détecte pour le styler à part (2 pts plus
     *  petit, bleu-violet #a78bfa, opacité 0.85). Si fréquence = année,
     *  laisser undefined → sous-titre inchangé. */
    frequency?: string;
    /** Yann 10 juin 2026 : "lead" de l'interprétation IA du KPI (1 phrase,
     *  texte BRUT déjà strippé des balises HTML <strong>/<em> côté appelant),
     *  dans la MÊME langue que le titre exporté (heroTitleLang). Rendu en bloc
     *  multi-ligne (word-wrap manuel) SOUS le graph et AU-DESSUS du footer
     *  "KPIs Powered by". Si absent → aucun bloc ajouté (pas d'espace vide). */
    interpretation?: string;
    /** Yann 1er sept 2026 : nom EN du KPI, rendu en italique sous le titre
     *  francais du document. Omis s il est identique au titre affiche. */
    titleEn?: string;
    /** Yann 1er sept 2026 : unite de l axe Y en anglais, italique, sous le
     *  nom EN. */
    unitEn?: string;
    /** Yann 1er sept 2026 : moyenne de la serie pour les graphs en % (deja
     *  formatee, ex "+7,4 %"). Affichee en miroir gauche de la ligne CAGR. */
    avgPct?: string;
  } = {},
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
  // Yann 10 juin 2026 : couleur sous-titre (CAGR) plus discrete que le titre.
  const subtitleColor = isLight ? "#52525b" : "#a1a1aa";

  // Clone pour pouvoir injecter / modifier sans toucher au DOM live.
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  // Yann 3 sept 2026 : la courbe se dessine en 1,3 s (animation du trace).
  // Un telechargement lance pendant ce temps copiait l etat intermediaire et
  // le document sortait avec une courbe A MOITIE tracee. L animation ecrit
  // sur le style en ligne (stroke-dasharray / stroke-dashoffset), alors que
  // les vrais pointilles du graph (TTM, reperes) sont poses en ATTRIBUT : on
  // neutralise donc uniquement le style en ligne, sur le clone.
  clone.querySelectorAll<SVGElement>("*").forEach((el) => {
    if (el.style && (el.style.strokeDasharray || el.style.strokeDashoffset)) {
      el.style.strokeDasharray = "";
      el.style.strokeDashoffset = "";
    }
    if (el.style && el.style.opacity && Number(el.style.opacity) < 1 && el.hasAttribute("data-chart-line")) {
      el.style.opacity = "1";
    }
  });

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
    // Yann 8 juin 2026 (PRIO 2) : graisse FINE (300) sur TOUS les écriteaux
    // du PNG export (axes, labels valeurs, années, header d'unité). Les
    // <text> injectés ensuite (titre, KPI, footer, CAGR, "par x") posent
    // leur propre font-weight 300 à la création.
    t.setAttribute("font-weight", "300");
  });

  // ── PRIO 1b : recoloration axes / structure / gridlines selon thème ──
  // Yann 8 juin 2026. Sur le CLONE uniquement (le live garde ses couleurs).
  //  - Thème CLAIR (fond blanc) : axes + traits de structure du graph en
  //    gris PLUS FONCÉ (#4b5563) pour rester lisibles sur blanc. Les
  //    gridlines pointillées suivent (sinon invisibles).
  //  - Thème SOMBRE : les gridlines pointillées (data-export-role="gridline",
  //    #1a1a1a quasi invisible) passent à la MÊME couleur que la structure /
  //    les axes (gris clair #9ca3af) pour être visibles dans le PNG.
  const STRUCTURE_LIGHT = "#4b5563"; // gris foncé (thème clair)
  const STRUCTURE_DARK = "#9ca3af"; // gris clair = couleur axes (thème sombre)
  const structureColor = isLight ? STRUCTURE_LIGHT : STRUCTURE_DARK;
  clone
    .querySelectorAll(
      '[data-export-role="structure"],[data-export-role="gridline"]'
    )
    .forEach((el) => {
      el.setAttribute("stroke", structureColor);
    });
  // Thème CLAIR : les textes d'axe du chart (ticks Y, header d'unité, labels
  // années) sont en gris très clair (#e4e4e7 / #a1a1aa) → illisibles sur
  // blanc. On les passe au même gris foncé que la structure. Les <text>
  // injectés par l'export (titre/KPI/CAGR) ont déjà leur couleur theme-aware.
  if (isLight) {
    clone.querySelectorAll("text").forEach((t) => {
      const fill = (t.getAttribute("fill") || "").toLowerCase();
      // Cible uniquement les gris clairs natifs du chart (pas les éléments
      // déjà recolorés ou colorés volontairement type couleur sté).
      if (
        fill === "#e4e4e7" ||
        fill === "#a1a1aa" ||
        fill === "#d4d4d8" ||
        fill === "#fafafa"
      ) {
        t.setAttribute("fill", STRUCTURE_LIGHT);
      }
    });
  }

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

  const NS_EARLY = "http://www.w3.org/2000/svg";
  const PAD_SIDE_FOR_TEXT = 36;

  /**
   * Yann 26 aout 2026 : sur un KPI NON FINANCIER, l en-tete d axe abrege la
   * magnitude ("B Subscribers", "Mds abonnés"). Dans un document telecharge,
   * personne n a le contexte pour decoder "B". On ecrit donc le mot entier,
   * et l unite passe sur une seconde ligne. Les unites monetaires gardent
   * leur forme courte : "Mds $" est une convention lue sans ambiguite.
   */
  const MAGNITUDE_WORDS: Record<string, { fr: string; en: string }> = {
    B: { fr: "Milliards", en: "Billion" },
    Mds: { fr: "Milliards", en: "Billion" },
    Mrd: { fr: "Milliards", en: "Billion" },
    mld: { fr: "Milliards", en: "Billion" },
    M: { fr: "Millions", en: "Million" },
    Mio: { fr: "Millions", en: "Million" },
    mln: { fr: "Millions", en: "Million" },
    K: { fr: "Milliers", en: "Thousand" },
    Tsd: { fr: "Milliers", en: "Thousand" },
    T: { fr: "Billions", en: "Trillion" },
    Tn: { fr: "Billions", en: "Trillion" },
    Bln: { fr: "Billions", en: "Trillion" },
    Bio: { fr: "Billions", en: "Trillion" },
  };
  const isMoneyHeader = (s: string) => /[$€£]|\b(USD|EUR|GBP|CHF|JPY|SEK|NOK|DKK|TWD)\b/i.test(s);
  /** Rend ["Milliards", "abonnés"] ou null si rien a developper. */
  const splitAxisHeader = (raw: string, isFr: boolean): [string, string] | null => {
    const txt = raw.trim();
    if (!txt || isMoneyHeader(txt)) return null;
    const m = txt.match(/^([A-Za-z]{1,3})\s+(.+)$/);
    if (!m) return null;
    const word = MAGNITUDE_WORDS[m[1]];
    if (!word) return null;
    return [isFr ? word.fr : word.en, m[2].trim()];
  };


  // Yann 24 aout 2026 : +50 % sur les textes de l AXE Y (ticks, anchor
  // "end"/"start" colles aux bords) et sur les ANNEES / labels de l axe X
  // (bande basse du chart). Les labels de valeurs au-dessus des barres et
  // les % YoY (anchor middle, zone haute) ne bougent pas.
  // Yann 26 aout 2026 : les ecritures de l axe Y sont reduites de 20 % par
  // rapport au facteur d agrandissement precedent (1,5 -> 1,2).
  const AXIS_SCALE = 1.2;
  const isFrExport = String(options.locale ?? "fr").startsWith("fr");

  clone.querySelectorAll("text").forEach((t) => {
    const fs = parseFloat(t.getAttribute("font-size") || "0");
    if (!fs) return;
    const anchorAttr = t.getAttribute("text-anchor") || "";
    const ty = parseFloat(t.getAttribute("y") || "NaN");
    const isYAxisTick = anchorAttr === "end" || anchorAttr === "start";
    const isXAxisLabel = Number.isFinite(ty) && ty > origY + origH - 70;

    // En-tete d unite d un KPI non financier : magnitude en toutes lettres,
    // unite reportee sur une seconde ligne juste en dessous.
    if (isYAxisTick && Number.isFinite(ty) && ty < origY + 24) {
      const parts = splitAxisHeader(t.textContent || "", isFrExport);
      if (parts) {
        const size = Math.round(fs * AXIS_SCALE * 10) / 10;
        t.setAttribute("font-size", String(size));
        // La seconde ligne pousse le bloc vers le bas et venait toucher le
        // premier graduation de l axe : on remonte l ensemble d une ligne.
        const baseY = parseFloat(t.getAttribute("y") || "0");
        t.setAttribute("y", String(Math.round((baseY - size * 1.25) * 10) / 10));
        t.textContent = "";
        const l1 = document.createElementNS(NS_EARLY, "tspan");
        l1.setAttribute("x", t.getAttribute("x") ?? "0");
        l1.textContent = parts[0];
        const l2 = document.createElementNS(NS_EARLY, "tspan");
        l2.setAttribute("x", t.getAttribute("x") ?? "0");
        l2.setAttribute("dy", String(Math.round(size * 1.15)));
        l2.setAttribute("font-size", String(Math.round(size * 0.86 * 10) / 10));
        l2.textContent = parts[1];
        t.appendChild(l1);
        t.appendChild(l2);
        return;
      }
    }

    if (isYAxisTick || isXAxisLabel) {
      // Yann 25 aout 2026 : l en-tete d unite ("B Subscribers") agrandi de
      // 50 % sortait du cadre a gauche et etait rogne. Quand le libelle
      // contient un mot de 7 caracteres ou plus, on reduit le facteur, puis
      // on le borne encore si la largeur mesuree ne tient pas dans la marge
      // disponible. La lisibilite prime sur l uniformite de taille.
      const txtContent = (t.textContent || "").trim();
      const hasLongWord = txtContent
        .split(/\s+/)
        .some((w) => w.replace(/[^\p{L}\p{N}]/gu, "").length >= 7);
      let factor = AXIS_SCALE;
      if (hasLongWord) {
        const tx = parseFloat(t.getAttribute("x") || "NaN");
        const measureCtx2 =
          typeof document !== "undefined"
            ? document.createElement("canvas").getContext("2d")
            : null;
        if (Number.isFinite(tx) && measureCtx2) {
          measureCtx2.font = `300 ${fs}px ${PNG_FONT_FAMILY}`;
          const w = measureCtx2.measureText(txtContent).width;
          // L en-tete d unite (zone haute, hors ligne des ticks) peut etre
          // reancre au bord gauche du cadre : il gagne toute la marge et
          // garde une taille lisible au lieu d etre rapetisse.
          const isAxisHeader = Number.isFinite(ty) && ty < origY + 24;
          // Yann 29 aout 2026 (screen PLTR "Customers") : quand l axe Y est a
          // DROITE, l en-tete est ancre "end" au bord droit et s etend vers la
          // gauche, ou la place est libre : rien a re-ancrer. Le re-ancrage au
          // bord gauche ne vaut que pour un axe a gauche, sinon l en-tete se
          // retrouvait isole en haut a gauche, a l oppose de ses graduations.
          const enTeteAxeGauche = Number.isFinite(tx) && tx < origX + origW / 2;
          if (isAxisHeader && anchorAttr === "end" && enTeteAxeGauche) {
            const leftEdge = origX - PAD_SIDE_FOR_TEXT + 2;
            // Cette ligne (au-dessus du plot) est vide a droite : l en-tete
            // peut s etendre jusqu au premier tiers du graphe sans rien
            // chevaucher. Il garde ainsi une taille lisible.
            const room = origX + origW * 0.35 - leftEdge;
            if (w > 0 && room > 0) {
              factor = Math.max(0.9, Math.min(AXIS_SCALE, (room - 4) / w));
            }
            t.setAttribute("text-anchor", "start");
            t.setAttribute("x", String(leftEdge));
          } else {
            const room =
              anchorAttr === "end"
                ? tx - (origX - PAD_SIDE_FOR_TEXT)
                : anchorAttr === "start"
                  ? origX + origW + PAD_SIDE_FOR_TEXT - tx
                  : Number.POSITIVE_INFINITY;
            if (w > 0 && Number.isFinite(room) && room > 0) {
              factor = Math.max(0.9, Math.min(AXIS_SCALE, (room - 4) / w));
            }
          }
        }
      }
      // Yann 28 aout 2026 : dans le document exporte, les ANNEES de l axe X
      // sont agrandies davantage que le reste (1,45 contre 1,2) : c est le
      // premier repere de lecture du PNG. La langue, la periode et tous les
      // reglages du graphe au moment du telechargement restent inchanges.
      const estAnnee =
        isXAxisLabel && /^(19|20)\d{2}$/.test((t.textContent || "").trim());
      if (estAnnee) {
        // Yann 29 aout 2026 : meme taille finale que les graduations de
        // l axe Y (16 px avant agrandissement), quel que soit le corps de
        // depart des annees (13 px sous les crochets trimestriels).
        t.setAttribute(
          "font-size",
          String(Math.round(16 * AXIS_SCALE * 10) / 10),
        );
      } else {
        t.setAttribute("font-size", String(Math.round(fs * factor * 10) / 10));
      }
      // Les ANNEES sous les crochets de groupe : le texte agrandi remontait
      // jusqu a toucher le crochet. On les abaisse pour retrouver l ecart
      // d avant l agrandissement (Yann 24 aout 2026).
      if (estAnnee) {
        t.setAttribute("y", String(ty + 10));
      }
    }
  });

  // Padding ajouté autour du graph dans l'export.
  // Yann 2 juin 2026 (v7 polish FINAL) : PAD_TOP = 150 (+30 vs v6 pour
  // abaisser le graph de ~30px et donner plus d'air au titre).
  // PAD_BOTTOM = 64 (réduit de 80) pour signature TRÈS proche de la
  // dernière date X (distance verticale ~= distance horizontale entre
  // "0" et "5" de "2025", soit ~10px). Yann 2 juin 2026 v8.
  // Yann 24 aout 2026 : titres agrandis de 50 % -> plus d air en haut.
  // Yann 1er sept 2026 v2 : etagement complet de l en-tete, chaque ligne a
  // sa hauteur reservee — ste 72, KPI FR 122, nom EN 154, unite EN 178,
  // CAGR / Moyenne 208. Le premier jet posait le CAGR a 162 et le nom EN a
  // 156 : chevauchement direct (screen Threads).
  const PAD_TOP = 252;
  const PAD_SIDE = 36;
  // Yann 2 juin 2026 v10 : PAD_BOTTOM réduit à 50 pour rapprocher la
  // signature des labels X. Logo height 36 + margin 4 = 40 + 10px gap
  // au-dessus du label X = 50px total nécessaire après origH.
  const PAD_BOTTOM = 50;

  // ── Bloc interprétation IA (Yann 10 juin 2026) ──
  // Le "lead" de l'interprétation (1 phrase, texte brut déjà strippé des
  // balises HTML côté appelant) est rendu SOUS le graph et AU-DESSUS du
  // footer. Police Avenir fine (300), couleur subtitleColor, centré, ~14px,
  // interligne confortable. Word-wrap manuel sur la largeur du graph.
  // On calcule la hauteur du bloc AVANT le viewBox pour recalculer la
  // hauteur totale et ne pas chevaucher footer ni graph. Si pas
  // d'interprétation → bloc nul (interpBlockH = 0, pas d'espace vide).
  const INTERP_FONT_SIZE = 14;
  const INTERP_LINE_H = 22; // interligne confortable
  const INTERP_GAP_ABOVE = 18; // air entre le bas du graph et la 1re ligne
  const INTERP_GAP_BELOW = 16; // air entre la dernière ligne et le footer
  const INTERP_WRAP_W = origW; // word-wrap sur la largeur du graph
  const interpText = (options.interpretation || "").trim();
  const interpLines: string[] = [];
  if (interpText) {
    // Mesure réelle de la largeur du texte (canvas measureText) pour un
    // word-wrap fidèle au rendu Avenir/Manrope du PNG. Fallback estimation
    // char-width si canvas indispo (SSR / contexte non-DOM).
    const measureCtx =
      typeof document !== "undefined"
        ? document.createElement("canvas").getContext("2d")
        : null;
    if (measureCtx) {
      measureCtx.font = `300 ${INTERP_FONT_SIZE}px ${PNG_FONT_FAMILY}`;
    }
    const measure = (s: string): number =>
      measureCtx ? measureCtx.measureText(s).width : s.length * (INTERP_FONT_SIZE * 0.52);
    const words = interpText.split(/\s+/);
    let line = "";
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (measure(candidate) > INTERP_WRAP_W && line) {
        interpLines.push(line);
        line = w;
      } else {
        line = candidate;
      }
    }
    if (line) interpLines.push(line);
  }
  const interpBlockH =
    interpLines.length > 0
      ? INTERP_GAP_ABOVE + interpLines.length * INTERP_LINE_H + INTERP_GAP_BELOW
      : 0;

  // Nouveau viewBox englobant le contenu original + le padding + le bloc
  // interprétation (interpBlockH = 0 si absent → aucune hauteur ajoutée).
  const newW = origW + PAD_SIDE * 2;
  const newH = origH + PAD_TOP + interpBlockH + PAD_BOTTOM;
  const newX = origX - PAD_SIDE;
  const newY = origY - PAD_TOP;
  clone.setAttribute("viewBox", `${newX} ${newY} ${newW} ${newH}`);
  clone.setAttribute("width", String(newW));
  clone.setAttribute("height", String(newH));

  // Yann 26 aout 2026 : le graph et ses echelles sont reduits de 10 %, le
  // titre, le logo et la ligne CAGR gardent leur taille. On enveloppe le
  // contenu d origine dans un groupe mis a l echelle autour de son centre ;
  // les elements ajoutes ensuite (fond, titre, footer) ne sont pas dans ce
  // groupe et ne bougent donc pas. Les ancrages du footer et du CAGR sont
  // recalcules plus bas sur les bornes reduites (GRAPH_X / GRAPH_W).
  // Yann 1er sept 2026 : 0.9 -> 0.96 (l espace perdu en largeur etait
  // trop grand), et le graph est abaisse de GRAPH_DY pour laisser respirer
  // le titre enrichi des deux lignes anglaises.
  const GRAPH_SCALE = 0.96;
  const GRAPH_DY = 26;
  const graphCx = origX + origW / 2;
  const graphCy = origY + origH / 2;
  const GRAPH_X = graphCx - (origW * GRAPH_SCALE) / 2;
  const GRAPH_W = origW * GRAPH_SCALE;
  const GRAPH_BOTTOM = graphCy + (origH * GRAPH_SCALE) / 2 + GRAPH_DY;
  {
    const NS0 = "http://www.w3.org/2000/svg";
    const wrapper = document.createElementNS(NS0, "g");
    wrapper.setAttribute(
      "transform",
      `translate(0 ${GRAPH_DY}) translate(${graphCx} ${graphCy}) scale(${GRAPH_SCALE}) translate(${-graphCx} ${-graphCy})`,
    );
    const kids = Array.from(clone.childNodes);
    for (const k of kids) wrapper.appendChild(k);
    clone.appendChild(wrapper);
  }

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
  // Yann 4 juin 2026 : logo canonique unique (PNG transparent v2 RGBA).
  const logoFilename = isDarkTheme
    ? "/brand/mettrik-ai-white-purple.png"
    : "/brand/mettrik-ai-black-purple.png";

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

  // Yann 10 juin 2026 (Point 4) : logo Mettrik +20% (36 -> 43). WM_LOGO_W
  // suit via le meme ratio 3.6.
  const WM_LOGO_H = 43; // hauteur image combined logo (+20% vs 36)
  const WM_LOGO_W = WM_LOGO_H * 3.6; // ratio ~3.6:1 du combined
  const WM_GAP = 1; // Yann 10 juin 2026 : gap texte<->logo tres petit (bloc compact)
  const KPIS_DATA_BY_TEXT_W = 92; // largeur reelle "KPIs Powered by" Avenir 14 (collee au logo)
  const wmTotalW = KPIS_DATA_BY_TEXT_W + WM_GAP + WM_LOGO_W;
  // Aligné DROITE sur la fin du graph (= bord droit dernière date axe X).
  const wmRightX = GRAPH_X + GRAPH_W;
  const wmStartX = wmRightX - wmTotalW;
  // Yann 10 juin 2026 (Point 5) : footer REMONTE vers le haut (etait
  // origY+origH+10). On le pose a origY+origH-12 pour le rapprocher du bas
  // du chart sans chevaucher les labels de l'axe X (rendus a l'interieur du
  // viewBox original, entre origY+origH-30 et origY+origH).
  // Yann 10 juin 2026 : si un bloc interprétation est rendu sous le graph,
  // on descend le footer de interpBlockH pour le placer SOUS ce bloc (le
  // texte d'interprétation occupe [origY+origH, origY+origH+interpBlockH]).
  // Quand interpBlockH = 0 (pas d'interprétation), le footer garde sa
  // position d'origine.
  const wmY = GRAPH_BOTTOM - 12 + interpBlockH;
  const wmTextRightX = wmStartX + KPIS_DATA_BY_TEXT_W;
  const wmLogoX = wmStartX + KPIS_DATA_BY_TEXT_W + WM_GAP;

  const wmTextEl = document.createElementNS(NS, "text");
  wmTextEl.setAttribute("x", String(wmTextRightX));
  wmTextEl.setAttribute("y", String(wmY + WM_LOGO_H / 2 + 5));
  wmTextEl.setAttribute("text-anchor", "end");
  // Police Avenir avec fallback chain (Yann 2 juin 2026 v7).
  wmTextEl.setAttribute("font-family", PNG_FONT_FAMILY);
  wmTextEl.setAttribute("font-size", "14");
  // Yann 8 juin 2026 (PRIO 2) : graisse fine sur le footer signature.
  wmTextEl.setAttribute("font-weight", "300");
  wmTextEl.setAttribute("letter-spacing", "0.02em");
  wmTextEl.setAttribute("fill", titleColor);
  wmTextEl.setAttribute("opacity", "0.85");
  // Yann 10 juin 2026 (Point 1) : "KPIs & Data by" -> "KPIs Powered by".
  // Reste en anglais (signature de marque, quelle que soit la locale).
  wmTextEl.textContent = "KPIs Powered by";
  clone.appendChild(wmTextEl);

  const wmLogoEl = document.createElementNS(NS, "image");
  wmLogoEl.setAttribute("x", String(wmLogoX));
  wmLogoEl.setAttribute("y", String(wmY));
  wmLogoEl.setAttribute("width", String(WM_LOGO_W));
  wmLogoEl.setAttribute("height", String(WM_LOGO_H));
  // Yann 10 juin 2026 (Point 2) : logo colle a GAUCHE de sa boite (= colle
  // au texte) pour reduire encore le gap visuel texte<->logo (le PNG combined
  // a du padding interne a gauche). xMinYMid au lieu de xMidYMid.
  wmLogoEl.setAttribute("preserveAspectRatio", "xMinYMid meet");
  wmLogoEl.setAttribute("href", logoDataUrl);
  wmLogoEl.setAttributeNS(
    "http://www.w3.org/1999/xlink",
    "xlink:href",
    logoDataUrl
  );
  wmLogoEl.setAttribute("opacity", "0.95");
  clone.appendChild(wmLogoEl);

  // ── Rendu du bloc interprétation IA (Yann 10 juin 2026) ──
  // Lignes pré-calculées plus haut (interpLines, word-wrap manuel sur la
  // largeur du graph). Placé SOUS le graph (après origY+origH) et AU-DESSUS
  // du footer (qui a été descendu de interpBlockH). Police Avenir fine (300),
  // couleur subtitleColor, centré. Baseline 1re ligne = bas du graph + gap +
  // taille de police (pour aligner le HAUT du texte sur le gap).
  if (interpLines.length > 0) {
    const interpMidX = origX + origW / 2;
    const interpFirstBaselineY =
      origY + origH + INTERP_GAP_ABOVE + INTERP_FONT_SIZE;
    interpLines.forEach((lineText, i) => {
      const lineEl = document.createElementNS(NS, "text");
      lineEl.setAttribute("x", String(interpMidX));
      lineEl.setAttribute("y", String(interpFirstBaselineY + i * INTERP_LINE_H));
      lineEl.setAttribute("text-anchor", "middle");
      lineEl.setAttribute("font-family", PNG_FONT_FAMILY);
      lineEl.setAttribute("font-weight", "300");
      lineEl.setAttribute("font-style", "normal");
      lineEl.setAttribute("font-size", String(INTERP_FONT_SIZE));
      lineEl.setAttribute("letter-spacing", "0.01em");
      lineEl.setAttribute("fill", subtitleColor);
      lineEl.textContent = lineText;
      clone.appendChild(lineEl);
    });
  }

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
  const TITLE_STE_FONT_SIZE = 51;       // ligne 1 (nom sté), focus #1 (+50 % Yann 24 aout 2026)
  const TITLE_KPI_FONT_SIZE = 27;       // ligne 2 (nom KPI) (+50 % Yann 24 aout 2026)
  const TITLE_STE_CHAR_W = 24;          // estimation Avenir 51px
  const TITLE_KPI_CHAR_W = 9;           // estimation Avenir 600 18px
  const TITLE_LOGO_SIZE = 48;           // logo sté (+50 % Yann 24 aout 2026)
  const TITLE_LOGO_GAP = 26;            // Yann 10 juin 2026 : + d'espace entre logo et nom sté
  const LINE1_Y = origY - PAD_TOP + 72;
  const LINE2_Y = origY - PAD_TOP + 122;

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
    // Yann 24 aout 2026 : largeur du nom mesuree au canvas (plus d estimation
    // par nombre de caracteres) pour un centrage exact du bloc logo + nom.
    if (stéText) {
      const hasLogo = !!stéLogoDataUrl;
      let stéW = stéText.length * TITLE_STE_CHAR_W;
      const steCtx = document.createElement("canvas").getContext("2d");
      if (steCtx) {
        steCtx.font = `300 ${TITLE_STE_FONT_SIZE}px ${PNG_FONT_FAMILY}`;
        stéW = steCtx.measureText(stéText).width;
      }
      // Yann 3 sept 2026 : la largeur du nom n etait pas bornee. Un nom long
      // (Munchener Ruckversicherungs-Gesellschaft) sortait coupe des deux
      // cotes du document. On reduit la taille du texte jusqu a ce que le
      // bloc logo + nom tienne dans la largeur utile, plancher a 26 px.
      const LARGEUR_UTILE = origW - 48;
      let steFontSize = TITLE_STE_FONT_SIZE;
      const largeurBloc = (l: number) => (hasLogo ? TITLE_LOGO_SIZE + TITLE_LOGO_GAP + l : l);
      while (steFontSize > 26 && largeurBloc(stéW) > LARGEUR_UTILE) {
        steFontSize -= 2;
        if (steCtx) {
          steCtx.font = `300 ${steFontSize}px ${PNG_FONT_FAMILY}`;
          stéW = steCtx.measureText(stéText).width;
        } else {
          stéW = stéText.length * TITLE_STE_CHAR_W * (steFontSize / TITLE_STE_FONT_SIZE);
        }
      }
      const totalL1 = largeurBloc(stéW);
      const midX = origX + origW / 2;
      const startL1 = midX - totalL1 / 2;

      if (hasLogo && stéLogoDataUrl) {
        // Yann 10 juin 2026 : logo sté en carre-arrondi (meme forme que les
        // pages stes) = fond arrondi subtil + logo clippe aux coins arrondis.
        const logoTop = LINE1_Y - TITLE_LOGO_SIZE * 0.85;
        const logoRadius = TITLE_LOGO_SIZE * 0.22;
        const clipId = `steLogoClip_${Math.random().toString(36).slice(2, 8)}`;
        const clipPathEl = document.createElementNS(NS, "clipPath");
        clipPathEl.setAttribute("id", clipId);
        const clipRectEl = document.createElementNS(NS, "rect");
        clipRectEl.setAttribute("x", String(startL1));
        clipRectEl.setAttribute("y", String(logoTop));
        clipRectEl.setAttribute("width", String(TITLE_LOGO_SIZE));
        clipRectEl.setAttribute("height", String(TITLE_LOGO_SIZE));
        clipRectEl.setAttribute("rx", String(logoRadius));
        clipRectEl.setAttribute("ry", String(logoRadius));
        clipPathEl.appendChild(clipRectEl);
        clone.appendChild(clipPathEl);
        const bgRectEl = document.createElementNS(NS, "rect");
        bgRectEl.setAttribute("x", String(startL1));
        bgRectEl.setAttribute("y", String(logoTop));
        bgRectEl.setAttribute("width", String(TITLE_LOGO_SIZE));
        bgRectEl.setAttribute("height", String(TITLE_LOGO_SIZE));
        bgRectEl.setAttribute("rx", String(logoRadius));
        bgRectEl.setAttribute("ry", String(logoRadius));
        bgRectEl.setAttribute(
          "fill",
          isDarkTheme ? "rgba(255,255,255,0.07)" : "rgba(10,10,10,0.05)"
        );
        clone.appendChild(bgRectEl);
        const stéImgEl = document.createElementNS(NS, "image");
        stéImgEl.setAttribute("href", stéLogoDataUrl);
        stéImgEl.setAttributeNS(
          "http://www.w3.org/1999/xlink",
          "xlink:href",
          stéLogoDataUrl
        );
        stéImgEl.setAttribute("x", String(startL1));
        stéImgEl.setAttribute("y", String(logoTop));
        stéImgEl.setAttribute("width", String(TITLE_LOGO_SIZE));
        stéImgEl.setAttribute("height", String(TITLE_LOGO_SIZE));
        stéImgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
        stéImgEl.setAttribute("clip-path", `url(#${clipId})`);
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
      // Yann 8 juin 2026 (PRIO 2) : graisse fine (300) sur le nom sté (titre).
      stéEl.setAttribute("font-weight", "300");
      stéEl.setAttribute("font-style", "normal");
      stéEl.setAttribute("font-size", String(steFontSize));
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
    // Yann 8 juin 2026 (PRIO 2) : graisse fine (300) sur le nom du KPI.
    kpiEl.setAttribute("font-weight", "300");
    kpiEl.setAttribute("font-style", "normal");
    kpiEl.setAttribute("font-size", String(TITLE_KPI_FONT_SIZE));
    kpiEl.setAttribute("letter-spacing", "-0.02em");
    kpiEl.setAttribute("fill", titleColor);
    // Yann 8 juin 2026 (PRIO 3) : si la fréquence ≠ année, le sous-titre KPI
    // se termine par " par <x>" (déjà inclus dans options.title par
    // company-view). On isole ce segment dans un <tspan> pour le styler :
    // 2 pts plus petit, bleu-violet #a78bfa, opacité 0.85. Le reste du
    // sous-titre garde taille / couleur. Centrage inchangé (text-anchor
    // middle mesure la largeur réelle du <text> complet, tspan inclus).
    const freq = options.frequency?.trim();
    if (freq && kpiText.endsWith(freq) && kpiText.length > freq.length) {
      const base = kpiText.slice(0, kpiText.length - freq.length); // garde l'espace avant "par"
      const baseSpan = document.createElementNS(NS, "tspan");
      baseSpan.textContent = base;
      kpiEl.appendChild(baseSpan);
      const freqSpan = document.createElementNS(NS, "tspan");
      freqSpan.setAttribute("font-size", String(TITLE_KPI_FONT_SIZE - 2));
      freqSpan.setAttribute("fill", "#a78bfa");
      freqSpan.setAttribute("opacity", "0.85");
      freqSpan.textContent = freq;
      kpiEl.appendChild(freqSpan);
    } else {
      kpiEl.textContent = kpiText;
    }
    clone.appendChild(kpiEl);
    void TITLE_KPI_CHAR_W; // réservé pour calculs futurs si besoin

    // ── Lignes EN (Yann 1er sept 2026) : nom du KPI en anglais puis unite
    // de l axe Y en anglais, toutes deux en italique, centrees sous le
    // titre francais. Le nom EN est omis s il est identique au titre deja
    // affiche (cas ou l utilisateur a bascule le titre en anglais).
    const LINE_EN_NAME_Y = origY - PAD_TOP + 154;
    const LINE_EN_UNIT_Y = origY - PAD_TOP + 178;
    const titreEn = options.titleEn?.trim();
    const uniteEn = options.unitEn?.trim();
    const memeTexte = (a: string, b: string) =>
      a.toLowerCase().replace(/\s+/g, " ") === b.toLowerCase().replace(/\s+/g, " ");
    if (titreEn && !memeTexte(titreEn, kpiText)) {
      const enEl = document.createElementNS(NS, "text");
      enEl.setAttribute("x", String(origX + origW / 2));
      enEl.setAttribute("y", String(LINE_EN_NAME_Y));
      enEl.setAttribute("text-anchor", "middle");
      enEl.setAttribute("font-family", titleFontFamily);
      enEl.setAttribute("font-weight", "300");
      enEl.setAttribute("font-style", "italic");
      enEl.setAttribute("font-size", "20");
      enEl.setAttribute("letter-spacing", "-0.01em");
      enEl.setAttribute("fill", subtitleColor);
      enEl.textContent = titreEn;
      clone.appendChild(enEl);
    }
    if (uniteEn) {
      const unEl = document.createElementNS(NS, "text");
      unEl.setAttribute("x", String(origX + origW / 2));
      unEl.setAttribute("y", String(LINE_EN_UNIT_Y));
      unEl.setAttribute("text-anchor", "middle");
      unEl.setAttribute("font-family", titleFontFamily);
      unEl.setAttribute("font-weight", "300");
      unEl.setAttribute("font-style", "italic");
      unEl.setAttribute("font-size", "16");
      unEl.setAttribute("letter-spacing", "0em");
      unEl.setAttribute("fill", subtitleColor);
      unEl.setAttribute("opacity", "0.85");
      unEl.textContent = `Y axis: ${uniteEn}`;
      clone.appendChild(unEl);
    }

    // ── Ligne 3 : CAGR annualisé, centrée, discrète (Yann 10 juin 2026) ──
    // Le CAGR arrive déjà formaté + annualisé via options.cagr (calcul fait
    // côté company-view qui connaît history + period_type). Locale-aware :
    // "/an" en FR, "/yr" en EN (gérée par l'appelant). Couleur subtitleColor.
    // Yann 24 aout 2026 : refonte de la ligne CAGR.
    //  - Alignee a DROITE : son bord droit tombe sur le meme axe vertical
    //    que le logo "Mettrik AI" du footer (= origX + origW).
    //  - Le mot "CAGR" est remplace par une fleche PLEINE (epaisse) : verte
    //    vers le haut si positif, rouge vers le bas si negatif.
    //  - Asterisque "*" apres "/an" ou "/yr" ; le "*" de renvoi est pose en
    //    bas du graph, sur la ligne du footer, cale sur l axe Y du chart.
    // Moyenne de la serie (% uniquement), CENTREE : elle prend lieu et place
    // du CAGR (Yann 2 sept 2026). Jamais de conflit : cagr() renvoie null des
    // que l unite contient "%" (data.ts), la moyenne n existe QUE dans ce cas.
    if (options.avgPct) {
      const avgEl = document.createElementNS(NS, "text");
      avgEl.setAttribute("x", String(graphCx));
      avgEl.setAttribute("y", String(origY - PAD_TOP + 208));
      avgEl.setAttribute("text-anchor", "middle");
      avgEl.setAttribute("font-family", PNG_FONT_FAMILY);
      avgEl.setAttribute("font-size", "22");
      avgEl.setAttribute("font-weight", "500");
      avgEl.setAttribute("fill", subtitleColor);
      avgEl.textContent = `Moyenne : ${options.avgPct}`;
      clone.appendChild(avgEl);
    }
    if (options.cagr) {
      const CAGR_FONT_SIZE = 22;
      const rawCagr = options.cagr.replace(/^CAGR\s*/i, "").trim();
      // "(CAGR)" apres la valeur, petit espace avant. L acronyme CAGR est
      // identique dans toutes les langues du doc (FR/EN/DE/NL).
      const cagrText = `${rawCagr} (CAGR)`;
      const isNegative = /^[\u2212-]/.test(rawCagr) || /\s-\d/.test(` ${rawCagr}`);
      // Yann 1er sept 2026 v2 : sous les deux lignes EN (154/178), plus
      // jamais au milieu d elles.
      const cagrY = origY - PAD_TOP + 208;
      // Yann 25 aout 2026 : le bloc CAGR repasse CENTRE sous le titre du KPI
      // (avant : aligne a droite sur le logo du footer).

      const cagrEl = document.createElementNS(NS, "text");
      cagrEl.setAttribute("y", String(cagrY));
      cagrEl.setAttribute("text-anchor", "start");
      cagrEl.setAttribute("font-family", titleFontFamily);
      cagrEl.setAttribute("font-weight", "300");
      cagrEl.setAttribute("font-style", "normal");
      cagrEl.setAttribute("font-size", String(CAGR_FONT_SIZE));
      cagrEl.setAttribute("letter-spacing", "0.01em");
      cagrEl.setAttribute("fill", subtitleColor);
      cagrEl.textContent = cagrText;
      clone.appendChild(cagrEl);

      // Largeur reelle du texte pour poser la fleche juste a sa gauche.
      const cagrCtx = document.createElement("canvas").getContext("2d");
      let cagrTextW = cagrText.length * (CAGR_FONT_SIZE * 0.58);
      if (cagrCtx) {
        cagrCtx.font = `300 ${CAGR_FONT_SIZE}px ${PNG_FONT_FAMILY}`;
        cagrTextW = cagrCtx.measureText(cagrText).width;
      }
      // Bloc centre : [fleche][gap][texte] centre sur l axe du titre.
      const AR_GAP = 10;
      const midTitleX = graphCx;
      const blockW = 20 + AR_GAP + cagrTextW;
      const blockStartX = midTitleX - blockW / 2;
      cagrEl.setAttribute("x", String(blockStartX + 20 + AR_GAP));

      // Fleche pleine OBLIQUE (Yann 24 aout 2026) : penchee vers le haut a
      // droite si positif, vers le bas a droite si negatif. Fleche verticale
      // epaisse tournee de +/-45 degres autour de son centre.
      const AR_H = 26;
      const AR_W = 20;
      const arX = blockStartX;
      const arTop = cagrY - CAGR_FONT_SIZE + 2;
      const shaftW = AR_W * 0.36;
      const headH = AR_H * 0.5;
      const midX2 = arX + AR_W / 2;
      const midY2 = arTop + AR_H / 2;
      let d: string;
      if (!isNegative) {
        d = `M ${midX2} ${arTop}`
          + ` L ${arX + AR_W} ${arTop + headH}`
          + ` L ${midX2 + shaftW / 2} ${arTop + headH}`
          + ` L ${midX2 + shaftW / 2} ${arTop + AR_H}`
          + ` L ${midX2 - shaftW / 2} ${arTop + AR_H}`
          + ` L ${midX2 - shaftW / 2} ${arTop + headH}`
          + ` L ${arX} ${arTop + headH} Z`;
      } else {
        d = `M ${midX2} ${arTop + AR_H}`
          + ` L ${arX + AR_W} ${arTop + AR_H - headH}`
          + ` L ${midX2 + shaftW / 2} ${arTop + AR_H - headH}`
          + ` L ${midX2 + shaftW / 2} ${arTop}`
          + ` L ${midX2 - shaftW / 2} ${arTop}`
          + ` L ${midX2 - shaftW / 2} ${arTop + AR_H - headH}`
          + ` L ${arX} ${arTop + AR_H - headH} Z`;
      }
      // Yann 26 aout 2026 : la fleche passe d un aplat a un degrade oriente
      // dans son sens de lecture (clair a la pointe, profond a la base), avec
      // un liseré sombre tres fin et une ombre portee courte. Objectif :
      // qu elle ait l air posee sur le document, pas collee dessus. Les
      // teintes restent celles du produit (vert emeraude, rouge framboise).
      const gradId = `cagrArrow_${isNegative ? "neg" : "pos"}`;
      const shadowId = `${gradId}_shadow`;
      const defs = document.createElementNS(NS, "defs");
      const grad = document.createElementNS(NS, "linearGradient");
      grad.setAttribute("id", gradId);
      grad.setAttribute("x1", "0");
      grad.setAttribute("y1", isNegative ? "0" : "1");
      grad.setAttribute("x2", "0");
      grad.setAttribute("y2", isNegative ? "1" : "0");
      const stops: Array<[string, string]> = isNegative
        ? [["0%", "#9f1239"], ["55%", "#e11d48"], ["100%", "#fb7185"]]
        : [["0%", "#047857"], ["55%", "#10b981"], ["100%", "#6ee7b7"]];
      for (const [off, col] of stops) {
        const st = document.createElementNS(NS, "stop");
        st.setAttribute("offset", off);
        st.setAttribute("stop-color", col);
        grad.appendChild(st);
      }
      defs.appendChild(grad);
      const flt = document.createElementNS(NS, "filter");
      flt.setAttribute("id", shadowId);
      flt.setAttribute("x", "-50%");
      flt.setAttribute("y", "-50%");
      flt.setAttribute("width", "200%");
      flt.setAttribute("height", "200%");
      const drop = document.createElementNS(NS, "feDropShadow");
      drop.setAttribute("dx", "0");
      drop.setAttribute("dy", "1");
      drop.setAttribute("stdDeviation", "1.4");
      drop.setAttribute("flood-color", isNegative ? "#f43f5e" : "#10b981");
      drop.setAttribute("flood-opacity", "0.45");
      flt.appendChild(drop);
      defs.appendChild(flt);
      clone.appendChild(defs);

      const arrowEl = document.createElementNS(NS, "path");
      arrowEl.setAttribute("d", d);
      arrowEl.setAttribute("fill", `url(#${gradId})`);
      arrowEl.setAttribute("stroke", isNegative ? "#4c0519" : "#022c22");
      arrowEl.setAttribute("stroke-width", "0.7");
      arrowEl.setAttribute("stroke-opacity", "0.55");
      arrowEl.setAttribute("stroke-linejoin", "round");
      arrowEl.setAttribute("filter", `url(#${shadowId})`);
      // +45 deg (horaire) = pointe vers le haut-droite ; -45 deg = bas-droite.
      arrowEl.setAttribute(
        "transform",
        `rotate(${isNegative ? -45 : 45} ${midX2} ${midY2})`
      );
      clone.appendChild(arrowEl);
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
    // Yann 8 août 2026 : le regex ne couvrait que le préfixe FR "T". Graph
    // basculé EN (labels "Q1 26") ou séries semestrielles ("S1 26"/"H1 26") :
    // aucun groupe créé, donc AUCUNE année sous l'axe X en mode Max.
    const m = labels[i]?.match(/^(?:[TQ][1-4]|[SH][12])\s+(\d{2,4})$/);
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
