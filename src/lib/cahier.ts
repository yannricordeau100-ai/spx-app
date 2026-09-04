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
  exemples_societes?: string[];
  statut?: string;
};

export type SocieteClassee = { ticker: string; name: string };

export type AnnuaireGics = {
  parSousIndustrie: Record<string, SocieteClassee[]>;
  aClasser: SocieteClassee[];
  source: string;
};

export type KpiParSousIndustrie = {
  code: string;
  nom?: string;
  statut?: string;
  kpis: KpiSouhaite[];
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

/** Annuaire societes -> sous-industrie (docs/cahier/societes-gics.json). */
export async function lireAnnuaireGics(noms: Record<string, string>): Promise<AnnuaireGics> {
  const vide: AnnuaireGics = { parSousIndustrie: {}, aClasser: [], source: "" };
  try {
    const j = JSON.parse(await fs.readFile(path.join(RACINE(), "societes-gics.json"), "utf-8")) as {
      source?: string;
      societes?: Record<string, string>;
      a_classer?: string[];
    };
    const par: Record<string, SocieteClassee[]> = {};
    for (const [ticker, code] of Object.entries(j.societes ?? {})) {
      (par[code] ??= []).push({ ticker, name: noms[ticker.toUpperCase()] ?? ticker });
    }
    for (const liste of Object.values(par)) liste.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return {
      parSousIndustrie: par,
      aClasser: (j.a_classer ?? []).map((t) => ({ ticker: t, name: noms[t.toUpperCase()] ?? t })),
      source: j.source ?? "",
    };
  } catch {
    return vide;
  }
}
