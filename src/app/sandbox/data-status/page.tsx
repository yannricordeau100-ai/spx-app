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

      <div className="mb-8 flex flex-wrap items-center gap-2 text-[12.5px]">
        <a
          href="/desk-mtk9x4kp/data-quality-matrix"
          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 font-semibold text-violet-100 hover:bg-violet-500/25"
        >
          🔬 Matrice qualité données (sé × fonctionnalité)
        </a>
        <span className="text-[11px] text-zinc-500">
          18 colonnes auto-checkées · ✅/❌ humain · 🟢🟡🟠🔴 auto · accès desk requis
        </span>
      </div>

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

      {/* ─── Tableau croisé Bloc × Conversation ────────────────────── */}
      <div className="mt-4">
        <Card title="Qui s'occupe de quoi (par bloc et par conv)">
          <p className="mb-3 text-[12px] text-zinc-400">
            Une ligne par bloc de la page société. Une colonne par conversation.
            Chaque case montre, pour la conv responsable, le nombre de sociétés
            ayant ce bloc rempli, réparti par catégorie (cat 1 USA / cat 2 ADR
            / cat 3 EU). Vide = la conv ne traite pas ce bloc.
          </p>
          <p className="mb-3 rounded-lg border border-violet-500/20 bg-violet-500/[0.05] px-3 py-2 text-[11.5px] text-zinc-300">
            <strong className="text-violet-200">Code cellule :</strong> en bas à droite
            de chaque cellule, un code unique (B1A, B5C, etc.) référence la cellule.
            Tu peux écrire ce code à n'importe quelle conv (CONV-SYSTEMS, CONV-DATA,
            CONV-CONCEPTS, CONV-BRAND) et elle saura automatiquement de quoi tu parles.
            Format : <code className="text-violet-200">B&lt;ligne&gt;&lt;colonne&gt;</code>
            où ligne = numéro de bloc (1-{s.responsibility_matrix.length}) et colonne =
            S/D/C/B (Systems/Data/Concepts/Brand).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="px-2 py-2 text-left font-semibold text-zinc-300">#</th>
                  <th className="px-2 py-2 text-left font-semibold text-zinc-300">Bloc</th>
                  {(["CONV-SYSTEMS", "CONV-DATA", "CONV-CONCEPTS", "CONV-BRAND"] as const).map((c) => (
                    <th key={c} className="px-2 py-2 text-center font-semibold text-zinc-300">{c.replace("CONV-", "")}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.responsibility_matrix.map((row, rowIdx) => {
                  const lineNum = rowIdx + 1;
                  return (
                    <tr key={row.block_id} className="border-b border-white/[0.04]">
                      <td className="px-2 py-2 font-mono text-[10.5px] text-zinc-500">B{lineNum}</td>
                      <td className="px-2 py-2 text-zinc-200">{row.block_label}</td>
                      {(["CONV-SYSTEMS", "CONV-DATA", "CONV-CONCEPTS", "CONV-BRAND"] as const).map((c) => {
                        const cell = row.by_conv[c];
                        const colLetter = c === "CONV-SYSTEMS" ? "S" : c === "CONV-DATA" ? "D" : c === "CONV-CONCEPTS" ? "C" : "B";
                        const cellCode = `B${lineNum}${colLetter}`;
                        return (
                          <td key={c} className="relative px-2 py-1.5 text-center align-middle">
                            {cell ? (
                              <>
                                <div className="font-mono text-[11px] tabular-nums leading-tight">
                                  <div className="font-semibold text-zinc-100">{cell.cat1 + cell.cat2 + cell.cat3}</div>
                                  <div className="text-[10px] text-zinc-500">
                                    <span className="text-cyan-300">{cell.cat1}</span>
                                    <span className="mx-1">·</span>
                                    <span className="text-amber-300">{cell.cat2}</span>
                                    <span className="mx-1">·</span>
                                    <span className="text-emerald-300">{cell.cat3}</span>
                                  </div>
                                </div>
                                <span className="absolute bottom-0.5 right-1 font-mono text-[8.5px] uppercase tracking-wider text-zinc-600">
                                  {cellCode}
                                </span>
                              </>
                            ) : (
                              <span className="text-zinc-700">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] text-zinc-500">
            Légende : nombre du haut = total · ligne du bas = <span className="text-cyan-300">cat 1 USA</span> · <span className="text-amber-300">cat 2 ADR</span> · <span className="text-emerald-300">cat 3 EU</span>
          </p>
        </Card>
      </div>

      {/* ─── Responsable de l'organisation centrale ─────────────────── */}
      <div className="mt-4">
        <Card title="Qui contrôle l'organisation centrale des données">
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/[0.05] p-4">
            <div className="mb-1 font-display text-[16px] font-bold tracking-tight text-violet-200">
              {s.central_storage_owner.conv}
            </div>
            <p className="mb-3 text-[12.5px] leading-relaxed text-zinc-300">
              {s.central_storage_owner.description}
            </p>
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">Chemins canoniques</div>
            <ul className="mt-1 space-y-0.5">
              {s.central_storage_owner.paths.map((p) => (
                <li key={p} className="font-mono text-[11px] text-zinc-400">{p}</li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {/* ─── Pass 3 par catégorie avec liste nominative ─────────────── */}
      <div className="mt-4">
        <Card title="Pass 3 validé : sociétés par catégorie + modèle utilisé">
          <p className="mb-3 text-[12px] text-zinc-400">
            Liste nominative des sociétés dont tous les KPI ont été extraits ET validés
            via Pass 3 (Sonnet pour les top 308 / Haiku pour les autres). Le nom canonique
            de chaque société est indiqué.
          </p>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {(["cat1", "cat2", "cat3"] as const).map((cat) => {
              const data = s.pass3_by_cat[cat];
              const colors: Record<typeof cat, string> = { cat1: "#22d3ee", cat2: "#f59e0b", cat3: "#10b981" };
              const labels: Record<typeof cat, string> = { cat1: "Cat 1 — USA", cat2: "Cat 2 — ADR foreign", cat3: "Cat 3 — Europe" };
              return (
                <div key={cat} className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
                  <div className="mb-2 flex items-baseline justify-between">
                    <h3 className="font-display text-[13px] font-semibold uppercase tracking-wider" style={{ color: colors[cat] }}>
                      {labels[cat]}
                    </h3>
                    <span className="font-mono text-[18px] font-bold tabular-nums text-zinc-100">
                      {data.total}
                    </span>
                  </div>
                  <div className="mb-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded bg-violet-500/10 px-2 py-1 text-center">
                      <div className="text-violet-300">Sonnet</div>
                      <div className="font-mono font-semibold text-violet-200">{data.sonnet.length}</div>
                    </div>
                    <div className="rounded bg-cyan-500/10 px-2 py-1 text-center">
                      <div className="text-cyan-300">Haiku</div>
                      <div className="font-mono font-semibold text-cyan-200">{data.haiku.length}</div>
                    </div>
                  </div>
                  <details className="cursor-pointer">
                    <summary className="text-[11px] text-zinc-400 hover:text-zinc-200">
                      Voir les {data.total} sociétés
                    </summary>
                    <div className="mt-2 max-h-72 overflow-y-auto rounded bg-black/40 p-2 font-mono text-[10.5px] text-zinc-300">
                      {data.sonnet.length > 0 && (
                        <div className="mb-2">
                          <div className="mb-1 text-[10px] uppercase text-violet-400">Sonnet</div>
                          <div className="leading-relaxed">{data.sonnet.join(" · ")}</div>
                        </div>
                      )}
                      {data.haiku.length > 0 && (
                        <div>
                          <div className="mb-1 text-[10px] uppercase text-cyan-400">Haiku</div>
                          <div className="leading-relaxed">{data.haiku.join(" · ")}</div>
                        </div>
                      )}
                      {data.total === 0 && <div className="text-zinc-600">Aucune société</div>}
                    </div>
                  </details>
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
