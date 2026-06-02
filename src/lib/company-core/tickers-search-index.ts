/**
 * Index léger de TOUS les tickers du pipeline v2 disponibles dans
 * `src/data/v2-pipeline/_merged.json` (1607+ stés). Format minimal
 * (ticker, name, sector) pour rester sous 150 KB et ne pas alourdir
 * le bundle home.
 *
 * Servi à `<CompanySearch />` pour étendre le périmètre de recherche
 * au-delà des 5 stés V1. Chaque résultat v2-pipeline route vers
 * `/sandbox/v1-7/<ticker>` (la fiche pipeline) plutôt que vers
 * `/<ticker>` (route V1).
 *
 * Régénération : `python3 scripts/build-tickers-search-index.py`
 * (script à créer si pas déjà là). Ou snippet Python ad hoc :
 *   import json; d = json.load(open('src/data/v2-pipeline/_merged.json'))
 *   out = [{'ticker': k, 'name': v['name'], 'sector': v.get('sector','')}
 *          for k,v in d.items() if isinstance(v,dict) and v.get('name')]
 *   json.dump(sorted(out, key=lambda x: x['ticker']),
 *     open('src/data/v2-pipeline/_tickers-index.json','w'),
 *     ensure_ascii=False, separators=(',',':'))
 */
import indexJson from "@/data/v2-pipeline/_tickers-index.json";
import v19MissingJson from "@/data/v1-9-missing-from-merged.json";

export type V17SearchEntry = {
  ticker: string;
  name: string;
  sector: string;
  /**
   * `true` si la sté a passé Pass 3 (validation Sonnet du dataset par CONV-DATA).
   * Ces stés sont la "top top" qualité, route vers /sandbox/v1-7/<ticker>.
   * Les autres routent vers /sandbox/v1-6/<ticker> (extraction Pass 1/2 brute,
   * non validée mais utilisable). Permet à la search de proposer toutes les
   * 1606 stés tout en pointant l'utilisateur sur la fiche de meilleure qualité
   * disponible.
   */
  validated: boolean;
};

export const V17_SEARCH_INDEX: V17SearchEntry[] = indexJson as V17SearchEntry[];

/**
 * Map ticker (uppercase) → entry, pour lookup O(1).
 * Utile dans les ResultCard et fallbacks.
 */
export const V17_SEARCH_BY_TICKER: Record<string, V17SearchEntry> =
  Object.fromEntries(V17_SEARCH_INDEX.map((e) => [e.ticker.toUpperCase(), e]));

/**
 * V1.9 search entries : tickers présents dans l'univers V1.9 (924 stés EU+US,
 * cf `src/data/v1-9-universe.json`) MAIS absents de `_merged.json` (= pas
 * encore extraits par le pipeline data). Source : `v1-9-missing-from-merged.json`.
 *
 * Format aligné sur V17SearchEntry pour réutiliser la même `ResultCard`.
 * `sector` est laissé vide (pas encore extrait), `validated=false` pour
 * forcer le routing vers `/sandbox/v1-9/<ticker>` (page "Fiche en préparation"
 * gérée par Agent B). `name_wikipedia` est mappé sur `name`.
 */
type V19MissingRaw = {
  ticker: string;
  country: string;
  sources: string[];
  name_wikipedia?: string;
};

type V19MissingFile = {
  generated_at?: string;
  total_universe?: number;
  total_missing_from_merged?: number;
  missing: V19MissingRaw[];
};

export type V19SearchEntry = V17SearchEntry & {
  country?: string;
};

export const V19_SEARCH_INDEX: V19SearchEntry[] = (
  v19MissingJson as V19MissingFile
).missing.map((m) => ({
  ticker: m.ticker,
  name: m.name_wikipedia || m.ticker,
  sector: "",
  validated: false,
  country: m.country,
}));

export const V19_SEARCH_BY_TICKER: Record<string, V19SearchEntry> =
  Object.fromEntries(V19_SEARCH_INDEX.map((e) => [e.ticker.toUpperCase(), e]));
