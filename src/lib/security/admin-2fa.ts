/**
 * Seconde verification des comptes admin (Yann 9 oct 2026).
 *
 * Sur les preversions (mettrik-niveau1/2, *.vercel.app), l entree dans
 * l outillage (/sandbox, /concepts, /admin, /desk-<slug>, /email-lab,
 * /chart-lab) demande, en plus de la session, un code a 6 chiffres envoye
 * par e-mail. Une fois le code saisi, un cookie signe (HMAC-SHA256, secret
 * ADMIN_2FA_SECRET) lie a l identifiant utilisateur evite de le redemander
 * pendant 30 jours. La session Supabase n est jamais touchee.
 *
 * Web Crypto uniquement : utilisable dans le proxy comme dans les routes.
 */

export const COOKIE_ADMIN_2FA = "mtk_admin_2fa";
export const DUREE_COOKIE_S = 30 * 24 * 60 * 60;
export const DUREE_CODE_MS = 10 * 60 * 1000;
export const MAX_ENVOIS_HEURE = 5;
export const MAX_ESSAIS = 5;
export const PAGE_VERIFICATION = "/verification-admin";

/** Comptes admin (meme liste que le proxy, src/proxy.ts constante comptesAdmin). */
export function comptesAdmin(): string[] {
  const proprietaire = (process.env.DESK_OWNER_EMAIL ?? "yannricordeau100@gmail.com").toLowerCase().trim();
  return [proprietaire, "yannricordeau100@gmail.com", "ricordeauyann@gmail.com", "mettrikai@gmail.com"];
}

/** Routes d outillage soumises au code (pas /whoami, /faq, /populaire-investisseurs). */
export function estRouteOutillage2FA(chemin: string): boolean {
  const prefixes = ["/sandbox", "/concepts", "/admin", `/desk-${process.env.DESK_SLUG ?? "mtk9x4kp"}`, "/email-lab", "/chart-lab"];
  return prefixes.some((p) => chemin === p || chemin.startsWith(p + "/"));
}

/** Adresse de retour sure (chemin interne uniquement). */
export function retourSur(r: string | null | undefined): string {
  if (!r || !r.startsWith("/") || r.startsWith("//") || r.includes("\\")) return "/sandbox";
  return r;
}

const enc = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const cle = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cle, enc.encode(message)));
  return Array.from(sig, (o) => o.toString(16).padStart(2, "0")).join("");
}

export function egaliteConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function secret(): string | null {
  const s = process.env.ADMIN_2FA_SECRET;
  return s && s.length >= 32 ? s : null;
}

/** Valeur du cookie : <userId>.<expiration s>.<hmac>. */
export async function signerCookieAdmin(userId: string, maintenantMs = Date.now()): Promise<string | null> {
  const s = secret();
  if (!s) return null;
  const exp = Math.floor(maintenantMs / 1000) + DUREE_COOKIE_S;
  const charge = `${userId}.${exp}`;
  return `${charge}.${await hmacHex(s, `cookie:${charge}`)}`;
}

/** Cookie present, signe par le serveur, lie a CET utilisateur et non expire. */
export async function cookieAdminValide(valeur: string | undefined, userId: string, maintenantMs = Date.now()): Promise<boolean> {
  try {
    const s = secret();
    if (!s || !valeur) return false;
    const morceaux = valeur.split(".");
    if (morceaux.length !== 3) return false;
    const [uid, expTxt, sig] = morceaux;
    if (uid !== userId) return false;
    const exp = Number(expTxt);
    if (!Number.isFinite(exp) || exp * 1000 < maintenantMs) return false;
    return egaliteConstante(sig, await hmacHex(s, `cookie:${uid}.${expTxt}`));
  } catch {
    return false;
  }
}

/** Empreinte du code (jamais stocke en clair). */
export async function hacherCode(userId: string, code: string): Promise<string | null> {
  const s = secret();
  if (!s) return null;
  return hmacHex(s, `code:${userId}:${code}`);
}

/** Code a 6 chiffres, tirage uniforme. */
export function genererCode(): string {
  const t = new Uint32Array(1);
  let n: number;
  do {
    crypto.getRandomValues(t);
    n = t[0];
  } while (n >= 4_294_000_000); // rejet pour eviter le biais modulo
  return String(n % 1_000_000).padStart(6, "0");
}
