/**
 * FAQ Mettrik (Yann 2 sept 2026).
 *
 * Source de vérité en deux couches :
 *  1. La base (desk_page_content, page_key "faq", section_key "contenu") :
 *     ce que Yann édite depuis /sandbox/faq, effet immédiat en production.
 *  2. Le dépôt (src/data/faq.json) : contenu de départ et filet de sécurité
 *     si la base est vide ou injoignable.
 *
 * Le même contenu alimente la page publique /faq, ses données structurées
 * (schema.org FAQPage pour Google et les moteurs de réponse IA) et le fichier
 * llms.txt. Une seule édition met tout à jour.
 */
import { createClient } from "@supabase/supabase-js";
import faqDepot from "@/data/faq.json";

export type FaqCategorie = { id: string; titre_fr: string; titre_en: string };
export type FaqItem = {
  id: string;
  categorie: string;
  q_fr: string;
  r_fr: string;
  q_en: string;
  r_en: string;
};
export type FaqContenu = {
  version: number;
  mis_a_jour: string;
  categories: FaqCategorie[];
  items: FaqItem[];
};

const PAGE_KEY = "faq";
const SECTION_KEY = "contenu";

export const FAQ_DEPOT: FaqContenu = faqDepot as FaqContenu;

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

/** Garde-fou : ne garde que des items complets, ids uniques, catégories connues. */
export function nettoieFaq(brut: unknown): FaqContenu | null {
  if (!brut || typeof brut !== "object") return null;
  const b = brut as Partial<FaqContenu>;
  const categories = Array.isArray(b.categories)
    ? b.categories.filter(
        (c): c is FaqCategorie =>
          !!c && typeof c.id === "string" && typeof c.titre_fr === "string" && c.titre_fr.trim().length > 0,
      ).map((c) => ({ id: slug(c.id), titre_fr: c.titre_fr.trim(), titre_en: (c.titre_en ?? "").trim() }))
    : [];
  if (!categories.length) return null;
  const ids = new Set(categories.map((c) => c.id));
  const vus = new Set<string>();
  const items: FaqItem[] = [];
  for (const it of Array.isArray(b.items) ? b.items : []) {
    if (!it || typeof it !== "object") continue;
    const i = it as Partial<FaqItem>;
    const q_fr = (i.q_fr ?? "").trim();
    const r_fr = (i.r_fr ?? "").trim();
    if (!q_fr || !r_fr) continue;
    const categorie = ids.has(slug(i.categorie ?? "")) ? slug(i.categorie!) : categories[0].id;
    let id = slug(i.id || q_fr) || `q-${items.length + 1}`;
    while (vus.has(id)) id = `${id}-2`;
    vus.add(id);
    items.push({ id, categorie, q_fr, r_fr, q_en: (i.q_en ?? "").trim(), r_en: (i.r_en ?? "").trim() });
  }
  if (!items.length) return null;
  return {
    version: typeof b.version === "number" ? b.version : 1,
    mis_a_jour: typeof b.mis_a_jour === "string" ? b.mis_a_jour : new Date().toISOString().slice(0, 10),
    categories,
    items,
  };
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Contenu servi : base si elle a un contenu valide, sinon dépôt. */
export async function chargeFaq(): Promise<{ contenu: FaqContenu; source: "base" | "depot" }> {
  try {
    const { data } = await admin()
      .from("desk_page_content")
      .select("content_fr")
      .eq("page_key", PAGE_KEY)
      .eq("section_key", SECTION_KEY)
      .maybeSingle();
    if (data?.content_fr) {
      const propre = nettoieFaq(JSON.parse(data.content_fr));
      if (propre) return { contenu: propre, source: "base" };
    }
  } catch {
    /* base injoignable : depot */
  }
  return { contenu: FAQ_DEPOT, source: "depot" };
}

export async function enregistreFaq(contenu: FaqContenu): Promise<void> {
  const propre = nettoieFaq(contenu);
  if (!propre) throw new Error("contenu FAQ invalide (au moins une catégorie et une question complète)");
  propre.mis_a_jour = new Date().toISOString().slice(0, 10);
  const { error } = await admin()
    .from("desk_page_content")
    .upsert(
      { page_key: PAGE_KEY, section_key: SECTION_KEY, content_fr: JSON.stringify(propre) },
      { onConflict: "page_key,section_key" },
    );
  if (error) throw new Error(error.message);
}

/** Supprime le contenu en base : la page repart du dépôt. */
export async function reinitialiseFaq(): Promise<void> {
  const { error } = await admin()
    .from("desk_page_content")
    .delete()
    .eq("page_key", PAGE_KEY)
    .eq("section_key", SECTION_KEY);
  if (error) throw new Error(error.message);
}

/** Texte brut (sans liens markdown) pour les données structurées et llms.txt. */
export function texteBrut(reponse: string): string {
  return reponse.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s*\n\s*\n\s*/g, " ").trim();
}

/** Découpe une réponse en paragraphes et segments (texte | lien). */
export type Segment = { type: "texte"; texte: string } | { type: "lien"; texte: string; href: string };
export function paragraphes(reponse: string): Segment[][] {
  return reponse
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const segs: Segment[] = [];
      const re = /\[([^\]]+)\]\(([^)]+)\)/g;
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(p))) {
        if (m.index > last) segs.push({ type: "texte", texte: p.slice(last, m.index) });
        segs.push({ type: "lien", texte: m[1], href: m[2] });
        last = m.index + m[0].length;
      }
      if (last < p.length) segs.push({ type: "texte", texte: p.slice(last) });
      return segs;
    });
}
