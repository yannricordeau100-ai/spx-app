"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";

/**
 * Server actions admin — toutes gated par isAdminEmail.
 * Si l'email courant n'est pas admin, on redirige vers /404 (on ne révèle
 * pas l'existence du panneau).
 */

async function assertAdmin(): Promise<{ id: string; email: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    redirect("/404");
  }
  return { id: user.id, email: user.email! };
}

async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/* ─── Suppression d'un user ─────────────────────────────────────────── */

export async function adminDeleteUser(formData: FormData) {
  const adminUser = await assertAdmin();
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) {
    redirect(`/admin?error=${encodeURIComponent("ID user manquant.")}`);
  }
  if (userId === adminUser.id) {
    redirect(
      `/admin?error=${encodeURIComponent("Tu ne peux pas te supprimer toi-même depuis ici. Utilise /account.")}`
    );
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin");
  redirect(`/admin?info=${encodeURIComponent("Utilisateur supprimé. Il peut désormais se ré-inscrire avec le même email.")}`);
}

/* ─── Envoi d'un reset password ─────────────────────────────────────── */

export async function adminSendReset(formData: FormData) {
  await assertAdmin();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect(`/admin?error=${encodeURIComponent("Email manquant.")}`);
  }

  const supabase = await createSupabaseServerClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
  });
  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }
  redirect(
    `/admin?info=${encodeURIComponent(`Email de réinitialisation envoyé à ${email}.`)}`
  );
}

/* ─── Bannir / débannir ─────────────────────────────────────────────── */

export async function adminBanToggle(formData: FormData) {
  await assertAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const ban = formData.get("ban") === "1";
  if (!userId) {
    redirect(`/admin?error=${encodeURIComponent("ID user manquant.")}`);
  }
  const admin = createSupabaseAdminClient();
  // ban_duration : "100y" pour bannir, "none" pour lever le ban.
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: ban ? "876000h" : "none",
  });
  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/admin");
  redirect(
    `/admin?info=${encodeURIComponent(ban ? "Utilisateur banni." : "Utilisateur débanni.")}`
  );
}
