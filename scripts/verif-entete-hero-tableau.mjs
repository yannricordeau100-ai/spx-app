// Mesures en vue connectee (meme session que verif-n0-connecte.mjs) : en-tete, hero, tableau KPI. 15 oct 2026.
// Usage : node scripts/verif-entete-hero-tableau.mjs <base> <etiquette avant|apres> [tickers...]
import fs from "node:fs";
import { chromium } from "playwright";
import { createServerClient } from "@supabase/ssr";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL, SRV = env.SUPABASE_SERVICE_ROLE_KEY, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE = process.argv[2] || "http://localhost:3000";
const ETIQ = process.argv[3] || "avant";
const TICKERS = process.argv.length > 4 ? process.argv.slice(4) : ["googl", "cat", "asml", "spcx"];
const EMAIL = "audit.claude@mettrik-internal.test";
const OUT = "data-lake/_verif-n0/entete-hero-tableau-15oct";
fs.mkdirSync(OUT, { recursive: true });

const gl = await fetch(`${URL_SB}/auth/v1/admin/generate_link`, { method: "POST", headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json" }, body: JSON.stringify({ type: "magiclink", email: EMAIL }) }).then((r) => r.json());
const hashed = gl.hashed_token || gl.properties?.hashed_token;
const session = await fetch(`${URL_SB}/auth/v1/verify`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ type: "magiclink", token_hash: hashed }) }).then((r) => r.json());
if (!session.access_token) { console.error("session KO"); process.exit(1); }
const jar = [];
const sb = createServerClient(URL_SB, ANON, { cookies: { getAll: () => [], setAll: (cs) => cs.forEach((c) => jar.push(c)) } });
await sb.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
const host = new URL(BASE).hostname;
const cookies = jar.filter((c) => c.value).map((c) => ({ name: c.name, value: c.value, domain: host, path: "/", httpOnly: false, secure: BASE.startsWith("https"), sameSite: "Lax" }));

const browser = await chromium.launch();
const res = [];
for (const [nom, vp, mobile] of [["1440", { width: 1440, height: 900 }, false], ["1280", { width: 1280, height: 800 }, false], ["390", { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, locale: "fr-FR" });
  await ctx.addCookies(cookies);
  for (const t of TICKERS) {
    const p = await ctx.newPage();
    await p.goto(`${BASE}/${t}`, { waitUntil: "networkidle", timeout: 180000 }).catch(() => null);
    await p.waitForTimeout(2500);
    const m = await p.evaluate(() => {
      const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
      const h1 = document.querySelector("[data-header-row] h1");
      const span = h1?.querySelector("span");
      const nom = h1 ? { texte: h1.textContent.trim(), boite: R(h1), tronque: (span && span.scrollWidth > span.clientWidth + 1) || h1.scrollWidth > h1.clientWidth + 1, couleur: getComputedStyle(span || h1).color, fond: getComputedStyle(span || h1).backgroundImage.slice(0, 60), clip: getComputedStyle(span || h1).webkitTextFillColor } : null;
      const past = document.querySelector("[data-pastille-instit]") || [...document.querySelectorAll("[data-header-row] *, [data-header-row] ~ * *")].find((e) => /institutionnels/i.test(e.textContent) && e.children.length <= 3 && e.textContent.length < 40);
      const cap = [...document.querySelectorAll("*")].find((e) => /^Capitalisation Boursi/i.test(e.textContent.trim()) && e.children.length === 0);
      const hero = document.querySelector("#sec-hero");
      const grille = hero?.querySelector(":scope > .grid");
      const cols = grille ? [...grille.children].map(R) : [];
      const svg = hero ? [...hero.querySelectorAll("svg.recharts-surface, canvas, svg")].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 200).sort((a, b) => b.width * b.height - a.width * a.height)[0] : null;
      const entete = document.querySelector("#sec-kpis [data-blur=kpis] > div");
      const ent = entete ? [...entete.children].map((c) => ({ t: c.textContent.trim().slice(0, 20), ...R(c) })) : [];
      const ligne = document.querySelector("#sec-kpis [data-blur=kpis] button, #sec-kpis [data-blur=kpis] [role=button]");
      const cel = ligne ? [...ligne.children].map((c) => ({ t: c.textContent.trim().slice(0, 20), ...R(c) })) : [];
      // contenu reel de la colonne tendance et valeur dans la premiere ligne
      const noms = [...document.querySelectorAll("#sec-kpis [data-blur=kpis] button > div:first-child, #sec-kpis [data-blur=kpis] [role=button] > div:first-child")].map((d) => d.getBoundingClientRect().height);
      const enteteH = document.querySelector("[data-entete-fiche]")?.offsetHeight; return { enteteH, nom, pastille: past ? { t: past.textContent.trim().slice(0, 30), ...R(past) } : null, cap: R(cap), heroW: R(hero)?.w, cols, graphique: svg ? { w: Math.round(svg.width), h: Math.round(svg.height) } : null, entete: ent, ligne1: cel, hauteursNoms: noms.slice(0, 30), scrollX: document.documentElement.scrollWidth > window.innerWidth };
    });
    const r = { vue: nom, t, ...m };
    res.push(r);
    console.log(JSON.stringify(r));
    await p.screenshot({ path: `${OUT}/${ETIQ}-${nom}-${t}-haut.png` });
    const h = await p.$("#sec-hero"); if (h) { await h.scrollIntoViewIfNeeded(); await p.waitForTimeout(4000); } if (h) await h.screenshot({ path: `${OUT}/${ETIQ}-${nom}-${t}-hero.png` }).catch(() => {});
    const k = await p.$("#sec-kpis"); if (k) { await k.scrollIntoViewIfNeeded(); await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/${ETIQ}-${nom}-${t}-tableau.png` }); }
    await p.close();
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/mesures-${ETIQ}.json`, JSON.stringify(res, null, 2));
