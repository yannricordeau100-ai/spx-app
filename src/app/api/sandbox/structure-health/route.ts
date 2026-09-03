/**
 * Feux de sante de la structure du site (Yann 3 sept 2026).
 * Reserve au proprietaire (ou au jeton d audit visuel). Chaque controle renvoie
 * vert / orange / rouge / gris (non testable ici) avec une explication en clair.
 */
import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import inventaire from "@/data/_structure-map.json";

export const dynamic = "force-dynamic";
type Feu = "vert" | "orange" | "rouge" | "gris";
type Controle = { id: string; feu: Feu; libelle: string; detail: string };

async function autorise(req: NextRequest): Promise<boolean> {
  const jeton = req.nextUrl.searchParams.get("audit_token");
  if (jeton && process.env.VISUAL_AUDIT_TOKEN && jeton === process.env.VISUAL_AUDIT_TOKEN) return true;
  try {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    return !!user?.email && user.email === DESK_OWNER_EMAIL;
  } catch { return false; }
}

const ROOT = process.cwd();
async function existe(p: string) { try { await fs.access(path.join(ROOT, p)); return true; } catch { return false; } }
async function compte(dir: string) { try { return (await fs.readdir(path.join(ROOT, dir))).filter((f) => f.endsWith(".json")).length; } catch { return 0; } }
async function lit<T>(p: string): Promise<T | null> { try { return JSON.parse(await fs.readFile(path.join(ROOT, p), "utf8")) as T; } catch { return null; } }
function ageH(iso?: string | null) { if (!iso) return null; const t = Date.parse(iso); return Number.isNaN(t) ? null : (Date.now() - t) / 3.6e6; }
async function ping(url: string, init?: RequestInit, ms = 6000): Promise<number> {
  try { const r = await fetch(url, { ...init, signal: AbortSignal.timeout(ms), cache: "no-store" }); return r.status; } catch { return 0; }
}

export async function GET(req: NextRequest) {
  if (!(await autorise(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const c: Controle[] = [];
  const env = (k: string) => !!process.env[k];

  // Services externes
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""; const srk = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const sbCode = sbUrl && srk ? await ping(`${sbUrl}/rest/v1/desk_page_content?select=id&limit=1`, { headers: { apikey: srk, Authorization: `Bearer ${srk}` } }) : 0;
  c.push({ id: "supabase", feu: sbCode === 200 ? "vert" : "rouge", libelle: "Supabase joignable (comptes, base)", detail: sbCode === 200 ? "réponse 200" : `code ${sbCode}` });
  c.push({ id: "supabase_env", feu: env("NEXT_PUBLIC_SUPABASE_URL") && env("NEXT_PUBLIC_SUPABASE_ANON_KEY") && env("SUPABASE_SERVICE_ROLE_KEY") ? "vert" : "rouge", libelle: "Variables Supabase présentes", detail: "" });
  const sk = process.env.STRIPE_SECRET_KEY ?? "";
  const stCode = sk ? await ping("https://api.stripe.com/v1/prices?limit=1&active=true", { headers: { Authorization: `Bearer ${sk}` } }) : 0;
  c.push({ id: "stripe", feu: stCode === 200 ? (sk.startsWith("sk_live") ? "vert" : "orange") : "rouge", libelle: "Stripe joignable avec la clé", detail: stCode === 200 ? (sk.startsWith("sk_live") ? "clé live" : "clé de TEST") : `code ${stCode}` });
  c.push({ id: "stripe_webhook_secret", feu: env("STRIPE_WEBHOOK_SECRET") && !String(process.env.STRIPE_WEBHOOK_SECRET).includes("TODO") ? "vert" : "rouge", libelle: "Secret du webhook Stripe", detail: "" });
  const rk = process.env.RESEND_API_KEY ?? "";
  const rsCode = rk ? await ping("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${rk}` } }) : 0;
  c.push({ id: "resend", feu: rsCode === 200 ? "vert" : rk ? "orange" : "rouge", libelle: "Resend (emails) : clé présente et acceptée", detail: rk ? `code ${rsCode}` : "clé absente dans cet environnement : aucun email ne part" });
  c.push({ id: "turnstile", feu: env("TURNSTILE_SECRET_KEY") ? "vert" : "orange", libelle: "Captcha du formulaire de contact", detail: env("TURNSTILE_SECRET_KEY") ? "" : "sans clé : contact accepté sans captcha" });
  const cleCaptcha = env("NEXT_PB_HCAPTCHA_SITE_KEY") || env("NEXT_PUBLIC_HCAPTCHA_SITE_KEY");
  c.push({ id: "hcaptcha", feu: cleCaptcha ? "vert" : "orange", libelle: "Captcha d'inscription (hCaptcha)", detail: cleCaptcha ? "" : "clé absente : inscription sans anti-robots" });
  c.push({ id: "cron_secret", feu: env("CRON_SECRET") ? "vert" : "orange", libelle: "Secret des robots Vercel", detail: "" });
  c.push({ id: "github_dispatch", feu: env("GITHUB_DISPATCH_TOKEN") ? "vert" : "orange", libelle: "Jeton des robots GitHub", detail: "" });
  c.push({ id: "desk_owner", feu: env("DESK_OWNER_EMAIL") && env("DESK_SLUG") ? "vert" : "rouge", libelle: "Propriétaire et URL du desk définis", detail: "" });

  // Donnees
  const uni = await lit<{ tickers: string[] }>("src/data/v1-9-5-clean-all-tickers.json");
  c.push({ id: "fichier_univers", feu: uni && uni.tickers?.length > 600 ? "vert" : "rouge", libelle: "Liste des sociétés en ligne", detail: `${uni?.tickers?.length ?? 0} tickers` });
  const nPipe = await compte("src/data/v2-pipeline"); const nEnr = await compte("src/data/v2-pipeline-enrich");
  // kpis-haut n est embarque que dans les fonctions des pages societe (tracing par route) :
  // la preuve de presence en ligne est le rendu d une fiche (controle fiche_aapl).
  const nHaut = ((inventaire as { compteurs?: { fiches?: number } }).compteurs?.fiches ?? 0) > 0 ? (await compte(".batches-drafts-safe/kpis-haut")) || -1 : 0;
  c.push({ id: "donnees_pipeline", feu: nPipe > 600 ? "vert" : "rouge", libelle: "Fiches de données embarquées", detail: `${nPipe} fichiers` });
  c.push({ id: "donnees_enrich", feu: nEnr > 100 ? "vert" : "orange", libelle: "Enrichissements embarqués", detail: `${nEnr} fichiers` });
  c.push({ id: "donnees_haut", feu: nHaut > 300 ? "vert" : nHaut === -1 ? "gris" : "rouge", libelle: "Indicateurs en tête embarqués", detail: nHaut === -1 ? "dossier lu par les pages société (non visible d ici) : vérifié via le rendu d une fiche" : `${nHaut} fichiers` });

  // Automates (statuts commites)
  const w = await lit<{ last_run_at?: string; docs_downloaded_last_run?: number }>("src/data/_daily-doc-watcher-status.json");
  const aw = ageH(w?.last_run_at);
  c.push({ id: "watcher_us", feu: aw == null ? "gris" : aw < 36 ? "vert" : aw < 96 ? "orange" : "rouge", libelle: "Veille des rapports US", detail: aw == null ? "statut absent" : `dernier passage il y a ${aw.toFixed(0)} h` });
  const fw = await lit<Record<string, unknown>>("src/data/_fr-doc-watcher-status.json");
  let fwDate: string | null = null;
  const chercheDates = (o: unknown) => { if (typeof o === "string" && /^\d{4}-\d{2}-\d{2}T/.test(o)) { if (!fwDate || o > fwDate) fwDate = o; } else if (o && typeof o === "object") for (const v of Object.values(o as Record<string, unknown>)) chercheDates(v); };
  chercheDates(fw);
  const af = ageH(fwDate);
  c.push({ id: "watcher_eu", feu: af == null ? "gris" : af < 36 ? "vert" : af < 96 ? "orange" : "rouge", libelle: "Veille des pages investisseurs Europe", detail: af == null ? "statut absent" : `dernier passage il y a ${af.toFixed(0)} h` });
  const bilan = await lit<{ date?: string; traite?: string; dossiers_prepares?: string }>(".conv-state/earnings-refresh-dernier-bilan.json");
  const etat = await lit<Record<string, { at?: string; statut?: string }>>(".conv-state/earnings-refresh-state.json");
  let dernier: string | null = null; let traites = 0;
  if (etat) for (const v of Object.values(etat)) { if (v?.at && (!dernier || v.at > dernier)) dernier = v.at; if (v?.statut === "traite") traites++; }
  const ac = ageH(dernier);
  const traiteBilan = bilan?.traite && /^\d+$/.test(bilan.traite) ? Number(bilan.traite) : null;
  c.push({ id: "cron_23h", feu: traiteBilan === 0 ? "rouge" : ac == null ? "gris" : ac < 36 ? "vert" : ac < 96 ? "orange" : "rouge", libelle: "Mise à jour des sociétés (23h)", detail: traiteBilan === 0 ? `dernière passe : 0 société traitée (${bilan?.date})` : ac == null ? "tourne sur le Mac de Yann : état non visible depuis le site (journal /tmp/earnings-refresh.log)" : `dernier point écrit il y a ${ac.toFixed(0)} h, ${traites} sociétés traitées au dernier passage` });
  const rel = await lit<{ genere_le?: string; bilan?: { rouge?: number; orange?: number; vert?: number } }>("src/data/_release-check.json");
  const ar = ageH(rel?.genere_le);
  c.push({ id: "release_check", feu: !rel ? "gris" : (rel.bilan?.rouge ?? 0) > 0 ? "rouge" : (rel.bilan?.orange ?? 0) > 0 ? "orange" : "vert", libelle: "Dernier contrôle avant ouverture", detail: rel ? `${rel.bilan?.vert ?? 0} verts, ${rel.bilan?.orange ?? 0} oranges, ${rel.bilan?.rouge ?? 0} rouges, il y a ${ar?.toFixed(0) ?? "?"} h` : "jamais lancé" });

  // Site (auto-test des pages publiques du meme deploiement)
  const origine = req.nextUrl.origin;
  const pages: [string, string, string][] = [["site_niveau2", "/api/billing/health", "Ce déploiement répond"], ["home_index", "/", "Page d'accueil"], ["fiche_aapl", "/sandbox/v1-9-5/aapl", "Une fiche société (Apple) sans compte"], ["tarifs_page", "/pricing", "Page des tarifs"], ["faq_page", "/faq", "FAQ"], ["legal_page", "/legal/mentions", "Mentions légales"], ["og_kpi", "/api/og/kpi/aapl/00000", "Carte image de partage (repli)"], ["prix", "/api/stock-prices?symbols=AAPL", "Cours de bourse (Yahoo)"]];
  await Promise.all(pages.map(async ([id, p, lib]) => { const code = await ping(origine + p, undefined, 12000); c.push({ id, feu: code === 200 ? "vert" : code === 0 ? "rouge" : "orange", libelle: lib, detail: `HTTP ${code}` }); }));
  const n0 = await ping("https://mettrik.ai/api/billing/health", undefined, 8000);
  c.push({ id: "site_n0", feu: n0 === 200 ? "vert" : n0 === 307 || n0 === 503 ? "orange" : "rouge", libelle: "Site public mettrik.ai répond", detail: `HTTP ${n0}${n0 !== 200 ? " (maintenance ou indisponible)" : ""}` });

  const compteur = { vert: 0, orange: 0, rouge: 0, gris: 0 };
  for (const x of c) compteur[x.feu]++;
  return NextResponse.json({ genere_le: new Date().toISOString(), compteur, controles: c }, { headers: { "cache-control": "no-store" } });
}
