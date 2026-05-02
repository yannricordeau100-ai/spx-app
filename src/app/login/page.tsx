import { redirect } from "next/navigation";

/**
 * /login — fallback. Redirige vers la home avec la modal de connexion ouverte.
 * Toutes les méthodes (email+password, magic link, Google) sont dans la modal.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; info?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams({ auth: "signin" });
  if (sp.error) params.set("error", sp.error);
  if (sp.info) params.set("info", sp.info);
  if (sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//")) {
    params.set("next", sp.next);
  }
  redirect(`/?${params.toString()}`);
}
