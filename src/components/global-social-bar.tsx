"use client";

import { usePathname } from "next/navigation";
import { SocialLinksRow } from "@/components/social-links-row";

/**
 * GlobalSocialBar — bandeau social en bas de page.
 *
 * Yann 20 mai 2026 16h :
 *  - Sur pages SOCIÉTÉ (V1.8 / V1.9 avec DockSpy gauche qui contient déjà
 *    les liens sociaux) : NE RIEN AFFICHER.
 *  - Sur pages NON-sté (home, /pricing, /contact, /legal/*, /maintenance,
 *    /concepts publics, etc.) : bouton X seul (style V7 holographic conic).
 *
 * Yann (25 mai 2026) :
 *  - Retirer aussi sur tout le back office (/desk-* et /sandbox/*) — le
 *    footer social n'a pas sa place dans l'interface admin.
 *  - Instagram retiré (Mettrik AI maintient uniquement X désormais).
 */
function isCompanyPage(pathname: string): boolean {
  return /^\/sandbox\/v1-[789](?:-5)?\/[^/]+\/?$/.test(pathname);
}

function isBackOfficePage(pathname: string): boolean {
  if (pathname.startsWith("/desk-")) return true;
  if (pathname.startsWith("/sandbox")) return true;
  return false;
}

export function GlobalSocialBar() {
  const pathname = usePathname();
  if (!pathname || isCompanyPage(pathname) || isBackOfficePage(pathname)) return null;
  return (
    <div className="relative border-t border-white/[0.06] bg-gradient-to-b from-[#070707] to-[#050505] px-4 py-4 sm:px-6">
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
      <div className="relative mx-auto flex max-w-5xl items-center">
        <SocialLinksRow align="left" size="compact" />
      </div>
    </div>
  );
}
