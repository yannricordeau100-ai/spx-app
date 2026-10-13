// Controle des libelles francais (13 oct 2026) : sous-industrie en anglais et gabarit IA de remplissage.
import { loadV17Company } from "../src/lib/company-core/load-company";
import { libelleAnglais } from "../src/lib/company-core/libelles-fr";
import * as fs from "fs";

const REMPLISSAGE = /disponibles localement|valuera le positionnement|ne met pas le sujet en avant|commence . int.grer l'IA|Aucune mention significative d'IA|Mettrik AI/i;
const ANGLAIS_IA = /\b(the|and|of|with|its|is|are|has)\b/i;
(async () => {
  const U = JSON.parse(fs.readFileSync("src/data/v1-9-5-clean-all-tickers.json", "utf8")).tickers as string[];
  const only = process.argv.slice(2);
  let nSub = 0, nIa = 0, nNonCharge = 0; const subs: string[] = [], ia: string[] = [];
  const ex: Record<string, unknown> = {};
  for (const t of (only.length ? only : U)) {
    const r = await loadV17Company(t, { mode: "v18", locale: "fr" });
    if (r.kind !== "ready") { nNonCharge++; continue; }
    const c = r.company as unknown as Record<string, any>;
    if (typeof c.subsector === "string" && libelleAnglais(c.subsector)) { nSub++; subs.push(`${t}:${c.subsector}`); }
    const a = c.ai_positioning;
    const txt = a ? JSON.stringify([a.summary, a.evidence]) : "";
    if (a && (REMPLISSAGE.test(txt))) { nIa++; ia.push(t); }
    if (only.length) ex[t] = { subsector: c.subsector, ai: a };
  }
  console.log(`non charges ${nNonCharge} | sous-industrie anglaise restante ${nSub} | gabarit IA restant ${nIa}`);
  if (subs.length) console.log(subs.slice(0, 30).join(" | "));
  if (ia.length) console.log("IA:", ia.join(","));
  if (only.length) console.log(JSON.stringify(ex, null, 1));
})();
