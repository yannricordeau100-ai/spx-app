"use client";

import { useMemo } from "react";
import { InfoTooltip } from "./info-tooltip";
import {
  COMPLEX_WORDS_FR,
  COMPLEX_WORDS_REGEX,
  canonicalKey,
} from "@/lib/complex-words-glossary";

/**
 * Wrappe automatiquement chaque occurrence d'un mot compliqué connu
 * (cf src/lib/complex-words-glossary.ts) avec un <InfoTooltip>. Le texte
 * reste rendu naturellement, et chaque terme connu reçoit un petit point
 * d'interrogation discret cliquable.
 *
 * Règles d'usage :
 * - À utiliser UNIQUEMENT sur du texte narratif (interprétations, AI
 *   positioning, KPI rationale). PAS sur les labels d'UI (boutons,
 *   onglets, headers), où le tooltip dégrade la densité visuelle.
 * - Chaque occurrence n'est wrappée qu'UNE seule fois par bloc (déduplication
 *   anti-spam pour les textes longs).
 * - La regex est mémorisée + le résultat parsé est mémorisé par texte.
 *
 * Locale : `fr` par défaut. Si plus tard on ajoute EN/DE, le glossaire
 * exposera explanation_en / explanation_de et on switchera ici.
 */
export function AutoTooltipText({
  text,
  locale = "fr",
  className,
  dedupe = true,
}: {
  text: string;
  locale?: "fr" | "en" | "de";
  className?: string;
  /** Si true, ne wrap qu'une seule fois le même terme dans le bloc. Défaut true. */
  dedupe?: boolean;
}) {
  const parts = useMemo(
    () => parseText(text, { dedupe }),
    [text, dedupe]
  );

  if (!text) return null;

  // FR-only pour l'instant. Si locale != fr, on rend le texte tel quel.
  if (locale !== "fr") {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.kind === "text") return <span key={i}>{part.value}</span>;
        const entry = COMPLEX_WORDS_FR[part.key];
        if (!entry || !entry.explanation_fr) {
          return <span key={i}>{part.value}</span>;
        }
        return (
          <span
            key={i}
            className="inline-flex items-baseline gap-0.5 underline decoration-dotted decoration-violet-500/40 underline-offset-2"
          >
            <span>{part.value}</span>
            <InfoTooltip color="#a78bfa" size="sm" align="left">
              <p className="text-[12.5px] leading-relaxed text-zinc-200">
                <strong className="text-zinc-50">{part.key}</strong> :{" "}
                {entry.explanation_fr}
              </p>
            </InfoTooltip>
          </span>
        );
      })}
    </span>
  );
}

type Part =
  | { kind: "text"; value: string }
  | { kind: "term"; value: string; key: string };

function parseText(text: string, opts: { dedupe: boolean }): Part[] {
  if (!text) return [];
  const parts: Part[] = [];
  const seen = new Set<string>();
  // Reset lastIndex car le regex est globalement réutilisé.
  COMPLEX_WORDS_REGEX.lastIndex = 0;
  let lastIdx = 0;
  for (;;) {
    const m = COMPLEX_WORDS_REGEX.exec(text);
    if (!m) break;
    const matched = m[1];
    const start = m.index;
    const end = start + matched.length;
    const key = canonicalKey(matched);
    if (!key) {
      continue;
    }
    const dedupeKey = key.toLowerCase();
    if (opts.dedupe && seen.has(dedupeKey)) {
      // Texte tel quel, sans tooltip (déjà wrappé une fois)
      if (start > lastIdx) parts.push({ kind: "text", value: text.slice(lastIdx, start) });
      parts.push({ kind: "text", value: matched });
      lastIdx = end;
      continue;
    }
    seen.add(dedupeKey);
    if (start > lastIdx) parts.push({ kind: "text", value: text.slice(lastIdx, start) });
    parts.push({ kind: "term", value: matched, key });
    lastIdx = end;
  }
  if (lastIdx < text.length) parts.push({ kind: "text", value: text.slice(lastIdx) });
  return parts;
}

/**
 * Variante "HTML" : applique le wrapping même quand le texte d'origine
 * contient du `<em>` / `<strong>` (cas des `normalizeNarrative()` actuels
 * qui retournent du HTML).
 *
 * Stratégie : on évite de wrapper à l'intérieur d'un <em>/<strong> déjà
 * présent (sinon double-tooltip). On rend le HTML via React children par
 * petite découpe.
 *
 * Pour la V1 on garde simple : si le texte contient `<`, on rend en HTML
 * brut sans wrapper (la fonction `normalizeNarrative` est déjà appliquée
 * en amont et c'est OK). Wrapper côté SSR safe sera fait en V2 quand on
 * aura un parseur HTML léger.
 */
export function AutoTooltipHtml({
  html,
  locale = "fr",
  className,
}: {
  html: string;
  locale?: "fr" | "en" | "de";
  className?: string;
}) {
  // Texte sans balise HTML : on peut wrapper directement.
  if (!html.includes("<")) {
    return <AutoTooltipText text={html} locale={locale} className={className} />;
  }
  // Sinon, fallback HTML brut (pas de wrapping). Évite de casser <em>/<strong>.
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
