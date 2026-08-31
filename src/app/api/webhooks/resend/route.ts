/**
 * Webhook Resend -> télémétrie email (Yann 31 août 2026).
 *
 * À brancher dans Resend (Dashboard > Webhooks > Add endpoint) sur
 * https://mettrik.ai/api/webhooks/resend avec les événements email.*
 * (sent, delivered, opened, clicked, bounced, complained).
 *
 * Vérification de signature Svix (en-têtes svix-id / svix-timestamp /
 * svix-signature) avec le secret RESEND_WEBHOOK_SECRET. Tant que ce secret
 * n'est pas posé dans Vercel, l'endpoint refuse tout (503) : on ne stocke
 * jamais un événement non authentifié.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { insereEvenements } from "@/lib/telemetrie/serveur";

export const dynamic = "force-dynamic";

function verifieSvix(req: NextRequest, corps: string, secret: string): boolean {
  const id = req.headers.get("svix-id");
  const ts = req.headers.get("svix-timestamp");
  const sig = req.headers.get("svix-signature");
  if (!id || !ts || !sig) return false;
  // Anti-rejeu : 5 minutes.
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const clef = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const attendu = createHmac("sha256", clef).update(`${id}.${ts}.${corps}`).digest("base64");
  return sig.split(" ").some((partie) => {
    const valeur = partie.split(",")[1] ?? "";
    try {
      const a = Buffer.from(valeur);
      const b = Buffer.from(attendu);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const corps = await req.text();
  if (!secret) {
    return NextResponse.json(
      { error: "RESEND_WEBHOOK_SECRET absent : poser la variable dans Vercel puis redeployer" },
      { status: 503 },
    );
  }
  if (!verifieSvix(req, corps, secret)) {
    return NextResponse.json({ error: "signature invalide" }, { status: 401 });
  }

  let evt: { type?: string; data?: Record<string, unknown> };
  try {
    evt = JSON.parse(corps);
  } catch {
    return NextResponse.json({ error: "json invalide" }, { status: 400 });
  }
  const type = String(evt.type ?? "");
  if (!type.startsWith("email.")) return NextResponse.json({ ok: true, ignore: true });

  const d = evt.data ?? {};
  const destinataires = Array.isArray(d.to) ? (d.to as unknown[]).map(String) : [];
  await insereEvenements([
    {
      type: "email",
      nom: type, // email.sent | email.delivered | email.opened | email.clicked | email.bounced...
      props: {
        sujet: String(d.subject ?? "").slice(0, 200),
        destinataires: destinataires.slice(0, 5).join(", ").slice(0, 300),
        email_id: String(d.email_id ?? d.id ?? "").slice(0, 80),
        lien: String((d as { click?: { link?: string } }).click?.link ?? "").slice(0, 300),
      },
    },
  ]);
  return NextResponse.json({ ok: true });
}
