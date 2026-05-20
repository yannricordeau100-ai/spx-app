import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import IN_PROGRESS from "@/data/v1-9-in-progress.json";
import STRICT from "@/data/v1-9-strictly-complete.json";

export const dynamic = "force-static";
export const revalidate = 3600;
export const metadata = {
  title: "Suivi enrichissement top 307 · Mettrik AI",
  robots: { index: false, follow: false },
};

type InProgressItem = {
  ticker: string;
  name: string | null;
  missing: string[];
  score: number;
};

const STRICT_LIST = (STRICT as { list: { ticker: string; name: string | null }[] }).list;
const IN_PROGRESS_LIST = (IN_PROGRESS as { tickers_in_progress: InProgressItem[] }).tickers_in_progress;
const BLOCKED_TICKERS = ["DG.PA", "SGSN.SW", "FRE.DE", "JDEP.AS", "HLN.L", "CRWV"];

const BLOCK_LABEL_FR: Record<string, string> = {
  hero_spec: "Hero KPI à choisir spécifique",
  hero_hist: "Historique hero <3 ans",
  kpi5_spec: "<5 KPI spécifiques",
  seg: "Segments CA manquants",
  geo: "Géographie CA manquante",
  risks: "Facteurs de risque <3",
  ai: "Positionnement IA insuffisant",
  gov: "Gouvernance (CEO) manquant",
  ev: "Events timeline <3",
  desc: "Description courte",
  spec: "KPI à re-vérifier",
};

export default function V19StatusPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="size-4" /> Retour accueil
        </Link>

        <h1 className="font-display text-[28px] font-bold tracking-tight">
          Suivi enrichissement top 307 V1.9
        </h1>
        <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-zinc-400">
          Statut en temps réel du pipeline Mettrik AI sur les 307 plus grosses
          sociétés mondiales. Critères stricts 11/11 : hero KPI spécifique +
          historique 5+ ans + 5+ KPI spécifiques + segments + géographie +
          gouvernance + risques + IA + events + description.
        </p>

        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="font-mono text-xs uppercase tracking-wider text-emerald-400">
              Complètes 11/11
            </div>
            <div className="mt-1 font-display text-3xl font-bold text-emerald-300">
              {STRICT_LIST.length}
            </div>
            <div className="mt-1 text-[12px] text-zinc-400">visibles V1.9</div>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="font-mono text-xs uppercase tracking-wider text-amber-400">
              En cours
            </div>
            <div className="mt-1 font-display text-3xl font-bold text-amber-300">
              {IN_PROGRESS_LIST.length}
            </div>
            <div className="mt-1 text-[12px] text-zinc-400">enrichissement actif</div>
          </div>
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
            <div className="font-mono text-xs uppercase tracking-wider text-rose-400">
              Bloquées
            </div>
            <div className="mt-1 font-display text-3xl font-bold text-rose-300">
              {BLOCKED_TICKERS.length}
            </div>
            <div className="mt-1 text-[12px] text-zinc-400">sources cassées, re-scrape</div>
          </div>
        </div>

        {/* Section EN COURS */}
        <h2 className="mt-10 font-display text-xl font-bold">
          🟠 Stés en cours d&apos;enrichissement ({IN_PROGRESS_LIST.length})
        </h2>
        <p className="mt-1 text-[12px] text-zinc-500">
          Score actuel (sur 11 critères) et blocs manquants. Triées par score
          décroissant : les plus proches de la complétion en premier.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full text-[13px]">
            <thead className="bg-zinc-900/60 text-[11px] uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-3 py-2 text-left">Ticker</th>
                <th className="px-3 py-2 text-left">Nom</th>
                <th className="px-3 py-2 text-left">Score</th>
                <th className="px-3 py-2 text-left">Blocs manquants</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {IN_PROGRESS_LIST.map((item) => (
                <tr key={item.ticker} className="hover:bg-zinc-900/30">
                  <td className="px-3 py-2 font-mono text-[12px] text-zinc-200">
                    {item.ticker}
                  </td>
                  <td className="px-3 py-2 text-zinc-300">{item.name}</td>
                  <td className="px-3 py-2 font-mono">
                    <span
                      className={
                        item.score >= 10
                          ? "text-amber-300"
                          : item.score >= 8
                            ? "text-amber-400"
                            : "text-zinc-500"
                      }
                    >
                      {item.score}/11
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[12px] text-zinc-400">
                    {item.missing
                      .map((b) => BLOCK_LABEL_FR[b] || b)
                      .join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section BLOQUÉES */}
        <h2 className="mt-10 font-display text-xl font-bold">
          🔴 Stés bloquées (sources cassées, re-scrape CONV-DATA nécessaire)
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {BLOCKED_TICKERS.map((t) => (
            <div
              key={t}
              className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3"
            >
              <div className="font-mono text-sm font-bold text-rose-300">{t}</div>
              <div className="mt-1 text-[11px] text-zinc-400">
                {t === "DG.PA" && "Cross-pollution → Virbac, pas Vinci"}
                {t === "SGSN.SW" && "Source = battery test report, pas SGS"}
                {t === "FRE.DE" && "Source = adresse, pas annual report"}
                {t === "JDEP.AS" && "Source = lettre NGO B4Ukraine"}
                {t === "HLN.L" && "Source = Haleon Pakistan, pas Haleon plc"}
                {t === "CRWV" && "IPO Q1 2026, historique <1 an"}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-[11px] italic text-zinc-500">
          Mise à jour automatique au rebuild pipeline. Toutes les stés
          strictement complètes apparaissent automatiquement sur
          <span className="font-mono"> /sandbox/v1-9/&lt;ticker&gt;</span>.
        </p>
      </div>
    </div>
  );
}
