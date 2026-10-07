/**
 * Garde anti abus des formulaires publics (contact, support, API).
 * 7 octobre 2026 : verification du courriel (format, domaine jetable, MX) et
 * filtre de grossieretes simple. Serveur uniquement.
 */
import { resolveMx, resolve4 } from "node:dns/promises";

const DOMAINES_JETABLES = new Set([
  "mailinator.com", "yopmail.com", "yopmail.fr", "guerrillamail.com", "guerrillamail.net",
  "guerrillamail.org", "sharklasers.com", "10minutemail.com", "10minutemail.net", "tempmail.com",
  "temp-mail.org", "temp-mail.io", "throwawaymail.com", "trashmail.com", "trashmail.net",
  "getnada.com", "nada.email", "maildrop.cc", "dispostable.com", "fakeinbox.com",
  "mailnesia.com", "mintemail.com", "mohmal.com", "moakt.com", "emailondeck.com",
  "tempail.com", "tempr.email", "discard.email", "spamgourmet.com", "mytemp.email",
  "burnermail.io", "inboxkitten.com", "mailcatch.com", "spam4.me", "grr.la",
  "test.com", "example.com", "example.org", "example.net", "invalid.com",
]);

const FORMAT = /^[a-z0-9._%+'-]{1,64}@([a-z0-9-]+(\.[a-z0-9-]+)+)$/i;

export type VerdictCourriel = { ok: boolean; raison?: "format" | "jetable" | "domaine" | "grossier" };

export async function verifierCourriel(brut: unknown): Promise<VerdictCourriel> {
  if (typeof brut !== "string") return { ok: false, raison: "format" };
  const email = brut.trim().toLowerCase();
  const m = FORMAT.exec(email);
  if (!m || email.length > 254) return { ok: false, raison: "format" };
  const domaine = m[1];
  if (DOMAINES_JETABLES.has(domaine)) return { ok: false, raison: "jetable" };
  if (contientGrossierete(email.split("@")[0])) return { ok: false, raison: "grossier" };
  try {
    const mx = await Promise.race([
      resolveMx(domaine),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000)),
    ]);
    if (mx.length > 0) return { ok: true };
    return { ok: false, raison: "domaine" };
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "ENOTFOUND" || code === "ENODATA") {
      // Sans MX, la norme admet un enregistrement A comme repli.
      try {
        const a = await resolve4(domaine);
        return a.length > 0 ? { ok: true } : { ok: false, raison: "domaine" };
      } catch {
        return { ok: false, raison: "domaine" };
      }
    }
    // Panne DNS passagere : on ne bloque pas un vrai client pour cela.
    return { ok: true };
  }
}

const GROSSIER = [
  "connard", "connasse", "salope", "salop", "enculé", "encule", "enfoiré", "enfoire", "putain",
  "pute", "merde", "bite", "couille", "nique", "ntm", "fdp", "pd ", "batard", "bâtard",
  "fuck", "shit", "bitch", "asshole", "dick", "cunt", "bastard", "motherfucker", "wanker",
];

function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[@4]/g, "a")
    .replace(/[3]/g, "e")
    .replace(/[10!|]/g, "i")
    .replace(/[$5]/g, "s");
}

export function contientGrossierete(texte: string): boolean {
  const t = ` ${texte.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")} `;
  const n = ` ${normaliser(texte)} `;
  return GROSSIER.some((g) => {
    const mot = g.normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (mot.length <= 3) return new RegExp(`[^a-z]${mot.trim()}[^a-z]`).test(t);
    return t.includes(mot.trim()) || n.includes(mot.trim());
  });
}

/** Refuse un envoi si un champ visible contient une grossierete. */
export function champsGrossiers(...champs: unknown[]): boolean {
  return champs.some((c) => typeof c === "string" && contientGrossierete(c));
}

export function ipDe(req: { headers: Headers }): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}
