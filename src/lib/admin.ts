/**
 * Liste des emails admin Mettrik. Lue depuis ADMIN_EMAILS dans .env.local
 * (séparés par virgule). Toute fonction admin compare l'email de l'user
 * connecté à cette liste.
 *
 * IMPORTANT : ne JAMAIS hardcoder un email d'admin ici. Le source de vérité
 * est l'env, pour qu'un push public ne révèle pas l'identité du / des
 * admins.
 */
export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}
