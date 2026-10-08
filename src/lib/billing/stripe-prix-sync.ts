/**
 * Synchronisation des prix du back-office vers Stripe (8 oct 2026).
 *
 * Regle (Yann) : le back-office fait foi. Pour chaque plan, periode et devise
 * dont le montant en base (`pricing_prices.amount_decimal`) differe du prix
 * Stripe actif :
 *   1. creation d un nouveau Price Stripe (un prix Stripe est immuable) sur le
 *      MEME produit, meme periodicite et devise, avec une cle stable
 *      (lookup_key `mettrik_<plan>_<periode>_<devise>`, transfer_lookup_key) ;
 *   2. desactivation de l ancien Price (jamais supprime). Les abonnes existants
 *      gardent leur prix : Stripe continue de facturer un prix desactive sur les
 *      abonnements en cours, aucun abonnement n est migre ;
 *   3. mise a jour de `pricing_prices.stripe_price_id` (lu par le paiement) ;
 *   4. journal : une ligne `billing_events` (type `mettrik.price_sync`) par
 *      creation, plus les metadonnees du nouveau prix (ancien id, date, source).
 *
 * Appelee a chaque enregistrement d un prix (POST /api/billing/admin/prices) et
 * par le bouton « Synchroniser Stripe » (POST /api/billing/admin/stripe-sync).
 * Un produit Stripe n est cree que si aucun prix du meme plan et de la meme
 * periode n existe deja (nouveau plan) : jamais de doublon de produit.
 */
import type Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "./stripe";

export type LigneSync = {
  plan: string;
  devise: string;
  periode: "monthly" | "annual";
  base: number;
  stripe_avant: number | null;
  action: "conforme" | "cree" | "archive" | "erreur" | "simulation";
  ancien_id: string | null;
  nouveau_id: string | null;
  detail?: string;
};

type LignePrix = {
  id: string;
  plan_id: string;
  currency: string;
  frequency: "monthly" | "annual";
  amount_decimal: number;
  stripe_price_id: string | null;
  is_active: boolean;
};
type LignePlan = { id: string; code: string; name_fr: string | null; is_active: boolean; is_api_only: boolean };

export function cleStripe(planCode: string, frequence: string, devise: string): string {
  return `mettrik_${planCode.toLowerCase()}_${frequence}_${devise.toLowerCase()}`;
}

const intervalle = (f: string): "month" | "year" => (f === "monthly" ? "month" : "year");
const centimes = (n: number) => Math.round(Number(n) * 100);
const idProduit = (p: Stripe.Price) => (typeof p.product === "string" ? p.product : p.product.id);

async function lirePrix(stripe: Stripe, id: string | null): Promise<Stripe.Price | null> {
  if (!id) return null;
  try {
    return await stripe.prices.retrieve(id);
  } catch {
    return null;
  }
}

/** Prix actif porteur de la cle stable (null si aucun). */
export async function prixParCle(stripe: Stripe, cle: string): Promise<Stripe.Price | null> {
  const r = await stripe.prices.list({ lookup_keys: [cle], active: true, limit: 1 });
  return r.data[0] ?? null;
}

function conforme(p: Stripe.Price | null, ligne: LignePrix): boolean {
  return !!p && p.active && p.unit_amount === centimes(ligne.amount_decimal)
    && p.currency === ligne.currency.toLowerCase()
    && p.recurring?.interval === intervalle(ligne.frequency);
}

export async function synchroniseStripe(
  stripe: Stripe,
  supa: SupabaseClient,
  opts: { planId?: string; simulation?: boolean; source?: string } = {},
): Promise<LigneSync[]> {
  const { data: plans, error: e1 } = await supa.from("pricing_plans").select("id,code,name_fr,is_active,is_api_only");
  if (e1) throw e1;
  const { data: prix, error: e2 } = await supa.from("pricing_prices")
    .select("id,plan_id,currency,frequency,amount_decimal,stripe_price_id,is_active");
  if (e2) throw e2;
  const journal: LigneSync[] = [];
  const source = opts.source ?? "back-office";

  for (const plan of (plans ?? []) as LignePlan[]) {
    if (opts.planId && plan.id !== opts.planId) continue;
    if (plan.is_api_only) continue;
    const lignes = ((prix ?? []) as LignePrix[]).filter((p) => p.plan_id === plan.id && Number(p.amount_decimal) > 0);

    for (const ligne of lignes) {
      const cle = cleStripe(plan.code, ligne.frequency, ligne.currency);
      const base = Number(ligne.amount_decimal);
      const entree: LigneSync = {
        plan: plan.code, devise: ligne.currency, periode: ligne.frequency, base,
        stripe_avant: null, action: "conforme", ancien_id: ligne.stripe_price_id, nouveau_id: null,
      };
      try {
        const stocke = await lirePrix(stripe, ligne.stripe_price_id);
        const parCle = await prixParCle(stripe, cle);
        const actuel = parCle ?? (stocke?.active ? stocke : null);
        entree.stripe_avant = actuel?.unit_amount != null ? actuel.unit_amount / 100 : null;
        entree.ancien_id = actuel?.id ?? ligne.stripe_price_id;

        // Prix desactive dans le back-office (ou plan inactif) : archive chez Stripe.
        if (!ligne.is_active || !plan.is_active) {
          const aArchiver = [stocke, parCle].filter((p): p is Stripe.Price => !!p && p.active);
          if (aArchiver.length === 0) continue;
          entree.action = opts.simulation ? "simulation" : "archive";
          entree.detail = "prix inactif dans le back-office";
          if (!opts.simulation) {
            for (const p of aArchiver) await stripe.prices.update(p.id, { active: false });
          }
          journal.push(entree);
          continue;
        }

        if (conforme(actuel, ligne)) {
          // Montant identique : on pose seulement la cle stable et l id en base.
          if (!opts.simulation) {
            if (actuel!.lookup_key !== cle) {
              await stripe.prices.update(actuel!.id, { lookup_key: cle, transfer_lookup_key: true });
            }
            if (ligne.stripe_price_id !== actuel!.id) {
              await supa.from("pricing_prices").update({ stripe_price_id: actuel!.id }).eq("id", ligne.id);
            }
          }
          entree.nouveau_id = actuel!.id;
          journal.push(entree);
          continue;
        }

        // Produit : celui du prix actuel, sinon d un prix du meme plan et de la meme periode.
        let produit = actuel ? idProduit(actuel) : stocke ? idProduit(stocke) : null;
        if (!produit) {
          for (const s of ((prix ?? []) as LignePrix[]).filter((p) => p.plan_id === plan.id && p.frequency === ligne.frequency && p.stripe_price_id)) {
            const p = await lirePrix(stripe, s.stripe_price_id);
            if (p) { produit = idProduit(p); break; }
          }
        }
        if (opts.simulation) {
          entree.action = "simulation";
          entree.detail = produit ? `nouveau prix sur ${produit}` : "nouveau produit a creer";
          journal.push(entree);
          continue;
        }
        if (!produit) {
          const nom = `Mettrik AI ${plan.name_fr ?? plan.code} (${ligne.frequency === "monthly" ? "mensuel" : "annuel"})`;
          const p = await stripe.products.create({ name: nom, metadata: { code: plan.code, frequency: ligne.frequency, mettrik_admin: "1" } });
          produit = p.id;
        }

        const date = new Date().toISOString();
        const nouveau = await stripe.prices.create({
          product: produit,
          unit_amount: centimes(base),
          currency: ligne.currency.toLowerCase(),
          recurring: { interval: intervalle(ligne.frequency) },
          lookup_key: cle,
          transfer_lookup_key: true,
          tax_behavior: actuel?.tax_behavior && actuel.tax_behavior !== "unspecified" ? actuel.tax_behavior : undefined,
          nickname: actuel?.nickname ?? undefined,
          metadata: {
            ...(actuel?.metadata ?? {}),
            plan_code: plan.code,
            frequency: ligne.frequency,
            mettrik_price_local_id: ligne.id,
            remplace: actuel?.id ?? "",
            synchro_le: date,
            synchro_source: source,
          },
        });

        // Un prix « par defaut » du produit ne peut pas etre desactive : on bascule d abord.
        const prod = await stripe.products.retrieve(produit);
        const defaut = typeof prod.default_price === "string" ? prod.default_price : prod.default_price?.id;
        const anciens = [actuel, stocke].filter((p, i, a): p is Stripe.Price => !!p && p.active && p.id !== nouveau.id && a.findIndex((q) => q?.id === p.id) === i);
        if (defaut && anciens.some((p) => p.id === defaut)) {
          await stripe.products.update(produit, { default_price: nouveau.id });
        }
        for (const p of anciens) await stripe.prices.update(p.id, { active: false });

        const { error: e3 } = await supa.from("pricing_prices").update({ stripe_price_id: nouveau.id }).eq("id", ligne.id);
        if (e3) throw e3;

        entree.action = "cree";
        entree.nouveau_id = nouveau.id;
        entree.detail = anciens.length ? `desactive : ${anciens.map((p) => p.id).join(", ")}` : undefined;
        journal.push(entree);
        console.log(`[stripe-prix-sync] ${cle} ${entree.stripe_avant ?? "-"} -> ${base} : ${nouveau.id} (ancien ${entree.ancien_id ?? "-"})`);
        await supa.from("billing_events").insert({
          stripe_event_id: `mettrik_price_sync_${nouveau.id}`,
          type: "mettrik.price_sync",
          payload: { ...entree, cle, produit, date, source },
          processed_ok: true,
        });
      } catch (e) {
        entree.action = "erreur";
        entree.detail = e instanceof Error ? e.message : String(e);
        journal.push(entree);
      }
    }
  }
  return journal;
}

/** Version serveur : clients Stripe et Supabase (service role) de l environnement. */
export async function synchroniseStripeServeur(opts: { planId?: string; simulation?: boolean; source?: string } = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role keys missing");
  const supa = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return synchroniseStripe(getStripe(), supa, opts);
}
