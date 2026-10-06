/**
 * Journees investisseurs et conferences developpeurs (cadre du 6 octobre 2026,
 * docs/EVENEMENTS-INVESTISSEURS.md). Lit src/data/evenements/<ticker en
 * minuscules>.json (nom en minuscules : un nom en majuscules donne un 404 en
 * production, voir la note sur la casse des fichiers) et le convertit en :
 *   - stories (KPI court terme, _source "evenement"),
 *   - candidats TAM « declares par la societe »,
 *   - elements de positionnement IA issus de l evenement,
 *   - sources, affichees uniquement dans le mini bloc de sources du bas.
 * Serveur uniquement (fs). Les citations verbatim, les valeurs ecartees et les
 * sondes de verification ne partent jamais vers le navigateur.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

type RawStory = {
  id?: string;
  short?: string;
  name_fr?: string;
  name_en?: string;
  value?: number | null;
  value_texte?: string | null;
  unit?: string;
  period?: string;
  nature?: string;
  explanation?: string;
  history?: number[] | null;
  history_periods?: string[] | null;
  story_fr?: string;
  story_en?: string;
  story_category?: string;
  label_fr?: string;
  source_url?: string;
};

type RawEvenementFile = {
  ticker?: string;
  societe?: string;
  source_principale?: string;
  evenement?: { nom?: string; type?: string; date?: string; lieu?: string };
  stories?: RawStory[];
  tam_candidats?: Array<Record<string, unknown>>;
  positionnement_ia?: Array<{ sujet?: string; detail?: string; source_url?: string }>;
  statut?: string;
};

export type EvenementTamItem = { libelle: string; valeur: string; detail: string };
export type EvenementIaItem = { sujet: string; detail: string };

export type EvenementFiche = {
  nom: string;
  /** « journee investisseurs » ou « conference » (regroupement de l affichage). */
  groupe: "journee" | "conference";
  date: string;
  etiquette: string;
  tam: EvenementTamItem[];
  ia: EvenementIaItem[];
  /** Libelles de sources pour le mini bloc du bas. */
  sources: string[];
};

const ALIAS: Record<string, string> = { GOOG: "GOOGL" };

function groupeDe(type: string | undefined): "journee" | "conference" {
  return /conf/i.test(type ?? "") ? "conference" : "journee";
}

function hote(url: string | undefined): string {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export async function chargerEvenement(
  ticker: string,
): Promise<{ fiche: EvenementFiche; kpis: Array<Record<string, unknown>> } | null> {
  const t = ALIAS[ticker.toUpperCase()] ?? ticker.toUpperCase();
  let raw: RawEvenementFile;
  try {
    const txt = await fs.readFile(
      path.join(process.cwd(), "src/data/evenements", `${t.toLowerCase()}.json`),
      "utf8",
    );
    raw = JSON.parse(txt) as RawEvenementFile;
  } catch {
    return null;
  }
  // Rien n est servi tant que Yann n a pas valide la proposition.
  if (!raw || !/valid/i.test(raw.statut ?? "") || /attente/i.test(raw.statut ?? "")) return null;

  const ev = raw.evenement ?? {};
  const nom = str(ev.nom);
  const date = str(ev.date);
  const groupe = groupeDe(ev.type);
  const etiquetteDefaut = date ? `annoncé par la société le ${date}` : "annoncé par la société";

  const kpis: Array<Record<string, unknown>> = [];
  const sourcesUrl = new Set<string>();
  for (const s of raw.stories ?? []) {
    const fr = str(s.story_fr);
    if (!fr || !str(s.name_fr)) continue;
    const texte = str(s.value_texte);
    const num = typeof s.value === "number" && Number.isFinite(s.value) ? s.value : null;
    // Valeur affichee : le texte de la societe (fourchette, seuil) prime, sinon le nombre.
    const affichee = texte || (num !== null ? num.toLocaleString("fr-FR", { maximumFractionDigits: 3 }) : "");
    if (!affichee) continue;
    const hist = Array.isArray(s.history) ? s.history : [];
    const per = Array.isArray(s.history_periods) ? s.history_periods : [];
    const serie =
      hist.length >= 2 && hist.length === per.length && hist.every((h) => typeof h === "number")
        ? hist.map((h, i) => ({ q: String(per[i]), v: h }))
        : hist;
    if (s.source_url) sourcesUrl.add(s.source_url);
    kpis.push({
      short: str(s.short) || str(s.id),
      name_fr: str(s.name_fr),
      name_en: str(s.name_en),
      explanation: str(s.explanation),
      value: num !== null ? num : affichee,
      value_display: affichee,
      unit: str(s.unit),
      yoy: "",
      type: "",
      nature: str(s.nature),
      comparable: "",
      signal: fr,
      // Anglais uniquement derriere le « i » (bas de carte).
      description: str(s.story_en),
      history: serie,
      is_short_history: true,
      story_category: str(s.story_category) || "Story",
      _source: "evenement",
      evenement_label: str(s.label_fr) || etiquetteDefaut,
      evenement_periode: str(s.period),
      evenement_groupe: groupe,
      evenement_nom: nom,
    });
  }

  const tam: EvenementTamItem[] = [];
  for (const c of raw.tam_candidats ?? []) {
    const libelle = str(c.libelle) || str(c.segment) || str(c.sujet) || str(c.name_fr) || str(c.titre) || str(c.label);
    const unit = str(c.unit) || str(c.unite);
    const v = c.value_texte ?? c.valeur ?? c.value ?? c.taille;
    const valeur = [typeof v === "number" ? String(v).replace(".", ",") : str(v), unit].filter(Boolean).join(" ");
    const detail = str(c.detail) || str(c.explanation) || str(c.periode) || str(c.period);
    if (!libelle || !valeur) continue;
    tam.push({ libelle, valeur, detail });
    const u = str(c.source_url);
    if (u) sourcesUrl.add(u);
  }

  const ia: EvenementIaItem[] = [];
  for (const p of raw.positionnement_ia ?? []) {
    const sujet = str(p.sujet);
    if (!sujet) continue;
    ia.push({ sujet, detail: str(p.detail) });
    if (p.source_url) sourcesUrl.add(p.source_url);
  }

  if (kpis.length === 0 && tam.length === 0 && ia.length === 0) return null;
  if (raw.source_principale) sourcesUrl.add(raw.source_principale);

  const societe = str(raw.societe);
  const sources = [...sourcesUrl]
    .map((u) => hote(u))
    .filter(Boolean)
    .filter((h, i, a) => a.indexOf(h) === i)
    .map((h) => `${societe ? societe + ", " : ""}${nom}${date ? " (" + date + ")" : ""}, ${h}`);

  return {
    fiche: { nom, groupe, date, etiquette: etiquetteDefaut, tam, ia, sources },
    kpis,
  };
}
