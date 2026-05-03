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

export type V17SearchEntry = {
  ticker: string;
  name: string;
  sector: string;
};

export const V17_SEARCH_INDEX: V17SearchEntry[] = indexJson as V17SearchEntry[];

/**
 * Map ticker (uppercase) → entry, pour lookup O(1).
 * Utile dans les ResultCard et fallbacks.
 */
export const V17_SEARCH_BY_TICKER: Record<string, V17SearchEntry> =
  Object.fromEntries(V17_SEARCH_INDEX.map((e) => [e.ticker.toUpperCase(), e]));
