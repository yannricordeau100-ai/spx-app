import { getStripe } from "@/lib/billing/stripe";
import { FacturesTable, type Facture } from "@/components/factures-table";

export const dynamic = "force-dynamic";

/** Apercu interne du tableau des factures (Yann 13 sept 2026) : verifie le rendu sur un vrai client Stripe. */
export default async function Page({ searchParams }: { searchParams: Promise<{ audit_token?: string; email?: string }> }) {
  const sp = await searchParams;
  if (!sp.audit_token || sp.audit_token !== process.env.VISUAL_AUDIT_TOKEN) return <main className="p-8 text-zinc-300">Jeton requis.</main>;
  const email = sp.email ?? "";
  let factures: Facture[] = [];
  let erreur: string | null = null;
  try {
    const stripe = getStripe();
    const clients = await stripe.customers.list({ email, limit: 1 });
    const c = clients.data[0];
    if (!c) erreur = `Aucun client Stripe pour ${email}`;
    else {
      const jour = (s: number) => new Date(s * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
      const liste = await stripe.invoices.list({ customer: c.id, limit: 12 });
      factures = liste.data.filter((f) => f.status === "paid" || f.status === "open").map((f) => {
        const l = f.lines?.data?.[0]?.period;
        return {
          numero: f.number ?? f.id ?? "",
          date: jour(f.created),
          periode: l?.start && l?.end ? `${jour(l.start)} au ${jour(l.end)}` : null,
          montant: `${((f.status === "paid" ? f.amount_paid : f.amount_due) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} ${f.currency.toUpperCase()}`,
          statut: (f.status === "paid" ? "Payée" : "À payer") as Facture["statut"],
          pdf: f.invoice_pdf ?? null,
          lien: f.hosted_invoice_url ?? null,
        };
      });
    }
  } catch (e) { erreur = String((e as Error).message ?? e); }
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 text-zinc-100">
      <h1 className="font-display text-[22px] font-bold">Aperçu des factures</h1>
      <p className="mt-1 text-[13px] text-zinc-400">Rendu exact de la section Factures de la page compte, sur un vrai client Stripe. Paramètre email requis.</p>
      {erreur && <p className="mt-3 font-mono text-[12px] text-amber-300">{erreur}</p>}
      <section className="mt-5 rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a] p-6"><FacturesTable factures={factures} /></section>
    </main>
  );
}
