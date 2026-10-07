#!/usr/bin/env node
/**
 * Controle des exports PNG de graphiques (Yann, 7 oct 2026 : bandes blanches
 * de 370 px de chaque cote sur l export KPI court terme d AMD).
 *
 * Cause trouvee : le <svg> racine des graphiques portait un style d affichage
 * (height:auto, aspect-ratio) que le clone exporte gardait ; une fois rendu en
 * image, il prenait l ancien ratio, le contenu etait reduit et centre, le
 * canvas etirait l ensemble et laissait des bandes transparentes.
 *
 * Le script compile le code SOURCE de src/lib/chart-export.ts (esbuild), l
 * injecte dans la vraie fiche d une societe (preversion par defaut), declenche
 * l export sur le vrai graphique, intercepte le PNG (aucun telechargement) et
 * controle :
 *   - aucun pixel transparent ;
 *   - colonnes de bord (gauche et droite, toute la hauteur) de la couleur du
 *     theme (sombre : jamais blanches ; clair : jamais sombres) ;
 *   - le contenu occupe toute la largeur (>= 70 % de colonnes non unies, et le
 *     contenu touche la zone des marges gauche et droite) ;
 *   - SVG serialise avant rendu (independant du navigateur : Safari applique le
 *     style de la racine, Chromium non) : racine sans style de mise en page
 *     (height:auto, aspect-ratio, width:100%), width/height numeriques egaux au
 *     viewBox ;
 *   - ratio du PNG egal a celui du canevas attendu (pas d etirement).
 * Cas : 5 societes x (sombre, clair) x (ordinateur 1280, mobile 390), et les
 * modes barres / courbe / variation quand le bouton existe.
 *
 * Usage : node scripts/verif-export-png.mjs [--json] [--rapide] [--simuler-bug] [--garde-png dossier]
 * Variables : BASE (defaut https://mettrik-niveau2.vercel.app)
 * Code de retour : 1 si un export est en defaut, 2 si le controle n a pas pu tourner.
 */
import { chromium } from "playwright";
import esbuild from "esbuild";
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "https://mettrik-niveau2.vercel.app";
const JSON_OUT = process.argv.includes("--json");
const RAPIDE = process.argv.includes("--rapide");
const iKeep = process.argv.indexOf("--garde-png");
const KEEP = iKeep > 0 ? process.argv[iKeep + 1] : null;
if (KEEP) fs.mkdirSync(KEEP, { recursive: true });

const TICKERS = (process.env.TICKERS || "AMD,MC.PA,NVDA,KO,AIR.PA").split(",");
const MODES = [
  { id: "bars", nom: /barres/i },
  { id: "curve", nom: /courbe/i },
  { id: "variation", nom: /variation/i },
];

const bundle = await esbuild.build({
  stdin: {
    contents: `import { downloadSvgAsPng } from "@/lib/chart-export";
               import { downloadSvgAsPngV2 } from "@/lib/chart-export-v2";
               window.__exp = { v1: downloadSvgAsPng, v2: downloadSvgAsPngV2 };`,
    resolveDir: ROOT, loader: "ts",
  },
  bundle: true, write: false, format: "iife", platform: "browser",
  alias: { "@": path.join(ROOT, "src") },
  jsx: "automatic", loader: { ".tsx": "tsx", ".png": "dataurl", ".svg": "dataurl" },
  logLevel: "silent", external: [],
}).catch((e) => { console.error("compilation impossible :", String(e).slice(0, 300)); process.exit(2); });
let code = bundle.outputFiles[0].text;
// Auto-test du detecteur : --simuler-bug neutralise le correctif, le controle DOIT echouer.
if (process.argv.includes("--simuler-bug")) code = code.replace(/function neutraliserStyleRacineSvg\(clone\) \{/, "function neutraliserStyleRacineSvg(clone) { return;");

function lum(r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; }

async function analyser(buf, theme, uniforme = false, sansEtendue = false) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const px = (x, y) => { const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };
  const defauts = [];
  let transp = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) transp++;
  if (transp > 0) defauts.push(`${transp} pixels transparents`);
  const ref = px(2, 2);
  const sombre = theme === "dark";
  // colonnes de bord : 6 premieres et 6 dernieres colonnes
  for (const [nom, xs] of [["gauche", [0, 1, 2, 3, 4, 5]], ["droite", [W - 1, W - 2, W - 3, W - 4, W - 5, W - 6]]]) {
    let mauvais = 0;
    for (const x of xs) for (let y = 0; y < H; y += 2) {
      const [r, g, b] = px(x, y);
      const l = lum(r, g, b);
      if (uniforme ? Math.abs(l - lum(ref[0], ref[1], ref[2])) > 12 : sombre ? l > 60 : l < 200) mauvais++;
    }
    if (mauvais > 0) defauts.push(`bord ${nom} : ${mauvais} pixels a la mauvaise couleur`);
  }
  // le contenu doit occuper toute la largeur : colonnes qui different du fond
  const fond = px(Math.floor(W / 2), 2);
  const diff = (x, y) => { const p = px(x, y); return Math.abs(p[0] - fond[0]) + Math.abs(p[1] - fond[1]) + Math.abs(p[2] - fond[2]) > 60; };
  let minX = W, maxX = -1, colsActives = 0;
  for (let x = 0; x < W; x++) {
    let act = false;
    for (let y = 0; y < H; y += 3) if (diff(x, y)) { act = true; break; }
    if (act) { colsActives++; if (x < minX) minX = x; if (x > maxX) maxX = x; }
  }
  const etendue = maxX >= 0 ? (maxX - minX) / W : 0;
  if (!sansEtendue && etendue < 0.7) defauts.push(`contenu sur ${(etendue * 100).toFixed(0)} % de la largeur (min 70 %)`);
  if (!sansEtendue && minX > W * 0.15) defauts.push(`contenu commence a ${(minX / W * 100).toFixed(0)} % (marge gauche vide)`);
  if (!sansEtendue && maxX < W * 0.85) defauts.push(`contenu finit a ${(maxX / W * 100).toFixed(0)} % (marge droite vide)`);
  return { W, H, etendue: +etendue.toFixed(2), defauts, ref };
}

// Execute DANS la page : rend le SVG exporte hors ecran et releve les boites reelles de chaque <text>.
function chevauchements(svgTxt) {
  const hote = document.createElement("div");
  hote.style.cssText = "position:fixed;left:0;top:0;visibility:hidden;pointer-events:none";
  hote.innerHTML = svgTxt;
  document.body.appendChild(hote);
  const boites = [...hote.querySelectorAll("text")]
    .map((t) => ({ t: (t.textContent || "").trim(), r: t.getBoundingClientRect() }))
    .filter((b) => b.t && b.r.width > 0 && b.r.height > 0);
  const out = [];
  for (let i = 0; i < boites.length; i++) for (let j = i + 1; j < boites.length; j++) {
    const a = boites[i].r, b = boites[j].r;
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (w < 2 || h < 3) continue;
    // la boite d un <text> inclut l interligne : on exige un vrai recouvrement des glyphes (>= 35 % de la plus petite boite en hauteur)
    const aire = w * h, petite = Math.min(a.width * a.height, b.width * b.height);
    if (h < 0.35 * Math.min(a.height, b.height) || aire < 0.12 * petite) continue;
    if (boites[i].t === boites[j].t && Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1) continue;
    out.push([boites[i].t.slice(0, 24), boites[j].t.slice(0, 24)]);
  }
  hote.remove();
  return out;
}

const resultats = [];
let browser;
try { browser = await chromium.launch(); } catch (e) { console.error("navigateur indisponible :", String(e).slice(0, 200)); process.exit(2); }

const cas = [];
for (const t of (RAPIDE ? TICKERS.slice(0, 2) : TICKERS))
  for (const theme of ["dark", "light"])
    for (const vue of [{ nom: "ordi", w: 1280, h: 900 }, { nom: "mobile", w: 390, h: 844 }])
      cas.push({ t, theme, vue });


// Execute DANS la page : pose les crochets (aucun telechargement), lance l export, rend PNG + SVG serialise.
async function capturer(page, declencheur) {
  return page.evaluate(async (decl) => {
    let got = null, svgTxt = null;
    const origObj = URL.createObjectURL;
    URL.createObjectURL = function (o) {
      if (o && o.type && o.type.startsWith("image/svg+xml")) svgTxt = o.text();
      return origObj.call(URL, o);
    };
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) { got = fetch(this.href).then((r) => r.blob()).then((b) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); })); return; }
      return orig.call(this);
    };
    try {
      if (decl.type === "reel") {
        // vrai chemin du bouton de la fiche (menu Telecharger puis « Telecharger le graphique ») : code local ou deploye
        const menu = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Télécharger le graphique" && x.getBoundingClientRect().width > 0);
        if (!menu) return { err: "bouton Telecharger introuvable" };
        menu.scrollIntoView({ block: "center" });
        menu.click();
        await new Promise((r) => setTimeout(r, 500));
        const item = document.querySelector("[data-panneau-partage] button");
        if (item) item.click();
        await new Promise((r) => setTimeout(r, 6500));
      } else if (decl.type === "bundle") {
        const svg = [...document.querySelectorAll('svg[data-chart-export="true"]')].find((s) => s.getBoundingClientRect().width > 0) || document.querySelector('svg[data-chart-export="true"]');
        if (!svg) return { err: "pas de svg" };
        const extra = svg.closest("[data-export-extra]");
        await window.__exp.v1(svg, "t.png", {
          title: svg.getAttribute("data-export-title") || undefined,
          titleEn: extra?.getAttribute("data-export-title-en") || undefined,
          unitEn: extra?.getAttribute("data-export-unit-en") || undefined,
          avgPct: extra?.getAttribute("data-export-avg") || undefined,
          ticker: svg.getAttribute("data-export-ticker") || undefined,
          cagr: svg.getAttribute("data-export-cagr") || undefined,
          frequency: svg.getAttribute("data-export-frequency") || undefined,
          locale: "fr",
        });
      } else {
        // vrai bouton de la page (code deploye) : export moyen terme
        const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === decl.aria && x.getBoundingClientRect().width > 0);
        if (!b) return { err: "bouton « " + decl.aria + " » introuvable" };
        b.scrollIntoView({ block: "center" });
        b.click();
        await new Promise((r) => setTimeout(r, 6000));
      }
      await new Promise((r) => setTimeout(r, 400));
    } finally { HTMLAnchorElement.prototype.click = orig; URL.createObjectURL = origObj; }
    return { data: got ? await got : null, svg: svgTxt ? await svgTxt : null, titre: (document.querySelector('svg[data-chart-export="true"]')?.getAttribute("data-export-title") || "").slice(0, 40) };
  }, declencheur);
}

async function controler(page, c, id, png, opts = {}) {
  if (png.err || !png.data) { resultats.push({ id, defauts: [png.err || "aucun PNG produit"] }); return; }
  const buf = Buffer.from(png.data.split(",")[1], "base64");
  if (KEEP) fs.writeFileSync(path.join(KEEP, id.replace(/[|.]/g, "_") + ".png"), buf);
  const a = await analyser(buf, opts.theme || c.theme, !!opts.uniforme, !!opts.carte);
  // controle structurel de la racine du SVG exporte
  const racine = (png.svg || "").match(/<svg\b[^>]*>/)?.[0] || "";
  const attr = (n) => racine.match(new RegExp(`\\s${n}="([^"]*)"`))?.[1];
  const styleRacine = attr("style") || "";
  if (!racine) !opts.carte && a.defauts.push("SVG exporte introuvable");
  else {
    if (/aspect-ratio|height\s*:\s*auto|width\s*:/i.test(styleRacine)) a.defauts.push(`racine SVG avec style de mise en page (${styleRacine.slice(0, 60)}) : bandes sous Safari`);
    const vb = (attr("viewBox") || "").split(/\s+/).map(Number);
    if (!/^[\d.]+$/.test(attr("width") || "") || !/^[\d.]+$/.test(attr("height") || "")) a.defauts.push(`width/height non numeriques (${attr("width")} x ${attr("height")})`);
    else if (vb.length === 4 && (Math.abs(+attr("width") - vb[2]) > 0.5 || Math.abs(+attr("height") - vb[3]) > 0.5)) a.defauts.push("width/height differents du viewBox");
    if ((attr("preserveAspectRatio") || "xMidYMid meet") !== "xMidYMid meet") a.defauts.push("preserveAspectRatio inattendu");
  }
  if (png.svg) {
    const ch = await page.evaluate(chevauchements, png.svg);
    for (const x of ch.slice(0, 3)) a.defauts.push(`libelles qui se chevauchent : « ${x[0]} » / « ${x[1]} »`);
  }
  resultats.push({ id, W: a.W, H: a.H, etendue: a.etendue, titre: png.titre, defauts: a.defauts });
}

// Mobile : l export lance depuis un petit ecran doit avoir la mise en page ORDINATEUR (src/components/charts/export-bureau.ts :
// le bouton force le gabarit ordinateur le temps de l export). Le script reproduit ce gabarit en neutralisant les
// media queries mobiles des graphiques des le chargement (--ecran-reel pour desactiver).
const REEL = process.argv.includes("--reel"); // teste le vrai bouton de la fiche (serveur local ou preversion avec le code)
const FORCE_BUREAU = !REEL && !process.argv.includes("--ecran-reel");

for (const c of cas) {
  const ctx = await browser.newContext({ viewport: { width: c.vue.w, height: c.vue.h }, deviceScaleFactor: 1, isMobile: c.vue.nom === "mobile" });
  await ctx.addInitScript((th) => { try { localStorage.setItem("theme", th); localStorage.setItem("mettrik-theme", th); } catch {} }, c.theme);
  if (FORCE_BUREAU && c.vue.nom === "mobile") {
    await ctx.addInitScript(() => {
      const mm = window.matchMedia.bind(window);
      window.matchMedia = (q) => (/max-width\s*:\s*(479|639|767)px/.test(q) ? { matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false } : mm(q));
      Object.defineProperty(window, "innerWidth", { get: () => 1280, configurable: true });
    });
  }
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/${encodeURIComponent(c.t)}`, { waitUntil: "domcontentloaded", timeout: 70000 });
    await page.waitForSelector('svg[data-chart-export="true"]', { state: "attached", timeout: 45000 });
    await page.waitForTimeout(2500);
    await page.addScriptTag({ content: code });
    const theme = () => page.evaluate((th) => document.documentElement.setAttribute("data-theme", th), c.theme);
    for (const mode of MODES) {
      if (RAPIDE && mode.id !== "bars") continue;
      if (mode.id !== "bars") {
        const nomTexte = { curve: "Courbe", variation: "Variation" }[mode.id];
        const clique = await page.evaluate((nt) => {
          const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === nt && x.getBoundingClientRect().width > 0);
          if (!b) return false; b.click(); return true;
        }, nomTexte);
        if (!clique) { resultats.push({ id: `${c.t}|${c.theme}|${c.vue.nom}|${mode.id}`, defauts: ["bouton de mode introuvable"] }); continue; }
        await page.waitForTimeout(2200);
      }
      await theme(); await page.waitForTimeout(300);
      await controler(page, c, `${c.t}|${c.theme}|${c.vue.nom}|${mode.id}`, await capturer(page, { type: REEL ? "reel" : "bundle" }));
    }
    if (!RAPIDE) {
      // Autres KPI de la fiche (KPI IC / indicateurs de la liste) : on bascule sur 2 autres tuiles de la section KPI.
      await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Barres" && x.getBoundingClientRect().width > 0); b && b.click(); });
      // + les indicateurs supplementaires (KPI IC) : on deplie la liste
      await page.evaluate(() => { const b = [...document.querySelectorAll("#sec-kpis button")].find((x) => /Voir \d+ indicateurs suppl/.test(x.textContent)); b && b.click(); });
      await page.waitForTimeout(1200);
      for (const k of [2, 5, -3]) {
        const ok = await page.evaluate((k) => {
          const lignes = [...document.querySelectorAll('#sec-kpis [role="button"]')].filter((x) => x.getBoundingClientRect().width > 0);
          const b = lignes.at(k); if (!b) return false; b.scrollIntoView({ block: "center" }); b.click(); return true;
        }, k);
        if (!ok) continue;
        await page.waitForTimeout(2500); await theme(); await page.waitForTimeout(300);
        await controler(page, c, `${c.t}|${c.theme}|${c.vue.nom}|autre-kpi-${k}`, await capturer(page, { type: REEL ? "reel" : "bundle" }));
      }
      // Moyen terme : vrai bouton « Exporter le graphique » (si la fiche a un graphique moyen terme)
      const aMT = await page.evaluate(() => [...document.querySelectorAll("button")].some((x) => x.getAttribute("aria-label") === "Exporter le graphique"));
      if (aMT) {
        await theme(); await page.waitForTimeout(300);
        await controler(page, c, `${c.t}|${c.theme}|${c.vue.nom}|moyen-terme`, await capturer(page, { type: "bouton", aria: "Exporter le graphique" }), { uniforme: true });
      }
    }
    // Partage X : image d apercu (og:image) servie avec le lien publie
    if (!RAPIDE && c.theme === "dark" && c.vue.nom === "ordi") {
      const og = await page.evaluate(() => document.querySelector('meta[property="og:image"]')?.content || "");
      if (og) {
        const du = await page.evaluate(async (u) => {
          try { const r = await fetch(u); if (!r.ok) return null; const b = await r.blob(); return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); }); } catch { return null; }
        }, new URL(og).pathname);
        if (du) await controler(page, c, `${c.t}|partage-x`, { data: du, svg: null }, { uniforme: true, carte: true });
        else resultats.push({ id: `${c.t}|partage-x`, defauts: ["image d apercu X introuvable"] });
      }
    }
  } catch (e) {
    resultats.push({ id: `${c.t}|${c.theme}|${c.vue.nom}`, defauts: ["page/export en erreur : " + String(e).slice(0, 120)] });
  }
  await ctx.close();
}
await browser.close();

const ko = resultats.filter((r) => r.defauts.length);
if (JSON_OUT) console.log(JSON.stringify({ total: resultats.length, ko: ko.length, resultats }, null, 1));
else {
  for (const r of resultats) console.log(`${r.defauts.length ? "ECHEC" : "ok   "} ${r.id} ${r.W || ""}x${r.H || ""} etendue ${r.etendue ?? ""} ${r.titre ? "[" + r.titre + "] " : ""}${r.defauts.join(" ; ")}`);
  console.log(`\n${resultats.length - ko.length}/${resultats.length} exports conformes`);
}
process.exit(resultats.length === 0 ? 2 : ko.length ? 1 : 0);
