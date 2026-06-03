"use client";

/**
 * BlurredFreeText — wrap les blocs de texte "plus-value" (PV) pour les
 * cacher en mode free. Visible en premium/max.
 *
 * Yann (26 mai 2026 v3) : floutage SÉLECTIF par tokens importants au
 * lieu de tout flouter en bloc. Le user free voit la structure de la
 * phrase + mots de transition, mais les chiffres / pourcentages /
 * devises / mots emphasized (entre **) sont floutés. Donne envie de
 * lire la suite (= la version premium).
 *
 * Modes :
 *  - "tokens" (DEFAULT) : blur sélectif sur nombres + emphasized + devises
 *  - "full"   : blur du bloc entier (legacy, gardé pour cas où on veut
 *               cacher 100%)
 *  - "stories": blur très fort (20px) pour les cards stories où Yann
 *               veut une opacité maximale.
 */

import { useFreemiumTier, isTickerLockedForTier } from "@/lib/freemium/context";
import { ReactNode } from "react";

type Mode = "tokens" | "full" | "stories";

type Props = {
  children: ReactNode;
  /** Override : force le floutage (true) ou la lisibilité (false). */
  blocked?: boolean;
  /** Ticker de la sté courante. */
  ticker?: string;
  /** Classe CSS appliquée dans les 2 modes. */
  className?: string;
  /** Tag wrapper (défaut span). */
  as?: "span" | "div" | "p";
  /** Mode de floutage. Defaults to "tokens". */
  mode?: Mode;
};

/**
 * Découpe un texte en tokens et flouve uniquement les "important tokens" :
 *  - nombres avec décimales (10.5, 1 234,56, 32%)
 *  - devises + unités (Mds $, € 12, $5B, M €)
 *  - tokens entre ** ou en CAPS consécutifs (= mis en avant)
 *  - acronymes financiers + noms propres > 4 lettres
 */
function splitImportantTokens(text: string): Array<{ text: string; blur: boolean }> {
  // Regex unifiée : capture tokens importants en groupe. Tout le reste
  // (whitespace + ponctuation + mots normaux) reste lisible.
  // Patterns importants :
  //  - Nombres avec déc + suffixe optionnel (Mds, M, k, B, €, $, £, %)
  //  - Mots entre ** ** (markdown emphasis)
  //  - Acronymes 2-5 lettres MAJ (CAGR, EBITDA, GMV, AI, MAU)
  //  - Noms propres composés (Foundry, VMware, Inc., S&P, BlackRock)
  const importantPattern =
    /(\*\*[^*]+\*\*|\b\d+(?:[.,]\d+)*\s?(?:%|Mds\s?[€$£]?|M\s?[€$£]?|k\s?[€$£]?|B|[€$£])?|\b[A-ZÉÈÊÀÂÔ]{2,6}\b|\b(?:[A-Z][a-zàâéèêîôùû]{2,}[A-Z][a-zA-Z]+)\b)/g;

  const result: Array<{ text: string; blur: boolean }> = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = importantPattern.exec(text)) !== null) {
    if (m.index > lastIdx) {
      result.push({ text: text.slice(lastIdx, m.index), blur: false });
    }
    // Strip ** markers but mark as blur
    const raw = m[0];
    const stripped = raw.startsWith("**") && raw.endsWith("**") ? raw.slice(2, -2) : raw;
    result.push({ text: stripped, blur: true });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    result.push({ text: text.slice(lastIdx), blur: false });
  }
  return result;
}

function renderTokensBlur(node: ReactNode): ReactNode {
  if (typeof node === "string") {
    const tokens = splitImportantTokens(node);
    return tokens.map((t, i) =>
      t.blur ? (
        <span
          key={i}
          className="select-none align-baseline"
          style={{
            filter: "blur(7px)",
            WebkitUserSelect: "none",
            userSelect: "none",
            pointerEvents: "none",
            display: "inline-block",
            color: "rgba(244,244,245,0.55)",
          }}
          aria-hidden
          data-freemium-blocked-token="locked"
        >
          {/* Yann 4 juin 2026 : HARD - texte reel jamais dans le DOM,
              blocs Unicode meme largeur pour preserver layout. */}
          {"█".repeat(Math.max(2, t.text.length))}
        </span>
      ) : (
        <span key={i}>{t.text}</span>
      ),
    );
  }
  if (Array.isArray(node)) return node.map(renderTokensBlur);
  return node;
}

export function BlurredFreeText({
  children,
  blocked,
  ticker,
  className,
  as = "span",
  mode = "tokens",
}: Props) {
  const tier = useFreemiumTier();
  const isBlocked =
    blocked ??
    (ticker ? isTickerLockedForTier(ticker, tier) : tier === "free" || tier === "anon");

  const Tag = as;
  if (!isBlocked) {
    return <Tag className={className}>{children}</Tag>;
  }

  // Mode "stories" : blur très fort pour les cards stories
  if (mode === "stories") {
    return (
      <Tag
        className={`${className ?? ""} relative cursor-pointer select-none`}
        style={{
          filter: "blur(22px)",
          WebkitUserSelect: "none",
          userSelect: "none",
          pointerEvents: "none",
        }}
        aria-hidden
        data-freemium-blocked-text="stories"
        title="Premium pour voir cette analyse"
      >
        {children}
      </Tag>
    );
  }

  // Mode "full" : blur du bloc entier (legacy)
  if (mode === "full") {
    return (
      <Tag
        className={`${className ?? ""} relative cursor-pointer select-none`}
        style={{
          filter: "blur(10px)",
          WebkitUserSelect: "none",
          userSelect: "none",
          pointerEvents: "none",
        }}
        aria-hidden
        data-freemium-blocked-text="full"
        title="Premium pour voir cette analyse"
      >
        {children}
      </Tag>
    );
  }

  // Mode "tokens" (DEFAULT) : floute uniquement les chiffres + emphasized.
  // La structure de la phrase reste lisible → donne envie de lire la suite
  // (= la version premium).
  return (
    <Tag className={className} data-freemium-blocked-text="tokens" title="Premium pour voir les détails">
      {renderTokensBlur(children)}
    </Tag>
  );
}
