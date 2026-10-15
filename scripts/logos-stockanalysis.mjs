// 15 oct 2026 (Yann) : logos de stockanalysis pour toutes les societes, ordre alphabetique, sans modele IA.
// Telecharge logos.stockanalysis.com/<t>.svg, rend en PNG 512 sur fond blanc avec 14 % de marge (Playwright),
// compare a l actuel (scripts/logos-compare.py, empreinte perceptuelle) : remplace seulement si < 95 % identique.
// Usage : node scripts/logos-stockanalysis.mjs [lettre_depart]
import fs from "node:fs"; import { execFileSync } from "node:child_process"; import { chromium } from "playwright";
const D = "data-lake/_logos-stockanalysis";
const u = JSON.parse(fs.readFileSync("src/data/v1-9-5-clean-all-tickers.json", "utf8")); const n1 = JSON.parse(fs.readFileSync("src/data/univers-sp5001000.json", "utf8"));
const tickers = [...new Set([...(u.tickers || u), ...n1.tickers])].filter((t) => !t.includes(".")).sort();
const depart = process.argv[2] || "A";
const journal = fs.createWriteStream(`${D}/journal.jsonl`, { flags: "a" });
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 512, height: 512 } });
let n = 0, rempl = 0, ident = 0, absent = 0;
for (const t of tickers.filter((x) => x >= depart)) {
  n++; const safe = t.replace(/\./g, "-"); const cible = `public/logos/${safe}.png`;
  let svg; try { const r = await fetch(`https://logos.stockanalysis.com/${t.toLowerCase().replace(/\./g, "-")}.svg`); if (!r.ok) throw 0; svg = await r.text(); if (!svg.includes("<svg")) throw 0; } catch { absent++; journal.write(JSON.stringify({ t, etat: "absent" }) + "\n"); continue; }
  fs.writeFileSync(`${D}/svg/${safe}.svg`, svg);
  await p.setContent(`<html><body style="margin:0;background:#fff;width:512px;height:512px;display:flex;align-items:center;justify-content:center"><div style="width:369px;height:369px;display:flex;align-items:center;justify-content:center">${svg.replace("<svg", '<svg style="max-width:100%;max-height:100%;width:100%;height:100%"')}</div></body></html>`);
  const tmp = `${D}/tmp-${safe}.png`; await p.screenshot({ path: tmp });
  let sim = 0; if (fs.existsSync(cible)) { try { sim = parseFloat(execFileSync("python3", ["scripts/logos-compare.py", cible, tmp]).toString()); } catch {} }
  if (sim >= 0.95) { ident++; fs.unlinkSync(tmp); journal.write(JSON.stringify({ t, etat: "identique", sim }) + "\n"); continue; }
  if (fs.existsSync(cible)) fs.copyFileSync(cible, `${D}/sauvegarde/${safe}.png`);
  fs.renameSync(tmp, cible); rempl++; journal.write(JSON.stringify({ t, etat: "remplace", sim }) + "\n");
  if (n % 50 === 0) console.log(t, n, "remplaces", rempl, "identiques", ident, "absents", absent);
}
await b.close(); console.log("FIN", n, "remplaces", rempl, "identiques", ident, "absents", absent);
