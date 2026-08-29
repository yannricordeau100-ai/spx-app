/**
 * Export PNG d'un écran de story (Yann 30 août 2026).
 *
 * Même philosophie que chart-export : on ne capture pas le DOM, on REDESSINE
 * la carte en SVG (fond dégradé sombre, halo accent, titre, chiffre géant,
 * unité, signal, signature Mettrik) puis on la rastérise. Rendu identique
 * pour tous, indépendant du navigateur et du zoom.
 */

const PNG_FONT =
  '"Avenir", "Avenir Next", "Manrope", "Nunito Sans", -apple-system, sans-serif';

const W = 1080;
const H = 1620;

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

  const titreLignes = wrap(title, `700 64px ${PNG_FONT}`, W - 160).slice(0, 3);
  const signalLignes = signal ? wrap(signal, `500 40px ${PNG_FONT}`, W - 220).slice(0, 5) : [];

  // Taille du chiffre : ajustée par mesure pour tenir dans la largeur.
  const ctx = document.createElement("canvas").getContext("2d");
  let valSize = 210;
  if (ctx) {
    for (; valSize > 60; valSize -= 10) {
      ctx.font = `800 ${valSize}px ${PNG_FONT}`;
      if (ctx.measureText(value).width <= W - 180) break;
    }
  }

  // Logo Mettrik (même signature que l export des graphs).
  let logo = "";
  try {
    const blob = await fetch("/brand/mettrik-ai-white-purple.png").then((r) =>
      r.ok ? r.blob() : Promise.reject(),
    );
    logo = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  } catch {
    /* signature texte seule */
  }

  const titreY = 300;
  const valY = H / 2 + valSize / 3 - 40;
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  parts.push(`<defs>
    <linearGradient id="fond" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#101015"/><stop offset="55%" stop-color="#0a0a0e"/><stop offset="100%" stop-color="#060608"/>
    </linearGradient>
    <linearGradient id="chiffre" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#fafafa"/><stop offset="100%" stop-color="#c4b5fd"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.85" cy="0.08" r="0.5">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.5"/><stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>`);
  parts.push(`<rect width="${W}" height="${H}" rx="72" fill="url(#fond)"/>`);
  parts.push(`<rect width="${W}" height="${H}" rx="72" fill="url(#halo)"/>`);
  parts.push(`<rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="70" fill="none" stroke="#2a2a33" stroke-width="2"/>`);
  // Société
  parts.push(`<text x="80" y="150" font-family='${PNG_FONT}' font-size="42" font-weight="600" fill="#a1a1aa">${esc(companyName)} · ${esc(ticker)}</text>`);
  // Titre
  titreLignes.forEach((l, i) => {
    parts.push(`<text x="80" y="${titreY + i * 78}" font-family='${PNG_FONT}' font-size="64" font-weight="700" fill="#fafafa">${esc(l)}</text>`);
  });
  if (period) {
    parts.push(`<text x="80" y="${titreY + titreLignes.length * 78 + 14}" font-family='${PNG_FONT}' font-size="36" font-weight="500" fill="#71717a">${esc(period)}</text>`);
  }
  // Chiffre + unité, centrés
  parts.push(`<text x="${W / 2}" y="${valY}" text-anchor="middle" font-family='${PNG_FONT}' font-size="${valSize}" font-weight="800" fill="url(#chiffre)">${esc(value)}</text>`);
  if (unit) {
    parts.push(`<text x="${W / 2}" y="${valY + 96}" text-anchor="middle" font-family='${PNG_FONT}' font-size="56" font-weight="700" fill="#e4e4e7">${esc(unit)}</text>`);
  }
  // Signal en bas, encadré
  if (signalLignes.length > 0) {
    const boxH = signalLignes.length * 56 + 70;
    const boxY = H - 200 - boxH;
    parts.push(`<rect x="70" y="${boxY}" width="${W - 140}" height="${boxH}" rx="28" fill="#000000" fill-opacity="0.45" stroke="#ffffff22"/>`);
    signalLignes.forEach((l, i) => {
      parts.push(`<text x="105" y="${boxY + 62 + i * 56}" font-family='${PNG_FONT}' font-size="40" font-weight="500" fill="#f4f4f5">${esc(l)}</text>`);
    });
  }
  // Signature
  parts.push(`<text x="${logo ? W - 320 : W - 90}" y="${H - 78}" text-anchor="end" font-family='${PNG_FONT}' font-size="34" fill="#d4d4d8" opacity="0.9">KPIs Powered by</text>`);
  if (logo) {
    parts.push(`<image x="${W - 305}" y="${H - 122}" width="230" height="64" preserveAspectRatio="xMinYMid meet" href="${logo}"/>`);
  }
  parts.push(`</svg>`);

  const svg = parts.join("");
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
