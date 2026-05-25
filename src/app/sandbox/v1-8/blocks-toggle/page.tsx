import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { revalidatePath } from "next/cache";
import { promises as fs } from "fs";
import path from "path";
import {
  loadDisabledBlocks,
  DISABLED_BLOCKS_KEYS,
  DISABLED_BLOCKS_LABELS,
  type DisabledBlockKey,
} from "@/lib/disabled-blocks";

/**
 * /sandbox/v1-8/blocks-toggle — admin sandbox pour activer / désactiver
 * des BLOCS de la page société (snapshot boursier, description Mettrik,
 * graphiques et schémas, gouvernance, IA, transcripts, risks, stories,
 * events). Persistance dans `src/data/disabled-blocks.json`.
 *
 * Pas de suppression de code : le composant reste en place, on saute
 * juste son rendu. Réactivable d'un clic. Utile pour cacher un bloc dont
 * la data n'est pas encore prête sur l'ensemble des stés (V1.7-5 / V1.8 /
 * V1.9 / V1.9-5).
 */
export const metadata = {
  title: "Blocs page société : activer / désactiver · sandbox",
  robots: { index: false, follow: false },
};

const CONFIG_PATH = path.join(process.cwd(), "src/data/disabled-blocks.json");

async function disableBlock(formData: FormData) {
  "use server";
  const key = String(formData.get("block") ?? "").trim();
  if (!key) return;
  const cfg = loadDisabledBlocks();
  if (!cfg.disabled.includes(key)) cfg.disabled.push(key);
  await fs.writeFile(
    CONFIG_PATH,
    JSON.stringify(
      {
        _doc: "Liste des blocs page société désactivés. Géré via /sandbox/v1-8/blocks-toggle.",
        disabled: cfg.disabled,
        updated_at: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  );
  revalidatePath("/sandbox/v1-8/blocks-toggle");
  // Revalide les pages société (V1.7-5 / V1.8 / V1.9 / V1.9-5) qui
  // utilisent ce flag.
  revalidatePath("/", "layout");
}

async function enableBlock(formData: FormData) {
  "use server";
  const key = String(formData.get("block") ?? "").trim();
  if (!key) return;
  const cfg = loadDisabledBlocks();
  cfg.disabled = cfg.disabled.filter((b) => b !== key);
  await fs.writeFile(
    CONFIG_PATH,
    JSON.stringify(
      {
        _doc: "Liste des blocs page société désactivés. Géré via /sandbox/v1-8/blocks-toggle.",
        disabled: cfg.disabled,
        updated_at: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  );
  revalidatePath("/sandbox/v1-8/blocks-toggle");
  revalidatePath("/", "layout");
}

export default async function BlocksTogglePage() {
  const cfg = loadDisabledBlocks();
  const disabled = new Set(cfg.disabled);

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/sandbox/v1-8"
          className="group mb-6 inline-flex items-center gap-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          Retour sandbox
        </Link>

        <h1 className="mb-2 font-display text-[28px] font-bold tracking-tight">
          Blocs page société : activer / désactiver
        </h1>
        <p className="mb-6 max-w-xl text-[13.5px] text-zinc-400">
          Désactiver un bloc le masque sur toutes les pages société (V1.7-5,
          V1.8, V1.9, V1.9-5). Le code reste en place : réactivation d&apos;un
          clic. Snapshot boursier et Graphiques et schémas sont indépendants.
        </p>

        <section className="mb-8">
          <h2 className="mb-3 font-display text-[14px] font-semibold uppercase tracking-wider text-zinc-300">
            Blocs disponibles
          </h2>
          <div className="space-y-2">
            {DISABLED_BLOCKS_KEYS.map((key: DisabledBlockKey) => {
              const isOff = disabled.has(key);
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
                  <form action={isOff ? enableBlock : disableBlock}>
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
        </section>

        {cfg.updated_at && (
          <p className="mt-8 text-[11px] text-zinc-600">
            Dernière mise à jour : {new Date(cfg.updated_at).toLocaleString("fr-FR")}
          </p>
        )}
      </div>
    </div>
  );
}
