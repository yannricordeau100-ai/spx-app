import { chromium } from 'playwright';
import fs from 'fs';
const cookieStr = fs.readFileSync('/tmp/audit_cookie.txt','utf8').trim();
const [name, ...rest] = cookieStr.split('=');
const value = rest.join('=');
const tickers = process.argv.slice(2);
const base = process.env.BASE || 'https://mettrik-niveau2.vercel.app';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:1280,height:900} });
await ctx.addCookies([{ name, value, domain: new URL(base).hostname, path:'/', httpOnly:false, secure:true, sameSite:'Lax' }]);
const page = await ctx.newPage();
const out = [];
for (const t of tickers) {
  let titre = '', val = '';
  try {
    await page.goto(`${base}/${encodeURIComponent(t)}`, { waitUntil:'domcontentloaded', timeout:70000 });
    const sel = 'span.text-\\[24px\\].font-bold';
    await page.waitForSelector(sel, { timeout: 45000 });
    titre = (await page.locator(sel).first().innerText()).replace(/\s+/g,' ').trim();
  } catch (e) { titre = 'ERREUR ' + String(e).slice(0,60); }
  let ver = '';
  try { ver = (await page.locator('text=/V2026\\.[0-9.]+/').first().innerText()).trim(); } catch {}
  out.push({ t, titre, ver });
  console.log(`${t} | ${titre} | ${ver}`);
}
fs.writeFileSync('/tmp/verif-hero-affiche.json', JSON.stringify(out,null,1));
await b.close();
