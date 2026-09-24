import { chromium } from 'playwright';
import fs from 'fs';
const cookieStr = fs.readFileSync('/tmp/audit_cookie.txt','utf8').trim();
const [name, ...rest] = cookieStr.split('='); const value = rest.join('=');
const base = process.env.BASE || 'https://mettrik.ai';
const tickers = process.argv.slice(2);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:1440,height:900} });
await ctx.addCookies([{ name, value, domain:new URL(base).hostname, path:'/', secure:true, sameSite:'Lax' }]);
const p = await ctx.newPage();
console.log('ticker | TTFB | DOM | charge | 1er graphe visible | poids Ko | requetes');
for (const t of tickers) {
  const t0 = Date.now();
  let requetes = 0, poids = 0;
  const onResp = async (r) => { requetes++; try { const h = r.headers()['content-length']; if (h) poids += Number(h); } catch {} };
  p.on('response', onResp);
  await p.goto(`${base}/${t}`, { waitUntil:'commit', timeout:120000 });
  const nav = async (k) => p.evaluate((kk)=>{ const n=performance.getEntriesByType('navigation')[0]; return n? Math.round(n[kk]) : null; }, k);
  await p.waitForLoadState('domcontentloaded');
  const dom = Date.now()-t0;
  const ttfb = await nav('responseStart');
  await p.waitForLoadState('load');
  const charge = Date.now()-t0;
  let graphe = null;
  try { await p.waitForSelector('svg.recharts-surface, canvas, span.text-\\[24px\\].font-bold', { timeout: 60000 }); graphe = Date.now()-t0; } catch {}
  p.off('response', onResp);
  console.log(`${t} | ${ttfb} ms | ${dom} ms | ${charge} ms | ${graphe ?? 'non vu'} ms | ${Math.round(poids/1024)} | ${requetes}`);
}
await b.close();
