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
import { chargeConfigTelemetrie, chargeReglageTelemetrie, type ConfigTelemetrie } from "@/lib/desk/telemetrie-store";
import { COOKIE_PROPRIO, COOKIE_PROPRIO_DUREE_S, familleClient, villeDepuisEntete } from "@/lib/telemetrie/proprietaire";

export const dynamic = "force-dynamic";

/** Compte de Yann (proprietaire, comptes internes, comptes exclus en base). */
function compteProprio(email: string | null, userId: string | null, config: ConfigTelemetrie): boolean {
  const owner = process.env.DESK_OWNER_EMAIL?.toLowerCase();
  const mail = (email ?? "").toLowerCase();
  return (!!mail && (mail === owner || mail.endsWith("@mettrik-internal.test"))) || (!!userId && config.usersExclus.includes(userId));
}

/** Cookie « mtk_owner » (Yann 15 oct 2026) : pose a chaque visite connectee
 *  en proprietaire, il continue d isoler l appareil une fois deconnecte. */
function poseCookieProprio(res: NextResponse) {
  res.cookies.set(COOKIE_PROPRIO, "1", { maxAge: COOKIE_PROPRIO_DUREE_S, path: "/", sameSite: "lax", secure: true, httpOnly: true });
}

export async function GET(req: NextRequest) {
  const actif = await chargeReglageTelemetrie();
  const res = NextResponse.json({ actif }, { headers: { "cache-control": "no-store" } });
  // Lecture de session seulement si un cookie Supabase est present (pas
  // d appel d authentification pour un visiteur anonyme).
  if (req.cookies.getAll().some((c) => c.name.startsWith("sb-"))) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase.auth.getUser();
      if (data.user && compteProprio(data.user.email ?? null, data.user.id, await chargeConfigTelemetrie())) poseCookieProprio(res);
    } catch { /* jamais bloquant */ }
  }
  return res;
}

export async function POST(req: NextRequest) {
  const config = await chargeConfigTelemetrie();
  if (!config.actif) return NextResponse.json({ ok: true, ignore: true });

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
  let userEmail: string | null = null;
  let opposition = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
    userEmail = data.user?.email ?? null;
    // Yann 13 oct 2026 : « Ne plus mesurer mon activité » (page compte).
    opposition = data.user?.user_metadata?.mesure_activite === "refusee";
  } catch { /* visiteur anonyme */ }
  if (opposition) return NextResponse.json({ ok: true, ignore: true, opposition: true });

  // Yann 15 oct 2026 : les visites de Yann, de ses comptes et des outils
  // automatiques ne sont plus jetees mais ETIQUETEES, puis isolees par
  // l analytics (interrupteur « Exclure mes visites », retroactif).
  // Etiquettes : _moi = compte | ip | cookie ; _client = robot | x.
  const hash = ip ? hacheIp(ip) : null;
  const moi = compteProprio(userEmail, userId, config)
    ? "compte"
    : hash && config.hashesExclus.includes(hash)
      ? "ip"
      : req.cookies.get(COOKIE_PROPRIO)?.value
        ? "cookie"
        : null;
  const ua = req.headers.get("user-agent");
  const ville = villeDepuisEntete(req.headers.get("x-vercel-ip-city"));

  for (const e of evts) {
    const p = (e.props ??= {});
    const client = familleClient(ua, p.wd);
    delete p.wd;
    if (moi) p._moi = moi;
    if (client) p._client = client;
    if (ville) p.ville = ville;
    e.pays = pays ?? null;
    e.ip_hash = hash;
    e.user_id = userId;
  }
  const ok = await insereEvenements(evts);
  const res = NextResponse.json({ ok, recus: evts.length });
  if (moi === "compte") poseCookieProprio(res);
  return res;
}
