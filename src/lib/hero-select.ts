/**
 * hero-select.ts : CHOIX UNIQUE du hero d'une fiche (7 oct 2026).
 *
 * Fait une seule fois, dans le chargeur (load-company.ts), sur la liste FINALE
 * des KPI servis. company-view et les scripts de controle lisent ce choix,
 * ils ne le recalculent plus.
 *
 * Ordre :
 *  1. override Supabase (desk_hero_kpi_overrides) s'il existe ET si son short
 *     est servi. Sinon il est ORPHELIN : on le signale et on retombe sur 2.
 *  2. hero configure (kpis-haut max pv_score, v2-pipeline...) s'il est
 *     specifique : non generique/comptable, non %, valeur utilisable,
 *     historique >= 3 points.
 *  3. meilleur KPI specifique (memes criteres), d'abord ceux rattaches a
 *     l'industrie de la societe (kpi-industrie-par-societe.json), puis plus
 *     haut pv_score puis historique le plus long.
 *  4. dernier recours seulement : un KPI generique (raison tracee).
 */
import { isGenericHeroKpi, isPercentHeroKpi, raisonGenerique } from "@/lib/kpi-hero-generic";

export type HeroKpiLike = {
  short?: unknown;
  name_fr?: unknown;
  name_en?: unknown;
  unit?: unknown;
  value?: unknown;
  history?: unknown;
  history_periods?: unknown;
  last_data_date?: unknown;
  period_type?: unknown;
  pv_score?: unknown;
};

export type HeroChoix = {
  hero: string | null;
  force: boolean;
  source: "override" | "configure" | "regle" | "dernier_recours" | "aucun";
  /** short de l'override Supabase absent de la liste servie, sinon null. */
  orphelin: string | null;
  /** Renseigne seulement en dernier recours ou override generique. */
  raison_generique: string | null;
};

export function valeurUtilisable(k?: { value?: unknown } | null): boolean {
  if (!k) return false;
  const v = k.value;
  if (typeof v === "number") return Number.isFinite(v) && Math.abs(v) > 0;
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "" || s === "—") return false;
    const n = parseFloat(s.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) && Math.abs(n) > 0;
  }
  return false;
}

export function longueurHistorique(k: HeroKpiLike): number {
  const h = k.history;
  if (!Array.isArray(h)) return 0;
  let n = 0;
  for (const p of h as unknown[]) {
    const v = p && typeof p === "object" && "v" in (p as object) ? (p as { v: unknown }).v : p;
    if (typeof v === "number" && Number.isFinite(v)) n++;
    else if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) n++;
  }
  return n;
}

const pv = (k: HeroKpiLike) => (typeof k.pv_score === "number" ? k.pv_score : 0);

/** Libelles de periode alignes avec la serie (sinon graphique incoherent). */
function periodesAlignees(k: HeroKpiLike): boolean {
  if (k.period_type !== "quarter") return true;
  const hp = k.history_periods;
  const ldd = k.last_data_date;
  return (
    Array.isArray(hp) &&
    Array.isArray(k.history) &&
    hp.length === (k.history as unknown[]).length &&
    typeof ldd === "string" &&
    ldd.trim().length > 0
  );
}

/** Eligible au titre de hero automatique : specifique, non %, utilisable, >= 3 points. */
export function heroSpecifiqueValide(k: HeroKpiLike | undefined | null): boolean {
  if (!k) return false;
  return (
    valeurUtilisable(k) &&
    longueurHistorique(k) >= 3 &&
    !isPercentHeroKpi(k) &&
    !isGenericHeroKpi(k)
  );
}

export function choisirHero(
  kpis: ReadonlyArray<HeroKpiLike>,
  configure: string | null | undefined,
  override: string | null | undefined,
  absorbes?: ReadonlyMap<string, string>,
  industrie?: ReadonlySet<string>,
): HeroChoix {
  const liste = kpis.filter((k) => typeof k?.short === "string" && k.short);
  const par = new Map<string, HeroKpiLike>();
  for (const k of liste) par.set(String(k.short), k);

  let orphelin: string | null = null;
  if (override) {
    const cible = par.has(override) ? override : absorbes?.get(override);
    if (cible && par.has(cible)) {
      const k = par.get(cible)!;
      return {
        hero: cible,
        force: true,
        source: "override",
        orphelin: null,
        raison_generique: raisonGenerique(k),
      };
    }
    orphelin = override;
  }

  const cfg = configure ? par.get(configure) : undefined;
  if (cfg && heroSpecifiqueValide(cfg)) {
    return { hero: String(cfg.short), force: false, source: "configure", orphelin, raison_generique: null };
  }

  const candidats = liste.filter(heroSpecifiqueValide).sort((a, b) => {
    const al = periodesAlignees(a) ? 1 : 0;
    const bl = periodesAlignees(b) ? 1 : 0;
    if (al !== bl) return bl - al;
    const ai = industrie?.has(String(a.short)) ? 1 : 0;
    const bi = industrie?.has(String(b.short)) ? 1 : 0;
    if (ai !== bi) return bi - ai;
    if (pv(a) !== pv(b)) return pv(b) - pv(a);
    return longueurHistorique(b) - longueurHistorique(a);
  });
  if (candidats.length > 0) {
    return { hero: String(candidats[0].short), force: false, source: "regle", orphelin, raison_generique: null };
  }

  // Dernier recours : un KPI generique, le configure d'abord, sinon le meilleur utilisable non %.
  const secours =
    (cfg && valeurUtilisable(cfg) && !isPercentHeroKpi(cfg) ? cfg : undefined) ??
    liste
      .filter((k) => valeurUtilisable(k) && !isPercentHeroKpi(k) && longueurHistorique(k) >= 3)
      .sort((a, b) => pv(b) - pv(a) || longueurHistorique(b) - longueurHistorique(a))[0] ??
    cfg ??
    liste[0];
  if (!secours) return { hero: configure ?? null, force: false, source: "aucun", orphelin, raison_generique: null };
  return {
    hero: String(secours.short),
    force: false,
    source: "dernier_recours",
    orphelin,
    raison_generique: raisonGenerique(secours),
  };
}
