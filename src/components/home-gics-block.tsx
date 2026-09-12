"use client";

/**
 * Bloc GICS du bas de la page d accueil (9 sept 2026, demande du proprietaire).
 *
 * Montre les categories de societes sur les QUATRE niveaux de la
 * classification (secteur, groupe d industries, industrie, sous-industrie),
 * uniquement les noms et leurs codes numeriques, rien d autre. Trois
 * presentations, la premiere (« toggle ») est celle posee sur l accueil ; les
 * deux autres sont visibles sur la page concept pour choix.
 */

import { useState } from "react";
import { GICS, type GicsSector } from "@/lib/desk/gics";
import { GICS_SUB_EN } from "@/lib/desk/gics-en";
import { useT } from "@/lib/i18n/provider";
import COMPTES from "@/data/kpi-comptes-industries.json";

// Yann 12 sept 2026 : KPI totaux par industrie (IC standard + avances + stories),
// en orange. Genere par scripts/compte-kpi-industries.ts (+ agregation).
const KPI_PAR_INDUSTRIE = (COMPTES as { par_industrie: Record<string, { total: number; stes: number }> }).par_industrie;

export type GicsVariante = "toggle" | "colonnes" | "tuiles";
type Lang = "fr" | "en" | "de";

const TITRES = {
  fr: { titre: "Où se range chaque société ?", sous: "11 secteurs, 25 groupes, 74 industries, 163 sous-industries : la classification GICS, celle des indices mondiaux." },
  en: { titre: "Where does each company belong?", sous: "11 sectors, 25 industry groups, 74 industries, 163 sub-industries: the GICS classification used by global indices." },
  de: { titre: "Wohin gehört jedes Unternehmen?", sous: "11 Sektoren, 25 Branchengruppen, 74 Branchen, 163 Teilbranchen: die GICS-Klassifikation der globalen Indizes." },
} as const;

const NIVEAUX = {
  fr: ["Secteur", "Groupe d’industries", "Industrie", "Sous-industrie"],
  en: ["Sector", "Industry group", "Industry", "Sub-industry"],
  de: ["Sektor", "Branchengruppe", "Branche", "Teilbranche"],
} as const;

function nomSecteur(s: GicsSector, lang: Lang): string {
  return lang === "fr" ? s.name : s.nameEn;
}
function nomSous(code: string, nomFr: string, lang: Lang): string {
  return lang === "fr" ? nomFr : GICS_SUB_EN[code] ?? nomFr;
}

/** Arbre complet d un secteur : groupes, industries, sous-industries, avec codes. */
function Arbre({ s, lang, compact = false }: { s: GicsSector; lang: Lang; compact?: boolean }) {
  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      {s.groups.map((g) => (
        <div key={g.code}>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[10.5px] tracking-wider text-cyan-300/90">{g.code}</span>
            <span className="text-[13.5px] font-semibold text-zinc-100">{g.name}</span>
            <span className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-600">{NIVEAUX[lang][1]}</span>
          </div>
          <div className={`mt-2 ${compact ? "space-y-2" : "grid gap-3 md:grid-cols-2"}`}>
            {g.industries.map((i) => (
              <div key={i.code} className="rounded-lg border border-white/[0.07] bg-white/[0.015] p-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[10.5px] tracking-wider text-emerald-300/90">{i.code}</span>
                  <span className="text-[12.5px] font-medium text-zinc-200">{i.name}</span>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">{NIVEAUX[lang][2]}</span>
                  {KPI_PAR_INDUSTRIE[i.code] && (
                    <span className="ml-auto whitespace-nowrap font-mono text-[10.5px] font-semibold text-orange-400" title={`${KPI_PAR_INDUSTRIE[i.code].stes} ${lang === "en" ? "companies" : lang === "de" ? "Unternehmen" : "sociétés"}`}>
                      {KPI_PAR_INDUSTRIE[i.code].total.toLocaleString(lang === "en" ? "en-US" : lang === "de" ? "de-DE" : "fr-FR")} {lang === "en" ? "total KPIs" : lang === "de" ? "KPI gesamt" : "KPI totaux"}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {i.subs.map((u) => (
                    <span key={u.code} className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-[11.5px] text-zinc-300">
                      <span className="font-mono text-[10px] tracking-wider text-violet-300/90">{u.code}</span>
                      {nomSous(u.code, u.name, lang)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Legende({ lang }: { lang: Lang }) {
  const c = ["text-zinc-200", "text-cyan-300/90", "text-emerald-300/90", "text-violet-300/90"];
  const codes = ["10", "1010", "101010", "10101010"];
  return (
    <div className="mb-4 flex flex-wrap justify-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
      {NIVEAUX[lang].map((n, k) => (
        <span key={n}><span className={c[k]}>{codes[k]}</span> · {n}</span>
      ))}
    </div>
  );
}

/** V1 : toggle des 11 secteurs (style du toggle 5 ans / MAX) puis l arbre complet du secteur choisi. */
function VarianteToggle({ lang }: { lang: Lang }) {
  const [sector, setSector] = useState<string>(GICS[0]!.code);
  const s = GICS.find((x) => x.code === sector) ?? GICS[0]!;
  return (
    <div>
      <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-1 rounded-full border border-[#1f1f1f] bg-[#0a0a0a] p-1">
        {GICS.map((x) => {
          const active = x.code === sector;
          return (
            <button
              key={x.code}
              type="button"
              onClick={() => setSector(x.code)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${active ? "bg-white/10 text-zinc-50 shadow-[0_0_12px_rgba(167,139,250,0.25)]" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              <span className="mr-1.5 font-mono text-[10px] text-zinc-500">{x.code}</span>
              {nomSecteur(x, lang)}
            </button>
          );
        })}
      </div>
      <div className="mx-auto mt-5 max-w-5xl">
        <Legende lang={lang} />
        <Arbre s={s} lang={lang} />
      </div>
    </div>
  );
}

/** V2 : les 11 secteurs en colonnes depliables, chacune avec ses quatre niveaux. */
function VarianteColonnes({ lang }: { lang: Lang }) {
  return (
    <div>
      <Legende lang={lang} />
      <div className="grid gap-4 lg:grid-cols-2">
        {GICS.map((s) => (
          <details key={s.code} className="group rounded-xl border border-white/[0.07] bg-white/[0.015] p-3.5" open={s.code === GICS[0]!.code}>
            <summary className="flex cursor-pointer list-none items-baseline gap-2">
              <span className="font-mono text-[10.5px] text-zinc-400">{s.code}</span>
              <span className="text-[14px] font-semibold text-zinc-100">{nomSecteur(s, lang)}</span>
              <span className="ml-auto font-mono text-[10px] text-zinc-600 group-open:hidden">{s.groups.reduce((n, g) => n + g.industries.reduce((m, i) => m + i.subs.length, 0), 0)}</span>
            </summary>
            <div className="mt-3 border-t border-white/[0.06] pt-3">
              <Arbre s={s} lang={lang} compact />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

/** V3 : tuiles secteur en tete, puis l arbre du secteur choisi en tuiles larges. */
function VarianteTuiles({ lang }: { lang: Lang }) {
  const [sector, setSector] = useState<string>(GICS[0]!.code);
  const s = GICS.find((x) => x.code === sector) ?? GICS[0]!;
  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {GICS.map((x) => {
          const active = x.code === sector;
          const n = x.groups.reduce((a, g) => a + g.industries.reduce((m, i) => m + i.subs.length, 0), 0);
          return (
            <button key={x.code} type="button" onClick={() => setSector(x.code)} className={`rounded-lg border px-3 py-2 text-left transition-colors ${active ? "border-violet-400/50 bg-violet-500/15" : "border-white/[0.08] hover:border-white/20"}`}>
              <div className="font-mono text-[10px] text-zinc-500">{x.code}</div>
              <div className={`text-[12.5px] font-semibold ${active ? "text-violet-100" : "text-zinc-200"}`}>{nomSecteur(x, lang)}</div>
              <div className="font-mono text-[9.5px] text-zinc-600">{x.groups.length} · {x.groups.reduce((a, g) => a + g.industries.length, 0)} · {n}</div>
            </button>
          );
        })}
      </div>
      <div className="mt-5">
        <Legende lang={lang} />
        <Arbre s={s} lang={lang} />
      </div>
    </div>
  );
}

export function HomeGicsBlock({ variante = "toggle", sansTitre = false }: { variante?: GicsVariante; sansTitre?: boolean }) {
  const { locale } = useT();
  const lang = (locale === "de" ? "de" : locale === "fr" ? "fr" : "en") as Lang;
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
