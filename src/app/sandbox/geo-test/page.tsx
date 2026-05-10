import { headers, cookies } from "next/headers";
import { COUNTRY_TO_LOCALE, DEFAULT_LOCALE } from "@/lib/i18n/types";
import { getCurrencyForCountry } from "@/lib/currency";
import { getCountryRegion } from "@/lib/geo/country-region";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Test géo-detection · Mettrik",
};

/**
 * Page de test : visualise ce que le proxy edge voit pour le visiteur
 * actuel — pays, langue déduite, devise déduite, header Accept-Language.
 *
 * Public, sans PII. Utile pour vérifier en live la chaîne de détection
 * Vercel x-vercel-ip-country → cookies → langue + devise.
 */
export default async function GeoTestPage() {
  const h = await headers();
  const country = h.get("x-vercel-ip-country") ?? "";
  const region = h.get("x-vercel-ip-country-region") ?? "";
  const city = h.get("x-vercel-ip-city") ?? "";
  const acceptLang = h.get("accept-language") ?? "";

  const c = await cookies();
  const localeCookie = c.get("NEXT_LOCALE")?.value ?? "(absent)";
  const currencyCookie = c.get("mettrik:currency")?.value ?? "(absent)";

  const macroRegion = getCountryRegion(country);
  const detectedLocale = country
    ? COUNTRY_TO_LOCALE[country.toUpperCase()] ?? DEFAULT_LOCALE
    : "(pas de pays)";
  const detectedCurrency = country ? getCurrencyForCountry(country) : "(pas de pays)";

  return (
    <div className="min-h-screen bg-[#050507] px-4 py-10 text-zinc-100 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <div className="font-mono text-[10.5px] uppercase tracking-wider text-violet-300">
            Sandbox · Test géo-détection
          </div>
          <h1 className="mt-1 font-display text-[32px] font-bold tracking-tight text-zinc-50 sm:text-[40px]">
            Ce que le serveur voit chez toi
          </h1>
          <p className="mt-2 text-[14px] text-zinc-400">
            Cette page lit les en-têtes injectés par Vercel sur la requête
            actuelle et te montre la langue + devise qu&apos;il en déduit.
            Reload la page pour rejouer la détection.
          </p>
        </header>

        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="mb-3 font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">
            Détection IP via Vercel
          </h2>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Row k="Pays détecté" v={country || "(non disponible)"} />
            <Row k="Région macro" v={macroRegion} />
            <Row k="Sous-région" v={region || "—"} />
            <Row k="Ville" v={city || "—"} />
          </dl>
        </section>

        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="mb-3 font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">
            Préférences déduites
          </h2>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Row k="Langue déduite" v={detectedLocale} highlight />
            <Row k="Devise déduite" v={detectedCurrency} highlight />
          </dl>
        </section>

        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="mb-3 font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">
            Cookies actuels
          </h2>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Row k="NEXT_LOCALE" v={localeCookie} />
            <Row k="mettrik:currency" v={currencyCookie} />
          </dl>
          <p className="mt-3 text-[11.5px] italic text-zinc-500">
            Si les cookies sont déjà posés, le proxy ne touche pas à la
            valeur (= ta préférence prime sur la détection IP).
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="mb-3 font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">
            Préférence linguistique du navigateur
          </h2>
          <code className="block break-all rounded-lg border border-white/8 bg-black/40 p-3 font-mono text-[11.5px] text-zinc-200">
            Accept-Language: {acceptLang || "(absent)"}
          </code>
          <p className="mt-3 text-[11.5px] italic text-zinc-500">
            Pour BE et CH, le proxy lit cet en-tête pour distinguer les
            régions linguistiques (BE-fr vs BE-nl, CH-fr vs CH-de).
          </p>
        </section>

        <div className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-[12.5px] text-amber-100/90">
          <strong className="text-amber-200">Note :</strong>
          {" "}les en-têtes <code className="font-mono">x-vercel-ip-*</code>{" "}
          ne sont injectés que sur le déploiement Vercel (prod ou staging).
          En dev local (<code className="font-mono">npm run dev</code>) ils
          sont absents — la page affichera "(non disponible)".
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-lg border border-white/10 bg-black/40 px-3 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">{k}</dt>
      <dd
        className={
          "font-mono tabular-nums " +
          (highlight ? "text-[14px] font-bold text-violet-200" : "text-[12.5px] text-zinc-100")
        }
      >
        {v}
      </dd>
    </div>
  );
}
