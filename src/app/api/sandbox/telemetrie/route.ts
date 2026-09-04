/**
 * Tableau de bord télémétrie : agrégats + interrupteur (Yann 31 août 2026).
 * Réservé à Yann (DESK_OWNER_EMAIL).
 *
 * GET ?heures=24|168|720 -> métriques agrégées sur la fenêtre.
 * POST { actif } -> interrupteur global de collecte.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import {
  chargeReglageTelemetrie,
  enregistreReglageTelemetrie,
} from "@/lib/desk/telemetrie-store";

export const dynamic = "force-dynamic";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function estProprietaire(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    return !!data.user && data.user.email === DESK_OWNER_EMAIL;
  } catch {
    return false;
  }
}

type Ligne = {
  ts: string;
  type: string;
  nom: string;
  session_id: string | null;
  user_id: string | null;
  chemin: string | null;
  pays: string | null;
  appareil: string | null;
  navigateur: string | null;
  os: string | null;
  duree_ms: number | null;
  ip_hash: string | null;
  props: Record<string, unknown>;
};

const compte = (lignes: Ligne[], cle: (l: Ligne) => string | null | undefined, max = 12) => {
  const c = new Map<string, number>();
  for (const l of lignes) {
    const k = cle(l);
    if (k) c.set(k, (c.get(k) ?? 0) + 1);
  }
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, max);
};

const percentile = (valeurs: number[], p: number) => {
  if (!valeurs.length) return null;
  const tri = [...valeurs].sort((a, b) => a - b);
  return tri[Math.min(tri.length - 1, Math.floor((p / 100) * tri.length))];
};

export async function GET(req: NextRequest) {
  if (!(await estProprietaire())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const heures = Math.min(720, Math.max(1, Number(req.nextUrl.searchParams.get("heures")) || 24));
  const depuis = new Date(Date.now() - heures * 3600_000).toISOString();

  const { data, error } = await admin()
    .from("telemetrie_evenements")
    .select("ts,type,nom,session_id,user_id,chemin,pays,appareil,navigateur,os,duree_ms,ip_hash,props,referrer")
    .gte("ts", depuis)
    .order("ts", { ascending: false })
    .limit(20000);
  if (error) {
    const tableAbsente = /relation .* does not exist|Could not find the table/i.test(error.message);
    return NextResponse.json(
      { error: tableAbsente ? "table_absente" : error.message },
      { status: tableAbsente ? 424 : 500 },
    );
  }
  const lignes = (data ?? []) as Ligne[];

  const pages = lignes.filter((l) => l.type === "page");
  const apis = lignes.filter((l) => l.type === "api" && l.duree_ms != null);
  const emails = lignes.filter((l) => l.type === "email");
  const scrolls = lignes.filter((l) => l.type === "scroll");
  const durees = pages.map((l) => l.duree_ms ?? 0).filter((v) => v > 0);
  const scrollPcts = scrolls
    .map((l) => Number((l.props as { pct?: number })?.pct))
    .filter((v) => Number.isFinite(v));

  // Serie horaire des pages vues (pour la petite courbe).
  const pas = heures <= 48 ? 3600_000 : 24 * 3600_000;
  const serie = new Map<number, number>();
  for (const l of pages) {
    const t = Math.floor(new Date(l.ts).getTime() / pas) * pas;
    serie.set(t, (serie.get(t) ?? 0) + 1);
  }

  return NextResponse.json({
    actif: await chargeReglageTelemetrie(),
    fenetre_heures: heures,
    evenements: lignes.length,
    tronque: lignes.length >= 20000,
    visiteurs: new Set(lignes.map((l) => l.session_id).filter(Boolean)).size,
    visiteurs_ip: new Set(lignes.map((l) => l.ip_hash).filter(Boolean)).size,
    connectes: new Set(lignes.map((l) => l.user_id).filter(Boolean)).size,
    pages_vues: pages.length,
    duree_moyenne_s: durees.length ? Math.round(durees.reduce((a, b) => a + b, 0) / durees.length / 1000) : null,
    scroll_moyen_pct: scrollPcts.length ? Math.round(scrollPcts.reduce((a, b) => a + b, 0) / scrollPcts.length) : null,
    top_pages: compte(pages, (l) => l.chemin),
    top_clics: compte(lignes.filter((l) => l.type === "clic"), (l) => l.nom),
    top_pays: compte(lignes, (l) => l.pays, 10),
    // Yann 4 sept 2026 : d ou viennent les visiteurs. Le referent etait
    // collecte depuis le debut mais n etait jamais restitue. On garde le
    // DOMAINE seul, plus lisible qu une adresse entiere, et on nomme
    // explicitement l acces direct.
    top_origines: compte(
      pages,
      (l) => {
        const r = String((l as { referrer?: string | null }).referrer ?? "").trim();
        if (!r) return "Accès direct";
        try {
          const h = new URL(r).hostname.replace(/^www\./, "");
          if (h.endsWith("mettrik.ai")) return "Navigation interne";
          if (/google\./.test(h)) return "Google";
          if (/bing\./.test(h)) return "Bing";
          if (/(twitter|x)\.com$/.test(h)) return "X";
          if (/linkedin\./.test(h)) return "LinkedIn";
          if (/facebook\./.test(h)) return "Facebook";
          if (/reddit\./.test(h)) return "Reddit";
          return h;
        } catch {
          return "Origine inconnue";
        }
      },
      12,
    ),
    appareils: compte(lignes, (l) => l.appareil, 4),
    navigateurs: compte(lignes, (l) => l.navigateur, 6),
    erreurs: compte(lignes.filter((l) => l.type === "erreur"), (l) => l.nom, 10),
    api: {
      appels: apis.length,
      p50_ms: percentile(apis.map((l) => l.duree_ms!), 50),
      p95_ms: percentile(apis.map((l) => l.duree_ms!), 95),
      top_routes: compte(apis, (l) => l.nom, 10),
    },
    emails: {
      total: emails.length,
      par_etat: compte(emails, (l) => l.nom, 8),
    },
    evenements_serveur: compte(lignes.filter((l) => l.type === "serveur"), (l) => l.nom, 10),
    serie_pages: [...serie.entries()].sort((a, b) => a[0] - b[0]),
  });
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
