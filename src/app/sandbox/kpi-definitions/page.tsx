import METIERS from "@/data/unites-metiers.json";
import UNIVERS from "@/data/unites-univers.json";

export const dynamic = "force-static";

/** KPI et définitions (Yann 12 sept 2026) : vocabulaire officiel + unités par secteur. */
type U = { categorie: string; unite: string; nom?: string; signification?: string };

const DEFS = [
  ["KPI total", "Somme de tous les KPI IC (standard et avancés) et des KPI stories."],
  ["KPI IC total", "Somme de tous les KPI IC (standard et avancés)."],
  ["Types de KPI", "Nombre de types de KPI IC différents (standard et avancés), compté sur tout l univers ET par société. Un type est une mesure qu un concurrent peut publier, même en théorie : elle est comparable. Sinon c est un KPI unique."],
];
const OUI = ["Nombre d employés", "BPA dilué", "Nombre de systèmes d exploitation mobile sur le marché", "Coût d acquisition de trafic", "Part de marché des navigateurs web"];
const NON = ["Nombre de systèmes Android sur le marché", "Villes desservies par Waymo (tel quel ; généralisé : villes couvertes par un service de robotaxi)", "Part de marché de Chrome (tel quel ; généralisé : part de marché des navigateurs web)"];

function Groupes({ liste }: { liste: U[] }) {
  const g = new Map<string, U[]>();
  for (const u of liste) g.set(u.categorie, [...(g.get(u.categorie) ?? []), u]);
  return (
    <div className="grid gap-4">
      {[...g.entries()].map(([cat, us]) => (
        <details key={cat} className="rounded-lg border border-white/10 p-3">
          <summary className="cursor-pointer text-[13px] font-semibold text-zinc-100">{cat} <span className="font-mono text-[11px] text-zinc-500">({us.length})</span></summary>
          <table className="mt-2 w-full text-[12px]"><tbody>
            {us.map((u) => (
              <tr key={cat + u.unite} className="border-t border-white/5 align-top">
                <td className="py-1 pr-3 font-mono text-cyan-200">{u.unite}</td>
                <td className="py-1 pr-3 text-zinc-200">{u.nom ?? ""}</td>
                <td className="py-1 text-zinc-400">{u.signification ?? ""}</td>
              </tr>
            ))}
          </tbody></table>
        </details>
      ))}
    </div>
  );
}

export default function Page() {
  const metiers = (METIERS as { unites: U[] }).unites;
  const univers = (UNIVERS as { unites: U[] }).unites;
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-zinc-100">
      <h1 className="font-display text-[26px] font-bold">KPI et définitions</h1>
      <p className="mt-1 text-[13px] text-zinc-400">Vocabulaire officiel de Mettrik, fixé et validé le 12 septembre 2026. Tout changement de nom attend la validation du propriétaire.</p>
      <table className="mt-5 w-full text-[13.5px]"><tbody>
        {DEFS.map(([t, d]) => <tr key={t} className="border-t border-white/10 align-top"><td className="w-40 py-2 pr-4 font-semibold text-violet-200">{t}</td><td className="py-2 text-zinc-200">{d}</td></tr>)}
      </tbody></table>
      <h2 className="mt-7 text-[17px] font-semibold">La règle : peut-on l appliquer à un concurrent ?</h2>
      <p className="mt-1 text-[13px] text-zinc-300">Oui : c est une métrique comparable, donc un type de KPI. Non : c est un KPI unique. Un KPI unique dont l actif sous-jacent est comparable devient un type en le généralisant : « part de marché de Chrome » devient « part de marché des navigateurs web ». Toute « part de marché de [quelque chose] » est éligible. Tous les KPI ne sont pas transformables.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-emerald-400/30 p-3"><div className="text-[12px] font-semibold text-emerald-300">Types de KPI (exemples Google)</div><ul className="mt-1 list-disc pl-5 text-[12.5px] text-zinc-200">{OUI.map((x) => <li key={x}>{x}</li>)}</ul></div>
        <div className="rounded-lg border border-rose-400/30 p-3"><div className="text-[12px] font-semibold text-rose-300">Pas des types de KPI</div><ul className="mt-1 list-disc pl-5 text-[12.5px] text-zinc-200">{NON.map((x) => <li key={x}>{x}</li>)}</ul></div>
      </div>
      <h2 className="mt-7 text-[17px] font-semibold">Où vit le type comparable</h2>
      <p className="mt-1 text-[13px] text-zinc-300">Aucune colonne en plus dans le tableau. Chaque KPI reçoit un champ de données invisible « type de KPI ». Il est affiché dans le « i », par exemple « Comparable : part de marché des navigateurs web », et le Comparer l utilise pour rapprocher les sociétés.</p>
      <h2 className="mt-7 text-[17px] font-semibold">Unités par secteur</h2>
      <p className="mt-1 text-[12.5px] text-zinc-400">Indicateurs métiers ({metiers.length}) puis relevé complet des unités de l univers ({univers.length}).</p>
      <div className="mt-3"><Groupes liste={metiers} /></div>
      <div className="mt-3"><Groupes liste={univers} /></div>
    </main>
  );
}
