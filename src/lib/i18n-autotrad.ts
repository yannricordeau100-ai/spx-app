/**
 * i18n-autotrad.ts — traduction automatique FR → N langues via Groq Llama 3.3 70B.
 *
 * Endpoint : https://api.groq.com/openai/v1/chat/completions
 * Model    : llama-3.3-70b-versatile (free tier ~5000 req/jour)
 * Env var  : GROQ_API_KEY
 *
 * Usage typique (server-side uniquement, jamais côté client) :
 *
 *   import { translateToAllLocales } from "@/lib/i18n-autotrad";
 *   const map = await translateToAllLocales(
 *     "Soit moins que le prix d'un café",
 *     ["en", "en-GB", "de", "de-CH", "nl"]
 *   );
 *   // → { en: "...", "en-GB": "...", de: "...", ... }
 *
 * Hash-diff côté caller : stocker `text_fr_hash` (SHA-256) à côté du
 * dictionnaire i18n et ne re-traduire que si le hash change.
 *
 * Réutilisable : pour features (Agent B), KPI labels, n'importe quel
 * texte marketing court. Garde le prompt système générique mais
 * orienté SaaS finance / persuasif.
 */

import { createHash } from "node:crypto";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

/** Liste des locales supportées pour autotrad (cf src/lib/i18n/types.ts). */
export type AutotradLocale = "en" | "en-GB" | "de" | "de-CH" | "nl";

/** Nom complet par locale pour guider le LLM. */
const LOCALE_FULL_NAME: Record<AutotradLocale, string> = {
  "en": "English (US)",
  "en-GB": "English (UK, British spelling and idioms)",
  "de": "Deutsch (Standard German for Germany / Austria)",
  "de-CH": "Schweizerdeutsch (Swiss High German, Helvetisms allowed)",
  "nl": "Nederlands (Dutch for Netherlands / Belgium)",
};

/**
 * SHA-256 hex du texte FR. Utilisé par les callers pour décider si la
 * retraduction est nécessaire (idempotence côté BDD).
 */
export function hashTextFr(textFr: string): string {
  return createHash("sha256").update(textFr, "utf8").digest("hex");
}

type GroqChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

/**
 * Traduit `textFr` vers UNE locale donnée. Retourne `null` si l'appel
 * échoue (ne throw pas pour ne pas bloquer les autres traductions du batch).
 */
async function translateOne(
  textFr: string,
  locale: AutotradLocale,
  apiKey: string,
): Promise<string | null> {
  const localeFull = LOCALE_FULL_NAME[locale];
  const systemPrompt =
    "Tu es un traducteur professionnel marketing SaaS finance. " +
    `Traduis cette phrase FR en ${localeFull}. ` +
    "Garde le ton léger/persuasif. " +
    "Retourne UNIQUEMENT la traduction, pas de commentaire, pas de quotes.";

  try {
    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: textFr },
        ],
        temperature: 0.3,
        max_tokens: 400,
      }),
    });
    if (!res.ok) {
      return null;
    }
    const j = (await res.json()) as GroqChatResponse;
    const content = j.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    // Strip éventuels quotes wrapping malgré le prompt.
    return content.replace(/^["'`]+|["'`]+$/g, "").trim();
  } catch {
    return null;
  }
}

/**
 * Traduit `textFr` vers TOUTES les locales demandées en parallèle (Promise.all).
 *
 * - Si `textFr` est vide ou GROQ_API_KEY absente → retourne `{}` (caller
 *   décide du fallback côté front).
 * - Erreur sur 1 locale → cette locale est absente du résultat (les autres
 *   passent). Pas de throw global.
 *
 * @param textFr Texte source en français.
 * @param locales Locales cibles. Si omis, traduit vers les 5 par défaut.
 */
export async function translateToAllLocales(
  textFr: string,
  locales: AutotradLocale[] = ["en", "en-GB", "de", "de-CH", "nl"],
): Promise<Record<string, string>> {
  const trimmed = (textFr ?? "").trim();
  if (!trimmed) return {};

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    // Pas de clé → on retourne vide. Le caller log côté admin si besoin.
    return {};
  }

  const results = await Promise.all(
    locales.map(async (locale) => {
      const translated = await translateOne(trimmed, locale, apiKey);
      return [locale, translated] as const;
    }),
  );

  const out: Record<string, string> = {};
  for (const [locale, translated] of results) {
    if (translated) out[locale] = translated;
  }
  return out;
}
