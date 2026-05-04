import { promises as fs } from "fs";
import path from "path";
import { HomeView } from "@/components/home-view";
import type { Company } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "1.7 · Mettrik AI",
  robots: { index: false, follow: false },
};

/**
 * /sandbox/v1-7 = même structure que la home (`/`) mais avec les 421 stés
 * Pass 3 validées par CONV-DATA. HomeView accepte un dataset custom + un
 * builder de href via props (ajouté le 4 mai 2026 sur demande Yann pour
 * uniformiser visuel V1 / V1.5 / V1.6 / V1.7).
 *
 * Filtre : ne garde que les stés avec _validation OU _validation_global
 * (champs ajoutés par CONV-DATA quand Sonnet a vérifié l'extraction).
 */
async function loadValidatedDatasets(): Promise<Record<string, Company>> {
  const dir = path.join(process.cwd(), "src/data/v2-pipeline");
  try {
    const merged = await fs.readFile(path.join(dir, "_merged.json"), "utf-8");
    const all = JSON.parse(merged) as Record<string, Company & { _validation?: unknown; _validation_global?: unknown }>;
    const out: Record<string, Company> = {};
    for (const [t, v] of Object.entries(all)) {
      // Filtre : validé par Sonnet ET au moins 1 KPI (sinon HomeView crashe
      // sur getHero / hero.yoy → 500).
      if (
        v &&
        typeof v === "object" &&
        (v._validation || v._validation_global) &&
        Array.isArray(v.kpis) &&
        v.kpis.length > 0
      ) {
        out[t] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export default async function SandboxV17HubPage() {
  const datasets = await loadValidatedDatasets();
  // Tri alphabétique par ticker pour un browse prévisible. Yann pourra
  // changer le tri (par secteur, par cap boursière, etc.) plus tard.
  const tickers = Object.keys(datasets).sort();

  return (
    <HomeView
      companies={datasets}
      tickers={tickers}
      hrefBuilder={(t) => `/sandbox/v1-7/${t.toLowerCase()}`}
    />
  );
}
