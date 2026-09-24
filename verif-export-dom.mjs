import { chromium } from 'playwright';
import fs from 'fs';
const [name, ...rest] = fs.readFileSync('/tmp/audit_cookie.txt','utf8').trim().split('='); const value = rest.join('=');
const base = process.env.BASE || 'https://mettrik-niveau2.vercel.app';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport:{width:1400,height:1000}, acceptDownloads:true });
await ctx.addCookies([{ name, value, domain:new URL(base).hostname, path:'/', secure:true, sameSite:'Lax' }]);
const p = await ctx.newPage();
await p.goto(`${base}/ASML`, { waitUntil:'load', timeout:120000 }); await p.waitForTimeout(4000);
const info = await p.evaluate(() => {
  const btn = document.querySelector('button[aria-label="Exporter le graphique"]');
  const bloc = btn ? btn.closest('section') || btn.parentElement?.parentElement?.parentElement : null;
  return { bouton: !!btn, svgInline: bloc ? bloc.querySelectorAll('svg').length : -1, img: bloc ? bloc.querySelectorAll('img').length : -1, srcImg: bloc ? [...bloc.querySelectorAll('img')].map(i=>i.getAttribute('src')).slice(0,2) : [] };
});
console.log(base.includes('niveau2')?'niveau2':'production', JSON.stringify(info));
await b.close();
