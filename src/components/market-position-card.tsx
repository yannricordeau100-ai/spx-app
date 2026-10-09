"use client";

import { Target, TrendingDown, TrendingUp } from "lucide-react";
import { formatUnit, isOfficialSource, type Company, type MarketPosition } from "@/lib/data";
import { InfoTooltip } from "@/components/info-tooltip";
import { brand } from "@/lib/brand";
import { normalizeNarrative } from "@/lib/ui-fix-templates";
import { enMilliards, trierPositions } from "@/lib/desk/tam-apercu";

/** Valeur de marché, format français, sans perte d'ordre de grandeur :
 *  2 décimales sous 10, 1 décimale sous 1 000, entier au-delà
 *  (294,691 Mds -> « 294,7 Mds », 4 000 -> « 4 000 »). */
function fmtMontant(n: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n);
  if (Number.isInteger(v)) return fmt(v, 0);
  const a = Math.abs(v);
  return fmt(v, a < 10 ? 2 : a < 1000 ? 1 : 0);
}

function fmt(n: number, decimals = 0) {
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
/**
 * Format l'unité pour affichage compact "Md $" (au lieu de "Mds $" long).
 * Yann 17 mai 2026 : avant, conditionnelle stricte `$B → "Md $"` ratait
 * "Mds $" (2173 sociétés), "B $" mixte (270 sociétés), "Mds €" (1604 sociétés).
 * Fix : passer par formatUnit puis raccourcir "Mds X" → "Md X".
 */
function unitLabel(unit: string) {
  const normalized = formatUnit(unit);
  // Raccourcir "Mds $" → "Md $", "Mds €" → "Md €", etc, pour cohérence
  // avec l'ancien label court de la card market-position.
  // 27 sept 2026 (Yann, doute n°17) : « Mds $ » comme partout ailleurs.
  return normalized;
}

/**
 * Yann 21 sept 2026 : aucune source ne doit apparaitre dans un bloc de fiche.
 * Les notes de methode se terminent presque toujours par « Source : <lien> » ;
 * on retire ce fragment a l affichage, la donnee reste intacte dans le fichier.
 */
export function sansMentionSource(texte: string): string {
  // 10 oct 2026 (Yann) : jamais de lien ni d adresse dans le « i ». On retire le fragment
  // « Source : ... », puis toute phrase qui contient encore une adresse web, et la note se
  // termine toujours par une ponctuation finale.
  const sansFragment = texte.replace(/\s*Sources?\s*:\s*\S*.*$/i, "").replace(/\s{2,}/g, " ").trim();
  const lien = /(https?:\/\/|www\.|\b[\w-]+\.(?:com|org|net|fr|de|gov|eu|io|ch|uk)\/\S*)/i;
  const propre = sansFragment
    .split(/(?<=[.!?])\s+/)
    .filter((phrase) => !lien.test(phrase))
    .join(" ")
    .replace(/[\s,;:(–-]+$/u, "")
    .trim();
  return propre && !/[.!?»)]$/.test(propre) ? `${propre}.` : propre;
}

/**
 * 7 oct 2026 (Yann) : plus aucune source dans le « i » de la position marché.
 * Retire le fragment « Source : ... », puis les phrases de la note qui nomment
 * un éditeur d'études ou un organisme (liste ci-dessous, plus l'éditeur de la
 * source du segment quand elle n'est pas un document de la société). La
 * source reste dans le mini bloc de sources du bas.
 */
const EDITEURS_TIERS = [
  "IBISWorld", "Fortune Business Insights", "Mordor Intelligence", "MarketsandMarkets",
  "Global Market Insights", "Precedence Research", "IMARC", "Statista", "Grand View Research",
  "Gartner", "Boston Consulting Group", "BCG", "Federal Deposit Insurance", "FDIC",
  "Coalition Greenwich", "Business Research Company", "Business Research Insights",
  "Burton-Taylor", "Census Bureau", "Bureau du recensement", "IDC", "SEMI", "S&P Global Market Intelligence",
  "Synergy Research", "Département de la Défense", "Atlas Magazine", "eMarketer", "TrendForce",
  "Transport Intelligence", "Agence internationale de l", "World Semiconductor Trade Statistics",
  "Market Research Future", "PwC", "Structure Research", "Future Market Insights", "Swiss Re",
  "National Association of Insurance Commissioners", "Agence européenne de défense", "FIEC",
  "IQVIA", "Bain", "Phocuswright", "Cruise Market Watch", "Yole", "Oliver Wyman", "IATA",
  "Eurostat", "Omdia", "USGS", "Market Data Forecast", "Euromonitor", "GlobalData", "Newzoo",
  "ResearchAndMarkets", "Research and Markets", "Expert Market Research", "LightCounting",
  "Counterpoint", "Sensor Tower", "Dell'Oro", "Dell Oro", "Novaspace", "Evaluate", "Allianz",
  "Armstrong et Associates", "Congressional Research Service", "Centers for Medicare",
];
const SOURCE_DE_LA_SOCIETE = /pr[ée]sentation|journ[ée]e investisseurs|communiqu[ée]|prospectus|rapport annuel|investor|formulaire|document d['’ ]enregistrement/i;

function echapper(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function noteMethodologie(note: string, source?: string | null): string {
  const base = sansMentionSource(note);
  const noms = [...EDITEURS_TIERS];
  if (source && !SOURCE_DE_LA_SOCIETE.test(source)) {
    const editeur = source.split(/\s*[,:(]\s*/)[0].trim();
    if (editeur.length > 3) noms.push(editeur);
  }
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${noms.map(echapper).join("|")})(?![\\p{L}\\p{N}])`, "u");
  return base
    .split(/(?<=[.!?])\s+/)
    .filter((phrase) => !re.test(phrase))
    .join(" ")
    .trim();
}

/**
 * 7 oct 2026 : « Estimation indicative » seulement pour une valeur dont la
 * source n'est ni un document officiel de la societe ni un lien verifiable
 * (lien dans la note ou dans source_url). Une valeur sourcee n'a plus de
 * mention ; une valeur sans lien la garde en attendant la decision de Yann.
 */
export function estimationIndicative(position: MarketPosition): boolean {
  if (!position.source || isOfficialSource(position.source)) return false;
  const lien = /https?:\/\//i;
  const p = position as MarketPosition & { source_url?: string };
  return !(lien.test(p.source_note ?? "") || lien.test(position.source) || lien.test(p.source_url ?? ""));
}

/** 9 oct 2026 : part captee, unites ramenees a la meme echelle (M ou Mds). */
function partCaptee(p: MarketPosition): number {
  const tam = enMilliards({ segment_revenue: p.tam, segment_unit: p.tam_unit });
  return tam > 0 ? (enMilliards(p) / tam) * 100 : 0;
}

function fmtPart(share: number): string {
  if (share > 0 && share < 0.1) return "< 0,1";
  return fmt(share, 1);
}

/** « Publicité Google (Recherche, YouTube) » -> ["Publicité Google", "Recherche, YouTube"]. */
function decoupeSegment(nom: string): [string, string] {
  const m = nom.match(/^([^(]+?)\s*\((.+)\)\s*$/);
  if (!m) return [nom, ""];
  const detail = m[2].trim();
  return [m[1].trim(), detail.charAt(0).toUpperCase() + detail.slice(1)];
}

function Montant({ valeur, unite }: { valeur: number; unite: string }) {
  return (
    <span className="flex flex-col font-mono tabular-nums @3xl:block @3xl:whitespace-nowrap">
      <span className="whitespace-nowrap text-[15px] font-bold text-zinc-50">{fmtMontant(valeur)}</span>
      <span className="whitespace-nowrap text-[11px] font-medium text-zinc-400 @3xl:ml-1 @3xl:text-[11.5px]">{unitLabel(unite)}</span>
    </span>
  );
}

function Croissance({ cagr, c }: { cagr: number | undefined; c: string }) {
  if (cagr === undefined || cagr === null || !Number.isFinite(Number(cagr))) {
    return (
      <span className="flex flex-col font-mono @3xl:block">
        <span className="text-[13px] leading-[22px] text-zinc-600 @3xl:leading-normal">n.d.</span>
        <span className="text-[11px] text-transparent @3xl:hidden" aria-hidden>.</span>
      </span>
    );
  }
  const v = Number(cagr);
  const Icone = v < 0 ? TrendingDown : TrendingUp;
  return (
    <span className="flex flex-col whitespace-nowrap font-mono tabular-nums @3xl:inline-flex @3xl:flex-row @3xl:items-center @3xl:gap-1">
      <span className="inline-flex items-center gap-1 text-[15px] font-bold @3xl:text-[14px]" style={{ color: c }}>
        <Icone className="hidden size-3.5 shrink-0 @3xl:inline" />
        {v > 0 ? "+" : v < 0 ? "−" : ""}{fmt(Math.abs(v), Number.isInteger(v) ? 0 : 1)} %
      </span>
      <span className="text-[11px] font-medium text-zinc-400"><span className="@3xl:hidden">par an</span><span className="hidden @3xl:inline">/an</span></span>
    </span>
  );
}

const ETIQUETTE = "font-mono text-[10px] uppercase tracking-wider text-zinc-400";

/**
 * 9 oct 2026 (Yann) : la grille de cartes TAM cote a cote etait inesthetique
 * (hauteurs, tailles de chiffre et barres differentes, derniere carte en
 * pleine largeur). Une seule carte « Position marché » ; une ligne de hauteur
 * et de typographie constantes par segment, triee par revenu decroissant.
 * Large (conteneur >= 48rem) : tableau a 5 colonnes alignees. Etroit : chaque
 * ligne s'empile (nom, part + barre, trois chiffres) avec la meme structure.
 * Le detail du segment, la methode et la fourchette sont dans le « i ».
 */
export function MarketPositionList({
  company,
  positions,
  className = "",
}: {
  company: Company;
  positions: MarketPosition[];
  className?: string;
}) {
  const c = brand(company.ticker).primary;
  const lignes = trierPositions(positions);
  // Barres : largeur finale des le rendu serveur ; la croissance a l affichage
  // est en CSS pur (@starting-style), sans dependre de l hydratation.
  const colonnes = "@3xl:grid-cols-[minmax(0,1.15fr)_minmax(9rem,1fr)_7rem_7rem_5.75rem] @3xl:gap-x-5 @5xl:grid-cols-[minmax(0,1.15fr)_minmax(11rem,1fr)_7.5rem_7.5rem_6.5rem] @5xl:gap-x-6";

  return (
    <div className={`@container overflow-hidden rounded-2xl border border-[#1a1a1a] bg-gradient-to-b from-[#0a0a0a] to-[#070707] ${className}`}>
      <div className="flex items-center gap-2 border-b border-[#161616] px-5 py-3.5 @3xl:px-6">
        <Target className="size-4 shrink-0" style={{ color: c }} />
        <span className="whitespace-nowrap font-sans text-[12.5px] font-semibold uppercase tracking-[0.12em] text-zinc-100">Position marché</span>
        <span className="ml-auto hidden truncate font-mono text-[11px] text-zinc-400 @md:inline">
          Part captée par <span className="text-zinc-200">{company.name}</span>
        </span>
      </div>

      <div className={`hidden px-6 pb-1 pt-3 @3xl:grid ${colonnes}`} aria-hidden>
        <span className={ETIQUETTE}>Segment</span>
        <span className={ETIQUETTE}>Part captée</span>
        <span className={`${ETIQUETTE} text-right`}>Revenu du segment</span>
        <span className={`${ETIQUETTE} text-right`}>Taille du marché</span>
        <span className={`${ETIQUETTE} text-right`}>Croissance</span>
      </div>

      <ul className="divide-y divide-[#151515]">
        {lignes.map((p) => {
          const share = partCaptee(p);
          const nom = normalizeNarrative(p.segment_name);
          const [principal, detail] = decoupeSegment(nom);
          const estimation = estimationIndicative(p);
          const note = p.source_note ? noteMethodologie(normalizeNarrative(p.source_note), p.source) : "";
          return (
            <li key={p.segment_name} className={`grid grid-cols-1 gap-y-3 px-5 py-4 @3xl:items-center @3xl:px-6 ${colonnes}`}>
              <div data-blur-part="titre" className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[14.5px] font-semibold text-zinc-50" title={nom}>{principal}</span>
                  <span className="shrink-0">
                    <InfoTooltip color={c}>
                      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider" style={{ color: c }}>
                        Segment
                      </div>
                      <p className="text-[12.5px] font-medium leading-snug text-zinc-100">{nom}</p>
                      {note && (
                        <>
                          <div className="mb-1 mt-3 font-mono text-[10px] uppercase tracking-wider" style={{ color: c }}>
                            Méthodologie
                          </div>
                          <p className="text-[12px] leading-relaxed text-zinc-300">{note}</p>
                        </>
                      )}
                      {p.tam_range && (
                        <p className="mt-2 text-[11.5px] italic text-zinc-400">
                          Fourchette du marché total : {fmt(p.tam_range[0])} à {fmt(p.tam_range[1])} {unitLabel(p.tam_unit)}.
                        </p>
                      )}
                      {estimation && <p className="mt-2 text-[11.5px] italic text-zinc-400">Estimation indicative.</p>}
                    </InfoTooltip>
                  </span>
                </div>
                <div className="mt-0.5 h-[17px] truncate text-[12px] text-zinc-400" title={detail || undefined}>
                  {estimation && <span className="italic text-zinc-500">Estimation indicative{detail ? " · " : ""}</span>}
                  {detail}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  data-blur-part="valeur"
                  className="w-[4.75rem] shrink-0 whitespace-nowrap font-display text-[22px] font-bold leading-none tabular-nums"
                  style={{ color: c }}
                >
                  {fmtPart(share)}
                  <span className="ml-0.5 font-sans text-[13px] font-semibold">%</span>
                </span>
                <div data-blur-part="graphique" className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#16161b]">
                  <div
                    className="absolute inset-y-0 left-0 w-[var(--part)] rounded-full transition-[width] duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] starting:w-0"
                    style={{ "--part": `${Math.max(0.8, Math.min(100, share))}%`, background: `linear-gradient(90deg, ${c}, ${c}cc)`, boxShadow: `0 0 10px ${c}66` } as React.CSSProperties}
                  />
                </div>
              </div>

              <div data-blur-part="valeur" className="grid grid-cols-3 gap-x-3 @3xl:contents">
                <div className="min-w-0 @3xl:text-right">
                  <div className={`${ETIQUETTE} mb-1 @3xl:hidden`}>Revenu</div>
                  <Montant valeur={p.segment_revenue} unite={p.segment_unit} />
                </div>
                <div className="min-w-0 @3xl:text-right">
                  <div className={`${ETIQUETTE} mb-1 @3xl:hidden`}>Marché</div>
                  <Montant valeur={p.tam} unite={p.tam_unit} />
                </div>
                <div data-blur-part="texte" className="min-w-0 @3xl:text-right">
                  <div className={`${ETIQUETTE} mb-1 @3xl:hidden`}>Croissance</div>
                  <Croissance cagr={p.market_cagr} c={c} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
