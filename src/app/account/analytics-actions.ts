"use server";

/**
 * Contrôles de vie privée du bloc « Mon activité » (Yann 13 oct 2026).
 * L identité vient TOUJOURS de la session : aucune action ne prend un
 * identifiant d utilisateur en paramètre.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Efface tous les événements de mesure rattachés au compte connecté. */
export async function effacerMonHistorique() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=signin&next=/account");
  const { error } = await createSupabaseAdminClient()
    .from("telemetrie_evenements")
    .delete()
    .eq("user_id", user.id);
  revalidatePath("/account");
  if (error) redirect(`/account?error=${encodeURIComponent("L’effacement n’a pas abouti, réessaie dans un instant.")}`);
  redirect(`/account?info=${encodeURIComponent("Ton historique d’activité a été effacé.")}`);
}

/** Active ou coupe la mesure de l activité du compte (drapeau lu à l ingestion). */
export async function reglerMesureActivite(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=signin&next=/account");
  const refuse = formData.get("refuse") === "1";
  const { error } = await supabase.auth.updateUser({ data: { mesure_activite: refuse ? "refusee" : "acceptee" } });
  revalidatePath("/account");
  if (error) redirect(`/account?error=${encodeURIComponent("Le réglage n’a pas été enregistré, réessaie dans un instant.")}`);
  redirect(`/account?info=${encodeURIComponent(refuse ? "Ton activité n’est plus mesurée." : "La mesure de ton activité est réactivée.")}`);
}
