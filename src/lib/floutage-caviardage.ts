/**
 * Caviardage côté SERVEUR des textes du palier gratuit (Yann 30 août 2026).
 *
 * Le flou CSS ne protège rien : le vrai texte reste dans la page et se
 * récupère par copier-coller, impression PDF, mode lecture ou code source.
 * Ici, quand une fiche est servie à un compte gratuit ou anonyme, les champs
 * couverts par les zones floutées sont REMPLACÉS avant le rendu par un texte
 * factice de même forme (mêmes longueurs de mots, même ponctuation). Le vrai
 * texte ne quitte donc jamais le serveur ; seule une offre payante le reçoit.
 *
 * Le remplacement est DÉTERMINISTE (pas d'aléa) : le rendu serveur et
 * l'hydratation client produisent le même charabia, aucun avertissement React.
 *
 * Les identifiants techniques (short, clés, unités, valeurs chiffrées) ne
 * sont pas touchés : la spec du 29 août garde valeurs/variations/tendances
 * visibles, et `short` sert de clé logique partout.
 */

import type { Company, MarketPosition } from "@/lib/data";
import type { Zone } from "@/lib/floutage";
import type { TranscriptBulletsSummary } from "@/components/transcript-bullets-block";
import { estKpiStandard } from "@/lib/kpi-standard";

const CONSONNES = "bcdfghjklmnpqrstvwz";
const VOYELLES = "aeiou";

/** Pseudo-mot prononçable de longueur donnée, déterministe selon la graine. */
function motFactice(longueur: number, graine: number): string {
  let out = "";
  for (let i = 0; i < longueur; i++) {
    const alphabet = i % 2 === 0 ? CONSONNES : VOYELLES;
    out += alphabet[(graine + i * 7 + longueur * 3) % alphabet.length];
  }
  return out;
}

/** Remplace chaque mot par un pseudo-mot de même longueur, casse comprise. */
export function caviarde(texte: string): string {
  let graine = 0;
  for (let i = 0; i < texte.length; i++) graine = (graine * 31 + texte.charCodeAt(i)) % 9973;
  let compteur = 0;
  return texte.replace(/[A-Za-zÀ-ÖØ-öø-ÿ0-9]+/g, (mot) => {
    compteur += 1;
    const faux = motFactice(mot.length, graine + compteur * 13);
    if (mot === mot.toUpperCase() && mot.length > 1) return faux.toUpperCase();
    if (mot[0] === mot[0].toUpperCase()) return faux[0].toUpperCase() + faux.slice(1);
    return faux;
  });
}

const estActive = (zones: Zone[], bloc: string, partie?: string) =>
  zones.some((z) => z.bloc === bloc && (partie ? z.partie === partie || z.partie === "tout" : true));

/** Nombre factice de même magnitude et même signe, déterministe. */
export function caviardeNombre(n: number): number {
  if (!Number.isFinite(n) || n === 0) return n;
  const signe = n < 0 ? -1 : 1;
  const abs = Math.abs(n);
  const magnitude = Math.pow(10, Math.floor(Math.log10(abs)));
  const graine = Math.floor(abs * 100) % 79;
  const facteur = 1.1 + (graine % 80) / 100; // 1,10 à 1,89
  const faux = magnitude * facteur;
  const decimales = abs < 10 ? 1 : 0;
  return signe * Number(faux.toFixed(decimales));
}

/** Graine deterministe tiree d une chaine (meme rendu serveur et client). */
function graineDe(t: string): number {
  let g = 7;
  for (let i = 0; i < t.length; i++) g = (g * 31 + t.charCodeAt(i)) % 100003;
  return g;
}

/** Arrondi d affichage d un montant factice (entier au-dela de 10). */
function arrondiMontant(v: number): number {
  const a = Math.abs(v);
  return Number(v.toFixed(a < 1 ? 3 : a < 10 ? 1 : 0));
}

/** Facteur d unite vers le milliard (M = 1e-3), meme regle que enMilliards. */
function versMilliards(unite: string | null | undefined): number {
  const u = (unite ?? "").replace(/[\s$€£]/g, "");
  return /^(M|m|Mn|Mio)$/.test(u) ? 1e-3 : /^(K|k)$/.test(u) ? 1e-6 : 1;
}

/**
 * Yann 13 oct 2026 : positions de marche factices COHERENTES. Avant, revenu du
 * segment et taille du marche etaient brouilles separement : une capture du
 * palier gratuit pouvait montrer 143 Mds $ de revenu pour un marche de
 * 140 Mds $. Desormais la taille du marche est brouillee (meme ordre de
 * grandeur), puis le revenu en est deduit par une part factice de 4 a 38 %,
 * unites converties ; la fourchette encadre le marche factice et la
 * croissance reste entre -15 et +40 % par an.
 */
export function caviardePositionMarche(p: MarketPosition): MarketPosition {
  const g = graineDe(`${p.segment_name}|${p.tam}|${p.segment_revenue}`);
  const tam = Number.isFinite(p.tam) && p.tam > 0 ? Math.abs(caviardeNombre(p.tam)) : 100;
  const part = 0.04 + (g % 35) / 100; // 4 a 38 %
  const fTam = versMilliards(p.tam_unit);
  const fSeg = versMilliards(p.segment_unit);
  const revenu = arrondiMontant((tam * fTam * part) / fSeg);
  const out: MarketPosition = { ...p, tam, segment_revenue: revenu > 0 ? revenu : arrondiMontant((tam * fTam * 0.05) / fSeg) };
  if (p.tam_range) out.tam_range = [arrondiMontant(tam * 0.8), arrondiMontant(tam * 1.25)];
  if (typeof p.market_cagr === "number" && Number.isFinite(p.market_cagr)) {
    out.market_cagr = Math.max(-15, Math.min(40, caviardeNombre(p.market_cagr)));
  }
  return out;
}

/** Parts d actionnaires factices : decroissantes, total au plus 100 %. */
function remetEnOrdreParts<T extends { stake_pct?: number }>(liste: T[] | undefined): T[] | undefined {
  if (!Array.isArray(liste)) return liste;
  const parts = liste.map((x) => (typeof x.stake_pct === "number" && Number.isFinite(x.stake_pct) ? Math.min(100, Math.abs(x.stake_pct)) : null));
  const somme = parts.reduce<number>((a, b) => a + (b ?? 0), 0);
  const echelle = somme > 95 ? 95 / somme : 1;
  const triees = parts.filter((x): x is number => x !== null).map((x) => Number((x * echelle).toFixed(1))).sort((a, b) => b - a);
  let i = 0;
  return liste.map((x, k) => (parts[k] === null ? x : { ...x, stake_pct: triees[i++] }));
}

/**
 * Gouvernance factice coherente : pourcentages entre 0 et 100, top 3 dans
 * l ordre et sommant a 100 % au plus, remuneration totale = somme des parts.
 */
function remetEnCoherenceGouvernance<G>(g: G): G {
  const o = g as Record<string, unknown>;
  for (const [k, v] of Object.entries(o)) {
    if (k.endsWith("_pct") && typeof v === "number") o[k] = Math.max(0, Math.min(100, v));
  }
  o.top_voting = remetEnOrdreParts(o.top_voting as { stake_pct?: number }[] | undefined);
  o.top_capital = remetEnOrdreParts(o.top_capital as { stake_pct?: number }[] | undefined);
  const cd = o.comp_detail as Record<string, unknown> | undefined;
  if (cd) {
    const cles = ["ceo_salary_m", "ceo_bonus_m", "ceo_stock_awards_m", "ceo_option_awards_m", "ceo_non_equity_incentive_m", "ceo_other_m"];
    const comps = cles.map((k) => cd[k]).filter((x): x is number => typeof x === "number" && Number.isFinite(x));
    if (comps.length > 0) {
      const total = Number(comps.reduce((a, b) => a + Math.abs(b), 0).toFixed(1));
      cd.ceo_total_comp_m = total;
      if (typeof o.ceo_total_comp_m === "number") o.ceo_total_comp_m = total;
    }
  }
  return g;
}

// Clés STRUCTURELLES jamais caviardées : ce sont des repères de lecture ou des
// enums techniques, pas la donnée premium. Les caviarder produisait du non-sens
// visible au palier gratuit ("exercice 1330") ou du FAUX affiché en clair
// (stance "leader" détruite -> badge retombant sur "Aucun positionnement",
// cas AAPL 30 août 2026).
const CLES_PRESERVEES = new Set([
  "fiscal_year",
  "source_fiscal_year",
  "proxy_year",
  "agm_date",
  "stance",
]);

function caviardeProfond<T>(valeur: T, nombresAussi = false): T {
  if (typeof valeur === "string") return caviarde(valeur) as unknown as T;
  if (typeof valeur === "number" && nombresAussi) return caviardeNombre(valeur) as unknown as T;
  if (Array.isArray(valeur)) return valeur.map((v) => caviardeProfond(v, nombresAussi)) as unknown as T;
  if (valeur && typeof valeur === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valeur as Record<string, unknown>)) {
      if (CLES_PRESERVEES.has(k)) {
        out[k] = v;
        continue;
      }
      out[k] =
        typeof v === "string" || Array.isArray(v) || (v && typeof v === "object") ||
        (typeof v === "number" && nombresAussi)
          ? caviardeProfond(v, nombresAussi)
          : v;
    }
    return out as unknown as T;
  }
  return valeur;
}

/**
 * Clone caviardé d'une fiche pour le palier gratuit, selon les zones actives.
 * `zones` = zones effectives de la société (override compris) : une liste
 * vide (exemption GOOGL/META) ne caviarde rien.
 */
export function caviardeCompanyPourGratuit(company: Company, zones: Zone[]): Company {
  if (zones.length === 0) return company;
  const c: Company = JSON.parse(JSON.stringify(company));

  const nomsKpi = estActive(zones, "kpis", "indicateur") || estActive(zones, "hero", "tout");
  const signaux = estActive(zones, "kpis", "qualite") || estActive(zones, "stories", "texte");
  // 9 sept 2026 : le groupe « KPI standard » a ses propres zones (kpis_standard).
  const nomsStd = estActive(zones, "kpis_standard", "indicateur") || estActive(zones, "hero", "tout");
  const signauxStd = estActive(zones, "kpis_standard", "qualite") || estActive(zones, "stories", "texte");
  const textesStories = estActive(zones, "stories", "texte");

  for (const k of c.kpis ?? []) {
    const estStory = !!k.is_short_history;
    const standard = !estStory && k.short !== c.hero_kpi && estKpiStandard(k);
    if (standard ? nomsStd : nomsKpi) {
      if (k.name_fr) k.name_fr = caviarde(k.name_fr);
      if (k.name_en) k.name_en = caviarde(k.name_en);
    }
    if ((standard ? signauxStd : signaux) && k.signal) k.signal = caviarde(k.signal);
    if (textesStories) {
      const kk = k as { description?: string; explanation?: string };
      if (kk.description) kk.description = caviarde(kk.description);
      if (kk.explanation) kk.explanation = caviarde(kk.explanation);
    }
  }

  if (estActive(zones, "risks", "titre")) {
    for (const r of c.risks ?? []) {
      const rr = r as { title?: string; title_en?: string; score_rationale?: string };
      if (rr.title) rr.title = caviarde(rr.title);
      if (rr.title_en) rr.title_en = caviarde(rr.title_en);
      if (rr.score_rationale) rr.score_rationale = caviarde(rr.score_rationale);
    }
  }

  if (estActive(zones, "governance", "texte") && c.governance) {
    // Gouvernance : les montants (rémunérations, ratios) sont la donnée
    // elle-même — nombres remplacés par des factices de même magnitude.
    c.governance = remetEnCoherenceGouvernance(caviardeProfond(c.governance, true));
  }

  if (estActive(zones, "ai_positioning", "texte") && c.ai_positioning) {
    c.ai_positioning = caviardeProfond(c.ai_positioning);
  }

  // 9 sept 2026 : Moat (texte de l avantage, justification de la tendance).
  if (c.moat) {
    if (estActive(zones, "moat", "texte") && c.moat.texte) c.moat.texte = caviarde(c.moat.texte);
    if (estActive(zones, "moat", "tendance") && c.moat.justification_mettrik) {
      c.moat.justification_mettrik = caviarde(c.moat.justification_mettrik);
    }
    // 25 sept 2026 (audit du flou) : la note « Important / Moyen / Aucun »
    // partait en clair sous le flou, et sa couleur la trahissait aussi. Elle
    // est remplacee par un faux libelle (pastille grise neutre).
    if (estActive(zones, "moat", "niveau") && c.moat.niveau) c.moat.niveau = caviarde(c.moat.niveau);
  }

  // 9 sept 2026 : concentration clients (commentaires, noms, pourcentages).
  if (c.clients_concentration) {
    const cc = c.clients_concentration;
    // 14 sept 2026 : une clientele « diffuse » n a pas de premier client
    // (top = null, cas Reddit). L acces direct a cc.top faisait planter la fiche.
    if (estActive(zones, "clients", "texte")) {
      if (cc.top?.commentaire) cc.top.commentaire = caviarde(cc.top.commentaire);
      if (cc.top10?.commentaire) cc.top10.commentaire = caviarde(cc.top10.commentaire);
    }
    if (estActive(zones, "clients", "noms") && cc.top && Array.isArray(cc.top.clients)) cc.top.clients = cc.top.clients.map((n) => caviarde(n));
    if (estActive(zones, "clients", "valeur") || estActive(zones, "clients", "graphique")) {
      // 25 sept 2026 : la borne « < 1 % » (valeur texte) restait en clair.
      if (cc.top && (typeof cc.top.pct === "number" || cc.top.pct === "<1")) cc.top.pct = Math.min(99, caviardeNombre(typeof cc.top.pct === "number" ? cc.top.pct : 0.7));
      if (cc.top10 && (typeof cc.top10.pct === "number" || cc.top10.pct === "<1")) cc.top10.pct = Math.min(99, caviardeNombre(typeof cc.top10.pct === "number" ? cc.top10.pct : 0.7));
      // 13 oct 2026 : les dix premiers clients pesent au moins autant que le premier.
      if (cc.top && cc.top10 && typeof cc.top.pct === "number" && typeof cc.top10.pct === "number" && cc.top10.pct < cc.top.pct) {
        cc.top10.pct = Math.min(99, Number((cc.top.pct * 1.6).toFixed(1)));
      }
    }
  }

  // 9 sept 2026 : position marche / TAM.
  if (c.market_positions && c.market_positions.length > 0) {
    for (const p of c.market_positions) {
      if (estActive(zones, "tam", "titre")) {
        p.segment_name = caviarde(p.segment_name);
        if (p.marche) p.marche = caviarde(p.marche);
      }
      if (estActive(zones, "tam", "texte") || estActive(zones, "tam", "source")) {
        if (p.source_note) p.source_note = caviarde(p.source_note);
        if (p.source) p.source = caviarde(p.source);
      }
    }
    if (estActive(zones, "tam", "valeur") || estActive(zones, "tam", "graphique")) {
      c.market_positions = c.market_positions.map(caviardePositionMarche);
    }
  }

  return c;
}

/** Même principe pour la synthèse d'earning call (bloc transcripts). */
/**
 * Caviarde le transcript BRUT (TranscriptDoc) pour les paliers gratuits.
 * Faille corrigée le 2 sept 2026 (audit anti-triche) : le texte intégral du
 * call partait en clair dans le HTML servi au palier gratuit, lisible via
 * "Voir la source" même sous le flou CSS. Meta de tête (ticker, dates)
 * conservées, tout le contenu textuel remplacé par du charabia.
 */
export function caviardeTranscriptDocPourGratuit<
  T extends { ticker: string; fetched_at?: string },
>(doc: T | null, zones: Zone[]): T | null {
  if (!doc || !estActive(zones, "transcripts", "texte")) return doc;
  const d: T = JSON.parse(JSON.stringify(doc));
  const { ticker, fetched_at } = d;
  const caviarded = caviardeProfond(d);
  caviarded.ticker = ticker;
  if (fetched_at) caviarded.fetched_at = fetched_at;
  return caviarded;
}

export function caviardeTranscriptsPourGratuit(
  summary: TranscriptBulletsSummary | null,
  zones: Zone[],
): TranscriptBulletsSummary | null {
  if (!summary || !estActive(zones, "transcripts", "texte")) return summary;
  const s: TranscriptBulletsSummary = JSON.parse(JSON.stringify(summary));
  // Le trimestre (quarter) reste lisible : il figure dans l en-tete non floute.
  const quarter = s.quarter;
  const caviarded = caviardeProfond(s);
  caviarded.quarter = quarter;
  if (caviarded.summary && s.summary) caviarded.summary.sentiment = s.summary.sentiment;
  return caviarded;
}

/**
 * 25 sept 2026 (audit du flou) : le suivi des KPI des conferences (Premium et
 * Max) partait EN CLAIR aux paliers anonyme et gratuit (simple copie), soit
 * toutes les valeurs et citations. Tout le contenu est remplace par du
 * charabia de meme forme ; seuls les reperes de structure restent.
 */
const CLES_SUIVI_PRESERVEES = new Set(["ticker", "conferences", "date", "dates", "cle", "theme", "famille", "periode"]);
function caviardeSuivi(v: unknown, cle = ""): unknown {
  if (CLES_SUIVI_PRESERVEES.has(cle)) return v;
  if (typeof v === "string") return caviarde(v);
  if (typeof v === "number") return caviardeNombre(v);
  if (Array.isArray(v)) return v.map((x) => caviardeSuivi(x));
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = caviardeSuivi(x, k);
    return out;
  }
  return v;
}
export function caviardeSuiviPourGratuit<T>(suivi: T | null | undefined): T | null {
  if (!suivi) return null;
  return caviardeSuivi(JSON.parse(JSON.stringify(suivi))) as T;
}

/**
 * 25 sept 2026 : bloc « Sociétés rachetées ». Si une de ses zones est floutée
 * pour le palier, TOUT ce qui est sous le flou est crypté : noms, années,
 * montants, nombre de rachats, lignes du classement. Les textes fixes (titre,
 * « depuis 2016 ») ne sont pas des donnees et restent lisibles.
 */
export function caviardeRachatsPourGratuit<
  T extends {
    depuis: number;
    societe: { nb: number; rachats: { nom: string; annee: number | null; montant: string | null }[]; couverte: boolean } | null;
    classement: { us: { ticker: string; nom: string; nb: number }[]; eu: { ticker: string; nom: string; nb: number }[] };
  },
>(d: T | null, zones: Zone[]): T | null {
  if (!d) return d;
  const actif = (p: string) => estActive(zones, "rachats", p);
  const c: T = JSON.parse(JSON.stringify(d));
  if (c.societe && (actif("frise") || actif("liste") || actif("valeur"))) {
    c.societe.nb = Math.max(1, Math.round(caviardeNombre(c.societe.nb)));
    c.societe.rachats = c.societe.rachats.map((r) => ({
      nom: caviarde(r.nom),
      annee: r.annee ? 2016 + (Math.round(caviardeNombre(r.annee)) % 10) : null,
      montant: r.montant ? caviarde(r.montant) : null,
    }));
  }
  if (actif("ligne")) {
    const f = (l: { ticker: string; nom: string; nb: number }[]) =>
      l.map((x) => ({ ticker: "", nom: caviarde(x.nom), nb: Math.max(1, Math.round(caviardeNombre(x.nb))) }));
    c.classement = { us: f(c.classement.us), eu: f(c.classement.eu) };
  }
  return c;
}

/**
 * Yann 13 oct 2026 : bloc « KPI moyen terme » (graphiques image_findings)
 * entierement reserve aux abonnes. Aux paliers gratuit et anonyme (hors
 * vitrine), AUCUNE donnee reelle du bloc ne part au navigateur : titre,
 * legende, lecture et date sont remplaces par du texte factice, et l image par
 * un graphique generique sans donnee. Le nombre de graphiques est conserve
 * (navigation identique). Le titre et le sous-titre du bloc, communs a toutes
 * les fiches, ne sont pas des donnees et restent lisibles.
 */
export const IMAGE_MOYEN_TERME_RESERVE = "/findings/_reserve-abonnes.svg";
export function caviardeMoyenTermePourGratuit<C extends object>(company: C): C {
  const c = company as C & { image_findings?: Record<string, unknown>[] };
  if (!Array.isArray(c.image_findings) || c.image_findings.length === 0) return company;
  const factices = c.image_findings.map((f, i) => {
    const t = (v: unknown) => (typeof v === "string" && v ? caviarde(v) : null);
    return {
      id: `reserve-${i + 1}`,
      image_url: IMAGE_MOYEN_TERME_RESERVE,
      image_local_path: IMAGE_MOYEN_TERME_RESERVE,
      title: t(f.title),
      caption: t(f.caption),
      summary: t(f.summary),
      source_url: null,
      source_author: null,
      source_handle: null,
      source_date: null,
      source_platform: null,
      show_summary: f.show_summary !== false,
      target_tickers: [],
      industry_kpi: f.industry_kpi ? "reserve" : null,
    };
  });
  return { ...c, image_findings: factices };
}
