/**
 * maj-kpi-secteurs-etat.mts (Yann 18 sept 2026) : pour chaque societe du
 * chantier « KPI star par secteur », relit la fiche REELLEMENT servie et note
 * le nom du KPI vise et son etat : en heros, present sans etre heros, absent.
 * Ecrit src/data/kpi-secteurs-etat.json (champs kpi_nom et kpi_etat).
 * Usage : source .env.local && npx tsx scripts/maj-kpi-secteurs-etat.mts
 */
import fs from "fs";
import path from "path";
import { loadV17Company } from "./../src/lib/company-core/load-company";
import { isGenericKpi } from "./../src/lib/kpi-generic";
import { isTotalRevenueLabel, normalizeKpiShort } from "./../src/lib/kpi-total-revenue";

const P = path.join(process.cwd(), "src/data/kpi-secteurs-etat.json");
type Ste = { code?: string; hero_actuel?: string; hero_nouveau?: string; statut?: string; note?: string; points?: number; kpi_nom?: string; kpi_etat?: string };
type Sect = { statut: string; kpi_star: { star: string[]; choix: string; freq: string }; societes: Record<string, Ste> };
const doc = JSON.parse(fs.readFileSync(P, "utf8")) as { secteurs: Record<string, Sect>; cree_le?: string; maj_le?: string };

const num = (x: unknown): number | null => {
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  if (typeof x === "string") { const n = parseFloat(x.replace(/\s/g, "").replace(/,/g, ".")); return Number.isFinite(n) ? n : null; }
  return null;
};
const hist = (k: any): unknown[] => (Array.isArray(k?.history) ? k.history : []);
const pctMarg = (k: any) => {
  const u = String(k?.unit || "").trim(); const s = String(k?.short || "");
  return u === "%" || /margin|marge|ratio|taux|growth|croissance|yield|rendement/i.test(s) || ["GM", "ROE", "ROTE", "ROIC", "ROA", "ROCE", "NIM", "ROTCE"].includes(s);
};
const usable = (k: any) => k && num(k.value) !== null && num(k.value) !== 0 && hist(k).length > 0;

function heroEffectif(co: any): string {
  const cfgK = co.kpis.find((k: any) => k.short === co.hero_kpi);
  const force = co.hero_kpi_force === true;
  const cfgQ = cfgK && cfgK.period_type === "quarter" && hist(cfgK).length >= 4;
  if (usable(cfgK) && force && hist(cfgK).length >= 6) return co.hero_kpi;
  if (usable(cfgK) && cfgQ && !pctMarg(cfgK)) return co.hero_kpi;
  if (usable(cfgK) && !pctMarg(cfgK) && hist(cfgK).length >= 3 && !isGenericKpi(cfgK?.short) && !isTotalRevenueLabel(normalizeKpiShort(cfgK.short))) return co.hero_kpi;
  let best: { short: string; h: number } | null = null;
  for (const k of co.kpis) {
    if (k.period_type !== "quarter" || pctMarg(k) || isGenericKpi(k?.short)) continue;
    if (isTotalRevenueLabel(normalizeKpiShort(k.short))) continue;
    const h = hist(k).length; if (h < 16) continue;
    if (!best || h > best.h) best = { short: k.short, h };
  }
  if (best) return best.short;
  if (usable(cfgK) && !pctMarg(cfgK)) return co.hero_kpi;
  return co.kpis.find((k: any) => usable(k) && hist(k).length >= 3 && !pctMarg(k) && !isGenericKpi(k?.short))?.short ?? co.hero_kpi;
}

const norm = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

let n = 0, ko = 0;
for (const [, sect] of Object.entries(doc.secteurs)) {
  for (const [t, ste] of Object.entries(sect.societes)) {
    n++;
    try {
      const r: any = await loadV17Company(t, { mode: "v18" } as any);
      const co: any = r?.company ?? r;
      if (!co || !Array.isArray(co.kpis) || !co.kpis.length) { ste.kpi_etat = "absent"; ste.kpi_nom = "fiche introuvable"; ko++; continue; }
      const cible = String(ste.hero_nouveau ?? ste.hero_actuel ?? "");
      const he = heroEffectif(co);
      const heK = co.kpis.find((k: any) => k.short === he);
      let k = co.kpis.find((x: any) => x.short === cible)
        ?? co.kpis.find((x: any) => norm(x.short) === norm(cible))
        ?? co.kpis.find((x: any) => norm(x.name_fr) === norm(cible) || norm(x.name_en) === norm(cible));
      if (!k && heK) {
        // la metrique reine peut avoir ete posee sous un autre short : on accepte
        // le heros quand son nom evoque la metrique du secteur.
        const mots = sect.kpi_star.star.map(norm).filter(Boolean);
        const nh = norm(heK.name_fr) + " " + norm(heK.name_en) + " " + norm(heK.short);
        if (mots.some((m) => m.length > 4 && nh.includes(m))) k = heK;
      }
      if (!k) { ste.kpi_etat = "absent"; ste.kpi_nom = cible || "(non defini)"; ko++; continue; }
      ste.kpi_nom = String(k.name_fr || k.name_en || k.short);
      ste.kpi_etat = k.short === he ? "heros" : "present";
    } catch {
      ste.kpi_etat = "absent"; ste.kpi_nom = "erreur de lecture"; ko++;
    }
  }
}
doc.maj_le = new Date().toISOString().slice(0, 10);
fs.writeFileSync(P, JSON.stringify(doc, null, 1));
console.log(`societes ${n} | absents ${ko}`);
