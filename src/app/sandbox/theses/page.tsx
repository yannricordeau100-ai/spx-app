import { estAlias } from "@/lib/data";
import { promises as fs } from "fs";
import path from "path";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { coerceThese, type CompanyThese } from "@/lib/these";

export const dynamic = "force-dynamic";
export const metadata = { title: "Thèses d’investissement · Sandbox Mettrik", robots: { index: false, follow: false } };

/**
 * /sandbox/theses (Yann 19 sept 2026) : la liste des thèses rédigées, avec le
 * nom de la société, un mini descriptif, le style d'analyse retenu et
 * l'élément additionnel personnel (retirable), en entier ou résumé selon sa
 * taille. Lecture seule : les fichiers vivent dans src/data/these/.
 */
type Ligne = {
  ticker: string;
  nom: string;
  descriptif: string;
  these: CompanyThese;
  att_mois: string | null;
};

async function lireJson<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

function moisAn(iso?: string): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

async function charger(): Promise<Ligne[]> {
  const root = process.cwd();
  const dossier = path.join(root, "src/data/these");
  let fichiers: string[] = [];
  try {
    // Yann 24 sept 2026 : les lignes de cotation secondaires (DPW.DE, HEN.DE, AIR.DE) ne sont pas des societes a part.
    fichiers = (await fs.readdir(dossier)).filter((f) => f.endsWith(".json") && !estAlias(f.replace(/\.json$/, "")));
  } catch {
    return [];
  }
  const lignes: Ligne[] = [];
  for (const f of fichiers) {
    const these = coerceThese(await lireJson<unknown>(path.join(dossier, f)));
    if (!these) continue;
    const tl = f.replace(/\.json$/, "");
    const base = await lireJson<{ name?: string; tagline?: string; subsector?: string; sector?: string }>(path.join(root, "src/data/v2-pipeline", `${tl}.json`));
    const att = await lireJson<{ redigee_le?: string }>(path.join(root, "src/data/att", `${tl}.json`));
    const descriptif = [base?.sector, base?.subsector].filter(Boolean).join(" · ") + (base?.tagline ? ` · ${base.tagline}` : "");
    lignes.push({ ticker: these.ticker, nom: base?.name ?? these.ticker, descriptif, these, att_mois: att?.redigee_le ?? null });
  }
  lignes.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  return lignes;
}

const CONVICTION: Record<string, string> = { faible: "text-amber-300", moderee: "text-cyan-300", elevee: "text-emerald-300" };

export default async function Page({ searchParams }: { searchParams: Promise<{ audit_token?: string }> }) {
  const sp = await searchParams;
  const parJeton = !!sp.audit_token && !!process.env.VISUAL_AUDIT_TOKEN && sp.audit_token === process.env.VISUAL_AUDIT_TOKEN;
  if (!parJeton) {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user || user.email !== DESK_OWNER_EMAIL) redirect("/404");
  }
  const lignes = await charger();
  const pays = (t: string) => (t.endsWith(".PA") ? "France" : /\.(DE|AS|SW|BR|MC|MI|LS|L|ST|OL|CO|HE)$/.test(t) ? "Europe" : "États-Unis");
  const groupes = ["France", "États-Unis", "Europe"].map((p) => ({ p, l: lignes.filter((x) => pays(x.ticker) === p) })).filter((g) => g.l.length);
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-zinc-100">
      <h1 className="font-display text-[26px] font-bold">Thèses d’investissement</h1>
      <p className="mt-2 max-w-3xl text-[13.5px] text-zinc-400">
        {lignes.length} thèse{lignes.length > 1 ? "s" : ""} rédigée{lignes.length > 1 ? "s" : ""}. Chaque thèse est écrite selon les critères d’un investisseur célèbre, d’une grande banque ou d’une méthode reconnue, sans tenir compte de la valorisation, et antidatée sur un mois différent de l’anti-thèse. L’élément additionnel est un ajout personnel, séparé de la thèse et retirable sans la casser.
      </p>
      {groupes.map((g) => (
        <section key={g.p} className="mt-8">
          <h2 className="mb-3 text-[16px] font-semibold text-zinc-50">{g.p} <span className="font-mono text-[12px] text-zinc-500">{g.l.length}</span></h2>
          <div className="grid gap-3">
            {g.l.map(({ ticker, nom, descriptif, these, att_mois }) => {
              const add = these.element_additionnel;
              const long = (add?.texte?.length ?? 0) > 420;
              return (
                <article key={ticker} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <a href={`/${ticker.toLowerCase()}#sec-these`} className="font-mono text-[13px] font-semibold text-violet-200 hover:underline">{ticker}</a>
                      <span className="text-[15px] font-semibold text-zinc-50">{nom}</span>
                      <span className={`font-mono text-[10.5px] uppercase tracking-wider ${CONVICTION[these.conviction] ?? "text-zinc-400"}`}>conviction {these.conviction}</span>
                    </div>
                    <span className="font-mono text-[11px] text-zinc-500">
                      thèse {moisAn(these.redigee_le)}{att_mois ? ` · anti-thèse ${moisAn(att_mois)}` : ""}
                    </span>
                  </div>
                  {descriptif && <p className="mt-1 text-[12.5px] text-zinc-400">{descriptif}</p>}
                  <p className="mt-2 text-[12.5px] text-zinc-300"><span className="text-zinc-500">Style : </span>{these.style.type === "banque" ? "méthode de " : these.style.type === "investisseur" ? "critères de " : "méthode "}{these.style.nom}{these.style.justification ? ` · ${these.style.justification}` : ""}</p>
                  <p className="mt-1 text-[13px] text-zinc-200">{these.hook}</p>
                  {add?.texte && (
                    <details className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.04] p-3" open={!long}>
                      <summary className="cursor-pointer text-[12.5px] font-semibold text-amber-200">Élément additionnel (retirable) : {add.titre}</summary>
                      <p className="mt-2 text-[12.5px] leading-relaxed text-zinc-300">{long ? add.texte.slice(0, 420) + "…" : add.texte}</p>
                      {long && <p className="mt-1 text-[11px] text-zinc-500">Texte complet sur la fiche.</p>}
                      {add.source && <p className="mt-1 font-mono text-[10.5px] text-zinc-500">Source : {add.source}</p>}
                    </details>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
      {lignes.length === 0 && <p className="mt-8 text-[13px] text-zinc-500">Aucune thèse rédigée pour le moment.</p>}
    </main>
  );
}
