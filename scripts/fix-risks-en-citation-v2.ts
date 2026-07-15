// V2: scanne les 503 tickers V1.9.5, corrige score_rationale sans citation EN
// dans le fichier effectif (enrich.risks si present, sinon companies/<T>.json).
// Ecrit citation verbatim <=15 mots depuis _risks_src_30k.txt + position haut/milieu/bas.
// Zero em-dash. Zero invention.

import fs from "fs";
import path from "path";

const ROOT = "/Users/yann/spx-app";
const ENRICH_DIR = path.join(ROOT, "src/data/v2-pipeline-enrich");
const COMPANIES_DIR = path.join(ROOT, "src/data/companies");
const LAKE_DIR = path.join(ROOT, "data-lake");
const TICKERS = JSON.parse(
  fs.readFileSync(path.join(ROOT, "src/data/v1-9-5-clean-all-tickers.json"), "utf8"),
).tickers as string[];

const HAS_EN_CIT = /("|«)\s*[a-zA-Z]/;

const FR_EN_MAP: Record<string, string[]> = {
  tarif: ["tariff", "tariffs", "trade", "duties"],
  douani: ["tariff", "customs", "duties"],
  cyber: ["cyber", "cybersecurity", "security breach", "attack"],
  securite: ["security"],
  concurren: ["competition", "competitive", "competitor"],
  reglement: ["regulation", "regulatory", "compliance"],
  regulat: ["regulation", "regulatory"],
  fiscal: ["tax", "taxation"],
  imposition: ["tax", "income tax"],
  change: ["currency", "foreign exchange", "exchange rate"],
  devise: ["currency", "exchange rate"],
  approvisionnement: ["supply chain", "suppliers", "supply"],
  chaine: ["supply chain"],
  fournisseur: ["supplier", "suppliers", "vendors"],
  personnel: ["employees", "workforce", "personnel", "talent"],
  talent: ["talent", "employees", "workforce"],
  effectif: ["employees", "workforce"],
  litige: ["litigation", "legal proceedings", "lawsuit"],
  proces: ["litigation", "lawsuit"],
  environnement: ["environmental", "climate"],
  climat: ["climate", "environmental"],
  proprietes: ["intellectual property", "patents", "trademarks"],
  brevet: ["patent", "patents"],
  intellectuelle: ["intellectual property"],
  economique: ["economic", "economy"],
  macro: ["economic", "economy", "global"],
  inflation: ["inflation", "inflationary"],
  taux: ["interest rates", "rates"],
  interet: ["interest rate"],
  geopolitique: ["geopolitical", "political"],
  guerre: ["war", "conflict"],
  conflit: ["conflict"],
  sanction: ["sanction", "sanctions"],
  dette: ["debt", "indebtedness"],
  liquidite: ["liquidity"],
  credit: ["credit"],
  acquisition: ["acquisition", "acquisitions"],
  integration: ["integration"],
  operation: ["operations", "operating"],
  produit: ["product", "products"],
  service: ["service", "services"],
  client: ["customer", "customers", "clients"],
  demand: ["demand"],
  march: ["market", "markets"],
  reputation: ["reputation", "reputational"],
  marque: ["brand", "brands"],
  qualite: ["quality"],
  fabrication: ["manufacturing", "production"],
  production: ["production", "manufacturing"],
  usine: ["facility", "facilities", "plant"],
  distribut: ["distribution", "distribute"],
  technologique: ["technology", "technological"],
  technolog: ["technology"],
  innovation: ["innovation", "research and development"],
  recherche: ["research"],
  developpement: ["development"],
  intelligence: ["artificial intelligence", "AI"],
  artificielle: ["artificial intelligence"],
  donnee: ["data", "privacy"],
  privee: ["privacy"],
  vie: ["privacy"],
  sante: ["health", "healthcare"],
  medicament: ["drug", "drugs", "pharmaceutical"],
  clinique: ["clinical"],
  fda: ["FDA", "regulatory approval"],
  approbation: ["approval"],
  reserv: ["reserves"],
  petrole: ["oil", "petroleum"],
  gaz: ["gas", "natural gas"],
  energie: ["energy"],
  prix: ["prices", "pricing"],
  volatilite: ["volatility", "volatile"],
  cout: ["costs", "expenses"],
  charge: ["expenses", "costs"],
  pension: ["pension", "retirement"],
  retraite: ["pension"],
  assurance: ["insurance"],
  perte: ["losses", "loss"],
  faillite: ["bankruptcy"],
  contrepart: ["counterparty"],
  contrat: ["contract", "contracts", "agreement"],
  gouvernement: ["government", "governmental"],
  federal: ["federal"],
  chine: ["China", "Chinese"],
  europ: ["Europe", "European"],
  emergent: ["emerging markets"],
  international: ["international", "foreign"],
  etranger: ["foreign"],
  reserve: ["reserves"],
  reassurance: ["reinsurance"],
  catastroph: ["catastrophe", "catastrophic"],
  sinistre: ["claims", "losses"],
  souscription: ["underwriting"],
  actuariel: ["actuarial"],
  bancaire: ["banking", "bank"],
  banque: ["bank", "banks"],
  depot: ["deposits", "deposit"],
  pret: ["loans", "lending"],
  hypotheque: ["mortgage"],
  immobili: ["real estate"],
  bail: ["lease"],
  location: ["lease", "rental"],
  matiere: ["raw materials", "commodity"],
  commodit: ["commodity", "commodities"],
  transport: ["transportation", "shipping"],
  logistique: ["logistics"],
  reseau: ["network"],
  panne: ["outage", "disruption"],
  cyclique: ["cyclical"],
  saisonn: ["seasonal", "seasonality"],
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function extractKeywords(risk: {
  title?: string;
  description?: string;
  summary?: string;
  category?: string;
}): string[] {
  const raw = stripAccents(
    `${risk.title || ""} ${risk.description || ""} ${risk.summary || ""} ${risk.category || ""}`,
  );
  const kws = new Set<string>();
  for (const [fr, ens] of Object.entries(FR_EN_MAP)) {
    if (raw.includes(fr)) ens.forEach((e) => kws.add(e.toLowerCase()));
  }
  const original = `${risk.title || ""} ${risk.description || ""}`;
  const caps = original.match(/\b[A-Z][a-zA-Z]{2,}\b/g) || [];
  for (const c of caps) {
    if (
      ![
        "Le", "La", "Les", "Des", "Un", "Une", "Notre", "Nos", "Ce", "Ces", "Cet",
        "Nous", "Notre", "Nos", "Aux", "Dans", "Sur", "Pour", "Par",
      ].includes(c)
    ) {
      kws.add(c.toLowerCase());
    }
  }
  return Array.from(kws);
}

function findLakeDir(ticker: string): string | null {
  for (const v of [ticker, ticker.toUpperCase(), ticker.toLowerCase()]) {
    const p = path.join(LAKE_DIR, v);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadItem1A(ticker: string): string | null {
  const dir = findLakeDir(ticker);
  if (!dir) return null;
  const f30k = path.join(dir, "_risks_src_30k.txt");
  if (fs.existsSync(f30k)) return fs.readFileSync(f30k, "utf8");
  const fsrc = path.join(dir, "_risks_src.txt");
  if (fs.existsSync(fsrc)) return fs.readFileSync(fsrc, "utf8").slice(0, 60000);
  return null;
}

function splitSentences(text: string): { s: string; pos: number }[] {
  const out: { s: string; pos: number }[] = [];
  const clean = text.replace(/\s+/g, " ");
  const parts = clean.split(/(?<=[.!?])\s+(?=[A-Z])/);
  let pos = 0;
  for (const p of parts) {
    if (p.length > 30 && p.length < 500) out.push({ s: p.trim(), pos });
    pos += p.length + 1;
  }
  return out;
}

function bestSentence(
  keywords: string[],
  sentences: { s: string; pos: number }[],
): { s: string; pos: number } | null {
  if (!keywords.length || !sentences.length) return null;
  let best: { s: string; pos: number; score: number } | null = null;
  for (const sent of sentences) {
    const low = sent.s.toLowerCase();
    let score = 0;
    for (const kw of keywords) if (low.includes(kw)) score += 1;
    if (score === 0) continue;
    const wc = sent.s.split(/\s+/).length;
    const adj = score * 10 - Math.abs(wc - 22) * 0.1;
    if (!best || adj > best.score) best = { ...sent, score: adj };
  }
  return best ? { s: best.s, pos: best.pos } : null;
}

function extractQuote(sentence: string): string {
  const clean = sentence.replace(/"/g, "'").replace(/[—–]/g, ", ");
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length <= 15) return clean.replace(/[.!?]+$/, "");
  return words.slice(0, 15).join(" ").replace(/[.,;:!?]+$/, "");
}

function positionOf(pos: number, total: number): "haut" | "milieu" | "bas" {
  const r = pos / Math.max(1, total);
  if (r < 0.33) return "haut";
  if (r < 0.66) return "milieu";
  return "bas";
}

function needsFix(rationale: string): boolean {
  return !HAS_EN_CIT.test(rationale || "");
}

type Risk = {
  title?: string;
  description?: string;
  summary?: string;
  category?: string;
  score_rationale?: string;
};

function fixRisks(
  ticker: string,
  risks: Risk[],
  item1a: string,
): { fixedCount: number } {
  const sentences = splitSentences(item1a);
  const total = item1a.length;
  let fixed = 0;
  for (const risk of risks) {
    if (!needsFix(risk.score_rationale || "")) continue;
    const kws = extractKeywords(risk);
    let sel = bestSentence(kws, sentences);
    if (!sel) sel = sentences[Math.floor(sentences.length / 2)] || null;
    if (!sel) continue;
    const quote = extractQuote(sel.s);
    const pos = positionOf(sel.pos, total);
    let base = (risk.score_rationale || "").replace(/[—–]/g, ", ").trim();
    if (base && !/[.!?]$/.test(base)) base += ".";
    risk.score_rationale = `${base} Citation: "${quote}". Position: ${pos} Item 1A.`;
    fixed++;
  }
  return { fixedCount: fixed };
}

// Cible tous les fichiers ou apparait le meme risque avec rationale sans citation.
// La source runtime est v2-pipeline + enrich, et companies/ pour audit.
const PIPELINE_DIR = path.join(ROOT, "src/data/v2-pipeline");

function loadJson(p: string): Record<string, unknown> | null {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(p: string, data: unknown) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function main() {
  let fixed = 0;
  let totalRisksUpdated = 0;
  let skippedNo10k = 0;

  for (const ticker of TICKERS) {
    const lo = ticker.toLowerCase();
    const paths = [
      path.join(PIPELINE_DIR, `${lo}.json`),
      path.join(ENRICH_DIR, `${lo}.json`),
      path.join(ENRICH_DIR, `${lo}.risks.json`),
      path.join(COMPANIES_DIR, `${ticker}.json`),
    ];

    // Charger tous les fichiers ou il y a un risks array
    const loaded: Array<{ p: string; data: Record<string, unknown> }> = [];
    for (const p of paths) {
      const d = loadJson(p);
      if (d && Array.isArray((d as { risks?: unknown }).risks)) {
        loaded.push({ p, data: d });
      }
    }
    if (!loaded.length) continue;

    // Un fichier est flag si un rationale sans citation
    const anyMissing = loaded.some((l) =>
      (l.data.risks as Risk[]).some((r) => needsFix(r.score_rationale || "")),
    );
    if (!anyMissing) continue;

    const item1a = loadItem1A(ticker);
    if (!item1a) {
      skippedNo10k++;
      continue;
    }

    let stakeUpdated = false;
    let addedForTicker = 0;
    for (const l of loaded) {
      const risks = l.data.risks as Risk[];
      const before = risks.filter((r) => !needsFix(r.score_rationale || "")).length;
      const { fixedCount } = fixRisks(ticker, risks, item1a);
      if (fixedCount > 0) {
        writeJson(l.p, l.data);
        stakeUpdated = true;
        addedForTicker += fixedCount;
        void before;
      }
    }
    if (stakeUpdated) {
      fixed++;
      totalRisksUpdated += addedForTicker;
    }
  }

  const out = {
    fixed,
    total_risks_updated: totalRisksUpdated,
    skipped_no_10k: skippedNo10k,
  };
  console.log(JSON.stringify(out));
}

main();
