"use client";

/**
 * Bloc GICS du bas de la page d accueil (9 sept 2026, demande du proprietaire).
 *
 * Montre les categories de societes : uniquement les noms des sous-industries
 * et leurs codes numeriques, rien d autre. Trois presentations, la premiere
 * (« toggle ») est celle posee sur l accueil ; les deux autres sont visibles
 * sur la page concept pour choix.
 */

import { useState } from "react";
import { GICS } from "@/lib/desk/gics";
import { GICS_SUB_EN } from "@/lib/desk/gics-en";
import { useT } from "@/lib/i18n/provider";

export type GicsVariante = "toggle" | "colonnes" | "tuiles";

const TITRES = {
  fr: { titre: "Où se range chaque société ?", sous: "163 métiers, 11 secteurs : la classification GICS, celle des indices mondiaux." },
  en: { titre: "Where does each company belong?", sous: "163 sub-industries, 11 sectors: the GICS classification used by global indices." },
  de: { titre: "Wohin gehört jedes Unternehmen?", sous: "163 Teilbranchen, 11 Sektoren: die GICS-Klassifikation der globalen Indizes." },
} as const;

function sousIndustries(sectorCode: string, lang: "fr" | "en" | "de"): { code: string; nom: string }[] {
  const s = GICS.find((x) => x.code === sectorCode);
  if (!s) return [];
  const out: { code: string; nom: string }[] = [];
  for (const g of s.groups) for (const i of g.industries) for (const sub of i.subs) {
    out.push({ code: sub.code, nom: lang === "fr" ? sub.name : GICS_SUB_EN[sub.code] ?? sub.name });
  }
  return out;
}

function nomSecteur(s: (typeof GICS)[number], lang: "fr" | "en" | "de"): string {
  return lang === "fr" ? s.name : s.nameEn;
}

/** V1 : toggle des 11 secteurs (style du toggle 5 ans / MAX) puis les sous-industries du secteur choisi. */
function VarianteToggle({ lang }: { lang: "fr" | "en" | "de" }) {
  const [sector, setSector] = useState<string>(GICS[0]!.code);
  const subs = sousIndustries(sector, lang);
  return (
    <div>
      <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-1 rounded-full border border-[#1f1f1f] bg-[#0a0a0a] p-1">
        {GICS.map((s) => {
          const active = s.code === sector;
          return (
            <button
              key={s.code}
              type="button"
              onClick={() => setSector(s.code)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${active ? "bg-white/10 text-zinc-50 shadow-[0_0_12px_rgba(167,139,250,0.25)]" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              <span className="mr-1.5 font-mono text-[10px] text-zinc-500">{s.code}</span>
              {nomSecteur(s, lang)}
            </button>
          );
        })}
      </div>
      <div className="mx-auto mt-5 flex max-w-5xl flex-wrap justify-center gap-2">
        {subs.map((u) => (
          <span key={u.code} className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-zinc-200">
            <span className="font-mono text-[10.5px] tracking-wider text-violet-300/90">{u.code}</span>
            {u.nom}
          </span>
        ))}
      </div>
    </div>
  );
}

/** V2 : les 11 secteurs en colonnes, toutes les sous-industries visibles d un coup. */
function VarianteColonnes({ lang }: { lang: "fr" | "en" | "de" }) {
  return (
    <div className="grid gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {GICS.map((s) => (
        <div key={s.code} className="rounded-xl border border-white/[0.07] bg-white/[0.015] p-3.5">
          <div className="mb-2 flex items-baseline gap-2 border-b border-white/[0.06] pb-2">
            <span className="font-mono text-[10.5px] text-zinc-500">{s.code}</span>
            <span className="text-[13.5px] font-semibold text-zinc-100">{nomSecteur(s, lang)}</span>
          </div>
          <ul className="space-y-1">
            {sousIndustries(s.code, lang).map((u) => (
              <li key={u.code} className="flex items-baseline gap-2 text-[12px] text-zinc-300">
                <span className="shrink-0 font-mono text-[10px] text-violet-300/80">{u.code}</span>
                <span>{u.nom}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** V3 : tuiles secteur cliquables en tete, puis mur de tuiles code + nom, survol lumineux. */
function VarianteTuiles({ lang }: { lang: "fr" | "en" | "de" }) {
  const [sector, setSector] = useState<string | null>(null);
  const list = sector ? sousIndustries(sector, lang) : GICS.flatMap((s) => sousIndustries(s.code, lang));
  return (
    <div>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => setSector(null)} className={`rounded-lg border px-3 py-1.5 text-[12px] transition-colors ${sector === null ? "border-violet-400/50 bg-violet-500/15 text-violet-100" : "border-white/[0.08] text-zinc-400 hover:text-zinc-200"}`}>
          {lang === "fr" ? "Tous" : lang === "de" ? "Alle" : "All"} · 163
        </button>
        {GICS.map((s) => {
          const n = sousIndustries(s.code, lang).length;
          const active = s.code === sector;
          return (
            <button key={s.code} type="button" onClick={() => setSector(s.code)} className={`rounded-lg border px-3 py-1.5 text-[12px] transition-colors ${active ? "border-violet-400/50 bg-violet-500/15 text-violet-100" : "border-white/[0.08] text-zinc-400 hover:text-zinc-200"}`}>
              {nomSecteur(s, lang)} <span className="font-mono text-[10px] text-zinc-500">· {n}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((u) => (
          <div key={u.code} className="group flex items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 transition-colors hover:border-violet-400/40 hover:bg-violet-500/[0.06]">
            <span className="rounded-md bg-black/40 px-1.5 py-0.5 font-mono text-[10.5px] tracking-wider text-violet-300 group-hover:text-violet-200">{u.code}</span>
            <span className="text-[12.5px] text-zinc-200">{u.nom}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HomeGicsBlock({ variante = "toggle", sansTitre = false }: { variante?: GicsVariante; sansTitre?: boolean }) {
  const { locale } = useT();
  const lang = (locale === "de" ? "de" : locale === "fr" ? "fr" : "en") as "fr" | "en" | "de";
  const t = TITRES[lang];
  return (
    <section className="mx-auto mt-16 max-w-6xl px-4 sm:mt-20">
      {!sansTitre && (
        <div className="mb-6 text-center">
          <h2 className="font-display text-[24px] font-bold tracking-tight text-zinc-50 sm:text-[28px]">{t.titre}</h2>
          <p className="mt-1.5 text-[13.5px] text-zinc-400">{t.sous}</p>
        </div>
      )}
      {variante === "toggle" && <VarianteToggle lang={lang} />}
      {variante === "colonnes" && <VarianteColonnes lang={lang} />}
      {variante === "tuiles" && <VarianteTuiles lang={lang} />}
    </section>
  );
}
