/**
 * /llms-full.txt (Yann 2 sept 2026, GEO) : version texte complète de la FAQ
 * pour les moteurs de réponse IA. Générée à la demande depuis le même contenu
 * que /faq : une édition dans /sandbox/faq met ce fichier à jour aussi.
 */
import { chargeFaq, texteBrut } from "@/lib/faq";

export const dynamic = "force-dynamic";

export async function GET() {
  const { contenu } = await chargeFaq();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mettrik.ai";
  const lignes: string[] = [
    "# Mettrik AI : questions fréquentes (texte intégral)",
    "",
    `Source : ${base}/faq (mise à jour ${contenu.mis_a_jour}). Voir aussi ${base}/llms.txt`,
    "",
  ];
  for (const cat of contenu.categories) {
    const items = contenu.items.filter((it) => it.categorie === cat.id);
    if (!items.length) continue;
    lignes.push(`## ${cat.titre_fr}`, "");
    for (const it of items) {
      lignes.push(`### ${it.q_fr}`, "", texteBrut(it.r_fr), "", `Lien : ${base}/faq#${it.id}`, "");
    }
  }
  return new Response(lignes.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
