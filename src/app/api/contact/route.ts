import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyTurnstileToken } from "@/lib/turnstile";

/**
 * POST /api/contact
 * Body : { recipient, name, email, subject, body, captchaToken }
 * Insert un message dans desk_contact_messages. Public (pas d'auth requise).
 * Yann 11 mai 2026 : captcha Turnstile obligatoire (anti-bot solide).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { recipient, name, email, subject, body: msgBody, locale, captchaToken } = body || {};

  // Anti-bot Turnstile (rejette tout submit sans token valide).
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const captchaResult = await verifyTurnstileToken(captchaToken, ip);
  if (!captchaResult.ok) {
    return NextResponse.json(
      { error: "captcha_failed", reason: captchaResult.reason },
      { status: 400 },
    );
  }

  // Validation basique
  if (!recipient || (recipient !== "contact" && recipient !== "support")) {
    return NextResponse.json({ error: "invalid_recipient" }, { status: 400 });
  }
  if (!name || !email || !subject || !msgBody) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  // Anti-spam basique : limites de longueur
  if (msgBody.length > 5000 || subject.length > 200 || name.length > 100) {
    return NextResponse.json({ error: "too_long" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const ua = req.headers.get("user-agent") ?? null;

  const { error } = await supabase.from("desk_contact_messages").insert({
    recipient,
    sender_name: String(name).slice(0, 100),
    sender_email: String(email).toLowerCase().trim(),
    subject: String(subject).slice(0, 200),
    body: String(msgBody).slice(0, 5000),
    source_locale: locale ? String(locale).slice(0, 10) : null,
    source_ip: ip,
    user_agent: ua ? ua.slice(0, 300) : null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
