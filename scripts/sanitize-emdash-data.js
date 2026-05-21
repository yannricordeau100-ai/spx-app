#!/usr/bin/env node
/**
 * Sanitize em-dashes (U+2014) in JSON data files.
 * Replaces "—" with " : " in string values (skip URL-ish fields).
 * Collapses any resulting " :  : " or ": :" to ": ".
 *
 * Scope (per mission brief):
 *   src/data/v2-pipeline/
 *   src/data/v2-pipeline-kpi-v2/
 *   src/data/v2-pipeline-enrich/
 *   src/data/transcripts/
 *
 * CLAUDE.md §6: no em-dash in user-facing text.
 */
const fs = require('fs');
const path = require('path');

const ROOT = '/Users/yann/spx-app';
const TARGET_DIRS = [
  // Batch 1
  'src/data/v2-pipeline',
  'src/data/v2-pipeline-kpi-v2',
  'src/data/v2-pipeline-enrich',
  'src/data/transcripts',
  // Batch 2
  'src/data/transcript-summaries',
  'src/data/v1-9-complete',
  'src/data/v2-pipeline-i18n',
  'src/data/v2-pipeline-specific-kpis',
];

// Individual files explicitly targeted (batch 2)
const TARGET_FILES = [
  'src/data/extraction-blockers.json',
  'src/data/vip-list.json',
];

// Also scan top-level src/data/ for additional JSON files containing em-dash
// (excluding _meta/ which is canonical and must not be touched).
const SCAN_TOPLEVEL_DATA = true;
const TOPLEVEL_DATA_DIR = 'src/data';

const EM_DASH = '—';
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const URL_KEYS = new Set(['url', 'href', 'link', 'source_url', 'sourceUrl', 'logo', 'logo_url', 'logoUrl', 'image', 'image_url', 'imageUrl', 'src']);

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '_meta' || e.name === 'node_modules' || e.name === '.next') continue;
      walk(full, out);
    } else if (e.isFile() && e.name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

function sanitizeString(s) {
  if (!s.includes(EM_DASH)) return { value: s, count: 0 };
  let count = 0;
  let out = s.replace(/—/g, () => { count++; return ' : '; });
  // collapse double colons resulting from replacement next to existing ":"
  // e.g. ": :" -> ": ", " :  : " -> " : "
  out = out.replace(/:\s*:/g, ':');
  // tidy extra spaces around colon
  out = out.replace(/\s{2,}:/g, ' :').replace(/:\s{2,}/g, ': ');
  return { value: out, count };
}

function transform(node, parentKey) {
  let count = 0;
  if (typeof node === 'string') {
    if (parentKey && URL_KEYS.has(parentKey)) return { value: node, count: 0 };
    // Heuristic: if the string looks like a URL, skip
    if (/^https?:\/\//i.test(node)) return { value: node, count: 0 };
    const r = sanitizeString(node);
    return r;
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const r = transform(node[i], parentKey);
      node[i] = r.value;
      count += r.count;
    }
    return { value: node, count };
  }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const r = transform(node[k], k);
      node[k] = r.value;
      count += r.count;
    }
    return { value: node, count };
  }
  return { value: node, count };
}

function main() {
  const files = [];
  for (const rel of TARGET_DIRS) {
    walk(path.join(ROOT, rel), files);
  }
  // Add explicitly targeted individual files
  for (const rel of TARGET_FILES) {
    const full = path.join(ROOT, rel);
    try {
      if (fs.statSync(full).isFile() && full.endsWith('.json')) {
        files.push(full);
      }
    } catch {}
  }
  // Scan top-level src/data/*.json (non-recursive) for any JSON containing em-dash,
  // excluding files/dirs already covered above and _meta/.
  if (SCAN_TOPLEVEL_DATA) {
    const dir = path.join(ROOT, TOPLEVEL_DATA_DIR);
    const seen = new Set(files);
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { entries = []; }
    for (const e of entries) {
      if (!e.isFile()) continue;
      if (!e.name.endsWith('.json')) continue;
      const full = path.join(dir, e.name);
      if (seen.has(full)) continue;
      // Quick em-dash sniff before adding (avoid loading every JSON)
      try {
        const stat = fs.statSync(full);
        if (stat.size > MAX_SIZE) continue;
        const raw = fs.readFileSync(full, 'utf8');
        if (raw.includes(EM_DASH)) files.push(full);
      } catch {}
    }
  }
  let processed = 0;
  let touched = 0;
  let totalReplacements = 0;
  const failed = [];
  const samples = [];

  for (const file of files) {
    let stat;
    try { stat = fs.statSync(file); } catch { continue; }
    if (stat.size > MAX_SIZE) continue;
    let raw;
    try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { failed.push({ file, err: 'read:' + e.message }); continue; }
    if (!raw.includes(EM_DASH)) { processed++; continue; }
    let data;
    try { data = JSON.parse(raw); } catch (e) {
      failed.push({ file, err: 'parse:' + e.message });
      continue;
    }
    // Capture a "before" snippet if we don't have many samples yet
    let beforeSnippet = null;
    if (samples.length < 5) {
      const idx = raw.indexOf(EM_DASH);
      const start = Math.max(0, idx - 60);
      const end = Math.min(raw.length, idx + 60);
      beforeSnippet = raw.slice(start, end).replace(/\n/g, ' ');
    }

    const r = transform(data, null);
    if (r.count === 0) { processed++; continue; }

    let out;
    try {
      out = JSON.stringify(r.value, null, 2) + '\n';
      JSON.parse(out); // validate
    } catch (e) {
      failed.push({ file, err: 'reserialize:' + e.message });
      continue;
    }

    try { fs.writeFileSync(file, out, 'utf8'); } catch (e) { failed.push({ file, err: 'write:' + e.message }); continue; }
    touched++;
    totalReplacements += r.count;
    processed++;

    if (beforeSnippet && samples.length < 5) {
      // find an after snippet
      const idxAfter = out.indexOf(' : ');
      const startA = Math.max(0, idxAfter - 60);
      const endA = Math.min(out.length, idxAfter + 60);
      const afterSnippet = out.slice(startA, endA).replace(/\n/g, ' ');
      samples.push({
        ticker: path.basename(file, '.json'),
        replacements: r.count,
        before: beforeSnippet,
        after: afterSnippet,
      });
    }
  }

  console.log('=== em-dash sanitize report ===');
  console.log('Files scanned     :', files.length);
  console.log('Files processed   :', processed);
  console.log('Files modified    :', touched);
  console.log('Total replacements:', totalReplacements);
  console.log('Files failed      :', failed.length);
  if (failed.length) {
    console.log('--- failures ---');
    for (const f of failed.slice(0, 20)) console.log(' -', f.file, '::', f.err);
  }
  console.log('--- sample 5 ---');
  for (const s of samples) {
    console.log(`[${s.ticker}] (+${s.replacements})`);
    console.log('  BEFORE:', s.before);
    console.log('  AFTER :', s.after);
  }
}

main();
