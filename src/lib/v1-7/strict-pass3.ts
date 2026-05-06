/**
 * strict-pass3.ts — source unique de vérité pour décider si une sté V1.7
 * est "vraiment prête" à être affichée publiquement (hub + ticker page).
 *
 * Yann 6 mai 2026 : refus catégorique d'afficher des stés non-Pass 3 dans
 * V1.7. Avant ce module, deux builders étaient en conflit :
 *   - build-public-files.ts : strict (validation + qualité KPI + Pass 2)
 *     → 1052 stés
 *   - build-v17-public.ts   : lenient (validation + format hero string)
 *     → 1158 stés (incluait des stés sans risks/governance/AI)
 *
 * Désormais une seule fonction `isStrictPass3` partagée. Tout consommateur
 * (hub `/sandbox/v1-7`, ticker page `/sandbox/v1-7/[ticker]`, search index)
 * passe par ici.
 */

type AnyRecord = Record<string, unknown>;

const WEAK_MARKERS = [
  "non spécifié",
  "non specifie",
  "non spécifie",
  "non fourni",
  "non disponible",
  "hallucinatoire",
  "hallucinated",
  "partially hallucinatory",
  "tous les champs restent",
  "données financières détaillées du 10-K ne sont pas",
  "no actual revenue figure",
  "pas de hero kpi distinctif",
];

const PLACEHOLDER_VALUES = /^(non\s*(disponible|spécifié|specifie|disclosé|discloses?|reporté|reporte|précisé|precise|publié|publie|fourni|trouvé|connue?|renseigné|renseigne)|n\/a|na|—|-|)$/i;

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

function heroKpiUsable(v: AnyRecord): boolean {
  const kpis = v.kpis as Array<AnyRecord> | undefined;
  if (!kpis || kpis.length === 0) return false;
  const heroShort = v.hero_kpi as string | undefined;
  const hero = kpis.find((k) => k.short === heroShort) ?? kpis[0];
  if (!hero) return false;
  // Hero KPI strings must be non-placeholder. Évite "Non disponible" en value.
  const stringFields = ["value", "yoy", "type", "unit", "short"] as const;
  for (const f of stringFields) {
    const raw = hero[f];
    if (typeof raw !== "string") return false;
    if (PLACEHOLDER_VALUES.test(raw.trim())) return false;
  }
  return true;
}

/**
 * Décide si une sté est admissible au hub V1.7 et à sa page détail.
 *
 *  1. `_validation` ou `_validation_global` posé par CONV-DATA (Sonnet).
 *  2. Pas de marqueur de qualité douteuse dans la note de validation.
 *  3. KPIs réels (au moins 60 % avec values non vides / non placeholder).
 *  4. Au moins 1 champ Pass 2 rempli (risks OU governance OU ai_positioning).
 *  5. Hero KPI exploitable (value/yoy/type/unit/short = strings non-placeholder).
 *  6. `_fit_for_site` n'est pas explicitement à false (filtre admission CONV-DATA).
 *
 * Toutes ces conditions doivent être vraies. Sinon → page "Fiche en
 * préparation" + exclusion du hub.
 */
export function isStrictPass3(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const obj = v as AnyRecord;
  if ((obj._fit_for_site as boolean | undefined) === false) return false;
  if (!(obj._validation || obj._validation_global)) return false;
  if (hasWeakMarker(obj)) return false;
  if (kpiQualityLow(obj)) return false;
  if (!hasPass2(obj)) return false;
  if (!heroKpiUsable(obj)) return false;
  return true;
}
