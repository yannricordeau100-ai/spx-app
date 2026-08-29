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

import type { Company } from "@/lib/data";
import type { Zone } from "@/lib/floutage";
import type { TranscriptBulletsSummary } from "@/components/transcript-bullets-block";

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

function caviardeProfond<T>(valeur: T, nombresAussi = false): T {
  if (typeof valeur === "string") return caviarde(valeur) as unknown as T;
  if (typeof valeur === "number" && nombresAussi) return caviardeNombre(valeur) as unknown as T;
  if (Array.isArray(valeur)) return valeur.map((v) => caviardeProfond(v, nombresAussi)) as unknown as T;
  if (valeur && typeof valeur === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valeur as Record<string, unknown>)) {
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
  const textesStories = estActive(zones, "stories", "texte");

  for (const k of c.kpis ?? []) {
    if (nomsKpi) {
      if (k.name_fr) k.name_fr = caviarde(k.name_fr);
      if (k.name_en) k.name_en = caviarde(k.name_en);
    }
    if (signaux && k.signal) k.signal = caviarde(k.signal);
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
    c.governance = caviardeProfond(c.governance, true);
  }

  if (estActive(zones, "ai_positioning", "texte") && c.ai_positioning) {
    c.ai_positioning = caviardeProfond(c.ai_positioning);
  }

  return c;
}

/** Même principe pour la synthèse d'earning call (bloc transcripts). */
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
