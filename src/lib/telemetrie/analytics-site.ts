/**
 * Analytics du site (page /sandbox/telemetrie), Yann 15 oct 2026.
 *
 *  - fenêtre du … au … saisie en heure suisse (Europe/Zurich), appliquée à
 *    toutes les vues ;
 *  - « Exclure mes visites » (actif par défaut) : isole à la LECTURE toute
 *    visite de Yann (comptes, IP hachées en base, cookie mtk_owner) et des
 *    outils automatiques (agent utilisateur). Rétroactif, rien n est supprimé ;
 *  - origine à l arrivée (X, Google, LinkedIn, lien direct, autres sites),
 *    utm, parcours, durée, rebond, nouveaux et revenants, pays et ville,
 *    appareils, conversion par origine, courbes horaires ;
 *  - indicateurs SaaS mesurables avec nos seules données (aucun outil tiers).
 *
 * Module SERVEUR uniquement (service role).
 */
import { createClient } from "@supabase/supabase-js";
import NOMS from "@/data/v1-9-5-names.json";
import { ticker_canonique } from "@/lib/ticker-aliases";
import { ficheServie } from "@/lib/univers-actif";
import { chargeConfigTelemetrie } from "@/lib/desk/telemetrie-store";

export const TZ = "Europe/Zurich";
const JOUR = 86_400_000;
const MAX_LIGNES = 60_000;

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------- heure suisse
const FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
function parts(d: Date) {
  const o: Record<string, string> = {};
  for (const p of FMT.formatToParts(d)) o[p.type] = p.value;
  return o;
}
/** « AAAA-MM-JJ HH:MM » en heure suisse. */
export function zurich(d: Date | string | number): string {
  const o = parts(new Date(d));
  return `${o.year}-${o.month}-${o.day} ${o.hour}:${o.minute}`;
}
/** Heure murale suisse « AAAA-MM-JJTHH:MM » -> instant UTC. */
export function zurichVersUtc(mur: string): Date | null {
  const m = mur.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  const voulu = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let t = voulu;
  for (let i = 0; i < 2; i++) {
    const o = parts(new Date(t));
    const vu = Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute);
    t += voulu - vu;
  }
  return new Date(t);
}

// ---------------------------------------------------------------- types
type Props = Record<string, unknown>;
type Ligne = {
  ts: string; type: string; nom: string; session_id: string | null; user_id: string | null; chemin: string | null;
  referrer: string | null; pays: string | null; appareil: string | null; navigateur: string | null; os: string | null;
  duree_ms: number | null; ip_hash: string | null; props: Props | null;
};
export type Duo = [string, number];

export type Visite = {
  id: string; debut: string; fin: string; origine: string; detail: string | null; utm_source: string | null; utm_campaign: string | null;
  arrivee: string; parcours: string[]; pages: number; duree_s: number; rebond: boolean; revenant: boolean;
  pays: string | null; ville: string | null; appareil: string | null; connecte: boolean;
};

// ---------------------------------------------------------------- origine
const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const PROPRES = /(^|\.)mettrik\.ai$|vercel\.app$|^localhost/;

export function origineDe(p: Props, referrer: string | null): { cat: string; detail: string | null } {
  const src = (str(p.arr_utm_source) ?? str(p.utm_source) ?? "").toLowerCase().trim();
  if (src) {
    if (/^(x|twitter|tw|t\.co|x\.com|twitter\.com)$/.test(src)) return { cat: "X", detail: null };
    if (/google/.test(src)) return { cat: "Google", detail: null };
    if (/linkedin|^li$|lnkd/.test(src)) return { cat: "LinkedIn", detail: null };
    return { cat: "Autres sites", detail: src };
  }
  if (p._client === "x") return { cat: "X", detail: "appli X" };
  const ref = str(p.arr_ref) ?? referrer;
  if (!ref) return { cat: "Lien direct", detail: null };
  let h = "";
  try { h = new URL(ref).hostname.replace(/^www\./, "").toLowerCase(); } catch { return { cat: "Lien direct", detail: null }; }
  if (h === "t.co" || /(^|\.)(x|twitter)\.com$/.test(h)) return { cat: "X", detail: h };
  if (/(^|\.)google\./.test(h)) return { cat: "Google", detail: null };
  if (/(^|\.)linkedin\.com$|^lnkd\.in$/.test(h)) return { cat: "LinkedIn", detail: null };
  if (PROPRES.test(h)) return { cat: "Lien direct", detail: null };
  return { cat: "Autres sites", detail: h };
}

// ---------------------------------------------------------------- fiches
const NOMS_MAP = NOMS as Record<string, string>;
/** Pages du site qui ne sont pas des fiches société. */
const ROUTES = new Set(["account", "pricing", "login", "signup", "favorites", "faq", "contact", "legal", "partenaires", "parrainage", "maintenance", "sandbox", "concepts", "admin", "k", "auth", "mes-societes", "whoami", "verification-admin", "populaire-investisseurs", "chart-lab", "email-lab", "api", "desk-mtk9x4kp"]);
function tickerDuChemin(chemin: string | null): string | null {
  const m = (chemin ?? "").match(/^\/([A-Za-z0-9.\-]{1,12})$/);
  if (!m || ROUTES.has(m[1].toLowerCase())) return null;
  const t = ticker_canonique(m[1].toUpperCase());
  return ficheServie(t) && (NOMS_MAP[t] || NOMS_MAP[t.replace(/-/g, ".")] || NOMS_MAP[t.replace(/\./g, "-")]) ? t : null;
}
const nomDe = (t: string) => NOMS_MAP[t] ?? NOMS_MAP[t.replace(/-/g, ".")] ?? NOMS_MAP[t.replace(/\./g, "-")] ?? t;

// ---------------------------------------------------------------- lectures
async function lisFenetre(du: Date, au: Date, colonnes: string, filtre?: (q: any) => any): Promise<{ lignes: any[]; tronque: boolean }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const sb = admin();
  const out: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (let page = 0; page * 1000 < MAX_LIGNES; page++) {
    let q = sb.from("telemetrie_evenements").select(colonnes).gte("ts", du.toISOString()).lt("ts", au.toISOString());
    if (filtre) q = filtre(q);
    const { data, error } = await q.order("ts", { ascending: true }).range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return { lignes: out, tronque: false };
  }
  return { lignes: out, tronque: true };
}

type Compte = { id: string; email: string | null; cree: string; derniere_connexion: string | null };
async function comptes(): Promise<Compte[]> {
  const sb = admin();
  const out: Compte[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    out.push(...data.users.map((u) => ({ id: u.id, email: u.email ?? null, cree: u.created_at, derniere_connexion: u.last_sign_in_at ?? null })));
    if (data.users.length < 1000) break;
  }
  return out;
}

type Abo = { sub: string; client: string | null; statut: string; mensuel: number; devise: string; essai: boolean; ts: number; annule: number | null; cree: number };
/** Historique des abonnements Stripe reçus par le webhook (billing_events). */
async function abonnements(): Promise<{ etats: Abo[]; payes: Array<{ sub: string | null; client: string | null; ts: number; montant: number }>; clientVersUser: Map<string, string> }> {
  const sb = admin();
  const [{ data: ev }, { data: subs }] = await Promise.all([
    sb.from("billing_events").select("type,payload,received_at").in("type", [
      "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.paid",
    ]).order("received_at", { ascending: true }).limit(5000),
    sb.from("subscriptions").select("user_id,stripe_customer_id"),
  ]);
  const clientVersUser = new Map<string, string>();
  for (const s of (subs ?? []) as Array<{ user_id: string | null; stripe_customer_id: string | null }>) {
    if (s.user_id && s.stripe_customer_id) clientVersUser.set(s.stripe_customer_id, s.user_id);
  }
  const etats: Abo[] = [];
  const payes: Array<{ sub: string | null; client: string | null; ts: number; montant: number }> = [];
  for (const e of (ev ?? []) as Array<{ type: string; payload: any; received_at: string }>) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const o = e.payload?.data?.object ?? {};
    const ts = new Date(e.received_at).getTime();
    if (e.type === "invoice.paid") {
      if ((o.amount_paid ?? 0) > 0) payes.push({ sub: o.subscription ?? null, client: o.customer ?? null, ts, montant: o.amount_paid / 100 });
      continue;
    }
    const plan = o.plan ?? o.items?.data?.[0]?.plan ?? {};
    const qte = o.quantity ?? o.items?.data?.[0]?.quantity ?? 1;
    const montant = ((plan.amount ?? 0) / 100) * qte;
    const parMois = plan.interval === "year" ? montant / 12 : plan.interval === "week" ? montant * 4.33 : montant / (plan.interval_count || 1);
    etats.push({
      sub: o.id, client: o.customer ?? null, statut: e.type === "customer.subscription.deleted" ? "canceled" : o.status ?? "?",
      mensuel: parMois, devise: String(plan.currency ?? o.currency ?? "").toUpperCase(), essai: o.status === "trialing" || !!o.trial_end,
      ts, annule: o.canceled_at ? o.canceled_at * 1000 : null, cree: (o.created ?? ts / 1000) * 1000,
    });
  }
  return { etats, payes, clientVersUser };
}
/** État de chaque abonnement à l instant t (dernier événement reçu avant t). */
function etatA(etats: Abo[], t: number): Map<string, Abo> {
  const m = new Map<string, Abo>();
  for (const e of etats) if (e.ts <= t) m.set(e.sub, e);
  return m;
}
const ACTIF = new Set(["active", "past_due"]);
function mrr(etat: Map<string, Abo>, filtre?: Set<string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [sub, e] of etat) if (ACTIF.has(e.statut) && (!filtre || filtre.has(sub))) out[e.devise] = (out[e.devise] ?? 0) + e.mensuel;
  return out;
}

// ---------------------------------------------------------------- calcul
const compte = <T,>(xs: T[], cle: (x: T) => string | null | undefined, max = 15): Duo[] => {
  const c = new Map<string, number>();
  for (const x of xs) { const k = cle(x); if (k) c.set(k, (c.get(k) ?? 0) + 1); }
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, max);
};
const mediane = (v: number[]) => { if (!v.length) return null; const t = [...v].sort((a, b) => a - b); return t[Math.floor(t.length / 2)]; };
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);

/** Date (heure suisse) de la plus ancienne donnée de chaque source, affichée sur chaque bloc. */
async function debutsDonnees(): Promise<Record<string, string | null>> {
  const sb = admin();
  const premier = async (f: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const { data } = await f(sb.from("telemetrie_evenements").select("ts")).order("ts", { ascending: true }).limit(1);
    return data?.[0]?.ts ? zurich(data[0].ts).slice(0, 10) : null;
  };
  const [visites, arrivee, ville, problemes, vitaux, kpi, stripe] = await Promise.all([
    premier((q) => q.eq("type", "page")),
    premier((q) => q.eq("type", "page").not("props->>arr_chemin", "is", null)),
    premier((q) => q.not("props->>ville", "is", null)),
    premier((q) => q.eq("type", "erreur").not("props->>cat", "is", null)),
    premier((q) => q.eq("type", "perf").eq("nom", "vitaux")),
    premier((q) => q.eq("type", "clic").eq("nom", "kpi_ouvert")),
    sb.from("billing_events").select("received_at").order("received_at", { ascending: true }).limit(1).then(({ data }) => (data?.[0]?.received_at ? zurich(data[0].received_at).slice(0, 10) : null)),
  ]);
  return { visites, arrivee, ville, problemes, vitaux, kpi, stripe };
}

export async function calculeAnalytics(opts: { du: Date; au: Date; exclureMoi: boolean }) {
  const { du, au, exclureMoi } = opts;
  const config = await chargeConfigTelemetrie();
  const owner = process.env.DESK_OWNER_EMAIL?.toLowerCase();
  const [fen, tousComptes, abos, debuts] = await Promise.all([
    lisFenetre(du, au, "ts,type,nom,session_id,user_id,chemin,referrer,pays,appareil,navigateur,os,duree_ms,ip_hash,props"),
    comptes(),
    abonnements().catch(() => ({ etats: [] as Abo[], payes: [] as Array<{ sub: string | null; client: string | null; ts: number; montant: number }>, clientVersUser: new Map<string, string>() })),
    debutsDonnees().catch(() => ({} as Record<string, string | null>)),
  ]);
  const lignesBrutes = fen.lignes as Ligne[];

  // ---- exclusion de Yann et des robots ----
  const usersMoi = new Set(config.usersExclus);
  for (const c of tousComptes) {
    const m = (c.email ?? "").toLowerCase();
    if (m && (m === owner || m.endsWith("@mettrik-internal.test"))) usersMoi.add(c.id);
  }
  const ipsMoi = new Set(config.hashesExclus);
  const ligneMoi = (l: Ligne) => {
    const p = l.props ?? {};
    return !!p._moi || p._client === "robot" || (!!l.user_id && usersMoi.has(l.user_id)) || (!!l.ip_hash && ipsMoi.has(l.ip_hash));
  };
  const sessionsMoi = new Set<string>();
  for (const l of lignesBrutes) if (l.session_id && ligneMoi(l)) sessionsMoi.add(l.session_id);
  const exclue = (l: Ligne) => (l.session_id ? sessionsMoi.has(l.session_id) : ligneMoi(l));
  const lignes = exclureMoi ? lignesBrutes.filter((l) => !exclue(l)) : lignesBrutes;
  const lignesExclues = lignesBrutes.length - lignes.length;

  // ---- revenants : visiteur (IP hachée) déjà vu avant la visite ----
  const avant = await lisFenetre(new Date(du.getTime() - 180 * JOUR), du, "ip_hash", (q) => q.eq("type", "page").not("ip_hash", "is", null)).catch(() => ({ lignes: [], tronque: false }));
  const dejaVus = new Set<string>((avant.lignes as Array<{ ip_hash: string }>).map((x) => x.ip_hash));

  // ---- visites (sessions) ----
  const parSession = new Map<string, Ligne[]>();
  for (const l of lignes) {
    if (!l.session_id) continue;
    const a = parSession.get(l.session_id);
    if (a) a.push(l); else parSession.set(l.session_id, [l]);
  }
  const visites: Visite[] = [];
  const sessionVersOrigine = new Map<string, string>();
  const userVersOrigine = new Map<string, string>();
  const vuPourRevenant = new Set(dejaVus);
  const ipDeSession = new Map<string, string>();
  for (const [id, ls] of [...parSession.entries()].sort((a, b) => a[1][0].ts.localeCompare(b[1][0].ts))) {
    const pages = ls.filter((l) => l.type === "page");
    if (!pages.length) continue;
    const parcours: string[] = [];
    for (const p of pages) if (p.chemin && parcours[parcours.length - 1] !== p.chemin) parcours.push(p.chemin);
    const p0 = pages[0];
    const pr = p0.props ?? {};
    const o = origineDe(pr, p0.referrer);
    const duree = Math.round(pages.reduce((s, p) => s + Math.min(3_600_000, p.duree_ms ?? 0), 0) / 1000);
    const cle = p0.ip_hash ?? id;
    ipDeSession.set(id, cle);
    const revenant = vuPourRevenant.has(cle);
    vuPourRevenant.add(cle);
    const userId = ls.find((l) => l.user_id)?.user_id ?? null;
    if (userId && !userVersOrigine.has(userId)) userVersOrigine.set(userId, o.cat);
    sessionVersOrigine.set(id, o.cat);
    visites.push({
      id, debut: p0.ts, fin: pages[pages.length - 1].ts, origine: o.cat, detail: o.detail,
      utm_source: str(pr.arr_utm_source) ?? str(pr.utm_source), utm_campaign: str(pr.arr_utm_campaign) ?? str(pr.utm_campaign),
      arrivee: str(pr.arr_chemin) ?? p0.chemin ?? "/", parcours: parcours.slice(0, 30), pages: parcours.length, duree_s: duree,
      // Visite engagée (définition GA4) : 2 pages ou plus, ou 10 s ou plus.
      rebond: parcours.length < 2 && duree < 10, revenant,
      pays: p0.pays, ville: str(pr.ville), appareil: p0.appareil, connecte: !!userId,
    });
  }
  const nV = visites.length;

  // ---- séries horaires (heure suisse) ----
  const pasHeure = au.getTime() - du.getTime() <= 4 * JOUR;
  const serie = new Map<string, number>();
  const parHeureDuJour = Array.from({ length: 24 }, () => 0);
  for (const v of visites) {
    const z = zurich(v.debut);
    const k = pasHeure ? `${z.slice(0, 13)}h` : z.slice(0, 10);
    serie.set(k, (serie.get(k) ?? 0) + 1);
    parHeureDuJour[+z.slice(11, 13)]++;
  }
  // Toutes les cases de la fenêtre, même vides.
  const serieComplete: Duo[] = [];
  for (let t = du.getTime(); t < au.getTime(); t += pasHeure ? 3_600_000 : JOUR) {
    const z = zurich(t);
    const k = pasHeure ? `${z.slice(0, 13)}h` : z.slice(0, 10);
    if (!serieComplete.length || serieComplete[serieComplete.length - 1][0] !== k) serieComplete.push([k, serie.get(k) ?? 0]);
  }

  // ---- sociétés les plus regardées, par jour ----
  const societes = new Map<string, { vues: number; visiteurs: Set<string> }>();
  const societesJour = new Map<string, Map<string, { vues: number; visiteurs: Set<string> }>>();
  for (const v of visites) {
    const jour = zurich(v.debut).slice(0, 10);
    const cleVisiteur = ipDeSession.get(v.id) ?? v.id;
    for (const ch of v.parcours) {
      const t = tickerDuChemin(ch);
      if (!t) continue;
      const g = societes.get(t) ?? { vues: 0, visiteurs: new Set<string>() };
      g.vues++; g.visiteurs.add(cleVisiteur); societes.set(t, g);
      const mj = societesJour.get(jour) ?? new Map();
      const j = mj.get(t) ?? { vues: 0, visiteurs: new Set<string>() };
      j.vues++; j.visiteurs.add(cleVisiteur); mj.set(t, j); societesJour.set(jour, mj);
    }
  }
  const classe = (m: Map<string, { vues: number; visiteurs: Set<string> }>, max: number) =>
    [...m.entries()].sort((a, b) => b[1].vues - a[1].vues || b[1].visiteurs.size - a[1].visiteurs.size).slice(0, max)
      .map(([t, g]) => ({ ticker: t, nom: nomDe(t), vues: g.vues, visiteurs: g.visiteurs.size }));

  // ---- comptes créés (fenêtre, hors Yann) ----
  const nouveaux = tousComptes.filter((c) => {
    const t = new Date(c.cree).getTime();
    return t >= du.getTime() && t < au.getTime() && (!exclureMoi || !usersMoi.has(c.id));
  });
  const comptesParJour = compte(nouveaux, (c) => zurich(c.cree).slice(0, 10), 400).sort((a, b) => a[0].localeCompare(b[0]));

  // ---- conversion par origine ----
  const userDeClient = (c: string | null) => (c ? abos.clientVersUser.get(c) ?? null : null);
  const debutsEssai = abos.etats.filter((e) => e.essai && e.ts >= du.getTime() && e.ts < au.getTime());
  const essaisVus = new Set<string>();
  const essais = debutsEssai.filter((e) => (essaisVus.has(e.sub) ? false : (essaisVus.add(e.sub), true)));
  const paiements = abos.payes.filter((p) => p.ts >= du.getTime() && p.ts < au.getTime());
  const conv = new Map<string, { visites: number; inscriptions: number; essais: number; paiements: number }>();
  const cellule = (k: string) => { const c = conv.get(k) ?? { visites: 0, inscriptions: 0, essais: 0, paiements: 0 }; conv.set(k, c); return c; };
  for (const v of visites) cellule(v.origine).visites++;
  const origineUser = (u: string | null) => (u && userVersOrigine.get(u)) || "Origine inconnue";
  for (const c of nouveaux) cellule(origineUser(c.id)).inscriptions++;
  for (const e of essais) { const u = userDeClient(e.client); if (exclureMoi && u && usersMoi.has(u)) continue; cellule(origineUser(u)).essais++; }
  for (const p of paiements) { const u = userDeClient(p.client); if (exclureMoi && u && usersMoi.has(u)) continue; cellule(origineUser(u)).paiements++; }

  // ---- indicateurs SaaS ----
  const usersHorsMoi = (u: string | null): u is string => !!u && (!exclureMoi || !usersMoi.has(u));
  // Activité des comptes : de 30 jours avant la fin (MAU) jusqu à maintenant (rétention).
  const debutActivite = new Date(Math.min(du.getTime(), au.getTime() - 30 * JOUR));
  const act = await lisFenetre(debutActivite, new Date(Date.now() + 60_000), "ts,type,nom,user_id,chemin", (q) => q.not("user_id", "is", null)).catch(() => ({ lignes: [], tronque: false }));
  const activite = (act.lignes as Array<{ ts: string; type: string; nom: string; user_id: string; chemin: string | null }>).filter((l) => usersHorsMoi(l.user_id));
  const joursActifs = new Map<string, Set<string>>(); // user -> jours suisses
  const premiereValeur = new Map<string, number>(); // user -> instant de la 1re action clé
  const fonctions = new Map<string, Set<string>>();
  const fonctionsN = new Map<string, number>();
  const marque = (f: string, u: string) => { (fonctions.get(f) ?? fonctions.set(f, new Set()).get(f)!).add(u); fonctionsN.set(f, (fonctionsN.get(f) ?? 0) + 1); };
  for (const l of activite) {
    (joursActifs.get(l.user_id) ?? joursActifs.set(l.user_id, new Set()).get(l.user_id)!).add(zurich(l.ts).slice(0, 10));
    const t = new Date(l.ts).getTime();
    let cleF: string | null = null;
    if (l.type === "page" && tickerDuChemin(l.chemin)) cleF = "Fiche société consultée";
    else if (l.type === "clic" && l.nom === "kpi_ouvert") cleF = "KPI ouvert";
    else if (l.type === "serveur" && l.nom === "comparaison") cleF = "Comparaison lancée";
    else if (l.type === "page" && l.chemin === "/favorites") cleF = "Favoris consultés";
    if (cleF) {
      if (t >= du.getTime() && t < au.getTime()) marque(cleF, l.user_id);
      if (!premiereValeur.has(l.user_id)) premiereValeur.set(l.user_id, t);
    }
  }
  const finJour = zurich(au).slice(0, 10);
  const joursAvant = (n: number) => zurich(new Date(au.getTime() - n * JOUR)).slice(0, 10);
  const actifsEntre = (de: string, a: string) => [...joursActifs.entries()].filter(([, js]) => [...js].some((j) => j > de && j <= a)).length;
  const dau = actifsEntre(joursAvant(1), finJour);
  const wau = actifsEntre(joursAvant(7), finJour);
  const mau = actifsEntre(joursAvant(30), finJour);
  // Cohortes : comptes créés dans la fenêtre, revenus le jour J+N (J+1, J+7, J+30).
  const retention = (n: number) => {
    const eligibles = nouveaux.filter((c) => new Date(c.cree).getTime() + n * JOUR <= Date.now());
    const revenus = eligibles.filter((c) => joursActifs.get(c.id)?.has(zurich(new Date(c.cree).getTime() + n * JOUR).slice(0, 10)));
    return { eligibles: eligibles.length, revenus: revenus.length, pct: pct(revenus.length, eligibles.length) };
  };
  const activables = nouveaux.filter((c) => new Date(c.cree).getTime() + 7 * JOUR <= Date.now() || premiereValeur.has(c.id));
  const actives = activables.filter((c) => { const t = premiereValeur.get(c.id); return t != null && t - new Date(c.cree).getTime() <= 7 * JOUR; });
  const delais = nouveaux.map((c) => { const t = premiereValeur.get(c.id); return t == null ? null : Math.max(0, (t - new Date(c.cree).getTime()) / 60_000); }).filter((x): x is number => x != null);

  const etatDebut = etatA(abos.etats, du.getTime());
  const etatFin = etatA(abos.etats, au.getTime());
  const subsDebut = new Set([...etatDebut.entries()].filter(([, e]) => ACTIF.has(e.statut)).map(([s]) => s));
  const mrrDebut = mrr(etatDebut);
  const mrrFin = mrr(etatFin);
  const mrrDebutRetenus = mrr(etatFin, subsDebut);
  const perdus = [...subsDebut].filter((s) => !ACTIF.has(etatFin.get(s)?.statut ?? "")).length;
  const essaisTous = new Set(abos.etats.filter((e) => e.essai && e.cree < au.getTime() && e.cree >= du.getTime()).map((e) => e.sub));
  const essaisPayes = [...essaisTous].filter((s) => abos.payes.some((p) => p.sub === s)).length;
  const nrr: Record<string, number | null> = {};
  for (const d of Object.keys(mrrDebut)) nrr[d] = mrrDebut[d] ? Math.round((1000 * (mrrDebutRetenus[d] ?? 0)) / mrrDebut[d]) / 10 : null;

  const saas = {
    activation: { comptes: activables.length, actives: actives.length, pct: pct(actives.length, activables.length) },
    premiere_valeur_min: mediane(delais),
    retention: { j1: retention(1), j7: retention(7), j30: retention(30) },
    dau, wau, mau, adherence_pct: pct(dau, mau),
    essai_vers_payant: { essais: essaisTous.size, payes: essaisPayes, pct: pct(essaisPayes, essaisTous.size) },
    mrr_debut: mrrDebut, mrr_fin: mrrFin,
    desabonnement: { actifs_debut: subsDebut.size, perdus, pct: pct(perdus, subsDebut.size) },
    nrr_pct: nrr,
    fonctions: [...fonctions.entries()].map(([f, us]) => ({ fonction: f, comptes: us.size, fois: fonctionsN.get(f) ?? 0 })).sort((a, b) => b.comptes - a.comptes),
  };

  // ---- problèmes vus par les visiteurs ----
  const erreurs = lignes.filter((l) => l.type === "erreur");
  const visiteurDe = (l: Ligne) => l.ip_hash ?? l.session_id ?? "?";
  type Agg = { n: number; v: Set<string> };
  const agg = () => ({ n: 0, v: new Set<string>() }) as Agg;
  const parCat = new Map<string, Agg>();
  const parPage = new Map<string, Agg & { cats: Map<string, number> }>();
  const parJourCat = new Map<string, Map<string, number>>();
  const parAppareilCat = new Map<string, Map<string, number>>();
  const parMessage = new Map<string, Agg & { cat: string; nom: string; pages: Map<string, number> }>();
  for (const l of erreurs) {
    const cat = str(l.props?.cat) ?? "js";
    const v = visiteurDe(l);
    const c = parCat.get(cat) ?? agg(); c.n++; c.v.add(v); parCat.set(cat, c);
    const ch = l.chemin ?? "?";
    const pg = parPage.get(ch) ?? { ...agg(), cats: new Map<string, number>() }; pg.n++; pg.v.add(v); pg.cats.set(cat, (pg.cats.get(cat) ?? 0) + 1); parPage.set(ch, pg);
    const j = zurich(l.ts).slice(0, 10);
    const mj = parJourCat.get(j) ?? new Map<string, number>(); mj.set(cat, (mj.get(cat) ?? 0) + 1); parJourCat.set(j, mj);
    const ap = l.appareil ?? "?";
    const ma = parAppareilCat.get(ap) ?? new Map<string, number>(); ma.set(cat, (ma.get(cat) ?? 0) + 1); parAppareilCat.set(ap, ma);
    const cleM = `${cat}|${l.nom}`;
    const m = parMessage.get(cleM) ?? { ...agg(), cat, nom: l.nom, pages: new Map<string, number>() }; m.n++; m.v.add(v); m.pages.set(ch, (m.pages.get(ch) ?? 0) + 1); parMessage.set(cleM, m);
  }
  const vitaux = lignes.filter((l) => l.type === "perf" && l.nom === "vitaux").map((l) => l.props ?? {});
  const med = (k: string) => mediane(vitaux.map((p) => Number(p[k])).filter((x) => Number.isFinite(x) && x > 0));
  const problemes = {
    categories: [...parCat.entries()].map(([cat, a]) => ({ cat, occurrences: a.n, visiteurs: a.v.size })).sort((a, b) => b.visiteurs - a.visiteurs || b.occurrences - a.occurrences),
    pages: [...parPage.entries()].map(([chemin, a]) => ({ chemin, occurrences: a.n, visiteurs: a.v.size, cats: Object.fromEntries(a.cats) }))
      .sort((a, b) => b.visiteurs - a.visiteurs || b.occurrences - a.occurrences).slice(0, 40),
    par_jour: [...parJourCat.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([jour, m]) => ({ jour, cats: Object.fromEntries(m) })),
    par_appareil: [...parAppareilCat.entries()].map(([appareil, m]) => ({ appareil, cats: Object.fromEntries(m) })),
    messages: [...parMessage.values()].map((m) => ({ cat: m.cat, nom: m.nom, occurrences: m.n, visiteurs: m.v.size,
      pages: [...m.pages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p]) => p) })).sort((a, b) => b.visiteurs - a.visiteurs || b.occurrences - a.occurrences).slice(0, 40),
    vitaux: { mesures: vitaux.length, lcp_ms: med("lcp_ms"), inp_ms: med("inp_ms"), cls: mediane(vitaux.map((p) => Number(p.cls)).filter((x) => Number.isFinite(x))) },
  };

  const pages = lignes.filter((l) => l.type === "page");
  const durees = visites.map((v) => v.duree_s);
  return {
    du: du.toISOString(), au: au.toISOString(), du_zurich: zurich(du), au_zurich: zurich(au),
    exclure_moi: exclureMoi, tronque: fen.tronque,
    exclusion: {
      visites_exclues: new Set(lignesBrutes.filter((l) => l.type === "page" && l.session_id && sessionsMoi.has(l.session_id)).map((l) => l.session_id)).size,
      evenements_exclus: lignesExclues, ips: ipsMoi.size, comptes: usersMoi.size,
    },
    evenements: lignes.length,
    visites: nV,
    visiteurs: new Set(visites.map((v) => ipDeSession.get(v.id) ?? v.id)).size,
    pages_vues: pages.length,
    pages_par_visite: nV ? Math.round((visites.reduce((s, v) => s + v.pages, 0) / nV) * 10) / 10 : null,
    duree_moyenne_s: nV ? Math.round(durees.reduce((a, b) => a + b, 0) / nV) : null,
    duree_mediane_s: mediane(durees),
    rebond_pct: pct(visites.filter((v) => v.rebond).length, nV),
    nouveaux: visites.filter((v) => !v.revenant).length,
    revenants: visites.filter((v) => v.revenant).length,
    origines: compte(visites, (v) => v.origine),
    origines_detail: compte(visites.filter((v) => v.detail), (v) => `${v.origine} : ${v.detail}`, 20),
    campagnes: compte(visites.filter((v) => v.utm_source || v.utm_campaign), (v) => `${v.utm_source ?? "?"}${v.utm_campaign ? ` / ${v.utm_campaign}` : ""}`, 20),
    pages_arrivee: compte(visites, (v) => v.arrivee, 15),
    parcours: compte(visites.filter((v) => v.pages > 1), (v) => v.parcours.slice(0, 4).join(" → ") + (v.pages > 4 ? " → …" : ""), 15),
    pages_vues_par_visite: compte(visites, (v) => (v.pages >= 5 ? "5 et +" : String(v.pages)), 6).sort((a, b) => a[0].localeCompare(b[0])),
    pays: compte(visites, (v) => v.pays, 15),
    villes: compte(visites, (v) => (v.ville ? `${v.ville}${v.pays ? ` (${v.pays})` : ""}` : null), 15),
    appareils: compte(visites, (v) => v.appareil, 4),
    navigateurs: compte(pages, (l) => l.navigateur, 6),
    top_pages: compte(pages, (l) => l.chemin, 15),
    top_clics: compte(lignes.filter((l) => l.type === "clic"), (l) => l.nom, 12),
    erreurs: compte(lignes.filter((l) => l.type === "erreur"), (l) => l.nom, 10),
    api: (() => {
      const a = lignes.filter((l) => l.type === "api" && l.duree_ms != null).map((l) => l.duree_ms!).sort((x, y) => x - y);
      return { appels: a.length, p50_ms: a.length ? a[Math.floor(a.length / 2)] : null, p95_ms: a.length ? a[Math.min(a.length - 1, Math.floor(a.length * 0.95))] : null,
        top_routes: compte(lignes.filter((l) => l.type === "api"), (l) => l.nom, 10) };
    })(),
    emails: compte(lignes.filter((l) => l.type === "email"), (l) => l.nom, 8),
    evenements_serveur: compte(lignes.filter((l) => l.type === "serveur"), (l) => l.nom, 10),
    conversion: [...conv.entries()].sort((a, b) => b[1].visites - a[1].visites).map(([origine, c]) => ({ origine, ...c })),
    serie: serieComplete, serie_pas: pasHeure ? "heure" : "jour",
    par_heure_du_jour: parHeureDuJour,
    comptes_par_jour: comptesParJour, comptes_crees: nouveaux.length,
    comptes_liste: nouveaux.sort((a, b) => b.cree.localeCompare(a.cree)).slice(0, 300).map((c) => ({ id: c.id, email: c.email, cree: c.cree, origine: origineUser(c.id), moi: usersMoi.has(c.id) })),
    debuts: { ...debuts, comptes: tousComptes.length ? zurich(tousComptes.reduce((m, c) => (c.cree < m ? c.cree : m), tousComptes[0].cree)).slice(0, 10) : null } as Record<string, string | null>,
    societes: classe(societes, 20),
    societes_par_jour: [...societesJour.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([jour, m]) => ({ jour, top: classe(m, 10) })),
    saas,
    problemes,
    fil: visites.slice(-300).reverse(),
  };
}
export type AnalyticsSite = Awaited<ReturnType<typeof calculeAnalytics>>;

// ---------------------------------------------------------------- fiche d un compte
/** Fiche détaillée d un compte créé (propriétaire seulement, voir la route). */
export async function ficheCompte(userId: string) {
  const sb = admin();
  const { data: u } = await sb.auth.admin.getUserById(userId);
  if (!u?.user) return null;
  const cree = u.user.created_at;
  const tCree = new Date(cree).getTime();
  const colonnes = "ts,type,nom,session_id,user_id,chemin,referrer,pays,appareil,navigateur,os,duree_ms,ip_hash,props";
  const { data: siennes } = await sb.from("telemetrie_evenements").select(colonnes).eq("user_id", userId).order("ts", { ascending: true }).limit(5000);
  const lignesUser = (siennes ?? []) as Ligne[];
  const sessions = [...new Set(lignesUser.map((l) => l.session_id).filter((x): x is string => !!x))];
  const ips = [...new Set(lignesUser.map((l) => l.ip_hash).filter((x): x is string => !!x))];
  // Sessions du compte (y compris leurs pages anonymes d avant l inscription)
  // et visites anonymes depuis les mêmes IP dans les 30 jours avant.
  const [parSession, parIp] = await Promise.all([
    sessions.length ? sb.from("telemetrie_evenements").select(colonnes).in("session_id", sessions.slice(0, 200)).order("ts", { ascending: true }).limit(10000) : Promise.resolve({ data: [] }),
    ips.length ? sb.from("telemetrie_evenements").select(colonnes).in("ip_hash", ips.slice(0, 50)).is("user_id", null).gte("ts", new Date(tCree - 30 * JOUR).toISOString()).lte("ts", cree).eq("type", "page").order("ts", { ascending: true }).limit(5000) : Promise.resolve({ data: [] }),
  ]);
  const toutes = new Map<string, Ligne>();
  for (const l of [...((parIp.data ?? []) as Ligne[]), ...((parSession.data ?? []) as Ligne[]), ...lignesUser]) toutes.set(`${l.ts}|${l.session_id}|${l.type}|${l.nom}|${l.chemin}`, l);
  const lignes = [...toutes.values()].sort((a, b) => a.ts.localeCompare(b.ts));
  const pages = lignes.filter((l) => l.type === "page");
  const premiere = pages[0] ?? null;
  const o = premiere ? origineDe(premiere.props ?? {}, premiere.referrer) : null;
  const avant: string[] = [];
  for (const p of pages) if (new Date(p.ts).getTime() <= tCree && p.chemin && avant[avant.length - 1] !== p.chemin) avant.push(p.chemin);
  const societes = new Map<string, number>();
  for (const p of pages) { const t = tickerDuChemin(p.chemin); if (t) societes.set(t, (societes.get(t) ?? 0) + 1); }
  const visitesApres = new Map<string, { debut: string; pages: Set<string>; duree: number }>();
  for (const p of pages) {
    if (new Date(p.ts).getTime() <= tCree || !p.session_id) continue;
    const v = visitesApres.get(p.session_id) ?? { debut: p.ts, pages: new Set<string>(), duree: 0 };
    if (p.chemin) v.pages.add(p.chemin);
    v.duree += Math.min(3_600_000, p.duree_ms ?? 0);
    visitesApres.set(p.session_id, v);
  }
  const { data: abos } = await sb.from("subscriptions").select("plan,status,currency,created_at,updated_at,stripe_customer_id,cancel_at_period_end").eq("user_id", userId);
  const clients = ((abos ?? []) as Array<{ stripe_customer_id: string | null }>).map((a) => a.stripe_customer_id).filter((x): x is string => !!x);
  const evs: Array<{ type: string; quand: string; detail: string }> = [];
  if (clients.length) {
    const { data: be } = await sb.from("billing_events").select("type,payload,received_at").in("type", ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.paid", "checkout.session.completed"]).order("received_at", { ascending: true }).limit(5000);
    for (const e of (be ?? []) as Array<{ type: string; payload: any; received_at: string }>) { // eslint-disable-line @typescript-eslint/no-explicit-any
      const ob = e.payload?.data?.object ?? {};
      if (!clients.includes(ob.customer)) continue;
      const detail = e.type === "invoice.paid" ? `${((ob.amount_paid ?? 0) / 100).toLocaleString("fr-FR")} ${String(ob.currency ?? "").toUpperCase()}` : ob.status ? `statut ${ob.status}${ob.trial_end ? ", essai" : ""}` : "";
      evs.push({ type: e.type, quand: zurich(e.received_at), detail });
    }
  }
  const derniere = lignesUser[lignesUser.length - 1]?.ts ?? null;
  return {
    id: userId, email: u.user.email ?? null, cree: zurich(cree),
    premiere_visite: premiere ? { quand: zurich(premiere.ts), arrivee: str(premiere.props?.arr_chemin) ?? premiere.chemin, origine: o?.cat ?? null, origine_detail: o?.detail ?? null,
      utm_source: str(premiere.props?.arr_utm_source) ?? str(premiere.props?.utm_source), utm_campaign: str(premiere.props?.arr_utm_campaign) ?? str(premiere.props?.utm_campaign) } : null,
    pays: premiere?.pays ?? lignesUser[0]?.pays ?? null, ville: str(premiere?.props?.ville) ?? null,
    appareil: premiere?.appareil ?? null, navigateur: [premiere?.navigateur, premiere?.os].filter(Boolean).join(" / ") || null,
    pages_avant_inscription: avant.slice(0, 50),
    delai_inscription_min: premiere ? Math.max(0, Math.round((tCree - new Date(premiere.ts).getTime()) / 60_000)) : null,
    societes: [...societes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([t, n]) => ({ ticker: t, nom: nomDe(t), vues: n })),
    visites_suivantes: [...visitesApres.values()].sort((a, b) => b.debut.localeCompare(a.debut)).slice(0, 50).map((v) => ({ quand: zurich(v.debut), pages: v.pages.size, duree_s: Math.round(v.duree / 1000), parcours: [...v.pages].slice(0, 8) })),
    abonnements: abos ?? [], facturation: evs,
    derniere_activite: derniere ? zurich(derniere) : null, derniere_connexion: u.user.last_sign_in_at ? zurich(u.user.last_sign_in_at) : null,
  };
}
export type FicheCompte = NonNullable<Awaited<ReturnType<typeof ficheCompte>>>;
