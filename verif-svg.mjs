import { chromium } from 'playwright'; import fs from 'fs';
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:1000,height:600} });
const svg = fs.readFileSync('public/findings/demande-2/asml-docs-01-dark.svg','utf8');
await p.setContent(`<body style="margin:0;background:#000">${svg}</body>`); await p.waitForTimeout(500);
await p.screenshot({ path:'/tmp/svg_nettoye.png' }); await b.close(); console.log('rendu ok');
