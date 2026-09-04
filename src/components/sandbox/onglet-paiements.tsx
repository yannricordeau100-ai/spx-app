"use client";

/**
 * Onglet Paiements de la page Statistiques (Yann 4 sept 2026).
 *
 * Demande : voir l essentiel en deux secondes, et pouvoir descendre dans le
 * detail si on le veut. D ou deux etages : une rangee de chiffres cles, puis
 * des sections repliees qu on ouvre une par une.
 *
 * Contient notamment les MOTIFS DE DESABONNEMENT, que le portail Stripe
 * collecte depuis toujours mais que rien ne remontait cote Mettrik.
 */

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

type Paiements = {
  genere_le: string;
  resume: {
    encaisse_total: number;
    encaisse_mois: number;
    abonnes_actifs: number;
    resiliations: number;
    taux_resiliation: number;
    panier_moyen: number;
    factures_impayees: number;
    remboursements: number;
    montant_rembourse: number;
  };
  motifs_resiliation: Array<{ motif: string; nombre: number }>;
  commentaires_resiliation: Array<{ date: string; motif: string; commentaire: string }>;
  par_offre: Array<{ offre: string; nombre: number }>;
  paiements: Array<{
    date: string; numero: string | null; montant: number; devise: string;
    client: string | null; remise: string | null; lien: string | null;
  }>;
  remboursements_detail: Array<{ date: string; montant: number; devise: string; motif: string }>;
  codes_promo: Array<{ code: string; actif: boolean; utilisations: number; maximum: number | null; remise: number | null }>;
};

const eur = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const jour = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });

function Chiffre({ label, valeur, detail, alerte }: { label: string; valeur: string; detail?: string; alerte?: boolean }) {
  return (
    <div className={`rounded-xl border p-3.5 ${alerte ? "border-amber-500/40 bg-amber-500/[0.07]" : "border-white/10 bg-white/[0.02]"}`}>
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-1 font-mono text-[19px] font-semibold ${alerte ? "text-amber-200" : "text-zinc-100"}`}>{valeur}</div>
      {detail && <div className="mt-0.5 text-[11px] text-zinc-500">{detail}</div>}
    </div>
  );
}

function Section({ titre, compte, children }: { titre: string; compte: number; children: React.ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
      <button
        onClick={() => setOuvert((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span className="text-[13px] font-semibold text-zinc-200">
          {titre} <span className="ml-1.5 font-mono text-[11.5px] text-zinc-500">{compte}</span>
        </span>
        <ChevronDown className={`size-4 text-zinc-500 transition-transform ${ouvert ? "rotate-180" : ""}`} />
      </button>
      {ouvert && <div className="border-t border-white/[0.07] px-4 py-3">{children}</div>}
    </div>
  );
}

export function OngletPaiements({ jeton }: { jeton?: string | null }) {
  const [d, setD] = useState<Paiements | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const q = jeton ? `?audit_token=${encodeURIComponent(jeton)}` : "";
    fetch(`/api/sandbox/paiements${q}`)
      .then((r) => r.json())
      .then((j) => (j?.error ? setErreur(String(j.error)) : setD(j as Paiements)))
      .catch((e) => setErreur(String(e)));
  }, [jeton]);

  if (erreur) return <p className="mt-6 text-sm text-red-300">Lecture impossible : {erreur}</p>;
  if (!d) return <p className="mt-6 text-sm text-zinc-500">Chargement des données de paiement…</p>;

  const r = d.resume;
  return (
    <div className="mt-6">
      {/* Etage 1 : l essentiel, lisible en deux secondes. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Chiffre label="Encaissé ce mois" valeur={eur(r.encaisse_mois)} detail={`${eur(r.encaisse_total)} depuis le début`} />
        <Chiffre label="Abonnés actifs" valeur={String(r.abonnes_actifs)} detail={`${r.resiliations} résiliation${r.resiliations > 1 ? "s" : ""}`} />
        <Chiffre label="Taux de résiliation" valeur={`${r.taux_resiliation} %`} alerte={r.taux_resiliation > 20} />
        <Chiffre label="Panier moyen" valeur={eur(r.panier_moyen)} />
        <Chiffre label="Factures impayées" valeur={String(r.factures_impayees)} alerte={r.factures_impayees > 0} />
        <Chiffre label="Remboursements" valeur={String(r.remboursements)} detail={r.remboursements ? eur(r.montant_rembourse) : undefined} />
        <Chiffre label="Offres actives" valeur={String(d.par_offre.length)} detail={d.par_offre.map((o) => `${o.offre} : ${o.nombre}`).join(" · ") || undefined} />
        <Chiffre label="Codes promo" valeur={String(d.codes_promo.filter((c) => c.actif).length)} detail={`${d.codes_promo.length} au total`} />
      </div>

      {/* Motifs de desabonnement : la question posee, mise en avant. */}
      <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Pourquoi les clients partent
        </div>
        {d.motifs_resiliation.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-zinc-500">
            Aucune résiliation avec motif pour l&apos;instant. Le portail pose la question à chaque annulation.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {d.motifs_resiliation.map((m) => {
              const total = d.motifs_resiliation.reduce((s, x) => s + x.nombre, 0);
              const pct = Math.round((m.nombre / total) * 100);
              return (
                <div key={m.motif} className="flex items-center gap-3">
                  <span className="w-52 shrink-0 text-[12.5px] text-zinc-300">{m.motif}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <span className="block h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-16 shrink-0 text-right font-mono text-[12px] text-zinc-400">
                    {m.nombre} · {pct} %
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Etage 2 : le detail, replie. */}
      <Section titre="Paiements encaissés" compte={d.paiements.length}>
        <table className="w-full text-[12px]">
          <thead className="text-[10.5px] uppercase tracking-wider text-zinc-500">
            <tr><th className="pb-2 text-left">Date</th><th className="pb-2 text-left">Facture</th><th className="pb-2 text-left">Client</th><th className="pb-2 text-left">Remise</th><th className="pb-2 text-right">Montant</th></tr>
          </thead>
          <tbody className="text-zinc-300">
            {d.paiements.map((p, i) => (
              <tr key={i} className="border-t border-white/[0.05]">
                <td className="py-1.5">{jour(p.date)}</td>
                <td className="py-1.5 font-mono text-[11px] text-zinc-500">
                  {p.lien ? <a href={p.lien} target="_blank" rel="noreferrer" className="hover:text-violet-300">{p.numero ?? "voir"}</a> : (p.numero ?? "—")}
                </td>
                <td className="py-1.5 text-zinc-400">{p.client ?? "—"}</td>
                <td className="py-1.5 text-violet-300">{p.remise ?? "—"}</td>
                <td className="py-1.5 text-right font-mono">{eur(p.montant)} {p.devise}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section titre="Commentaires laissés en partant" compte={d.commentaires_resiliation.length}>
        {d.commentaires_resiliation.length === 0 ? (
          <p className="text-[12.5px] text-zinc-500">Aucun commentaire libre pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-2.5">
            {d.commentaires_resiliation.map((c, i) => (
              <li key={i} className="text-[12.5px]">
                <span className="font-mono text-[11px] text-zinc-500">{jour(c.date)}</span>
                <span className="ml-2 rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-zinc-300">{c.motif}</span>
                <p className="mt-1 leading-relaxed text-zinc-400">{c.commentaire}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section titre="Remboursements" compte={d.remboursements_detail.length}>
        {d.remboursements_detail.length === 0 ? (
          <p className="text-[12.5px] text-zinc-500">Aucun remboursement.</p>
        ) : (
          <ul className="space-y-1.5 text-[12.5px] text-zinc-300">
            {d.remboursements_detail.map((x, i) => (
              <li key={i} className="flex justify-between border-t border-white/[0.05] py-1.5 first:border-0">
                <span>{jour(x.date)} · {x.motif}</span>
                <span className="font-mono">{eur(x.montant)} {x.devise}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section titre="Codes promo" compte={d.codes_promo.length}>
        <ul className="space-y-1.5 text-[12.5px]">
          {d.codes_promo.map((c) => (
            <li key={c.code} className="flex items-center justify-between border-t border-white/[0.05] py-1.5 first:border-0">
              <span className="font-mono text-zinc-200">{c.code}</span>
              <span className="text-zinc-400">
                {c.remise ? `${c.remise} %` : "—"} · {c.utilisations}
                {c.maximum ? ` / ${c.maximum}` : ""} utilisation{c.utilisations > 1 ? "s" : ""}
              </span>
              <span className={c.actif ? "text-emerald-300" : "text-zinc-600"}>{c.actif ? "actif" : "inactif"}</span>
            </li>
          ))}
        </ul>
      </Section>

      <p className="mt-4 text-[11px] text-zinc-600">
        Données lues chez Stripe le {new Date(d.genere_le).toLocaleString("fr-FR")}.
      </p>
    </div>
  );
}
