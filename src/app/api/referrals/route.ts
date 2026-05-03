import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateReferralCode, DEFAULT_REFERRAL_SETTINGS } from "@/lib/referrals";

/**
 * GET /api/referrals
 *  - Renvoie les referrals créés par le user authentifié + le code actif (s'il existe)
 *
 * POST /api/referrals
 *  - Génère un nouveau code pour le user authentifié (1 code = 1 invitation potentielle)
 *
 * GET /api/referrals?code=XXX (sans auth)
 *  - Vérifie validité d'un code (utilisé sur la page /parrainage par un visiteur)
 */

async function getSettings() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("desk_referral_settings")
    .select("*")
    .eq("id", 1)
    .single();
  return data ?? DEFAULT_REFERRAL_SETTINGS;
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  // Cas 1 : check d'un code (public, pas d'auth requise)
  if (code) {
    const { data: ref, error } = await supabase
      .from("desk_referrals")
      .select("code, status, expires_at, referrer_email")
      .eq("code", code)
      .single();
    if (error || !ref) {
      return NextResponse.json({ valid: false, reason: "not_found" });
    }
    const expired = new Date(ref.expires_at) < new Date();
    if (expired) return NextResponse.json({ valid: false, reason: "expired" });
    if (ref.status === "rewarded" || ref.status === "subscribed")
      return NextResponse.json({ valid: false, reason: "already_used" });
    // Masque l'email du referrer (RGPD)
    const masked = ref.referrer_email.replace(/(.).*(@.*)/, "$1***$2");
    return NextResponse.json({ valid: true, referrer: masked });
  }

  // Cas 2 : liste des referrals du user authentifié
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const { data: settings } = await supabase
    .from("desk_referral_settings")
    .select("*")
    .eq("id", 1)
    .single();

  const { data: refs } = await supabase
    .from("desk_referrals")
    .select("*")
    .eq("referrer_email", user.email)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    referrals: refs ?? [],
    settings: settings ?? DEFAULT_REFERRAL_SETTINGS,
  });
}

export async function POST(req: NextRequest) {
  void req;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const settings = await getSettings();
  if (!settings.enabled) {
    return NextResponse.json({ error: "program_disabled" }, { status: 403 });
  }

  // Vérif quota
  const { count } = await supabase
    .from("desk_referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_email", user.email);
  if ((count ?? 0) >= settings.max_referees_per_user) {
    return NextResponse.json({ error: "quota_exceeded" }, { status: 429 });
  }

  // Génère code unique (retry max 5x si collision)
  let code = generateReferralCode();
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await supabase
      .from("desk_referrals")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (!existing) break;
    code = generateReferralCode();
  }

  const expires_at = new Date(
    Date.now() + settings.code_validity_days * 86400 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("desk_referrals")
    .insert({
      referrer_email: user.email,
      code,
      expires_at,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
