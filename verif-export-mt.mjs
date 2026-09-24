import { chromium } from 'playwright';
import fs from 'fs';
const [name, ...rest] = fs.readFileSync('/tmp/audit_cookie.txt','utf8').trim().split('='); const value = rest.join('=');
const base='https://mettrik-niveau2.vercel.app';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport:{width:1400,height:1000}, acceptDownloads:true });
await ctx.addCookies([{ name, value, domain:new URL(base).hostname, path:'/', secure:true, sameSite:'Lax' }]);
const p = await ctx.newPage();
const err=[]; p.on('console', m => { if (m.type()==='error') err.push(m.text().slice(0,200)); }); p.on('pageerror', e => err.push('PAGEERROR '+String(e).slice(0,200)));
await p.goto(`${base}/ASML`, { waitUntil:'load', timeout:120000 }); await p.waitForTimeout(2500);
const bloc = p.locator('[data-blur="mt_titre"]').first();
if (!(await bloc.count())) { console.log('bloc moyen terme introuvable'); console.log('erreurs :', err.slice(0,6)); await b.close(); process.exit(0); }
await bloc.scrollIntoViewIfNeeded(); await p.waitForTimeout(800);
const btn = p.locator('button[title*="PNG"], button[aria-label*="PNG"], button:has-text("PNG"), button[title*="Télécharger"], button[aria-label*="Télécharger"]').first();
console.log('bouton export trouve :', await btn.count());
let dl; try { [dl] = await Promise.all([ p.waitForEvent('download', { timeout: 90000 }), btn.click() ]); } catch(e) { console.log('pas de telechargement :', String(e).slice(0,80)); console.log('erreurs :', err.slice(0,6)); await b.close(); process.exit(0); }
const chemin = '/tmp/export_mt_asml.png'; await dl.saveAs(chemin);
console.log('fichier :', dl.suggestedFilename(), fs.statSync(chemin).size, 'octets');
console.log('erreurs :', err.slice(0,6)); await b.close();
