import { SocialLinksRow } from "@/components/social-links-row";

/**
 * GlobalSocialBar — fine bande horizontale en bas de page,
 * affichée sur TOUTES les pages de l'app (intégrée au layout root).
 * Yann 17 mai 2026 : "ajouter en bas de toutes les pages de l'app le
 * fait que nous soyons présent sur les réseaux sociaux".
 *
 * Style "wow + sérieux" : layout discret mais haute qualité, gradient
 * subtil violet/cyan Mettrik en background, séparé du contenu par une
 * border-top.
 *
 * Note : les pages qui ont un DisclaimerFooter complet (home, account,
 * pricing, /[ticker] V1, etc.) afficheront ce bandeau APRÈS leur footer.
 * Volonté Yann : présence permanente.
 */
export function GlobalSocialBar() {
  return (
    <div className="relative border-t border-white/[0.06] bg-gradient-to-b from-[#070707] to-[#050505] px-4 py-5 sm:px-6">
      {/* Halo discret violet/cyan en fond */}
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-0 size-[400px] -translate-x-1/2 rounded-full bg-violet-500/[0.03] blur-3xl" />

      <div className="relative mx-auto flex max-w-5xl flex-col items-center justify-center gap-3 sm:flex-row sm:justify-between">
        <div className="text-center sm:text-left">
          <div className="font-display text-[13px] font-semibold text-zinc-200">
            Mettrik AI sur les réseaux
          </div>
          <div className="text-[11px] text-zinc-500">
            Suivez nos analyses, méthodologies et nouveautés.
          </div>
        </div>
        <SocialLinksRow align="center" size="compact" />
      </div>
    </div>
  );
}
