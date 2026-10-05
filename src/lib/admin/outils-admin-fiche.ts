/**
 * Mission admin « cours x KPI » et « KPI admin sur-mesure » (Yann, 1er oct 2026).
 *
 * Tout ce module est SERVEUR et reserve a l admin :
 * - jamais sur mettrik.ai (n0), meme pour l admin : la preversion seulement ;
 * - admin = compte proprietaire ou compte de marque connecte, ou jeton d audit
 *   accompagne de ?admin=1 (verifications automatiques des exports).
 * Les donnees ne partent au navigateur que si ce controle passe.
 */
import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { headers } from "next/headers";
import { getUserCourant } from "@/lib/supabase/server";
import { DESK_ADMIN_EMAILS } from "@/lib/desk/auth";

export type CoursFmp = {
  ticker: string;
  symbole_fmp: string;
  collecte: string;
  source: string;
  premiere_date: string;
  derniere_date: string;
  dernier_cours: number;
  plus_haut: { date: string; cours: number };
  cloture_annee_precedente: { date: string; cours: number } | null;
  seances: number;
  /** [date ISO, cours de cloture] : hebdomadaire puis quotidien sur les 400 derniers jours. */
  points: [string, number][];
};

export type CouvertureCours = { couvert: boolean | null; motif?: string | null };

function estHoteN0(host: string): boolean {
  const h = host.toLowerCase().split(":")[0];
  return h === "mettrik.ai" || h.endsWith(".mettrik.ai");
}

/** Controle serveur : l admin voit les outils, sur la preversion uniquement. */
export async function estAdminOutilsFiche(opts: { auditBypass: boolean; adminParam?: string }): Promise<boolean> {
  try {
    const h = await headers();
    if (estHoteN0(h.get("x-forwarded-host") ?? h.get("host") ?? "")) return false;
  } catch {
    return false;
  }
  if (opts.auditBypass && opts.adminParam === "1") return true;
  // Yann 5 oct 2026 : en simulation d un palier (gratuit, premium, max...), l admin
  // voit la page comme ce palier, donc sans les blocs admin.
  try {
    const { readSimulateTier } = await import("@/lib/desk/effective-tier");
    const simule = await readSimulateTier();
    if (simule) return false;
  } catch {
    /* pas de simulation lisible : on continue */
  }
  try {
    const user = await getUserCourant();
    const email = (user?.email ?? "").trim().toLowerCase();
    return !!email && DESK_ADMIN_EMAILS.includes(email);
  } catch {
    return false;
  }
}

const DOSSIER_COURS = path.join(process.cwd(), "src/data/cours-fmp");

export async function chargeCoursFmp(ticker: string): Promise<{ cours: CoursFmp | null; couverture: CouvertureCours }> {
  const t = ticker.toUpperCase();
  let couverture: CouvertureCours = { couvert: null, motif: "Societe non encore testee sur l API FMP gratuite" };
  try {
    const idx = JSON.parse(await fs.readFile(path.join(DOSSIER_COURS, "_couverture.json"), "utf-8")) as Record<string, CouvertureCours>;
    const variantes = [t, t.replace(/-/g, "."), t.replace(/\./g, "-")];
    for (const v of variantes) if (idx[v]) { couverture = idx[v]; break; }
  } catch {
    /* index absent : non teste */
  }
  for (const nom of [t.toLowerCase(), t.toLowerCase().replace(/-/g, "."), t.toLowerCase().replace(/\./g, "-")]) {
    try {
      const raw = await fs.readFile(path.join(DOSSIER_COURS, `${nom}.json`), "utf-8");
      return { cours: JSON.parse(raw) as CoursFmp, couverture: { couvert: true } };
    } catch {
      /* variante suivante */
    }
  }
  return { cours: null, couverture };
}
