import { Download, FileText } from "lucide-react";

/** Yann 13 sept 2026 : tableau des factures (page compte + apercu interne). */
export type Facture = {
  numero: string;
  date: string;
  periode: string | null;
  montant: string;
  statut: "Payée" | "À payer" | "Annulée";
  pdf: string | null;
  lien: string | null;
};

export function FacturesTable({ factures }: { factures: Facture[] }) {
  if (factures.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-[13px] text-zinc-500">
        Aucune facture pour le moment. La première est émise au premier paiement.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-white/[0.08] text-left font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
            <th className="py-2 pr-3 font-medium">Date</th>
            <th className="py-2 pr-3 font-medium">Numéro</th>
            <th className="py-2 pr-3 font-medium">Période</th>
            <th className="py-2 pr-3 text-right font-medium">Montant</th>
            <th className="py-2 pr-3 font-medium">Statut</th>
            <th className="py-2 text-right font-medium">Document</th>
          </tr>
        </thead>
        <tbody>
          {factures.map((f) => (
            <tr key={f.numero} className="border-b border-white/[0.04] last:border-0">
              <td className="py-2.5 pr-3 whitespace-nowrap text-zinc-300">{f.date}</td>
              <td className="py-2.5 pr-3 font-mono text-[12px] text-zinc-400">{f.numero}</td>
              <td className="py-2.5 pr-3 whitespace-nowrap text-zinc-400">{f.periode ?? "—"}</td>
              <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-zinc-100">{f.montant}</td>
              <td className="py-2.5 pr-3">
                <span className={`rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ${f.statut === "Payée" ? "border-emerald-400/40 text-emerald-300" : f.statut === "À payer" ? "border-amber-400/40 text-amber-200" : "border-zinc-600 text-zinc-400"}`}>
                  {f.statut}
                </span>
              </td>
              <td className="py-2.5 text-right">
                {f.pdf ? (
                  <a href={f.pdf} className="inline-flex items-center gap-1.5 rounded-md border border-violet-400/40 px-2 py-1 text-[11.5px] font-semibold text-violet-200 transition-colors hover:bg-violet-500/10">
                    <Download className="size-3.5" /> PDF
                  </a>
                ) : f.lien ? (
                  <a href={f.lien} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[11.5px] text-violet-300 hover:underline">
                    <FileText className="size-3.5" /> Voir
                  </a>
                ) : (
                  <span className="text-[11.5px] text-zinc-600">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
