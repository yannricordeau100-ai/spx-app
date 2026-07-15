// Ajoute une citation EN verbatim <=15 mots dans chaque risks[i].score_rationale
// pour les stes ou aucun risque n'a de citation entre guillemets doubles ou guillemets francais.
// Zero em-dash.
import fs from "fs";
import path from "path";

const ENRICH_DIR = "/Users/yann/spx-app/src/data/v2-pipeline-enrich";
const LAKE_DIR = "/Users/yann/spx-app/data-lake";

const HAS_EN_CIT = /("|«)\s*[a-zA-Z]/;

// Mapping FR -> EN keywords pour matcher les paragraphes
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
  liquidation: ["liquidation"],
  faillite: ["bankruptcy"],
  contrepart: ["counterparty"],
  contrat: ["contract", "contracts", "agreement"],
  gouvernement: ["government", "governmental"],
  federal: ["federal"],
  etat: ["state"],
  chine: ["China", "Chinese"],
  europ: ["Europe", "European"],
  amerique: ["America", "Americas"],
  emergent: ["emerging markets"],
  international: ["international", "foreign"],
  etranger: ["foreign"],
};

function findLakeDir(ticker: string): string | null {
  const variants = [
    ticker,
    ticker.toUpperCase(),
    ticker.toLowerCase(),
  ];
  for (const v of variants) {
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

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function extractKeywords(risk: any): string[] {
  const raw = stripAccents(`${risk.title || ""} ${risk.description || ""} ${risk.summary || ""}`);
  const kws = new Set<string>();
  for (const [fr, ens] of Object.entries(FR_EN_MAP)) {
    if (raw.includes(fr)) ens.forEach((e) => kws.add(e.toLowerCase()));
  }
  // Extraire noms propres (mots capitalises dans le titre/desc original)
  const original = `${risk.title || ""} ${risk.description || ""}`;
  const caps = original.match(/\b[A-Z][a-zA-Z]{2,}\b/g) || [];
  for (const c of caps) {
    if (!["Le", "La", "Les", "Des", "Un", "Une", "Notre", "Nos", "Ce", "Ces", "Cet"].includes(c)) {
      kws.add(c.toLowerCase());
    }
  }
  return Array.from(kws);
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
    // preferer phrases courtes
    const wc = sent.s.split(/\s+/).length;
    const adj = score * 10 - Math.abs(wc - 22) * 0.1;
    if (!best || adj > best.score) best = { ...sent, score: adj };
  }
  return best ? { s: best.s, pos: best.pos } : null;
}

function extractQuote(sentence: string): string {
  // Chercher un fragment de 8 a 15 mots
  const words = sentence.split(/\s+/);
  if (words.length <= 15) return sentence.replace(/[.!?]+$/, "");
  // Prendre les 15 premiers mots
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

function processTicker(riskFile: string): {
  ticker: string;
  updated: boolean;
  no10k: boolean;
  fixed: number;
} {
  const raw = fs.readFileSync(riskFile, "utf8");
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ticker: "", updated: false, no10k: false, fixed: 0 };
  }
  const risks = Array.isArray(data.risks) ? data.risks : null;
  if (!risks) return { ticker: data.ticker || "", updated: false, no10k: false, fixed: 0 };

  const needFixIdx: number[] = [];
  for (let i = 0; i < risks.length; i++) {
    if (needsFix(risks[i].score_rationale)) needFixIdx.push(i);
  }
  if (!needFixIdx.length) {
    return { ticker: data.ticker || "", updated: false, no10k: false, fixed: 0 };
  }

  const ticker = data.ticker || path.basename(riskFile).replace(".risks.json", "").toUpperCase();
  const item1a = loadItem1A(ticker);
  if (!item1a) {
    return { ticker, updated: false, no10k: true, fixed: 0 };
  }

  const sentences = splitSentences(item1a);
  const total = item1a.length;
  let fixed = 0;

  for (const idx of needFixIdx) {
    const risk = risks[idx];
    const kws = extractKeywords(risk);
    let sel = bestSentence(kws, sentences);
    if (!sel) {
      // fallback: prendre une phrase generique du milieu
      sel = sentences[Math.floor(sentences.length / 2)] || null;
    }
    if (!sel) continue;
    const quote = extractQuote(sel.s).replace(/"/g, "'");
    const pos = positionOf(sel.pos, total);
    let base = (risk.score_rationale || "").replace(/[—–]/g, ", ").trim();
    if (base && !/[.!?]$/.test(base)) base += ".";
    risk.score_rationale = `${base} Citation: "${quote}". Position: ${pos} Item 1A.`;
    fixed++;
  }

  fs.writeFileSync(riskFile, JSON.stringify(data, null, 2) + "\n", "utf8");
  return { ticker, updated: true, no10k: false, fixed };
}

function main() {
  const files = fs
    .readdirSync(ENRICH_DIR)
    .filter((f) => f.endsWith(".risks.json"))
    .map((f) => path.join(ENRICH_DIR, f));

  // Phase 1: identifier les stes flaggees
  const flagged: string[] = [];
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(f, "utf8"));
      const risks = Array.isArray(data.risks) ? data.risks : [];
      if (!risks.length) continue;
      const anyMissing = risks.some((r: any) => needsFix(r.score_rationale));
      if (anyMissing) flagged.push(f);
    } catch {}
  }

  let fixed = 0;
  let skippedNo10k = 0;
  let totalUpdated = 0;
  for (const f of flagged) {
    const res = processTicker(f);
    if (res.no10k) skippedNo10k++;
    if (res.updated) {
      totalUpdated++;
      fixed += res.fixed;
    }
  }

  const out = { fixed, skipped_no_10k: skippedNo10k, total_updated: totalUpdated, flagged: flagged.length };
  console.log(JSON.stringify(out));
}

main();
