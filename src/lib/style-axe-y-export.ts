/**
 * Export PNG et style d axe Y (14 oct 2026, decision de Yann : « le PNG
 * telecharge devra suivre le style choisi »).
 *
 * src/lib/chart-export.ts force Avenir graisse 300 sur tous les textes du
 * clone. Les ecritures de l axe marquees data-axe-y (styles A a G) gardent ici
 * leur police, leurs reglages (axes variables) et leur graisse :
 *   - graphiques des fiches : la police vient de next/font (variable CSS
 *     --font-axe-x) ; un SVG rendu en image ne peut pas charger d URL externe,
 *     la police est donc lue puis embarquee en data URL dans le clone ;
 *   - KPI moyen terme : le SVG porte deja sa police (@font-face MtAxe* en
 *     base64), seule la famille est remise (data-axe-y-famille).
 * Style « actuel » : aucune marque, rien ne change.
 */
import { STYLES_AXE_Y, type IdStyleAxeY } from "./style-axe-y";

const MARQUE = "data-axe-y-garde";

/**
 * Appele dans la boucle qui force Avenir : remet la police du style sur un
 * texte marque. Renvoie true si le texte garde son style (la graisse aussi).
 */
export function garderStyleAxeYExport(t: SVGTextElement): boolean {
  if (!t.hasAttribute("data-axe-y")) return false;
  const famMt = t.getAttribute("data-axe-y-famille");
  if (famMt) {
    // SVG moyen terme : police deja embarquee dans le fichier.
    t.setAttribute("font-family", `${famMt}, sans-serif`);
    t.setAttribute(MARQUE, "mt");
    return true;
  }
  const id = t.getAttribute("data-axe-y-style") as IdStyleAxeY | null;
  if (!id || !STYLES_AXE_Y[id] || id === "actuel") return false;
  t.setAttribute(MARQUE, id);
  // Taille avant l agrandissement des axes de l export (plaque D, repere G).
  t.setAttribute("data-axe-y-fs", t.getAttribute("font-size") || "");
  return true;
}

async function enDataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const b = await r.blob();
    return await new Promise((ok) => {
      const fr = new FileReader();
      fr.onload = () => ok(typeof fr.result === "string" ? fr.result : null);
      fr.onerror = () => ok(null);
      fr.readAsDataURL(b);
    });
  } catch {
    return null;
  }
}

function premiereFamille(v: string): string {
  return (v.split(",")[0] || "").trim().replace(/^["']|["']$/g, "");
}

/** Regles @font-face du document pour une famille (sources woff2 en URL). */
function sourcesFamille(famille: string): { src: string; unicodeRange: string }[] {
  const out: { src: string; unicodeRange: string }[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let regles: CSSRuleList | null = null;
    try {
      regles = sheet.cssRules;
    } catch {
      regles = null;
    }
    if (!regles) continue;
    for (const r of Array.from(regles)) {
      if (!(r instanceof CSSFontFaceRule)) continue;
      if (premiereFamille(r.style.getPropertyValue("font-family")) !== famille) continue;
      const m = r.style.getPropertyValue("src").match(/url\(["']?([^"')]+)["']?\)/);
      if (m) out.push({ src: m[1], unicodeRange: r.style.getPropertyValue("unicode-range") || "" });
    }
  }
  return out;
}

/**
 * Apres l agrandissement des axes : embarque les polices des styles gardes et
 * remet chaque texte (et sa plaque / son repere) a l echelle.
 */
export async function embarquerStyleAxeYExport(clone: SVGSVGElement, original: SVGSVGElement, isLight: boolean): Promise<void> {
  const NS = "http://www.w3.org/2000/svg";
  const gardes = Array.from(clone.querySelectorAll<SVGTextElement>(`text[${MARQUE}]`));
  if (gardes.length === 0) return;
  const ids = new Set(gardes.map((t) => t.getAttribute(MARQUE)).filter((x): x is IdStyleAxeY => !!x && x !== "mt"));
  const css: string[] = [];
  for (const id of ids) {
    const s = STYLES_AXE_Y[id];
    const variable = s.graduation.variableCss ?? (["A", "B", "C"].includes(id) ? `--font-axe-${id.toLowerCase()}` : "");
    if (!variable) continue;
    const valeur = getComputedStyle(original).getPropertyValue(variable) || getComputedStyle(document.documentElement).getPropertyValue(variable);
    const famille = premiereFamille(valeur);
    if (!famille) continue;
    const nom = `MtAxeExport${id}`;
    for (const { src, unicodeRange } of sourcesFamille(famille)) {
      const data = await enDataUrl(src);
      if (!data) continue;
      css.push(`@font-face{font-family:${nom};src:url(${data}) format("woff2");font-weight:100 900;font-style:normal;${unicodeRange ? `unicode-range:${unicodeRange};` : ""}}`);
    }
    for (const t of gardes.filter((x) => x.getAttribute(MARQUE) === id)) {
      t.style.setProperty("font-family", `${nom}, sans-serif`);
    }
  }
  if (css.length) {
    const st = document.createElementNS(NS, "style");
    st.textContent = css.join("\n");
    clone.insertBefore(st, clone.firstChild);
  }
  // Plaque (D) et repere (G) : suivent l agrandissement de leur texte.
  clone.querySelectorAll<SVGRectElement>('rect[data-axe-y="cartouche"],rect[data-axe-y="repere"]').forEach((r) => {
    const t = r.parentElement?.querySelector<SVGTextElement>(`text[${MARQUE}]`);
    if (!t) return;
    const f0 = parseFloat(t.getAttribute("data-axe-y-fs") || "0");
    const f1 = parseFloat(t.getAttribute("font-size") || "0");
    if (!f0 || !f1 || Math.abs(f1 - f0) < 0.01) return;
    const k = f1 / f0;
    const ax = parseFloat(t.getAttribute("x") || "0");
    const ay = parseFloat(t.getAttribute("y") || "0");
    const x = parseFloat(r.getAttribute("x") || "0");
    const y = parseFloat(r.getAttribute("y") || "0");
    r.setAttribute("x", String(ax + (x - ax) * k));
    r.setAttribute("y", String(ay + (y - ay) * k));
    r.setAttribute("width", String(parseFloat(r.getAttribute("width") || "0") * k));
    r.setAttribute("height", String(parseFloat(r.getAttribute("height") || "0") * k));
  });
  // Theme clair : l unite ecrite avec la graduation du haut (E) suit les axes.
  if (isLight) {
    clone.querySelectorAll('tspan[data-axe-y="unite"]').forEach((u) => u.setAttribute("fill", "#4b5563"));
  }
}
