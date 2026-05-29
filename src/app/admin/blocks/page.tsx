import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { revalidatePath } from "next/cache";
import { promises as fs } from "fs";
import path from "path";
import tickers from "@/data/v1-8-tickers-sorted.json";
import { requireDeskOwner } from "@/lib/desk/auth";
import {
  DISABLED_BLOCKS_KEYS,
  DISABLED_BLOCKS_LABELS,
  loadDisabledBlocks,
  loadDisabledBlocksPerSte,
  type DisabledBlockKey,
} from "@/lib/disabled-blocks";

/**
 * /admin/blocks — page UNIQUE et VERSION-AGNOSTIC pour gérer les blocs
 * page société. Remplace les anciens :
 *   - /sandbox/v1-8/blocks-toggle (toggle global on/off des 19 blocs)
 *   - /sandbox/v1-8/blocks-per-ste (override per-ticker)
 *
 * Combine les 2 chantiers (Yann 29 mai 2026) dans une seule UI back office,
 * gated `requireDeskOwner()`. Les anciens paths sont redirigés en 308 vers
 * cette page (cf src/proxy.ts).
 *
 * Source de vérité :
 *   - global : src/data/disabled-blocks.json
 *   - per-sté : src/data/disabled-blocks-per-ste.json
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Blocs page société · admin",
  robots: { index: false, follow: false },
};

const GLOBAL_CONFIG_PATH = path.join(process.cwd(), "src/data/disabled-blocks.json");
const PER_STE_CONFIG_PATH = path.join(
  process.cwd(),
  "src/data/disabled-blocks-per-ste.json",
);

const TICKER_LIST = tickers as string[];
const TICKER_SET = new Set(TICKER_LIST.map((t) => t.toUpperCase()));

/* ------------------------------------------------------------------ */
/* Server actions                                                     */
/* ------------------------------------------------------------------ */

async function disableBlockGlobal(formData: FormData) {
  "use server";
  await requireDeskOwner();
  const key = String(formData.get("block") ?? "").trim();
  if (!key) return;
  const cfg = loadDisabledBlocks();
  if (!cfg.disabled.includes(key)) cfg.disabled.push(key);
  await fs.writeFile(
    GLOBAL_CONFIG_PATH,
    JSON.stringify(
      {
        _doc:
          "Liste des blocs page société désactivés globalement. Géré via /admin/blocks.",
        disabled: cfg.disabled,
        updated_at: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  );
  revalidatePath("/admin/blocks");
  revalidatePath("/", "layout");
}

async function enableBlockGlobal(formData: FormData) {
  "use server";
  await requireDeskOwner();
  const key = String(formData.get("block") ?? "").trim();
  if (!key) return;
  const cfg = loadDisabledBlocks();
  cfg.disabled = cfg.disabled.filter((b) => b !== key);
  await fs.writeFile(
    GLOBAL_CONFIG_PATH,
    JSON.stringify(
      {
        _doc:
          "Liste des blocs page société désactivés globalement. Géré via /admin/blocks.",
        disabled: cfg.disabled,
        updated_at: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  );
  revalidatePath("/admin/blocks");
  revalidatePath("/", "layout");
}

async function savePerSteOverride(formData: FormData) {
  "use server";
  await requireDeskOwner();
  const tickerRaw = String(formData.get("ticker") ?? "").trim().toUpperCase();
  if (!tickerRaw) return;

  const blocks: DisabledBlockKey[] = [];
  for (const key of DISABLED_BLOCKS_KEYS) {
    if (formData.get(`block_${key}`) === "on") {
      blocks.push(key);
    }
  }

  let current: {
    _doc?: string;
    overrides?: Record<string, string[]>;
    updated_at?: string;
  } = {};
  try {
    const raw = await fs.readFile(PER_STE_CONFIG_PATH, "utf-8");
    current = JSON.parse(raw);
  } catch {
    current = { overrides: {} };
  }

  const overrides: Record<string, string[]> = { ...(current.overrides ?? {}) };
  if (blocks.length === 0) {
    delete overrides[tickerRaw];
  } else {
    overrides[tickerRaw] = blocks;
  }

  await fs.writeFile(
    PER_STE_CONFIG_PATH,
    JSON.stringify(
      {
        _doc:
          current._doc ??
          "Overrides per-sté pour masquer des blocs page société sur un ticker précis. Géré via /admin/blocks.",
        overrides,
        updated_at: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  );

  revalidatePath("/admin/blocks");
  revalidatePath(`/sandbox/v1-9-5/${tickerRaw.toLowerCase()}`);
}

async function removePerSteOverride(formData: FormData) {
  "use server";
  await requireDeskOwner();
  const ticker = String(formData.get("ticker") ?? "").trim().toUpperCase();
  if (!ticker) return;

  let current: { _doc?: string; overrides?: Record<string, string[]> } = {};
  try {
    const raw = await fs.readFile(PER_STE_CONFIG_PATH, "utf-8");
    current = JSON.parse(raw);
  } catch {
    return;
  }

  const overrides: Record<string, string[]> = { ...(current.overrides ?? {}) };
  delete overrides[ticker];

  await fs.writeFile(
    PER_STE_CONFIG_PATH,
    JSON.stringify(
      {
        _doc: current._doc,
        overrides,
        updated_at: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  );

  revalidatePath("/admin/blocks");
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default async function AdminBlocksPage({
  searchParams,
}: {
  searchParams: Promise<{ ticker?: string }>;
}) {
  // Auth-gate : Yann uniquement.
  await requireDeskOwner();

  const sp = await searchParams;
  const ticker = (sp.ticker ?? "").trim().toUpperCase();
  const tickerKnown = ticker.length > 0 && TICKER_SET.has(ticker);

  const globalCfg = loadDisabledBlocks();
  const disabledSet = new Set(globalCfg.disabled);
  const perSteCfg = loadDisabledBlocksPerSte();
  const currentBlocks = ticker ? perSteCfg.overrides[ticker] ?? [] : [];

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/admin"
          className="group mb-6 inline-flex items-center gap-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          Retour admin
        </Link>

        <h1 className="mb-2 font-display text-[28px] font-bold tracking-tight">
          Blocs page société
        </h1>
        <p className="mb-8 max-w-xl text-[13.5px] text-zinc-400">
          Page unique et version-agnostic pour activer / désactiver les{" "}
          {DISABLED_BLOCKS_KEYS.length} blocs de la page société. Toggle global
          + override per-sté. S&apos;applique à toutes les versions actives
          (V1.7-5, V1.8, V1.9, V1.9-5). Le code reste en place : réactivation
          d&apos;un clic.
        </p>

        {/* ─── Section 1 : toggle global ─── */}
        <section className="mb-10">
          <h2 className="mb-3 font-display text-[14px] font-semibold uppercase tracking-wider text-zinc-300">
            1. Toggle global on / off ({DISABLED_BLOCKS_KEYS.length} blocs)
          </h2>
          <div className="space-y-2">
            {DISABLED_BLOCKS_KEYS.map((key: DisabledBlockKey) => {
              const isOff = disabledSet.has(key);
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-zinc-100">
                      {DISABLED_BLOCKS_LABELS[key]}
                    </div>
                    <div className="font-mono text-[11px] text-zinc-500">{key}</div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ${
                      isOff
                        ? "border border-amber-500/30 bg-amber-500/10 text-amber-200"
                        : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    }`}
                  >
                    {isOff ? "désactivé" : "actif"}
                  </span>
                  <form action={isOff ? enableBlockGlobal : disableBlockGlobal}>
                    <input type="hidden" name="block" value={key} />
                    <button
                      type="submit"
                      className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                        isOff
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15"
                      }`}
                    >
                      {isOff ? "Réactiver" : "Désactiver"}
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
          {globalCfg.updated_at && (
            <p className="mt-3 text-[11px] text-zinc-600">
              Dernière mise à jour global :{" "}
              {new Date(globalCfg.updated_at).toLocaleString("fr-FR")}
            </p>
          )}
        </section>

        {/* ─── Section 2 : override per-ticker ─── */}
        <section className="border-t border-white/[0.06] pt-10">
          <h2 className="mb-3 font-display text-[14px] font-semibold uppercase tracking-wider text-zinc-300">
            2. Override per-sté
          </h2>
          <p className="mb-5 max-w-xl text-[12.5px] text-zinc-400">
            Désactive un bloc UNIQUEMENT pour une sté précise (ex : gouvernance
            globalement activée mais masquée pour BABA, ADR Chinois sans
            DEF14A). Le global gagne toujours : si un bloc est désactivé
            globalement, l&apos;override per-sté n&apos;a pas d&apos;effet.
          </p>

          {/* Sélection ticker */}
          <form className="mb-6 flex gap-2">
            <input
              type="text"
              name="ticker"
              defaultValue={ticker}
              placeholder="Ticker (ex BABA, NVDA, AAPL)"
              list="ticker-list"
              className="flex-1 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 font-mono text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none"
              autoComplete="off"
            />
            <datalist id="ticker-list">
              {TICKER_LIST.slice(0, 300).map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <button
              type="submit"
              className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-[13px] font-semibold text-violet-100 hover:bg-violet-500/25"
            >
              Charger
            </button>
          </form>

          {ticker && !tickerKnown && (
            <p className="mb-4 text-[11.5px] text-amber-300/80">
              Ticker absent du top 307 V1.8 (mais override quand même applicable
              s&apos;il existe ailleurs).
            </p>
          )}

          {/* Formulaire override */}
          {ticker && (
            <div className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h3 className="mb-3 font-display text-[15px] font-semibold">
                Blocs désactivés pour{" "}
                <span className="font-mono text-violet-200">{ticker}</span>
              </h3>
              <p className="mb-4 text-[12px] text-zinc-500">
                Coche les blocs que tu veux MASQUER pour cette sté uniquement.
              </p>

              <form action={savePerSteOverride} className="space-y-2">
                <input type="hidden" name="ticker" value={ticker} />
                {DISABLED_BLOCKS_KEYS.map((key) => {
                  const isGloballyDisabled = disabledSet.has(key);
                  const isCurrentlyDisabled = currentBlocks.includes(key);
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                        isCurrentlyDisabled
                          ? "border-amber-500/30 bg-amber-500/5"
                          : "border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        name={`block_${key}`}
                        defaultChecked={isCurrentlyDisabled}
                        disabled={isGloballyDisabled}
                        className="size-4 accent-violet-500"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-zinc-100">
                          {DISABLED_BLOCKS_LABELS[key]}
                        </div>
                        <div className="font-mono text-[10.5px] text-zinc-500">
                          {key}
                        </div>
                      </div>
                      {isGloballyDisabled && (
                        <span className="rounded-full border border-zinc-500/30 bg-zinc-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-300">
                          global off
                        </span>
                      )}
                      {isCurrentlyDisabled && !isGloballyDisabled && (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-200">
                          masqué
                        </span>
                      )}
                    </label>
                  );
                })}

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-[13px] font-semibold text-violet-100 hover:bg-violet-500/25"
                  >
                    Enregistrer
                  </button>
                </div>
              </form>

              {currentBlocks.length > 0 && (
                <form
                  action={removePerSteOverride}
                  className="mt-3 border-t border-white/[0.04] pt-3"
                >
                  <input type="hidden" name="ticker" value={ticker} />
                  <button
                    type="submit"
                    className="rounded-lg border border-zinc-600/30 bg-zinc-500/10 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-zinc-500/15"
                  >
                    Retirer tous les overrides pour {ticker}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Liste overrides actuels */}
          <div>
            <h3 className="mb-3 font-display text-[13px] font-semibold uppercase tracking-wider text-zinc-300">
              Overrides actuels ({Object.keys(perSteCfg.overrides).length})
            </h3>
            {Object.keys(perSteCfg.overrides).length === 0 ? (
              <p className="text-[12.5px] text-zinc-500">
                Aucun override per-sté pour le moment. Tape un ticker ci-dessus
                pour en créer un.
              </p>
            ) : (
              <div className="space-y-2">
                {Object.entries(perSteCfg.overrides)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([tk, blocks]) => (
                    <Link
                      key={tk}
                      href={`/admin/blocks?ticker=${tk}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-colors hover:bg-white/[0.04]"
                    >
                      <div className="font-mono text-[13px] font-semibold text-zinc-100">
                        {tk}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {blocks.map((b) => (
                          <span
                            key={b}
                            className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[10.5px] text-amber-200"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </Link>
                  ))}
              </div>
            )}
          </div>

          {perSteCfg.updated_at && (
            <p className="mt-8 text-[11px] text-zinc-600">
              Dernière mise à jour per-sté :{" "}
              {new Date(perSteCfg.updated_at).toLocaleString("fr-FR")}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
