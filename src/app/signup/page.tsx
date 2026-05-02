import { redirect } from "next/navigation";

/**
 * /signup — fallback. Redirige vers la home avec la modal d'inscription ouverte.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; info?: string }>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams({ auth: "signup" });
  if (sp.error) params.set("error", sp.error);
  if (sp.info) params.set("info", sp.info);
  redirect(`/?${params.toString()}`);
}
