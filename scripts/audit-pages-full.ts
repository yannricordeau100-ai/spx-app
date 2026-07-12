/**
 * Audit "zéro erreur pages stés" — Yann 11 juil 2026.
 *
 * Utilise le VRAI loader runtime (loadV17Company) puis réplique les règles
 * d'affichage EXACTES des composants pour détecter tout ce qu'un humain
 * verrait de cassé sur la page, sans ouvrir le navigateur :
 *
 *  - R1 risks_uniform_ui : le score UI (score>0 sinon severity sinon 3,
 *    cf risk-stack.tsx) est identique sur tous les risques.
 *  - R2 risks_too_few   : < 5 risques affichés.
 *  - R3 risks_no_rationale : au moins un risque sans score_rationale.
 *  - K1 kpi_quarterly_no_last_date : KPI quarterly sans last_data_date
 *    → chart-template renvoie emptySpec → GRAPH VIDE à l'écran.
 *  - K2 kpi_periods_mismatch : history_periods présent mais longueur ≠ history.
 *  - K4 kpi_history_empty : KPI affiché sans aucune history (pas de graph).
 *  - H1 hero_unresolvable : hero_kpi ne résout vers aucun KPI.
 *  - H2 hero_short : le hero rendu couvre < 5 ans (annual <5 pts ou
 *    quarterly <17 pts), alors que le but est min 5 ans.
 *  - S1 stories_none : hasStories() false → bloc Stories absent.
 *  - S2 stories_thin : < 2 stories usables (bloc quasi vide).
 *
 * Sortie : .conv-state/audit-pages-report.json
 * Usage : npx tsx scripts/audit-pages-full.ts [TICKER ...]
 */
import fs from "node:fs";
import path from "node:path";
import { loadV17Company } from "../src/lib/company-core/load-company";
import { hasStories, buildStories } from "../src/lib/kpi-stories-ordering";
import type { KPI } from "../src/lib/data";

const ROOT = process.cwd();

type Issue = { code: string; detail: string };

function uiRiskScore(r: { score?: unknown; severity?: unknown }): number {
  const sc = r.score;
  if (typeof sc === "number" && sc > 0) return sc;
  const sev = r.severity as number | undefined;
  if (typeof sev === "number" && sev > 0) return sev;
  return 3;
}

function isQuarterKpi(k: KPI): boolean {
  const pt = (k as unknown as { period_type?: string }).period_type;
  const freq = (k as unknown as { frequency?: string }).frequency;
  return pt === "quarter" || freq === "quarterly";
}

async function auditTicker(t: string): Promise<{ ticker: string; issues: Issue[] }> {
  const issues: Issue[] = [];
  const outcome = await loadV17Company(t, { mode: "v18" });
  if (outcome.kind !== "ready") {
    issues.push({ code: "LOAD", detail: `loader kind=${outcome.kind}` });
    return { ticker: t, issues };
  }
  const c = outcome.company;

  // ---- Risques (règle UI exacte de risk-stack.tsx) ----
  const risks = (c.risks ?? []) as Array<{
    score?: number; severity?: number; score_rationale?: string; title?: string;
  }>;
  if (risks.length === 0) {
    issues.push({ code: "R0", detail: "aucun risque" });
  } else {
    const uiScores = risks.map(uiRiskScore);
    if (new Set(uiScores).size <= 1)
      issues.push({ code: "R1", detail: `score UI uniforme=${uiScores[0]} sur ${uiScores.length} risques` });
    if (risks.length < 5)
      issues.push({ code: "R2", detail: `${risks.length} risques (<5)` });
    const noRat = risks.filter(r => !(r.score_rationale ?? "").trim()).length;
    if (noRat > 0)
      issues.push({ code: "R3", detail: `${noRat}/${risks.length} sans score_rationale` });
  }

  // ---- KPI indicateurs clés ----
  const kpis = (c.kpis ?? []) as KPI[];
  const nonStoryKpis = kpis.filter(k => !(k as unknown as { is_short_history?: boolean }).is_short_history);
  for (const k of nonStoryKpis) {
    const hist = (k.history ?? []) as unknown[];
    const short = k.short ?? "?";
    if (hist.length === 0) {
      issues.push({ code: "K4", detail: `${short}: history vide` });
      continue;
    }
    const lastDate = (k as unknown as { last_data_date?: string }).last_data_date;
    const periods = (k as unknown as { history_periods?: unknown[] }).history_periods;
    if (isQuarterKpi(k) && !(lastDate ?? "").trim()) {
      issues.push({ code: "K1", detail: `${short}: quarterly sans last_data_date (graph vide)` });
    }
    if (Array.isArray(periods) && periods.length > 0 && periods.length !== hist.length) {
      issues.push({ code: "K2", detail: `${short}: periods=${periods.length} vs history=${hist.length}` });
    }
  }

  // ---- Hero ----
  const heroShort = (c.hero_kpi ?? "").trim();
  const norm = (s: string) => s.trim().toLowerCase();
  const hero = nonStoryKpis.find(k => norm(k.short ?? "") === norm(heroShort))
    ?? kpis.find(k => norm(k.short ?? "") === norm(heroShort));
  if (heroShort && !hero) {
    issues.push({ code: "H1", detail: `hero_kpi="${heroShort}" ne résout vers aucun KPI` });
  } else if (hero) {
    const h = (hero.history ?? []) as unknown[];
    const q = isQuarterKpi(hero);
    const lastDate = (hero as unknown as { last_data_date?: string }).last_data_date;
    const renderable = h.length > 0 && (!q || !!(lastDate ?? "").trim());
    if (!renderable) issues.push({ code: "H2", detail: `hero "${hero.short}" non rendable (hist=${h.length}, q=${q}, last_date=${lastDate ?? "∅"})` });
    else if (q && h.length < 17) issues.push({ code: "H2", detail: `hero "${hero.short}" quarterly ${h.length} pts (<17 = <5 ans)` });
    else if (!q && h.length < 5) issues.push({ code: "H2", detail: `hero "${hero.short}" annuel ${h.length} pts (<5 ans)` });
  }

  // ---- Répartition CA : segments / geography ----
  // Accepte 2+ slices OU tags _single_segment / _single_geography /
  // _geography_not_disclosed / single_region_legitimate (mono-segment /
  // mono-region légitime documenté).
  const seg = (c as unknown as { revenue_by_segment?: Record<string, unknown> }).revenue_by_segment;
  const segSlices = seg && Array.isArray(seg.slices) ? (seg.slices as unknown[]).length : 0;
  const segSingle = !!(seg && (seg._single_segment || seg.single_segment || seg._single_segment_legitimate || seg.single_segment_legitimate));
  if (segSlices < 2 && !segSingle) {
    issues.push({ code: "SEG", detail: `segments slices=${segSlices} sans tag _single_segment` });
  }
  const geo = (c as unknown as { revenue_by_geography?: Record<string, unknown> }).revenue_by_geography;
  const geoSlices = geo && Array.isArray(geo.slices) ? (geo.slices as unknown[]).length : 0;
  const geoSingle = !!(geo && (geo._single_geography || geo.single_geography || geo._geography_not_disclosed || geo.geography_not_disclosed || geo.single_region_legitimate || geo._single_region_legitimate));
  if (geoSlices < 2 && !geoSingle) {
    issues.push({ code: "GEO", detail: `geography slices=${geoSlices} sans tag _single_geography/_geography_not_disclosed` });
  }

  // ---- Stories (règle UI exacte) ----
  const mp = (c as unknown as { market_positions?: unknown[] }).market_positions as never[] | undefined;
  if (!hasStories(kpis, mp)) {
    issues.push({ code: "S1", detail: "bloc Stories absent (aucune story usable)" });
  } else {
    const st = buildStories(kpis, mp);
    const n = Array.isArray(st) ? st.length : 0;
    if (n < 2) issues.push({ code: "S2", detail: `${n} story usable seulement` });
  }

  return { ticker: t, issues };
}

async function main() {
  const args = process.argv.slice(2);
  const list: string[] = args.length
    ? args
    : (JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/sp500-tickers.json"), "utf8")) as string[])
        .map(s => s.toUpperCase());

  const report: Record<string, Issue[]> = {};
  let done = 0;
  for (const t of list) {
    try {
      const r = await auditTicker(t);
      if (r.issues.length) report[t] = r.issues;
    } catch (e) {
      report[t] = [{ code: "CRASH", detail: String(e).slice(0, 200) }];
    }
    done++;
    if (done % 50 === 0) console.log(`...${done}/${list.length}`);
  }

  const stats: Record<string, number> = {};
  for (const issues of Object.values(report))
    for (const i of issues) stats[i.code] = (stats[i.code] ?? 0) + 1;

  const out = {
    generated_at: new Date().toISOString(),
    audited: list.length,
    stes_with_issues: Object.keys(report).length,
    stats,
    report,
  };
  fs.writeFileSync(path.join(ROOT, ".conv-state/audit-pages-report.json"), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ audited: list.length, stes_with_issues: Object.keys(report).length, stats }, null, 1));
}

main();
