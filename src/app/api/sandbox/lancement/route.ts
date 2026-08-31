/**
 * Interrupteur de lancement (Yann 1er sept 2026). Réservé à Yann.
 *
 * GET  -> { mode, env, effectif } : état courant du gating de mettrik.ai.
 * POST { mode: "on" | "off" | "env" } :
 *   - "on"  : mettrik.ai en maintenance, quoi que dise la variable Vercel ;
 *   - "off" : mettrik.ai OUVERT au public, quoi que dise la variable Vercel ;
 *   - "env" : comportement historique (variable MAINTENANCE_MODE).
 * Effet en production sous ~20 s (cache du proxy), sans redéploiement.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";

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

type Programme = { mode: "on" | "off"; quand: string } | null;
type Reglage = { mode: "on" | "off" | "env"; programme: Programme };

async function litReglage(): Promise<Reglage> {
  try {
    const { data } = await admin()
      .from("desk_page_content")
      .select("content_fr")
      .eq("page_key", "maintenance")
      .eq("section_key", "reglages")
      .maybeSingle();
    const brut = data?.content_fr ? JSON.parse(data.content_fr) : null;
    const mode = brut?.mode === "on" || brut?.mode === "off" ? brut.mode : "env";
    const p = brut?.programme;
    const programme: Programme =
      p && (p.mode === "on" || p.mode === "off") && typeof p.quand === "string" && !Number.isNaN(Date.parse(p.quand))
        ? { mode: p.mode, quand: p.quand }
        : null;
    return { mode, programme };
  } catch {
    return { mode: "env", programme: null };
  }
}

export async function GET() {
  if (!(await estProprietaire())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { mode, programme } = await litReglage();
  const env = (process.env.MAINTENANCE_MODE ?? "").toLowerCase();
  const envOn = env === "on" || env === "true" || env === "1";
  // Meme logique que le proxy : un programme echu remplace le mode courant.
  let modeEffectif: "on" | "off" | "env" = mode;
  if (programme && Date.now() >= Date.parse(programme.quand)) {
    modeEffectif = programme.mode;
  }
  const effectif = modeEffectif === "on" ? true : modeEffectif === "off" ? false : envOn;
  return NextResponse.json({
    mode,
    programme,
    variable_env: envOn ? "on" : "off",
    maintenance_effective: effectif,
    niveaux: {
      n0: "https://mettrik.ai",
      n1: "https://mettrik-niveau1.vercel.app",
      n2: "https://mettrik-niveau2.vercel.app",
    },
  });
}

export async function POST(req: NextRequest) {
  if (!(await estProprietaire())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let corps: { mode?: unknown; programme?: unknown };
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const mode = corps.mode;
  if (mode !== "on" && mode !== "off" && mode !== "env") {
    return NextResponse.json({ error: "mode invalide (on | off | env)" }, { status: 400 });
  }
  // programme : { mode, quand } pour une bascule a heure fixe, null pour annuler.
  let programme: Programme = null;
  const p = corps.programme as { mode?: unknown; quand?: unknown } | null | undefined;
  if (p && typeof p === "object") {
    if (
      (p.mode === "on" || p.mode === "off") &&
      typeof p.quand === "string" &&
      !Number.isNaN(Date.parse(p.quand))
    ) {
      if (Date.parse(p.quand) < Date.now() - 60_000) {
        return NextResponse.json({ error: "programme dans le passe" }, { status: 400 });
      }
      programme = { mode: p.mode, quand: p.quand };
    } else {
      return NextResponse.json({ error: "programme invalide ({mode, quand ISO})" }, { status: 400 });
    }
  }
  const { error } = await admin()
    .from("desk_page_content")
    .upsert(
      {
        page_key: "maintenance",
        section_key: "reglages",
        content_fr: JSON.stringify({ mode, programme }),
      },
      { onConflict: "page_key,section_key" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, mode, programme, delai: "effet sous ~20 secondes" });
}
