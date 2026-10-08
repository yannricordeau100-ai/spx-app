/**
 * Regroupement des KPI du tableau « Indicateurs clés long terme » d une fiche
 * (8 oct 2026). Code DEPLACE a l identique depuis company-view.tsx, pour que la
 * fiche et le compteur automatique des KPI (scripts/genere-comptes-kpi.ts,
 * /sandbox/comptes-kpi) appliquent exactement les memes regles.
 * Module pur : utilisable cote navigateur comme cote serveur.
 */
import { orderKpis } from "@/lib/kpi-ordering";
import { estKpiStandard } from "@/lib/kpi-standard";
import type { Company } from "@/lib/data";

// Yann 8 juin 2026 : un KPI n'est affichable que s'il a une VRAIE valeur non
// nulle. Un "0,0" n'apporte aucune plus-value et trahit presque toujours une
// extraction ratee (ex Cap Return avec history toute a zero sur 226 stes).
// Applique au tableau Indicateurs cles + au hero par defaut + aux stories.
export function kpiHasUsableValue(k?: { value?: unknown } | null): boolean {
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

/* Yann 16 sept 2026 : le chiffre d affaires a son bloc dedie (repartition par
   zone et par segment). Les KPI ANNUELS qui repetent ce bloc (CA total, CA
   d une grande zone, CA d un segment deja montre) sortent du tableau ; les KPI
   TRIMESTRIELS de chiffre d affaires sont regroupes sous le bloc de
   repartition, dans un deplie. Les petites zones geographiques restent. */
export function sansAccent(v: unknown): string {
  return String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}
const RE_CA = /(chiffre d affaires|\bca\b|revenue|revenues|net sales|\bsales\b|turnover|ventes)/;
const ZONES_LARGES = [
  "monde", "mondial", "worldwide", "global", "international", "groupe", "group", "total",
  "amerique", "ameriques", "america", "americas", "north america", "amerique du nord", "latam", "amerique latine", "latin america",
  "europe", "emea", "eu", "zone euro", "euro area", "asie", "asia", "apac", "asie pacifique", "asia pacific",
  "reste du monde", "rest of world", "row", "autres pays", "other countries", "afrique", "africa", "moyen orient", "middle east",
];
/* Un vrai montant de chiffre d affaires : en monnaie, et pas une croissance,
   une part, une marge ni un taux (« Croissance revenu Azure » ou « Part des
   hyperscalers dans le Data Center » restent des KPI a part entiere). */
const RE_PAS_MONTANT = /(croissance|growth|\bpart\b|\bshare\b|marge|margin|taux|\brate\b|ratio|run rate|par action|per share|pourcentage|percent)/;
export function estMontantCa(k: { name_fr?: string; name_en?: string; short?: string; unit?: string }): boolean {
  const u = String(k.unit ?? "");
  if (!u || /%|pts|points/.test(u)) return false;
  if (!/[$€£]|chf|usd|eur|gbp|mds|\bm\b|milliard|million/i.test(u)) return false;
  return !RE_PAS_MONTANT.test(sansAccent([k.name_fr, k.name_en, k.short].filter(Boolean).join(" ")));
}
export function estCaAnnuelRedondant(k: { short?: string; name_fr?: string; name_en?: string; period_type?: string; unit?: string }, libelles: Set<string>): boolean {
  if (!estMontantCa(k)) return false;
  const pt = k.period_type;
  if (pt === "quarter" || pt === "semester") return false;
  const nom = sansAccent([k.name_fr, k.name_en, k.short].filter(Boolean).join(" "));
  if (!RE_CA.test(nom)) return false;
  const reste = nom
    .replace(RE_CA, " ")
    .replace(/(total|totaux|net|nets|annuel|annuelle|consolide|consolidee|groupe|group|du|de|des|la|le|les|par|en|d|l|segment|division|activite|activites|zone|geographique|region|regional)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!reste) return true; // CA total
  if (libelles.has(reste)) return true; // segment ou zone deja dans le bloc de repartition
  for (const z of ZONES_LARGES) if (reste === z || reste.startsWith(z + " ") || reste.endsWith(" " + z)) return true;
  return false;
}
export function estCaTrimestriel(k: { short?: string; name_fr?: string; name_en?: string; period_type?: string; unit?: string }): boolean {
  if (k.period_type !== "quarter") return false;
  if (!estMontantCa(k)) return false;
  return RE_CA.test(sansAccent([k.name_fr, k.name_en, k.short].filter(Boolean).join(" ")));
}

export const GROUPE_ARRETES_ACTIF = true;

/** 27 sept 2026 (Yann, choix B) : un KPI est « arrêté » quand il n'a plus de
 *  valeur depuis 4 trimestres. Référence : le dernier trimestre clos et publié
 *  (trimestre fini depuis plus de 45 jours). Pour un KPI annuel : dernier
 *  exercice antérieur à l'avant-dernier exercice clos. */
export function estKpiArrete(k: { period_type?: string; frequency?: string; last_data_date?: string | null; history?: unknown[]; history_periods?: unknown[] }): boolean {
  const lab = (x: unknown): string => (x && typeof x === "object" ? String((x as { q?: string }).q ?? "") : String(x ?? ""));
  const periodes = Array.isArray(k.history_periods) && k.history_periods.length ? k.history_periods.map(lab) : Array.isArray(k.history) ? k.history.map(lab) : [];
  const derniere = periodes.length ? periodes[periodes.length - 1] : "";
  const ref = new Date(Date.now() - 45 * 86400000);
  const refIdx = ref.getUTCFullYear() * 4 + Math.floor(ref.getUTCMonth() / 3) - 1; // dernier trimestre clos
  const mq = derniere.match(/(?:Q|T)([1-4])[^0-9]*(20\d\d)|(20\d\d)[^0-9]*(?:Q|T)([1-4])/);
  if (mq) {
    const t = Number(mq[1] ?? mq[4]), an = Number(mq[2] ?? mq[3]);
    return refIdx - (an * 4 + t - 1) >= 4;
  }
  const trimestriel = k.period_type === "quarter" || k.frequency === "quarterly";
  const an = Number((derniere.match(/(20\d\d)/) ?? [])[1] ?? String(k.last_data_date ?? "").slice(0, 4));
  if (!Number.isFinite(an) || an < 2000) return false;
  if (trimestriel) {
    const d = String(k.last_data_date ?? "");
    const mois = Number(d.slice(5, 7));
    if (!mois) return false;
    return refIdx - (an * 4 + Math.floor((mois - 1) / 3)) >= 4;
  }
  // annuel : exercice N-2 ou plus ancien par rapport au dernier exercice clos
  return an <= ref.getUTCFullYear() - 2;
}

export type GroupesKpisFiche = {
  avances: Company["kpis"];
  standards: Company["kpis"];
  arretes: Company["kpis"];
  caTrimestriels: Company["kpis"];
};

/** Les groupes du tableau des KPI, tels que la fiche les affiche. */
export function groupesKpisFiche(company: Company): GroupesKpisFiche {
    const all = orderKpis(company.kpis, company.hero_kpi);
    // Libelles deja montres par le bloc de repartition du chiffre d affaires.
    const libellesRepartition = new Set<string>();
    for (const b of [company.revenue_by_geography, company.revenue_by_segment]) {
      for (const sl of ((b?.slices ?? []) as { name?: string; label?: string; label_en?: string }[])) {
        for (const v of [sl.name, sl.label, sl.label_en]) {
          const n = sansAccent(v);
          if (n) libellesRepartition.add(n);
        }
      }
    }
    // Hero KPI toujours visible (même s'il est dans la library générique,
    // ex pour SP500 où on a activé manuellement Revenue comme hero).
    const heroShort = company.hero_kpi;
    // Yann 26 mai 2026 — Règle ABSOLUE : aucun KPI hero ou Indicateurs clés
    // avec moins de 3 ans d'historique. Sources :
    // 1. enrich._kpis_hidden_by_history_rule (produit par fix-hero-kpi-history.py)
    // 2. Filtre live : history.length < seuil pour son period_type
    //    (year/undefined → 3, quarter → 12, semester → 6).
    const hiddenByRule = new Set(
      ((company as unknown as { _kpis_hidden_by_history_rule?: string[] })
        ._kpis_hidden_by_history_rule) || []
    );
    // Yann 27 mai 2026 : seuil relâché. 12 quarters = 3 ans était trop strict,
    // filtrait 14/15 KPIs sur GOOGL (segments newly disclosed). Maintenant
    // 4 quarters = 1 an minimum, semestre 2 = 1 an, année 3 = 3 ans.
    const requiredForPeriod = (pt?: string) => {
      if (pt === "quarter") return 4;
      if (pt === "semester") return 2;
      return 3; // year or undefined
    };
    // Yann 28 mai 2026 — REVERT des fallback "min 5 indicateurs" qui
    // incluaient des KPIs génériques (Revenue / Op Margin / EPS / Net
    // Income / Capex / R&D / Headcount / etc.) en violation directe de la
    // règle §0septies "KPI SPÉCIFIQUES UNIQUEMENT" (édictée 19 mai).
    // Aucun fallback n'inclut plus de génériques. Si <5 spécifiques
    // disponibles pour une société, on affiche MOINS de 5 — c'est honnête
    // côté contenu vs faux confort "5 visibles" avec génériques.
    const filtered = all.filter((k) => {
      // Yann 8 juin 2026 : jamais de KPI a valeur 0/null affiche (meme le
      // hero). Un "0,0" n'a aucune PV. Le hero reste prioritaire MAIS doit
      // avoir une vraie valeur.
      if (!kpiHasUsableValue(k)) return false;
      if (k.short === heroShort) return true;
      // Le chiffre d affaires annuel deja porte par le bloc de repartition sort du tableau.
      if (estCaAnnuelRedondant(k as { short?: string; name_fr?: string; name_en?: string; period_type?: string; unit?: string }, libellesRepartition)) return false;
      // Yann 29 aout 2026 : un KPI cree a la main (hors_document) est TOUJOURS
      // accepte, quelle que soit sa cadence ou la longueur de son historique.
      if ((k as unknown as { hors_document?: boolean }).hors_document === true) return true;
      // 9 sept 2026 : les generiques ne sont plus ecartes, ils vont dans le
      // groupe « KPI standard » (barre depliable separee), cf estKpiStandard.
      if (hiddenByRule.has(k.short)) return false;
      const hist = Array.isArray(k.history) ? k.history : [];
      const pt = (k as unknown as { period_type?: string }).period_type;
      if (hist.length < requiredForPeriod(pt)) return false;
      return true;
    });
    // Yann 30 aout 2026 (option A) : la regle trimestriel-only du 15 juin est
    // ABROGEE. Un KPI annuel s affiche des 3 ans d historique.
    // Yann 31 aout 2026 (ordre) : PRIORITE aux series trimestrielles de
    // 5 ans et plus (20 trimestres), puis les autres (3 a 5 ans, annuel ou
    // trimestriel). Tri stable : l ordre d orderKpis est conserve au sein de
    // chaque groupe, le hero reste en tete.
    // Yann 31 aout 2026 (ordre final) : les KPI wow (physiques, distinctifs)
    // en haut, les purement financiers en bas, le chiffre d affaires tout en
    // bas. Second critere : les series trimestrielles de 5 ans et plus avant
    // les 3-5 ans. Tri stable, hero toujours en tete.
    const RX_CA = /\b(chiffre d.affaires|revenue|revenus?|net sales|total sales|\bca\b|\brev\b)\b/i;
    const RX_MONNAIE = /[$€¥£]|\b(chf|sek|dkk|nok|usd|eur|gbp|mds?)\b/i;
    const RX_FIN = /\b(marge|margin|b[ée]n[ée]fice|r[ée]sultat|income|profit|eps|bpa|dette|debt|fcf|cash.?flow|tr[ée]sorerie|capex|dividende|dividend|ebitda|ebit|buyback|rachats)\b/i;
    // 28 sept 2026 (Yann) : le KPI d industrie de la societe vient en premier,
    // juste apres le hero.
    const industrie = new Set(company.kpi_industrie_shorts ?? []);
    const rang = (k: (typeof filtered)[number]): number => {
      if (k.short === heroShort) return -1;
      if (industrie.has(k.short)) return -0.5;
      const nom = `${k.short ?? ""} ${k.name_fr ?? ""} ${k.name_en ?? ""}`;
      const unite = String((k as { unit?: string }).unit ?? "");
      const financier = RX_MONNAIE.test(unite) || RX_FIN.test(nom) || (unite.includes("%") && RX_FIN.test(nom));
      if (financier) return RX_CA.test(nom) ? 3 : 2;
      return 0; // wow / physique
    };
    const anciennete = (k: (typeof filtered)[number]): number => {
      const pts = Array.isArray(k.history) ? k.history.length : 0;
      const trimestriel =
        (k as unknown as { period_type?: string }).period_type === "quarter";
      return trimestriel && pts >= 20 ? 0 : 1;
    };
    const tries = [...filtered]
      .map((k, i) => ({ k, i }))
      .sort(
        (a, b) =>
          rang(a.k) - rang(b.k) || anciennete(a.k) - anciennete(b.k) || a.i - b.i,
      )
      .map((x) => x.k);
    // 9 sept 2026 (demande du proprietaire) : deux groupes dans le meme bloc.
    // « KPI avances » = propres a la societe (hero compris), en clair ;
    // « KPI standard » = intitules retrouvables partout (CA, marges, resultat,
    // BPA, dette...), dans une barre depliable separee.
    // 26 sept 2026 (demande du proprietaire) : troisieme groupe, « KPI arretes
    // par la societe » : series trimestrielles dont le dernier point date de
    // 2025 ou avant (la societe ne les publie plus). Le hero reste en tete.
    // Desactive tant que le proprietaire n a pas tranche : une partie de ces
    // series est seulement en retard dans nos donnees, pas arretee par la societe.
    const arretes = GROUPE_ARRETES_ACTIF ? tries.filter((k) => k.short !== heroShort && estKpiArrete(k)) : [];
    const courants = tries.filter((k) => !arretes.includes(k));
    return {
      avances: courants.filter((k) => k.short === heroShort || industrie.has(k.short) || !estKpiStandard(k)),
      standards: courants.filter((k) => k.short !== heroShort && !industrie.has(k.short) && estKpiStandard(k)),
      arretes,
      caTrimestriels: all.filter(
        (k) => k.short !== heroShort && kpiHasUsableValue(k) && estCaTrimestriel(k as { short?: string; name_fr?: string; name_en?: string; period_type?: string; unit?: string }),
      ),
    };
}
