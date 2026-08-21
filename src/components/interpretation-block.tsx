"use client";

import { ArrowUpRight, AlertTriangle, Coins, Telescope } from "lucide-react";
import type { InterpretBlock, InterpretTone } from "@/lib/data";
import { normalizeNarrative } from "@/lib/ui-fix-templates";
import { useT } from "@/lib/i18n/provider";
import { AutoTooltipText } from "@/components/auto-tooltip-text";

/**
 * Wrappe la portion qui vient APRÈS "Le KPI" dans un span
 * `floutage-target` pour permettre au flou adaptatif multi-lignes de
 * s'appliquer sur la valeur sensible uniquement (pas sur le préfixe).
 *
 * Si "Le KPI" n'est pas trouvé dans le texte (autre langue,
 * autre formulation), on wrap tout le texte par défaut.
 */
function wrapHeroInterpretation(html: string): string {
  const marker = "Le KPI";
  const idx = html.indexOf(marker);
  if (idx < 0) {
    return `<span class="floutage-target" data-floutage-zone="hero_interpretation_value">${html}</span>`;
  }
  const prefix = html.slice(0, idx + marker.length);
  const rest = html.slice(idx + marker.length);
  if (!rest.trim()) return html;
  return `${prefix}<span class="floutage-target" data-floutage-zone="hero_interpretation_value">${rest}</span>`;
}

/**
 * Yann 21 aout 2026 : decoupe le lead en phrases pour un rendu en puces.
 * Le HTML du lead est simple (span/strong/em) : on coupe sur ". " en dehors
 * de toute balise, et on refuse de couper si le decoupage casse un tag
 * (nombre de "<" different du nombre de ">" dans un fragment).
 */
function splitLeadIntoBullets(html: string): string[] {
  if (!html) return [];
  const out: string[] = [];
  let buf = "";
  let depth = 0;
  for (let i = 0; i < html.length; i += 1) {
    const ch = html[i];
    if (ch === "<") depth += 1;
    if (ch === ">") depth -= 1;
    buf += ch;
    const isBoundary =
      depth === 0 &&
      (ch === "." || ch === "!" || ch === "?") &&
      // pas une decimale ("1.5") ni une abreviation collee
      !/\d$/.test(buf.slice(0, -1)) &&
      (html[i + 1] === " " || html[i + 1] === undefined) &&
      /[A-Z0-9\u00c0-\u00dc<]/.test((html.slice(i + 2).match(/\S/) || [""])[0]);
    if (isBoundary) {
      out.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) out.push(buf.trim());
  // Un fragment doit rester equilibre en balises, sinon on abandonne le split.
  const balanced = out.every(
    (f) => (f.match(/</g) || []).length === (f.match(/>/g) || []).length,
  );
  if (!balanced) return [html];
  return out.filter((f) => f.replace(/<[^>]*>/g, "").trim().length > 0);
}

const TONE: Record<
  InterpretTone,
  { color: string; bg: string; icon: typeof ArrowUpRight }
> = {
  pos: { color: "#10b981", bg: "rgba(16,185,129,0.06)", icon: ArrowUpRight },
  neg: { color: "#f43f5e", bg: "rgba(244,63,94,0.06)", icon: AlertTriangle },
  neutral: { color: "#a78bfa", bg: "rgba(167,139,250,0.06)", icon: Coins },
  future: { color: "#06b6d4", bg: "rgba(6,182,212,0.08)", icon: Telescope },
};

export function InterpretationBlock({
  block,
  accent = "#a78bfa",
}: {
  block: InterpretBlock;
  accent?: string;
}) {
  const { t } = useT();
  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#080808] p-6">
      {/* Yann 21 aout 2026 : etoile "IA" (Sparkles) retiree. */}
      <div className="mb-4 flex items-center gap-2.5">
        <span
          className="inline-block h-3.5 w-[3px] rounded-full"
          style={{ background: accent }}
        />
        <span className="font-sans text-[13px] font-semibold uppercase tracking-[0.12em] text-zinc-200">
          {t("interpretation.header")}
        </span>
      </div>

      {/* Yann 27 mai 2026 : restore HTML rendering pour <strong>/<em>.
          AutoTooltipText escape le HTML → tags rendus comme texte brut.
          Fix : dangerouslySetInnerHTML directement (sécurisé car le texte
          vient de notre pipeline contrôlé, pas user input).

          Yann 2 juin 2026 : flou adaptatif multi-lignes.
          La portion qui vient APRÈS "Le KPI" est wrappée dans
          un <span class="floutage-target" data-floutage-zone="hero_interpretation_value">.
          Le span est inline + box-decoration-break:clone côté CSS, ce qui
          permet au blur de suivre naturellement le texte sur 1 ou N lignes
          (cas Google : interpretation qui passe sur 2 lignes). */}
      {/* Yann 21 aout 2026 (point 5) : le lead pleine largeur devient une
          liste a puces sur 2 colonnes des que le texte contient plusieurs
          phrases. Exploite l'espace horizontal au lieu d'une longue ligne. */}
      {(() => {
        const raw = normalizeNarrative(block.lead);
        const parts = splitLeadIntoBullets(raw).map((frag, i) =>
          // Le flou freemium doit survivre au decoupage : la 1re puce garde
          // le marqueur "Le KPI", les suivantes sont floutees en entier.
          i === 0
            ? wrapHeroInterpretation(frag)
            : `<span class="floutage-target" data-floutage-zone="hero_interpretation_value">${frag}</span>`,
        );
        const leadHtml = wrapHeroInterpretation(raw);
        if (parts.length < 2) {
          return (
            <p
              className="text-[15.5px] leading-relaxed text-zinc-100 [&_em]:italic [&_em]:text-zinc-200 [&_strong]:font-semibold [&_strong]:text-zinc-50"
              dangerouslySetInnerHTML={{ __html: leadHtml }}
            />
          );
        }
        return (
          <ul className="grid gap-x-8 gap-y-1.5 text-[15.5px] leading-relaxed text-zinc-100 md:grid-cols-2">
            {parts.map((html, i) => (
              <li
                key={i}
                className="flex items-start gap-2 [&_em]:italic [&_em]:text-zinc-200 [&_strong]:font-semibold [&_strong]:text-zinc-50"
              >
                <span
                  className="mt-[9px] size-1.5 shrink-0 rounded-full"
                  style={{ background: accent }}
                />
                <span className="min-w-0 flex-1" dangerouslySetInnerHTML={{ __html: html }} />
              </li>
            ))}
          </ul>
        );
      })()}

      <ul className="mt-5 grid gap-3 md:grid-cols-2">
        {block.bullets.map((b, i) => {
          const t = TONE[b.tone];
          const Icon = t.icon;
          const isFuture = b.tone === "future";
          return (
            <li
              key={i}
              className={`flex items-start gap-3.5 rounded-xl border p-4 ${
                isFuture ? "border-cyan-500/25" : "border-[#1a1a1a]"
              }`}
              style={{
                background: isFuture ? t.bg : "#070707",
                boxShadow: isFuture ? `0 0 32px ${t.color}1a inset` : undefined,
              }}
            >
              <span
                className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md"
                style={{
                  background: `${t.color}1a`,
                  color: t.color,
                  border: `1px solid ${t.color}40`,
                }}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className="text-[12.5px] font-semibold uppercase tracking-wider"
                  style={{ color: t.color }}
                >
                  {b.label}
                </div>
                <p
                  className="mt-1.5 text-[14.5px] leading-relaxed text-zinc-200 [&_em]:italic [&_em]:text-zinc-100 [&_strong]:font-semibold [&_strong]:text-zinc-50"
                  dangerouslySetInnerHTML={{ __html: normalizeNarrative(b.body) }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
