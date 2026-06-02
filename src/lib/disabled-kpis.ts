/**
 * Helper centralisé pour la liste des KPIs désactivés individuellement
 * par société (granulaire).
 *
 * Différent de `disabled-blocks.ts` (qui désactive un BLOC entier de la
 * page société, ex : snapshot boursier, gouvernance, AI positioning).
 * Ici on cache un KPI précis (par son `short`) dans le hero, le tableau
 * des indicateurs clés et le carrousel Stories.
 *
 * Cas d'usage : Yann veut afficher MU "Data Center Revenue" mais cacher
 * MU "Capex" pour cette sté précise sans toucher au dataset.
 *
 * Source de vérité : `src/data/disabled-kpis-per-ste.json`.
 *
 * Mécanisme : lu côté SSR par `src/lib/company-core/load-company.ts` qui filtre
 * `data.kpis` avant le rendu de la fiche.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

export type DisabledKpisPerSteConfig = {
  overrides: Record<string, string[]>;
  updated_at?: string;
};

const CONFIG_PATH = path.join(
  process.cwd(),
  "src/data/disabled-kpis-per-ste.json",
);

/**
 * Lit le JSON à CHAQUE appel (pas de cache module) pour que les writes
 * faits par l'API se voient sans rebuild. Le fichier est petit (< 100 KB
 * typiquement, max overrides Yann) donc le coût FS est négligeable côté
 * SSR.
 */
function readConfigRaw(): { overrides?: unknown; updated_at?: unknown } {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { overrides: {} };
  }
}

export function loadDisabledKpisPerSte(): DisabledKpisPerSteConfig {
  const c = readConfigRaw();
  const rawOverrides = (c.overrides ?? {}) as Record<string, unknown>;
  const overrides: Record<string, string[]> = {};
  for (const [ticker, shorts] of Object.entries(rawOverrides)) {
    if (Array.isArray(shorts)) {
      overrides[ticker.toUpperCase()] = shorts.filter(
        (x): x is string => typeof x === "string",
      );
    }
  }
  const updated_at = typeof c.updated_at === "string" ? c.updated_at : undefined;
  return { overrides, updated_at };
}

/**
 * Renvoie la liste des KPI shorts désactivés pour un ticker donné.
 * Utilisé par l'UI admin pour pré-cocher les cases.
 */
export function getDisabledKpisForTicker(ticker: string): string[] {
  const cfg = loadDisabledKpisPerSte();
  return cfg.overrides[ticker.toUpperCase()] ?? [];
}

/**
 * Renvoie true si le KPI (identifié par son `short`) est désactivé pour
 * cette société. Utilisé côté `load-company.ts` pour filtrer les KPIs
 * avant le rendu.
 */
export function isKpiDisabledForTicker(
  ticker: string,
  kpiShort: string | undefined | null,
): boolean {
  if (!kpiShort) return false;
  const disabled = getDisabledKpisForTicker(ticker);
  return disabled.includes(kpiShort);
}
