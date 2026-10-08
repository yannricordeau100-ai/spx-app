import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  comptesAdmin,
  COOKIE_ADMIN_2FA,
  DUREE_COOKIE_S,
  egaliteConstante,
  hacherCode,
  MAX_ESSAIS,
  retourSur,
  signerCookieAdmin,
} from "@/lib/security/admin-2fa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin-2fa/verifier { code, retour } : controle le dernier code
 * envoye (10 minutes, 5 essais). Succes : cookie signe 30 jours, lie a
 * l identifiant utilisateur. La session Supabase n est pas modifiee.
 */
export async function POST(req: Request) {
  const sb = await createSupabaseServerClient();
  const { data } = await sb.auth.getUser();
  const user = data.user;
  const email = (user?.email ?? "").toLowerCase().trim();
  if (!user || !email || !comptesAdmin().includes(email)) {
    return new NextResponse(null, { status: 404 });
  }

  let corps: { code?: unknown; retour?: unknown } = {};
  try {
    corps = await req.json();
  } catch {
    /* corps vide */
  }
  const code = typeof corps.code === "string" ? corps.code.replace(/\s/g, "") : "";
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ ok: false, erreur: "Le code comporte 6 chiffres." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: lignes, error } = await admin
    .from("admin_2fa_codes")
    .select("id, code_hash, expires_at, attempts, used_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) {
    console.error("[admin-2fa] lecture", error.message);
    return NextResponse.json({ ok: false, erreur: "Vérification indisponible pour le moment." }, { status: 503 });
  }
  const ligne = lignes?.[0];
  if (!ligne || ligne.used_at || new Date(ligne.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, erreur: "Code expiré ou déjà utilisé. Demandez un nouveau code." }, { status: 400 });
  }
  if (ligne.attempts >= MAX_ESSAIS) {
    return NextResponse.json({ ok: false, erreur: "Trop d’essais. Demandez un nouveau code." }, { status: 429 });
  }

  const empreinte = await hacherCode(user.id, code);
  if (!empreinte) {
    return NextResponse.json({ ok: false, erreur: "Vérification indisponible : configuration serveur incomplète." }, { status: 503 });
  }
  if (!egaliteConstante(empreinte, ligne.code_hash)) {
    const essais = ligne.attempts + 1;
    await admin.from("admin_2fa_codes").update({ attempts: essais }).eq("id", ligne.id);
    const restants = MAX_ESSAIS - essais;
    return NextResponse.json(
      {
        ok: false,
        erreur: restants > 0 ? `Code incorrect. ${restants} essai${restants > 1 ? "s" : ""} restant${restants > 1 ? "s" : ""}.` : "Code incorrect. Demandez un nouveau code.",
      },
      { status: 400 },
    );
  }

  // Usage unique : on ne pose le cookie que si la ligne etait encore libre.
  const { data: maj } = await admin
    .from("admin_2fa_codes")
    .update({ used_at: new Date().toISOString(), attempts: ligne.attempts + 1 })
    .eq("id", ligne.id)
    .is("used_at", null)
    .select("id");
  if (!maj || maj.length === 0) {
    return NextResponse.json({ ok: false, erreur: "Code déjà utilisé. Demandez un nouveau code." }, { status: 400 });
  }

  const valeur = await signerCookieAdmin(user.id);
  if (!valeur) {
    return NextResponse.json({ ok: false, erreur: "Vérification indisponible : configuration serveur incomplète." }, { status: 503 });
  }
  const res = NextResponse.json({ ok: true, retour: retourSur(typeof corps.retour === "string" ? corps.retour : null) });
  res.cookies.set(COOKIE_ADMIN_2FA, valeur, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: DUREE_COOKIE_S,
  });
  return res;
}
