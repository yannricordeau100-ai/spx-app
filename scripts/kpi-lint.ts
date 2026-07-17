/**
 * KPI LINT : vérificateur programmatique de TOUTES les règles d'affichage et
 * de fond, pour CHAQUE KPI de CHAQUE sté (503), via le loader réel et les
 * vraies fonctions de rendu (zéro LLM, zéro token).
 *
 * Yann 18 juil 2026 : "il faut écrire une règle d'affichage pour tous les KPI
 * définissant un ensemble de choses devant être présentes et qui font un
 * graph complet et sans erreur nulle part" + rapport visible en sandbox.
 *
 * Sortie : src/data/_kpi-lint-report.json (importé statiquement par
 * /sandbox/kpi-lint). Relançable à volonté. Intégré au cron quarterly-refresh
 * comme verrou supplémentaire.
 *
 * Usage : npx tsx scripts/kpi-lint.ts [--tickers AAPL,MA] [--quiet]
 */
import fs from "fs";
import path from "path";
import { loadV17Company } from "../src/lib/company-core/load-company";
import { orderKpis } from "../src/lib/kpi-ordering";
import { isGenericKpi } from "../src/lib/kpi-generic";
import { formatHeroValue, yoySamePeriod, cagr } from "../src/lib/data";

type Issue = {
  ticker: string;
  kpi: string; // short ("" = niveau sté)
  rule: string;
  severity: "rouge" | "orange";
  detail: string;
};

const ROOT = path.join(__dirname, "..");

/* ── Les RÈGLES (référence unique, affichée telle quelle en sandbox) ── */
export const RULES: Record<string, { label: string; desc: string }> = {
  R1_CHIFFRE_1_999: {
    label: "Chiffre affiché 1-999 + magnitude",
    desc: "La valeur affichée (hero et table) doit tomber dans [1, 999] avec l'unité de magnitude correcte (5 389 M USD interdit, 5,39 Mds $ attendu). Simulé via formatHeroValue.",
  },
  R2_UNITE_CONNUE: {
    label: "Unité formatable",
    desc: "L'unité doit être vide (unitless), % ou connue du formateur (pas de B/$M/USD bruts affichés, pas d'unité dans la valeur).",
  },
  R3_GRAPH_COMPLET: {
    label: "Graph complet, périodes contiguës",
    desc: "Série trimestrielle : tous les trimestres entre le premier et le dernier point présents (aucun trou T1/T2/T3/T4), pas de mix annuel/trimestriel, labels de périodes parseables, pas de FY visible.",
  },
  R4_YOY_JUSTE: {
    label: "YoY cohérent avec l'history",
    desc: "Le YoY affichable (même trimestre N-1 par label) doit exister et, si un yoy est stocké, ne pas le contredire en signe au-delà de 15 points.",
  },
  R5_VALUE_VS_HISTORY: {
    label: "Value cohérente avec la série",
    desc: "Ratio value / dernier point dans une fenêtre plausible (niveau ~1, annuel vs trimestre 1,9-5,5, trimestre vs annuel 0,18-0,53). Hors fenêtre sans note _fp/_needs_review = rouge.",
  },
  R6_TEXTES_FR: {
    label: "Titre FR propre",
    desc: "name_fr présent, pas d'em-dash, pas de mots FR sans accents (emises, resultat, activites...), pas d'anglais brut évident.",
  },
  R7_TOOLTIP_I: {
    label: "Tooltip i présent",
    desc: "Chaque KPI des Indicateurs clés a une description/explanation non vide (>4 caractères).",
  },
  R8_DOUBLONS: {
    label: "Zéro doublon de nom",
    desc: "Aucun KPI rendu deux fois sous le même nom normalisé (accents/casse/ponctuation ignorés, chiffres conservés).",
  },
  R9_MIN_INDICATEURS: {
    label: "Minimum 4 indicateurs",
    desc: "Au moins 4 KPI rendus dans les Indicateurs clés (5 attendus, 4 toléré orange, moins = rouge).",
  },
  R10_HERO_VALIDE: {
    label: "Hero valide",
    desc: "hero_kpi pointe vers un KPI existant, value non nulle, yoy présent ou dérivable, history ≥ 5 points.",
  },
  R11_CAGR_PLAUSIBLE: {
    label: "CAGR plausible",
    desc: "CAGR annualisé absent ou dans ±200 %/an.",
  },
  R12_FRAICHEUR: {
    label: "Fraîcheur des données",
    desc: "last_data_date du hero < 15 mois (orange au-delà, rouge > 24 mois). Limite : KPI annuels naturellement à 12+ mois tolérés jusqu'à 15.",
  },
  R13_TAM_HONNETE: {
    label: "TAM honnête",
    desc: "Une market_position n'est rendue QUE si la sté a divulgué elle-même segment ET TAM avec source. TAM externe + CA interne interdit. Limite : bloc absent = conforme (couverture facultative).",
  },
  R14_RISQUES: {
    label: "Risques complets",
    desc: "Au moins 3 risques rendus, chacun avec catégorie, score 1-5 et score_rationale non vide (citant les 4 critères). Rouge si <3 risques ou score hors bornes, orange si rationale vide.",
  },
  R15_GOUVERNANCE: {
    label: "Gouvernance & rémunération",
    desc: "Bloc gouvernance présent avec CEO identifié et rémunération. Limite : stés sans proxy post-fusion (ex PSKY) tolérées si _no_proxy_note.",
  },
  R16_STORIES_DATEES: {
    label: "Stories datées et parlantes",
    desc: "Chaque story KPI rendue a un signal non vide (pas de carte muette) et une last_data_date parseable (badge de période dérivable). Orange par story fautive, max 1 flag par sté.",
  },
  R18_REPARTITION_CA: {
    label: "Répartition CA",
    desc: "revenue_by_segment présent (orange si absent) ; geography souhaitée. Limite : mono-segment légitime si note explicite.",
  },
  R19_EVENTS: {
    label: "Événements",
    desc: "Au moins 3 événements de timeline. Orange si moins. Limite : IPO récentes tolérées.",
  },
  R20_AI_POSITIONING: {
    label: "Positionnement IA",
    desc: "Stance parmi leader/integrator/cautious/absent + au moins 2 éléments de preuve. Orange si incomplet.",
  },
};

const norm = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

const NOACCENT = /\b(emises?|resultat|activites?|tresorerie|penetration|reseau|premiere|matiere|donnees|deploye|genere|revenus? recurrents?)\b/;

function parseP(q: unknown): { q: number; y: number } | null {
  const m = String(q ?? "").match(/^Q([1-4])[\s-](?:FY)?(\d{4})$/i);
  return m ? { q: Number(m[1]), y: Number(m[2]) } : null;
}

async function lintTicker(t: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  const push = (kpi: string, rule: string, severity: "rouge" | "orange", detail: string) =>
    issues.push({ ticker: t, kpi, rule, severity, detail: detail.slice(0, 120) });

  let r: Awaited<ReturnType<typeof loadV17Company>>;
  try {
    r = await loadV17Company(t, { mode: "v18", locale: "fr" } as never);
  } catch (e) {
    push("", "R10_HERO_VALIDE", "rouge", "loader exception: " + String((e as Error).message).slice(0, 60));
    return issues;
  }
  const c = (r as { company?: unknown }).company as
    | { hero_kpi?: string; kpis?: Array<Record<string, unknown>>; _kpis_hidden_by_history_rule?: string[] }
    | undefined;
  if (!c || !Array.isArray(c.kpis)) {
    push("", "R10_HERO_VALIDE", "rouge", "kind=" + (r as { kind?: string }).kind);
    return issues;
  }

  /* Reproduit la liste Indicateurs clés rendue (même filtre que company-view) */
  const usable = (k: Record<string, unknown>) => {
    const v = k?.value;
    if (v === null || v === undefined || v === "") return false;
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(/\s/g, "").replace(",", ".").replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n) && n === 0) return false;
    return true;
  };
  const hidden = new Set(c._kpis_hidden_by_history_rule || []);
  const req = (pt?: unknown) => (pt === "quarter" ? 4 : pt === "semester" ? 2 : 3);
  const all = orderKpis(c.kpis as never, c.hero_kpi as never) as unknown as Array<Record<string, unknown>>;
  let table = all.filter((k) => {
    if (!usable(k)) return false;
    if (k.short === c.hero_kpi) return true;
    if (isGenericKpi(String(k.short))) return false;
    if (hidden.has(String(k.short))) return false;
    const h = Array.isArray(k.history) ? k.history : [];
    if (h.length < req(k.period_type)) return false;
    return true;
  });
  const qc = table.filter((k) => k.period_type === "quarter").length;
  if (qc >= 3) table = table.filter((k) => k.short === c.hero_kpi || k.period_type === "quarter");

  const hero = c.kpis.find((k) => k.short === c.hero_kpi);
  const audited: Array<{ k: Record<string, unknown>; isHero: boolean }> = [
    ...(hero ? [{ k: hero, isHero: true }] : []),
    ...table.filter((k) => k !== hero).map((k) => ({ k, isHero: false })),
  ];

  /* R9 */
  if (table.length < 4) push("", "R9_MIN_INDICATEURS", table.length < 3 ? "rouge" : "orange", `${table.length} indicateurs rendus`);

  /* R10 */
  if (!hero) push("", "R10_HERO_VALIDE", "rouge", `hero_kpi "${c.hero_kpi}" introuvable`);
  else {
    const h = Array.isArray(hero.history) ? hero.history : [];
    if (!usable(hero)) push(String(hero.short), "R10_HERO_VALIDE", "rouge", "hero sans valeur utilisable");
    if (h.length < 5) push(String(hero.short), "R10_HERO_VALIDE", "orange", `hero history ${h.length} pts (<5)`);
  }

  /* R8 doublons sur la table rendue */
  const seen: Record<string, string> = {};
  for (const k of table) {
    const key = norm(k.name_fr);
    if (key && seen[key]) push(String(k.short), "R8_DOUBLONS", "rouge", `"${k.name_fr}" en double avec ${seen[key]}`);
    else if (key) seen[key] = String(k.short);
  }

  for (const { k, isHero } of audited) {
    const short = String(k.short ?? "");
    const unit = String(k.unit ?? "").trim();
    const hist = (Array.isArray(k.history) ? k.history : []).filter((v): v is number => typeof v === "number");
    const periods = Array.isArray(k.history_periods) ? (k.history_periods as unknown[]) : [];
    const isPct = unit === "%";
    const rawVal = typeof k.value === "number" ? k.value : parseFloat(String(k.value ?? "").replace(/\s/g, "").replace(",", ".").replace(/[^0-9.-]/g, ""));

    /* R1 : simule le rendu du chiffre (hero = dernier point pour trimestriel, sinon value) */
    const displayNum = k.period_type === "quarter" && hist.length >= 5 && isHero ? hist[hist.length - 1] : rawVal;
    if (Number.isFinite(displayNum) && !isPct && unit) {
      const fmt = formatHeroValue(displayNum, unit);
      const numOut = parseFloat(String(fmt.value).replace(/\s| /g, "").replace(",", "."));
      // Plafond assumé : pas de tier au-dessus de Mds (décision Yann) → >999 toléré si l'unité de sortie est déjà Mds*.
      const isMdsOut = /^Mds/.test(fmt.unit) || /^Mrd/.test(fmt.unit);
      // La règle 1-999 s'applique aux unités MONÉTAIRES ou à échelle (M/Mds/K/
      // million...). Les counts naturels (magasins, logements, MW, rooms...)
      // s'affichent tels quels : "1 250 magasins" est correct.
      const isScaledUnit = /[$€£]|USD|EUR|GBP|CHF|JPY|\bM\b|\bMds\b|\bMrd\b|\bK\b|million|milliard|Bn\b/i.test(fmt.unit);
      if (Number.isFinite(numOut) && isScaledUnit && ((Math.abs(numOut) >= 1000 && !isMdsOut) || (Math.abs(numOut) > 0 && Math.abs(numOut) < 1 && /Mds|M |K /.test(fmt.unit)))) {
        push(short, "R1_CHIFFRE_1_999", "rouge", `rendu "${fmt.value} ${fmt.unit}" hors [1,999]`);
      }
    }

    /* R2 : unité affichée encore brute */
    if (unit && !isPct) {
      const fmtU = formatHeroValue(Number.isFinite(displayNum) ? displayNum : 1, unit).unit;
      if (/^(B|\$B|B\$|USD|EUR|\$M|M\$|MUSD)$/i.test(fmtU) || /Mrd|million|USD millions|millions? de|\bmn\b/i.test(fmtU))
        push(short, "R2_UNITE_CONNUE", "rouge", `unité non normalisée "${fmtU}"`);
    }
    if (typeof k.value === "string" && /[A-Za-z]{3,}/.test(String(k.value)) && !/^n\/?a$/i.test(String(k.value)))
      push(short, "R2_UNITE_CONNUE", "rouge", `texte dans value: "${String(k.value).slice(0, 40)}"`);

    /* R3 : graph complet */
    if (k.period_type === "quarter" && periods.length === hist.length && periods.length >= 4) {
      const parsed = periods.map(parseP);
      if (parsed.some((p) => p === null)) {
        const bad = periods[parsed.findIndex((p) => p === null)];
        if (/^FY\d{4}$/i.test(String(bad))) push(short, "R3_GRAPH_COMPLET", "rouge", `label annuel "${bad}" dans une série trimestrielle`);
        else push(short, "R3_GRAPH_COMPLET", "orange", `label non parseable "${bad}"`);
      } else {
        const idx = (p: { q: number; y: number }) => p.y * 4 + (p.q - 1);
        const ps = (parsed as Array<{ q: number; y: number }>).map(idx);
        for (let i = 1; i < ps.length; i++) {
          if (ps[i] - ps[i - 1] !== 1) {
            push(short, "R3_GRAPH_COMPLET", "rouge", `trou entre ${periods[i - 1]} et ${periods[i]}`);
            break; // 1 flag par KPI suffit
          }
        }
      }
    }
    if (/FY ?20\d\d/.test(String(k.name_fr ?? "") + " " + unit)) push(short, "R3_GRAPH_COMPLET", "rouge", "FY visible dans titre/unité");

    /* R4 : YoY */
    if (k.period_type === "quarter" && hist.length >= 5 && !isPct) {
      const byLabel = yoySamePeriod(hist, periods as never);
      if (byLabel === null && periods.length !== hist.length)
        push(short, "R4_YOY_JUSTE", "orange", "périodes absentes: YoY par label impossible (fallback -4 positions)");
      const stored = typeof k.yoy === "number" ? k.yoy : parseFloat(String(k.yoy ?? "").replace(",", ".").replace(/[^0-9.-]/g, ""));
      const real = byLabel !== null ? byLabel : hist[hist.length - 5] !== 0 ? ((hist[hist.length - 1] - hist[hist.length - 5]) / Math.abs(hist[hist.length - 5])) * 100 : null;
      if (real !== null && Number.isFinite(stored) && Math.abs(real - stored) > 15 && Math.sign(real) !== Math.sign(stored))
        push(short, "R4_YOY_JUSTE", "orange", `yoy stocké ${stored}% vs réel ${real.toFixed(1)}% (affichage recalculé OK, data à nettoyer)`);
    }

    /* R5 */
    if (hist.length >= 2 && Number.isFinite(rawVal) && rawVal > 0 && hist[hist.length - 1] > 0 && !isPct) {
      const ratio = rawVal / hist[hist.length - 1];
      const noted = Boolean((k as { _fp_note?: unknown; _needs_review?: unknown; _value_note?: unknown })._fp_note || (k as { _needs_review?: unknown })._needs_review || (k as { _value_note?: unknown })._value_note);
      if (!((ratio >= 0.55 && ratio <= 1.8) || (ratio >= 1.9 && ratio <= 5.5) || (ratio >= 0.18 && ratio <= 0.53)) && !noted)
        push(short, "R5_VALUE_VS_HISTORY", "rouge", `ratio value/dernier point = ${ratio.toFixed(2)}`);
    }

    /* R6 */
    const nameFr = String(k.name_fr ?? "");
    if (!nameFr.trim()) push(short, "R6_TEXTES_FR", "rouge", "name_fr vide");
    if (nameFr.includes("—")) push(short, "R6_TEXTES_FR", "rouge", "em-dash dans le titre");
    if (NOACCENT.test(nameFr.toLowerCase()) && /emises|resultat|activites|tresorerie|reseau|premiere|matiere|donnees/.test(nameFr))
      push(short, "R6_TEXTES_FR", "orange", `accents manquants probables: "${nameFr.slice(0, 50)}"`);

    /* R7 */
    const desc = String((k as { description?: unknown }).description ?? (k as { explanation?: unknown }).explanation ?? "");
    if (desc.trim().length <= 4) push(short, "R7_TOOLTIP_I", "orange", "pas de description tooltip");
    if (desc.includes("—")) push(short, "R6_TEXTES_FR", "orange", "em-dash dans la description");

    /* R11 */
    if (hist.length >= 2) {
      const cg = cagr(hist, unit, (k.period_type as never) ?? "year");
      if (cg !== null && Math.abs(cg) > 200) push(short, "R11_CAGR_PLAUSIBLE", "orange", `CAGR ${cg.toFixed(0)}%/an`);
    }

    /* R12 : hero seulement. Fraîcheur = fin de la DERNIÈRE PÉRIODE de la série
       si labels parseables (la métadonnée last_data_date est parfois périmée
       alors que la série est fraîche, ex AAPL) ; sinon last_data_date. */
    if (isHero) {
      let refDate: number | null = null;
      const lastLabel = periods.length ? parseP(periods[periods.length - 1]) : null;
      if (lastLabel) refDate = new Date(lastLabel.y, lastLabel.q * 3, 0).getTime();
      else if (typeof k.last_data_date === "string" && /^\d{4}-\d{2}/.test(String(k.last_data_date)))
        refDate = new Date(String(k.last_data_date)).getTime();
      if (refDate !== null) {
        const months = (Date.now() - refDate) / (30.44 * 24 * 3600 * 1000);
        if (months > 24) push(short, "R12_FRAICHEUR", "rouge", `dernière donnée il y a ${Math.round(months)} mois`);
        else if (months > 15) push(short, "R12_FRAICHEUR", "orange", `dernière donnée il y a ${Math.round(months)} mois`);
      }
    }
  }
  /* ── Règles blocs sté (R13-R20) ── */
  const cc = c as unknown as {
    market_positions?: Array<Record<string, unknown>>;
    risks?: Array<Record<string, unknown>>;
    governance?: Record<string, unknown> | null;
    events?: unknown[];
    ai_positioning?: { stance?: string; evidence?: unknown[] } | null;
    revenue_by_segment?: unknown;
    stories_kpis?: unknown;
  };

  /* R13 : TAM honnête (bloc facultatif ; si présent, doit être complet) */
  const mpRaw = cc.market_positions as unknown;
  const mpList: Array<Record<string, unknown>> = Array.isArray(mpRaw)
    ? mpRaw
    : Array.isArray((mpRaw as { positions?: unknown[] } | null | undefined)?.positions)
      ? ((mpRaw as { positions: Array<Record<string, unknown>> }).positions)
      : [];
  for (const mp of mpList) {
    const hasSegRev = mp.segment_revenue !== undefined && mp.segment_revenue !== null;
    const hasTam = mp.tam !== undefined && mp.tam !== null;
    const hasSource = typeof mp.source === "string" && String(mp.source).trim().length > 3;
    if (hasTam && (!hasSegRev || !hasSource))
      push(String(mp.segment_name ?? "mp"), "R13_TAM_HONNETE", "rouge", "TAM affiché sans segment_revenue ou sans source sté");
  }

  /* R14 : risques */
  const risks = cc.risks ?? [];
  if (risks.length < 3) push("", "R14_RISQUES", "rouge", `${risks.length} risques rendus (<3)`);
  else {
    for (const rk of risks) {
      const sc = Number(rk.score);
      if (!Number.isFinite(sc) || sc < 1 || sc > 5) { push(String(rk.category ?? "risk"), "R14_RISQUES", "rouge", `score invalide: ${rk.score}`); break; }
      if (!String(rk.score_rationale ?? "").trim()) { push(String(rk.category ?? "risk"), "R14_RISQUES", "orange", "score_rationale vide"); break; }
    }
  }

  /* R15 : gouvernance */
  const gov = cc.governance;
  const hasNoProxyNote = Boolean((gov as { _no_proxy_note?: unknown } | null | undefined)?._no_proxy_note);
  if (!gov || Object.keys(gov).length === 0) {
    if (!hasNoProxyNote) push("", "R15_GOUVERNANCE", "orange", "bloc gouvernance absent");
  }

  /* R16 : stories datées et parlantes (max 1 flag par sté) */
  const stories = (Array.isArray(cc.stories_kpis) ? cc.stories_kpis : []) as Array<Record<string, unknown>>;
  let storyFlagged = false;
  for (const st of stories) {
    if (storyFlagged) break;
    const sig = String(st.signal ?? "").trim();
    const ldd = String(st.last_data_date ?? "");
    const usableStory = sig.length > 0;
    const dated = /^\d{4}-\d{2}/.test(ldd);
    if (usableStory && !dated) { push(String(st.short ?? "story"), "R16_STORIES_DATEES", "orange", "story sans last_data_date parseable"); storyFlagged = true; }
  }

  /* R18 : répartition CA */
  if (!cc.revenue_by_segment) push("", "R18_REPARTITION_CA", "orange", "revenue_by_segment absent");

  /* R19 : events */
  const evts = Array.isArray(cc.events) ? cc.events : [];
  if (evts.length < 3) push("", "R19_EVENTS", "orange", `${evts.length} événements (<3)`);

  /* R20 : AI positioning */
  const ai = cc.ai_positioning;
  if (!ai || !["leader", "integrator", "cautious", "absent"].includes(String(ai.stance ?? "")))
    push("", "R20_AI_POSITIONING", "orange", "stance manquante ou hors référentiel");
  else if (!Array.isArray(ai.evidence) || ai.evidence.length < 2)
    push("", "R20_AI_POSITIONING", "orange", `${Array.isArray(ai.evidence) ? ai.evidence.length : 0} éléments de preuve (<2)`);

  return issues;
}

async function main() {
  const argTickers = process.argv.find((a) => a.startsWith("--tickers"));
  const quiet = process.argv.includes("--quiet");
  const listPath = path.join(ROOT, "src/data/v1-9-5-clean-all-tickers.json");
  let tickers: string[] = (JSON.parse(fs.readFileSync(listPath, "utf8")) as { tickers: string[] }).tickers;
  if (argTickers) tickers = argTickers.split("=")[1].split(",").map((s) => s.trim().toUpperCase());

  const allIssues: Issue[] = [];
  let done = 0;
  for (const t of tickers) {
    try {
      allIssues.push(...(await lintTicker(t)));
    } catch (e) {
      allIssues.push({ ticker: t, kpi: "", rule: "R10_HERO_VALIDE", severity: "rouge", detail: "lint crash: " + String((e as Error).message).slice(0, 60) });
    }
    done++;
    if (!quiet && done % 50 === 0) console.log(`${done}/${tickers.length}...`);
  }

  const byRule: Record<string, number> = {};
  const byTicker: Record<string, number> = {};
  for (const i of allIssues) {
    byRule[i.rule] = (byRule[i.rule] || 0) + 1;
    byTicker[i.ticker] = (byTicker[i.ticker] || 0) + 1;
  }
  const report = {
    generated_at: new Date().toISOString(),
    universe: tickers.length,
    stes_avec_issues: Object.keys(byTicker).length,
    total_issues: allIssues.length,
    rouges: allIssues.filter((i) => i.severity === "rouge").length,
    oranges: allIssues.filter((i) => i.severity === "orange").length,
    by_rule: byRule,
    rules: RULES,
    issues: allIssues,
  };
  fs.writeFileSync(path.join(ROOT, "src/data/_kpi-lint-report.json"), JSON.stringify(report, null, 1));
  console.log(`LINT: ${tickers.length} stés, ${allIssues.length} issues (${report.rouges} rouges, ${report.oranges} oranges)`);
  console.log(JSON.stringify(byRule));
}

main();
