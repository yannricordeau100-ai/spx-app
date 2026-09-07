"use client";

/**
 * Atelier services Max (07 sept 2026) : le tableau propose du 7 sept avec
 * cases a cocher. Les choix du proprietaire partent dans la base via
 * /api/sandbox/services-max (page services / section max-choix).
 */

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";

type Idee = {
  id: string;
  titre: string;
  plusValue: string;
  faisabilite: string;
  delai: string;
  cout: string;
  risque: string;
  avis?: string;
};

const SOCLE = [
  { plan: "Gratuit", contenu: "666 fiches, KPI principal en clair, reste flouté", logique: "acquisition" },
  { plan: "Premium (~0,68 €/j)", contenu: "défloutage total, 20 ans d'historique, exports PNG des graphs et stories, favoris, comparateur 2 stés", logique: "équivalent des offres à 10-15 €/mois du marché" },
  { plan: "Max", contenu: "tout Premium + anti-thèse + les services cochés ci-dessous", logique: "justifie un prix 2 à 3 fois Premium" },
];

const IDEES: Idee[] = [
  { id: "1", titre: "Alerte publication + résumé KPI par mail (à chaque earnings d'une sté suivie : les 3 KPI qui ont bougé)", plusValue: "forte, personne ne veut rater un trimestre ; standard chez les concurrents mais rarement au niveau KPI", faisabilite: "élevée : daily-doc-watcher + earnings-dates déjà en cron, Resend prêt", delai: "2-3 jours", cout: "quasi nul (mails)", risque: "faible", avis: "recommandé" },
  { id: "2", titre: "Alerte seuil sur KPI (« préviens-moi si la marge passe sous 20 % »)", plusValue: "forte et différenciante : les concurrents alertent sur le prix, pas sur les KPI métier", faisabilite: "élevée : les séries sont en base, un cron compare", delai: "3-4 jours", cout: "nul", risque: "faible", avis: "recommandé" },
  { id: "3", titre: "Rapport PDF par sté (fiche complète mise en page : KPI, position marché, risques, anti-thèse)", plusValue: "moyenne à forte : demandé par ceux qui archivent ou partagent", faisabilite: "moyenne : l'export PNG existe, le PDF multi-blocs est à construire", delai: "1 semaine", cout: "nul", risque: "rendu à soigner", avis: "2e vague" },
  { id: "4", titre: "KPI à la demande (le client Max demande 1 KPI introuvable par mois, le pipeline Cahier le recherche dans les filings et le pose sur sa fiche)", plusValue: "très forte, unique sur le marché : c'est exactement la chaîne données actuelle vendue en service", faisabilite: "élevée côté pipeline (prouvé sur 666 stés), il faut juste un formulaire + file d'attente", delai: "3-4 jours", cout: "temps de traitement", risque: "promesse de délai à tenir", avis: "recommandé" },
  { id: "5", titre: "Comparateur sectoriel illimité (jusqu'à 5 stés côte à côte, percentiles sous-industrie)", plusValue: "forte pour les investisseurs méthodiques", faisabilite: "moyenne : compare 2 stés et percentiles existent, à étendre", delai: "~1 semaine", cout: "nul", risque: "UI dense" },
  { id: "6", titre: "Digest hebdo personnalisé (le lundi : ce qui a changé sur les stés suivies, publications à venir)", plusValue: "moyenne, fidélisation surtout ; réduit le churn", faisabilite: "élevée : données déjà là, un cron + un gabarit mail", delai: "2-3 jours", cout: "quasi nul", risque: "faible", avis: "2e vague" },
  { id: "7", titre: "Export CSV/API des séries KPI", plusValue: "forte pour les power users (tableurs, backtests) ; TIKR le vend cher", faisabilite: "élevée : les JSON existent", delai: "2 jours", cout: "nul", risque: "facilite le pillage des données, quota strict indispensable", avis: "seulement avec quota" },
];

export function ServicesMaxAtelier({ auditToken }: { auditToken?: string }) {
  const [choix, setChoix] = useState<Record<string, boolean>>({});
  const [charge, setCharge] = useState(false);
  const qs = auditToken ? `?audit_token=${encodeURIComponent(auditToken)}` : "";

  useEffect(() => {
    fetch(`/api/sandbox/services-max${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.choix) setChoix(d.choix);
        setCharge(true);
      })
      .catch(() => setCharge(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const basculer = (id: string, retenu: boolean) => {
    const prochain = choix[id] === retenu ? null : retenu;
    setChoix((c) => {
      const n = { ...c };
      if (prochain === null) delete n[id];
      else n[id] = prochain;
      return n;
    });
    fetch(`/api/sandbox/services-max${qs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, retenu: prochain }),
    }).catch(() => {});
  };

  const retenus = IDEES.filter((i) => choix[i.id] === true).map((i) => i.id);

  return (
    <div>
      <h2 className="font-display text-[18px] font-semibold">Socle recommandé</h2>
      <div className="mt-2 overflow-x-auto rounded-xl border border-white/[0.08]">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead className="bg-white/[0.03] font-mono text-[11px] uppercase tracking-wider text-zinc-400">
            <tr>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Contenu</th>
              <th className="px-3 py-2">Logique marché</th>
            </tr>
          </thead>
          <tbody>
            {SOCLE.map((s) => (
              <tr key={s.plan} className="border-t border-white/[0.05]">
                <td className="px-3 py-2 font-semibold text-violet-200">{s.plan}</td>
                <td className="px-3 py-2 text-zinc-200">{s.contenu}</td>
                <td className="px-3 py-2 text-zinc-400">{s.logique}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-[18px] font-semibold">Services Max : coche ce que tu retiens</h2>
        {charge && (
          <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 font-mono text-[11px] text-emerald-100">
            retenus : {retenus.length > 0 ? retenus.join(", ") : "aucun pour l'instant"}
          </span>
        )}
      </div>
      <p className="mt-1 text-[12.5px] text-zinc-500">
        Mon avis : Max = anti-thèse + 1 + 2 + 4 (alertes KPI + KPI à la demande n'existent nulle part ailleurs et reposent à 90 % sur l'existant). 3 et 6 en deuxième vague, 7 seulement avec quota strict.
      </p>

      <div className="mt-3 grid gap-2.5">
        {IDEES.map((i) => {
          const etat = choix[i.id];
          return (
            <div
              key={i.id}
              className={`rounded-xl border p-3.5 transition-colors ${
                etat === true
                  ? "border-emerald-400/50 bg-emerald-500/[0.07]"
                  : etat === false
                    ? "border-rose-400/30 bg-rose-500/[0.04] opacity-70"
                    : "border-white/[0.08] bg-white/[0.02]"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 font-mono text-[15px] font-bold text-violet-300">{i.id}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-zinc-100">
                    {i.titre}
                    {i.avis && (
                      <span className={`ml-2 rounded-full border px-2 py-px font-mono text-[10px] ${i.avis === "recommandé" ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-amber-400/30 bg-amber-500/10 text-amber-200"}`}>
                        {i.avis}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 grid gap-x-6 gap-y-1 text-[12.5px] sm:grid-cols-2">
                    <div><span className="text-zinc-500">Plus-value :</span> <span className="text-zinc-300">{i.plusValue}</span></div>
                    <div><span className="text-zinc-500">Faisabilité :</span> <span className="text-zinc-300">{i.faisabilite}</span></div>
                    <div><span className="text-zinc-500">Délai :</span> <span className="text-zinc-300">{i.delai}</span> · <span className="text-zinc-500">Coût récurrent :</span> <span className="text-zinc-300">{i.cout}</span></div>
                    <div><span className="text-zinc-500">Risque :</span> <span className="text-zinc-300">{i.risque}</span></div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <button
                    onClick={() => basculer(i.id, true)}
                    disabled={!charge}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[12px] ${etat === true ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-100" : "border-white/10 text-zinc-400 hover:text-emerald-200"}`}
                  >
                    <Check className="size-3.5" /> Je retiens
                  </button>
                  <button
                    onClick={() => basculer(i.id, false)}
                    disabled={!charge}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[12px] ${etat === false ? "border-rose-400/50 bg-rose-500/15 text-rose-100" : "border-white/10 text-zinc-500 hover:text-rose-200"}`}
                  >
                    <X className="size-3.5" /> Non
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
