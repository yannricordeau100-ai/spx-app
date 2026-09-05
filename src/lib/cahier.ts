/**
 * Lecture du Cahier (docs/cahier) : registre des prompts et KPI souhaites
 * par sous-industrie. Cote serveur uniquement (lecture du depot).
 * Yann 5 sept 2026.
 */
import { promises as fs } from "fs";
import path from "path";

export type PromptCahier = {
  id: string;
  titre: string;
  categorie: string;
  objectif: string;
  entree: string;
  sortie: string;
  statut: string;
  prompt: string;
};

export type KpiSouhaite = {
  short: string;
  nom_fr: string;
  nom_en?: string;
  definition?: string;
  unite?: string;
  frequence?: string;
  source_habituelle?: string;
  wow?: boolean;
  /** organique = propre au metier de la sous-industrie ; complementaire = utile mais transversal. */
  type?: "organique" | "complementaire";
  reference_standard?: string;
  confiance?: string;
  exemples_societes?: string[];
  statut?: string;
};

export type CadreEuropeen = {
  esrs?: { norme: string; datapoint: string; pertinence?: string }[];
  esma_apm?: string;
  note?: string;
};

export type SocieteClassee = { ticker: string; name: string };

export type Hesitation = {
  ticker: string;
  name: string;
  code: string;
  alternative: string;
  raison?: string;
};

export type AnnuaireGics = {
  parSousIndustrie: Record<string, SocieteClassee[]>;
  aClasser: SocieteClassee[];
  /** Societes dont le classement hesite entre deux sous-industries, a arbitrer. */
  hesitations: Hesitation[];
  source: string;
};

export type KpiParSousIndustrie = {
  code: string;
  nom?: string;
  nom_fr?: string;
  nom_en?: string;
  statut?: string;
  sources_consultees?: { type: string; reference: string; url?: string }[];
  kpis: KpiSouhaite[];
  cadre_europeen?: CadreEuropeen;
  notes?: string;
};

const RACINE = () => path.join(process.cwd(), "docs", "cahier");

export async function lirePrompts(): Promise<PromptCahier[]> {
  let texte = "";
  try {
    texte = await fs.readFile(path.join(RACINE(), "PROMPTS.md"), "utf-8");
  } catch {
    return [];
  }
  const blocs = texte.split(/\n(?=## )/).filter((b) => b.startsWith("## "));
  return blocs.map((b) => {
    const lignes = b.split("\n");
    const entete = lignes[0].replace(/^## /, "");
    const [id, ...reste] = entete.split("·").map((s) => s.trim());
    const champ = (nom: string) => {
      const l = lignes.find((x) => new RegExp(`^- ${nom}\\s*:`, "i").test(x.trim()));
      return l ? l.replace(/^- [^:]+:\s*/, "").trim() : "";
    };
    const m = b.match(/```[a-z]*\n([\s\S]*?)```/);
    return {
      id: id || entete,
      titre: reste.join(" · ") || entete,
      categorie: champ("Catégorie") || champ("Categorie"),
      objectif: champ("Objectif"),
      entree: champ("Entrée") || champ("Entree"),
      sortie: champ("Sortie"),
      statut: champ("Statut") || "brouillon",
      prompt: m ? m[1].trim() : "",
    };
  });
}

export async function lireKpiParSousIndustrie(): Promise<Record<string, KpiParSousIndustrie>> {
  const out: Record<string, KpiParSousIndustrie> = {};
  let fichiers: string[] = [];
  try {
    fichiers = await fs.readdir(path.join(RACINE(), "kpi"));
  } catch {
    return out;
  }
  for (const f of fichiers) {
    if (!f.endsWith(".json") || f.startsWith("_")) continue;
    try {
      const j = JSON.parse(await fs.readFile(path.join(RACINE(), "kpi", f), "utf-8")) as KpiParSousIndustrie;
      const code = String(j.code ?? f.replace(/\.json$/, ""));
      out[code] = { ...j, code, kpis: Array.isArray(j.kpis) ? j.kpis : [] };
    } catch {
      /* fichier illisible : ignore */
    }
  }
  return out;
}

/**
 * Annuaire societes -> sous-industrie (docs/cahier/societes-gics.json).
 * `arbitrages` = choix deja faits par le proprietaire (desk_page_content) :
 * une hesitation arbitree rejoint sa sous-industrie.
 */
export async function lireAnnuaireGics(noms: Record<string, string>, arbitrages: Record<string, string> = {}): Promise<AnnuaireGics> {
  const vide: AnnuaireGics = { parSousIndustrie: {}, aClasser: [], hesitations: [], source: "" };
  try {
    const j = JSON.parse(await fs.readFile(path.join(RACINE(), "societes-gics.json"), "utf-8")) as {
      source?: string;
      societes?: Record<string, string>;
      a_classer?: string[];
      hesitations?: { ticker: string; code: string; alternative: string; raison?: string }[];
    };
    const par: Record<string, SocieteClassee[]> = {};
    const nom = (t: string) => noms[t.toUpperCase()] ?? t;
    for (const [ticker, code] of Object.entries(j.societes ?? {})) {
      (par[code] ??= []).push({ ticker, name: nom(ticker) });
    }
    const hesitations: Hesitation[] = [];
    for (const h of j.hesitations ?? []) {
      const choix = arbitrages[h.ticker.toUpperCase()];
      if (choix) (par[choix] ??= []).push({ ticker: h.ticker, name: nom(h.ticker) });
      else hesitations.push({ ...h, name: nom(h.ticker) });
    }
    for (const liste of Object.values(par)) liste.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return {
      parSousIndustrie: par,
      aClasser: (j.a_classer ?? []).map((t) => ({ ticker: t, name: nom(t) })),
      hesitations,
      source: j.source ?? "",
    };
  } catch {
    return vide;
  }
}

/* ───────── Donnees KPI par societe (docs/cahier/donnees) ───────── */

export type DonneeKpi = {
  short: string;
  nom_fr?: string;
  statut: "existe" | "trouve" | "non_trouve" | "actuel_seulement" | "autre" | string;
  short_en_ligne?: string;
  annees_en_ligne?: number;
  unite?: string;
  annees?: Record<string, number>;
  complet?: boolean;
  sources?: { url: string; titre?: string }[];
  commentaire?: string;
};

export type DonneesSociete = { ticker: string; code: string; date?: string; kpis: DonneeKpi[] };

export async function lireDonneesKpi(): Promise<Record<string, DonneesSociete>> {
  const out: Record<string, DonneesSociete> = {};
  let fichiers: string[] = [];
  try {
    fichiers = await fs.readdir(path.join(RACINE(), "donnees"));
  } catch {
    return out;
  }
  for (const f of fichiers) {
    if (!f.endsWith(".json") || f.startsWith("_")) continue;
    try {
      const j = JSON.parse(await fs.readFile(path.join(RACINE(), "donnees", f), "utf-8")) as DonneesSociete;
      const t = String(j.ticker ?? f.replace(/\.json$/, "")).toUpperCase();
      out[t] = { ...j, ticker: t, kpis: Array.isArray(j.kpis) ? j.kpis : [] };
    } catch {
      /* fichier illisible : ignore */
    }
  }
  return out;
}

/* ───────── Relecture KPI par sous-industrie : points a arbitrer ───────── */

export type PointRelecture = { code: string; sousIndustrie: string; point: string };

export async function lireRelecture(): Promise<{ intro: string; points: PointRelecture[] }> {
  try {
    const txt = await fs.readFile(path.join(RACINE(), "kpi", "_RELECTURE-2026-09-05.md"), "utf-8");
    const points: PointRelecture[] = [];
    for (const l of txt.split("\n")) {
      const m = l.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/);
      if (!m || /^-+$/.test(m[1]) || m[1] === "Code") continue;
      points.push({ code: m[1], sousIndustrie: m[2], point: m[3] });
    }
    const intro = (txt.split("\n").find((l) => l.startsWith("Corrections")) ?? "").trim();
    return { intro, points };
  } catch {
    return { intro: "", points: [] };
  }
}
