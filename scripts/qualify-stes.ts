/**
 * qualify-stes.ts — QUALIFIEUR DÉTERMINISTE ("béton armé") V195.
 *
 * But (Yann 9 juin 2026) : exploiter à 100% les données déjà extraites sans
 * re-dépenser de tokens. Pour chaque sté, charge le RENDU RÉEL (loadV17Company,
 * = exactement ce que la page affiche) et applique TOUTES les règles sans
 * exception. La non-contamination est la colonne vertébrale.
 *
 * PASS = publiable tel quel (0 token). FAIL = liste précise des trous à fixer.
 *
 * Usage : source .env.local && npx tsx scripts/qualify-stes.ts NVDA AAPL MSFT ...
 * Sortie : console + /tmp/qualify-pass.json (liste des PASS) + /tmp/qualify-fail.json
 */
import { loadV17Company } from "../src/lib/company-core/load-company";
import fs from "fs";

function num(x: any): number | null {
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  if (typeof x === "string") {
    const n = parseFloat(x.replace(/\s/g, "").replace(/,/g, "."));
    return isNaN(n) ? null : n;
  }
  if (x && typeof x === "object" && typeof x.value !== "undefined") return num(x.value);
  return null;
}
function hist(k: any): number[] {
  return (k.history || []).map(num).filter((x: any) => x !== null) as number[];
}

// KPI génériques (non haut-de-gamme) : interdits à l'affichage sauf hero manuel.
const GEN = new Set([
  "total revenue", "revenue", "revenues", "net sales", "total revenues", "net revenue",
  "operating revenue", "ca", "chiffre d'affaires", "total net sales", "net income",
  "net earnings", "eps", "diluted eps", "ebitda", "fcf", "free cash flow",
  "operating margin", "op margin", "gross margin", "headcount", "capex", "r&d",
  "operating income", "total assets", "total debt", "net debt", "market cap",
  "earnings", "net earnings", "capital return", "cap return", "operating cash flow",
  "op cash flow", "cash flow", "dps", "payout ratio", "buybacks", "dividend per share",
  "restructuring charges", "restructuring", "sg&a", "selling general", "interest expense",
  "income tax", "provision for income taxes", "selling, general and administrative",
]);
const TOTAL_REV = new Set(["total revenue", "revenue", "revenues", "net sales", "total revenues", "total net sales", "operating revenue"]);
function isGen(k: any): boolean {
  return k.is_generic === true || GEN.has(String(k.short || "").toLowerCase());
}

// Yann 9 juin 2026 : seuil profondeur = ~5 ans (≥16 trim/4 ans accepté si
// propre, extension vers 20 en tâche de fond après). Annuel ≥5 ans, semestre ≥8.
const MIN_Q = 16, MIN_S = 8, MIN_Y = 5, MIN_SPECIFIC = 4;
const raw = process.argv.slice(2);

(async () => {
  const pass: string[] = [];
  const fail: { t: string; reasons: string[] }[] = [];
  for (const t of raw) {
    const TU = t.toUpperCase();
    const reasons: string[] = [];
    try {
      const r: any = await loadV17Company(t, { mode: "v18" } as any);
      const co: any = r?.company ?? r;
      if (!co || !Array.isArray(co.kpis) || co.kpis.length === 0) {
        fail.push({ t: TU, reasons: ["REDIRECT/empty (pas de page)"] });
        console.log("❌ FAIL", TU, "| REDIRECT/empty");
        continue;
      }
      const totK = co.kpis.find((k: any) => TOTAL_REV.has(String(k.short || "").toLowerCase()));
      const totv = totK ? num(totK.value) : null;

      // HERO RÉEL AFFICHÉ : réplique effectiveDefaultHero de company-view.
      // Si le hero configuré n'est pas quarterly-usable, la page bascule sur le
      // meilleur KPI quarterly NON-% NON-générique, sinon fallback.
      const usableK = (k: any) => k && num(k.value) !== null && num(k.value) !== 0 && hist(k).length > 0;
      const pctMarg = (k: any) => {
        const u = String(k?.unit || "").trim();
        const s = String(k?.short || "");
        return u === "%" || /margin|marge|ratio|taux|growth|croissance|yield|rendement/i.test(s) || ["GM", "ROE", "ROTE", "ROIC", "ROA", "ROCE", "NIM", "ROTCE"].includes(s);
      };
      const bestQ = (() => {
        let b: any = null;
        for (const k of co.kpis) {
          if (k.period_type !== "quarter" || pctMarg(k) || isGen(k)) continue;
          const h = hist(k).length;
          if (h < 4) continue;
          if (!b || h > b.h) b = { short: k.short, h };
        }
        return b ? b.short : null;
      })();
      const cfgK = co.kpis.find((k: any) => k.short === co.hero_kpi);
      const cfgQ = cfgK && cfgK.period_type === "quarter" && hist(cfgK).length >= 4;
      let hero: string;
      if (usableK(cfgK) && cfgQ && !pctMarg(cfgK)) hero = co.hero_kpi;
      else if (bestQ) hero = bestQ;
      else if (usableK(cfgK) && !pctMarg(cfgK)) hero = co.hero_kpi;
      else hero = co.kpis.find((k: any) => usableK(k) && hist(k).length >= 3 && !pctMarg(k) && !isGen(k))?.short ?? co.hero_kpi;
      const hk = co.kpis.find((k: any) => k.short === hero);
      if (!hk) reasons.push(`hero introuvable (${hero})`);
      else {
        if (pctMarg(hk)) reasons.push("hero % / marge (interdit)");
        if (isGen(hk)) reasons.push("hero générique (interdit)");
        const hv = num(hk.value);
        const hh = hist(hk);
        if (hv === null || hv === 0) reasons.push("hero vide/0");
        if (hv !== null && totv !== null && Math.abs(hv - totv) <= Math.abs(totv) * 0.01 && !isGen(hk))
          reasons.push("hero = CA total (CONTAMINATION)");
        const pt = String(hk.period_type || "").toLowerCase();
        const need = pt.includes("quart") ? MIN_Q : pt.includes("semest") ? MIN_S : MIN_Y;
        if (hh.length < need) reasons.push(`hero profondeur ${hh.length}<${need} (${pt || "year?"})`);
        if (hh.length >= 4) {
          const d = hh.slice(1).map((x, i) => Math.round((x - hh[i]) * 1e6) / 1e6);
          if (new Set(d).size === 1) reasons.push("hero historique linéaire synthétique");
          if (new Set(hh).size === 1) reasons.push("hero historique plat");
        }
      }

      // INDICATEURS haut-de-gamme (spécifiques) affichés
      const spec = co.kpis.filter(
        (k: any) => !isGen(k) && !k.is_short_history && (num(k.value) !== null || hist(k).length > 0),
      );
      if (spec.length < MIN_SPECIFIC) reasons.push(`KPIs spécifiques ${spec.length}<${MIN_SPECIFIC}`);

      // CONTAMINATION transverse : doublon d'historique + value = CA total
      const sigs: Record<string, string[]> = {};
      for (const k of co.kpis) {
        const h = hist(k);
        if (h.length >= 4) {
          const s = h.map((x) => Math.round(x * 1000) / 1000).join(",");
          (sigs[s] = sigs[s] || []).push(k.short);
        }
      }
      const genShort = (sh: string) => {
        const kk = co.kpis.find((x: any) => x.short === sh);
        return kk ? isGen(kk) || pctMarg(kk) : false;
      };
      for (const s in sigs)
        if (sigs[s].length > 1 && sigs[s].some((sh: string) => !genShort(sh)))
          reasons.push("DUP historique[" + sigs[s].join("=") + "]");
      for (const k of co.kpis) {
        const v = num(k.value);
        if (v !== null && totv !== null && Math.abs(v - totv) <= Math.abs(totv) * 0.01 && !isGen(k))
          reasons.push(String(k.short) + " = CA total");
      }

      if (reasons.length === 0) {
        pass.push(TU);
        console.log("✅ PASS", TU, "| hero=" + JSON.stringify(hero) + " v=" + (hk ? hk.value : "?") + " | spécifiques=" + spec.length);
      } else {
        fail.push({ t: TU, reasons });
        console.log("❌ FAIL", TU, "| hero=" + JSON.stringify(hero) + " | " + reasons.join(" ; "));
      }
    } catch (e: any) {
      fail.push({ t: TU, reasons: ["ERR " + String(e).slice(0, 80)] });
      console.log("❌ FAIL", TU, "| ERR", String(e).slice(0, 80));
    }
  }
  fs.writeFileSync("/tmp/qualify-pass.json", JSON.stringify(pass));
  fs.writeFileSync("/tmp/qualify-fail.json", JSON.stringify(fail, null, 2));
  console.log("\n=== PASS (" + pass.length + "/" + raw.length + ") : " + (pass.join(",") || "(aucune)") + " ===");
})();
