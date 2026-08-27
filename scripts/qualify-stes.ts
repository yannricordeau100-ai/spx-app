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
import { isGenericKpi } from "../src/lib/kpi-generic";
import { isTotalRevenueLabel, normalizeKpiShort } from "../src/lib/kpi-total-revenue";
import { isAccountingKpi } from "../src/lib/kpi-accounting";
import fs from "fs";

// 9 aout 2026 : GATE DE VISIBILITE. La page V1.9.5
// (src/app/sandbox/v1-9-5/[ticker]/page.tsx) redirige vers l'overview toute
// ste absente de v1-9-5-clean-all-tickers.json, MEME si loadV17Company rend
// des KPIs. Sans ce controle le qualifieur declarait PASS des stes dont la
// fiche n'existe pas (cas IMB.L, publie puis retire le 9 aout). On replique
// ici la normalisation de separateurs de la page.
const CLEAN_ALL: Set<string> = (() => {
  const out = new Set<string>();
  try {
    const raw = fs.readFileSync("src/data/v1-9-5-clean-all-tickers.json", "utf-8");
    for (const t of (JSON.parse(raw) as { tickers: string[] }).tickers) {
      const u = t.toUpperCase();
      out.add(u);
      out.add(u.replace(/\./g, "-"));
      out.add(u.replace(/-/g, "."));
    }
  } catch {}
  return out;
})();

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

// KPI générique = détection PAR NOM via la library, EXACTEMENT comme la page
// (isGenericKpi sur src/data/kpi-generic-library.json). Yann 9 juin 2026 :
// NE PLUS rejeter sur le flag `k.is_generic` (peu fiable, mal posé sur des KPIs
// spécifiques, ex AAPL "iPhone Revenue" avait is_generic=true par erreur → faux
// positif qui sur-comptait le qualifieur vs le rendu réel de la page).
// Yann 27 juil 2026 : ajout des variantes FR ("CA", "Revenu", "Chiffre d'affaires")
// vues sur les fiches europeennes, qui passaient a travers le filtre CA total.
// 11 aout 2026 : la liste des libelles de CA total vit desormais dans
// src/lib/kpi-total-revenue.ts, importee par le RENDU (company-view) ET par ce
// qualifieur. La copie locale qui vivait ici les a fait diverger : le rendu
// promouvait un CA total en hero par fallback alors que le qualifieur
// l'interdisait, d'ou 18 stes en FAIL pour un defaut qui n'existait plus.
// Source de verite unique, ne jamais la redupliquer ici.
const TOTAL_REV = { has: (s: string) => isTotalRevenueLabel(s) };
const normShort = normalizeKpiShort;

function isGen(k: any): boolean {
  return isGenericKpi(k?.short);
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
    const warnings: string[] = [];
    // 27 aout 2026 : QUALIFY_SKIP_CLEAN_GATE=1 desactive le gate pour auditer
    // les stes deja online mais absentes de clean-all (fiche qui redirige).
    if (!process.env.QUALIFY_SKIP_CLEAN_GATE && CLEAN_ALL.size && !CLEAN_ALL.has(TU)) {
      fail.push({ t: TU, reasons: ["hors clean-all-tickers (la page redirige vers l'overview)"] });
      console.log("❌ FAIL", TU, "| hors clean-all (pas de fiche)");
      continue;
    }
    try {
      const r: any = await loadV17Company(t, { mode: "v18" } as any);
      const co: any = r?.company ?? r;
      if (!co || !Array.isArray(co.kpis) || co.kpis.length === 0) {
        fail.push({ t: TU, reasons: ["REDIRECT/empty (pas de page)"] });
        console.log("❌ FAIL", TU, "| REDIRECT/empty");
        continue;
      }
      // Yann 27 juil 2026 : plusieurs KPIs "CA total" coexistent parfois (un
      // frais + un perime, ex LR.PA "CA"=8.649 et "Revenue"=6.9). On garde le
      // plus eleve, sinon la detection de contamination rate le hero.
      const totCands = co.kpis
        .filter((k: any) => TOTAL_REV.has(normShort(k.short)))
        .map((k: any) => num(k.value))
        .filter((x: any): x is number => x !== null);
      const totv = totCands.length ? Math.max(...totCands) : null;
      // Yann 10 aout 2026 : la contamination ne se compare qu'a PERIODE EGALE.
      // Un CA regional ANNUEL peut coincider a 1% pres avec un CA total
      // TRIMESTRIEL sans etre une contamination (faux positif HOT.DE :
      // CA_AP annuel 10,637 Mds face a REV_Q trimestriel 10,743 Mds).
      const perOf = (k: any) => String(k?.period_type || "").toLowerCase();
      const totByPeriod: Record<string, number> = {};
      const totKpiByPeriod: Record<string, any> = {};
      for (const k of co.kpis) {
        if (!TOTAL_REV.has(normShort(k.short))) continue;
        const v = num(k.value);
        if (v === null) continue;
        const p = perOf(k);
        if (totByPeriod[p] === undefined || v > totByPeriod[p]) {
          totByPeriod[p] = v;
          totKpiByPeriod[p] = k;
        }
      }
      const totFor = (k: any): number | null => {
        const p = perOf(k);
        // KPI sans period_type (compteurs web) : on retombe sur le max global.
        if (!p) return totv;
        return totByPeriod[p] !== undefined ? totByPeriod[p] : null;
      };
      // 15 aout 2026 : une seule valeur qui colle au CA total ne prouve RIEN.
      // Mesure du jour : apres elargissement de isTotalRevenueLabel, 7 stes
      // publiees tombaient sur une pure coincidence numerique entre grandeurs
      // sans rapport (DUK 7,6 GW face a 7,59 Mds $ ; GL 1 585 agents face a
      // 1 599,7 M USD ; FICO carnet RPO 680 face a un CA de 674 ; MCHP EBITDA
      // 12 mois face au CA du trimestre). Une contamination reelle, elle,
      // recopie la SERIE. On exige donc l'unite identique ET au moins deux
      // points anterieurs qui collent eux aussi.
      const normUnit = (u: unknown) => String(u ?? "").toLowerCase().replace(/\s+/g, "").replace(/[.$]/g, "");
      const close = (a: number, b: number) => Math.abs(a - b) <= Math.abs(b) * 0.01;
      const seriesEchoesTotal = (k: any): boolean => {
        const ref = totKpiByPeriod[perOf(k)];
        if (!ref) return false;
        if (normUnit(k.unit) !== normUnit(ref.unit)) return false;
        const a = hist(k);
        const b = hist(ref);
        if (a.length < 3 || b.length < 3) return false;
        let hits = 0;
        for (let i = 1; i <= Math.min(a.length, b.length) - 1 && i <= 5; i++) {
          const x = a[a.length - 1 - i];
          const y = b[b.length - 1 - i];
          if (typeof x === "number" && typeof y === "number" && close(x, y)) hits++;
        }
        return hits >= 2;
      };

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
          // 11 aout 2026 : aligne sur company-view, qui exclut desormais un CA
          // total de ce fallback. Sans cette ligne le qualifieur voit encore un
          // CA total la ou la page affiche le hero segment configure.
          if (TOTAL_REV.has(normShort(k.short))) continue;
          const h = hist(k).length;
          if (h < 16) continue;
          if (!b || h > b.h) b = { short: k.short, h };
        }
        return b ? b.short : null;
      })();
      const cfgK = co.kpis.find((k: any) => k.short === co.hero_kpi);
      const cfgQ = cfgK && cfgK.period_type === "quarter" && hist(cfgK).length >= 4;
      let hero: string;
      if (usableK(cfgK) && cfgQ && !pctMarg(cfgK)) hero = co.hero_kpi;
      // 15 aout 2026 : aligne sur company-view, qui ne laisse plus le fallback
      // quarterly ecraser un hero explicite VALIDE (non %, non generique, non
      // CA total, serie >=3 points). Copie locale interdite : le test vient de
      // src/lib, comme TOTAL_REV.
      else if (usableK(cfgK) && !pctMarg(cfgK) && hist(cfgK).length >= 3 && !isGen(cfgK) && !TOTAL_REV.has(normShort(cfgK.short)))
        hero = co.hero_kpi;
      else if (bestQ) hero = bestQ;
      else if (usableK(cfgK) && !pctMarg(cfgK)) hero = co.hero_kpi;
      else hero = co.kpis.find((k: any) => usableK(k) && hist(k).length >= 3 && !pctMarg(k) && !isGen(k))?.short ?? co.hero_kpi;
      const hk = co.kpis.find((k: any) => k.short === hero);
      // 12 aout 2026 : AVERTISSEMENT, pas un motif de rejet. Un hero qui est une
      // ligne comptable (resultat net, EBITDA, capex, dividende, poste de bilan)
      // ne dit rien de la demande, mais le rejeter bloquerait 30 stes sans leur
      // offrir de remplacant : la mesure du 12 aout montre que forcer le
      // fallback a les eviter les fait basculer sur une AUTRE ligne comptable
      // (24 regressions sur 639). On signale, Yann arbitre, le rendu ne change
      // pas. Le detail est dans src/data/_hero-suspect.json.
      if (hk && isAccountingKpi(hk.short)) warnings.push("hero = ligne comptable (a repointer)");
      if (!hk) reasons.push(`hero introuvable (${hero})`);
      else {
        if (pctMarg(hk)) reasons.push("hero % / marge (interdit)");
        if (isGen(hk)) reasons.push("hero générique (interdit)");
        const hv = num(hk.value);
        const hh = hist(hk);
        if (hv === null || hv === 0) reasons.push("hero vide/0");
        // Yann 27 juil 2026 : hero dont la value est une annee cible sans unite
        // (ex PSN.L "Net Zero Carbon Homes 2030" = 2030) n'est pas une mesure.
        const hu = String(hk.unit || "").trim();
        if (hv !== null && Number.isInteger(hv) && hv >= 1990 && hv <= 2060 && (!hu || /^(year|années?|annee|an)$/i.test(hu)))
          reasons.push("hero = annee cible, pas une mesure");
        const hTot = totFor(hk);
        if (hv !== null && hTot !== null && Math.abs(hv - hTot) <= Math.abs(hTot) * 0.01 && !isGen(hk) && seriesEchoesTotal(hk))
          reasons.push("hero = CA total (CONTAMINATION)");
        // 9 aout 2026 : un hero dont le nom EST un libelle de CA total doit
        // tomber meme si aucune autre valeur ne coincide (unites differentes
        // entre les KPIs, ex IMCD.AS "CA_T" en M € face a "Revenue" en Mds €).
        if (TOTAL_REV.has(normShort(hk.short))) reasons.push("hero = libelle CA total (interdit)");
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
        // Le KPI qui EST le CA total ne peut pas se signaler lui-meme comme
        // contamine : c'est la reference. Seuls les KPIs cense etre specifiques
        // et dont la valeur colle au CA total sont des contaminations.
        if (TOTAL_REV.has(normShort(k.short))) continue;
        const kTot = totFor(k);
        if (v !== null && kTot !== null && Math.abs(v - kTot) <= Math.abs(kTot) * 0.01 && !isGen(k) && seriesEchoesTotal(k))
          reasons.push(String(k.short) + " = CA total");
      }

      if (reasons.length === 0) {
        pass.push(TU);
        console.log("✅ PASS", TU, "| hero=" + JSON.stringify(hero) + " v=" + (hk ? hk.value : "?") + " | spécifiques=" + spec.length + (warnings.length ? " | ⚠ " + warnings.join(" ; ") : ""));
      } else {
        fail.push({ t: TU, reasons });
        console.log("❌ FAIL", TU, "| hero=" + JSON.stringify(hero) + " | " + reasons.join(" ; "));
      }
    } catch (e: any) {
      fail.push({ t: TU, reasons: ["ERR " + String(e).slice(0, 80)] });
      console.log("❌ FAIL", TU, "| ERR", String(e).slice(0, 80));
    }
  }
  fs.writeFileSync(process.env.QUALIFY_OUT_PASS || "/tmp/qualify-pass.json", JSON.stringify(pass));
  fs.writeFileSync(process.env.QUALIFY_OUT_FAIL || "/tmp/qualify-fail.json", JSON.stringify(fail, null, 2));
  console.log("\n=== PASS (" + pass.length + "/" + raw.length + ") : " + (pass.join(",") || "(aucune)") + " ===");
})();
