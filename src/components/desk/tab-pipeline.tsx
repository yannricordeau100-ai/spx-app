"use client";

import { Cpu } from "lucide-react";
import { DeskCard, HelpTip, Pill } from "./ui";

const TARGETS = [
  { region: "USA", count: 2000, eta: "phase 1", priority: "T1", color: "violet" as const, note: "SEC EDGAR, source la plus simple. Top 2000 capi." },
  { region: "Europe", count: 1500, eta: "phase 1.5", priority: "T1", color: "cyan" as const, note: "Stoxx 600 + FTSE 100 + SMI + CAC 40 + DAX. Mix d'autorités locales (AMF, BaFin, FCA, CONSOB...)" },
  { region: "Canada", count: 500, eta: "phase 2 (bien plus tard)", priority: "T2", color: "amber" as const, note: "SEDAR+ a une API mais structures différentes des US. À évaluer après V2." },
  { region: "Japon", count: 500, eta: "phase 2 (bien plus tard)", priority: "T2", color: "amber" as const, note: "EDINET (gouvt JP) + Tanshin (rapports trimestriels). Format XBRL spécifique." },
];
const TOTAL = TARGETS.reduce((a, b) => a + b.count, 0);

export function TabPipeline() {
  return (
    <div>
      <DeskCard className="mb-4">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-zinc-200">Pipeline V2 : extraction automatisée</span>
          <HelpTip>Plan d'extension de Mettrik au-delà des 5 sociétés V1. Stack ciblée : <strong>SEC EDGAR scraper</strong> (Python) → <strong>extraction LLM</strong> (Groq + Llama 3.3 70B, free tier) → <strong>validation humaine</strong> (toi) → publication Supabase. Pour les non-USA, chaque région a son régulateur et son format de rapport, ce qui multiplie le travail d'adaptation.</HelpTip>
        </div>
        <div className="text-[12px] text-zinc-400">
          Cible totale : <strong className="font-mono text-zinc-100">{TOTAL.toLocaleString("fr-FR")}</strong> sociétés
          <span className="ml-3 text-zinc-500">soit ~{Math.round(TOTAL / 5).toLocaleString("fr-FR")}× le scope V1 actuel</span>
        </div>
      </DeskCard>

      <div className="space-y-2.5">
        {TARGETS.map((t) => (
          <DeskCard key={t.region}>
            <div className="flex items-baseline gap-2">
              <Pill color={t.color}>{t.region}</Pill>
              <span className="text-[14px] font-bold tabular-nums text-zinc-50">{t.count.toLocaleString("fr-FR")}</span>
              <span className="text-[11px] text-zinc-500">sociétés</span>
              <span className="ml-auto inline-flex items-center gap-2">
                <Pill color={t.priority === "T1" ? "green" : "amber"}>{t.priority}</Pill>
                <span className="text-[10.5px] text-zinc-500">{t.eta}</span>
              </span>
            </div>
            <p className="mt-2 text-[12px] text-zinc-400">{t.note}</p>
          </DeskCard>
        ))}
      </div>

      <DeskCard className="mt-4">
        <div className="mb-2 text-[12px] font-medium text-zinc-200">Étapes pipeline (chaque société)</div>
        <ol className="space-y-1.5 text-[12px] text-zinc-300">
          <li className="flex items-baseline gap-2"><Pill color="zinc">1</Pill> Scraper télécharge les filings (10-K, 10-Q, 8-K, DEF 14A) depuis EDGAR/AMF/etc.</li>
          <li className="flex items-baseline gap-2"><Pill color="zinc">2</Pill> Extraction LLM : prompt structuré → JSON KPIs + risques + gouvernance.</li>
          <li className="flex items-baseline gap-2"><Pill color="zinc">3</Pill> Stockage en table <code className="text-zinc-400">desk_pipeline</code> avec status <Pill color="amber">extracted</Pill></li>
          <li className="flex items-baseline gap-2"><Pill color="zinc">4</Pill> Tu approuves manuellement (sample) → status <Pill color="green">validated</Pill></li>
          <li className="flex items-baseline gap-2"><Pill color="zinc">5</Pill> Publication automatique vers les tables app → visible aux users.</li>
          <li className="flex items-baseline gap-2"><Pill color="zinc">6</Pill> Cron job trimestriel pour rafraîchir.</li>
        </ol>
      </DeskCard>

      <DeskCard className="mt-4 border-amber-500/20 bg-amber-500/[0.04]">
        <div className="text-[12px] text-amber-200">
          ⚠️ Le pipeline n'est <strong>pas démarré</strong>. C'est dans la roadmap V2 (~6-10 sem dev). Cet onglet est pour l'instant un brouillon de planification.
        </div>
      </DeskCard>
    </div>
  );
}
