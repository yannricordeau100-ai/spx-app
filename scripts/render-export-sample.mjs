/**
 * Render un PNG d'exemple du chart Mettrik AI tel qu'il serait téléchargé
 * (avec watermark Mettrik.AI top-right, gradient iridescent).
 *
 * Reproduit la sortie de src/lib/chart-export.ts à l'identique :
 *   - background opaque #050505
 *   - mini-logo "small" caché
 *   - watermark "Mettrik.AI" top-right, font-size 56, opacity 0.55,
 *     gradient blanc → violet → cyan → rose (italic Fraunces fallback Georgia)
 *   - rendu via sharp à 2× pour qualité retina
 *
 * Sortie : ~/Downloads/mettrik-chart-watermark-preview.png
 */
import sharp from "sharp";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const W = 920;
const H = 420;

// Charte Mettrik AI : fond noir + courbe néon bleue + watermark top-right.
// Reproduit les éléments visuels essentiels d'un chart curve.
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="cv-wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
    </linearGradient>
    <filter id="cv-glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
    <linearGradient id="mettrik-watermark-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="30%" stop-color="#d8d8e4"/>
      <stop offset="55%" stop-color="#a855f7"/>
      <stop offset="78%" stop-color="#22d3ee"/>
      <stop offset="100%" stop-color="#f472b6"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="#050505"/>

  <!-- Y axis grid -->
  <line x1="96" x2="850" y1="80" y2="80" stroke="#1a1a1a" stroke-dasharray="3 6"/>
  <line x1="96" x2="850" y1="160" y2="160" stroke="#1a1a1a" stroke-dasharray="3 6"/>
  <line x1="96" x2="850" y1="240" y2="240" stroke="#1a1a1a" stroke-dasharray="3 6"/>
  <line x1="96" x2="850" y1="320" y2="320" stroke="#1a1a1a" stroke-dasharray="3 6"/>

  <!-- Y labels -->
  <text x="84" y="85" text-anchor="end" fill="#e4e4e7" font-family="ui-monospace, monospace" font-size="16">400</text>
  <text x="84" y="165" text-anchor="end" fill="#e4e4e7" font-family="ui-monospace, monospace" font-size="16">300</text>
  <text x="84" y="245" text-anchor="end" fill="#e4e4e7" font-family="ui-monospace, monospace" font-size="16">200</text>
  <text x="84" y="325" text-anchor="end" fill="#e4e4e7" font-family="ui-monospace, monospace" font-size="16">100</text>

  <!-- Wall under curve -->
  <path d="M 96,260 Q 200,255 320,240 Q 450,210 580,170 Q 700,130 850,100 L 850,330 L 96,330 Z" fill="url(#cv-wall)"/>

  <!-- Curve glow back -->
  <path d="M 96,260 Q 200,255 320,240 Q 450,210 580,170 Q 700,130 850,100"
        fill="none" stroke="#3b82f6" stroke-width="6" stroke-opacity="0.55" filter="url(#cv-glow)"/>
  <!-- Curve front -->
  <path d="M 96,260 Q 200,255 320,240 Q 450,210 580,170 Q 700,130 850,100"
        fill="none" stroke="#ffffff" stroke-width="2"/>

  <!-- Data points -->
  ${[[96,260],[170,257],[245,251],[320,240],[395,225],[470,205],[545,180],[620,155],[695,130],[770,115],[850,100]]
    .map(([x,y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#ffffff"/><circle cx="${x}" cy="${y}" r="6" fill="#3b82f6" fill-opacity="0.55" filter="url(#cv-glow)"/>`)
    .join("")}

  <!-- X axis labels (quarters) -->
  ${["T1","T2","T3","T4","T1","T2","T3","T4","T1","T2","T3"]
    .map((q, i) => `<text x="${96 + i * 75.4}" y="360" text-anchor="middle" fill="#e4e4e7" font-family="ui-monospace, monospace" font-size="14" font-weight="600">${q}</text>`)
    .join("")}

  <!-- Year band -->
  <line x1="96" y1="380" x2="320" y2="380" stroke="#3f3f46"/>
  <line x1="96" y1="376" x2="96" y2="380" stroke="#3f3f46"/>
  <line x1="320" y1="376" x2="320" y2="380" stroke="#3f3f46"/>
  <text x="208" y="394" text-anchor="middle" fill="#a1a1aa" font-family="ui-monospace, monospace" font-size="13">2023</text>
  <line x1="396" y1="380" x2="620" y2="380" stroke="#3f3f46"/>
  <line x1="396" y1="376" x2="396" y2="380" stroke="#3f3f46"/>
  <line x1="620" y1="376" x2="620" y2="380" stroke="#3f3f46"/>
  <text x="508" y="394" text-anchor="middle" fill="#a1a1aa" font-family="ui-monospace, monospace" font-size="13">2024</text>
  <line x1="696" y1="380" x2="850" y2="380" stroke="#3f3f46"/>
  <line x1="696" y1="376" x2="696" y2="380" stroke="#3f3f46"/>
  <line x1="850" y1="376" x2="850" y2="380" stroke="#3f3f46"/>
  <text x="773" y="394" text-anchor="middle" fill="#a1a1aa" font-family="ui-monospace, monospace" font-size="13">2025</text>

  <!-- Unité axe Y dans le SVG (apparaît dans l'export) -->
  <text x="96" y="22" font-size="13" font-weight="600" fill="#e4e4e7" font-family="ui-monospace, monospace">en M</text>

  <!-- Watermark Mettrik•AI top-right (download only) : font-size 28, blanc,
       design dot = cercle blanc plein entre Mettrik et AI -->
  <g opacity="0.92">
    <text x="${W - 14}" y="28" text-anchor="end" font-family="Georgia, serif" font-style="italic" font-weight="800" font-size="28" letter-spacing="-0.04em" fill="#ffffff">AI</text>
    <circle cx="${W - 14 - 28 * 0.95 - 5 - 3.2}" cy="${28 - 28 * 0.32}" r="3.2" fill="#ffffff"/>
    <text x="${W - 14 - 28 * 0.95 - 5 - 3.2 - 3.2 - 5}" y="28" text-anchor="end" font-family="Georgia, serif" font-style="italic" font-weight="800" font-size="28" letter-spacing="-0.04em" fill="#ffffff">Mettrik</text>
  </g>
</svg>`;

const out = path.join(os.homedir(), "Downloads", "mettrik-chart-watermark-preview.png");
await sharp(Buffer.from(svg))
  .resize(W * 2, H * 2)  // 2× pour retina
  .png()
  .toFile(out);

console.log("✅ PNG sauvé :", out);
console.log("   Dimensions :", W * 2, "×", H * 2, "px");
console.log("   Taille :", Math.round(fs.statSync(out).size / 1024), "KB");
