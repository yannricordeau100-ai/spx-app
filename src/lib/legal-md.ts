import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Parseur Markdown minimal pour les pages légales (CGU/CGV/Mentions/Confidentialité).
 *
 * Évite toute dépendance externe (remark, marked, mdx) — Yann veut un site
 * léger et le format MD reste très contrôlé (généré depuis l'éditeur sandbox).
 *
 * Formats reconnus :
 *   # Titre                           → title (extrait, retiré du corps)
 *   > Dernière mise à jour : ...      → updatedAt (extrait)
 *   ## Section                        → h2
 *   ### Sous-section                  → h3
 *   - item                            → ul li (groupé en blocs)
 *   paragraphe                        → p
 *   ligne vide                        → séparateur
 */

export type LegalBlock =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] };

export type LegalDoc = {
  title: string;
  updatedAt: string;
  blocks: LegalBlock[];
};

export function parseLegalMarkdown(raw: string): LegalDoc {
  const lines = raw.split(/\r?\n/);
  let title = "";
  let updatedAt = "";
  const blocks: LegalBlock[] = [];
  let currentList: string[] | null = null;

  const flushList = () => {
    if (currentList && currentList.length > 0) {
      blocks.push({ kind: "ul", items: currentList });
    }
    currentList = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      continue;
    }

    if (line.startsWith("# ")) {
      title = line.slice(2).trim();
      continue;
    }

    if (line.startsWith("> ")) {
      const txt = line.slice(2).trim();
      // Strip "Dernière mise à jour :" / "Last updated:" prefix
      updatedAt = txt
        .replace(/^Derni[èe]re mise à jour\s*:\s*/i, "")
        .replace(/^Last updated\s*:\s*/i, "")
        .trim();
      continue;
    }

    if (line.startsWith("### ")) {
      flushList();
      blocks.push({ kind: "h3", text: line.slice(4).trim() });
      continue;
    }

    if (line.startsWith("## ")) {
      flushList();
      blocks.push({ kind: "h2", text: line.slice(3).trim() });
      continue;
    }

    if (line.startsWith("- ")) {
      if (!currentList) currentList = [];
      currentList.push(line.slice(2).trim());
      continue;
    }

    flushList();
    blocks.push({ kind: "p", text: line });
  }

  flushList();
  return { title, updatedAt, blocks };
}

export async function loadLegalDoc(slug: "conditions", locale: "fr" | "en"): Promise<LegalDoc> {
  const filePath = path.join(process.cwd(), "src", "data", "legal", `${slug}-${locale}.md`);
  const raw = await fs.readFile(filePath, "utf-8");
  return parseLegalMarkdown(raw);
}

export async function loadLegalMarkdownRaw(slug: "conditions", locale: "fr" | "en"): Promise<string> {
  const filePath = path.join(process.cwd(), "src", "data", "legal", `${slug}-${locale}.md`);
  return fs.readFile(filePath, "utf-8");
}

export function legalFilePath(slug: "conditions", locale: "fr" | "en"): string {
  return path.join(process.cwd(), "src", "data", "legal", `${slug}-${locale}.md`);
}
