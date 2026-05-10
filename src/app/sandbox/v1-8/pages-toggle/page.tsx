import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { revalidatePath } from "next/cache";
import { promises as fs } from "fs";
import path from "path";
import { loadDisabledPages } from "@/lib/disabled-pages";

/**
 * /sandbox/v1-8/pages-toggle — admin sandbox pour activer/désactiver des
 * pages du site. Liste persistée dans `src/data/disabled-pages.json`.
 *
 * Usage : ajouter une route (ex `/parrainage`) dans le champ + bouton
 * "Désactiver". Cliquer "Réactiver" pour la réactiver. Le fichier source
 * code n'est PAS supprimé : seule la page rend un 404 tant qu'elle est
 * désactivée. Permet de cacher temporairement une fonctionnalité sans
 * casser le code.
 */
export const metadata = {
  title: "Pages : activer / désactiver · sandbox",
  robots: { index: false, follow: false },
};

const CONFIG_PATH = path.join(process.cwd(), "src/data/disabled-pages.json");

const KNOWN_PAGES: Array<{ path: string; label: string }> = [
  { path: "/parrainage", label: "Parrainage" },
  { path: "/account", label: "Mon compte" },
  { path: "/contact", label: "Contact" },
  { path: "/pricing", label: "Tarifs (public)" },
  { path: "/sandbox/v1-8/contact", label: "Contact (sandbox)" },
  { path: "/sandbox/v1-8/pricing", label: "Tarifs (sandbox)" },
];

async function disablePage(formData: FormData) {
  "use server";
  const route = String(formData.get("route") ?? "").trim();
  if (!route || !route.startsWith("/")) return;
  const cfg = loadDisabledPages();
  if (!cfg.disabled.includes(route)) cfg.disabled.push(route);
  await fs.writeFile(
    CONFIG_PATH,
    JSON.stringify(
      {
        _doc: "Liste des routes désactivées (renvoient 404 sans être supprimées). Géré via /sandbox/v1-8/pages-toggle.",
        disabled: cfg.disabled,
        updated_at: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  );
  revalidatePath("/sandbox/v1-8/pages-toggle");
  revalidatePath(route);
}

async function enablePage(formData: FormData) {
  "use server";
  const route = String(formData.get("route") ?? "").trim();
  if (!route) return;
  const cfg = loadDisabledPages();
  cfg.disabled = cfg.disabled.filter((r) => r !== route);
  await fs.writeFile(
    CONFIG_PATH,
    JSON.stringify(
      {
        _doc: "Liste des routes désactivées (renvoient 404 sans être supprimées). Géré via /sandbox/v1-8/pages-toggle.",
        disabled: cfg.disabled,
        updated_at: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  );
  revalidatePath("/sandbox/v1-8/pages-toggle");
  revalidatePath(route);
}

export default async function PagesTogglePage() {
  const cfg = loadDisabledPages();
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
          Pages : activer / désactiver
        </h1>
        <p className="mb-6 max-w-xl text-[13.5px] text-zinc-400">
          Désactiver une page la rend introuvable (404) sans la supprimer du
          code. Réactivable d&apos;un clic. Utile pour cacher temporairement
          une fonctionnalité.
        </p>

        {/* Liste pages connues */}
        <section className="mb-8">
          <h2 className="mb-3 font-display text-[14px] font-semibold uppercase tracking-wider text-zinc-300">
            Pages connues
          </h2>
          <div className="space-y-2">
            {KNOWN_PAGES.map((p) => {
              const isOff = disabled.has(p.path);
              return (
                <div
                  key={p.path}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-zinc-100">{p.label}</div>
                    <div className="font-mono text-[11px] text-zinc-500">{p.path}</div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ${
                      isOff
                        ? "border border-amber-500/30 bg-amber-500/10 text-amber-200"
                        : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    }`}
                  >
                    {isOff ? "désactivée" : "active"}
                  </span>
                  <form action={isOff ? enablePage : disablePage}>
                    <input type="hidden" name="route" value={p.path} />
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

        {/* Désactivées hors liste connue (manuel) */}
        {cfg.disabled.filter((r) => !KNOWN_PAGES.some((p) => p.path === r)).length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 font-display text-[14px] font-semibold uppercase tracking-wider text-zinc-300">
              Autres routes désactivées
            </h2>
            <div className="space-y-2">
              {cfg.disabled
                .filter((r) => !KNOWN_PAGES.some((p) => p.path === r))
                .map((r) => (
                  <div
                    key={r}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                  >
                    <div className="font-mono text-[12.5px] text-zinc-200">{r}</div>
                    <form action={enablePage}>
                      <input type="hidden" name="route" value={r} />
                      <button
                        type="submit"
                        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[12px] font-semibold text-emerald-200 hover:bg-emerald-500/15"
                      >
                        Réactiver
                      </button>
                    </form>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Ajout manuel d'une route */}
        <section>
          <h2 className="mb-3 font-display text-[14px] font-semibold uppercase tracking-wider text-zinc-300">
            Ajouter une route à désactiver
          </h2>
          <form action={disablePage} className="flex gap-2">
            <input
              type="text"
              name="route"
              placeholder="/ma-route"
              required
              pattern="^/.+"
              className="flex-1 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 font-mono text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[13px] font-semibold text-amber-200 hover:bg-amber-500/15"
            >
              Désactiver
            </button>
          </form>
          <p className="mt-2 text-[11.5px] text-zinc-500">
            Note : la page concernée doit appeler <code className="font-mono text-zinc-400">isPageDisabled</code> en haut
            de son rendu pour respecter ce flag (déjà fait pour /parrainage).
          </p>
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
