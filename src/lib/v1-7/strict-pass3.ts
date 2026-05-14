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
  if (Array.isArray(val)) {
    return val
      .map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
      .join(" ")
      .toLowerCase();
  }
  if (val) return String(val).toLowerCase();
  return "";
}

/** Sonnet a-t-il appliqué des corrections ? Détecte 2 patterns :
 *  1. Objet structuré `{ corrected: ... }`
 *  2. Verbes correctifs dans le texte de validation ("removed", "corrigé",
 *     "corrected", "changed", "fixed", "replaced") — Sonnet écrit souvent
 *     ses corrections en langage naturel. */
function hasSonnetCorrections(v: AnyRecord): boolean {
  const val = v._validation;
  if (!val) return false;
  if (Array.isArray(val) && val.some((x) =>
      x && typeof x === "object" && !Array.isArray(x) && "corrected" in (x as Record<string, unknown>))) {
    return true;
  }
  const txt = validationText(v);
  if (!txt) return false;
  // Note : pas de \b parce que JS RegExp ne reconnaît pas l'é/è/à comme
  // word boundary par défaut. On utilise (^|[^a-zà-ÿ]) à la place.
  return /(?:^|[^a-zà-ÿ])(?:corrected|removed|changed|fixed|replaced|corrigé[es]?|corrigées?|suppression|supprim[éee]s?|remplacé[es]?|remplacement|nettoyé[es]?|cleaned|normalized|normalisé[es]?|modification|modifié[es]?|ajout|ajouté[es]?|added)(?=[^a-zà-ÿ]|$)/iu.test(txt);
}

function hasWeakMarker(v: AnyRecord): boolean {
  const txt = validationText(v);
  if (!txt) return false;
  // Faux-positif : si Sonnet a flag "halluciné" mais a aussi APPLIQUÉ une
  // correction (objet { corrected: ... }), le KPI a été remplacé → la note
  // historique reste mais ne doit plus bloquer la fiche. Ex : AMZN "GMV
  // halluciné" → corrigé en "Op Cash Flow", sté affichable. Yann 7 mai 2026.
  if (hasSonnetCorrections(v)) return false;
  // Strip phrases positives ou rapports neutres qui mentionnent le marker
  // sans qu'il soit un statut effectif. Patterns observés :
  //  - "no hallucinated kpis detected" (Sonnet rapport négatif)
  //  - "kpi marqués 'non disponible' car source absente" (Sonnet rapportant
  //    un état des données, pas posant un verdict)
  //  - "values marked as 'unknown'" (idem en anglais)
  // Yann 14 mai 2026 + 14 mai (round 2 sur MCD/SP500).
  const cleaned = txt
    .replace(/\bno\s+(?:hallucinated|fabricated|invented|made[\s-]up)\b[^.]*?(?:\.|$)/gi, " ")
    .replace(/\bnot\s+(?:hallucinated|fabricated|invented)\b[^.]*?(?:\.|$)/gi, " ")
    // Quoted/labeled references to placeholder values (not actual data status)
    .replace(/['""'`«]\s*(non\s*(?:disponible|spécifié|specifie|fourni)|hallucinatoire|hallucinated)\s*['""'`»]/gi, " ")
    .replace(/(?:marqu[ée]s?|marked|labeled|noted|flagged)\s+(?:as\s+|comme\s+)?['"`«]?\s*(?:non\s*(?:disponible|spécifié|specifie|fourni)|hallucinated|fabricated)\s*['"`»]?/gi, " ");
  return WEAK_MARKERS.some((m) => cleaned.includes(m));
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
  // Hero KPI doit avoir tous les champs critiques renseignés (non null/undefined).
  // value et yoy peuvent être number (ex AAPL 23.9) OU string (ex "23.9"). Le
  // composant formatHeroValue les coerce. type / unit / short doivent rester
  // string. Reject seulement les placeholders explicites ("Non disponible").
  // type et short DOIVENT être renseignés. unit peut être vide (KPIs
  // unitless comme "Store Count" / "Headcount" / "Streak" / etc.) car le
  // composant gère unit absent. Yann 14 mai 2026 (CASY bloqué à tort).
  for (const f of ["type", "short"] as const) {
    const raw = hero[f];
    if (typeof raw !== "string") return false;
    if (PLACEHOLDER_VALUES.test(raw.trim())) return false;
  }
  // unit : si string non-vide, vérifier qu'elle n'est pas un placeholder
  // explicite. Si vide ou undefined, OK (unitless KPI).
  const rawUnit = hero.unit;
  if (rawUnit !== undefined && rawUnit !== null && typeof rawUnit === "string" && rawUnit.trim()) {
    if (PLACEHOLDER_VALUES.test(rawUnit.trim())) return false;
  }
  // value et yoy : accepter string OU number. Reject si null/undefined ou
  // string placeholder.
  for (const f of ["value", "yoy"] as const) {
    const raw = hero[f];
    if (raw === undefined || raw === null) return false;
    if (typeof raw === "string" && PLACEHOLDER_VALUES.test(raw.trim())) return false;
    if (typeof raw !== "string" && typeof raw !== "number") return false;
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

/**
 * V1.8 (Yann 7 mai 2026) : version plus permissive du filtre, qui affiche
 * la fiche dès que le hero KPI est utilisable + Pass 3 Sonnet OK.
 * Les blocs manquants (risks, governance, AI positioning, segments, etc.)
 * sont rendus en placeholder rouge dans la UI (mode `v18Mode={true}`).
 *
 * Critères stricts conservés :
 *  - Validation Sonnet présente (= Pass 3 a tourné)
 *  - Hero KPI utilisable (value/yoy/type/unit/short non-placeholder)
 *  - `_fit_for_site` n'est pas explicitement à false
 *
 * Critères assouplis vs V1.7 strict :
 *  - hasPass2 (risks/gov/AI) : NON requis (les blocs vides s'affichent rouge)
 *  - hasWeakMarker : NON bloquant (les markers texte sont juste indicatifs)
 *  - kpiQualityLow : NON bloquant
 */
export function isV18Eligible(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const obj = v as AnyRecord;
  if ((obj._fit_for_site as boolean | undefined) === false) return false;
  if (!(obj._validation || obj._validation_global)) return false;
  if (!heroKpiUsable(obj)) return false;
  return true;
}

/** Compte les blocs manquants pour la UI v18 (afficher placeholder rouge). */
export type V18MissingBlocks = {
  risks: boolean;
  governance: boolean;
  ai_positioning: boolean;
  market_positions: boolean;
  events: boolean;
};

export function v18MissingBlocks(v: unknown): V18MissingBlocks {
  const obj = (v && typeof v === "object" ? v : {}) as AnyRecord;
  const isEmpty = (k: string) => {
    const x = obj[k];
    if (Array.isArray(x)) return x.length === 0;
    return !x;
  };
  return {
    risks: isEmpty("risks"),
    governance: isEmpty("governance"),
    ai_positioning: isEmpty("ai_positioning"),
    market_positions: isEmpty("market_positions"),
    events: isEmpty("events"),
  };
}
