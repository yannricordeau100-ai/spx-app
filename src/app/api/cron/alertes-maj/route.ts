import { renderEmailLayout } from "@/lib/email/layout";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculerEtatMisesAJour } from "@/lib/mises-a-jour/etat";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Alerte rouge des mises a jour (Yann 13 sept 2026). Independante des crons de
 * mise a jour : elle ne lit que les donnees. Cron Vercel quotidien + appel par
 * la chaine 23h du Mac. Email au proprietaire quand le rouge change.
 * Auth : ?secret=<CRON_SECRET> ou ?audit_token=<VISUAL_AUDIT_TOKEN> ou Bearer.
 */
function autorise(req: NextRequest): boolean {
  const q = req.nextUrl.searchParams;
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const s = process.env.CRON_SECRET, a = process.env.VISUAL_AUDIT_TOKEN;
  return (!!s && (q.get("secret") === s || bearer === s)) || (!!a && q.get("audit_token") === a);
}
function admin() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }); }

export async function GET(req: NextRequest) {
  if (!autorise(req)) return NextResponse.json({ error: "non autorise" }, { status: 403 });
  const etat = await calculerEtatMisesAJour();
  const resume = etat.blocs.filter((b) => b.rouge > 0).map((b) => `${b.nom} : ${b.rouge} en retard (${b.rouges.slice(0, 6).map((r) => r.ticker).join(", ")}${b.rouge > 6 ? "…" : ""})`);
  const empreinte = etat.blocs.map((b) => `${b.id}:${b.rouges.map((r) => r.ticker).join("|")}`).join(";");
  const sb = admin();
  let precedente = "";
  try {
    const { data } = await sb.from("desk_page_content").select("content_fr").eq("page_key", "alertes_maj").eq("section_key", "empreinte").maybeSingle();
    precedente = data?.content_fr ?? "";
  } catch { /* premiere execution */ }
  const contenu = { calculeLe: etat.calculeLe, rougesTotal: etat.rougesTotal, stesRouges: etat.stesRouges, resume, blocs: etat.blocs.map((b) => ({ id: b.id, nom: b.nom, vert: b.vert, orange: b.orange, rouge: b.rouge, rouges: b.rouges.slice(0, 40) })) };
  await sb.from("desk_page_content").upsert({ page_key: "alertes_maj", section_key: "etat", content_fr: JSON.stringify(contenu) }, { onConflict: "page_key,section_key" });
  let email: string = "non envoyé";
  const doitEnvoyer = etat.rougesTotal > 0 && empreinte !== precedente && req.nextUrl.searchParams.get("email") !== "0";
  if (doitEnvoyer && process.env.RESEND_API_KEY && process.env.DESK_OWNER_EMAIL) {
    const corps = `<p><strong>${etat.rougesTotal} bloc(s) de fiche en retard (J+3 dépassé)</strong>, ${etat.stesRouges.length} société(s).</p><ul>${resume.map((l) => `<li>${l}</li>`).join("")}</ul><p>Détail : https://mettrik-niveau2.vercel.app/sandbox/mises-a-jour</p><p>Claude corrige les blocs rouges en début de session.</p>`;
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Mettrik alertes <noreply@mettrik.ai>", to: [process.env.DESK_OWNER_EMAIL], subject: `ALERTE ROUGE : ${etat.rougesTotal} bloc(s) de fiche en retard`, html: renderEmailLayout({ locale: "fr", preheader: `${etat.rougesTotal} bloc(s) de fiche en retard`, title: "Mises à jour des fiches : blocs en retard", bodyHtml: corps }) }) });
    email = r.ok ? "envoyé" : `échec ${r.status}`;
    if (r.ok) await sb.from("desk_page_content").upsert({ page_key: "alertes_maj", section_key: "empreinte", content_fr: empreinte }, { onConflict: "page_key,section_key" });
  } else if (etat.rougesTotal > 0 && empreinte === precedente) email = "inchangé, déjà notifié";
  return NextResponse.json({ ok: true, rougesTotal: etat.rougesTotal, stesRouges: etat.stesRouges.length, resume, email });
}
