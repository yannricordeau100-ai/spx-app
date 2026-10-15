// Controle visuel du logo Mettrik (15 oct 2026) : /account, /auth/update-password, /api/og/aapl, sombre et clair.
// Usage : node scripts/verif-logo-mettrik-15oct.mjs <base> <prefixe>   (sortie : data-lake/_verif-n0/logo-mettrik-15oct/)
import fs from "node:fs";
import { chromium } from "playwright";
import { createServerClient } from "@supabase/ssr";
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL, SRV = env.SUPABASE_SERVICE_ROLE_KEY, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE = process.argv[2], PRE = process.argv[3];
const OUT = "data-lake/_verif-n0/logo-mettrik-15oct";
const gl = await fetch(`${URL_SB}/auth/v1/admin/generate_link`, { method: "POST", headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json" }, body: JSON.stringify({ type: "magiclink", email: "audit.claude@mettrik-internal.test" }) }).then((r) => r.json());
const session = await fetch(`${URL_SB}/auth/v1/verify`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ type: "magiclink", token_hash: gl.hashed_token || gl.properties?.hashed_token }) }).then((r) => r.json());
const jar = [];
const sb = createServerClient(URL_SB, ANON, { cookies: { getAll: () => [], setAll: (cs) => cs.forEach((c) => jar.push(c)) } });
await sb.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
const host = new URL(BASE).hostname;
const cookies = jar.filter((c) => c.value).map((c) => ({ name: c.name, value: c.value, domain: host, path: "/", httpOnly: false, secure: BASE.startsWith("https"), sameSite: "Lax" }));
const b = await chromium.launch();
for (const theme of ["dark", "light"]) {
  const ctx = await b.newContext({ viewport: { width: 1100, height: 700 }, locale: "fr-FR", colorScheme: theme });
  await ctx.addCookies(cookies);
  await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); localStorage.setItem("mettrik-theme", t); } catch {} }, theme);
  for (const [id, path] of [["account", "/account"], ["update-password", "/auth/update-password"]]) {
    const p = await ctx.newPage();
    await p.goto(BASE + path, { waitUntil: "load", timeout: 120000 }).catch(() => {});
    await p.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    await p.waitForTimeout(3000);
    console.log(PRE, theme, id, p.url());
    await p.screenshot({ path: `${OUT}/${PRE}-${theme}-${id}.png`, clip: { x: 0, y: 0, width: 1100, height: 300 } });
    await p.close();
  }
  await ctx.close();
}
const og = await fetch(`${BASE}/api/og/aapl`); console.log(PRE, "og", og.status, og.headers.get("content-type"));
fs.writeFileSync(`${OUT}/${PRE}-og-aapl.png`, Buffer.from(await og.arrayBuffer()));
await b.close();
