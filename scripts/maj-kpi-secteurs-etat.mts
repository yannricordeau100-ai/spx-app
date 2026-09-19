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
type Ste = { code?: string; hero_actuel?: string; hero_nouveau?: string; statut?: string; note?: string; points?: number; kpi_nom?: string; kpi_etat?: string; graphiques_approuves?: boolean };
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

// Yann 19 sept 2026 : la metrique reine d un secteur s exprime sous plusieurs
// libelles selon la societe (NIM, marge nette d interet, net interest yield...).
// Chaque secteur porte sa liste de fragments reconnus, normalises comme `norm`.
const MOTS_SECTEUR: Record<string, string[]> = {
  banques: ["nim", "margenettedinteret", "margedinteret", "netinterestmargin", "netinterestyield", "netyieldoninterest", "produitsnetsdinteret", "netinterestincome", "cet1"],
  assurance: ["ratiocombine", "combinedratio", "croissanceorganique", "organicgrowth", "organicrevenue"],
  petrole_gaz: ["production", "boe", "barils", "barrels", "tauxderemplacement", "reservereplacement", "dcf", "distributablecashflow", "debit", "throughput", "raffinage", "refining"],
  utilities: ["basedactifs", "ratebase", "actifsregule", "roeautorise", "capaciteinstallee", "installedcapacity", "generatingcapacity", "productionnette", "netgeneration"],
  assureurs_sante: ["mlr", "medicallossratio", "ratiodesinistralite", "benefitexpenseratio", "healthbenefitsratio", "ratiodedepensesmedicales", "medicalcostratio"],
  hotels_casinos: ["revpar", "produitbrutdesjeux", "grossgamingrevenue", "nuitees", "nightsbooked", "rendementnet", "netyield"],
  mines: ["aisc", "allinsustaining", "production", "expeditions", "shipments", "tonnes"],
  services_petroliers: ["carnet", "backlog", "rpo", "tauxdutilisation", "utilization"],
  gestion_actifs_credit: ["aum", "actifssousgestion", "assetsundermanagement", "encours", "tauxdepertes", "netchargeoff", "lossrate", "cet1", "margedinteret", "nim", "asv", "subscriptionvalue", "abonnements"],
  logiciel: ["arr", "nrr", "netretention", "rpo", "crpo", "remainingperformance"],
  courtiers_assurance: ["croissanceorganique", "organicgrowth", "organicrevenue", "croissancesousjacente", "underlyinggrowth"],
  siderurgie: ["expeditions", "shipments", "tonnes", "tons"],
  recherche_clinique: ["booktobill", "commandessurfacturations", "carnet", "backlog"],
  croisieres: ["rendementnet", "netyield", "yieldparjour", "netyields", "apcd", "albd"],
  semi_conducteurs_equipements: ["netbookings", "bookings", "prisesdecommandes", "systemesvendus", "systemssold", "commandes"],
};
const reconnu = (secteur: string, k: any): boolean => {
  const mots = MOTS_SECTEUR[secteur] ?? [];
  const nh = norm(k?.name_fr) + "|" + norm(k?.name_en) + "|" + norm(k?.short);
  return mots.some((m) => m.length >= 3 && nh.includes(m));
};

// Yann 19 sept 2026 : une societe dont au moins un graphique moyen terme est
// approuve (table desk_image_findings) passe en vert dans « KPI star par
// secteur », meme si la metrique reine n existe pas encore en KPI long terme.
const approuves = new Set<string>();
try {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data } = await sb.from("desk_image_findings").select("target_tickers, approved, rejected");
  for (const f of (data ?? []) as { target_tickers?: unknown; approved?: boolean; rejected?: boolean }[]) {
    if (f.approved !== true || f.rejected === true) continue;
    const tt = f.target_tickers;
    const l = Array.isArray(tt) ? tt.map(String) : typeof tt === "string" ? tt.replace(/[\[\]'\"]/g, "").split(",") : [];
    for (const t of l) if (t.trim()) approuves.add(t.trim().toUpperCase());
  }
} catch { /* base indisponible : on ne change rien */ }

let n = 0, ko = 0;
for (const [secteurId, sect] of Object.entries(doc.secteurs)) {
  for (const [t, ste] of Object.entries(sect.societes)) {
    n++;
    try {
      const r: any = await loadV17Company(t, { mode: "v18" } as any);
      const co: any = r?.company ?? r;
      if (!co || !Array.isArray(co.kpis) || !co.kpis.length) { ste.kpi_etat = "absent"; ste.kpi_nom = "fiche introuvable"; ko++; continue; }
      const cible = String(ste.hero_nouveau ?? ste.hero_actuel ?? "");
      const he = heroEffectif(co);
      const heK = co.kpis.find((k: any) => k.short === he);
      // 1. Le heros effectif porte-t-il la metrique reine du secteur ?
      let k: any = heK && reconnu(secteurId, heK) ? heK : undefined;
      // 2. Sinon le short cible du chantier, puis tout KPI dont le nom evoque la metrique.
      if (!k) k = co.kpis.find((x: any) => x.short === cible) ?? co.kpis.find((x: any) => norm(x.short) === norm(cible));
      if (!k) {
        const cands = co.kpis.filter((x: any) => reconnu(secteurId, x));
        cands.sort((a: any, b: any) => (Array.isArray(b.history) ? b.history.length : 0) - (Array.isArray(a.history) ? a.history.length : 0));
        k = cands[0];
      }
      ste.graphiques_approuves = approuves.has(t.toUpperCase());
      if (!k) {
        ste.kpi_nom = cible || "(non defini)";
        ste.kpi_etat = ste.graphiques_approuves ? "moyen_terme" : "absent";
        if (!ste.graphiques_approuves) ko++;
        continue;
      }
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
