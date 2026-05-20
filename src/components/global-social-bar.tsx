"use client";

import { usePathname } from "next/navigation";
import { SocialLinksRow } from "@/components/social-links-row";

/**
 * GlobalSocialBar — bandeau social en bas de page.
 *
 * Yann 20 mai 2026 16h :
 *  - Sur pages SOCIÉTÉ (V1.8 / V1.9 avec DockSpy gauche qui contient déjà
 *    les liens sociaux) : NE RIEN AFFICHER.
 *  - Sur pages NON-sté (home, /pricing, /contact, /legal/*, /sandbox hubs,
 *    /concepts, /account, /maintenance, etc.) : les 2 boutons seuls à
 *    gauche (pas de texte "Suivez Mettrik AI sur les réseaux").
 *
 * Détection page sté : pathname matches /sandbox/v1-X/<ticker> (X = 7|7-5|8|9).
 */
function isCompanyPage(pathname: string): boolean {
  return /^\/sandbox\/v1-[789](?:-5)?\/[^/]+\/?$/.test(pathname);
}

export function GlobalSocialBar() {
  const pathname = usePathname();
  if (!pathname || isCompanyPage(pathname)) return null;
  return (
    <div className="relative border-t border-white/[0.06] bg-gradient-to-b from-[#070707] to-[#050505] px-4 py-4 sm:px-6">
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
      <div className="relative mx-auto flex max-w-5xl items-center">
        <SocialLinksRow align="left" size="compact" />
      </div>
    </div>
  );
}
