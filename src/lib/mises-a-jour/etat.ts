import { promises as fs } from "node:fs";
import path from "node:path";
import REGLES from "@/data/mise-a-jour-regles.json";
import { etatSynchro } from "@/lib/synchro/etat";

/**
 * Etat de mise a jour des fiches par bloc (Yann 13 sept 2026).
 * Calcule UNIQUEMENT a partir des dates presentes dans les donnees et du
 * calendrier des resultats : aucune dependance aux journaux des crons, donc
 * l alerte ne tombe pas avec eux. Regles : src/data/mise-a-jour-regles.json.
 *  vert   : bloc date >= date de reference (derniere publication ou rapport annuel)
 *  orange : date du bloc inconnue, ou publication trop recente (delai J+3 non echu)
 *  rouge  : delai echu et bloc anterieur a la publication
 */
export type Feu = "vert" | "orange" | "rouge";
export type LigneBloc = { ticker: string; nom: string; feu: Feu; bloc_date: string | null; reference: string | null; jours: number | null; motif: string };
export type EtatBloc = { id: string; nom: string; declencheur: string; delai_jours: number; vert: number; orange: number; rouge: number; rouges: LigneBloc[]; oranges_exemples: string[] };
export type EtatMisesAJour = { calculeLe: string; univers: number; blocs: EtatBloc[]; rougesTotal: number; stesRouges: string[] };

type Regle = { id: string; nom: string; declencheur: string; delai_jours: number };
const ROOT = process.cwd();
async function lire<T>(p: string): Promise<T | null> { try { return JSON.parse(await fs.readFile(p, "utf-8")) as T; } catch { return null; } }
const jours = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);
const iso = (s: unknown) => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);

function feu(blocDate: string | null, reference: string | null, delai: number, today: string): { feu: Feu; jours: number | null; motif: string } {
  if (!reference) return { feu: "orange", jours: null, motif: "date de publication inconnue" };
  if (!blocDate) return { feu: "orange", jours: null, motif: "date du bloc inconnue (champ _maj absent)" };
  if (blocDate >= reference) return { feu: "vert", jours: 0, motif: "à jour" };
  const retard = jours(today, reference) - delai;
  if (retard <= 0) return { feu: "orange", jours: 0, motif: `publication le ${reference}, délai J+${delai} en cours` };
  return { feu: "rouge", jours: retard, motif: `publication le ${reference}, bloc daté du ${blocDate}` };
}

export async function calculerEtatMisesAJour(): Promise<EtatMisesAJour> {
  const today = new Date().toISOString().slice(0, 10);
  const uni = (await lire<{ tickers: string[] }>(path.join(ROOT, "src/data/v1-9-5-clean-all-tickers.json")))?.tickers ?? [];
  const cal = await lire<{ par_ticker: Record<string, { prochaine?: string | null; precedente?: string | null }> }>(path.join(ROOT, "src/data/earnings-calendar.json"));
  const noms = (await lire<Record<string, { name?: string }>>(path.join(ROOT, "src/data/v1-7-public.json"))) ?? {};
  const rangs = await lire<{ generation?: string }>(path.join(ROOT, "src/data/market-cap-order.json"));
  const synchro = await etatSynchro();
  const regles = (REGLES as { blocs: Regle[] }).blocs;
  const blocs: EtatBloc[] = regles.map((r) => ({ ...r, vert: 0, orange: 0, rouge: 0, rouges: [], oranges_exemples: [] }));
  const parId = Object.fromEntries(blocs.map((b) => [b.id, b]));
  const stesRouges = new Set<string>();
  const pose = (b: EtatBloc, l: LigneBloc) => {
    b[l.feu]++;
    if (l.feu === "rouge") { b.rouges.push(l); stesRouges.add(l.ticker); }
    else if (l.feu === "orange" && b.oranges_exemples.length < 8) b.oranges_exemples.push(l.ticker);
  };
  // Blocs deja couverts par la synchro (transcripts, KPI IC, stories) : retards vs depots SEC.
  const synchroVers = { transcripts: "transcript", kpi_ic: "kpi_ic", kpi_stories: "kpi_stories" } as const;
  for (const [cat, id] of Object.entries(synchroVers)) {
    const b = parId[id]; const c = synchro.categories[cat as keyof typeof synchroVers];
    if (!b || !c) continue;
    b.vert = c.aJour; b.orange = c.sansDonnee + c.horsSec;
    for (const r of c.retards) {
      if (r.joursRetard > b.delai_jours) pose(b, { ticker: r.ticker, nom: noms[r.ticker]?.name ?? r.ticker, feu: "rouge", bloc_date: r.page, reference: r.reel, jours: r.joursRetard - b.delai_jours, motif: `dépôt du ${r.depose}, page datée du ${r.page ?? "?"}` });
      else b.orange++;
    }
  }
  const rangDate = iso(rangs?.generation);
  for (const t of uni) {
    const nom = noms[t]?.name ?? t;
    const enrich = await lire<Record<string, unknown>>(path.join(ROOT, "src/data/v2-pipeline-enrich", `${t.toLowerCase()}.json`));
    const resume = await lire<{ fetched_at?: string }>(path.join(ROOT, "src/data/transcript-summaries", `${t.toLowerCase()}.json`));
    const publication = iso(cal?.par_ticker?.[t]?.precedente) ?? iso((enrich?.latest_filing as { date?: string } | undefined)?.date);
    const filing = enrich?.latest_filing as { date?: string; form?: string } | undefined;
    const rapportAnnuel = filing && /10-K|20-F|40-F/.test(filing.form ?? "") ? iso(filing.date) : null;
    // Convention : _maj_<bloc> ; on accepte aussi les variantes posees par certaines passes (_maj_repartition_ca).
    const maj = (k: string) => iso(enrich?.[`_maj_${k}`]) ?? (k === "repartition" ? iso(enrich?.["_maj_repartition_ca"]) : null);
    // rang : hebdomadaire, reference = aujourd hui - 7 jours
    { const b = parId.rang; if (b) { const r = rangDate ? (jours(today, rangDate) > 7 ? "rouge" : "vert") : "orange"; pose(b, { ticker: t, nom, feu: r, bloc_date: rangDate, reference: today, jours: rangDate ? Math.max(0, jours(today, rangDate) - 7) : null, motif: rangDate ? `dernier classement le ${rangDate}` : "date du classement inconnue" }); } }
    { const b = parId.synthese; if (b) { const d = iso(resume?.fetched_at); const f = feu(d, publication, b.delai_jours, today); pose(b, { ticker: t, nom, bloc_date: d, reference: publication, ...f }); } }
    { const b = parId.positionnement_ia; if (b) { const d = maj("positionnement_ia"); const f = feu(d, publication, b.delai_jours, today); pose(b, { ticker: t, nom, bloc_date: d, reference: publication, ...f }); } }
    for (const id of ["risques", "repartition", "gouvernance"]) {
      const b = parId[id]; if (!b) continue;
      let d = maj(id);
      if (!d && id === "repartition") d = iso((enrich?.revenue_by_segment as { source_date?: string } | undefined)?.source_date);
      const f = feu(d, rapportAnnuel, b.delai_jours, today);
      pose(b, { ticker: t, nom, bloc_date: d, reference: rapportAnnuel, ...f, motif: rapportAnnuel ? f.motif : "dernier rapport annuel non identifié (dernier dépôt = trimestriel)" });
    }
  }
  for (const b of blocs) b.rouges.sort((a, c) => (c.jours ?? 0) - (a.jours ?? 0));
  return { calculeLe: new Date().toISOString(), univers: uni.length, blocs, rougesTotal: blocs.reduce((n, b) => n + b.rouge, 0), stesRouges: [...stesRouges].sort() };
}
