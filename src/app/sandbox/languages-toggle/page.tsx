import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { revalidatePath } from "next/cache";
import { promises as fs } from "fs";
import path from "path";
import { loadDisabledLocales } from "@/lib/disabled-locales";
import { LOCALES, LOCALE_META, type Locale } from "@/lib/i18n/types";

/**
 * /sandbox/v1-8/languages-toggle — admin sandbox pour activer / désactiver
 * une langue dans le picker (LanguageDropdown). Les dictionnaires i18n
 * restent intacts en code ; seule l'option disparaît visuellement.
 *
 * Cas d'usage : NL (néerlandais) caché par défaut tant que la couverture
 * traduction n'est pas suffisante, sans toucher au pipeline i18n.
 *
 * Persistance : `src/data/disabled-locales.json`.
 */
export const metadata = {
  title: "Langues : activer / désactiver · sandbox · Mettrik AI",
  robots: { index: false, follow: false },
};

const CONFIG_PATH = path.join(process.cwd(), "src/data/disabled-locales.json");

async function disableLocale(formData: FormData) {
  "use server";
  const loc = String(formData.get("locale") ?? "").trim();
  if (!loc) return;
  const cfg = loadDisabledLocales();
  if (!cfg.disabled.includes(loc)) cfg.disabled.push(loc);
  await fs.writeFile(
    CONFIG_PATH,
    JSON.stringify(
      {
        _doc: "Liste des locales masquées du picker langue. Géré via /sandbox/v1-8/languages-toggle.",
        disabled: cfg.disabled,
        updated_at: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  );
  revalidatePath("/sandbox/v1-8/languages-toggle");
  revalidatePath("/", "layout");
}

async function enableLocale(formData: FormData) {
  "use server";
  const loc = String(formData.get("locale") ?? "").trim();
  if (!loc) return;
  const cfg = loadDisabledLocales();
  cfg.disabled = cfg.disabled.filter((l) => l !== loc);
  await fs.writeFile(
    CONFIG_PATH,
    JSON.stringify(
      {
        _doc: "Liste des locales masquées du picker langue. Géré via /sandbox/v1-8/languages-toggle.",
        disabled: cfg.disabled,
        updated_at: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  );
  revalidatePath("/sandbox/v1-8/languages-toggle");
  revalidatePath("/", "layout");
}

export default async function LanguagesTogglePage() {
  const cfg = loadDisabledLocales();
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
          Langues : activer / désactiver
        </h1>
        <p className="mb-6 max-w-xl text-[13.5px] text-zinc-400">
          Masque une langue du picker langue sans toucher aux dictionnaires
          i18n (la traduction reste en code, juste l&apos;option disparaît).
          Utile pour cacher une langue dont la couverture est insuffisante,
          en attendant l&apos;ajout des trad manquantes.
        </p>

        <section className="mb-8">
          <h2 className="mb-3 font-display text-[14px] font-semibold uppercase tracking-wider text-zinc-300">
            Langues disponibles
          </h2>
          <div className="space-y-2">
            {LOCALES.map((loc: Locale) => {
              const meta = LOCALE_META[loc];
              const isOff = disabled.has(loc);
              return (
                <div
                  key={loc}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="text-[20px] leading-none" aria-hidden>
                      {meta.flag}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-zinc-100">
                        {meta.nativeName}
                      </div>
                      <div className="font-mono text-[11px] text-zinc-500">{loc}</div>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ${
                      isOff
                        ? "border border-amber-500/30 bg-amber-500/10 text-amber-200"
                        : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    }`}
                  >
                    {isOff ? "masquée" : "visible"}
                  </span>
                  <form action={isOff ? enableLocale : disableLocale}>
                    <input type="hidden" name="locale" value={loc} />
                    <button
                      type="submit"
                      className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                        isOff
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15"
                      }`}
                    >
                      {isOff ? "Réactiver" : "Masquer"}
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
