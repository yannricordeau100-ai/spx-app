"use client";

/**
 * Yann 13 oct 2026 : KPI d industrie suivis par les investisseurs
 * institutionnels, VUE PUBLIQUE (toutes les fiches, tous les paliers).
 *   - KpiInstitPastille : pastille jaune n/N a cote du nom de la societe,
 *     un clic fait defiler jusqu au groupe dans « Indicateurs clés » ;
 *   - KpiInstitEntete : en-tete jaune du groupe, en tete du tableau, avec
 *     son « i » qui explique la couleur et la source de la liste.
 * Le panneau admin des statuts (vert/jaune/orange/rouge) reste a part,
 * reserve a l admin (components/admin/kpi-instit-statuts.tsx).
 */

import { Landmark } from "lucide-react";
import { InfoTooltip } from "@/components/info-tooltip";
import { smoothScrollTo } from "@/lib/scroll";
import { hauteurEnteteFiche } from "@/components/fiche-rail";

/** Jaune Mettrik (le meme que les mentions or de la fiche). */
export const JAUNE_INSTIT = "#facc15";
export const ID_GROUPE_INSTIT = "kpis-instit";

export type ResumeInstit = { n: number; total: number; industrie: string };

export function texteExplicationInstit(industrie: string) {
  return `Indicateur suivi par les investisseurs institutionnels pour cette industrie (${industrie}).`;
}

function defileVersGroupe() {
  const el = document.getElementById(ID_GROUPE_INSTIT);
  if (!el) return;
  smoothScrollTo(el, 900, 16 + hauteurEnteteFiche());
  el.classList.remove("instit-eclair");
  void el.offsetWidth;
  el.classList.add("instit-eclair");
}

export function KpiInstitPastille({ resume }: { resume: ResumeInstit }) {
  if (resume.n <= 0) return null;
  const libelle = `${resume.n} indicateur${resume.n > 1 ? "s" : ""} suivi${resume.n > 1 ? "s" : ""} par les institutionnels sur ${resume.total} pour l’industrie ${resume.industrie}. Voir la liste`;
  return (
    <button
      type="button"
      onClick={defileVersGroupe}
      title={libelle}
      aria-label={libelle}
      className="inline-flex shrink-0 items-center gap-1 self-center whitespace-nowrap rounded-full border px-2 py-[3px] font-mono text-[11px] font-semibold leading-none transition-all hover:scale-105"
      style={{ borderColor: `${JAUNE_INSTIT}66`, background: `${JAUNE_INSTIT}1a`, color: JAUNE_INSTIT }}
    >
      <Landmark className="size-3" strokeWidth={2.4} />
      {resume.n}/{resume.total}
      <span className="hidden font-sans font-medium sm:inline">institutionnels</span>
    </button>
  );
}

export function KpiInstitEntete({ resume, lignes }: { resume: ResumeInstit; lignes: number }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b px-5 py-2.5 sm:px-6"
      style={{ borderColor: `${JAUNE_INSTIT}33`, background: `linear-gradient(90deg, ${JAUNE_INSTIT}1f, ${JAUNE_INSTIT}08 55%, transparent)` }}
    >
      <Landmark className="size-3.5 shrink-0" style={{ color: JAUNE_INSTIT }} strokeWidth={2.4} />
      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: JAUNE_INSTIT }}>
        Suivis par les institutionnels
      </span>
      <span className="font-mono text-[10.5px] text-zinc-400">
        · {resume.n} sur {resume.total} de l’industrie
      </span>
      <span className="inline-flex align-middle">
        <InfoTooltip color={JAUNE_INSTIT}>
          <div className="text-[12.5px] leading-snug text-zinc-200">
            <span className="font-semibold" style={{ color: JAUNE_INSTIT }}>Pourquoi en jaune ?</span>{" "}
            {texteExplicationInstit(resume.industrie)}
          </div>
          <div className="mt-2 border-t border-white/10 pt-2 text-[12px] leading-snug text-zinc-300">
            Pour chaque industrie, Mettrik tient la liste des indicateurs que regardent les gérants de fonds et les analystes.
            {" "}{resume.total} s’appliquent à cette société ; {resume.n} figure{resume.n > 1 ? "nt" : ""} sur la fiche
            {lignes > resume.n ? ` (${lignes} lignes, un même indicateur pouvant être publié en plusieurs séries)` : ""}.
          </div>
          <div className="mt-2 border-t border-white/10 pt-2 text-[11.5px] text-zinc-400">
            Chaque ligne garde le nom utilisé par la société ; le « i » de la ligne donne l’indicateur de l’industrie correspondant.
          </div>
        </InfoTooltip>
      </span>
    </div>
  );
}
