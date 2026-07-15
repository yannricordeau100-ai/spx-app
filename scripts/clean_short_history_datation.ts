import * as fs from 'fs';
import * as path from 'path';

const dir = '/Users/yann/spx-app/src/data/v2-pipeline';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.includes('.bak'));

const fieldsToRemove = ['_source_month', '_source_file', '_source_month_reason', 'last_data_date'] as const;

let stes_touched = 0;
let stories_cleaned = 0;
const fields_removed: Record<string, number> = {
  _source_month: 0, _source_file: 0, _source_month_reason: 0, last_data_date: 0,
};

function walk(node: any, onKpi: (k: any) => void) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(n => walk(n, onKpi)); return; }
  if (node.is_short_history === true) onKpi(node);
  for (const k of Object.keys(node)) walk(node[k], onKpi);
}

for (const f of files) {
  const p = path.join(dir, f);
  let raw: string;
  try { raw = fs.readFileSync(p, 'utf-8'); } catch { continue; }
  let data: any;
  try { data = JSON.parse(raw); } catch { continue; }

  let ste_touched = false;
  walk(data, (kpi) => {
    if (kpi.is_short_history !== true) return;
    if (kpi._source_month !== null) return;
    let any = false;
    for (const field of fieldsToRemove) {
      if (field in kpi) {
        delete kpi[field];
        fields_removed[field]++;
        any = true;
      }
    }
    if (any) { stories_cleaned++; ste_touched = true; }
  });

  if (ste_touched) {
    stes_touched++;
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
  }
}

console.log(JSON.stringify({ stes_touched, stories_cleaned, fields_removed }));
