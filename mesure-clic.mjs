import { chromium } from 'playwright';
import fs from 'fs';
const cookieStr = fs.readFileSync('/tmp/audit_cookie.txt','utf8').trim();
const [name, ...rest] = cookieStr.split('='); const value = rest.join('=');
const base = process.env.BASE || 'https://mettrik.ai';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:1440,height:900} });
await ctx.addCookies([{ name, value, domain:new URL(base).hostname, path:'/', secure:true, sameSite:'Lax' }]);
const p = await ctx.newPage();
await p.goto(base, { waitUntil:'load', timeout:120000 });
await p.waitForTimeout(2500);
console.log('parcours reel : clic depuis l accueil');
for (let i=0;i<4;i++){
  const liens = await p.locator('a[href^="/"]:not([href*="/pricing"]):not([href="/"])').all();
  const cibles = [];
  for (const l of liens) { const h = await l.getAttribute('href'); if (h && /^\/[A-Za-z0-9.\-]{1,10}$/.test(h)) cibles.push({l,h}); }
  if (!cibles.length) { console.log('aucun lien de fiche trouve'); break; }
  const c = cibles[i % cibles.length];
  const t0 = Date.now();
  await c.l.click();
  try { await p.waitForSelector('span.text-\\[24px\\].font-bold', { timeout: 60000 }); } catch {}
  console.log(`${c.h} : ${Date.now()-t0} ms jusqu au titre du KPI`);
  await p.goBack({ waitUntil:'load' }); await p.waitForTimeout(1200);
}
await b.close();
