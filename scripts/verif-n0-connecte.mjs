// Controle visuel de mettrik.ai en vue connectee (compte audit.claude@mettrik-internal.test), 13 oct 2026.
// Aucune saisie de mot de passe : session creee cote serveur (lien magique genere par l API admin puis verifie),
// injectee en cookie @supabase/ssr dans un navigateur Playwright. Captures ordinateur et mobile.
// Usage : node scripts/verif-n0-connecte.mjs [base] [tickers...]   (sortie : data-lake/_verif-n0/<date>/)
import fs from "node:fs";
import { chromium } from "playwright";
import { createServerClient } from "@supabase/ssr";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL, SRV = env.SUPABASE_SERVICE_ROLE_KEY, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE = process.argv[2] || "https://mettrik.ai";
const TICKERS = process.argv.length > 3 ? process.argv.slice(3) : ["aapl", "mc.pa", "jpm", "cat", "nvda", "payx", "omc"];
const EMAIL = "audit.claude@mettrik-internal.test";
const OUT = `data-lake/_verif-n0/${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`;
fs.mkdirSync(OUT, { recursive: true });

// 1) session sans mot de passe
const gl = await fetch(`${URL_SB}/auth/v1/admin/generate_link`, { method: "POST", headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json" }, body: JSON.stringify({ type: "magiclink", email: EMAIL }) }).then((r) => r.json());
const hashed = gl.hashed_token || gl.properties?.hashed_token;
if (!hashed) { console.error("generate_link KO", JSON.stringify(gl).slice(0, 200)); process.exit(1); }
const session = await fetch(`${URL_SB}/auth/v1/verify`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ type: "magiclink", token_hash: hashed }) }).then((r) => r.json());
if (!session.access_token) { console.error("verify KO", JSON.stringify(session).slice(0, 200)); process.exit(1); }

// 2) cookies exactement comme @supabase/ssr les ecrit (encodage et decoupage)
const jar = [];
const sb = createServerClient(URL_SB, ANON, { cookies: { getAll: () => [], setAll: (cs) => cs.forEach((c) => jar.push(c)) } });
await sb.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
const host = new URL(BASE).hostname;
const cookies = jar.filter((c) => c.value).map((c) => ({ name: c.name, value: c.value, domain: host, path: "/", httpOnly: false, secure: true, sameSite: "Lax" }));

const INTERDITS = /niveau ?2(?!\d)|niveau2|\bn2\b|v195|v1-9-5|v1\.9\.5|mettrik-niveau/i;
const browser = await chromium.launch();
const rapport = [];
for (const [nom, vp, mobile] of [["ordi", { width: 1440, height: 900 }, false], ["mobile", { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, locale: "fr-FR" });
  await ctx.addCookies(cookies);
  const pages = [["accueil", "/"], ...TICKERS.map((t) => [t, `/${t}`]), ["404", "/page-qui-n-existe-pas-xyz"]];
  for (const [id, path] of pages) {
    const p = await ctx.newPage();
    const erreurs = [];
    p.on("pageerror", (e) => erreurs.push(String(e).slice(0, 160)));
    const resp = await p.goto(BASE + path, { waitUntil: "networkidle", timeout: 90000 }).catch((e) => null);
    await p.waitForTimeout(2500);
    const html = await p.content();
    const texte = await p.evaluate(() => document.body.innerText);
    const r = {
      vue: nom, page: id, http: resp?.status(), url: p.url(), titre: await p.title(),
      connecte: !/Se connecter|Connexion\b/.test(texte.slice(0, 600)),
      interdits: [...new Set((html.match(new RegExp(INTERDITS.source, "gi")) || []).map((x) => x.toLowerCase()))],
      jaunes: await p.evaluate(() => [...document.querySelectorAll("*")].filter((e) => { const c = getComputedStyle(e).color; const b = getComputedStyle(e).backgroundColor; return /rgb\(2(2|3|4|5)\d, (1[6-9]\d|2[0-1]\d), ([0-9]|[1-9][0-9]|1[0-2]\d)\)/.test(c + b) && e.children.length === 0 && e.textContent.trim().length > 2; }).length),
      floutes: await p.evaluate(() => [...document.querySelectorAll("*")].filter((e) => (getComputedStyle(e).filter || "").includes("blur")).length),
      erreurs,
    };
    for (const m of html.matchAll(new RegExp(INTERDITS.source, "gi"))) r.contextes = [...(r.contextes || []), html.slice(Math.max(0, m.index - 120), m.index + 60)].slice(0, 3);
    await p.screenshot({ path: `${OUT}/${nom}-${id}.png`, fullPage: true });
    await p.screenshot({ path: `${OUT}/${nom}-${id}-haut.png` });
    rapport.push(r);
    console.log(JSON.stringify(r));
    await p.close();
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/rapport.json`, JSON.stringify(rapport, null, 2));
console.log("SORTIE", OUT);
