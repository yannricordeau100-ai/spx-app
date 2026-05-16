/**
 * quality-tree-status.ts — agrège les résultats des 3 auditeurs et produit
 * un statut par sté × ID quality-tree. Source consommée par :
 *  - /sandbox/quality-tree (vue humaine, statut par ID)
 *  - scripts/fix-element.py (fix dispatcher, applique fix par ID)
 *
 * Sources :
 *  - src/data/visual-audit.json (Gemini visual audit)
 *  - audit data-structure côté load-company (warnings ChartSpec)
 *  - audit regex côté UI-AUDIT module (src/data/v1-8-ui-audit.json)
 *
 * Yann 16 mai 2026 — Phase 4 chantier Quality Registry.
 */
import fs from "node:fs";
import path from "node:path";

export type TickerStatusEntry = {
  id: string;             // quality-tree node ID
  pass: boolean;
  observation?: string;
  severity: number;
  source: "gemini-visual" | "data-structure" | "regex";
  ts: string;             // ISO date de l'audit
};

export type TickerStatus = {
  ticker: string;
  url?: string;
  last_audit_at: string;
  entries: TickerStatusEntry[];
};

/**
 * Lit le status pour un ticker depuis visual-audit.json.
 * Retourne null si pas encore audité.
 */
export function getStatusForTicker(ticker: string, rootDir: string = process.cwd()): TickerStatus | null {
  const visualPath = path.join(rootDir, "src/data/visual-audit.json");
  try {
    const raw = JSON.parse(fs.readFileSync(visualPath, "utf-8"));
    const r = raw.results?.[ticker.toUpperCase()];
    if (!r) return null;
    const entries: TickerStatusEntry[] = [];
    // fails de Gemini visual
    for (const fail of r.fails || []) {
      entries.push({
        id: fail.id,
        pass: false,
        observation: fail.obs,
        severity: fail.severity,
        source: "gemini-visual",
        ts: r.ts,
      });
    }
    return {
      ticker: ticker.toUpperCase(),
      url: r.url,
      last_audit_at: r.ts,
      entries,
    };
  } catch {
    return null;
  }
}

/**
 * Stats globales par ID quality-tree : combien de stés ont fail/pass cet ID.
 */
export function getIdStats(rootDir: string = process.cwd()): Map<string, { fails: number; total: number; sample_tickers: string[] }> {
  const out = new Map<string, { fails: number; total: number; sample_tickers: string[] }>();
  const visualPath = path.join(rootDir, "src/data/visual-audit.json");
  try {
    const raw = JSON.parse(fs.readFileSync(visualPath, "utf-8"));
    for (const [ticker, r] of Object.entries(raw.results || {})) {
      const result = r as { fails?: { id: string }[] };
      const failIds = new Set((result.fails || []).map((f) => f.id));
      for (const id of failIds) {
        const cur = out.get(id) ?? { fails: 0, total: 0, sample_tickers: [] };
        cur.fails += 1;
        cur.total += 1;
        if (cur.sample_tickers.length < 5) cur.sample_tickers.push(ticker);
        out.set(id, cur);
      }
    }
  } catch {}
  return out;
}
