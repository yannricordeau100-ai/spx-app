// Yann 4 juin 2026 : Sandbox cadre haut = calendrier des 2 prochaines
// executions du cron earnings refresh (dimanche 23:00 UTC = lundi 01:00 Paris).
// Le cron est gere par GitHub Actions (.github/workflows/daily-earnings-refresh.yml)
// donc se declenche tout seul a l'heure dite, sans intervention Yann ni Claude.
//
// La page affiche aussi : etat dernier run, couverture (--limit 640 sur 640 stes),
// scripts appeles, et 0 token Claude consomme (Cerebras free tier).

import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function nextMondayAt01Paris(after?: Date): Date {
  // On utilise une base statique pour eviter Math.random / Date.now dans le
  // workflow. La page est force-dynamic donc evaluee a chaque request.
  const base = after ?? new Date(Date.UTC(2026, 5, 4, 0, 0, 0)); // 4 juin 2026
  const day = base.getUTCDay();
  // dimanche=0, lundi=1, ..., samedi=6
  // On vise le PROCHAIN dimanche 23:00 UTC (= lundi 01:00 Paris)
  const daysUntilSunday = (7 - day) % 7;
  const target = new Date(base);
  target.setUTCDate(target.getUTCDate() + daysUntilSunday);
  target.setUTCHours(23, 0, 0, 0);
  // Si le target est <= base, on prend le suivant
  if (target.getTime() <= base.getTime()) {
    target.setUTCDate(target.getUTCDate() + 7);
  }
  return target;
}

function formatParis(d: Date): string {
  return d.toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function EarningsSchedulePage() {
  // Yann 4 juin 2026 : evite Date.now / new Date() argless dans les workflows.
  // Ici cote page Next.js c'est OK (server component, pas workflow).
  await headers(); // force-dynamic side-effect
  const now = new Date();
  const next1 = nextMondayAt01Paris(now);
  const next2 = nextMondayAt01Paris(next1);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Cadre haut Yann demande explicitement le 4 juin 2026 */}
        <div className="mb-8 rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/40 to-zinc-900 p-6 shadow-[0_0_40px_rgba(168,85,247,0.15)]">
          <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-violet-300">
            <span className="inline-block size-2 animate-pulse rounded-full bg-violet-400" />
            Cron earnings refresh - prochaines executions
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-violet-500/20 bg-zinc-950/60 p-4">
              <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                Prochain lundi
              </div>
              <div className="mt-1 font-display text-lg font-bold text-violet-100">
                {formatParis(next1)}
              </div>
              <div className="mt-1 text-[11px] text-zinc-400">
                = {next1.toISOString().slice(0, 16).replace("T", " ")} UTC
              </div>
            </div>
            <div className="rounded-lg border border-zinc-700/40 bg-zinc-950/60 p-4">
              <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                Lundi suivant
              </div>
              <div className="mt-1 font-display text-lg font-bold text-zinc-100">
                {formatParis(next2)}
              </div>
              <div className="mt-1 text-[11px] text-zinc-400">
                = {next2.toISOString().slice(0, 16).replace("T", " ")} UTC
              </div>
            </div>
          </div>
          <div className="mt-4 text-[12px] leading-relaxed text-zinc-400">
            Declenchement automatique via GitHub Actions cron
            (<code className="rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] text-violet-300">0 23 * * 0</code>).
            Aucune action requise. Aucune consommation de tokens Claude.
            Pipeline : <code className="text-violet-300">fetch-filing-dates.py</code>
            + <code className="text-violet-300">earnings-dates-yfinance.py</code>
            + <code className="text-violet-300">refresh-last-data-date-all.py</code>
            + (a venir) <code className="text-violet-300">post-earning-extract.py</code> via Cerebras free tier.
          </div>
        </div>

        <h1 className="mb-6 font-display text-3xl font-bold text-zinc-50">
          Earnings refresh workflow
        </h1>

        <section className="mb-8 space-y-3">
          <h2 className="font-display text-xl font-semibold text-zinc-100">
            Couverture
          </h2>
          <p className="text-[14px] leading-relaxed text-zinc-300">
            Le workflow est passe de <code>--limit 307</code> a{" "}
            <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-emerald-300">
              --limit 640
            </code>{" "}
            (couverture 100% V1.9.5).
          </p>
          <p className="text-[14px] leading-relaxed text-zinc-300">
            Quotidien 06:00 UTC : refresh dates et freshness (yfinance + SEC EDGAR, 0
            token Claude).
          </p>
          <p className="text-[14px] leading-relaxed text-zinc-300">
            Lundi 01:00 Paris (= dimanche 23:00 UTC) : run renforce post-weekend
            avec extraction KPIs trimestriels via Cerebras free tier (3 keys
            rotation, 90M tokens/jour gratuits). Pic earnings saison = 1.4% du
            quota free.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-zinc-100">
            Etat actuel
          </h2>
          <ul className="list-inside list-disc space-y-2 text-[14px] text-zinc-300">
            <li>
              GHA workflow{" "}
              <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-[12px] text-violet-300">
                daily-earnings-refresh.yml
              </code>{" "}
              actif (2 crons : quotidien + lundi).
            </li>
            <li>Couverture 640/640 stes V1.9.5.</li>
            <li>
              Extraction KPIs trimestriels post-earning :{" "}
              <span className="text-amber-300">a coder</span> (script Cerebras prevu).
            </li>
            <li>
              Monitoring Sentry pour bugs runtime :{" "}
              <span className="text-amber-300">a brancher</span> avant niveau 0.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
