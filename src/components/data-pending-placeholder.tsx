import Link from "next/link";
import { ArrowLeft, ShieldCheck, FileSearch, BadgeCheck } from "lucide-react";

/**
 * Page affichée pour les sociétés dont la fiche n'est pas encore publiable
 * (données officielles en cours de vérification). Message à valeur ajoutée,
 * grand public, aligné sur la promesse Mettrik (qualité avant quantité, jamais
 * de chiffres inventés).
 *
 * IMPORTANT : composant 100% autonome (aucun PageSearch/ThemeToggle/AuthNav ni
 * provider), car il est rendu hors de l'arbre company-view (la sté n'a pas de
 * données chargeables). Toute dépendance à un provider ferait planter le SSR.
 *
 * Table éditable : ajouter / retirer un ticker selon l'avancement des données.
 */
const DATA_PENDING_TABLE: Record<string, { name: string }> = {
  ARM: { name: "Arm Holdings plc" },
  "ABBN.SW": { name: "ABB Ltd" },
  NVS: { name: "Novartis AG" },
  SIEGY: { name: "Siemens AG" },
  DTEGF: { name: "Deutsche Telekom AG" },
  CSGKF: { name: "Compagnie Financière Richemont" },
  VCISY: { name: "Vinci SA" },
  "ERF.PA": { name: "Eurofins Scientific SE" },
  "ITRK.L": { name: "Intertek Group plc" },
  "AKZA.AS": { name: "AkzoNobel N.V." },
  "SPM.MI": { name: "Saipem S.p.A." },
  "SBRY.L": { name: "J Sainsbury plc" },
  "KESKOB.HE": { name: "Kesko Oyj" },
  "LI.PA": { name: "Klépierre" },
  AAVXF: { name: "Abivax SA" },
};

export function getDataPendingMeta(ticker: string): { name: string } | null {
  if (!ticker) return null;
  return DATA_PENDING_TABLE[ticker.toUpperCase()] ?? null;
}

export function DataPendingPage({ ticker, name }: { ticker: string; name?: string }) {
  const display = name || getDataPendingMeta(ticker)?.name || ticker.toUpperCase();
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[600px]"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,92,246,0.14), transparent 60%)",
        }}
      />
      <main className="relative mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
        <Link
          href="/"
          className="group mb-9 inline-flex items-center gap-2 text-[13px] text-zinc-400 transition-colors hover:text-zinc-100"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          <span className="font-display text-[15px] font-semibold tracking-tight text-zinc-200">
            Mettrik
          </span>
        </Link>

        <section className="relative mt-2 overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a] to-[#070707] p-8 sm:p-12">
          <div
            className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full blur-3xl"
            style={{ background: "rgba(139, 92, 246, 0.16)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-32 -left-32 size-96 rounded-full blur-3xl"
            style={{ background: "rgba(34, 211, 238, 0.10)" }}
          />

          <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
            <div className="mb-6 inline-flex items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10 p-4">
              <FileSearch className="size-7 text-violet-300" strokeWidth={1.5} />
            </div>

            <h1 className="font-display text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              {display}
            </h1>

            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/[0.07] px-3 py-1">
              <span className="font-mono text-[12px] font-medium uppercase tracking-[0.14em] text-violet-200">
                Analyse en préparation
              </span>
            </div>

            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-zinc-300">
              Une fiche Mettrik n&apos;est mise en ligne que lorsque chaque indicateur
              a été vérifié, un par un, sur les documents officiels de la société
              (rapport annuel, résultats trimestriels). Pour {display}, cette
              vérification est encore en cours. Nous préférons ne rien afficher
              plutôt que des chiffres approximatifs. La fiche complète arrive très
              prochainement.
            </p>

            <div className="mt-8 grid w-full max-w-lg grid-cols-3 gap-3 text-left">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <ShieldCheck className="mb-1.5 size-4 text-violet-300" strokeWidth={1.5} />
                <div className="text-sm font-medium text-zinc-200">Sources officielles</div>
                <div className="mt-0.5 text-[11.5px] leading-snug text-zinc-500">
                  Rapports déposés par la société
                </div>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <FileSearch className="mb-1.5 size-4 text-violet-300" strokeWidth={1.5} />
                <div className="text-sm font-medium text-zinc-200">Chaque KPI sourcé</div>
                <div className="mt-0.5 text-[11.5px] leading-snug text-zinc-500">
                  Vérifié ligne par ligne
                </div>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <BadgeCheck className="mb-1.5 size-4 text-violet-300" strokeWidth={1.5} />
                <div className="text-sm font-medium text-zinc-200">Zéro chiffre inventé</div>
                <div className="mt-0.5 text-[11.5px] leading-snug text-zinc-500">
                  Fiabilité avant tout
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
