/**
 * Yann 13 oct 2026 : statut de chaque KPI d industrie suivi par les
 * institutionnels, sur la fiche, VUE ADMIN UNIQUEMENT.
 *   vert   : deja sur la fiche (stes_avec, logique inchangee) ;
 *   rouge  : non applicable, ne sera jamais trouve (non_applicable / sans_objet) ;
 *   orange : applicable mais non publie par la societe (non_publie) ;
 *   jaune  : a rechercher, peut-etre publie (a_rechercher, la raison dit ou chercher).
 *
 * COMPOSANT SERVEUR SEULEMENT : aucun "use client", aucun import client.
 * La page /[ticker] ne l appelle qu apres estAdminOutilsFiche (jamais sur
 * mettrik.ai). Ouverture par l attribut HTML popover, raisons par
 * <details> : aucune ligne de JavaScript ni aucune donnee ne part dans le
 * bundle public. Hors admin, rien n est rendu ni serialise.
 */
import "server-only";
import { Landmark, X } from "lucide-react";
import ETAT from "@/data/kpi-industries-etat.json";

type Raisons = Record<string, string>;
type KpiEtat = {
  fr: string;
  en: string;
  stes_avec?: string[];
  stes_sans?: Raisons;
  sans_objet?: string[];
  non_applicable?: Raisons;
  non_publie?: Raisons;
  a_rechercher?: Raisons;
};
type Industrie = { code: string; industrie: string; secteur: string; stes: string[]; kpis: KpiEtat[] };
type Statut = "vert" | "jaune" | "orange" | "rouge" | "inconnu";
type Ligne = { fr: string; en: string; statut: Statut; raison: string | null };

const variantes = (t: string) => {
  const u = t.toUpperCase();
  return [u, u.replace(/-/g, "."), u.replace(/\./g, "-")];
};

function raisonDe(r: Raisons | undefined, cles: string[]): string | null {
  if (!r) return null;
  for (const [s, v] of Object.entries(r)) if (cles.includes(s.toUpperCase())) return v || null;
  return null;
}

function lignesPour(ticker: string): { ind: Industrie; lignes: Ligne[] } | null {
  const cles = variantes(ticker);
  const ind = (ETAT as unknown as { industries: Industrie[] }).industries.find((i) => i.stes.some((s) => cles.includes(s.toUpperCase())));
  if (!ind) return null;
  const dans = (l?: string[]) => (l ?? []).some((s) => cles.includes(s.toUpperCase()));
  const lignes = ind.kpis.map((k): Ligne => {
    if (dans(k.stes_avec)) return { fr: k.fr, en: k.en, statut: "vert", raison: null };
    const na = raisonDe(k.non_applicable, cles);
    if (na !== null || dans(k.sans_objet)) return { fr: k.fr, en: k.en, statut: "rouge", raison: na ?? raisonDe(k.stes_sans, cles) };
    const np = raisonDe(k.non_publie, cles);
    if (np !== null) return { fr: k.fr, en: k.en, statut: "orange", raison: np };
    const ar = raisonDe(k.a_rechercher, cles);
    if (ar !== null) return { fr: k.fr, en: k.en, statut: "jaune", raison: ar };
    return { fr: k.fr, en: k.en, statut: "inconnu", raison: raisonDe(k.stes_sans, cles) };
  });
  return { ind, lignes };
}

const STYLE: Record<Statut, { titre: string; point: string; texte: string; bord: string; prefixe: string }> = {
  vert: { titre: "Déjà sur la fiche", point: "bg-emerald-400", texte: "text-emerald-300", bord: "border-emerald-400/30", prefixe: "" },
  jaune: { titre: "À rechercher, peut-être publié", point: "bg-yellow-300", texte: "text-yellow-200", bord: "border-yellow-300/30", prefixe: "Où chercher : " },
  orange: { titre: "Applicable, non publié par la société", point: "bg-orange-400", texte: "text-orange-300", bord: "border-orange-400/30", prefixe: "Pourquoi : " },
  rouge: { titre: "Non applicable, jamais trouvable", point: "bg-red-500", texte: "text-red-300", bord: "border-red-500/30", prefixe: "Pourquoi : " },
  inconnu: { titre: "Pas encore classé", point: "bg-zinc-500", texte: "text-zinc-400", bord: "border-white/10", prefixe: "" },
};
const ORDRE: Statut[] = ["vert", "jaune", "orange", "rouge", "inconnu"];

export function KpiInstitStatuts({ ticker, accent = "#a78bfa" }: { ticker: string; accent?: string }) {
  const res = lignesPour(ticker);
  const id = `kpi-instit-${ticker.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
  const lignes = res?.lignes ?? [];
  const n = (s: Statut) => lignes.filter((l) => l.statut === s).length;
  const applicables = lignes.length - n("rouge");
  const maj = (ETAT as { statuts_maj?: string }).statuts_maj ?? (ETAT as { maj?: string }).maj ?? null;

  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        title="Statut des KPI d’industrie suivis par les institutionnels (admin)"
        aria-label="Statut des KPI d’industrie suivis par les institutionnels"
        className="relative inline-flex size-7 shrink-0 items-center justify-center self-center rounded-lg border transition-transform hover:scale-105"
        style={{ borderColor: `${accent}66`, background: `linear-gradient(135deg, ${accent}26, transparent)`, color: accent }}
      >
        <Landmark className="size-[15px]" strokeWidth={2.2} />
        {applicables > 0 && (
          <span className="absolute -right-1.5 -top-1.5 rounded-full border border-black bg-zinc-900 px-1 font-mono text-[8.5px] font-bold leading-[13px] text-zinc-200">
            {n("vert")}/{applicables}
          </span>
        )}
        {n("jaune") > 0 && <span className="absolute -bottom-1 -right-1 size-2 rounded-full border border-black bg-yellow-300" />}
      </button>

      <div
        id={id}
        popover="auto"
        role="dialog"
        aria-label="Statut des KPI d’industrie suivis par les institutionnels"
        style={{ margin: "auto" }}
        className="max-h-[88%] w-[calc(100%-1.5rem)] max-w-[44rem] flex-col overflow-hidden [&:popover-open]:flex rounded-2xl border border-white/10 bg-[#0a0a0d] p-0 text-left text-zinc-200 shadow-2xl backdrop:bg-black/60"
      >
        <div className="relative shrink-0 border-b border-white/[0.07] px-4 py-3.5 sm:px-5" style={{ background: `linear-gradient(120deg, ${accent}1f, transparent 60%)` }}>
          <div className="flex items-center gap-2 pr-8 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
            <Landmark className="size-3.5 shrink-0" style={{ color: accent }} />
            Statut des KPI d’industrie (institutionnels)
            <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-1.5 py-px text-[9px] text-amber-200">admin</span>
          </div>
          <h2 className="mt-1.5 text-[18px] font-bold leading-tight text-zinc-50">{res?.ind.industrie ?? "Industrie non référencée"}</h2>
          {res && (
            <p className="mt-0.5 text-[12px] text-zinc-400">
              {res.ind.secteur.charAt(0) + res.ind.secteur.slice(1).toLowerCase()} · GICS {res.ind.code} · {ticker}
            </p>
          )}
          <button
            type="button"
            popoverTarget={id}
            popoverTargetAction="hide"
            aria-label="Fermer"
            className="absolute right-2.5 top-2.5 rounded-md p-2 text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
          >
            <X className="size-4" />
          </button>
          {lignes.length > 0 && (
            <>
              <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                {ORDRE.map((s) => n(s) > 0 && <div key={s} className={STYLE[s].point} style={{ width: `${(n(s) / lignes.length) * 100}%` }} />)}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px]">
                {ORDRE.map((s) =>
                  n(s) > 0 ? (
                    <li key={s} className="flex items-center gap-1.5 text-zinc-300">
                      <span className={`size-2 rounded-full ${STYLE[s].point}`} />
                      {STYLE[s].titre} <b className={STYLE[s].texte}>{n(s)}</b>
                    </li>
                  ) : null,
                )}
              </ul>
            </>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
          {lignes.length === 0 ? (
            <p className="text-[13px] text-zinc-400">Aucun référentiel d’industrie pour cette société.</p>
          ) : (
            <div className="space-y-3.5">
              {ORDRE.map((s) => {
                const liste = lignes.filter((l) => l.statut === s);
                if (liste.length === 0) return null;
                return (
                  <section key={s}>
                    <h3 className={`mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] ${STYLE[s].texte}`}>
                      <span className={`size-2 rounded-full ${STYLE[s].point}`} />
                      {STYLE[s].titre} · {liste.length}
                    </h3>
                    <ul className={`divide-y divide-white/[0.05] rounded-xl border ${STYLE[s].bord}`}>
                      {liste.map((l) => (
                        <li key={l.fr} className="px-3 py-2">
                          <div className="flex items-start gap-2.5">
                            <span className={`mt-[7px] size-2 shrink-0 rounded-full ${STYLE[s].point}`} />
                            <div className="min-w-0 flex-1">
                              <div className="text-[13.5px] leading-snug text-zinc-100">{l.fr}</div>
                              <div className="font-mono text-[10.5px] text-zinc-500">{l.en}</div>
                            </div>
                          </div>
                          {s !== "vert" && l.raison && (
                            <details className="group ml-[18px] mt-1">
                              <summary
                                title={STYLE[s].prefixe + l.raison}
                                className={`inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] ${STYLE[s].bord} ${STYLE[s].texte} [&::-webkit-details-marker]:hidden`}
                              >
                                <span className="inline-flex size-4 items-center justify-center rounded-full border border-current font-serif text-[10px] font-bold italic">i</span>
                                <span className="group-open:hidden">{s === "jaune" ? "Où chercher" : "Raison"}</span>
                                <span className="hidden group-open:inline">Masquer</span>
                              </summary>
                              <p className="mt-1 text-[12px] leading-snug text-zinc-300">
                                <span className={STYLE[s].texte}>{STYLE[s].prefixe}</span>
                                {l.raison}
                              </p>
                            </details>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </div>
        {maj && <p className="shrink-0 border-t border-white/[0.06] px-4 py-2 font-mono text-[10px] text-zinc-500 sm:px-5">Référentiel GICS des 74 industries · classement au {maj}</p>}
      </div>
    </>
  );
}
