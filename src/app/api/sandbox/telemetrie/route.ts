/**
 * Tableau de bord télémétrie : agrégats + interrupteur (Yann 31 août 2026).
 * Réservé à Yann (DESK_OWNER_EMAIL).
 *
 * GET -> analytics du site sur une fenetre (voir plus bas).
 * POST { actif } -> interrupteur global de collecte.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { calculeAnalytics, zurichVersUtc } from "@/lib/telemetrie/analytics-site";
import {
  chargeReglageTelemetrie,
  enregistreReglageTelemetrie,
} from "@/lib/desk/telemetrie-store";

export const dynamic = "force-dynamic";

async function estProprietaire(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    return !!data.user && data.user.email === DESK_OWNER_EMAIL;
  } catch {
    return false;
  }
}

/**
 * GET ?du=AAAA-MM-JJTHH:MM&au=...  (heure suisse) &moi=0|1 (1 par defaut :
 * visites de Yann et robots isolees). Ou ?heures=N pour les N dernieres heures.
 * Calcul : src/lib/telemetrie/analytics-site.ts (Yann 15 oct 2026).
 */
export async function GET(req: NextRequest) {
  if (!(await estProprietaire())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const sp = req.nextUrl.searchParams;
  const maintenant = new Date();
  const au = (sp.get("au") && zurichVersUtc(sp.get("au")!)) || maintenant;
  const heures = Math.min(24 * 400, Math.max(1, Number(sp.get("heures")) || 24));
  const du = (sp.get("du") && zurichVersUtc(sp.get("du")!)) || new Date(au.getTime() - heures * 3600_000);
  if (du >= au) return NextResponse.json({ error: "fenetre_invalide" }, { status: 400 });
  try {
    const stats = await calculeAnalytics({ du, au, exclureMoi: sp.get("moi") !== "0" });
    return NextResponse.json({ actif: await chargeReglageTelemetrie(), ...stats }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const tableAbsente = /relation .* does not exist|Could not find the table/i.test(msg);
    return NextResponse.json({ error: tableAbsente ? "table_absente" : msg }, { status: tableAbsente ? 424 : 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await estProprietaire())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let corps: { actif?: unknown };
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const actif = corps.actif !== false;
  await enregistreReglageTelemetrie(actif);
  return NextResponse.json({ ok: true, actif });
}
