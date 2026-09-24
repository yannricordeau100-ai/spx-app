import { chromium } from 'playwright';
import fs from 'fs';
const [name, ...rest] = fs.readFileSync('/tmp/audit_cookie.txt','utf8').trim().split('='); const value = rest.join('=');
const base='https://mettrik-niveau2.vercel.app';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport:{width:1400,height:1000}, acceptDownloads:true });
await ctx.addCookies([{ name, value, domain:new URL(base).hostname, path:'/', secure:true, sameSite:'Lax' }]);
const p = await ctx.newPage();
await p.addInitScript(() => { window.__rej = []; window.addEventListener('unhandledrejection', e => window.__rej.push(String(e.reason && (e.reason.stack || e.reason)).slice(0,300))); });
await p.goto(`${base}/ASML`, { waitUntil:'load', timeout:120000 }); await p.waitForTimeout(4000);
// 1. export long terme (bouton du hero)
const btnLT = p.locator('button[title*="PNG"], button[aria-label*="PNG"]').first();
console.log('boutons PNG trouves :', await p.locator('button[title*="PNG"], button[aria-label*="PNG"]').count());
try { const [dl] = await Promise.all([ p.waitForEvent('download', { timeout: 40000 }), btnLT.click() ]); console.log('long terme :', dl.suggestedFilename()); } catch { console.log('long terme : pas de telechargement'); }
// 2. export moyen terme
const btnMT = p.locator('button[aria-label="Exporter le graphique"]').first(); await btnMT.scrollIntoViewIfNeeded();
try { const [dl] = await Promise.all([ p.waitForEvent('download', { timeout: 40000 }), btnMT.click() ]); await dl.saveAs('/tmp/export_mt_asml.png'); console.log('moyen terme :', dl.suggestedFilename(), fs.statSync('/tmp/export_mt_asml.png').size, 'octets'); } catch { console.log('moyen terme : pas de telechargement'); }
console.log('rejets :', await p.evaluate(() => window.__rej));
await b.close();
