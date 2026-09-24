import { chromium } from 'playwright'; import fs from 'fs';
const [name, ...rest] = fs.readFileSync('/tmp/audit_cookie.txt','utf8').trim().split('='); const value = rest.join('=');
const b = await chromium.launch(); const ctx = await b.newContext({ viewport:{width:1400,height:1100} });
await ctx.addCookies([{ name, value, domain:'mettrik-niveau2.vercel.app', path:'/', secure:true, sameSite:'Lax' }]);
const p = await ctx.newPage(); await p.goto('https://mettrik-niveau2.vercel.app/MC.PA', { waitUntil:'load', timeout:120000 }); await p.waitForTimeout(4000);
console.log(await p.evaluate(() => ({ theme: document.documentElement.getAttribute('data-theme'), cls: document.documentElement.className.slice(0,60), dark: [...document.querySelectorAll('#sec-these img.dark-only')].map(i=>getComputedStyle(i).display+' '+i.getAttribute('src')?.slice(-30)), light: [...document.querySelectorAll('#sec-these img.light-only')].map(i=>getComputedStyle(i).display+' '+i.getAttribute('src')?.slice(-30)) })));
await b.close();
