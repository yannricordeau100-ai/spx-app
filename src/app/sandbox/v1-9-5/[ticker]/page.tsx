import { notFound, redirect } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import { CompanyView } from "@/components/company-view";
import { AuthNav } from "@/components/auth-nav";
import { getDataPendingMeta, DataPendingPage } from "@/components/data-pending-placeholder";
import type { TranscriptDoc } from "@/components/transcript-stories";
import type { TranscriptBulletsSummary } from "@/components/transcript-bullets-block";
import { loadV17Company } from "@/lib/company-core/load-company";
import { resolveDisabledForTicker } from "@/lib/disabled-blocks-server";
import { getServerLocale } from "@/lib/i18n/server";
import { FreemiumBlurProvider, type UserTier } from "@/lib/freemium/context";
import {
  caviardeCompanyPourGratuit,
  caviardeTranscriptDocPourGratuit,
  caviardeTranscriptsPourGratuit,
} from "@/lib/floutage-caviardage";
import { chargeZonesFloutage } from "@/lib/desk/floutage-zones";
import { gateAttForTier } from "@/lib/att";
import { readSimulateTier } from "@/lib/desk/effective-tier";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tierDepuisAbonnement } from "@/lib/freemium/tier-serveur";

// V1.9.5 = filtre strict is_clean_all (a-f + g-m post audit qualité).
// Si la sté n'est pas clean_all → redirect vers /sandbox/v1-9-5 (overview).
async function loadCleanAllSet(): Promise<Set<string>> {
  // Yann 4 juillet 2026 : scope public = SP500 uniquement. La liste
  // v1-9-5-clean-all-tickers.json (SP500 avec KPIs complets) est la source
  // de vérité de visibilité : toute sté hors liste => notFound, même par URL.
  const sp500Path = path.join(
    process.cwd(),
    "src/data/v1-9-5-clean-all-tickers.json",
  );
  try {
    const sp500Raw = await fs.readFile(sp500Path, "utf-8");
    const tickers = (JSON.parse(sp500Raw) as { tickers: string[] }).tickers;
    // Yann 29 mai 2026 : normaliser les variantes de séparateur (BRK.B / BRK-B
    // / BRK_B = même sté). Le set contient TOUTES les variantes pour absorber
    // l'écart entre la liste (utilise ".") et URL ("-").
    const out = new Set<string>();
    for (const t of tickers) {
      const upper = t.toUpperCase();
      out.add(upper);
      out.add(upper.replace(/\./g, "-"));
      out.add(upper.replace(/-/g, "."));
    }
    return out;
  } catch {
    return new Set();
  }
}

// Yann 9 juin 2026 : sociétés dont la profondeur de données réelle est limitée
// (rupture de segment réelle, ex APH/AIZ/CAH = 4 ans). Affiche un "i" permanent
// à gauche du titre hero. Map curatée éditable.
async function loadHistoryLimit(ticker: string): Promise<number | undefined> {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), "src/data/v1-9-5-history-limited.json"),
      "utf-8",
    );
    const map = JSON.parse(raw) as Record<string, number>;
    return map[ticker.toUpperCase()];
  } catch {
    return undefined;
  }
}

async function loadTranscriptSummary(
  ticker: string,
): Promise<TranscriptBulletsSummary | null> {
  const filePath = path.join(
    process.cwd(),
    "src/data/transcript-summaries",
    `${ticker.toLowerCase()}.json`,
  );
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as TranscriptBulletsSummary;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

/** Doublons multi-classes : redirect vers le canonique. */
const URL_ALIASES: Record<string, string> = {
  GOOG: "googl",
  NWSA: "nws",
  UAA: "ua",
  FOX: "foxa",
  "BRK.A": "brk-b",
  "BRK-A": "brk-b",
  "BRK.B": "brk-b",
  // Yann 4 juin 2026 : 9988.HK renomme BABA (ADR US).
  "9988.HK": "baba",
  "9988-HK": "baba",
  // 18 août 2026 : renommages de tickers migrés en profondeur (data-lake,
  // KPI, ATT, index) : BK -> BNY (BNY Mellon), SATS -> ECHO (EchoStar).
  // Les ANCIENNES URL redirigent désormais vers la nouvelle page.
  BK: "bny",
  SATS: "echo",
  // Fusion AVB + EQR -> VMRK (Vivmark Residential, 17 août 2026) : les
  // anciennes pages redirigent vers la nouvelle.
  AVB: "vmrk",
  EQR: "vmrk",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const pending = getDataPendingMeta(ticker);
  if (pending)
    return {
      title: `${pending.name} · Analyse en préparation`,
      robots: { index: false, follow: false },
    };
  const r = await loadV17Company(ticker, { mode: "v18" });
  if (r.kind === "missing") return { title: "Page introuvable · Mettrik AI" };
  return {
    title: `${r.company.name} (${r.company.ticker}) · Mettrik AI`,
    robots: { index: false, follow: false },
  };
}

async function loadTranscript(ticker: string): Promise<TranscriptDoc | null> {
  const filePath = path.join(
    process.cwd(),
    "src/data/transcripts",
    `${ticker.toUpperCase()}.json`,
  );
  let doc: TranscriptDoc | null = null;
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    doc = JSON.parse(raw) as TranscriptDoc;
  } catch {
    try {
      const alt = path.join(
        process.cwd(),
        "src/data/transcripts",
        `${ticker.toLowerCase()}.json`,
      );
      const raw = await fs.readFile(alt, "utf-8");
      doc = JSON.parse(raw) as TranscriptDoc;
    } catch {
      return null;
    }
  }
  if (!doc) return null;

  // Merge le résumé PV-driven Groq Llama 3.3 si dispo.
  const summaryPath = path.join(
    process.cwd(),
    "src/data/transcript-summaries",
    `${ticker.toLowerCase()}.json`,
  );
  try {
    const raw = await fs.readFile(summaryPath, "utf-8");
    const wrapper = JSON.parse(raw) as { summary?: Record<string, unknown> };
    const s = wrapper.summary ?? {};
    type CitationPick = { citation?: string; speaker?: string; tag?: string };
    const cps = (s.citations_picks as CitationPick[] | undefined) ?? [];
    const quotes = cps.map((c) => ({
      speaker: c.speaker ?? "",
      text: c.citation ?? "",
      theme: c.tag ?? "",
    }));
    type Kpi = { nom?: string; valeur?: string; delta?: string; signal?: string };
    const kpis3 = (s.synthese_3_kpi_cles as Kpi[] | undefined) ?? [];
    const figures: { metric: string; value: string; comment?: string }[] = [];
    for (const k of kpis3) {
      if (!k.nom || !k.valeur) continue;
      figures.push({
        metric: k.nom,
        value: k.valeur,
        comment: k.delta || k.signal,
      });
    }
    const guidance = s.guidance_q_plus_1 as string | undefined;
    if (guidance) {
      figures.push({ metric: "Guidance Q+1", value: guidance.slice(0, 100) });
    }
    type Driver = { kpi?: string; interpretation_pv?: string };
    const drv = s.driver_croissance_1 as Driver | undefined;
    if (drv?.kpi && drv.interpretation_pv) {
      figures.push({
        metric: `Driver : ${drv.kpi}`,
        value: drv.interpretation_pv.slice(0, 80),
      });
    }
    const vig = s.vigilance_1 as Driver | undefined;
    if (vig?.kpi && vig.interpretation_pv) {
      figures.push({
        metric: `Vigilance : ${vig.kpi}`,
        value: vig.interpretation_pv.slice(0, 80),
      });
    }
    const tonal = String(s.tonalite_management ?? "").toLowerCase();
    let sentiment: "bullish" | "neutral" | "cautious" = "neutral";
    if (tonal.includes("confiance") || tonal.includes("optim"))
      sentiment = "bullish";
    else if (
      tonal.includes("prud") ||
      tonal.includes("inquiet") ||
      tonal.includes("vigil")
    )
      sentiment = "cautious";
    doc.extracts = {
      quotes,
      figures,
      sentiment,
      summary: String(s.tonalite_management ?? ""),
    };
  } catch {
    // No summary file, return doc as-is
  }
  return doc;
}

export default async function SandboxV195TickerPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>;
  searchParams?: Promise<{ audit_token?: string }>;
}) {
  const { ticker } = await params;
  const sp = searchParams ? await searchParams : {};
  // Yann 18 août 2026 : les non-inscrits n'accèdent PAS aux pages stés
  // (uniquement accueil + pricing). Bypass audit_token pour les vérifs
  // automatisées (curl, crons, inspections).
  const auditBypass =
    !!sp?.audit_token &&
    !!process.env.VISUAL_AUDIT_TOKEN &&
    sp.audit_token === process.env.VISUAL_AUDIT_TOKEN;
  const aliasTarget = URL_ALIASES[ticker.toUpperCase()];
  if (aliasTarget && aliasTarget !== ticker.toLowerCase()) {
    redirect(`/sandbox/v1-9-5/${aliasTarget}`);
  }

  // Sociétés dont la fiche n'est pas encore publiable (données officielles en
  // cours de vérification) : page dédiée à valeur ajoutée, plutôt qu'un redirect
  // overview ou une 404.
  if (getDataPendingMeta(ticker)) {
    return <DataPendingPage ticker={ticker} />;
  }

  // V1.9.5 strict : si pas dans clean_all, redirect vers overview.
  const cleanAll = await loadCleanAllSet();
  if (!cleanAll.has(ticker.toUpperCase())) {
    redirect("/sandbox/v1-9-5");
  }

  const locale = await getServerLocale();
  const r = await loadV17Company(ticker, { mode: "v18", locale });
  if (r.kind === "missing") {
    notFound();
  }
  if (r.kind === "preparing") {
    redirect("/sandbox/v1-9-5");
  }

  const transcript = await loadTranscript(ticker);
  const transcriptSummary = await loadTranscriptSummary(ticker);

  // Blocs désactivés (Supabase + fallback JSON) résolus pour ce ticker :
  // union(global, per-sté) avec expansion legacy gouvernance_top3.
  const disabledBlocks = await resolveDisabledForTicker(ticker);
  const historyLimitYears = await loadHistoryLimit(ticker);

  // Yann (26 mai 2026) : floutage UNIQUEMENT pour plan free réel ou anon.
  // L'admin (DESK_OWNER_EMAIL) et tout user inscrit voit en clair par défaut
  // tant qu'on n'a pas branché Supabase plans → tier = max.
  // Le cookie simulate (admin "view as") prime sur tout.
  const simulated = await readSimulateTier();
  let freemiumTier: UserTier;
  // auditBypass : tier max par défaut, mais le cookie simulate reste
  // respecté pour pouvoir prévisualiser le rendu free/premium en audit.
  if (auditBypass && !simulated) freemiumTier = "max";
  else if (auditBypass && simulated === "free") freemiumTier = "free";
  else if (auditBypass && simulated === "premium") freemiumTier = "premium";
  else if (auditBypass) freemiumTier = "max";
  else if (simulated === "anonymous") freemiumTier = "anon";
  else if (simulated === "free") freemiumTier = "free";
  else if (simulated === "premium") freemiumTier = "premium";
  else if (simulated === "max") freemiumTier = "max";
  else {
    // Pas de simulate cookie : on regarde le user réel
    try {
      const sb = await createSupabaseServerClient();
      const { data: { user } } = await sb.auth.getUser();
      // user connecté → max par défaut (pas de blur). Anon → anon (blur tout).
      freemiumTier = user ? await tierDepuisAbonnement(user) : "anon";
    } catch {
      freemiumTier = "anon";
    }
  }

  // Yann 18 août 2026 : anonyme = pas d'accès aux pages stés, redirection
  // vers l'accueil (seuls accueil + pricing sont publics). Le cookie
  // simulate "anonymous" (admin view-as) reste autorisé pour prévisualiser.
  if (freemiumTier === "anon" && simulated !== "anonymous") {
    redirect("/");
  }

  // Yann 11 juin 2026 : retire des props sérialisées (HTML) toute métadonnée de
  // provenance (yfinance / mettrik / décontamination) pour qu'elle ne soit pas
  // "potentiellement visible" (view-source). Les fichiers data restent intacts côté serveur.
  const stripMeta = <T,>(value: T): T => {
    if (typeof value === "string")
      return (/yfinance/i.test(value) ? value.replace(/yfinance[._]?\w*/gi, "données publiques") : value) as unknown as T;
    if (Array.isArray(value)) return value.map((v) => stripMeta(v)) as unknown as T;
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        const kl = k.toLowerCase();
        if (kl.includes("yfinance") || kl.startsWith("_mettrik") || kl.includes("decontaminat") || kl.includes("gresham_purged") || kl.includes("_polluted")) continue;
        out[k] = stripMeta(v);
      }
      return out as T;
    }
    return value;
  };

  // ATT (anti-thèse) : gating serveur AVANT sérialisation. Le contenu
  // complet (résumé, sections, glossaire) n'est envoyé au client QUE pour
  // le plan Max (l'admin/audit connecté est "max" par défaut). Les autres
  // tiers reçoivent uniquement titre + intensité + dates + hook + locked.
  const gatedCompany = r.company.att
    ? { ...r.company, att: gateAttForTier(r.company.att, freemiumTier) }
    : r.company;

  // Yann 30 aout 2026 : palier gratuit et anonyme, le texte des zones
  // floutees est CAVIARDE ici, cote serveur, avant tout rendu. Le vrai texte
  // ne part jamais au navigateur (copier-coller, impression, code source :
  // seul le charabia est recuperable). Les societes exemptees (zones vides)
  // et les offres payantes recoivent la fiche entiere.
  const estGratuit = freemiumTier === "free" || freemiumTier === "anon";
  const zonesEffectives = estGratuit
    ? (await chargeZonesFloutage(r.company.ticker)).zones
    : [];
  const servedCompany = estGratuit
    ? caviardeCompanyPourGratuit(gatedCompany, zonesEffectives)
    : gatedCompany;
  const servedTranscriptSummary = estGratuit
    ? caviardeTranscriptsPourGratuit(transcriptSummary ?? null, zonesEffectives)
    : transcriptSummary;

  return (
    <FreemiumBlurProvider tier={freemiumTier}>
      <CompanyView
        company={stripMeta(servedCompany)}
        authSlot={<AuthNav scope="company" />}
        transcript={estGratuit ? caviardeTranscriptDocPourGratuit(transcript, zonesEffectives) : transcript}
        transcriptSummary={servedTranscriptSummary}
        v18Mode
        freemiumTier={freemiumTier}
        disabledBlocks={disabledBlocks}
        historyLimitYears={historyLimitYears}
      />
    </FreemiumBlurProvider>
  );
}
