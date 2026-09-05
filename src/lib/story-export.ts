/**
 * Export PNG d'un écran de story (30 août 2026, refonte 6 sept 2026).
 *
 * Même philosophie que chart-export : on ne capture pas le DOM, on REDESSINE
 * la carte en SVG puis on la rastérise. Rendu identique pour tous,
 * indépendant du navigateur et du zoom.
 *
 * Refonte du 6 sept 2026 :
 *  - format iPhone 9:16 (1080 x 1920), coins arrondis ;
 *  - en tête : logo de la société dans une tuile arrondie (même règle de fond
 *    que la page société : blanc pour les logos sombres, noir sinon) + nom
 *    de la société, ticker en dessous, comme l export des KPI du bloc hero ;
 *  - fond travaillé : dégradé profond, deux halos (accent en haut à droite,
 *    violet Mettrik en bas à gauche), balayage lumineux diagonal, trame
 *    fine et grain léger ;
 *  - encadré du signal dessiné : cadre à liseré dégradé, barre d accent,
 *    pastille « Signal » sur le bord, coin lumineux ;
 *  - signature « KPIs Powered by » + logo Mettrik.
 */

import { logoNeedsLightBg } from "@/components/logos";

const PNG_FONT =
  '"Avenir", "Avenir Next", "Manrope", "Nunito Sans", -apple-system, sans-serif';

const W = 1080;
const H = 1920;
const M = 84; // marge latérale
const VIOLET = "#7c3aed";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Word-wrap par mesure réelle. */
function wrap(text: string, font: string, maxW: number): string[] {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return [text];
  ctx.font = font;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const cand = line ? `${line} ${w}` : w;
    if (ctx.measureText(cand).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = cand;
  }
  if (line) lines.push(line);
  return lines;
}

function mesure(text: string, font: string): number {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return text.length * 20;
  ctx.font = font;
  return ctx.measureText(text).width;
}

async function blobEnDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}

/**
 * Logo de la société : même stratégie que l export des graphs
 * (DOM `[data-logo]` de l en-tête, sinon `/logos/<TICKER>.png`, rejet des
 * images de moins de 64 px).
 */
async function chargerLogoSociete(ticker: string): Promise<string | null> {
  try {
    const wrapper = document.querySelector('[data-logo="true"]');
    if (wrapper) {
      const svg = wrapper.querySelector("svg");
      const img = wrapper.querySelector("img");
      if (svg) {
        const clone = svg.cloneNode(true) as SVGElement;
        if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        const xml = new XMLSerializer().serializeToString(clone);
        return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
      }
      if (img instanceof HTMLImageElement && img.naturalWidth >= 64) {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          return c.toDataURL("image/png");
        }
      }
    }
    const blob = await fetch(`/logos/${ticker.toUpperCase()}.png`).then((r) =>
      r.ok ? r.blob() : Promise.reject(),
    );
    const dataUrl = await blobEnDataUrl(blob);
    const probe = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = dataUrl;
    });
    return probe.naturalWidth >= 64 ? dataUrl : null;
  } catch {
    return null;
  }
}

export async function downloadStoryAsPng(opts: {
  ticker: string;
  companyName: string;
  title: string;
  period?: string | null;
  value: string;
  unit?: string | null;
  signal?: string | null;
  accent: string;
}): Promise<void> {
  const { ticker, companyName, title, period, value, unit, signal, accent } = opts;

  const titreLignes = wrap(title, `700 68px ${PNG_FONT}`, W - 2 * M).slice(0, 3);
  const signalLignes = signal ? wrap(signal, `500 38px ${PNG_FONT}`, W - 2 * M - 150).slice(0, 6) : [];

  // Taille du chiffre : ajustée par mesure pour tenir dans la largeur.
  let valSize = 240;
  for (; valSize > 70; valSize -= 10) {
    if (mesure(value, `800 ${valSize}px ${PNG_FONT}`) <= W - 2 * M) break;
  }

  const [logoSte, logoMettrik] = await Promise.all([
    chargerLogoSociete(ticker),
    fetch("/brand/mettrik-ai-white-purple.png")
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then(blobEnDataUrl)
      .catch(() => ""),
  ]);

  // Nom de la société : réduit jusqu à tenir à côté du logo.
  const TUILE = 96;
  const GAP = 28;
  let nomSize = 52;
  const largeurNom = W - 2 * M - (logoSte ? TUILE + GAP : 0);
  while (nomSize > 30 && mesure(companyName, `600 ${nomSize}px ${PNG_FONT}`) > largeurNom) nomSize -= 2;

  const p: string[] = [];
  p.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  p.push(`<defs>
    <clipPath id="carte"><rect width="${W}" height="${H}" rx="88"/></clipPath>
    <linearGradient id="fond" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#14141c"/><stop offset="45%" stop-color="#0b0b10"/><stop offset="100%" stop-color="#050507"/>
    </linearGradient>
    <radialGradient id="haloAccent" cx="0.92" cy="0.06" r="0.62">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.62"/><stop offset="45%" stop-color="${accent}" stop-opacity="0.16"/><stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="haloViolet" cx="0.06" cy="0.96" r="0.58">
      <stop offset="0%" stop-color="${VIOLET}" stop-opacity="0.42"/><stop offset="50%" stop-color="${VIOLET}" stop-opacity="0.10"/><stop offset="100%" stop-color="${VIOLET}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="balayage" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/><stop offset="42%" stop-color="#ffffff" stop-opacity="0"/><stop offset="50%" stop-color="#ffffff" stop-opacity="0.045"/><stop offset="58%" stop-color="#ffffff" stop-opacity="0"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <pattern id="trame" width="54" height="54" patternUnits="userSpaceOnUse">
      <path d="M 54 0 L 0 0 0 54" fill="none" stroke="#ffffff" stroke-opacity="0.035" stroke-width="1"/>
    </pattern>
    <radialGradient id="voile" cx="0.5" cy="0.5" r="0.75">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/><stop offset="100%" stop-color="#000000" stop-opacity="0.55"/>
    </radialGradient>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="bruit"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.06"/></feComponentTransfer>
    </filter>
    <linearGradient id="chiffre" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/><stop offset="60%" stop-color="#ede9fe"/><stop offset="100%" stop-color="#c4b5fd"/>
    </linearGradient>
    <linearGradient id="liseré" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.95"/><stop offset="55%" stop-color="#ffffff" stop-opacity="0.22"/><stop offset="100%" stop-color="${VIOLET}" stop-opacity="0.9"/>
    </linearGradient>
    <linearGradient id="barre" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${accent}"/><stop offset="100%" stop-color="${VIOLET}"/>
    </linearGradient>
    <linearGradient id="filet" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0"/><stop offset="30%" stop-color="${accent}" stop-opacity="0.9"/><stop offset="70%" stop-color="${VIOLET}" stop-opacity="0.9"/><stop offset="100%" stop-color="${VIOLET}" stop-opacity="0"/>
    </linearGradient>
    <filter id="lueur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
  </defs>`);

  // ── Fond ──
  p.push(`<g clip-path="url(#carte)">`);
  p.push(`<rect width="${W}" height="${H}" fill="url(#fond)"/>`);
  p.push(`<rect width="${W}" height="${H}" fill="url(#trame)"/>`);
  p.push(`<rect width="${W}" height="${H}" fill="url(#haloAccent)"/>`);
  p.push(`<rect width="${W}" height="${H}" fill="url(#haloViolet)"/>`);
  p.push(`<rect width="${W}" height="${H}" fill="url(#balayage)"/>`);
  // Grands arcs décoratifs, très discrets
  p.push(`<circle cx="${W + 120}" cy="-80" r="620" fill="none" stroke="${accent}" stroke-opacity="0.14" stroke-width="2"/>`);
  p.push(`<circle cx="${W + 120}" cy="-80" r="760" fill="none" stroke="${accent}" stroke-opacity="0.07" stroke-width="2"/>`);
  p.push(`<circle cx="-140" cy="${H + 120}" r="560" fill="none" stroke="${VIOLET}" stroke-opacity="0.12" stroke-width="2"/>`);
  p.push(`<rect width="${W}" height="${H}" fill="url(#voile)"/>`);
  p.push(`<rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.9"/>`);
  p.push(`</g>`);
  p.push(`<rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="86" fill="none" stroke="#ffffff" stroke-opacity="0.10" stroke-width="2"/>`);

  // ── En-tête : logo + nom + ticker ──
  const enTeteY = 150;
  let nomX = M;
  if (logoSte) {
    const clair = logoNeedsLightBg(ticker);
    p.push(`<clipPath id="logoClip"><rect x="${M}" y="${enTeteY}" width="${TUILE}" height="${TUILE}" rx="22"/></clipPath>`);
    p.push(`<rect x="${M}" y="${enTeteY}" width="${TUILE}" height="${TUILE}" rx="22" fill="${clair ? "#ffffff" : "#0a0a0a"}" stroke="${clair ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.12)"}" stroke-width="1.5"/>`);
    p.push(`<image x="${M + 12}" y="${enTeteY + 12}" width="${TUILE - 24}" height="${TUILE - 24}" preserveAspectRatio="xMidYMid meet" clip-path="url(#logoClip)" href="${logoSte}"/>`);
    nomX = M + TUILE + GAP;
  }
  p.push(`<text x="${nomX}" y="${enTeteY + 44}" font-family='${PNG_FONT}' font-size="${nomSize}" font-weight="600" fill="#fafafa">${esc(companyName)}</text>`);
  p.push(`<text x="${nomX}" y="${enTeteY + 84}" font-family='${PNG_FONT}' font-size="30" font-weight="600" letter-spacing="3" fill="#a1a1aa">${esc(ticker.toUpperCase())}</text>`);

  // Filet lumineux sous l en-tête
  p.push(`<rect x="${M}" y="${enTeteY + 128}" width="${W - 2 * M}" height="2" fill="url(#filet)"/>`);

  // ── Titre ──
  const titreY = 400;
  titreLignes.forEach((l, i) => {
    p.push(`<text x="${M}" y="${titreY + i * 84}" font-family='${PNG_FONT}' font-size="68" font-weight="700" fill="#fafafa">${esc(l)}</text>`);
  });
  if (period) {
    p.push(`<text x="${M}" y="${titreY + titreLignes.length * 84 + 10}" font-family='${PNG_FONT}' font-size="34" font-weight="500" fill="#71717a">${esc(period)}</text>`);
  }

  // ── Chiffre + unité, centrés ──
  const valY = 1010;
  p.push(`<text x="${W / 2}" y="${valY}" text-anchor="middle" font-family='${PNG_FONT}' font-size="${valSize}" font-weight="800" fill="${accent}" opacity="0.35" filter="url(#lueur)">${esc(value)}</text>`);
  p.push(`<text x="${W / 2}" y="${valY}" text-anchor="middle" font-family='${PNG_FONT}' font-size="${valSize}" font-weight="800" fill="url(#chiffre)">${esc(value)}</text>`);
  if (unit) {
    p.push(`<text x="${W / 2}" y="${valY + 92}" text-anchor="middle" font-family='${PNG_FONT}' font-size="54" font-weight="700" fill="#e4e4e7">${esc(unit)}</text>`);
  }

  // ── Encadré du signal ──
  if (signalLignes.length > 0) {
    const LH = 54;
    const boxH = signalLignes.length * LH + 96;
    const boxY = H - 230 - boxH;
    const boxX = M - 14;
    const boxW = W - 2 * boxX;
    // ombre portée douce
    p.push(`<rect x="${boxX}" y="${boxY + 10}" width="${boxW}" height="${boxH}" rx="34" fill="#000000" fill-opacity="0.5" filter="url(#lueur)"/>`);
    // corps
    p.push(`<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="34" fill="#0c0c12" fill-opacity="0.82"/>`);
    // liseré dégradé
    p.push(`<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="34" fill="none" stroke="url(#liseré)" stroke-width="2.5"/>`);
    // coin lumineux en haut à droite
    p.push(`<path d="M ${boxX + boxW - 140} ${boxY + 1.5} H ${boxX + boxW - 34} a 32 32 0 0 1 32 32 V ${boxY + 140}" fill="none" stroke="${accent}" stroke-opacity="0.9" stroke-width="4" stroke-linecap="round"/>`);
    // barre d accent verticale
    p.push(`<rect x="${boxX + 34}" y="${boxY + 52}" width="6" height="${boxH - 104}" rx="3" fill="url(#barre)"/>`);
    // pastille « Signal » sur le bord supérieur
    const pastilleW = 150;
    p.push(`<rect x="${boxX + 48}" y="${boxY - 22}" width="${pastilleW}" height="44" rx="22" fill="#0c0c12" stroke="url(#liseré)" stroke-width="2"/>`);
    p.push(`<circle cx="${boxX + 76}" cy="${boxY}" r="6" fill="${accent}"/>`);
    p.push(`<text x="${boxX + 94}" y="${boxY + 10}" font-family='${PNG_FONT}' font-size="26" font-weight="700" letter-spacing="2" fill="#e4e4e7">SIGNAL</text>`);
    signalLignes.forEach((l, i) => {
      p.push(`<text x="${boxX + 70}" y="${boxY + 66 + i * LH}" font-family='${PNG_FONT}' font-size="38" font-weight="500" fill="#f4f4f5">${esc(l)}</text>`);
    });
  }

  // ── Signature ──
  const sigY = H - 92;
  p.push(`<text x="${logoMettrik ? W - M - 240 : W - M}" y="${sigY}" text-anchor="end" font-family='${PNG_FONT}' font-size="32" fill="#d4d4d8" opacity="0.9">KPIs Powered by</text>`);
  if (logoMettrik) {
    p.push(`<image x="${W - M - 228}" y="${sigY - 44}" width="228" height="64" preserveAspectRatio="xMinYMid meet" href="${logoMettrik}"/>`);
  }
  p.push(`</svg>`);

  const svg = p.join("");
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = rej;
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = W * 2;
  canvas.height = H * 2;
  const c2 = canvas.getContext("2d");
  if (!c2) return;
  c2.scale(2, 2);
  c2.drawImage(img, 0, 0, W, H);
  URL.revokeObjectURL(url);
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/png"));
  if (!blob) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `mettrik-story-${ticker.toLowerCase()}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.png`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }, 100);
}
