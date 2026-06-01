"use client";

import { useMemo, useState } from "react";
import { Copy, Check, RotateCcw } from "lucide-react";

/**
 * /sandbox/v1-9-5/admin/faq · FaqAdminClient
 *
 * Page admin (Yann P7, 31 mai 2026) qui affiche les 7 questions/réponses
 * de la FAQ pricing en FR / EN / DE pour édition rapide.
 *
 * Architecture choisie : pas de table BDD (respect règle §0septies
 * compactage data). On édite directement les valeurs en mémoire puis
 * on génère un bloc TS prêt à coller dans `src/lib/i18n/dictionary.ts`.
 *
 * Workflow :
 *  1. Yann modifie les Q/R dans les textareas (FR / EN / DE)
 *  2. Clic "Générer le bloc TS" en bas
 *  3. Copie le bloc dans le presse-papiers
 *  4. Colle dans dictionary.ts (clés `pricing.faq_q1`..`pricing.faq_q7` +
 *     `pricing.faq_a1`..`pricing.faq_a7`)
 *  5. Commit + push = changement live
 *
 * Si Yann veut une vraie persistance runtime plus tard, migrer vers la
 * table desk_page_content (déjà supportée côté lib/desk).
 *
 * Thème orange = identité visuelle admin commerciale.
 */

type LocaleKey = "fr" | "en" | "de";

type Question = {
  id: string;
  qKey: string;
  aKey: string;
  values: Record<LocaleKey, { q: string; a: string }>;
};

const LOCALE_LABEL: Record<LocaleKey, string> = {
  fr: "Français",
  en: "English",
  de: "Deutsch",
};

const LOCALES: LocaleKey[] = ["fr", "en", "de"];

export function FaqAdminClient({
  initialQuestions,
}: {
  initialQuestions: Question[];
}) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [copied, setCopied] = useState(false);

  function updateValue(
    qIdx: number,
    loc: LocaleKey,
    field: "q" | "a",
    value: string,
  ) {
    setQuestions((prev) => {
      const next = prev.map((q) => ({
        ...q,
        values: {
          fr: { ...q.values.fr },
          en: { ...q.values.en },
          de: { ...q.values.de },
        },
      }));
      next[qIdx].values[loc][field] = value;
      return next;
    });
  }

  function resetQuestion(qIdx: number) {
    setQuestions((prev) => {
      const next = [...prev];
      next[qIdx] = {
        ...initialQuestions[qIdx],
        values: {
          fr: { ...initialQuestions[qIdx].values.fr },
          en: { ...initialQuestions[qIdx].values.en },
          de: { ...initialQuestions[qIdx].values.de },
        },
      };
      return next;
    });
  }

  // Sérialise la string pour un littéral TS : double quotes échappées,
  // backslash échappé, line breaks remplacés par \n.
  function escapeTsString(s: string): string {
    return s
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r\n/g, "\n")
      .replace(/\n/g, "\\n");
  }

  const tsBlock = useMemo(() => {
    const lines: string[] = [];
    for (const q of questions) {
      lines.push(`  "${q.qKey}": {`);
      for (const loc of LOCALES) {
        lines.push(`    ${loc}: "${escapeTsString(q.values[loc].q)}",`);
      }
      lines.push(`  },`);
      lines.push(`  "${q.aKey}": {`);
      for (const loc of LOCALES) {
        lines.push(`    ${loc}: "${escapeTsString(q.values[loc].a)}",`);
      }
      lines.push(`  },`);
    }
    return lines.join("\n");
  }, [questions]);

  async function copyTsBlock() {
    try {
      await navigator.clipboard.writeText(tsBlock);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback : sélection manuelle si clipboard API bloquée
      const ta = document.getElementById("ts-block-output") as HTMLTextAreaElement | null;
      if (ta) {
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
      }
    }
  }

  const dirtyCount = useMemo(() => {
    let n = 0;
    for (let i = 0; i < questions.length; i++) {
      const cur = questions[i];
      const ref = initialQuestions[i];
      for (const loc of LOCALES) {
        if (cur.values[loc].q !== ref.values[loc].q) n++;
        if (cur.values[loc].a !== ref.values[loc].a) n++;
      }
    }
    return n;
  }, [questions, initialQuestions]);

  return (
    <div className="space-y-6">
      {questions.map((q, qIdx) => (
        <section
          key={q.id}
          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:border-orange-500/20"
        >
          <header className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-8 items-center justify-center rounded-full border border-orange-500/30 bg-orange-500/10 font-mono text-[12px] font-bold text-orange-200">
                {qIdx + 1}
              </span>
              <h2 className="font-display text-[16px] font-bold tracking-tight text-zinc-100">
                Question {qIdx + 1}
              </h2>
              <code className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10.5px] text-zinc-500">
                {q.qKey} / {q.aKey}
              </code>
            </div>
            <button
              type="button"
              onClick={() => resetQuestion(qIdx)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px] font-semibold text-zinc-400 transition-colors hover:border-orange-500/30 hover:text-orange-200"
            >
              <RotateCcw className="size-3" />
              Annuler
            </button>
          </header>

          <div className="grid gap-4 lg:grid-cols-3">
            {LOCALES.map((loc) => (
              <div key={loc} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-orange-200">
                    {loc}
                  </span>
                  <span className="text-[11.5px] text-zinc-500">
                    {LOCALE_LABEL[loc]}
                  </span>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Question
                  </label>
                  <textarea
                    value={q.values[loc].q}
                    onChange={(e) =>
                      updateValue(qIdx, loc, "q", e.target.value)
                    }
                    rows={2}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12.5px] leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500/40 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Réponse
                  </label>
                  <textarea
                    value={q.values[loc].a}
                    onChange={(e) =>
                      updateValue(qIdx, loc, "a", e.target.value)
                    }
                    rows={5}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12.5px] leading-relaxed text-zinc-300 placeholder:text-zinc-600 focus:border-orange-500/40 focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/[0.06] to-orange-500/[0.02] p-5">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-[18px] font-bold tracking-tight text-zinc-100">
              Bloc TypeScript à coller
            </h2>
            <p className="mt-1 text-[12px] text-zinc-400">
              Copie le bloc ci-dessous et remplace les clés{" "}
              <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[10.5px] text-orange-200">
                pricing.faq_q1
              </code>{" "}
              à{" "}
              <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[10.5px] text-orange-200">
                pricing.faq_a7
              </code>{" "}
              dans{" "}
              <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[10.5px] text-orange-200">
                src/lib/i18n/dictionary.ts
              </code>
              . Modifications en cours :{" "}
              <strong className="text-orange-200">{dirtyCount}</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={copyTsBlock}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-colors ${
              copied
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "bg-gradient-to-r from-orange-500 to-amber-500 text-zinc-900 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40"
            }`}
          >
            {copied ? (
              <>
                <Check className="size-4" />
                Copié
              </>
            ) : (
              <>
                <Copy className="size-4" />
                Générer le bloc TS
              </>
            )}
          </button>
        </header>

        <textarea
          id="ts-block-output"
          readOnly
          value={tsBlock}
          rows={Math.min(28, tsBlock.split("\n").length)}
          className="w-full resize-y rounded-xl border border-white/[0.08] bg-zinc-950 px-4 py-3 font-mono text-[11.5px] leading-relaxed text-zinc-200 focus:border-orange-500/40 focus:outline-none"
        />

        <p className="mt-3 text-[11.5px] text-zinc-500">
          Astuce : ouvre{" "}
          <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[10.5px] text-orange-200">
            src/lib/i18n/dictionary.ts
          </code>
          , cherche la première occurrence de{" "}
          <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[10.5px] text-orange-200">
            "pricing.faq_q1"
          </code>{" "}
          et remplace les 14 entrées (q1 à q7 + a1 à a7) par le bloc
          ci-dessus.
        </p>
      </section>
    </div>
  );
}
