import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyTurnstileToken } from "@/lib/turnstile";

/**
 * POST /api/contact-api
 *
 * Endpoint dédié aux demandes d'accès API Mettrik AI (pros : fonds,
 * family offices, wealth managers). Yann P7 (31 mai 2026).
 *
 * Différent de /api/contact (générique) car le payload contient des
 * champs spécifiques (use case, volume estimé, sociétés suivies, rôle)
 * que l'équipe commerciale Mettrik utilise pour qualifier la demande
 * et proposer un tarif sur mesure.
 *
 * Body : { name, email, company, role, use_case, companies_count,
 *          calls_per_month, locale, captchaToken }
 *
 * Persiste dans `desk_contact_messages` avec `recipient = "api"` et un
 * body texte structuré (multi-lignes) pour faciliter la lecture côté
 * back-office.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    name,
    email,
    company,
    role,
    use_case,
    companies_count,
    calls_per_month,
    locale,
    captchaToken,
  } = body || {};

  // Anti-bot Turnstile
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const captchaResult = await verifyTurnstileToken(captchaToken, ip);
  if (!captchaResult.ok) {
    return NextResponse.json(
      { error: "captcha_failed", reason: captchaResult.reason },
      { status: 400 },
    );
  }

  // Validation
  if (!name || !email || !company || !role || !use_case) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (
    String(use_case).length > 3000 ||
    String(company).length > 200 ||
    String(role).length > 200 ||
    String(name).length > 100
  ) {
    return NextResponse.json({ error: "too_long" }, { status: 400 });
  }

  // Structure le body pour le back-office (lisible 1 coup d'œil)
  const formattedBody = [
    `Société : ${company}`,
    `Rôle : ${role}`,
    `Sociétés suivies : ${companies_count || "non précisé"}`,
    `Appels / mois : ${calls_per_month || "non précisé"}`,
    "",
    "Cas d'usage :",
    use_case,
  ].join("\n");

  const subject = `[API] Demande accès API — ${company} (${role})`.slice(0, 200);

  const supabase = await createSupabaseServerClient();
  const ua = req.headers.get("user-agent") ?? null;

  // Yann P7 (31 mai 2026) : recipient = "contact" pour rester compatible
  // avec la contrainte CHECK existante (recipient IN ('contact', 'support')).
  // Le tag [API] dans le subject permet de filtrer côté back-office sans
  // migration BDD. Si Yann veut séparer formellement les flux, ajouter
  // 'api' au CHECK constraint dans une future migration et changer ici.
  const { error } = await supabase.from("desk_contact_messages").insert({
    recipient: "contact",
    sender_name: String(name).slice(0, 100),
    sender_email: String(email).toLowerCase().trim(),
    subject,
    body: formattedBody.slice(0, 5000),
    source_locale: locale ? String(locale).slice(0, 10) : null,
    source_ip: ip,
    user_agent: ua ? ua.slice(0, 300) : null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
