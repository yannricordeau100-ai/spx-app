/**
 * Alertes rouges de sécurité (Yann 2 sept 2026, suite audit anti-triche).
 *
 * Envoie un email d'alerte au propriétaire via Resend quand un signal de
 * triche est détecté (cookie de simulation présenté par une session
 * non-propriétaire, token d'audit invalide). Fire-and-forget : ne bloque
 * jamais la requête, ne jette jamais. Déduplication en mémoire 1 h par
 * instance pour ne pas inonder la boîte en cas de tentative répétée.
 * Compatible edge (fetch uniquement, pas d'API Node).
 */

const dernieresAlertes = new Map<string, number>();
const FENETRE_MS = 60 * 60 * 1000;

function dejaAlerte(cle: string): boolean {
  const now = Date.now();
  const t = dernieresAlertes.get(cle);
  if (t && now - t < FENETRE_MS) return true;
  dernieresAlertes.set(cle, now);
  // Purge simple pour borner la memoire.
  if (dernieresAlertes.size > 200) {
    for (const [k, v] of dernieresAlertes) {
      if (now - v > FENETRE_MS) dernieresAlertes.delete(k);
    }
  }
  return false;
}

function envoieAlerte(sujet: string, corps: string, cleDedup: string): void {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const dest = process.env.DESK_OWNER_EMAIL;
    if (!apiKey || !dest || dejaAlerte(cleDedup)) return;
    void fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Mettrik Sécurité <noreply@mettrik.ai>",
        to: [dest],
        subject: `🔴 ${sujet}`,
        text: `${corps}\n\nHorodatage : ${new Date().toISOString()}\nDédup : 1 alerte max par heure et par signal.`,
      }),
    }).catch(() => {});
  } catch {
    /* la securite ne casse jamais la requete */
  }
}

/** Un compte non-propriétaire a présenté le cookie de simulation de palier. */
export function signaleTricheSimulation(email: string, valeur: string): void {
  envoieAlerte(
    "ALERTE Mettrik : cookie de simulation présenté par un tiers",
    `La session "${email}" a présenté le cookie de simulation de palier (valeur "${valeur}") sans être le compte propriétaire. Le cookie a été IGNORÉ (palier réel conservé). Si les tentatives se répètent, envisager de bannir ce compte.`,
    `simulate:${email}`,
  );
}

/** Un token d'audit INVALIDE a été présenté (tentative de forçage). */
export function signaleTokenInvalide(chemin: string, ip: string): void {
  envoieAlerte(
    "ALERTE Mettrik : token d'audit invalide présenté",
    `Un paramètre audit_token INVALIDE a été présenté sur "${chemin}" (ip ${ip || "inconnue"}). L'accès est resté celui d'un visiteur normal. Tentative possible de forçage de la porte créateur.`,
    `token:${ip}`,
  );
}
