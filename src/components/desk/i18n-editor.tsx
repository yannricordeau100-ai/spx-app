"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export const I18N_LOCALES = [
  "fr", "en", "de", "nl", "sv", "da", "en-GB", "de-CH",
] as const;
export type I18nLocale = (typeof I18N_LOCALES)[number];
export type I18nString = Partial<Record<I18nLocale, string>>;

const LOCALE_LABELS: Record<I18nLocale, string> = {
  "fr": "Français",
  "en": "English (US)",
  "de": "Deutsch",
  "nl": "Nederlands",
  "sv": "Svenska",
  "da": "Dansk",
  "en-GB": "English (UK)",
  "de-CH": "Deutsch (CH)",
};

const LOCALE_FLAGS: Record<I18nLocale, string> = {
  "fr": "🇫🇷", "en": "🇺🇸", "de": "🇩🇪", "nl": "🇳🇱",
  "sv": "🇸🇪", "da": "🇩🇰", "en-GB": "🇬🇧", "de-CH": "🇨🇭",
};

/**
 * Éditeur de texte dans 8 langues (collapsable).
 * - Affiche FR en input principal (toujours visible)
 * - Les 7 autres langues sont dans une section dépliable
 * - Indicateur visuel : nombre de langues remplies / 8
 */
export function I18nEditor({
  label,
  value,
  onChange,
  multiline = false,
  placeholder = "",
}: {
  label: string;
  value: I18nString;
  onChange: (v: I18nString) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const filled = Object.values(value ?? {}).filter((v) => v && v.trim()).length;

  function setLoc(loc: I18nLocale, v: string) {
    onChange({ ...value, [loc]: v });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11.5px]">
        <span className="font-semibold text-zinc-400">{label}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            filled === 8 ? "bg-emerald-500/20 text-emerald-200" : filled > 0 ? "bg-amber-500/20 text-amber-200" : "bg-zinc-700/40 text-zinc-400"
          }`}
        >
          {filled}/8 langues
        </span>
      </div>

      {/* FR (toujours visible) */}
      <I18nField
        loc="fr"
        value={value?.fr ?? ""}
        onChange={(v) => setLoc("fr", v)}
        multiline={multiline}
        placeholder={placeholder}
      />

      {/* Toggle pour les 7 autres */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-[11px] text-cyan-300 hover:text-cyan-200"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        {open ? "Masquer" : "Éditer"} les 7 autres langues
      </button>

      {open && (
        <div className="space-y-2 rounded-lg border border-white/[0.06] bg-black/30 p-2">
          {I18N_LOCALES.filter((l) => l !== "fr").map((loc) => (
            <I18nField
              key={loc}
              loc={loc}
              value={value?.[loc] ?? ""}
              onChange={(v) => setLoc(loc, v)}
              multiline={multiline}
              placeholder={`(traduction ${LOCALE_LABELS[loc]})`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function I18nField({
  loc,
  value,
  onChange,
  multiline,
  placeholder,
}: {
  loc: I18nLocale;
  value: string;
  onChange: (v: string) => void;
  multiline: boolean;
  placeholder: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span
        className="mt-1.5 w-16 shrink-0 font-mono text-[10.5px] uppercase tracking-wider text-zinc-500"
        title={LOCALE_LABELS[loc]}
      >
        {LOCALE_FLAGS[loc]} {loc}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          placeholder={placeholder}
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-zinc-100"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-zinc-100"
        />
      )}
    </div>
  );
}
