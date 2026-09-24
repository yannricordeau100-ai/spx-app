import { chromium } from 'playwright';
import fs from 'fs';
const [name, ...rest] = fs.readFileSync('/tmp/audit_cookie.txt','utf8').trim().split('='); const value = rest.join('=');
const base = process.env.BASE || 'https://mettrik-niveau2.vercel.app';
const t = process.argv[2] || 'MC.PA';
const b = await chromium.launch();
for (const mode of ['connecte','anonyme']) {
  const ctx = await b.newContext({ viewport:{width:1400,height:1100} });
  if (mode==='connecte') await ctx.addCookies([{ name, value, domain:new URL(base).hostname, path:'/', secure:true, sameSite:'Lax' }]);
  const p = await ctx.newPage();
  const imgs = []; p.on('response', r => { if (/findings\/theses/.test(r.url())) imgs.push(r.status()+' '+r.url().slice(-50)); });
  await p.goto(`${base}/${t}`, { waitUntil:'load', timeout:120000 });
  await p.waitForTimeout(4000);
  try { await p.waitForSelector('#sec-these', { timeout: 30000 }); } catch {}
  const sec = p.locator('#sec-these');
  const present = await sec.count();
  console.log(`${mode} | bloc these present : ${present}`);
  if (present) {
    await p.evaluate(() => document.querySelector('#sec-these')?.scrollIntoView()); await p.waitForTimeout(2000);
    const txt = await sec.innerText();
    console.log(`  style : ${/Selon les critères de|Selon la méthode/.test(txt)} | hook : ${txt.includes('Rédigée en')} | verrouille : ${txt.includes('Réservé au plan Max')} | sections : qualite=${txt.includes('Qualité interne')} externe=${txt.includes('Dynamique externe')} quant=${txt.includes('Quantitatif')} graphe=${txt.includes('Le regard extérieur')} additionnel=${txt.includes('Un élément en plus')} invalider=${txt.includes('invaliderait')} glossaire=${txt.includes('Glossaire')}`);
    console.log('  images :', imgs.join(' ; ') || 'aucune');
    const att = await p.locator('#sec-anti-these').count(); const ordre = await p.evaluate(() => { const a=document.querySelector('#sec-these'), b=document.querySelector('#sec-anti-these'); return a&&b ? (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? 'these avant anti-these' : 'anti-these avant these') : 'manque'; });
    console.log(`  anti-these presente : ${att} | ordre : ${ordre}`);
    await p.screenshot({ path:`/tmp/these_${mode}_1.png` }); await p.evaluate(() => window.scrollBy(0, 1000)); await p.waitForTimeout(600); await p.screenshot({ path:`/tmp/these_${mode}_2.png` });
    await p.evaluate(() => window.scrollBy(0, 1000)); await p.waitForTimeout(600); await p.screenshot({ path:`/tmp/these_${mode}_3.png` });
  }
  await ctx.close();
}
await b.close();
