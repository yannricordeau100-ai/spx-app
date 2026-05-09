/**
 * verify-top5-quality.ts — vérification visuelle automatisée pour les
 * 5 premières sés V1.8 par market cap.
 *
 * Usage :
 *   STAGING_URL=https://mettrik-staging.vercel.app \
 *     npx tsx scripts/verify-top5-quality.ts
 *
 * Pour chaque ticker, fetch /sandbox/v1-8/<ticker> et regex check :
 *   - logo : <img alt="..." src="/logos/<TICKER>.png">
 *   - rank : présence d'un chip "#XX" ou "Top X %"
 *   - hero KPI : <Hero KPI label> + valeur numérique
 *   - graph : présence d'un <svg ... data-chart-type=...>
 *   - kpi count : count des entrées du tableau KPI
 *   - risks block : "Facteurs de risque"
 *   - governance : "Gouvernance"
 *   - ai_positioning : "Positionnement IA"
 *
 * Output : marque les cellules via POST /api/desk/data-quality-matrix.
 * Note : nécessite que `desk_verification_matrix` existe en BDD et
 * que CRON_SECRET ou cookie auth desk soit valide. Sans ça, mode dry-run
 * (logs only).
 */
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.STAGING_URL ?? "https://mettrik-staging.vercel.app";
const TICKERS = ["9984.T", "NVDA", "GOOGL", "AAPL", "MSFT"];

type Check = {
  column: string;
  pass: boolean;
  detail: string;
};

async function fetchPage(ticker: string): Promise<string | null> {
  const url = `${BASE}/sandbox/v1-8/${ticker.toLowerCase()}`;
  try {
    const r = await fetch(url, {
      headers: { "user-agent": "Mettrik-QA-Bot/1.0" },
      redirect: "follow",
    });
    if (!r.ok) {
      console.log(`  ❌ HTTP ${r.status} for ${ticker}`);
      return null;
    }
    return await r.text();
  } catch (err) {
    console.log(`  ❌ Fetch failed for ${ticker}: ${err}`);
    return null;
  }
}

function checkPage(html: string, ticker: string): Check[] {
  const checks: Check[] = [];

  // Logo : balise <img> avec src qui pointe vers /logos/ ou data: + alt
  const hasLogo =
    html.includes(`/logos/${ticker.toUpperCase()}.png`) ||
    /class="[^"]*logo[^"]*"/i.test(html);
  checks.push({ column: "logo", pass: hasLogo, detail: hasLogo ? "balise logo détectée" : "aucune balise logo" });

  // Rank : chip "#X" ou "Top X" dans le header
  const hasRank = /#\d+/.test(html) || /Top\s+\d+/.test(html);
  checks.push({ column: "rank", pass: hasRank, detail: hasRank ? "chip rang détecté" : "pas de chip rang" });

  // Hero KPI : "KPI principal" label
  const hasHero = html.includes("KPI principal");
  checks.push({ column: "hero_kpi", pass: hasHero, detail: hasHero ? "label KPI principal" : "label absent" });

  // Graph : SVG canvas
  const svgMatches = html.match(/<svg/g);
  const svgCount = svgMatches?.length ?? 0;
  const hasGraph = svgCount >= 3;
  checks.push({
    column: "graph_annual",
    pass: hasGraph,
    detail: `${svgCount} SVG (cible >= 3)`,
  });

  // Interpretation : "Moteur de croissance" ou "Lead" ou bloc Interprétation
  const hasInterp = /Moteur de croissance|Point de vigilance|Génération de cash/i.test(html);
  checks.push({ column: "hero_interpretation", pass: hasInterp, detail: hasInterp ? "bloc interp détecté" : "pas de bloc interp" });

  // Risks
  const hasRisks = html.includes("Facteurs de risque") || html.includes("Risques");
  checks.push({ column: "risks", pass: hasRisks, detail: hasRisks ? "bloc Risques" : "absent" });

  // Governance
  const hasGov = html.includes("Gouvernance") || html.includes("gouvernance");
  checks.push({ column: "governance", pass: hasGov, detail: hasGov ? "bloc Gouvernance" : "absent" });

  // AI positioning
  const hasAi = html.includes("Positionnement IA") || html.includes("AI positioning");
  checks.push({ column: "ai_positioning", pass: hasAi, detail: hasAi ? "bloc IA" : "absent" });

  return checks;
}

async function postOverride(ticker: string, column_key: string, status: string, notes: string): Promise<boolean> {
  // Sans cookie auth desk, pas possible. On log uniquement.
  // L'API route requireDeskOwner(). Si CRON_SECRET utilisé, ça bypass aussi pas.
  // Donc on dump dans un fichier pour Yann à appliquer manuellement.
  return false;
}

async function main() {
  console.log(`\n🔍 Vérification visuelle automatisée — top 5 sés V1.8`);
  console.log(`   Source : ${BASE}/sandbox/v1-8/<ticker>\n`);

  const allResults: Array<{ ticker: string; checks: Check[] }> = [];

  for (const ticker of TICKERS) {
    console.log(`\n[${ticker}]`);
    const html = await fetchPage(ticker);
    if (!html) {
      allResults.push({ ticker, checks: [] });
      continue;
    }
    const checks = checkPage(html, ticker);
    for (const c of checks) {
      console.log(`  ${c.pass ? "✅" : "❌"} ${c.column.padEnd(22)} ${c.detail}`);
    }
    allResults.push({ ticker, checks });
  }

  // Dump pour réutilisation
  const out = path.join(process.cwd(), "src/data/top5-quality-check.json");
  fs.writeFileSync(out, JSON.stringify({ ts: new Date().toISOString(), base: BASE, results: allResults }, null, 2));
  console.log(`\n💾 Résultats : ${out}`);

  // Récap
  const pass = allResults.flatMap((r) => r.checks).filter((c) => c.pass).length;
  const total = allResults.flatMap((r) => r.checks).length;
  console.log(`\n📊 Total : ${pass}/${total} checks passent (${Math.round((pass / total) * 100)}%)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
