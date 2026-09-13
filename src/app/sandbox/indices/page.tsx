import Link from "next/link";
import COMP from "@/data/indices-composition.json";
import NOMS from "@/data/v1-7-public.json";

export const dynamic = "force-static";

/** Yann 13 sept 2026 : les societes du site par indice, avec celles presentes dans deux indices. */
type Indice = { nom: string; pays: string; total: number; membres: { ticker: string; nom: string }[]; en_ligne: string[]; absents: { ticker: string; nom: string }[] };
export default function Page() {
  const c = COMP as { maj: string; indices: Record<string, Indice>; multi: Record<string, string[]>; sans_indice: string[] };
  const noms = NOMS as Record<string, { name?: string }>;
  const nom = (t: string) => noms[t]?.name ?? t;
  const multi = c.multi;
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-zinc-100">
      <h1 className="font-display text-[26px] font-bold">Sociétés du site par indice</h1>
      <p className="mt-1 text-[13px] text-zinc-400">Compositions relues sur Wikipedia le {c.maj}. En vert : en ligne sur Mettrik. En gris : membre de l indice absent du site. Une pastille « ×2 » signale une société présente dans deux indices.</p>
      <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
        {Object.entries(c.indices).map(([k, i]) => <a key={k} href={`#${k}`} className="rounded-md border border-white/15 px-2.5 py-1 hover:bg-white/5">{i.nom} <span className="font-mono text-zinc-500">{i.en_ligne.length}/{i.total}</span></a>)}
        <a href="#multi" className="rounded-md border border-amber-400/40 px-2.5 py-1 text-amber-200">Dans deux indices <span className="font-mono">{Object.keys(multi).length}</span></a>
      </div>
      {Object.entries(c.indices).map(([k, i]) => (
        <section key={k} id={k} className="mt-8 scroll-mt-6">
          <h2 className="text-[17px] font-semibold">{i.nom} <span className="ml-2 font-mono text-[12px] text-zinc-500">{i.pays} · {i.en_ligne.length} en ligne sur {i.total}</span></h2>
          <ul className="mt-2 grid gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-2 lg:grid-cols-3">
            {i.membres.map((m) => {
              const t = i.en_ligne.find((x) => x.toUpperCase().replace(/\./g, "-") === m.ticker.toUpperCase().replace(/\./g, "-")) ?? null;
              return (
                <li key={m.ticker} className={t ? "text-emerald-200" : "text-zinc-600"}>
                  {t ? <Link href={`/${t.toLowerCase()}`} className="font-mono hover:underline">{t}</Link> : <span className="font-mono">{m.ticker}</span>} {t ? nom(t) : m.nom}
                  {t && multi[t] && <span className="ml-1 rounded-full border border-amber-400/40 px-1.5 font-mono text-[10px] text-amber-200" title={multi[t].join(" + ")}>×{multi[t].length}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <section id="multi" className="mt-8 scroll-mt-6">
        <h2 className="text-[17px] font-semibold">Présentes dans deux indices ({Object.keys(multi).length})</h2>
        <ul className="mt-2 grid gap-1 text-[12.5px] sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(multi).map(([t, l]) => <li key={t}><Link href={`/${t.toLowerCase()}`} className="font-mono text-amber-200 hover:underline">{t}</Link> {nom(t)} <span className="text-zinc-500">· {l.join(" + ")}</span></li>)}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="text-[15px] font-semibold text-zinc-300">En ligne mais hors de ces indices ({c.sans_indice.length})</h2>
        <p className="mt-1 font-mono text-[11.5px] text-zinc-500">{c.sans_indice.join(" · ")}</p>
      </section>
    </main>
  );
}
