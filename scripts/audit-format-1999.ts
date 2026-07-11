/**
 * Audit regle 1-999 (CLAUDE.md S6) sur les 503 stes SP500.
 * Pour chaque KPI affiche (kpis[] non short-history + stories short-history),
 * calcule formatHeroValue(value, unit) et signale :
 *  - resultat numerique hors [1, 999] pour une unite a magnitude monetaire
 *  - unite brute non normalisee bizarre ("$M", "B", "millions", ...)
 *  - value string non parsable affichee telle quelle
 * Rapport : .conv-state/audit-format-1999.json
 * Usage : npx tsx scripts/audit-format-1999.ts
 */
import fs from "node:fs";
import path from "node:path";
import { loadV17Company } from "../src/lib/company-core/load-company";
import { formatHeroValue } from "../src/lib/data";
import type { KPI } from "../src/lib/data";

const ROOT = process.cwd();
const tickers: string[] = JSON.parse(
  fs.readFileSync(path.join(ROOT, "src/data/sp500-tickers.json"), "utf8")
);

type Violation = {
  ticker: string;
  kpi: string;
  surface: "kpis" | "stories";
  raw_value: string | number | null;
  raw_unit: string;
  rendered: string; // "value unit" apres formatHeroValue
  issue: "out_of_range" | "weird_unit" | "unparsable_value";
  detail?: string;
};

// Unites monetaires a magnitude apres formatHeroValue : K/M/Mds/B + devise.
const MONETARY_MAGNITUDE_RE =
  /^(K|M|Mds|B)\s*(\$|€|£|¥|USD|EUR|GBP|CHF|JPY|CAD|AUD|DKK|SEK|NOK|HKD|CNY|INR|BRL|MXN|ZAR|KRW|PLN)$|^(\$|€|£|¥)\s*(K|M|Mds|B)$|^(K|M|Mds|B)$/;

// Unites brutes bizarres / non normalisees.
const WEIRD_UNIT_RE =
  /^(\$M|\$B|\$K|B|bn|Bn|BN|millions?|milliards?|billions?|thousands?|MM|USD ?M|USD ?B|M\$|Mds\$|\$ ?Mds|\$ ?M|\$ ?B)$/i;

function isMonetaryMagnitude(u: string): boolean {
  const t = u.trim();
  if (!t) return false;
  return MONETARY_MAGNITUDE_RE.test(t);
}

function parseNum(v: string | number | null | undefined): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v.replace(/,/g, "").trim());
  return NaN;
}

async function main() {
  const violations: Violation[] = [];
  let kpisScanned = 0;
  let casMdsSup999 = 0;
  let companiesLoaded = 0;
  const loadFailures: string[] = [];

  for (const t of tickers) {
    let outcome;
    try {
      outcome = await loadV17Company(t, { mode: "v18" });
    } catch (e) {
      loadFailures.push(`${t}: ${String(e).slice(0, 120)}`);
      continue;
    }
    if (outcome.kind !== "ready") {
      loadFailures.push(`${t}: ${outcome.kind}`);
      continue;
    }
    companiesLoaded += 1;
    const company = outcome.company;
    const allKpis: KPI[] = Array.isArray(company.kpis) ? company.kpis : [];

    for (const kpi of allKpis) {
      const surface: "kpis" | "stories" = kpi.is_short_history ? "stories" : "kpis";
      kpisScanned += 1;

      const rawUnit = kpi.unit ?? "";
      const fmt = formatHeroValue(kpi.value as string | number | null, rawUnit);
      const rendered = `${fmt.value}${fmt.unit ? " " + fmt.unit : ""}`;

      // 3) value non parsable affichee telle quelle
      const num = parseNum(kpi.value as string | number | null);
      if (!Number.isFinite(num)) {
        if (kpi.value != null && String(kpi.value).trim() !== "") {
          violations.push({
            ticker: t,
            kpi: kpi.short ?? kpi.name_fr ?? "?",
            surface,
            raw_value: kpi.value as string | null,
            raw_unit: rawUnit,
            rendered,
            issue: "unparsable_value",
          });
        }
        continue;
      }

      // 2) unite brute bizarre
      if (rawUnit && WEIRD_UNIT_RE.test(rawUnit.trim())) {
        violations.push({
          ticker: t,
          kpi: kpi.short ?? kpi.name_fr ?? "?",
          surface,
          raw_value: kpi.value as string | number,
          raw_unit: rawUnit,
          rendered,
          issue: "weird_unit",
        });
      }

      // 1) resultat hors [1, 999] pour unite monetaire a magnitude
      const renderedNum = parseFloat(
        fmt.value.replace(/ | |\s/g, "").replace(",", ".")
      );
      if (
        Number.isFinite(renderedNum) &&
        renderedNum !== 0 &&
        isMonetaryMagnitude(fmt.unit) &&
        (Math.abs(renderedNum) < 1 || Math.abs(renderedNum) > 999)
      ) {
        const isMds = /^Mds\b/.test(fmt.unit.trim());
        if (isMds && Math.abs(renderedNum) > 999) casMdsSup999 += 1;
        violations.push({
          ticker: t,
          kpi: kpi.short ?? kpi.name_fr ?? "?",
          surface,
          raw_value: kpi.value as string | number,
          raw_unit: rawUnit,
          rendered,
          issue: "out_of_range",
          detail: isMds && Math.abs(renderedNum) > 999 ? "pas_de_tier_au_dessus_de_Mds" : undefined,
        });
      }
    }
  }

  const byIssue: Record<string, number> = {};
  for (const v of violations) byIssue[v.issue] = (byIssue[v.issue] ?? 0) + 1;

  const report = {
    generated_at: new Date().toISOString(),
    universe: "SP500 sp500-tickers.json",
    tickers_total: tickers.length,
    companies_loaded: companiesLoaded,
    load_failures: loadFailures,
    kpis_scanned: kpisScanned,
    violations_total: violations.length,
    by_issue: byIssue,
    cas_mds_sup_999: casMdsSup999,
    violations,
  };

  const outPath = path.join(ROOT, ".conv-state/audit-format-1999.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify({
    tickers: tickers.length,
    loaded: companiesLoaded,
    load_failures: loadFailures.length,
    kpis_scanned: kpisScanned,
    violations: violations.length,
    by_issue: byIssue,
    cas_mds_sup_999: casMdsSup999,
    top20: violations.slice(0, 20).map((v) => ({
      t: v.ticker, kpi: v.kpi, issue: v.issue, unit: v.raw_unit, rendu: v.rendered,
    })),
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
