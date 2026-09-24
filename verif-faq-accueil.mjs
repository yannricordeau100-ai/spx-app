import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();
await p.goto('https://mettrik-niveau2.vercel.app/', { waitUntil:'load', timeout:120000 });
for (let i=0;i<12;i++){ await p.evaluate(()=>window.scrollBy(0, 2500)); await p.waitForTimeout(400); }
const t = await p.evaluate(() => document.body.innerText);
for (const q of ["Qu'est-ce qu'un KPI (ou indicateur clé)", "Puis-je tester Mettrik AI sans payer", "Que deviennent mes données personnelles", "Puis-je changer de plan plus tard", "Quelles sociétés sont couvertes en Premium et Max"]) console.log(q, ':', t.includes(q));
const faq = p.locator('#faq-title'); if (await faq.count()) { await faq.scrollIntoViewIfNeeded(); await p.waitForTimeout(600); await p.screenshot({ path:'/tmp/v13_faq_accueil.png' }); console.log('capture faq accueil'); }
await b.close();
