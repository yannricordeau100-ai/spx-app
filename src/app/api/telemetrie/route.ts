/**
 * Ingestion de la télémétrie première partie (Yann 31 août 2026).
 *
 * GET  -> { actif } : interrupteur global lu par le collecteur client.
 * POST -> { evenements: [...] } : lot d'événements, enrichi côté serveur
 *         (pays via l'en-tête Vercel, hachage de l'IP, user_id de session).
 *
 * La télémétrie ne renvoie jamais d'erreur bloquante au client : au pire un
 * lot se perd, la page ne doit jamais en souffrir.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  hacheIp,
  insereEvenements,
  nettoieEvenement,
  type EvenementTelemetrie,
} from "@/lib/telemetrie/serveur";
import { chargeReglageTelemetrie } from "@/lib/desk/telemetrie-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const actif = await chargeReglageTelemetrie();
  return NextResponse.json({ actif }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const actif = await chargeReglageTelemetrie();
  if (!actif) return NextResponse.json({ ok: true, ignore: true });

  let corps: { evenements?: unknown[] };
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const bruts = Array.isArray(corps.evenements) ? corps.evenements.slice(0, 50) : [];
  const evts = bruts
    .map(nettoieEvenement)
    .filter((e): e is EvenementTelemetrie => e !== null);
  if (!evts.length) return NextResponse.json({ ok: true, recus: 0 });

  // Enrichissement serveur : pays (edge Vercel), IP hachee, user connecte.
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const pays = req.headers.get("x-vercel-ip-country");
  let userId: string | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch { /* visiteur anonyme */ }

  for (const e of evts) {
    e.pays = pays ?? null;
    e.ip_hash = ip ? hacheIp(ip) : null;
    e.user_id = userId;
  }
  const ok = await insereEvenements(evts);
  return NextResponse.json({ ok, recus: evts.length });
}
