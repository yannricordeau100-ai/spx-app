const { chromium } = require('/Users/yann/spx-app/node_modules/playwright');
const fs = require('fs');
const BASE = process.env.BASE, TOK = process.env.TOK, OUT = process.env.OUT;
const cas = JSON.parse(process.argv[2]); // [{id, path, theme, mt}]
(async () => {
  const b = await chromium.launch();
  for (const c of cas) {
    const ctx = await b.newContext({ viewport:{width:1440,height:1000}, acceptDownloads:true, colorScheme: c.cs || 'dark' });
    const p = await ctx.newPage();
    try {
      await p.goto(`${BASE}${c.path}?audit_token=${TOK}`, { waitUntil:'networkidle', timeout:120000 });
      if (c.theme) await p.evaluate(t => document.documentElement.setAttribute('data-theme', t), c.theme);
      await p.waitForTimeout(3000);
      if (c.courbe) { await p.locator('button:visible', { hasText: 'Courbe' }).first().click(); await p.waitForTimeout(2500); }
      if (c.annuel) { await p.getByRole('button', { name: /^Annuel$/ }).first().click(); await p.waitForTimeout(2500); }
      let btn;
      if (c.mt) { btn = p.locator('[aria-label="Exporter le graphique"]').first(); }
      else {
        const menu = p.locator('button[aria-label="Télécharger le graphique"], button[aria-label="Download chart"]').first();
        await menu.scrollIntoViewIfNeeded(); await menu.click(); await p.waitForTimeout(500);
        btn = p.locator('[data-panneau-partage] button').first();
      }
      await btn.scrollIntoViewIfNeeded();
      const [dl] = await Promise.all([p.waitForEvent('download', {timeout:30000}), btn.click()]);
      await dl.saveAs(`${OUT}/${c.id}.png`);
      console.log(c.id, 'OK');
    } catch (e) { console.log(c.id, 'ECHEC', e.message.split('\n')[0]); await p.screenshot({path:`${OUT}/${c.id}-page.png`}); }
    await ctx.close();
  }
  await b.close();
})();
