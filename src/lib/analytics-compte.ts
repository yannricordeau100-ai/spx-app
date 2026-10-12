/**
 * Analytics personnels de « Mon compte et analytics » (Yann 13 oct 2026).
 * Spécification : docs/rapports-session-2026-10/analytics-compte.md.
 *
 * Règles :
 *  - chaque chiffre vient d une donnée réellement collectée pour CET
 *    utilisateur ; sinon le bloc concerné n est pas affiché (état vide) ;
 *  - module SERVEUR uniquement : lit telemetrie_evenements avec le service role,
 *    filtre `user_id = userId` imposé ici (l appelant passe l id lu dans la
 *    session, jamais un paramètre d URL) ;
 *  - aucun temps passé : la durée de page est restée faussée jusqu au
 *    13 oct 2026 (onglet en arrière-plan compté), elle n est pas restituée ;
 *  - jamais de compte absolu de l univers (front public) : seulement des parts.
 */
import { headers } from "next/headers";
import GICS from "../../docs/cahier/societes-gics.json";
import NOMS from "@/data/v1-9-5-names.json";
import { V17_SEARCH_BY_TICKER } from "@/lib/company-core/tickers-search-index";
import CLEAN_ALL from "@/data/v1-9-5-clean-all-tickers.json";
import CALENDRIER from "@/data/earnings-calendar.json";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ticker_canonique } from "@/lib/ticker-aliases";
import { dansUniversActif, ficheServie } from "@/lib/univers-actif";
import { chargeConfigTelemetrie } from "@/lib/desk/telemetrie-store";
import { hacheIp } from "@/lib/telemetrie/serveur";
import { loadV17Company } from "@/lib/company-core/load-company";

const SECTEURS_GICS: Record<string, string> = {
  "10": "Énergie", "15": "Matériaux", "20": "Industrie", "25": "Consommation discrétionnaire",
  "30": "Consommation de base", "35": "Santé", "40": "Finance", "45": "Technologie",
  "50": "Services de communication", "55": "Services aux collectivités", "60": "Immobilier",
};

const CODES = (GICS as { societes: Record<string, string> }).societes;
const NOMS_MAP = NOMS as Record<string, string>;
const TZ = "Europe/Paris";
/** Mise en service de la télémétrie première partie (migration 20260831_telemetrie.sql). */
const DEBUT_MESURE = "2026-08-31";

/** Secteur GICS (libellé français) d une société, ou null. */
function secteurDe(ticker: string): string | null {
  const code = CODES[ticker];
  return typeof code === "string" ? SECTEURS_GICS[code.slice(0, 2)] ?? null : null;
}

function nomDe(ticker: string): string {
  const v = [ticker, ticker.replace(/-/g, "."), ticker.replace(/\./g, "-")];
  for (const x of v) if (NOMS_MAP[x]) return NOMS_MAP[x];
  for (const x of v) if (V17_SEARCH_BY_TICKER[x]?.name) return V17_SEARCH_BY_TICKER[x].name;
  return ticker;
}

/** Ticker canonique servi pour un chemin de page (« /aapl » -> AAPL), sinon null. */
function tickerDuChemin(chemin: string | null): string | null {
  const m = (chemin ?? "").match(/^\/([A-Za-z0-9.\-]{1,12})$/);
  if (!m) return null;
  const t = ticker_canonique(m[1].toUpperCase());
  if (!CODES[t] || !dansUniversActif(t) || !ficheServie(t)) return null;
  return t;
}

/** Répartition de l univers par secteur, en parts (jamais de compte absolu). */
const PARTS_UNIVERS: Record<string, number> = (() => {
  const vus = new Set<string>();
  const n: Record<string, number> = {};
  for (const brut of (CLEAN_ALL as { tickers: string[] }).tickers) {
    const t = ticker_canonique(brut.toUpperCase());
    if (vus.has(t) || !ficheServie(t)) continue;
    const s = secteurDe(t);
    if (!s) continue;
    vus.add(t);
    n[s] = (n[s] ?? 0) + 1;
  }
  const total = Object.values(n).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(Object.entries(n).map(([s, v]) => [s, v / total]));
})();

/** Date civile à Paris, « AAAA-MM-JJ ». */
function jourParis(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Lundi (date civile Paris) de la semaine d un jour « AAAA-MM-JJ ». */
function lundiDe(jour: string): string {
  const d = new Date(`${jour}T12:00:00Z`);
  const dec = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dec);
  return d.toISOString().slice(0, 10);
}

export type RaisonVide = "exclu_compte" | "exclu_reseau" | "mesure_coupee" | "opposition" | null;

export type AnalyticsCompte = {
  /** Pourquoi aucune nouvelle visite n est enregistrée (null = mesure active). */
  raison: RaisonVide;
  /** Date de création du compte (ISO) : base du libellé « depuis le » (Yann 13 oct 2026). */
  depuis: string | null;
  /** Début de la collecte si le compte lui est antérieur (ISO jour), sinon null. */
  mesureDepuis: string | null;
  /** Visites de fiches société (pages vues consécutives d un même onglet fusionnées). */
  visites: number;
  societesDistinctes: number;
  societesCeMois: number;
  nouvellesCeMois: Array<{ ticker: string; nom: string }>;
  nouveauxSecteursCeMois: string[];
  /** Semaines actives sur la fenêtre (12 semaines, ou moins si le compte est plus récent). */
  semaines: { actives: number; fenetre: number; grille: boolean[] };
  joursActifsCeMois: number;
  top: Array<{ ticker: string; nom: string; visites: number; derniere: string }>;
  secteurs: Array<{ secteur: string; part: number; partUnivers: number; visites: number }>;
  kpiFavoris: Array<{ ticker: string; short: string; nom: string; super: boolean }>;
  kpiFavorisDisponibles: boolean;
  kpiOuverts: Array<{ ticker: string; short: string; nom: string; fois: number }>;
  publications: Array<{ ticker: string; nom: string; date: string; estimee: boolean }>;
  favorisSocietes: number;
  comparaisons: { total: number; dernieres: Array<{ a: string; b: string; kpi: string; ts: string }> };
};

type Ligne = { ts: string; type: string; nom: string; session_id: string | null; chemin: string | null; props: Record<string, unknown> | null };

async function lisEvenements(userId: string): Promise<Ligne[]> {
  const sb = createSupabaseAdminClient();
  const depuis = new Date(Date.now() - 365 * 86_400_000).toISOString();
  const out: Ligne[] = [];
  // Bornée : 12 mois, 20 000 lignes au plus, par pages de 1 000.
  for (let page = 0; page < 20; page++) {
    const { data, error } = await sb
      .from("telemetrie_evenements")
      .select("ts,type,nom,session_id,chemin,props")
      .eq("user_id", userId)
      .gte("ts", depuis)
      .or("and(type.eq.page,nom.eq.vue),and(type.eq.clic,nom.eq.kpi_ouvert),and(type.eq.serveur,nom.eq.comparaison)")
      .order("ts", { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    if (error || !data) break;
    out.push(...(data as Ligne[]));
    if (data.length < 1000) break;
  }
  return out;
}

async function raisonExclusion(userId: string, email: string | null | undefined, optOut: boolean): Promise<RaisonVide> {
  const config = await chargeConfigTelemetrie();
  const owner = process.env.DESK_OWNER_EMAIL?.toLowerCase();
  const mail = (email ?? "").toLowerCase();
  // Préversion locale uniquement : permet de tester le bloc rempli avec le compte
  // de test interne sans lever son exclusion en production.
  const leveeLocale = process.env.NODE_ENV !== "production" && process.env.ANALYTICS_COMPTE_TEST_USER === userId;
  if (!leveeLocale && ((mail && (mail === owner || mail.endsWith("@mettrik-internal.test"))) || config.usersExclus.includes(userId))) return "exclu_compte";
  if (optOut) return "opposition";
  if (!config.actif) return "mesure_coupee";
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim();
    if (!leveeLocale && ip && config.hashesExclus.includes(hacheIp(ip))) return "exclu_reseau";
  } catch { /* hors requête */ }
  return null;
}

/** Noms français des KPI (fiches chargées une seule fois chacune, 8 au plus). */
async function nomsKpi(paires: Array<{ ticker: string; short: string }>): Promise<Map<string, string>> {
  const tickers = [...new Set(paires.map((p) => p.ticker))].slice(0, 8);
  const noms = new Map<string, string>();
  await Promise.all(
    tickers.map(async (t) => {
      try {
        const r = await loadV17Company(t, { mode: "v18", locale: "fr" });
        if (r.kind !== "ready") return;
        for (const k of r.company.kpis ?? []) {
          const nom = (k as { name_fr?: string }).name_fr || (k as { name_en?: string }).name_en;
          if (nom) noms.set(`${t}|${k.short}`, String(nom));
        }
      } catch { /* fiche indisponible : on garde le code court */ }
    }),
  );
  return noms;
}

export async function chargeAnalyticsCompte(opts: {
  userId: string;
  email?: string | null;
  /** Date de création du compte (auth.users.created_at). */
  compteCree?: string | null;
  optOut: boolean;
  favorisSocietes: string[];
  /** null : table des KPI favoris indisponible (la partie est alors masquée). */
  favorisKpi: Array<{ ticker: string; kpi_short: string; is_super: boolean }> | null;
}): Promise<AnalyticsCompte> {
  const { userId } = opts;
  const [raison, evts] = await Promise.all([
    raisonExclusion(userId, opts.email, opts.optOut),
    lisEvenements(userId).catch(() => [] as Ligne[]),
  ]);

  const maintenant = new Date();
  const aujourdhui = jourParis(maintenant);
  const moisCourant = aujourdhui.slice(0, 7);

  // ---- visites de fiches société ----
  // Le collecteur émet une « vue » à chaque navigation ET à chaque passage de
  // l onglet en arrière-plan : les vues consécutives de la même page dans le
  // même onglet sont une seule visite.
  const dernierCheminParSession = new Map<string, string>();
  const visitesParTicker = new Map<string, { n: number; derniere: string; premiere: string }>();
  const premierParSecteur = new Map<string, string>();
  const visitesParSecteur = new Map<string, number>();
  const semainesActives = new Set<string>();
  const joursCeMois = new Set<string>();
  let visites = 0;
  const premier: string | null = evts[0]?.ts ?? null;

  const kpiOuverts = new Map<string, { ticker: string; short: string; fois: number }>();
  const comparaisons: Array<{ a: string; b: string; kpi: string; ts: string }> = [];

  for (const e of evts) {
    const jour = jourParis(new Date(e.ts));
    if (e.type === "page") {
      // Toute page vue compte pour la régularité (activité sur Mettrik).
      semainesActives.add(lundiDe(jour));
      if (jour.startsWith(moisCourant)) joursCeMois.add(jour);
      const t = tickerDuChemin(e.chemin);
      const cleSession = e.session_id ?? "?";
      const precedent = dernierCheminParSession.get(cleSession);
      dernierCheminParSession.set(cleSession, e.chemin ?? "");
      if (!t || precedent === e.chemin) continue;
      visites++;
      const v = visitesParTicker.get(t);
      if (v) { v.n++; v.derniere = e.ts; } else visitesParTicker.set(t, { n: 1, derniere: e.ts, premiere: e.ts });
      const s = secteurDe(t);
      if (s) {
        visitesParSecteur.set(s, (visitesParSecteur.get(s) ?? 0) + 1);
        if (!premierParSecteur.has(s)) premierParSecteur.set(s, e.ts);
      }
    } else if (e.type === "clic" && e.nom === "kpi_ouvert") {
      const p = e.props ?? {};
      const t = typeof p.ticker === "string" ? ticker_canonique(p.ticker.toUpperCase()) : "";
      const short = typeof p.kpi === "string" ? p.kpi : "";
      if (!t || !short || !ficheServie(t)) continue;
      const cle = `${t}|${short}`;
      const k = kpiOuverts.get(cle);
      if (k) k.fois++; else kpiOuverts.set(cle, { ticker: t, short, fois: 1 });
    } else if (e.type === "serveur" && e.nom === "comparaison") {
      const p = e.props ?? {};
      const a = typeof p.a === "string" ? p.a : "", b = typeof p.b === "string" ? p.b : "";
      if (a && b) comparaisons.push({ a: ticker_canonique(a.toUpperCase()), b: ticker_canonique(b.toUpperCase()), kpi: typeof p.ka === "string" ? p.ka : "", ts: e.ts });
    }
  }

  const top = [...visitesParTicker.entries()]
    .sort((x, y) => y[1].n - x[1].n || y[1].derniere.localeCompare(x[1].derniere))
    .slice(0, 10)
    .map(([ticker, v]) => ({ ticker, nom: nomDe(ticker), visites: v.n, derniere: v.derniere }));

  const totalSecteurs = [...visitesParSecteur.values()].reduce((a, b) => a + b, 0) || 1;
  const secteurs = [...visitesParSecteur.entries()]
    .sort((x, y) => y[1] - x[1])
    .map(([secteur, n]) => ({ secteur, visites: n, part: n / totalSecteurs, partUnivers: PARTS_UNIVERS[secteur] ?? 0 }));

  const nouvellesCeMois = [...visitesParTicker.entries()]
    .filter(([, v]) => jourParis(new Date(v.premiere)).startsWith(moisCourant))
    .sort((x, y) => x[1].premiere.localeCompare(y[1].premiere))
    .map(([ticker]) => ({ ticker, nom: nomDe(ticker) }));
  const societesCeMois = [...visitesParTicker.values()].filter((v) => jourParis(new Date(v.derniere)).startsWith(moisCourant)).length;
  const nouveauxSecteursCeMois = [...premierParSecteur.entries()]
    .filter(([, ts]) => jourParis(new Date(ts)).startsWith(moisCourant))
    .map(([s]) => s);

  // ---- régularité : 12 dernières semaines, ou depuis la première semaine mesurée ----
  const lundiCourant = lundiDe(aujourdhui);
  const grilleComplete: Array<{ lundi: string; active: boolean }> = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(`${lundiCourant}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7 * i);
    const l = d.toISOString().slice(0, 10);
    grilleComplete.push({ lundi: l, active: semainesActives.has(l) });
  }
  // Fenêtre : jamais avant la création du compte ni avant le début de la
  // collecte (une semaine non mesurée n est pas une semaine inactive).
  const debutFenetre = [opts.compteCree ? jourParis(new Date(opts.compteCree)) : null, DEBUT_MESURE, premier ? jourParis(new Date(premier)) : null]
    .filter((x): x is string => !!x)
    .reduce((m, x) => (x > m ? x : m), DEBUT_MESURE);
  const premierLundi = lundiDe(opts.compteCree ? debutFenetre : (premier ? jourParis(new Date(premier)) : aujourdhui));
  const grille = grilleComplete.filter((s) => s.lundi >= premierLundi);

  // ---- KPI ----
  const favKpi = (opts.favorisKpi ?? [])
    .map((f) => ({ ticker: ticker_canonique(f.ticker.toUpperCase()), short: f.kpi_short, super: !!f.is_super }))
    .filter((f) => ficheServie(f.ticker));
  const ouverts = [...kpiOuverts.values()].sort((x, y) => y.fois - x.fois).slice(0, 10);
  const dernieresComp = comparaisons.slice(-5).reverse();
  const noms = await nomsKpi([...favKpi.slice(0, 10), ...ouverts, ...dernieresComp.filter((c) => c.kpi).map((c) => ({ ticker: c.a, short: c.kpi }))]);

  // ---- prochaines publications des sociétés favorites ----
  const cal = (CALENDRIER as { par_ticker: Record<string, { prochaine?: string | null; estimee?: boolean }> }).par_ticker;
  const favSoc = [...new Set(opts.favorisSocietes.map((t) => ticker_canonique(t.toUpperCase())))].filter((t) => ficheServie(t));
  const publications = favSoc
    .map((t) => ({ t, e: cal[t] }))
    .filter(({ e }) => e?.prochaine && /^\d{4}-\d{2}-\d{2}$/.test(e.prochaine) && e.prochaine >= aujourdhui)
    .map(({ t, e }) => ({ ticker: t, nom: nomDe(t), date: e!.prochaine!, estimee: e!.estimee !== false }))
    .sort((x, y) => x.date.localeCompare(y.date));

  return {
    raison,
    depuis: opts.compteCree ?? premier,
    mesureDepuis: opts.compteCree && jourParis(new Date(opts.compteCree)) < DEBUT_MESURE ? DEBUT_MESURE : null,
    visites,
    societesDistinctes: visitesParTicker.size,
    societesCeMois,
    nouvellesCeMois,
    nouveauxSecteursCeMois,
    semaines: { actives: grille.filter((s) => s.active).length, fenetre: grille.length, grille: grille.map((s) => s.active) },
    joursActifsCeMois: joursCeMois.size,
    top,
    secteurs,
    kpiFavorisDisponibles: opts.favorisKpi !== null,
    kpiFavoris: favKpi.slice(0, 10).map((f) => ({ ...f, nom: noms.get(`${f.ticker}|${f.short}`) ?? f.short })),
    kpiOuverts: ouverts.map((k) => ({ ...k, nom: noms.get(`${k.ticker}|${k.short}`) ?? k.short })),
    publications,
    favorisSocietes: favSoc.length,
    comparaisons: {
      total: comparaisons.length,
      dernieres: dernieresComp.map((c) => ({ a: nomDe(c.a), b: nomDe(c.b), kpi: c.kpi ? noms.get(`${c.a}|${c.kpi}`) ?? c.kpi : "", ts: c.ts })),
    },
  };
}
