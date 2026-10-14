/**
 * Libelles affiches des KPI (Yann 13 oct 2026, fiche ASML).
 *
 * Yann a lu « Prises de commandes nettes annuelles » comme un nombre de machines
 * alors que c est un montant en Mds €. Trois corrections, appliquees au nom
 * francais affiche (name_fr) en fin de chargement, sans toucher aux sources :
 *
 * 1. L unite entre parentheses est retiree quand l unite est deja affichee a
 *    cote de la valeur : « Prises de commandes nettes (M€) » -> sans « (M€) ».
 *    Les precisions utiles (« GAAP », « fin de periode », « % du CA »...) restent.
 * 2. Les termes anglais entre parentheses qui doublent un mot francais deja
 *    present (« (bookings) », « (billings) », « (over time) »...) sont retires
 *    ou traduits.
 * 3. Un KPI de montant dont le nom peut se lire comme un nombre d objets
 *    (prises de commandes, commandes, livraisons, carnet quand une serie en
 *    nombre coexiste) recoit « Montant ... » : « Montant annuel des prises de
 *    commandes nettes ».
 *
 * Garde-fous : jamais de nom vide, jamais deux KPI de la meme fiche avec le meme
 * nom apres correction (on garde alors l etat precedent), shorts et valeurs
 * inchanges.
 */

type Kpi = Record<string, unknown>;

const DEVISE_RE = /(?:€|\$|£|¥|\b(?:eur|usd|chf|gbp|jpy|dkk|sek|nok|cad|aud)\b)/i;
const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[\s.]/g, "");

/** Composant de parenthese qui n est qu une unite deja affichee a cote de la valeur. */
function composantUnite(p: string, unit: string): boolean {
  const c = p.trim();
  if (!c || !unit.trim()) return false;
  if (norm(c) === norm(unit)) return true;
  // devise seule (« USD », « M $ », « Mds USD », « M€ ») alors que l unite affichee est une devise
  if (/^(?:en )?(?:(?:m|md|mds|k|b|bn|mm)\s?)?(?:€|\$|£|¥|usd|eur|chf|gbp|jpy|euros?|dollars?)$/i.test(c) && DEVISE_RE.test(unit) && !/%/.test(unit)) return true;
  // « $B », « $M » : devise avec echelle alors que l unite affichee est une devise
  if (/^\$[BMK]$/i.test(c) && DEVISE_RE.test(unit) && !/%/.test(unit)) return true;
  // « unités » alors que l unite affichee compte des objets (unités, logements, chambres...)
  if (/^unit[ée]s?$/i.test(c) && !DEVISE_RE.test(unit) && !/%/.test(unit)) return true;
  // « % » alors que l unite affichee est un pourcentage libelle (« % du mix wafers »)
  if (c === "%" && /^%/.test(unit.trim())) return true;
  // echelle seule (« M », « millions ») alors que l unite affichee commence par la meme echelle
  if (/^(?:m|millions?)$/i.test(c) && /^(?:m\b|millions?\b)/i.test(unit.trim())) return true;
  return false;
}

/** Termes anglais entre parentheses : "" = retire (le mot francais est deja dans le nom), sinon traduction. */
const ANGLAIS_PAREN: [RegExp, string][] = [
  [/^net bookings$/i, ""],
  [/^bookings$/i, ""],
  [/^billings$/i, ""],
  [/^net revenues$/i, ""],
  [/^purchase volume$/i, ""],
  [/^licensing billings$/i, ""],
  [/^over time$/i, ""],
  [/^point in time$/i, ""],
  [/^run rate$/i, ""],
  [/^mark-to-market$/i, ""],
  [/^cash-flow$/i, ""],
  [/^pipeline$/i, ""],
  [/^backlog$/i, ""],
  [/^hardware$/i, "matériel"],
  [/^guidance$/i, "prévision de la direction"],
  [/^guidance (T[1-4])$/i, "prévision $1"],
  [/^bookings annuels$/i, "commandes annuelles"],
  [/^incluse dans le backlog$/i, "incluse dans le carnet de commandes"],
  [/^backlog reconnu sous 12 mois$/i, "carnet de commandes reconnu sous 12 mois"],
  [/^new business$/i, "nouveaux contrats"],
  [/^term loan$/i, "prêt à terme"],
];

function nettoyerParentheses(nom: string, unit: string): string {
  let out = nom.replace(/\s*\(([^()]*)\)/g, (tout, contenu: string) => {
    const parts = contenu.split(/\s*[,;]\s*/).filter((x) => x.length > 0);
    if (parts.length === 0) return tout;
    const garde: string[] = [];
    let touche = false;
    for (const p of parts) {
      if (composantUnite(p, unit)) { touche = true; continue; }
      garde.push(p);
    }
    if (garde.length === 0) return " ";
    // terme anglais (seul) : retire ou traduit
    if (garde.length === 1) {
      for (const [re, rep] of ANGLAIS_PAREN) {
        if (re.test(garde[0])) {
          const tr = rep ? garde[0].replace(re, rep) : "";
          // la traduction est deja dans le nom : on ne la repete pas
          return !tr || nom.toLowerCase().includes(tr.toLowerCase()) ? " " : ` (${tr})`;
        }
      }
    }
    if (!touche) return tout;
    return ` (${garde.join(", ")})`;
  });
  if (out === nom) return nom;
  out = out.replace(/\s{2,}/g, " ").replace(/\s+([,;])/g, "$1").trim();
  return out;
}

/** Entete reconnue -> article et groupe nominal a reprendre apres « Montant » (selon le pluriel). */
const MONTANT_LEAD: [RegExp, (pluriel: boolean) => [string, string]][] = [
  [/^prises? de commandes?\b/i, (p) => (p ? ["des", "prises de commandes"] : ["de la", "prise de commande"])],
  [/^nouvelles? commandes?\b/i, (p) => (p ? ["des", "nouvelles commandes"] : ["de la", "nouvelle commande"])],
  [/^commandes?\b/i, (p) => (p ? ["des", "commandes"] : ["de la", "commande"])],
  [/^carnet de commandes\b/i, () => ["du", "carnet de commandes"]],
  [/^carnet\b/i, () => ["du", "carnet"]],
  [/^livraisons?\b/i, (p) => (p ? ["des", "livraisons"] : ["de la", "livraison"])],
];

const DEJA_PRECISE = /(montant|valeur|chiffre|revenus?|\bCA\b|\bRPO\b|obligations?|prévision|ratio|\bnombre\b|\bunités?\b|%)/i;
/** Unites qui comptent des objets (et non un ratio, une masse ou une puissance). */
const OBJETS_COMPTES = /(unit[ée]|appareil|avion|moteur|syst[eè]me|v[ée]hicule|machine|camion|satellite|lancement|turbine|engin|vol)/i;

function uniteMonetaire(u: string): boolean {
  return DEVISE_RE.test(u) && !/%/.test(u);
}

/** Nom en montant : « Prises de commandes nettes annuelles » -> « Montant annuel des prises de commandes nettes ». */
export function nomEnMontant(nom: string): string | null {
  for (const [re, f] of MONTANT_LEAD) {
    const m = nom.match(re);
    if (!m) continue;
    let reste = nom.slice(m[0].length);
    let freq = "";
    const mf = reste.match(/\s+(annuel(?:le)?s?|trimestriel(?:le)?s?)\s*$/i);
    if (mf) {
      reste = reste.slice(0, mf.index);
      freq = /^annu/i.test(mf[1]) ? "annuel" : "trimestriel";
    }
    const [art, gn] = f(/s$/i.test(m[0].trim()));
    const mot = /livraison/i.test(gn) ? "Valeur" : "Montant";
    return `${mot}${freq ? " " + freq : ""} ${art} ${gn}${reste}`.replace(/\s{2,}/g, " ").trim();
  }
  return null;
}

/** Libelles explicites pour une meme mesure publiee a deux frequences (ASML, 13 oct 2026). */
const FREQUENCES_EXPLICITES: Record<string, Record<string, string>> = {
  ASML: {
    CAHIER_SYSTEM_ORDERS_BACKLOG: "Montant annuel des prises de commandes nettes",
    bookings: "Prises de commandes",
  },
};

export type BilanLibelles = { unites: number; anglais: number; montant: number; frequence: number; collisions: number };

/** Applique les trois corrections aux KPI d une fiche (nom francais seulement). */
export function nettoyerLibellesKpiFiche(company: Record<string, unknown>, ticker: string): BilanLibelles {
  const bilan: BilanLibelles = { unites: 0, anglais: 0, montant: 0, frequence: 0, collisions: 0 };
  const kpis = company.kpis;
  if (!Array.isArray(kpis)) return bilan;
  const liste = (kpis as Kpi[]).filter((k) => k && typeof k === "object" && typeof k.name_fr === "string" && (k.name_fr as string).trim());
  const origine = new Map<Kpi, string>(liste.map((k) => [k, k.name_fr as string]));

  // etape 1 et 2 : parentheses
  const etape1 = new Map<Kpi, string>();
  for (const k of liste) {
    const avant = origine.get(k)!;
    const apres = nettoyerParentheses(avant, String(k.unit ?? ""));
    etape1.set(k, apres && apres.length >= 3 ? apres : avant);
  }
  // etape 3 : montant lisible comme un nombre d objets, seulement si une serie en nombre
  // d objets de meme famille (commandes, carnet, livraisons) coexiste sur la fiche
  const comptages = liste.filter((k) => {
    const u = String(k.unit ?? "");
    return u && !DEVISE_RE.test(u) && OBJETS_COMPTES.test(u) && MONTANT_LEAD.some(([re]) => re.test(String(k.name_fr ?? "")));
  });
  const etape3 = new Map<Kpi, string>();
  for (const k of liste) {
    const nom = etape1.get(k)!;
    const u = String(k.unit ?? "");
    let cible = nom;
    const explicite = FREQUENCES_EXPLICITES[ticker.toUpperCase()]?.[String(k.short)];
    if (explicite) cible = explicite;
    else if (uniteMonetaire(u) && !DEJA_PRECISE.test(nom)) {
      const lead = MONTANT_LEAD.find(([re]) => re.test(nom));
      if (lead) {
        if (comptages.some((o) => o !== k)) cible = nomEnMontant(nom) ?? nom;
      }
    }
    etape3.set(k, cible);
  }

  // garde-fou collisions : deux KPI ne doivent pas finir avec le meme nom
  const final = new Map<Kpi, string>();
  const compte = new Map<string, number>();
  for (const k of liste) compte.set(etape3.get(k)!.toLowerCase(), (compte.get(etape3.get(k)!.toLowerCase()) ?? 0) + 1);
  // noms deja identiques a l origine : pas une collision introduite par nous
  const compteOrigine = new Map<string, number>();
  for (const k of liste) compteOrigine.set(origine.get(k)!.toLowerCase(), (compteOrigine.get(origine.get(k)!.toLowerCase()) ?? 0) + 1);
  for (const k of liste) {
    let nom = etape3.get(k)!;
    const o = origine.get(k)!;
    if (nom !== o && (compte.get(nom.toLowerCase()) ?? 0) > Math.max(1, compteOrigine.get(nom.toLowerCase()) ?? 0)) {
      // collision creee : on retombe sur l etape 3 sans montant, puis sur l origine
      const e1 = etape1.get(k)!;
      nom = (compte.get(e1.toLowerCase()) ?? 0) > 1 ? o : e1;
      bilan.collisions++;
    }
    final.set(k, nom);
  }
  for (const k of liste) {
    const o = origine.get(k)!;
    const n = final.get(k)!;
    if (n === o) continue;
    k.name_fr = n;
    const e1 = etape1.get(k)!;
    if (e1 !== o && n === e1) {
      // distingue unite / anglais pour le bilan
      if (/\((?:[^()]*(?:bookings|billings|backlog|over time|point in time|run rate|hardware|guidance|mark-to-market|pipeline|cash-flow|purchase volume|net revenues|new business|term loan))[^()]*\)/i.test(o)) bilan.anglais++;
      else bilan.unites++;
    } else if (FREQUENCES_EXPLICITES[ticker.toUpperCase()]?.[String(k.short)]) bilan.frequence++;
    else if (/^Montant/.test(n)) bilan.montant++;
    else bilan.unites++;
  }
  return bilan;
}
