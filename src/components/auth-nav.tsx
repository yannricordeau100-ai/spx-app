import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dictionary";
import { LanguageDropdown as LanguageSwitcher } from "@/components/language-dropdown";
import type { Locale } from "@/lib/i18n/types";

/**
 * AuthNav — server component qui montre :
 *   - LanguageSwitcher (drapeaux FR/US, toujours visible)
 *   - Si user connecté : pastille initiales + lien vers /account
 *   - Sinon : 2 boutons Connexion / S'inscrire en style Risographe
 *
 * Les libellés sont traduits via la locale serveur (cookie + IP).
 *
 * Prop `scope` (Yann 6 mai 2026) :
 *   - "home" (défaut) : toutes les langues sont pleinement traduites
 *     (6 locales) → aucune grisée dans le dropdown.
 *   - "company" : uniquement FR/EN sont traduites à 100 %, les autres
 *     locales (DE/NL/en-GB/de-CH) sont grisées + pastille "partiel".
 */

// Locales pleinement traduites par scope. Yann a couvert FR/EN partout.
// Yann 15 mai 2026 : DE désormais traduit aussi sur pages société (KPIs,
// risks, governance, AI positioning, lead interprétation) via overlay
// v2-pipeline-i18n/<ticker>.de.json + interp-i18n. NL encore partiel
// (les chartes/labels UI sont traduits mais pas le contenu KPI data-side).
const COVERAGE: Record<"home" | "company", Locale[]> = {
  home: ["en", "fr", "de", "nl", "en-GB", "de-CH"],
  company: ["en", "fr", "de", "de-CH"],
};

function initials(email: string): string {
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

export async function AuthNav({ scope = "home" }: { scope?: "home" | "company" } = {}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const locale = await getServerLocale();
  const t = (k: string) => translate(k, locale);

  if (user) {
    return (
      <div className="flex items-center gap-2.5">
        <LanguageSwitcher availableLocales={COVERAGE[scope]} />
        {/* Yann 4 sept 2026 : le bouton Enregistrer n avait aucune destination.
            Le raccourci vers la liste vit ici, a cote du compte. */}
        <Link
          href="/mes-societes"
          className="hidden items-center gap-1.5 rounded-full border border-[#2a2a2a] bg-[#0a0a0a] px-2.5 py-1 text-[12.5px] font-medium text-zinc-300 transition-colors hover:border-violet-500/50 hover:text-violet-200 sm:inline-flex"
          title="Mes sociétés enregistrées"
        >
          Mes sociétés
        </Link>
        <Link
          href="/account"
          className="inline-flex items-center gap-2 rounded-full border border-[#2a2a2a] bg-[#0a0a0a] px-2.5 py-1 text-[12.5px] font-medium text-zinc-100 transition-colors hover:border-violet-500/50 hover:text-violet-200"
          aria-label={t("authnav.account")}
          title={user.email ?? t("authnav.account")}
        >
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-violet-500/25 font-mono text-[10px] font-bold text-violet-100">
            {initials(user.email ?? "??")}
          </span>
          <span className="hidden sm:inline">{t("authnav.account")}</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-3">
      <LanguageSwitcher />
      <Link href="/?auth=signin" className="group relative inline-block" aria-label={t("authnav.signin")}>
        <span
          aria-hidden
          className="hidden sm:block absolute inset-0 translate-x-[3px] translate-y-[3px] rounded-md border border-violet-300/35 transition-transform duration-200 ease-out group-hover:translate-x-[5px] group-hover:translate-y-[5px]"
        />
        <span className="relative z-10 inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-[#0a0a0e] px-2.5 sm:px-3.5 py-2 text-[12.5px] font-medium tracking-[0.04em] text-zinc-100 transition-transform duration-200 ease-out group-hover:-translate-x-[1px] group-hover:-translate-y-[1px]">
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.6)]"
          />
          {t("authnav.signin")}
        </span>
      </Link>

      {/* Yann 5 sept 2026 : sur une fiche en mobile (375 px), le bouton
          S inscrire faisait deborder la barre a droite (Connexion coupe).
          Hors accueil il n apparait qu a partir de 640 px ; la fenetre de
          connexion propose de toute facon "Creer un compte". */}
      <Link
        href="/?auth=signup"
        className={`group relative ${scope === "home" ? "inline-block" : "hidden sm:inline-block"}`}
        aria-label={t("authnav.signup")}
      >
        <span
          aria-hidden
          className="hidden sm:block absolute inset-0 translate-x-[3px] translate-y-[3px] rounded-md border border-cyan-300/45 transition-transform duration-200 ease-out group-hover:translate-x-[5px] group-hover:translate-y-[5px]"
        />
        <span className="relative z-10 inline-flex items-center gap-2 rounded-md border border-violet-300/40 bg-violet-500/15 px-2.5 sm:px-3.5 py-2 text-[12.5px] font-semibold tracking-[0.04em] text-violet-50 transition-transform duration-200 ease-out group-hover:-translate-x-[1px] group-hover:-translate-y-[1px]">
          {t("authnav.signup")}
          <span
            aria-hidden
            className="font-mono text-[13px] leading-none text-violet-200 transition-transform duration-200 group-hover:translate-x-0.5"
          >
            ↗
          </span>
        </span>
      </Link>
    </div>
  );
}
