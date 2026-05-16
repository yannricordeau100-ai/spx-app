import Link from "next/link";
import { ArrowLeft, Layers, Globe, FlaskConical, Wrench } from "lucide-react";
import { listReleases, type Release, type ReleaseLevel } from "@/lib/releases";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Releases · Mettrik AI",
  robots: { index: false, follow: false },
};

const LEVEL_META: Record<
  ReleaseLevel,
  { label: string; icon: typeof Globe; color: string; bg: string }
> = {
  live: {
    label: "LIVE · www.mettrik.ai",
    icon: Globe,
    color: "#10b981",
    bg: "from-emerald-500/15 via-emerald-500/[0.04] to-transparent",
  },
  "pre-live": {
    label: "PRE-LIVE · pre.mettrik.ai",
    icon: FlaskConical,
    color: "#f59e0b",
    bg: "from-amber-500/15 via-amber-500/[0.04] to-transparent",
  },
  dev: {
    label: "DEV · staging.mettrik.ai",
    icon: Wrench,
    color: "#06b6d4",
    bg: "from-cyan-500/15 via-cyan-500/[0.04] to-transparent",
  },
};

export default async function ReleasesPage() {
  const all = await listReleases();
  const byLevel: Record<ReleaseLevel, Release[]> = {
    live: [],
    "pre-live": [],
    dev: [],
  };
  for (const r of all) {
    byLevel[r.level].push(r);
  }

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link
          href="/desk-mtk9x4kp"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="size-4" /> Retour desk
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <Layers className="size-6 text-cyan-400" />
          <h1 className="font-display text-3xl font-semibold">Releases · Architecture 3 niveaux</h1>
        </div>

        <p className="mb-8 max-w-3xl text-[13.5px] leading-relaxed text-zinc-400">
          Historique versionné des push par niveau. Numéro de version invisible
          côté HTML public, exposé via header HTTP <code className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[12px]">X-Mettrik-Version</code> et
          endpoint <code className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[12px]">/api/version</code>.
          Chaque niveau garde l'historique de ses releases passées.
        </p>

        {(Object.keys(byLevel) as ReleaseLevel[]).map((lvl) => {
          const meta = LEVEL_META[lvl];
          const items = byLevel[lvl];
          const Icon = meta.icon;
          const current = items.find((r) => r.status === "current");
          const archived = items.filter((r) => r.status !== "current");
          return (
            <section
              key={lvl}
              className={`mb-8 overflow-hidden rounded-2xl border bg-gradient-to-br ${meta.bg} p-5`}
              style={{ borderColor: `${meta.color}40` }}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="size-5" style={{ color: meta.color }} />
                  <h2 className="text-[16px] font-semibold uppercase tracking-wider" style={{ color: meta.color }}>
                    {meta.label}
                  </h2>
                </div>
                <span className="text-[11px] text-zinc-500">{items.length} releases</span>
              </div>

              {current ? (
                <div
                  className="mb-4 rounded-xl border p-4"
                  style={{ borderColor: `${meta.color}60`, background: `${meta.color}15` }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: meta.color, color: "#0a0a0a" }}
                    >
                      Current
                    </span>
                    <span className="font-mono text-[18px] font-bold text-zinc-50">
                      v{current.version}
                    </span>
                    {current.git_sha && (
                      <span className="font-mono text-[11px] text-zinc-400">
                        {current.git_sha.slice(0, 8)}
                      </span>
                    )}
                  </div>
                  {current.notes && (
                    <p className="mb-1 text-[12.5px] text-zinc-200">{current.notes}</p>
                  )}
                  <div className="text-[11px] text-zinc-500">
                    Déployé le{" "}
                    {new Date(current.deployed_at).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {current.deployed_by && ` par ${current.deployed_by}`}
                    {current.vercel_url && (
                      <>
                        {" · "}
                        <a
                          href={current.vercel_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-300 hover:underline"
                        >
                          snapshot ↗
                        </a>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mb-4 rounded-xl border border-dashed border-white/[0.1] p-4 text-[12px] italic text-zinc-500">
                  Aucune release current pour ce niveau pour l'instant.
                </div>
              )}

              {archived.length > 0 && (
                <details className="text-[12px]">
                  <summary className="cursor-pointer text-zinc-400 hover:text-zinc-200">
                    Historique ({archived.length})
                  </summary>
                  <table className="mt-3 w-full border-collapse text-[11.5px]">
                    <thead>
                      <tr className="text-left text-zinc-500">
                        <th className="py-1.5 pr-2 font-mono text-[10px] uppercase tracking-wider">
                          version
                        </th>
                        <th className="py-1.5 pr-2 font-mono text-[10px] uppercase tracking-wider">
                          sha
                        </th>
                        <th className="py-1.5 pr-2 font-mono text-[10px] uppercase tracking-wider">
                          status
                        </th>
                        <th className="py-1.5 pr-2 font-mono text-[10px] uppercase tracking-wider">
                          déployé
                        </th>
                        <th className="py-1.5 pr-2 font-mono text-[10px] uppercase tracking-wider">
                          notes
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {archived.map((r) => (
                        <tr key={r.id} className="border-t border-white/[0.04]">
                          <td className="py-1.5 pr-2 font-mono text-zinc-200">v{r.version}</td>
                          <td className="py-1.5 pr-2 font-mono text-zinc-500">
                            {r.git_sha?.slice(0, 8) ?? "—"}
                          </td>
                          <td className="py-1.5 pr-2 text-zinc-400">{r.status}</td>
                          <td className="py-1.5 pr-2 text-zinc-400">
                            {new Date(r.deployed_at).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-1.5 pr-2 text-zinc-400">{r.notes ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </section>
          );
        })}

        <div className="mt-10 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 text-[12px] leading-relaxed text-zinc-400">
          <div className="mb-2 font-semibold uppercase tracking-wider text-zinc-200">
            Comment vérifier la version d'un niveau ?
          </div>
          <ul className="space-y-1.5">
            <li>
              · <strong>Live</strong> :{" "}
              <code className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono">
                curl -sI https://www.mettrik.ai/ | grep mettrik
              </code>
            </li>
            <li>
              · <strong>Pre-live</strong> :{" "}
              <code className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono">
                curl -sI https://pre.mettrik.ai/ | grep mettrik
              </code>
            </li>
            <li>
              · <strong>Dev</strong> :{" "}
              <code className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono">
                curl -sI https://staging.mettrik.ai/ | grep mettrik
              </code>
            </li>
            <li>
              · ou <strong>JSON</strong> : <code className="font-mono">/api/version</code> sur n'importe quel hostname
            </li>
            <li>
              · ou <strong>DevTools Network tab</strong> → headers de réponse contiennent{" "}
              <code className="font-mono">x-mettrik-version</code> et{" "}
              <code className="font-mono">x-mettrik-level</code>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
