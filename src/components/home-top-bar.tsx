import Link from "next/link";
import { AuthNav } from "@/components/auth-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavPlusMenu } from "@/components/nav-plus-menu";
import { LogoMettrik } from "@/components/logo-mettrik";

/**
 * Barre du haut de l'accueil.
 * Mobile : une seule barre fixe (logo a gauche ; Tarifs, langue, compte et
 * menu « ... » regroupes a droite, jour/nuit dans le menu).
 * Ordinateur : groupe flottant en haut a droite, comme avant.
 */
export function HomeTopBar({
  themePaid,
  showPricing,
  anon,
}: {
  themePaid: boolean;
  showPricing: boolean;
  anon: boolean;
}) {
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between gap-2 border-b border-white/[0.06] bg-[#050505]/85 px-3 backdrop-blur-md sm:inset-x-auto sm:right-6 sm:top-6 sm:h-auto sm:justify-end sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-0">
        <Link href="/" aria-label="Mettrik AI" className="-ml-1 flex h-9 w-[104px] shrink-0 items-center overflow-hidden sm:hidden">
          <span className="-mt-1 block">
            <LogoMettrik emplacement="home" size="sm" showRail={false} animated={false} hauteurPng="54px" />
          </span>
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-3">
          {showPricing && (
            <Link
              href="/pricing"
              className="inline-flex h-9 items-center rounded-full border border-white/15 px-3.5 text-[13px] font-semibold text-zinc-100 sm:hidden"
            >
              Tarifs
            </Link>
          )}
          <span className="max-sm:hidden">
            <ThemeToggle paid={themePaid} />
          </span>
          <AuthNav scope="home" compactMobile />
          <NavPlusMenu
            paid={themePaid}
            anon={anon}
            liens={[
              { label: "Contact", href: "/contact" },
              { label: "Rejoindre Mettrik", href: "/partenaires" },
            ]}
          />
        </div>
      </header>
      {/* L'en-tete est fixe sur mobile : on reserve sa hauteur. */}
      <div className="h-14 sm:hidden" />
    </>
  );
}
