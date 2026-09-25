/**
 * Yann 25 sept 2026 : sigles peu clairs des noms de KPI, expliques dans le
 * « i » de chaque KPI qui les contient (tableau des indicateurs cles).
 * Definitions courtes, pour un investisseur qui decouvre le sigle.
 */
export const SIGLES_KPI: Record<string, string> = {
  EBITDA: "Résultat avant intérêts, impôts et amortissements.",
  EBITA: "Résultat avant intérêts, impôts et amortissement des acquisitions.",
  EBIT: "Résultat avant intérêts et impôts.",
  BPA: "Bénéfice par action.",
  GAAP: "Normes comptables officielles américaines.",
  IFRS: "Normes comptables internationales.",
  EMEA: "Europe, Moyen-Orient et Afrique.",
  APAC: "Asie-Pacifique.",
  MEA: "Moyen-Orient et Afrique.",
  NOI: "Revenu net d'exploitation des immeubles.",
  FFO: "Flux de trésorerie d'une foncière (résultat hors amortissements et plus-values).",
  AFFO: "FFO diminué des travaux d'entretien récurrents.",
  AUM: "Actifs sous gestion.",
  FCF: "Argent généré une fois les investissements payés.",
  OCF: "Argent généré par l'activité courante.",
  ROE: "Rentabilité des fonds propres.",
  ROIC: "Rentabilité des capitaux investis.",
  ROCE: "Rentabilité des capitaux employés.",
  ROTE: "Rentabilité des fonds propres tangibles.",
  RPO: "Contrats signés, pas encore facturés.",
  ARR: "Revenu annuel récurrent des abonnements.",
  ARPU: "Revenu moyen par utilisateur.",
  ARPA: "Revenu moyen par compte client.",
  "SG&A": "Frais commerciaux, généraux et administratifs.",
  ETP: "Équivalent temps plein.",
  NGL: "Liquides de gaz naturel (éthane, propane, butane).",
  DTC: "Vente directe au consommateur.",
  OEM: "Vente à un fabricant qui intègre le produit dans le sien.",
  ASV: "Valeur annuelle des contrats d'abonnement.",
  PNB: "Produit net bancaire, l'équivalent du chiffre d'affaires d'une banque.",
  FRE: "Revenus de commissions de gestion.",
  NAV: "Valeur nette des actifs.",
  GMV: "Montant total des ventes passées par la plateforme.",
  MRR: "Revenu mensuel récurrent.",
  SBC: "Rémunération versée en actions.",
  TTM: "Sur les douze derniers mois.",
  YTD: "Depuis le début de l'année.",
};

const RE = new RegExp(
  `(?<![A-Za-z&])(${Object.keys(SIGLES_KPI).sort((a, b) => b.length - a.length).map((s) => s.replace(/&/g, "&")).join("|")})(?![A-Za-z&])`,
  "g",
);

/** Sigles connus presents dans un nom de KPI, dans l ordre d apparition, sans doublon. */
export function siglesDuNom(nom: string | undefined | null): { sigle: string; sens: string }[] {
  if (!nom) return [];
  const vus = new Set<string>();
  const out: { sigle: string; sens: string }[] = [];
  for (const m of nom.matchAll(RE)) {
    const s = m[1];
    if (vus.has(s)) continue;
    vus.add(s);
    out.push({ sigle: s, sens: SIGLES_KPI[s] });
  }
  return out;
}
