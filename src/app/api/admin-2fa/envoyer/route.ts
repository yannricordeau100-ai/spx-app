import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { envoyerCodeAdmin } from "@/lib/email/admin-2fa";
import { journaliserEmail } from "@/lib/journal-emails";
import {
  comptesAdmin,
  DUREE_CODE_MS,
  genererCode,
  hacherCode,
  MAX_ENVOIS_HEURE,
} from "@/lib/security/admin-2fa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin-2fa/envoyer : envoie un code a 6 chiffres a l adresse du
 * compte admin connecte. 5 envois par heure, code valable 10 minutes.
 * Envoi direct par Resend (comme les alertes de securite) : le mode
 * EMAIL_DRY_RUN de niveau 1 ne doit pas bloquer l acces du proprietaire.
 */
export async function POST() {
  const sb = await createSupabaseServerClient();
  const { data } = await sb.auth.getUser();
  const user = data.user;
  const email = (user?.email ?? "").toLowerCase().trim();
  if (!user || !email || !comptesAdmin().includes(email)) {
    return new NextResponse(null, { status: 404 });
  }

  const code = genererCode();
  const empreinte = await hacherCode(user.id, code);
  const apiKey = process.env.RESEND_API_KEY;
  if (!empreinte || !apiKey) {
    return NextResponse.json({ ok: false, erreur: "Vérification indisponible : configuration serveur incomplète." }, { status: 503 });
  }

  const admin = createSupabaseAdminClient();
  const depuis = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: errCompte } = await admin
    .from("admin_2fa_codes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", depuis);
  if (errCompte) {
    console.error("[admin-2fa] lecture", errCompte.message);
    return NextResponse.json({ ok: false, erreur: "Vérification indisponible pour le moment." }, { status: 503 });
  }
  if ((count ?? 0) >= MAX_ENVOIS_HEURE) {
    return NextResponse.json({ ok: false, erreur: "Trop de codes demandés. Réessayez dans une heure." }, { status: 429 });
  }

  const { error: errInsert } = await admin.from("admin_2fa_codes").insert({
    user_id: user.id,
    email,
    code_hash: empreinte,
    expires_at: new Date(Date.now() + DUREE_CODE_MS).toISOString(),
  });
  if (errInsert) {
    console.error("[admin-2fa] ecriture", errInsert.message);
    return NextResponse.json({ ok: false, erreur: "Vérification indisponible pour le moment." }, { status: 503 });
  }

  const envoi = await envoyerCodeAdmin(email, code, apiKey);
  if (!envoi.ok) {
    console.error("[admin-2fa] envoi", envoi.statut);
    return NextResponse.json({ ok: false, erreur: "L’envoi du code a échoué. Réessayez." }, { status: 502 });
  }
  // Journal sans le code (le sujet le contient).
  await journaliserEmail("admin-2fa", "Code de vérification admin", email).catch(() => {});

  const [nom, domaine] = email.split("@");
  const masque = `${nom.slice(0, 2)}${"•".repeat(Math.max(1, nom.length - 2))}@${domaine}`;
  return NextResponse.json({ ok: true, destinataire: masque });
}
