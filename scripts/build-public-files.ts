/**
 * build-public-files.ts
 *
 * Régénère les datasets pré-filtrés utilisés par les hubs sandbox V1.6 et
 * V1.7 :
 *   - src/data/v1-7-public.json : 421 stés Pass 3 validées (champ
 *     _validation OU _validation_global non null), avec au moins 1 KPI.
 *   - src/data/v1-6-public.json : 1606 stés du pipeline (toutes), avec au
 *     moins 1 KPI (skip dataset corrompu / vide).
 *
 * Pourquoi : importer `_merged.json` (16 MB) directement dans une page
 * Next.js explose le bundle JS et ralentit le first paint. Les fichiers
 * pré-filtrés font ~300 KB (V1.7) et ~16 MB (V1.6) avec sérialisation
 * compacte. À terme, V1.6 devra basculer sur Supabase pour la 2.0.
 *
 * Usage :
 *   npx tsx scripts/build-public-files.ts
 *
 * Lancé automatiquement par le cron `mettrik-rebuild-merged` toutes les
 * heures, après le rebuild de `_merged.json` par CONV-DATA.
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const MERGED_PATH = path.join(ROOT, "src/data/v2-pipeline/_merged.json");
const V17_OUT = path.join(ROOT, "src/data/v1-7-public.json");
const V16_OUT = path.join(ROOT, "src/data/v1-6-public.json");

type AnyRecord = Record<string, unknown>;

function isValidPipelineEntry(v: unknown): v is AnyRecord {
  if (!v || typeof v !== "object") return false;
  const obj = v as AnyRecord;
  return Array.isArray(obj.kpis) && (obj.kpis as unknown[]).length > 0;
}

/**
 * Pass 3 "true ready" (Yann 5 mai 2026 ~04h) = sté qui peut être affichée
 * sans honte sur V1.7 publique. Critères cumulés :
 *
 *  1. Marquée par CONV-DATA via `_validation` ou `_validation_global`.
 *  2. Pas de marqueurs qualité douteux dans les notes de validation
 *     ("Non spécifié", "hallucinatoire", "non fourni", etc.). Ces flags
 *     sont posés par Sonnet quand l'extraction a buté sur du data
 *     manquant ou inventé.
 *  3. KPIs réels : moins de 40% de values vides/non spécifiées.
 *  4. Au moins 1 champ Pass 2 rempli (risks OU governance OU ai_positioning).
 *
 * Précédentes définitions :
 *   - lenient `_validation OR _global` = 926 mais inclut ~290 stés cassées
 *   - strict `_validation_global only` = 12 (trop restrictif).
 *
 * "True ready" = ~634 stés au 5 mai 2026, croît avec CONV-DATA pipeline.
 */
const WEAK_MARKERS = [
  "non spécifié", "non specifie", "non spécifie",
  "non fourni", "non disponible",
  "hallucinatoire", "hallucinated", "partially hallucinatory",
  "tous les champs restent",
  "données financières détaillées du 10-K ne sont pas",
  "no actual revenue figure", "pas de hero kpi distinctif",
];

function validationText(v: AnyRecord): string {
  const val = v._validation;
  if (Array.isArray(val)) return val.map((x) => String(x)).join(" ").toLowerCase();
  if (val) return String(val).toLowerCase();
  return "";
}

function hasWeakMarker(v: AnyRecord): boolean {
  const txt = validationText(v);
  if (!txt) return false;
  return WEAK_MARKERS.some((m) => txt.includes(m));
}

function kpiQualityLow(v: AnyRecord): boolean {
  const kpis = v.kpis as Array<{ value?: unknown }> | undefined;
  if (!kpis || kpis.length === 0) return true;
  const badVals = ["non spécifié", "non specifie", "n/a", "non disponible", "unknown", "-", ""];
  const badCount = kpis.filter((k) => {
    const v = String(k.value ?? "").toLowerCase().trim();
    return badVals.includes(v);
  }).length;
  return badCount > kpis.length * 0.4;
}

function hasPass2(v: AnyRecord): boolean {
  return !!(v.risks || v.governance || v.ai_positioning);
}

function isPass3(v: AnyRecord): boolean {
  if (!(v._validation || v._validation_global)) return false;
  if (hasWeakMarker(v)) return false;
  if (kpiQualityLow(v)) return false;
  if (!hasPass2(v)) return false;
  return true;
}

/**
 * Garde UNIQUEMENT les champs nécessaires au rendu d'une card HomeView.
 * Les hubs sandbox V1.6/V1.7 affichent ~1 KPI (le hero) + meta basiques.
 * Pas besoin de risks/governance/ai_positioning/_validation dans le bundle.
 *
 * Réduction observée : 4.5 MB → ~200 KB pour V1.7. Évite les 500 dûs au
 * bundle Next.js qui dépasse les limites de fonction serverless Vercel
 * (4 MB compressed pour les server components qui import du JSON).
 */
function slimForHub(entry: AnyRecord): AnyRecord {
  const heroKpiShort = entry.hero_kpi as string | undefined;
  const allKpis = Array.isArray(entry.kpis) ? (entry.kpis as AnyRecord[]) : [];
  // Garde le hero KPI complet (nécessaire pour rate(), yoy, history,
  // freshness) + un placeholder léger pour les autres (pour que kpis.length
  // reste correct si un consommateur compte).
  const heroKpi = allKpis.find((k) => k.short === heroKpiShort) ?? allKpis[0];
  // Yann 4 mai 2026 : la pillule "Récent / Date inconnue" doit être remplie
  // pour TOUTES les stés Pass 3 (et nouvelles à venir). Si CONV-DATA n'a
  // pas posé last_data_date côté KPI, on backfill avec la date du dernier
  // filing à défaut (recoit valeur "stale" >12 mois plutôt que "Date
  // inconnue"). Cohérent avec la doctrine FreshnessIndicator.
  const fallbackDate =
    (heroKpi?.last_data_date as string | undefined) ??
    (entry.last_filing_date as string | undefined) ??
    (entry._last_validation_date as string | undefined) ??
    "2025-12-31"; // dernière clôture annuelle US par défaut
  const slimKpis = heroKpi
    ? [
        {
          short: heroKpi.short,
          name_fr: heroKpi.name_fr,
          name_en: heroKpi.name_en,
          value: heroKpi.value,
          unit: heroKpi.unit,
          yoy: heroKpi.yoy,
          type: heroKpi.type,
          history: heroKpi.history,
          last_data_date: fallbackDate,
          ttm: heroKpi.ttm,
        },
      ]
    : [];
  return {
    ticker: entry.ticker,
    name: entry.name,
    sector: entry.sector,
    subsector: entry.subsector,
    hero_kpi: entry.hero_kpi,
    ranks: entry.ranks,
    next_earnings_date: entry.next_earnings_date,
    logo_treatment: entry.logo_treatment,
    tagline: entry.tagline,
    kpis: slimKpis,
  };
}

function main() {
  const raw = readFileSync(MERGED_PATH, "utf-8");
  const merged = JSON.parse(raw) as Record<string, unknown>;

  const v17: Record<string, AnyRecord> = {};
  const v16: Record<string, AnyRecord> = {};
  const indexEntries: Array<{ ticker: string; name: string; sector: string; validated: boolean }> = [];

  for (const [ticker, entry] of Object.entries(merged)) {
    if (!isValidPipelineEntry(entry)) continue;
    const e = entry as AnyRecord;
    const slim = slimForHub(e);
    v16[ticker] = slim;
    const isV17 = isPass3(e);
    if (isV17) v17[ticker] = slim;
    indexEntries.push({
      ticker,
      name: String(e.name ?? ""),
      sector: String(e.sector ?? ""),
      validated: isV17, // STRICT : aligné sur V1.7 hub (= _validation_global only)
    });
  }

  // Sort : validated d'abord (apparaissent en premier dans la search), puis alpha.
  indexEntries.sort((a, b) => (Number(!a.validated) - Number(!b.validated)) || a.ticker.localeCompare(b.ticker));

  writeFileSync(V17_OUT, JSON.stringify(v17), "utf-8");
  writeFileSync(V16_OUT, JSON.stringify(v16), "utf-8");
  // Régénère aussi tickers-index.json pour aligner search avec V1.7 strict.
  // (Cron horaire build-public-files.ts maintient cohérence au fil des
  // nouvelles validations Pass 3 par CONV-DATA.)
  const TICKERS_INDEX = path.join(ROOT, "src/data/v2-pipeline/_tickers-index.json");
  writeFileSync(TICKERS_INDEX, JSON.stringify(indexEntries), "utf-8");

  const v17Size = (JSON.stringify(v17).length / 1024).toFixed(0);
  const v16Size = (JSON.stringify(v16).length / 1024).toFixed(0);
  const validatedCount = indexEntries.filter((e) => e.validated).length;
  console.log(`✅ V1.7 public : ${Object.keys(v17).length} stés (${v17Size} KB) → ${V17_OUT}`);
  console.log(`✅ V1.6 public : ${Object.keys(v16).length} stés (${v16Size} KB) → ${V16_OUT}`);
  console.log(`✅ Tickers index : ${indexEntries.length} stés (${validatedCount} validated Pass 3 strict) → ${TICKERS_INDEX}`);
}

main();
