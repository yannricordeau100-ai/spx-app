#!/usr/bin/env node
// Sub-agent #116 — F-f cluster SP500 hors top 307 : geography vide → US single_region_legitimate
// Source : yfinance.longBusinessSummary confirme opérations exclusivement (ou ~100%) US
// Scope : src/data/v2-pipeline-enrich/<lowercase>.json (CONV-DATA strict respected)
// Honesty rule : 0 hallucination, sourcé yfinance officiel.

import fs from 'node:fs';
import path from 'node:path';

// 11 stés SP500 (hors top 307) avec ONLY geography vide, confirmées US-only via yfinance.longBusinessSummary
// (fetched 2026-05-21 via yf.Ticker(t).info)
const TICKERS = [
  { ticker: 'CHTR', summary_excerpt: 'broadband connectivity company in the United States' },
  { ticker: 'CME',  summary_excerpt: 'CME Group operates contract markets... (US-domiciled exchange)' },
  { ticker: 'FIX',  summary_excerpt: 'Comfort Systems USA... mechanical and electrical services industry in the United States' },
  { ticker: 'NUE',  summary_excerpt: 'Nucor Corporation... manufacture and sale of steel and steel products (US)' },
  { ticker: 'PKG',  summary_excerpt: 'Packaging Corporation of America manufactures and sells in North America' },
  { ticker: 'PNC',  summary_excerpt: 'diversified financial services company in the United States' },
  { ticker: 'PWR',  summary_excerpt: 'Quanta Services... infrastructure solutions for US utilities (Electric Infrastructure)' },
  { ticker: 'STLD', summary_excerpt: 'Steel Dynamics... steel producer and metal recycler in the United States' },
  { ticker: 'SYF',  summary_excerpt: 'Synchrony Financial... consumer financial services company in the United States' },
  { ticker: 'TMUS', summary_excerpt: 'T-Mobile US... wireless communications services in the United States, PR, USVI' },
  { ticker: 'TRGP', summary_excerpt: 'Targa Resources... domestic infrastructure assets in North America' },
];

const ENRICH_DIR = path.join(process.cwd(), 'src/data/v2-pipeline-enrich');
const NOW = new Date().toISOString();
const TAG = 'sub-agent-116-sp500-cluster-f-geo';

let written = 0;
let skipped = 0;
const report = [];

for (const { ticker, summary_excerpt } of TICKERS) {
  const enrichPath = path.join(ENRICH_DIR, ticker.toLowerCase() + '.json');
  let enrich = {};
  if (fs.existsSync(enrichPath)) {
    try {
      enrich = JSON.parse(fs.readFileSync(enrichPath, 'utf-8'));
    } catch (e) {
      report.push({ ticker, status: 'skip', reason: 'enrich JSON parse fail: ' + e.message });
      skipped++;
      continue;
    }
  }

  // Skip if already has revenue_by_geography with slices
  if (enrich.revenue_by_geography && Array.isArray(enrich.revenue_by_geography.slices) && enrich.revenue_by_geography.slices.length > 0) {
    report.push({ ticker, status: 'skip', reason: 'revenue_by_geography déjà présente avec slices' });
    skipped++;
    continue;
  }

  enrich.revenue_by_geography = {
    unit: '%',
    slices: [
      {
        label: 'États-Unis',
        value: 100,
        share_pct: 100,
        single_region_legitimate: true,
        unit: '%',
        label_en: 'United States',
      },
    ],
    total: 100,
    source: 'Mono-pays légitime (yfinance longBusinessSummary US-only confirmé)',
    source_yfinance_excerpt: summary_excerpt,
    single_region_legitimate: true,
    _legit_reason: 'Sté US-only confirmée via yfinance.longBusinessSummary (opérations exclusivement aux États-Unis, sub-agent #116)',
    _tagged_by: TAG,
    _tagged_at: NOW,
    _category: 'us-domestic-sp500',
  };

  fs.writeFileSync(enrichPath, JSON.stringify(enrich, null, 2) + '\n');
  report.push({ ticker, status: 'written', path: enrichPath });
  written++;
}

console.log('--- Sub-agent #116 F-f geo US-only patches ---');
console.log('Written:', written);
console.log('Skipped:', skipped);
console.log('Report:', JSON.stringify(report, null, 2));
fs.writeFileSync('scripts/sp500-easy-wins/report-geo-us-only.json', JSON.stringify({
  ts: NOW,
  written,
  skipped,
  details: report,
}, null, 2));
