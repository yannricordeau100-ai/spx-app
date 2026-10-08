"use client";

/**
 * Rendu en onglets de docs/CONSIGNES-NOUVELLES-SOCIETES.md.
 * Markdown volontairement restreint (pas de dependance) :
 *   # Titre            -> onglet
 *   <!-- sous-onglets --> juste sous un # : ses ## deviennent des sous-onglets
 *   ## / ### / ####    -> titres
 *   - item / 1. item   -> listes (deux niveaux par indentation de 2 espaces)
 *   - [ ] item         -> case a cocher (visuelle, non enregistree)
 *   | a | b |          -> tableau
 *   > texte            -> encadre ; "> ATTENTION" ou "> TROU" colore en ambre / rouge
 *   ```                -> bloc de code
 *   `code` **gras** [lien](url) en ligne
 */
import { Fragment, useMemo, useState, type ReactNode } from "react";

type Section = { titre: string; corps: string[]; sous: { titre: string; corps: string[] }[] | null };

function decouper(source: string): { intro: string[]; onglets: Section[] } {
  const lignes = source.split(/\r?\n/);
  const intro: string[] = [];
  const onglets: Section[] = [];
  let enCode = false;
  for (const l of lignes) {
    if (l.trim().startsWith("```")) enCode = !enCode;
    if (!enCode && /^# /.test(l)) {
      onglets.push({ titre: l.slice(2).trim(), corps: [], sous: null });
      continue;
    }
    const cur = onglets[onglets.length - 1];
    if (!cur) { intro.push(l); continue; }
    if (!enCode && l.trim() === "<!-- sous-onglets -->") { cur.sous = []; continue; }
    if (cur.sous && !enCode && /^## /.test(l)) { cur.sous.push({ titre: l.slice(3).trim(), corps: [] }); continue; }
    if (cur.sous && cur.sous.length > 0) cur.sous[cur.sous.length - 1].corps.push(l);
    else cur.corps.push(l);
  }
  return { intro, onglets };
}

function enLigne(texte: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let dernier = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(texte))) {
    if (m.index > dernier) out.push(texte.slice(dernier, m.index));
    const t = m[0];
    if (t.startsWith("`")) out.push(<code key={k++} className="rounded bg-white/[0.07] px-1 py-px font-mono text-[0.86em] text-cyan-200 [overflow-wrap:anywhere]">{t.slice(1, -1)}</code>);
    else if (t.startsWith("**")) out.push(<strong key={k++} className="font-semibold text-zinc-50">{enLigne(t.slice(2, -2))}</strong>);
    else {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t)!;
      out.push(<a key={k++} href={mm[2]} className="text-violet-300 underline decoration-violet-300/40 hover:text-violet-200">{mm[1]}</a>);
    }
    dernier = m.index + t.length;
  }
  if (dernier < texte.length) out.push(texte.slice(dernier));
  return out;
}

type Item = { texte: string; case: boolean | null; enfants: Item[] };

function Liste({ items, ordonnee }: { items: Item[]; ordonnee: boolean }) {
  const Tag = ordonnee ? "ol" : "ul";
  return (
    <Tag className={`${ordonnee ? "list-decimal" : "list-disc"} mt-1.5 space-y-1 pl-5 marker:text-zinc-600`}>
      {items.map((it, i) => (
        <li key={i} className={it.case !== null ? "list-none -ml-5" : ""}>
          {it.case !== null && <input type="checkbox" defaultChecked={it.case} className="mr-2 translate-y-[1px] accent-violet-500" />}
          {enLigne(it.texte)}
          {it.enfants.length > 0 && <Liste items={it.enfants} ordonnee={false} />}
        </li>
      ))}
    </Tag>
  );
}

function Corps({ lignes }: { lignes: string[] }) {
  const blocs: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lignes.length) {
    const l = lignes[i];
    const t = l.trim();
    if (!t || t.startsWith("<!--")) { i++; continue; }
    if (t.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lignes.length && !lignes[i].trim().startsWith("```")) code.push(lignes[i++]);
      i++;
      blocs.push(<pre key={k++} className="mt-3 overflow-x-auto rounded-lg border border-white/10 bg-black/60 p-3 font-mono text-[12px] leading-relaxed text-zinc-300">{code.join("\n")}</pre>);
      continue;
    }
    const h = /^(#{2,4}) (.*)$/.exec(t);
    if (h) {
      const n = h[1].length;
      const cls = n === 2 ? "mt-8 border-b border-white/10 pb-1.5 text-[19px] font-semibold text-zinc-50" : n === 3 ? "mt-6 text-[15.5px] font-semibold text-violet-200" : "mt-4 text-[13.5px] font-semibold uppercase tracking-wide text-zinc-400";
      blocs.push(<div key={k++} className={cls}>{enLigne(h[2])}</div>);
      i++;
      continue;
    }
    if (t.startsWith("|")) {
      const rangs: string[][] = [];
      while (i < lignes.length && lignes[i].trim().startsWith("|")) {
        const cells = lignes[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rangs.push(cells);
        i++;
      }
      const [tete, ...reste] = rangs;
      blocs.push(
        <div key={k++} className="mt-3 overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-[12.5px]">
            <thead className="bg-white/[0.04] text-zinc-300"><tr>{tete.map((c, j) => <th key={j} className="px-2.5 py-1.5 font-semibold">{enLigne(c)}</th>)}</tr></thead>
            <tbody>{reste.map((r, ri) => <tr key={ri} className="border-t border-white/[0.06] align-top">{r.map((c, j) => <td key={j} className="px-2.5 py-1.5 text-zinc-300">{enLigne(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (t.startsWith(">")) {
      const txt: string[] = [];
      while (i < lignes.length && lignes[i].trim().startsWith(">")) txt.push(lignes[i++].trim().replace(/^>\s?/, ""));
      const joint = txt.join(" ");
      const ton = /^(TROU|INCOH)/.test(joint) ? "border-rose-500/50 bg-rose-500/10 text-rose-100" : /^(ATTENTION|PIEGE|PIÈGE)/.test(joint) ? "border-amber-500/50 bg-amber-500/10 text-amber-100" : "border-cyan-500/30 bg-cyan-500/[0.06] text-cyan-50";
      blocs.push(<div key={k++} className={`mt-3 rounded-lg border-l-2 px-3 py-2 text-[13px] ${ton}`}>{enLigne(joint)}</div>);
      continue;
    }
    const li = /^(\s*)(-|\d+\.) (.*)$/;
    if (li.test(l)) {
      const ordonnee = /^\s*\d+\./.test(l);
      const racine: Item[] = [];
      while (i < lignes.length && li.test(lignes[i])) {
        const m = li.exec(lignes[i])!;
        let texte = m[3];
        let coche: boolean | null = null;
        const c = /^\[( |x)\] (.*)$/.exec(texte);
        if (c) { coche = c[1] === "x"; texte = c[2]; }
        const item: Item = { texte, case: coche, enfants: [] };
        if (m[1].length >= 2 && racine.length > 0) racine[racine.length - 1].enfants.push(item);
        else racine.push(item);
        i++;
        // ligne de continuation indentee
        while (i < lignes.length && /^\s{2,}\S/.test(lignes[i]) && !li.test(lignes[i])) { item.texte += " " + lignes[i].trim(); i++; }
      }
      blocs.push(<Liste key={k++} items={racine} ordonnee={ordonnee} />);
      continue;
    }
    const para: string[] = [];
    while (i < lignes.length && lignes[i].trim() && !/^(#{2,4} |\||>|```|\s*(-|\d+\.) )/.test(lignes[i].trim())) para.push(lignes[i++].trim());
    if (para.length === 0) { i++; continue; }
    blocs.push(<p key={k++} className="mt-2.5 text-[13.5px] leading-relaxed text-zinc-300">{enLigne(para.join(" "))}</p>);
  }
  return <Fragment>{blocs}</Fragment>;
}

function slug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function ConsignesOnglets({ source, ongletInitial }: { source: string; ongletInitial: string | null }) {
  const { intro, onglets } = useMemo(() => decouper(source), [source]);
  const initial = Math.max(0, onglets.findIndex((o) => slug(o.titre).startsWith(ongletInitial ?? "\u0000")));
  const [actif, setActif] = useState(initial);
  const [sousActif, setSousActif] = useState(0);
  const [filtre, setFiltre] = useState("");
  const onglet = onglets[actif];

  const resultats = useMemo(() => {
    const q = filtre.trim().toLowerCase();
    if (q.length < 3) return null;
    const res: { onglet: number; sous: number; titre: string; ligne: string }[] = [];
    onglets.forEach((o, oi) => {
      const parcourir = (corps: string[], si: number, titre: string) => {
        for (const l of corps) if (l.toLowerCase().includes(q)) res.push({ onglet: oi, sous: si, titre, ligne: l.trim().replace(/^[-|>#\s]+/, "").replace(/^\d+\.\s+/, "").replace(/^\[[ x]\]\s*/, "") });
      };
      parcourir(o.corps, -1, o.titre);
      o.sous?.forEach((s, si) => parcourir(s.corps, si, `${o.titre} › ${s.titre}`));
    });
    return res.slice(0, 80);
  }, [filtre, onglets]);

  return (
    <div className="mt-5">
      {intro.some((l) => l.trim()) && <div className="max-w-4xl"><Corps lignes={intro} /></div>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={filtre}
          onChange={(e) => setFiltre(e.target.value)}
          placeholder="Chercher dans toutes les consignes (3 lettres min.)"
          className="w-full max-w-md rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[13px] text-zinc-100 placeholder:text-zinc-500 focus:border-violet-400/60 focus:outline-none"
        />
      </div>
      {resultats && (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <div className="text-[12px] text-zinc-500">{resultats.length} ligne(s) trouvée(s){resultats.length === 80 ? " (80 premières)" : ""}</div>
          <ul className="mt-2 space-y-1">
            {resultats.map((r, i) => (
              <li key={i}>
                <button type="button" onClick={() => { setActif(r.onglet); setSousActif(Math.max(0, r.sous)); setFiltre(""); }} className="text-left text-[12.5px] text-zinc-300 hover:text-zinc-50">
                  <span className="font-mono text-[11px] text-violet-300">{r.titre}</span> · {enLigne(r.ligne.length > 220 ? r.ligne.slice(0, 220).replace(/`[^`]*$/, "") + "…" : r.ligne)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="sticky top-0 z-10 -mx-4 mt-4 border-b border-white/10 bg-[#050505]/95 px-4 pb-2 pt-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap gap-1.5 pb-1">
          {onglets.map((o, oi) => (
            <button
              key={oi}
              type="button"
              onClick={() => { setActif(oi); setSousActif(0); }}
              className={`shrink-0 rounded-full border px-3 py-1 text-[12.5px] transition-colors ${oi === actif ? "border-violet-400/60 bg-violet-500/15 text-violet-100" : "border-white/10 text-zinc-400 hover:text-zinc-100"}`}
            >
              {o.titre}
            </button>
          ))}
        </div>
      </div>
      {onglet && (
        <div className="mt-2">
          <div className="max-w-5xl"><Corps lignes={onglet.corps} /></div>
          {onglet.sous && onglet.sous.length > 0 && (
            <div className="mt-5 grid gap-5 lg:grid-cols-[230px_1fr]">
              <div className="flex gap-1 overflow-x-auto lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:flex-col lg:overflow-y-auto lg:self-start">
                {onglet.sous.map((s, si) => (
                  <button
                    key={si}
                    type="button"
                    onClick={() => setSousActif(si)}
                    className={`shrink-0 rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${si === sousActif ? "bg-white/[0.08] text-zinc-50" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"}`}
                  >
                    {s.titre}
                  </button>
                ))}
              </div>
              <div className="min-w-0 max-w-4xl">
                <h2 className="text-[20px] font-semibold text-zinc-50">{onglet.sous[sousActif]?.titre}</h2>
                <Corps lignes={onglet.sous[sousActif]?.corps ?? []} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
