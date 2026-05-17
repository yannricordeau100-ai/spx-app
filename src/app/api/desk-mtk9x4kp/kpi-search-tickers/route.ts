/**
 * /api/desk-mtk9x4kp/kpi-search-tickers — POST
 *
 * Prend une description en langage naturel et renvoie la liste des tickers
 * pertinents trouvés par Groq Llama 3.3 70B (free tier) parmi l'univers
 * complet Mettrik (V1.8 top 307 + v2-pipeline _tickers-index ~2200 stés).
 *
 * Auth : requireDeskOwner() (Yann uniquement).
 *
 * Réponse :
 *   { tickers: string[], rationale: string, confidence: number }
 *
 * Cache mémoire 1h sur (description normalisée) pour limiter les appels Groq.
 */

import { NextResponse, type NextRequest } from "next/server";
import path from "node:path";
import { promises as fs } from "node:fs";
import { requireDeskOwner } from "@/lib/desk/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const MAX_TICKERS_RETURNED = 50;

type CacheEntry = {
  expiresAt: number;
  payload: { tickers: string[]; rationale: string; confidence: number };
};
const cache = new Map<string, CacheEntry>();

type UniverseEntry = { ticker: string; name?: string; sector?: string };

let cachedUniverse: UniverseEntry[] | null = null;
let cachedUniverseAt = 0;
const UNIVERSE_TTL_MS = 5 * 60 * 1000; // 5 min (rebuild horaire côté cron)

async function loadUniverse(): Promise<UniverseEntry[]> {
  const now = Date.now();
  if (cachedUniverse && now - cachedUniverseAt < UNIVERSE_TTL_MS) {
    return cachedUniverse;
  }
  const root = process.cwd();
  const byTicker = new Map<string, UniverseEntry>();

  // 1. v2-pipeline/_tickers-index.json (univers exhaustif ~2200 stés)
  try {
    const raw = await fs.readFile(
      path.join(root, "src/data/v2-pipeline/_tickers-index.json"),
      "utf8",
    );
    const arr = JSON.parse(raw) as Array<{
      ticker: string;
      name?: string;
      sector?: string;
    }>;
    for (const e of arr) {
      if (!e?.ticker) continue;
      const key = e.ticker.toUpperCase();
      if (!byTicker.has(key)) {
        byTicker.set(key, {
          ticker: e.ticker,
          name: e.name ?? undefined,
          sector: e.sector ?? undefined,
        });
      }
    }
  } catch {
    // best effort, fallback v1-8
  }

  // 2. v1-8-tickers-sorted.json (top 307 V18, ajoute tickers non vus)
  try {
    const raw = await fs.readFile(
      path.join(root, "src/data/v1-8-tickers-sorted.json"),
      "utf8",
    );
    const arr = JSON.parse(raw) as string[];
    for (const t of arr) {
      if (!t) continue;
      const key = t.toUpperCase();
      if (!byTicker.has(key)) {
        byTicker.set(key, { ticker: t });
      }
    }
  } catch {
    // best effort
  }

  // 3. sp500-tickers.json (pour résilience si _tickers-index vide)
  try {
    const raw = await fs.readFile(
      path.join(root, "src/data/sp500-tickers.json"),
      "utf8",
    );
    const arr = JSON.parse(raw) as Array<string | { ticker: string }>;
    for (const e of arr) {
      const t = typeof e === "string" ? e : e?.ticker;
      if (!t) continue;
      const key = t.toUpperCase();
      if (!byTicker.has(key)) byTicker.set(key, { ticker: t });
    }
  } catch {
    // best effort
  }

  const result = Array.from(byTicker.values());
  cachedUniverse = result;
  cachedUniverseAt = now;
  return result;
}

function normalizeDescription(input: string): string {
  return input.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildPrompt(description: string, universe: UniverseEntry[]): string {
  // Limite contexte LLM : on envoie ticker + name (+ sector si court).
  // Universe ~2200 stés × ~60 chars ≈ ~130 KB texte. Llama 3.3 accepte 128k
  // tokens donc on tient large.
  const lines = universe.map((e) => {
    const parts: string[] = [e.ticker];
    if (e.name) parts.push(e.name);
    if (e.sector) parts.push(e.sector);
    return parts.join(" | ");
  });
  return `Tu es un analyste financier. Voici une demande utilisateur :
"""${description}"""

Voici la liste des tickers disponibles (format ticker | nom | secteur) :
${lines.join("\n")}

Retourne UNIQUEMENT un JSON valide avec exactement cette structure :
{
  "tickers": ["TICKER1", "TICKER2", ...],
  "rationale": "1 phrase courte expliquant le choix",
  "confidence": 0.85
}

RÈGLES STRICTES :
- Sélectionne uniquement les tickers VRAIMENT pertinents pour la demande.
- Maximum ${MAX_TICKERS_RETURNED} tickers. Privilégie la qualité à la quantité.
- Les tickers doivent EXACTEMENT matcher la liste ci-dessus (casse + suffixes type .PA, .SW, .L compris).
- confidence entre 0 et 1, indique ta certitude.
- Pas de texte avant ou après le JSON. Pas de \`\`\`json fence.`;
}

type GroqResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

async function callGroq(prompt: string): Promise<{
  tickers: string[];
  rationale: string;
  confidence: number;
}> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY manquante côté serveur");
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Tu es un analyste financier. Tu réponds STRICTEMENT en JSON valide, rien d'autre.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Groq HTTP ${res.status} : ${txt.slice(0, 300)}`);
  }
  const j = (await res.json()) as GroqResponse;
  const content = j.choices?.[0]?.message?.content ?? "";
  // Strip éventuelle fence ```json ... ```
  const m = content.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = (m ? m[1] : content).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(
      `Parse JSON Groq échoué : ${(e as Error).message}. Raw : ${content.slice(0, 200)}`,
    );
  }
  const obj = parsed as {
    tickers?: unknown;
    rationale?: unknown;
    confidence?: unknown;
  };
  const tickers = Array.isArray(obj.tickers)
    ? (obj.tickers.filter((t): t is string => typeof t === "string") as string[])
    : [];
  const rationale =
    typeof obj.rationale === "string" ? obj.rationale : "";
  const confidence =
    typeof obj.confidence === "number" ? obj.confidence : 0.5;
  return {
    tickers: tickers.slice(0, MAX_TICKERS_RETURNED),
    rationale,
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}

export async function POST(req: NextRequest) {
  await requireDeskOwner();
  const body = (await req.json().catch(() => ({}))) as { description?: string };
  const description = (body.description ?? "").trim();
  if (!description) {
    return NextResponse.json(
      { error: "description requise" },
      { status: 400 },
    );
  }
  if (description.length > 2000) {
    return NextResponse.json(
      { error: "description trop longue (>2000 chars)" },
      { status: 400 },
    );
  }

  const cacheKey = normalizeDescription(description);
  const cached = cache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return NextResponse.json({ ...cached.payload, cached: true });
  }

  const universe = await loadUniverse();
  if (universe.length === 0) {
    return NextResponse.json(
      { error: "univers tickers vide (data files manquants)" },
      { status: 500 },
    );
  }

  // Filtre le résultat Groq aux tickers existants dans l'univers
  // (sécurité contre hallucinations).
  const universeSet = new Set(universe.map((e) => e.ticker.toUpperCase()));

  const prompt = buildPrompt(description, universe);
  try {
    const groqResult = await callGroq(prompt);
    const filtered = groqResult.tickers.filter((t) =>
      universeSet.has(t.toUpperCase()),
    );
    const payload = {
      tickers: filtered,
      rationale: groqResult.rationale,
      confidence: groqResult.confidence,
    };
    cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, payload });
    return NextResponse.json({ ...payload, cached: false });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
