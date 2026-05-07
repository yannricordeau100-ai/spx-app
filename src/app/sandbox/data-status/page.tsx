import { computeDataStatus, BLOCK_LABELS } from "@/lib/v1-7/data-status";

export const dynamic = "force-dynamic";
export const revalidate = 300; // 5 min de cache côté Next.js

export const metadata = {
  title: "Statut des données · Mettrik AI (interne)",
  robots: { index: false, follow: false },
};

/**
 * Page dashboard interne `/sandbox/data-status`.
 *
 * Affiche en temps quasi-réel (cache 5 min via revalidate) :
 *  - Téléchargements sec-data par catégorie (cat 1 US / cat 2 ADR / cat 3 EU)
 *  - Couverture pipeline LLM (Pass 1 / 2 / 3) + répartition Sonnet / Haiku
 *  - Audit V1.7 par bloc UI (logo, rangs, risques, gouvernance, IA, etc.)
 *  - Solde crédits LLM (Cerebras / Gemini / Anthropic)
 *  - Nombre de sociétés recherchables sur V1.7
 *
 * Mis à jour lors de chaque fetch (cron `mettrik-rebuild-merged` toutes les
 * heures + recalcul `audit-v17-blocks.ts` à la demande).
 *
 * Yann ajoutera plus tard d'autres critères ici, qui seront aussi affichés
 * dans le back-office (`/desk-mtk9x4kp/data-status`).
 */
export default async function DataStatusPage() {
  const s = computeDataStatus();
  const auditTotal = s.v17_audit.total_searchable;
  const accent = "#a78bfa";

  function rowFraction(n: number, total: number, color = accent) {
    const pct = total > 0 ? Math.round((n * 100) / total) : 0;
    return (
      <div className="flex items-center gap-3">
        <div className="font-mono tabular-nums text-zinc-100">
          <span className="text-base font-semibold">{n.toLocaleString("fr-FR")}</span>
          <span className="ml-1 text-xs text-zinc-500">/ {total.toLocaleString("fr-FR")}</span>
        </div>
        <div className="flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full" style={{ width: `${pct}%`, background: color }} />
          </div>
        </div>
        <div className="w-10 text-right font-mono text-xs tabular-nums text-zinc-400">{pct} %</div>
      </div>
    );
  }

  function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h2 className="mb-3 font-display text-[15px] font-semibold uppercase tracking-wider text-zinc-300">
          {title}
        </h2>
        {children}
      </section>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-zinc-100">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="font-display text-[28px] font-bold tracking-tight">Statut des données</h1>
        <div className="font-mono text-[11px] text-zinc-500">
          MAJ {new Date(s.generated_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
        </div>
      </div>
      <p className="mb-8 max-w-2xl text-[13.5px] leading-relaxed text-zinc-400">
        Tableau de bord interne. Données rafraîchies toutes les 5 minutes (cache Next.js).
        Chaque ligne montre où en est la couverture pour faire grossir V1.7.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* ─── Téléchargements sec-data ─────────────────────────────── */}
        <Card title="Téléchargements (sec-data)">
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-[12px]">
                <span className="font-medium text-zinc-300">Cat 1 — USA (10-K)</span>
              </div>
              {rowFraction(s.sec_data.cat1_us.downloaded, s.sec_data.cat1_us.target, "#22d3ee")}
              <p className="mt-1 text-[11px] text-zinc-500">
                Reste à télécharger : {Math.max(0, s.sec_data.cat1_us.target - s.sec_data.cat1_us.downloaded).toLocaleString("fr-FR")}
              </p>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[12px]">
                <span className="font-medium text-zinc-300">Cat 2 — ADR étrangers (20-F)</span>
              </div>
              {rowFraction(s.sec_data.cat2_adr.downloaded, s.sec_data.cat2_adr.target, "#f59e0b")}
              <p className="mt-1 text-[11px] text-zinc-500">
                Reste à télécharger : {Math.max(0, s.sec_data.cat2_adr.target - s.sec_data.cat2_adr.downloaded).toLocaleString("fr-FR")}
              </p>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[12px]">
                <span className="font-medium text-zinc-300">Cat 3 — Européennes (rapport annuel)</span>
              </div>
              {rowFraction(s.sec_data.cat3_eu.downloaded, s.sec_data.cat3_eu.target, "#10b981")}
              <p className="mt-1 text-[11px] text-zinc-500">
                Reste à télécharger : {Math.max(0, s.sec_data.cat3_eu.target - s.sec_data.cat3_eu.downloaded).toLocaleString("fr-FR")}
              </p>
            </div>
          </div>
        </Card>

        {/* ─── Pipeline LLM ─────────────────────────────────────────── */}
        <Card title="Pipeline LLM (sociétés traitées)">
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[12px] font-medium text-zinc-300">Pass 1 — extraction KPI</div>
              {rowFraction(s.pipeline.pass1, s.pipeline.total, "#a78bfa")}
            </div>
            <div>
              <div className="mb-1 text-[12px] font-medium text-zinc-300">Pass 2 — risques + gouvernance + IA</div>
              {rowFraction(s.pipeline.pass2, s.pipeline.total, "#a78bfa")}
            </div>
            <div>
              <div className="mb-1 text-[12px] font-medium text-zinc-300">Pass 3 — validation</div>
              {rowFraction(s.pipeline.pass3, s.pipeline.total, "#a78bfa")}
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
              <div className="mb-1 text-[11px] uppercase tracking-wider text-zinc-500">Détail Pass 3</div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="font-mono text-[18px] font-semibold tabular-nums text-violet-300">
                    {s.pipeline.pass3_sonnet.toLocaleString("fr-FR")}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">Sonnet</div>
                </div>
                <div>
                  <div className="font-mono text-[18px] font-semibold tabular-nums text-cyan-300">
                    {s.pipeline.pass3_haiku.toLocaleString("fr-FR")}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">Haiku</div>
                </div>
                <div>
                  <div className="font-mono text-[18px] font-semibold tabular-nums text-zinc-400">
                    {s.pipeline.pass3_other.toLocaleString("fr-FR")}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">Autre</div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* ─── Crédits LLM ──────────────────────────────────────────── */}
        <Card title="Crédits LLM restants">
          <div className="space-y-3">
            {(["cerebras", "gemini", "anthropic"] as const).map((provider) => {
              const c = s.llm_credits[provider];
              return (
                <div key={provider} className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-[12px] font-semibold capitalize text-zinc-300">{provider}</span>
                    <span className="font-mono tabular-nums text-zinc-100">
                      {c.remaining_usd !== null ? `$${c.remaining_usd.toLocaleString("fr-FR")}` : "—"}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500">{c.note}</div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ─── Sociétés recherchables ───────────────────────────────── */}
        <Card title="Sociétés visibles sur V1.7">
          <div className="space-y-3">
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/[0.06] p-4 text-center">
              <div className="font-display text-[40px] font-bold tabular-nums text-violet-200">
                {s.searchable_count.toLocaleString("fr-FR")}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-400">recherchables sur le hub</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Logos PNG</div>
                <div className="font-mono text-[16px] font-semibold tabular-nums text-zinc-100">{s.logos_count}</div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Total pipeline</div>
                <div className="font-mono text-[16px] font-semibold tabular-nums text-zinc-100">{s.pipeline.total}</div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Défauts de type silencieux ──────────────────────────────── */}
      <div className="mt-4">
        <Card title={`Défauts de type dataset (${s.type_defects.total_affected} sés sur ${s.type_defects.total_companies} affectées)`}>
          <p className="mb-3 text-[12px] text-zinc-400">
            Bugs silencieux qui peuvent casser le rendu d'une fiche (ex : <code>unit: null</code>,
            <code> top_capital: null</code>, hero KPI introuvable). La UI les coerce
            automatiquement à la lecture, mais les données sources gagneraient à être nettoyées.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Object.entries(s.type_defects.by_code)
              .sort((a, b) => b[1] - a[1])
              .map(([code, n]) => (
                <div key={code} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-[12px]">
                  <span className="font-mono text-zinc-300">{code}</span>
                  <span className="font-mono font-semibold tabular-nums text-amber-300">{n}</span>
                </div>
              ))}
            {Object.keys(s.type_defects.by_code).length === 0 && (
              <div className="text-[12px] text-zinc-500">Aucun défaut détecté.</div>
            )}
          </div>
        </Card>
      </div>

      {/* ─── Audit V1.7 par bloc UI ───────────────────────────────────── */}
      <div className="mt-4">
        <Card title={`Audit V1.7 — qualité des blocs (${auditTotal} sociétés Pass 3 strict)`}>
          <div className="space-y-2.5">
            {Object.entries(s.v17_audit.missing).map(([code, count]) => {
              const label = BLOCK_LABELS[code] ?? code;
              const filled = auditTotal - count;
              return (
                <div key={code}>
                  <div className="mb-0.5 flex items-center justify-between text-[12.5px]">
                    <span className="font-medium text-zinc-200">{label}</span>
                    <span className="font-mono text-[11px] tabular-nums text-zinc-400">
                      {filled.toLocaleString("fr-FR")} / {auditTotal.toLocaleString("fr-FR")}
                    </span>
                  </div>
                  {rowFraction(filled, auditTotal, "#a78bfa")}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <footer className="mt-12 pb-8 text-center font-mono text-[10px] uppercase tracking-wider text-zinc-600">
        Mettrik AI · Statut interne · Cache 5 min
      </footer>
    </main>
  );
}
