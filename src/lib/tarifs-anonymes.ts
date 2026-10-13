/**
 * Yann 16 sept 2026 : les tarifs restent lisibles par adresse directe tant que
 * Stripe n est pas activé en réel (Stripe vérifie que les prix sont publics).
 * Une fois mettrik.ai en ligne, un bouton de /sandbox/lancement bascule ce
 * réglage : les visiteurs non inscrits sont alors renvoyés vers l inscription.
 * Réglage partagé avec la maintenance : desk_page_content, page_key « maintenance ».
 */
import { reglagesMaintenance } from "@/lib/reglages-cache";

let cache: { valeur: boolean; expire: number } = { valeur: false, expire: 0 };

export async function tarifsReservesAuxInscrits(): Promise<boolean> {
  if (Date.now() < cache.expire) return cache.valeur;
  try {
    // 13 oct 2026 (journaux Supabase) : reglage en cache partage, vide par
    // /api/sandbox/lancement a chaque enregistrement.
    const data = (await reglagesMaintenance.lire())["reglages"] ?? null;
    const brut = data?.content_fr ? (JSON.parse(data.content_fr) as { tarifs_anonymes?: string }) : null;
    cache = { valeur: brut?.tarifs_anonymes === "inscrits", expire: Date.now() + 30_000 };
  } catch {
    cache = { valeur: false, expire: Date.now() + 30_000 };
  }
  return cache.valeur;
}
