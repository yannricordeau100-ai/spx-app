import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();
const erreurs = []; p.on('console', m => { if (m.type()==='error') erreurs.push(m.text().slice(0,160)); }); p.on('pageerror', e => erreurs.push('PAGEERROR '+String(e).slice(0,160)));
await p.goto('https://mettrik-niveau2.vercel.app/', { waitUntil:'networkidle', timeout:120000 });
const r = await p.evaluate(() => ({ faqTitle: !!document.querySelector('#faq-title'), details: document.querySelectorAll('details').length, texte: document.body.innerText.includes('Questions fréquentes'), gics: document.body.innerText.includes('Comment sont class') }));
console.log(JSON.stringify(r)); console.log('erreurs :', erreurs.slice(0,5));
await b.close();
