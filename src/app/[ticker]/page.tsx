import { notFound, redirect } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import { CompanyView } from "@/components/company-view";
import { AuthNav } from "@/components/auth-nav";
import { FicheJsonLd } from "@/components/seo/fiche-jsonld";
import { COMPANIES, TICKERS, TICKER_ALIASES, getCompany } from "@/lib/data";
import type { TranscriptDoc } from "@/components/transcript-stories";
import type { TranscriptBulletsSummary } from "@/components/transcript-bullets-block";
import V17_PUBLIC from "@/data/v1-7-public.json";
import RACHATS_CLASSEMENT from "@/data/rachats-classement.json";
import RETIREES from "@/data/societes-retirees.json";
import { loadV17Company } from "@/lib/company-core/load-company";
import { assainirPourClient } from "@/lib/company-core/assainir-payload";
import { unstable_cache } from "next/cache";
import { VERSION } from "@/lib/version";
import { resolveDisabledForTicker } from "@/lib/disabled-blocks-server";
import { getServerLocale } from "@/lib/i18n/server";
import { FreemiumBlurProvider, type UserTier } from "@/lib/freemium/context";
import {
  caviardeCompanyPourGratuit,
  caviardeTranscriptDocPourGratuit,
  caviardeTranscriptsPourGratuit,
  caviardeRachatsPourGratuit,
} from "@/lib/floutage-caviardage";
import { chargeZonesFloutage } from "@/lib/desk/floutage-zones";
import { chargeVisiblesGratuitSet } from "@/lib/desk/visibles-gratuit";
import { zonesPourPalier, type PalierFloutage } from "@/lib/floutage";
import { gateAttForTier } from "@/lib/att";
import { gateTheseForTier } from "@/lib/these";
import { readSimulateTier } from "@/lib/desk/effective-tier";
import { getUserCourant } from "@/lib/supabase/server";
import { tierDepuisAbonnement } from "@/lib/freemium/tier-serveur";
import { estAdminOutilsFiche, chargeCoursFmp } from "@/lib/admin/outils-admin-fiche";
import { EvenementsRepere } from "@/components/evenements-repere";
import { CoursKpiBlock } from "@/components/admin/cours-kpi-block";
import { KpiSurMesureBlock, type DonneesDividendes } from "@/components/admin/kpi-sur-mesure-block";
import DIVIDENDES_TOP5 from "@/data/admin-dividendes-top5.json";
import INDICES_COMPOSITION from "@/data/indices-composition.json";

/** Visibilité V1.9.5 : la liste clean-all fait foi (mêmes variantes de
 *  séparateur que le loader V1.9.5 : BRK.B / BRK-B). */
let CLEAN_ALL_SET: Set<string> | null = null;
async function estDansCleanAll(upper: string): Promise<boolean> {
  // Yann 5 oct 2026 : la liste (JSON de ~650 tickers) etait relue et reparsee
  // a chaque requete ; construite une fois par instance (change au deploiement).
  if (!CLEAN_ALL_SET) {
    try {
      const raw = await fs.readFile(
        path.join(process.cwd(), "src/data/v1-9-5-clean-all-tickers.json"),
        "utf-8",
      );
      const tickers = (JSON.parse(raw) as { tickers: string[] }).tickers;
      const set = new Set<string>();
      for (const t of tickers) {
        const u = t.toUpperCase();
        set.add(u);
        set.add(u.replace(/\./g, "-"));
        set.add(u.replace(/-/g, "."));
      }
      CLEAN_ALL_SET = set;
    } catch {
      return false;
    }
  }
  return CLEAN_ALL_SET.has(upper);
}

async function loadTranscriptBrut(ticker: string): Promise<TranscriptDoc | null> {
  const root = process.cwd();
  for (const f of [`${ticker.toUpperCase()}.json`, `${ticker.toLowerCase()}.json`]) {
    try {
      const raw = await fs.readFile(path.join(root, "src/data/transcripts", f), "utf-8");
      return JSON.parse(raw) as TranscriptDoc;
    } catch {
      // try next
    }
  }
  return null;
}

async function loadTranscriptSummaryBrut(
  ticker: string,
): Promise<TranscriptBulletsSummary | null> {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), "src/data/transcript-summaries", `${ticker.toLowerCase()}.json`),
      "utf-8",
    );
    return JSON.parse(raw) as TranscriptBulletsSummary;
  } catch {
    return null;
  }
}

/**
 * Yann 19 sept 2026 (ouverture d une fiche trop lente) : l appel de resultats
 * et sa synthese etaient relus sur le disque a CHAQUE requete, pour chaque
 * visiteur. Ces fichiers ne changent qu au deploiement : meme regle que le
 * chargeur de fiche (src/lib/company-core/load-company.ts), la cle porte le
 * numero de version pour qu une mise en ligne ne serve jamais l ancien
 * contenu pendant 6 h. Seules les DONNEES sont mises en cache ; le HTML, lui,
 * depend du palier du visiteur et reste calcule a chaque requete.
 */
const loadTranscript = unstable_cache(
  loadTranscriptBrut,
  ["fiche-transcript", VERSION],
  { revalidate: 21600, tags: ["fiches"] },
);

// Yann 25 sept 2026 : societes rachetees depuis 2016 (src/data/rachats) et
// classement des plus gros acheteurs du site (versions A, B, C du bloc).
async function loadRachats(ticker: string): Promise<import("@/components/rachats-block").RachatsFiche> {
  const classement = RACHATS_CLASSEMENT as { depuis: number; us: { ticker: string; nom: string; nb: number }[]; eu: { ticker: string; nom: string; nb: number }[] };
  let societe: import("@/components/rachats-block").RachatsFiche["societe"] = null;
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "src/data/rachats", `${ticker.toLowerCase()}.json`), "utf-8");
    const d = JSON.parse(raw) as { nb: number; rachats: { nom: string; annee: number | null; montant: string | null }[]; aucun_rachat_confirme?: string };
    const eu = ticker.includes(".") && !["BRK.B", "BF.B"].includes(ticker.toUpperCase());
    // 26 sept 2026 (cas Netflix) : un zero n est jamais une preuve. Certaines
    // societes ne balisent pas leurs rachats (XBRL) : on affiche « Disponible
    // bientot » plutot qu une affirmation qui peut etre fausse.
    void eu;
    // 28 sept 2026 : zero CONFIRME par une recherche complete (preuve lue) :
    // « Aucun rachat significatif publie depuis 2016 » au lieu de « Disponible bientot ».
    societe = { nb: d.nb, rachats: d.rachats.map((r) => ({ nom: r.nom, annee: r.annee, montant: r.montant })), couverte: d.nb > 0 || Boolean(d.aucun_rachat_confirme) };
  } catch {
    societe = null;
  }
  return { depuis: classement.depuis, societe, classement: { us: classement.us, eu: classement.eu } };
}

const loadTranscriptSummary = unstable_cache(
  loadTranscriptSummaryBrut,
  ["fiche-transcript-synthese", VERSION],
  { revalidate: 21600, tags: ["fiches"] },
);

/**
 * Yann 28 juillet 2026 : les 5 sociétés du dataset V1 legacy (GOOGL, META, MSCI,
 * SPGI, CAT) étaient les SEULES de tout l'univers à ne pas passer par le
 * loader V1.9.5. Résultat sur /googl : 5 indicateurs annuels (dataset figé
 * `src/data/google.json`) au lieu des 60 KPI trimestriels de la chaîne KPI v3,
 * et bouton "Trimestriel" grisé sur le hero faute de `period_type: "quarter"`.
 * Les 498 autres sociétés étaient déjà correctes via /sandbox/v1-9-5/<ticker>.
 * On aligne donc la route publique sur le même pipeline (règle d'or §0 :
 * dernière version uniquement), en gardant l'URL canonique /<ticker> pour
 * le SEO et le floutage freemium géré par FreemiumBlurProvider.
 */
/** Yann 5 oct 2026 : devise du cours selon la place de cotation du symbole (plus de « $ » pour LVMH). */
function deviseCotation(symbole: string): string {
  const s = symbole.toUpperCase();
  if (/\.(PA|DE|AS|MI|MC|BR|LS|HE|VI|IR|F)$/.test(s)) return "€";
  if (s.endsWith(".SW")) return "CHF";
  if (s.endsWith(".L")) return "£";
  return "$";
}

async function resolveFreemiumTier(): Promise<UserTier> {
  const simulated = await readSimulateTier();
  if (simulated === "anonymous") return "anon";
  if (simulated === "free") return "free";
  if (simulated === "premium") return "premium";
  if (simulated === "max") return "max";
  try {
    const user = await getUserCourant();
    return user ? await tierDepuisAbonnement(user) : "anon";
  } catch {
    return "anon";
  }
}

// Force dynamic rendering pour que la session auth (cookies) soit lue
// par AuthNav à chaque requête.
/** Champs lus par aucun composant client (verifie par grep dans src/components
 *  le 5 oct 2026) : retires du paquet serialise, affichage inchange. */
function allegerPourClient<T extends { kpis?: unknown[] }>(c: T): T {
  const o = { ...(c as Record<string, unknown>) };
  delete o.hero_kpi_rationale;
  delete o.hero_kpi_replaced_reason;
  if (Array.isArray(o.kpis)) {
    o.kpis = (o.kpis as Record<string, unknown>[]).map((k) => {
      if (!k || typeof k !== "object" || !("description_en" in k || "description_fr" in k)) return k;
      const { description_en: _e, description_fr: _f, ...reste } = k;
      void _e; void _f;
      return reste;
    });
  }
  return o as T;
}

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return TICKERS.map((ticker) => ({ ticker: ticker.toLowerCase() }));
}

type SocieteMeta = { name: string; ticker: string; sector: string };
async function societePourMetadonnees(ticker: string): Promise<SocieteMeta | null> {
  const upper = ticker.toUpperCase();
  const statique = COMPANIES[upper];
  if (statique) return { name: statique.name, ticker: statique.ticker, sector: statique.sector };
  const v17 = (V17_PUBLIC as Record<string, { name?: string; ticker?: string; sector?: string }>)[upper];
  if (v17?.name) return { name: v17.name, ticker: v17.ticker ?? upper, sector: v17.sector ?? "" };
  // Dernier recours : le chargeur de la fiche lui-meme (mis en cache, donc
  // sans cout : la page qui suit fait le meme appel). Les societes absentes
  // de la table publique (ex KO) gardaient sinon "Page introuvable".
  try {
    const r = await loadV17Company(upper, { mode: "v18", locale: "fr" });
    const co = (r as { company?: { name?: string; ticker?: string; sector?: string } } | null)?.company;
    if (co?.name) return { name: co.name, ticker: co.ticker ?? upper, sector: co.sector ?? "" };
  } catch {
    /* introuvable */
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  // 24 sept 2026 : societe retiree = vraie 404 (statut HTTP et titre).
  if (ticker.toUpperCase() in (RETIREES.tickers as Record<string, string>)) notFound();
  // Yann 4 sept 2026 : depuis que la fiche est servie sur /<ticker>, le titre
  // de l onglet et l apercu de partage disaient "Page introuvable" pour les
  // 660 societes hors des 5 de la V1 : le nom etait cherche dans la vieille
  // table statique. On lit la meme source que la page.
  const c = await societePourMetadonnees(ticker);
  if (!c) return { title: "Page introuvable · Mettrik AI" };
  const slug = ticker.toLowerCase();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mettrik.ai";
  const title = `${c.name} (${c.ticker}) · Mettrik AI`;
  const description = `Analyse KPI sur ${c.name}. Indicateurs scorés, risques tracés, gouvernance, positionnement IA. ${c.sector}.`;
  const ogImage = `${base}/api/og/${slug}`;
  return {
    title,
    description,
    alternates: {
      canonical: `${base}/${slug}`,
      languages: {
        en: `${base}/${slug}`,
        fr: `${base}/fr/${slug}`,
      },
    },
    openGraph: {
      title,
      description,
      url: `${base}/${slug}`,
      siteName: "Mettrik AI",
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${c.name} · Mettrik AI` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function TickerPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>;
  searchParams?: Promise<{ audit_token?: string; admin?: string }>;
}) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  // 24 sept 2026 (demande du proprietaire) : une societe qui n existe plus
  // (rachat finalise, faillite) est retiree du site, meme si un ancien jeu de
  // donnees la contient encore.
  if (upper in (RETIREES.tickers as Record<string, string>)) notFound();
  // Redirect alias tickers (e.g. GOOG → GOOGL) toward canonical URL.
  if (TICKER_ALIASES[upper]) {
    redirect(`/${TICKER_ALIASES[upper].toLowerCase()}`);
  }
  const legacyCompany = getCompany(ticker);
  if (!legacyCompany) {
    // Yann 4 sept 2026 : cette route REDIRIGEAIT vers /sandbox/v1-9-5/<ticker>.
    // Consequence visible pour un visiteur : l adresse publique d Apple
    // affichait "mettrik.ai/sandbox/v1-9-5/aapl", un chemin interne, mauvais
    // pour l image comme pour le referencement. La fiche est desormais SERVIE
    // ici, sur /aapl, sans redirection. La route sandbox reste valide pour les
    // liens deja partages.
    const v17 = V17_PUBLIC as unknown as Record<string, unknown>;
    if (!(v17[upper] || (await estDansCleanAll(upper)))) {
      notFound();
    }
  }

  // Pipeline V1.9.5 (identique aux 498 autres sociétés). Fallback sur le dataset
  // legacy uniquement si le loader ne rend pas la société, pour ne jamais servir
  // une page vide sur une URL publique indexée.
  const locale = await getServerLocale();
  // 8 sept 2026 (lenteur des fiches) : les lectures independantes partent EN
  // MEME TEMPS au lieu de s enchainer (fiche, transcript, resume, blocs
  // desactives, palier, zones de floutage). Mesure : 5 allers-retours
  // sequentiels vers Supabase et le disque devenaient 1 seul temps d attente.
  const [r, transcript, transcriptSummary, disabledBlocks, tierResolu, zonesChargees, rachats, visiblesGratuit] = await Promise.all([
    loadV17Company(ticker, { mode: "v18", locale }),
    loadTranscript(ticker),
    loadTranscriptSummary(ticker),
    resolveDisabledForTicker(ticker),
    resolveFreemiumTier(),
    chargeZonesFloutage(ticker.toUpperCase()),
    loadRachats(ticker),
    chargeVisiblesGratuitSet(),
  ]);
  // Yann 24 sept 2026 : dates des conferences disponibles (la plus recente d abord).
  const transcriptDates: string[] = ((transcript as { calls?: { date?: string }[] } | null)?.calls ?? [])
    .map((c) => c.date ?? "")
    .filter(Boolean);
  if (transcriptDates.length === 0 && transcript?.latest?.date) transcriptDates.push(transcript.latest.date);

  const sp = searchParams ? await searchParams : undefined;
  const auditBypass =
    !!sp?.audit_token &&
    !!process.env.VISUAL_AUDIT_TOKEN &&
    sp.audit_token === process.env.VISUAL_AUDIT_TOKEN;
  // Yann 16 sept 2026 : la fiche Google est la vitrine complete des anonymes ;
  // un clic n importe ou (hors connexion / inscription) mene a l inscription.
  // Yann 30 sept 2026 : meme regle pour toute la liste « 100 % visibles en gratuit » (base).
  const estVisibleGratuit =
    visiblesGratuit.has(ticker.toUpperCase()) ||
    (r.kind === "ready" && visiblesGratuit.has(r.company.ticker.toUpperCase()));
  const vitrineAnon = !auditBypass && tierResolu === "anon" && estVisibleGratuit;
  if (r.kind !== "ready") {
    // Sans dataset legacy ET sans rendu du chargeur, il n y a rien a montrer.
    if (!legacyCompany) notFound();
    // Audit 2 sept 2026 : le repli legacy passe par le meme palier et le
    // meme fournisseur de floutage que le chemin principal.
    const tierRepli = tierResolu;
    return (
      <>
        <FreemiumBlurProvider tier={tierRepli}>
          <CompanyView
            company={assainirPourClient(legacyCompany)}
            authSlot={<AuthNav scope="company" />}
          captureInscription={vitrineAnon}
            transcript={assainirPourClient(tierRepli === "free" || tierRepli === "anon" ? null : transcript)}
            freemiumTier={tierRepli}
          />
        </FreemiumBlurProvider>
      </>
    );
  }

  // Yann 15 sept 2026 : le contournement audit_token n existait que sur la
  // route interne /sandbox/v1-9-5/<ticker>. Les verifications automatiques de
  // l adresse publique /<ticker> lisaient donc une page anonyme (textes
  // caviardes), et l alerte de securite signalait un jeton « invalide » alors
  // qu il etait simplement ignore ici.
  // Yann 30 sept 2026 : societe de la liste servie a un palier gratuit ou
  // anonyme : palier Max et aucune zone floutee, quel que soit le reglage.
  const vitrineGratuite = (tierResolu === "free" || tierResolu === "anon") && estVisibleGratuit;
  const freemiumTier = auditBypass || vitrineAnon || vitrineGratuite ? "max" : tierResolu;

  // ATT (anti-thèse) : même gating serveur que /sandbox/v1-9-5/<ticker>.
  // Le contenu complet n'est sérialisé que pour le plan Max.
  const gatedCompany = {
    ...r.company,
    ...(r.company.att ? { att: gateAttForTier(r.company.att, freemiumTier) } : {}),
    ...(r.company.these ? { these: gateTheseForTier(r.company.these, freemiumTier) } : {}),
  };

  // Yann 30 aout 2026 : palier gratuit et anonyme, le texte des zones
  // floutees est CAVIARDE ici, cote serveur, avant tout rendu. Le vrai texte
  // ne part jamais au navigateur (copier-coller, impression, code source :
  // seul le charabia est recuperable). Les societes exemptees (zones vides)
  // et les offres payantes recoivent la fiche entiere.
  // Yann 4 sept 2026 : le floutage n est plus reserve aux paliers gratuit et
  // anonyme. Chaque zone porte desormais la liste des paliers qu elle
  // concerne, et une zone sans liste garde l ancien comportement (anonyme +
  // gratuit). On charge donc les zones pour TOUS les paliers, puis on filtre.
  const zonesDuTicker = (
    r.company.ticker.toUpperCase() === ticker.toUpperCase() ? zonesChargees : await chargeZonesFloutage(r.company.ticker)
  ).zones;
  const zonesEffectives = vitrineGratuite ? [] : zonesPourPalier(zonesDuTicker, freemiumTier as PalierFloutage);
  const estGratuit = zonesEffectives.length > 0;
  const servedCompany = estGratuit
    ? caviardeCompanyPourGratuit(gatedCompany, zonesEffectives)
    : gatedCompany;
  const servedTranscriptSummary = estGratuit
    ? caviardeTranscriptsPourGratuit(transcriptSummary ?? null, zonesEffectives)
    : transcriptSummary;

  // Yann 16 sept 2026 (referencement classique et moteurs de reponse IA) :
  // la fiche declare explicitement la societe, ses indicateurs et sa date de
  // mise a jour. Sans cela, un robot ne voit qu un mur de chiffres.
  const kpisDeclares = (servedCompany.kpis ?? [])
    .map((k) => k.name_fr || k.short)
    .filter((x): x is string => !!x);
  const derniereDate = (servedCompany.kpis ?? [])
    .map((k) => k.last_data_date)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);

  // Mission admin (Yann, 1er oct 2026) : blocs « KPI et cours de bourse » et
  // « KPI admin sur-mesure ». Controle SERVEUR : admin connecte (ou jeton
  // d audit + ?admin=1) et jamais sur mettrik.ai. Hors admin, rien n est
  // rendu ni serialise vers le navigateur.
  const adminOutils = await estAdminOutilsFiche({ auditBypass, adminParam: sp?.admin });
  let adminApresHero: React.ReactNode = null;
  let adminApresMoyenTerme: React.ReactNode = null;
  let adminNomsExport: Record<string, string> | null = null;
  if (adminOutils) {
    const { cours, couverture } = await chargeCoursFmp(servedCompany.ticker);
    adminApresHero = (
      <CoursKpiBlock
        ticker={servedCompany.ticker}
        nomSociete={servedCompany.name}
        kpis={servedCompany.kpis ?? []}
        heroShort={servedCompany.hero_kpi}
        cours={cours ? { source: cours.source, symbole_fmp: cours.symbole_fmp, premiere_date: cours.premiere_date, derniere_date: cours.derniere_date, dernier_cours: cours.dernier_cours, plus_haut: cours.plus_haut, cloture_annee_precedente: cours.cloture_annee_precedente, points: cours.points } : null}
        motifNonCouvert={cours ? null : couverture.couvert === null ? "société pas encore testée, quota quotidien de l’API atteint" : couverture.motif ?? null}
        devisePrix={deviseCotation(cours?.symbole_fmp ?? servedCompany.ticker)}
      />
    );
    adminApresMoyenTerme = <KpiSurMesureBlock donnees={DIVIDENDES_TOP5 as unknown as DonneesDividendes} />;
    const noms: Record<string, string> = {};
    for (const idx of Object.values((INDICES_COMPOSITION as { indices: Record<string, { membres: { ticker: string; nom: string }[] }> }).indices)) {
      for (const m of idx.membres) if (!noms[m.ticker.toUpperCase()]) noms[m.ticker.toUpperCase()] = m.nom;
    }
    const v17 = V17_PUBLIC as Record<string, { name?: string }>;
    const cibles = new Set<string>();
    for (const f of ((servedCompany as { image_findings?: { target_tickers?: string[] }[] }).image_findings ?? [])) {
      for (const t of f.target_tickers ?? []) cibles.add(t.toUpperCase());
    }
    adminNomsExport = {};
    for (const t of cibles) {
      const nom = noms[t] ?? noms[t.replace(/-/g, ".")] ?? v17[t]?.name;
      if (nom) adminNomsExport[t] = nom;
    }
  }

  return (
    <>
      {/* Yann 7 oct 2026 : repere rouge des ajouts d evenements, admin seulement (jamais sur mettrik.ai). */}
      {adminOutils && <EvenementsRepere />}
      <FicheJsonLd
        ticker={servedCompany.ticker}
        nom={servedCompany.name}
        secteur={servedCompany.sector ?? null}
        description={servedCompany.tagline ?? null}
        url={`${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mettrik.ai"}/${servedCompany.ticker.toLowerCase()}`}
        kpis={kpisDeclares}
        misAJour={derniereDate ?? null}
      />
      <FreemiumBlurProvider tier={freemiumTier}>
        <CompanyView
          company={assainirPourClient(allegerPourClient(servedCompany))}
          authSlot={<AuthNav scope="company" />}
          captureInscription={vitrineAnon}
          transcript={assainirPourClient(estGratuit ? caviardeTranscriptDocPourGratuit(transcript, zonesEffectives) : transcript)}
          transcriptSummary={assainirPourClient(servedTranscriptSummary)}
          transcriptDates={transcriptDates}
          // 5 oct 2026 : TranscriptNavigation ignore desormais le suivi des KPI
          // (plus de navigation entre conferences) : 65 Ko de JSON n etaient
          // serialises que pour rien, quel que soit le palier. Plus envoye.
          rachats={estGratuit ? caviardeRachatsPourGratuit(rachats, zonesEffectives) : rachats}
          // Yann 23 sept 2026 : v18Mode etait actif EN DUR ici, alors que le
          // composant qu il declenche annonce lui meme ne jamais devoir
          // s afficher en production. Resultat : un carton rouge « Bloc a
          // completer » portant du jargon interne, noms de modeles compris,
          // etait servi aux clients sur DPW.DE, P911.DE et PUM.DE. En
          // production, un bloc absent se masque, il ne s annonce pas.
          freemiumTier={freemiumTier}
          disabledBlocks={disabledBlocks}
          adminApresHero={adminApresHero}
          adminApresMoyenTerme={adminApresMoyenTerme}
          adminNomsExport={adminNomsExport}
        />
      </FreemiumBlurProvider>
    </>
  );
}
