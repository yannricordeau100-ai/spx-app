/**
 * setup-stripe-products.ts — crée les 3 Products Mettrik AI dans Stripe
 * (mode TEST par défaut, déterminé par STRIPE_SECRET_KEY=sk_test_...) avec
 * leurs Prices en 7 devises.
 *
 * Devises (Yann 5 mai 2026) : EUR, USD, SEK, DKK, CAD, CHF, GBP.
 * Note : Yann a dit "NOK (danemark)" mais NOK = couronne norvégienne,
 * Denmark = DKK. La locale `da` cible le Danemark donc on prend DKK.
 * Si NOK voulu plus tard (norvégien non couvert par i18n actuel), facile
 * à ajouter en 1 ligne.
 *
 * Usage :
 *   npx tsx scripts/setup-stripe-products.ts
 *   npx tsx scripts/setup-stripe-products.ts --recreate  (supprime + recrée)
 *
 * Sortie : src/lib/billing/stripe-products.json contient
 *   { products: { free, premium_monthly, premium_annual }, prices: {...} }
 *
 * À relancer si on veut changer les tarifs ou ajouter une devise.
 * Idempotent : si un product existe déjà avec le même metadata.mettrik_id,
 * on skip la création et on log "exists".
 */
import Stripe from "stripe";
import { writeFileSync, readFileSync, existsSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, ".env.local");
const OUT_PATH = path.join(ROOT, "src/lib/billing/stripe-products.json");

// Charge .env.local manuellement (Next.js le fait sinon, mais ce script tourne hors Next).
function loadEnv() {
  if (!existsSync(ENV_PATH)) return;
  const raw = readFileSync(ENV_PATH, "utf-8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("❌ STRIPE_SECRET_KEY manquante dans .env.local");
  process.exit(1);
}
// Yann 31 aout 2026 (lancement) : le mode live est desormais autorise avec le
// drapeau explicite --live. Le script est idempotent (recherche par
// metadata.mettrik_id avant creation) : rejouable sans doublon.
const liveVoulu = process.argv.includes("--live");
if (!key.startsWith("sk_test_") && !liveVoulu) {
  console.error(`❌ Clé NON test détectée (${key.slice(0, 10)}...). Refus par sécurité.`);
  console.error("   Pour créer les produits en LIVE (lancement) : ajouter --live.");
  process.exit(1);
}
if (key.startsWith("sk_test_") && liveVoulu) {
  console.error("❌ --live demandé mais la clé est une clé test.");
  process.exit(1);
}

const stripe = new Stripe(key);

// Tarifs par devise. Source : pricing harmonisé contre EUR base.
// EUR Premium = 24,90 / mois, 189 / an.
type CurrencyCode = "eur" | "usd" | "gbp" | "chf" | "sek" | "dkk" | "cad";
type PricingTable = Record<CurrencyCode, { month: number; year: number }>;

// Yann 31 aout 2026 : la grille est RECALEE sur les montants affiches par la
// page Tarifs (BDD desk + repli plans.ts). Avant, Stripe portait 24,90 € alors
// que la page annoncait 29,90 € : le client aurait vu un prix et paye l autre.
// DKK et CAD, absents de la base, gardent les rapports historiques EUR x 7,45
// et USD x 1,34.
const PRICING: PricingTable = {
  // Tous montants en plus petite unité (centimes pour EUR/USD/GBP/CHF/CAD,
  // öre pour SEK, øre pour DKK).
  eur: { month: 2990, year: 23880 },     // 29,90 € / 238,80 €
  usd: { month: 3490, year: 29880 },     // $34.90 / $298.80
  gbp: { month: 2990, year: 23880 },     // £29.90 / £238.80
  chf: { month: 2990, year: 23880 },     // CHF 29.90 / 238.80
  sek: { month: 27900, year: 209900 },   // 279 SEK / 2099 SEK
  dkk: { month: 22300, year: 178000 },   // 223 DKK / 1780 DKK (EUR x 7,45)
  cad: { month: 4690, year: 39900 },     // CA$46.90 / CA$399 (USD x 1,34)
};

// Yann 31 aout 2026 : le plan Max n avait jamais ete synchronise (le script
// ne connaissait que Free et Premium). Montants alignes sur la BDD desk pour
// EUR, USD, GBP, CHF et SEK ; DKK et CAD deduits avec les memes rapports que
// Premium, faute de valeur en base.
const PRICING_MAX: PricingTable = {
  eur: { month: 5990, year: 47880 },     // 59,90 € / 478,80 €
  usd: { month: 6990, year: 59880 },     // $69.90 / $598.80
  gbp: { month: 5990, year: 47880 },     // £59.90 / £478.80
  chf: { month: 5990, year: 47880 },     // CHF 59.90 / 478.80
  sek: { month: 59900, year: 499900 },   // 599 SEK / 4999 SEK
  dkk: { month: 44900, year: 359900 },   // 449 DKK / 3599 DKK (rapport Premium)
  cad: { month: 9490, year: 80900 },     // CA$94.90 / CA$809 (rapport Premium)
};

const PRODUCT_DEFS = [
  {
    metaId: "mettrik_free",
    name: "Mettrik AI Free",
    description: "Accès gratuit à un échantillon de sociétés (démonstration). À vie.",
    type: "free" as const,
  },
  {
    metaId: "mettrik_premium_monthly",
    name: "Mettrik AI Premium (mensuel)",
    description: "Accès complet à toutes les sociétés couvertes, comparaison N-vs-N, watchlists illimitées, alertes par KPI, digest hebdo.",
    type: "subscription" as const,
    interval: "month" as const,
  },
  {
    metaId: "mettrik_premium_annual",
    name: "Mettrik AI Premium (annuel)",
    description: "Mêmes fonctionnalités que Premium mensuel, payé en une fois. ~37% d'économie vs mensuel.",
    type: "subscription" as const,
    interval: "year" as const,
  },
  {
    metaId: "mettrik_max_monthly",
    name: "Mettrik AI Max (mensuel)",
    description: "Tout Premium, plus les outils avances destines aux family offices, conseillers et fonds.",
    type: "subscription" as const,
    interval: "month" as const,
    grille: "max" as const,
  },
  {
    metaId: "mettrik_max_annual",
    name: "Mettrik AI Max (annuel)",
    description: "Memes fonctionnalites que Max mensuel, paye en une fois.",
    type: "subscription" as const,
    interval: "year" as const,
    grille: "max" as const,
  },
];

type OutShape = {
  mode: "test" | "live";
  generated_at: string;
  products: Record<string, { id: string; name: string }>;
  prices: Record<string, Record<CurrencyCode, string>>; // metaId → currency → price_id
};

async function findProductByMetaId(metaId: string) {
  // Stripe ne permet pas de filter par metadata directement → on liste et filtre côté client.
  // Limite à 100 (devrait largement suffire).
  const products = await stripe.products.list({ limit: 100, active: true });
  return products.data.find((p) => p.metadata.mettrik_id === metaId);
}

async function ensureProduct(def: { metaId: string; name: string; description: string }) {
  const existing = await findProductByMetaId(def.metaId);
  if (existing) {
    console.log(`✅ Product exists : ${def.name} (${existing.id})`);
    return existing;
  }
  const created = await stripe.products.create({
    name: def.name,
    description: def.description,
    metadata: { mettrik_id: def.metaId },
  });
  console.log(`🆕 Product created : ${def.name} (${created.id})`);
  return created;
}

async function ensurePrice(productId: string, currency: CurrencyCode, amount: number, interval: "month" | "year") {
  // Liste les prices du product, cherche match par currency + interval + amount.
  const prices = await stripe.prices.list({ product: productId, limit: 100, active: true });
  const match = prices.data.find(
    (p) =>
      p.currency === currency &&
      p.unit_amount === amount &&
      p.recurring?.interval === interval
  );
  if (match) {
    console.log(`   ✅ Price exists : ${currency.toUpperCase()} ${amount / 100}/${interval} (${match.id})`);
    return match;
  }
  const created = await stripe.prices.create({
    product: productId,
    currency,
    unit_amount: amount,
    recurring: { interval },
  });
  console.log(`   🆕 Price created : ${currency.toUpperCase()} ${amount / 100}/${interval} (${created.id})`);
  return created;
}

async function main() {
  console.log(`Stripe TEST mode (${key!.slice(0, 12)}...)\n`);

  const out: OutShape = {
    mode: (key ?? "").startsWith("sk_live_") ? "live" as const : "test" as const,
    generated_at: new Date().toISOString(),
    products: {},
    prices: {},
  };

  for (const def of PRODUCT_DEFS) {
    console.log(`\n📦 ${def.name}`);
    const product = await ensureProduct(def);
    out.products[def.metaId] = { id: product.id, name: product.name };
    if (def.type === "free") continue;

    const interval = def.interval!;
    const grille =
      (def as { grille?: string }).grille === "max" ? PRICING_MAX : PRICING;
    const currencyPrices: Record<CurrencyCode, string> = {} as Record<CurrencyCode, string>;
    for (const cur of Object.keys(grille) as CurrencyCode[]) {
      const amount = interval === "month" ? grille[cur].month : grille[cur].year;
      const price = await ensurePrice(product.id, cur, amount, interval);
      currencyPrices[cur] = price.id;
    }
    out.prices[def.metaId] = currencyPrices;
  }

  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), "utf-8");
  console.log(`\n✅ Config sauvée : ${OUT_PATH}`);
  console.log(`   ${Object.keys(out.products).length} products, ${Object.values(out.prices).reduce((acc, c) => acc + Object.keys(c).length, 0)} prices.`);
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
