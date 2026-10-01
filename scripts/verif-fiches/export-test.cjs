const { chromium } = require('/Users/yann/spx-app/node_modules/playwright');
const fs = require('fs');
const BASE = process.env.BASE, TOK = process.env.TOK, OUT = process.env.OUT;
const cas = JSON.parse(process.argv[2]); // [{id, path, theme, mt, pseudo, actions, btn, capture}]
(async () => {
  const b = await chromium.launch();
  for (const c of cas) {
    const ctx = await b.newContext({ viewport:{width:1440,height:1000}, acceptDownloads:true, colorScheme: c.cs || 'dark' });
    // 1er oct 2026 : pseudo sur le document exporte (cookie pose par user-prefs).
    if (c.pseudo) await ctx.addCookies([{ name: 'mettrik:pseudo_graph', value: c.pseudo, url: BASE }]);
    const p = await ctx.newPage();
    try {
      await p.goto(`${BASE}${c.path}${c.path.includes('?') ? '&' : '?'}audit_token=${TOK}`, { waitUntil:'networkidle', timeout:180000 });
      if (c.theme) await p.evaluate(t => document.documentElement.setAttribute('data-theme', t), c.theme);
      await p.waitForTimeout(3000);
      if (c.courbe) { await p.locator('button:visible', { hasText: 'Courbe' }).first().click(); await p.waitForTimeout(2500); }
      if (c.annuel) { await p.getByRole('button', { name: /^Annuel$/ }).first().click(); await p.waitForTimeout(2500); }
      // 1er oct 2026 (blocs admin) : actions avant export (choix dans une liste, clics).
      for (const a of (c.actions || [])) {
        if (a.select) {
          const sel = p.locator(a.select).first();
          if (a.index != null) await sel.selectOption({ index: a.index });
          else if (a.longest) {
            // option au libelle le plus long (cas extreme « titre long »)
            const i = await sel.evaluate((el) => { let m = 0, k = 0; Array.from(el.options).forEach((o, j) => { if (o.value && o.text.length > m) { m = o.text.length; k = j; } }); return k; });
            await sel.selectOption({ index: i });
          } else await sel.selectOption(a.value);
        }
        if (a.click) { const l = p.locator(a.click).first(); await l.scrollIntoViewIfNeeded(); await l.click(); }
        await p.waitForTimeout(a.wait || 800);
      }
      if (c.capture) { const z = p.locator(c.capture).first(); await z.scrollIntoViewIfNeeded(); await p.waitForTimeout(500); await z.screenshot({ path: `${OUT}/${c.id}-bloc.png` }); }
      let btn;
      if (c.btn) { btn = p.locator(c.btn).first(); }
      else if (c.mt) { btn = p.locator('[aria-label="Exporter le graphique"]').first(); }
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
