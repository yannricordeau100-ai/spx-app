#!/usr/bin/env node
// Verification REELLE du captcha au clic (Yann 15 oct 2026).
//
// Usage :
//   node scripts/verif-captcha-reel.mjs --url https://mettrik-niveau2.vercel.app
//   node scripts/verif-captcha-reel.mjs --url https://mettrik.ai
//   node scripts/verif-captcha-reel.mjs --url http://localhost:3000 --sitekey 1x00000000000000000000AA --intercepter
//   node scripts/verif-captcha-reel.mjs --url http://localhost:3000 --sitekey 3x00000000000000000000FF --intercepter
//
// Options :
//   --cocher            clique la case si un defi interactif apparait
//   --url <base>        site a tester (obligatoire)
//   --page <chemin>     page du formulaire (defaut /contact)
//   --sitekey <cle>     force une cle publique Turnstile (cles de test Cloudflare),
//                       injectee avant le chargement de la page
//   --intercepter       n envoie PAS le message : la requete /api/contact est
//                       captee, le jeton est releve, une reponse 200 factice est
//                       rendue (pour les essais locaux, aucun courriel ne part)
//   --attente <s>       duree d observation apres le clic (defaut 25 s)
//   --headed            navigateur visible
//   --capture <dossier> captures PNG avant et apres le clic
//
// Le script rapporte ce qu il voit, sans rien maquiller : un navigateur
// automatise que Cloudflare detecte NE DOIT PAS obtenir de jeton valide.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

function arg(nom, defaut) {
  const i = process.argv.indexOf(nom);
  if (i === -1) return defaut;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
}

const base = String(arg("--url", "") || "").replace(/\/$/, "");
if (!base) {
  console.error("Usage : node scripts/verif-captcha-reel.mjs --url <base> [--page /contact] [--sitekey cle] [--intercepter]");
  process.exit(2);
}
const pageChemin = String(arg("--page", "/contact"));
const sitekey = arg("--sitekey", null);
const intercepter = Boolean(arg("--intercepter", false));
const attenteS = Number(arg("--attente", 25));
const headed = Boolean(arg("--headed", false));
const dossierCapture = arg("--capture", null);
// --cocher : si un defi interactif s affiche, clique la case comme un humain
// (utile avec la cle de test 3x00000000000000000000FF, qui accepte ce clic).
const cocher = Boolean(arg("--cocher", false));

const rapport = {
  url: base + pageChemin,
  date: new Date().toISOString(),
  sitekey_forcee: sitekey || null,
  intercepte: intercepter,
  avant_clic: {},
  apres_clic: {},
  api: null,
  verdict: "",
};

async function etatCloudflare(page) {
  // Cloudflare place son iframe dans un shadow root ferme : page.frames() la
  // voit quand meme, et frameElement() donne sa boite reelle.
  const cadres = page.frames().filter((f) => /challenges\.cloudflare\.com/.test(f.url()));
  let cadresVisibles = 0;
  const boites = [];
  for (const f of cadres) {
    try {
      const el = await f.frameElement();
      const bb = await el.boundingBox();
      const vis = await el.isVisible();
      if (bb && vis && bb.width > 2 && bb.height > 2) {
        cadresVisibles += 1;
        boites.push({ l: Math.round(bb.width), h: Math.round(bb.height) });
      }
    } catch { /* cadre detache */ }
  }
  const dom = await page.evaluate(() => {
    const iframes = [...document.querySelectorAll("iframe")].filter((f) =>
      /challenges\.cloudflare\.com/.test(f.src || ""),
    );
    // Cloudflare rend aussi son iframe dans un shadow root ferme : on compte
    // en plus les enveloppes visibles dans nos conteneurs.
    const zones = [...document.querySelectorAll(".cf-turnstile-zone")];
    const visibles = (els) =>
      els.filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 2 && r.height > 2 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0;
      });
    const zonesVisibles = visibles(zones).map((z) => {
      const r = z.getBoundingClientRect();
      return { l: Math.round(r.width), h: Math.round(r.height) };
    });
    const etatComposant = [...document.querySelectorAll("[data-captcha-au-clic]")].map((e) =>
      e.getAttribute("data-captcha-au-clic"),
    );
    const messages = [...document.querySelectorAll("[data-captcha-au-clic] p")].map((p) => p.textContent?.trim());
    return {
      script_charge: Boolean(window.turnstile),
      iframes_cloudflare: iframes.length,
      iframes_visibles: visibles(iframes).length,
      zones_visibles: zonesVisibles,
      etat_composant: etatComposant,
      messages,
    };
  });
  return { ...dom, iframes_cloudflare: Math.max(dom.iframes_cloudflare, cadres.length), iframes_visibles: Math.max(dom.iframes_visibles, cadresVisibles), boites_iframes: boites };
}

const navigateur = await chromium.launch({ headless: !headed });
const contexte = await navigateur.newContext({ locale: "fr-FR", viewport: { width: 1280, height: 900 } });
if (sitekey) {
  // La mise en page pose window.__turnstileSiteKey ; on fige notre cle de test.
  await contexte.addInitScript((cle) => {
    Object.defineProperty(window, "__turnstileSiteKey", { get: () => cle, set: () => {}, configurable: false });
  }, sitekey);
}
const page = await contexte.newPage();
const journal = [];
page.on("console", (m) => {
  if (/turnstile|captcha|cloudflare/i.test(m.text())) journal.push(`[console ${m.type()}] ${m.text()}`.slice(0, 300));
});

const cheminApi = pageChemin.includes("contact-api") ? "/api/contact-api" : pageChemin.includes("contact") ? "/api/contact" : "/api/support/tickets";
let requeteApi = null;
await page.route("**" + cheminApi, async (route) => {
  const req = route.request();
  let corps = {};
  try { corps = JSON.parse(req.postData() || "{}"); } catch { /* corps illisible */ }
  requeteApi = { jeton_present: Boolean(corps.captchaToken), jeton_debut: String(corps.captchaToken || "").slice(0, 24) };
  if (intercepter) {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, intercepte: true }) });
  } else {
    await route.continue();
  }
});
page.on("response", async (r) => {
  if (r.url().endsWith(cheminApi) && r.request().method() === "POST") {
    let corps = null;
    try { corps = await r.json(); } catch { corps = await r.text().catch(() => null); }
    rapport.api = { statut: r.status(), corps };
  }
});

await page.goto(base + pageChemin, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);
rapport.titre = await page.title();
rapport.avant_clic = await etatCloudflare(page);
if (dossierCapture) {
  fs.mkdirSync(dossierCapture, { recursive: true });
  await page.screenshot({ path: path.join(dossierCapture, "avant-clic.png"), fullPage: true });
}

const form = page.locator("form:has(textarea)").first();
await form.locator('input[type="text"]').nth(0).fill("Test Claude");
await form.locator('input[type="email"]').first().fill("audit.claude@mettrik-internal.test");
await form.locator('input[type="text"]').nth(1).fill("Test captcha (ignorer)");
await form.locator("textarea").first().fill("Test automatique du captcha au clic. Merci d ignorer ce message.");
const t0 = Date.now();
await form.locator('button[type="submit"]').first().click();

// Observation : on releve l etat toutes les secondes.
const chronologie = [];
let interactionVue = false;
let iframeVue = false;
for (let s = 1; s <= attenteS; s++) {
  await page.waitForTimeout(1000);
  const e = await etatCloudflare(page);
  if (e.iframes_cloudflare > 0) iframeVue = true;
  if (e.etat_composant.includes("interaction")) interactionVue = true;
  chronologie.push({ s, iframes: e.iframes_cloudflare, visibles: e.iframes_visibles, zones: e.zones_visibles, etat: e.etat_composant.join(","), messages: e.messages.filter(Boolean) });
  if (cocher && e.etat_composant.includes("interaction") && !rapport.case_cochee) {
    const f = page.frames().find((x) => /challenges\.cloudflare\.com/.test(x.url()));
    const bb = f ? await (await f.frameElement()).boundingBox() : null;
    if (bb) {
      await page.waitForTimeout(800);
      await page.mouse.click(bb.x + 28, bb.y + bb.height / 2);
      rapport.case_cochee = true;
    }
  }
  if (s === 3 && dossierCapture) await page.screenshot({ path: path.join(dossierCapture, "apres-clic-3s.png"), fullPage: true });
  if (rapport.api && s >= 2) break;
}
rapport.apres_clic = {
  duree_s: Math.round((Date.now() - t0) / 100) / 10,
  iframe_cloudflare_apparue: iframeVue,
  defi_interactif_demande: interactionVue,
  chronologie,
  message_final: (await etatCloudflare(page)).messages,
  confirmation_visible: await page.locator("text=/message re[çc]u|merci|bien re[çc]u/i").first().isVisible().catch(() => false),
};
if (dossierCapture) await page.screenshot({ path: path.join(dossierCapture, "apres-clic-fin.png"), fullPage: true });
rapport.requete_api = requeteApi;
rapport.journal_console = journal.slice(0, 20);

const avantPropre = rapport.avant_clic.iframes_visibles === 0 && rapport.avant_clic.zones_visibles.length === 0 && rapport.avant_clic.iframes_cloudflare === 0;
const jeton = requeteApi?.jeton_present === true;
rapport.verdict = [
  avantPropre ? "AVANT CLIC : aucun captcha visible (ok)" : "AVANT CLIC : captcha present ou visible (ECHEC de la regle)",
  iframeVue ? "au clic : iframe Cloudflare creee" : "au clic : aucune iframe Cloudflare",
  interactionVue ? "defi interactif demande (cadre affiche)" : "aucun defi interactif",
  jeton ? "jeton obtenu et envoye a l API" : "aucun jeton obtenu (message non envoye)",
  rapport.api ? `API : HTTP ${rapport.api.statut} ${JSON.stringify(rapport.api.corps).slice(0, 160)}` : "API : non appelee",
].join(" | ");

console.log(JSON.stringify(rapport, null, 2));
await navigateur.close();
process.exit(avantPropre ? 0 : 1);
