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
  const lien = /(https?:\/\/|www\.|[\p{L}\p{N}_-]+\.(?:com|org|net|fr|de|gov|eu|io|ch|uk|co|info)(?:\/\S*|\b))/iu;
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

/** 13 oct 2026 : la note du « i » ne repete pas le nom du marche deja en titre. */
function noteSansMarche(note: string, marche: string): string {
  if (!marche) return note;
  const m = marche.replace(/[.\s]+$/, "");
  return note.startsWith(m) ? note.slice(m.length).replace(/^[.\s]+/, "").trim() : note;
}

/**
 * 13 oct 2026 (Yann) : retour a l ancien style, present depuis la V1 jusqu au
 * 9 oct 2026 (commit 46e947f226 l avait remplace par un tableau) : une carte
 * par TAM, un demi ecran chacune (2 par ligne sur ordinateur, 1 sur mobile).
 * Titre de la carte = nom du MARCHE (champ « marche », a defaut intitule du
 * Cahier) ; le segment de la societe en sous-titre. Sans nom de marche, le
 * segment seul, en sous-titre. Ajouts recents conserves : « i » (segment,
 * methode avec note de conversion de devise, fourchette, estimation), part
 * calculee a la meme echelle d unites, marqueurs de flou poses sur des
 * elements qui ont une boite (valeurs factices floutees au palier gratuit).
 * Les cartes d une meme ligne partagent leurs rangees (sous-grille) : titre,
 * part, barre, chiffres, croissance et mention restent alignes.
 */
export function MarketPositionCard({
  company,
  position,
  className = "",
}: {
  company: Company;
  position: MarketPosition;
  className?: string;
}) {
  const c = brand(company.ticker).primary;
  const share = partCaptee(position);
  const marche = position.marche ? normalizeNarrative(position.marche).trim() : "";
  const segment = normalizeNarrative(position.segment_name);
  const estimation = estimationIndicative(position);
  const note = position.source_note ? noteSansMarche(noteMethodologie(normalizeNarrative(position.source_note), position.source), marche) : "";
  const cagr = position.market_cagr;
  const aCroissance = cagr !== undefined && cagr !== null && Number.isFinite(Number(cagr));

  return (
    <div
      data-tam-carte
      className={`row-span-6 grid grid-rows-subgrid gap-y-0 overflow-hidden rounded-2xl border border-[#1a1a1a] bg-gradient-to-b from-[#0a0a0a] to-[#070707] p-5 lg:p-6 ${className}`}
    >
      <div data-blur-part="titre" className="min-w-0">
        <div className="flex items-center gap-2">
          <Target className="size-4 shrink-0" style={{ color: c }} />
          <span className="font-sans text-[11.5px] font-semibold uppercase tracking-[0.12em] text-zinc-300">
            Position marché
          </span>
          <InfoTooltip color={c}>
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider" style={{ color: c }}>
              Segment
            </div>
            <p className="text-[12.5px] font-medium leading-snug text-zinc-100">{segment}</p>
            {note && (
              <>
                <div className="mb-1 mt-3 font-mono text-[10px] uppercase tracking-wider" style={{ color: c }}>
                  Méthodologie
                </div>
                <p className="text-[12px] leading-relaxed text-zinc-300">{note}</p>
              </>
            )}
            {position.tam_range && (
              <p className="mt-2 text-[11.5px] italic text-zinc-400">
                Fourchette du marché total : {fmt(position.tam_range[0])} à {fmt(position.tam_range[1])} {unitLabel(position.tam_unit)}.
              </p>
            )}
            {estimation && <p className="mt-2 text-[11.5px] italic text-zinc-400">Estimation indicative.</p>}
          </InfoTooltip>
        </div>
        {marche && (
          <div data-tam-titre className="mt-2 text-[16px] font-semibold leading-snug text-zinc-50">
            {marche}
          </div>
        )}
        <div className={`${marche ? "mt-1" : "mt-2"} text-[13px] leading-snug text-zinc-400`}>
          {marche ? <span className="text-zinc-500">Segment : </span> : null}
          {segment}
        </div>
      </div>

      {/* Part captee : le chiffre le plus important, en grand. */}
      <div className="mt-5 flex items-end gap-3">
        <div
          data-blur-part="valeur"
          className="font-display font-bold leading-none tabular-nums"
          style={{ color: c, fontSize: "4rem", textShadow: `0 0 40px ${c}55` }}
        >
          {fmtPart(share)}
          <span className="ml-1 font-sans font-semibold" style={{ fontSize: "1.5rem", color: c }}>
            %
          </span>
        </div>
        <div className="mb-2 text-[14px] leading-tight text-zinc-200">
          captés par<br />
          <span className="font-semibold text-zinc-50">{company.name}</span>
        </div>
      </div>

      {/* Barre de part de marche : largeur finale des le rendu serveur,
          animation en CSS pur (@starting-style), sans dependre de l hydratation. */}
      <div className="mt-5">
        <div data-blur-part="graphique" className="relative h-3 w-full overflow-hidden rounded-full bg-[#0e0e12]">
          <div
            className="absolute inset-y-0 left-0 w-[var(--part)] rounded-full transition-[width] duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] starting:w-0"
            style={{
              "--part": `${Math.max(0.5, Math.min(100, share))}%`,
              background: `linear-gradient(90deg, ${c}, ${c}dd 60%, ${c}88)`,
              boxShadow: `0 0 18px ${c}77`,
            } as React.CSSProperties}
          />
          {[25, 50, 75].map((t) => (
            <span key={t} className="absolute inset-y-0 w-px bg-[#222]" style={{ left: `${t}%` }} />
          ))}
        </div>
        <div className="mt-1.5 flex items-center justify-between font-mono text-[10.5px] tabular-nums text-zinc-400">
          <span>0 %</span>
          <span>50 %</span>
          <span>100 %</span>
        </div>
      </div>

      {/* Revenu du segment et taille du marche, cote a cote. */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="min-w-0 rounded-lg border border-[#1f1f1f] bg-[#0c0c0c] p-3">
          <div className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-300">
            Revenu du segment
          </div>
          <div data-blur-part="valeur" className="mt-1 whitespace-nowrap font-mono text-xl font-bold tabular-nums text-zinc-50 sm:text-2xl">
            {fmtMontant(position.segment_revenue)}
            <span className="ml-1 text-sm font-medium text-zinc-300">{unitLabel(position.segment_unit)}</span>
          </div>
        </div>
        <div className="min-w-0 rounded-lg border border-[#1f1f1f] bg-[#0c0c0c] p-3">
          <div className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-300">
            Taille totale du marché
          </div>
          <div data-blur-part="valeur" className="mt-1 whitespace-nowrap font-mono text-xl font-bold tabular-nums text-zinc-50 sm:text-2xl">
            {fmtMontant(position.tam)}
            <span className="ml-1 text-sm font-medium text-zinc-300">{unitLabel(position.tam_unit)}</span>
          </div>
        </div>
      </div>

      {/* Ligne absente : place vide gardee pour l alignement des deux cartes. */}
      {aCroissance ? (
        <div
          data-blur-part="texte"
          className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border px-3 py-2"
          style={{ borderColor: `${c}33`, background: `${c}10` }}
        >
          {Number(cagr) < 0 ? <TrendingDown className="size-4 shrink-0" style={{ color: c }} /> : <TrendingUp className="size-4 shrink-0" style={{ color: c }} />}
          <span className="text-[12.5px] text-zinc-200">
            {Number(cagr) < 0 ? "Le marché recule d'environ" : "Le marché grandit d'environ"}
          </span>
          <span data-blur-part="valeur" className="font-mono text-[14px] font-bold tabular-nums" style={{ color: c }}>
            {Number(cagr) > 0 ? "+" : Number(cagr) < 0 ? "−" : ""}{fmt(Math.abs(Number(cagr)), Number.isInteger(Number(cagr)) ? 0 : 1)} %
          </span>
          <span className="text-[12.5px] text-zinc-300">par an.</span>
        </div>
      ) : (
        <div aria-hidden />
      )}

      {estimation ? (
        <div data-blur-part="source" className="mt-3 text-[11px] italic text-zinc-400">
          Estimation indicative.
        </div>
      ) : (
        <div aria-hidden />
      )}
    </div>
  );
}

/**
 * Bloc complet : toutes les cartes TAM, triees par revenu decroissant,
 * 1 colonne sur mobile, 2 colonnes des 1024 px. Chaque carte occupe un demi
 * ecran, y compris une carte seule ou la derniere d une serie impaire.
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
  return (
    <div className={`grid gap-4 lg:grid-cols-2 ${className}`}>
      {trierPositions(positions).map((p) => (
        <MarketPositionCard key={p.segment_name} company={company} position={p} />
      ))}
    </div>
  );
}
