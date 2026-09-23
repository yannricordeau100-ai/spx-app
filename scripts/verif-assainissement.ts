import { loadV17Company } from "../src/lib/company-core/load-company";
import { assainirPourClient, REGLES_ASSAINISSEMENT } from "../src/lib/company-core/assainir-payload";

const TICKERS = ["AAPL","NFLX","PLTR","MC.PA","DPW.DE","OR.PA","BNP.PA","NVDA","O","T","ASML","RMS.PA"];

function feuilles(o: unknown, chemin = "", acc: Map<string,unknown> = new Map()) {
  if (Array.isArray(o)) { o.forEach((v,i)=>feuilles(v, `${chemin}[${i}]`, acc)); return acc; }
  if (o && typeof o === "object") { for (const [k,v] of Object.entries(o as object)) feuilles(v, chemin?`${chemin}.${k}`:k, acc); return acc; }
  acc.set(chemin, o); return acc;
}

(async () => {
  let totalPerdu = 0, totalFuites = 0;
  for (const t of TICKERS) {
    const r = await loadV17Company(t, { mode: "v18", locale: "fr" });
    if (r.kind !== "ready") { console.log(`${t}: non charge (${r.kind})`); continue; }
    const avant = feuilles(r.company);
    const apres = feuilles(assainirPourClient(r.company));
    const perdus = [...avant.keys()].filter(k => !apres.has(k));
    // fuites restantes apres assainissement
    const fuites = [...apres.entries()].filter(([,v]) => typeof v === "string" && REGLES_ASSAINISSEMENT.MARQUE_INTERNE.test(v));
    // ce qui compte : rien de visible ne doit disparaitre
    const visiblesPerdus = perdus.filter(k => !/(^|\.)_/.test(k) && !/\.(model|extracted_by|script|source_file|source_path|method|marked_by|batch|by|extractor|verified_by|validated_by|file_old|file_latest|source_10k|source_backup|ceo_name_evidence|extracted_by_mission20|last_extended_by)$/.test(k));
    totalPerdu += visiblesPerdus.length; totalFuites += fuites.length;
    console.log(`${t}: feuilles ${avant.size} -> ${apres.size} | retirees ${perdus.length} | VISIBLES perdues ${visiblesPerdus.length} | fuites restantes ${fuites.length}`);
    if (visiblesPerdus.length) console.log("   exemples visibles perdus:", visiblesPerdus.slice(0,8).join(" | "));
    if (fuites.length) console.log("   fuites restantes:", fuites.slice(0,4).map(([k,v])=>`${k}=${String(v).slice(0,70)}`).join(" | "));
  }
  console.log(`\nTOTAL visibles perdues: ${totalPerdu} | fuites restantes: ${totalFuites}`);
})();
