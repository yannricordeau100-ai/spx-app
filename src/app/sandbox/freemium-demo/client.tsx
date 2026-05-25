"use client";

import { useState } from "react";
import { FreemiumBlurProvider, type UserTier } from "@/lib/freemium/context";
import { BlurredFreeValue } from "@/components/freemium/blurred-free-value";

/**
 * Demo client : toggle 3-tier + AAPL et GOOGL (verrouillée vs accessible).
 * Yann peut switcher en 1 clic et voir l'effet sur les chiffres.
 */
export function FreemiumDemoClient() {
  const [tier, setTier] = useState<UserTier>("free");

  return (
    <FreemiumBlurProvider tier={tier}>
      <div className="mt-8">
        {/* Toggle 3-tier */}
        <div className="mb-8 inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1">
          {(["free", "premium", "max"] as UserTier[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t)}
              className={`rounded-lg px-4 py-2 text-[12.5px] font-bold uppercase tracking-wider transition-colors ${
                tier === t
                  ? t === "free"
                    ? "bg-zinc-500/20 text-zinc-100"
                    : t === "premium"
                      ? "bg-violet-500/20 text-violet-100"
                      : "bg-amber-500/20 text-amber-100"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="mb-6 text-[12px] text-zinc-500">
          Tier actuel : <strong className="text-zinc-200">{tier}</strong>.
          Switch pour voir l'effet sur les chiffres ci-dessous (AAPL verrouillée
          en free, GOOGL accessible).
        </p>

        {/* AAPL — verrouillée en free */}
        <DemoCard
          ticker="AAPL"
          name="Apple Inc."
          locked={tier === "free" || tier === "anon"}
          kpis={[
            { label: "Services Revenue (FY25)", value: "96.169", suffix: " Mds $" },
            { label: "YoY growth", value: "+13.0", suffix: " %" },
            { label: "iPhone Units (FY24)", value: "232.1", suffix: " M unités" },
            { label: "Active Devices", value: "2.20", suffix: " Mds" },
            { label: "Gross Margin", value: "46.2", suffix: " %" },
          ]}
        />

        {/* GOOGL — toujours accessible (tradition V1 free) */}
        <DemoCard
          ticker="GOOGL"
          name="Alphabet Inc. (Google) — accessible en free"
          locked={false}
          kpis={[
            { label: "Google Cloud Revenue (FY25)", value: "43.2", suffix: " Mds $" },
            { label: "YoY growth", value: "+30.5", suffix: " %" },
            { label: "Search Revenue", value: "198.1", suffix: " Mds $" },
            { label: "YouTube Ads", value: "36.1", suffix: " Mds $" },
            { label: "Operating Margin", value: "32.1", suffix: " %" },
          ]}
        />

        {/* Note technique */}
        <div className="mt-12 rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-5 text-[12.5px] text-zinc-300">
          <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-violet-200">
            🔒 Inviolabilité technique
          </h3>
          <p className="leading-relaxed">
            En production : la valeur réelle est masquée côté <strong>server</strong> (SSR)
            quand <code className="text-violet-300">isTickerLockedForTier(ticker, tier)</code>
            retourne <code className="text-violet-300">true</code>. Le HTML envoyé au client
            ne contient que <code className="text-zinc-400">████</code> + suffix. Devtools,
            curl, view-source ne révèlent rien. Seul le serveur a la donnée.
          </p>
          <p className="mt-2 leading-relaxed">
            Le <code className="text-violet-300">filter: blur(5px)</code> CSS est une 2e
            couche cosmétique appliquée AU CAS OÙ la valeur transiterait par erreur côté
            client (rare). C'est de la défense en profondeur.
          </p>
        </div>
      </div>
    </FreemiumBlurProvider>
  );
}

function DemoCard({
  ticker,
  name,
  locked,
  kpis,
}: {
  ticker: string;
  name: string;
  locked: boolean;
  kpis: { label: string; value: string; suffix: string }[];
}) {
  return (
    <div className={`mb-8 rounded-2xl border p-6 ${
      locked
        ? "border-amber-500/20 bg-amber-500/[0.02]"
        : "border-emerald-500/20 bg-emerald-500/[0.02]"
    }`}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[20px] font-bold tracking-tight">
          <span className="font-mono" style={{ color: locked ? "#fbbf24" : "#34d399" }}>{ticker}</span>
          <span className="ml-3 text-zinc-300">{name}</span>
        </h2>
        <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider ${
          locked
            ? "bg-amber-500/15 text-amber-200"
            : "bg-emerald-500/15 text-emerald-200"
        }`}>
          {locked ? "🔒 Verrouillé" : "✓ Accessible"}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="flex items-baseline justify-between gap-3 rounded-lg border border-white/[0.05] bg-black/30 px-3 py-2.5">
            <span className="text-[12px] text-zinc-400">{kpi.label}</span>
            <span className="font-display text-[16px] font-bold tabular-nums">
              <BlurredFreeValue
                value={kpi.value}
                suffix={kpi.suffix}
                ticker={ticker}
                className="text-zinc-50"
              />
            </span>
          </div>
        ))}
      </div>
      {locked && (
        <p className="mt-4 text-[11.5px] text-amber-200/80">
          ★ Click sur un chiffre floutté → redirect <code>/pricing</code> pour upgrade.
        </p>
      )}
    </div>
  );
}
