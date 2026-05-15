"use client";

import { Plus, Trash2, Info } from "lucide-react";
import { I18nEditor, type I18nString } from "@/components/desk/i18n-editor";

export type Annotation = {
  period: string;
  title_i18n: I18nString;
  text_i18n: I18nString;
};

/**
 * Éditeur d'annotations "i" sur le chart d'un KPI.
 * Chaque annotation = 1 marqueur info à une période donnée :
 *  - period : "2020" / "FY20" (exactement sur l'année)
 *             OU "between:2020-2021" (entre 2 années)
 *  - title  : titre du tooltip (8 langues)
 *  - text   : texte d'explication (8 langues)
 */
export function AnnotationsEditor({
  annotations,
  onChange,
  availablePeriods = [],
}: {
  annotations: Annotation[];
  onChange: (a: Annotation[]) => void;
  /** Liste des périodes disponibles dans les data (suggestion). */
  availablePeriods?: string[];
}) {
  function add() {
    const defaultPeriod = availablePeriods.length > 0 ? availablePeriods[availablePeriods.length - 1] : "";
    onChange([...annotations, { period: defaultPeriod, title_i18n: {}, text_i18n: {} }]);
  }
  function update(i: number, patch: Partial<Annotation>) {
    onChange(annotations.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }
  function remove(i: number) {
    onChange(annotations.filter((_, idx) => idx !== i));
  }

  const periodSuggestions = generateBetweenSuggestions(availablePeriods);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-zinc-400">
          <Info className="size-3.5 text-cyan-400" />
          Annotations &quot;i&quot; sur le chart ({annotations.length})
        </div>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-200 hover:bg-cyan-500/15"
        >
          <Plus className="size-3" /> Ajouter
        </button>
      </div>

      {annotations.length === 0 && (
        <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3 text-center text-[11.5px] text-zinc-500">
          Aucune annotation. Clique &quot;Ajouter&quot; pour placer un &quot;i&quot; sur le chart à une année précise.
        </div>
      )}

      {annotations.map((ann, i) => (
        <div
          key={i}
          className="space-y-3 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.03] p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10.5px] font-bold text-cyan-200">
                #{i + 1}
              </span>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] text-zinc-400">Période :</label>
                <select
                  value={ann.period}
                  onChange={(e) => update(i, { period: e.target.value })}
                  className="rounded border border-white/[0.08] bg-white/[0.02] px-2 py-1 font-mono text-[11.5px] text-zinc-100"
                >
                  <option value="">(à choisir)</option>
                  {availablePeriods.length > 0 && (
                    <optgroup label="Sur une année">
                      {availablePeriods.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </optgroup>
                  )}
                  {periodSuggestions.length > 0 && (
                    <optgroup label="Entre 2 années">
                      {periodSuggestions.map((p) => (
                        <option key={p} value={`between:${p}`}>↔ {p}</option>
                      ))}
                    </optgroup>
                  )}
                  <option value="custom">Personnalisé…</option>
                </select>
                {ann.period === "custom" && (
                  <input
                    type="text"
                    placeholder='ex "2020-Q2"'
                    onChange={(e) => update(i, { period: e.target.value })}
                    className="w-24 rounded border border-white/[0.08] bg-white/[0.02] px-2 py-1 font-mono text-[11.5px] text-zinc-100"
                  />
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded p-1 text-rose-400 hover:bg-rose-500/15"
              title="Supprimer cette annotation"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>

          <I18nEditor
            label="Titre du tooltip (8 langues)"
            value={ann.title_i18n}
            onChange={(v) => update(i, { title_i18n: v })}
            placeholder="ex Lancement iPhone 12"
          />
          <I18nEditor
            label="Texte explicatif (8 langues)"
            value={ann.text_i18n}
            onChange={(v) => update(i, { text_i18n: v })}
            multiline
            placeholder="ex Premier iPhone 5G, hausse 35 % volumes premium."
          />
        </div>
      ))}
    </div>
  );
}

/** Génère les suggestions "between:2020-2021" pour chaque paire consécutive. */
function generateBetweenSuggestions(periods: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < periods.length - 1; i++) {
    out.push(`${periods[i]}-${periods[i + 1]}`);
  }
  return out;
}
