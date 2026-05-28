import { promises as fs } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireDeskOwner } from "@/lib/desk/auth";
import { loadDisabledKpisPerSte } from "@/lib/disabled-kpis";
import KpisToggleClient, {
  type SteRow,
  type KpiRow,
} from "./client";

/**
 * /admin/kpis-toggle — admin sandbox pour activer / désactiver
 * individuellement les KPIs par société (granulaire, différent du toggle
 * blocs).
 *
 * Source data : pour chaque sté publishable V1.9.5
 * (`src/data/v1-9-publishable.json`), lit `v2-pipeline/<t>.json` +
 * `v2-pipeline-enrich/<t>.json`, merge `kpis` + `kpis_supplementary`,
 * filtre `history.length >= 3`, affiche checkbox + métadonnées.
 *
 * Persistance : `src/data/disabled-kpis-per-ste.json` via API
 * `POST /api/admin/kpis-toggle`.
 *
 * Auth-gate Yann uniquement.
 */
export const metadata = {
  title: "KPIs : activer / désactiver par sté · admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ROOT = process.cwd();

type AnyKPI = {
  short?: unknown;
  name_fr?: unknown;
  name_en?: unknown;
  type?: unknown;
  period_type?: unknown;
  history?: unknown;
  value?: unknown;
  unit?: unknown;
};

async function readJson<T>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function historyLength(v: unknown): number {
  if (!Array.isArray(v)) return 0;
  let n = 0;
  for (const x of v) {
    if (typeof x === "number" && Number.isFinite(x)) n += 1;
    else if (x && typeof x === "object" && "value" in (x as object)) {
      const val = (x as { value: unknown }).value;
      if (typeof val === "number" && Number.isFinite(val)) n += 1;
    }
  }
  return n;
}

function lastValue(v: unknown): number | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  for (let i = v.length - 1; i >= 0; i -= 1) {
    const x = v[i];
    if (typeof x === "number" && Number.isFinite(x)) return x;
    if (x && typeof x === "object" && "value" in (x as object)) {
      const val = (x as { value: unknown }).value;
      if (typeof val === "number" && Number.isFinite(val)) return val;
    }
  }
  return null;
}

function fmtValue(v: number | null, unit: string): string {
  if (v === null) return "-";
  const abs = Math.abs(v);
  let s: string;
  if (abs >= 1000) s = v.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
  else if (abs >= 1) s = v.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  else s = v.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
  return unit ? `${s} ${unit}` : s;
}

async function loadStes(): Promise<SteRow[]> {
  // Liste publishable V1.9.5
  const publishable = await readJson<{ tickers?: string[] }>(
    path.join(ROOT, "src/data/v1-9-publishable.json"),
  );
  const tickers = Array.isArray(publishable?.tickers)
    ? publishable!.tickers!
    : [];

  const disabledCfg = loadDisabledKpisPerSte();

  // Lire chaque sté en parallèle (cap raisonnable pour le SSR)
  const rows: SteRow[] = await Promise.all(
    tickers.map(async (tickerRaw): Promise<SteRow | null> => {
      const ticker = tickerRaw.toUpperCase();
      const baseFp = path.join(
        ROOT,
        "src/data/v2-pipeline",
        `${ticker.toLowerCase()}.json`,
      );
      const enrichFp = path.join(
        ROOT,
        "src/data/v2-pipeline-enrich",
        `${ticker.toLowerCase()}.json`,
      );
      const base = await readJson<Record<string, unknown>>(baseFp);
      if (!base) return null;
      const enrich =
        (await readJson<Record<string, unknown>>(enrichFp)) ?? {};

      const heroShort =
        typeof base.hero_kpi === "string" ? base.hero_kpi : "";
      const baseKpis = asArray(base.kpis) as AnyKPI[];
      const enrichSupp = asArray(enrich.kpis_supplementary) as AnyKPI[];

      // Merge avec dedup par `short` (base prioritaire)
      const seen = new Set<string>();
      const merged: AnyKPI[] = [];
      for (const k of [...baseKpis, ...enrichSupp]) {
        if (!k || typeof k !== "object") continue;
        const short = typeof k.short === "string" ? k.short : "";
        if (!short || seen.has(short)) continue;
        seen.add(short);
        merged.push(k);
      }

      // Filtre history >= 3
      const kpis: KpiRow[] = merged
        .filter((k) => historyLength(k.history) >= 3)
        .map((k) => {
          const short = typeof k.short === "string" ? k.short : "";
          const lv = lastValue(k.history);
          const unit = typeof k.unit === "string" ? k.unit : "";
          return {
            short,
            name_fr:
              typeof k.name_fr === "string" && k.name_fr
                ? k.name_fr
                : typeof k.name_en === "string"
                  ? k.name_en
                  : "",
            type: typeof k.type === "string" ? k.type : "",
            period_type:
              typeof k.period_type === "string" ? k.period_type : "year",
            history_length: historyLength(k.history),
            last_value: lv,
            last_value_fmt: fmtValue(lv, unit),
            unit,
            is_hero: short === heroShort,
          };
        })
        .sort((a, b) => {
          // hero en premier, puis alphabétique
          if (a.is_hero && !b.is_hero) return -1;
          if (!a.is_hero && b.is_hero) return 1;
          return a.short.localeCompare(b.short);
        });

      const name = typeof base.name === "string" ? base.name : ticker;

      return {
        ticker,
        name,
        hero_kpi: heroShort,
        kpis,
        disabled_shorts: disabledCfg.overrides[ticker] ?? [],
      };
    }),
  ).then((list) =>
    (list.filter(Boolean) as SteRow[])
      .filter((s) => s.kpis.length > 0)
      .sort((a, b) => a.ticker.localeCompare(b.ticker)),
  );

  return rows;
}

export default async function KpisTogglePage() {
  await requireDeskOwner();

  const stes = await loadStes();
  const totalKpis = stes.reduce((acc, s) => acc + s.kpis.length, 0);
  const totalDisabled = stes.reduce(
    (acc, s) => acc + (s.disabled_shorts ?? []).length,
    0,
  );

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href="/admin"
          className="group mb-6 inline-flex items-center gap-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          Retour admin
        </Link>

        <h1 className="mb-2 font-display text-[28px] font-bold tracking-tight">
          KPIs : activer / désactiver par sté
        </h1>
        <p className="mb-2 max-w-2xl text-[13.5px] text-zinc-400">
          Cochez pour activer un KPI, décochez pour le cacher sur la fiche
          société (KPI principal, indicateurs clés, stories). Les KPIs
          affichés sont ceux qui ont au moins 3 ans d&apos;historique.
        </p>
        <p className="mb-6 max-w-2xl text-[12px] text-zinc-500">
          Source : {stes.length} stés publishable V1.9.5 ·{" "}
          {totalKpis} KPIs au total · {totalDisabled} KPIs désactivés.
          Persistance : <code className="font-mono">disabled-kpis-per-ste.json</code>.
        </p>

        <KpisToggleClient stes={stes} />
      </div>
    </div>
  );
}
