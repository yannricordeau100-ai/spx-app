/**
 * Yann 4 juin 2026 : kill-switch global pour cacher tous les pickers
 * de langue (LanguageDropdown, LocaleFlagsRow, LanguageSwitcher) PARTOUT
 * sauf dans le backoffice admin et sandbox admin. Demande explicite Yann
 * avant bascule niveau 1 / niveau 0 : la prod publique est FR-only.
 *
 * Utilisation cote client : importer `usePickerVisible()` dans chaque
 * composant picker et return null si !visible.
 *
 * Pour reactiver partout : remplacer `false` par `true` dans
 * `LANG_PICKER_ENABLED_PUBLIC` ci-dessous.
 */

import { usePathname } from "next/navigation";

const LANG_PICKER_ENABLED_PUBLIC = false;

// 8 oct 2026 (audit des fuites publiques) : plus de liste de routes internes
// dans ce module charge sur toutes les pages. Les selecteurs restent visibles
// dans le back-office et l outillage (premier segment desk-... ou sandbox).
export function usePickerVisible(): boolean {
  const pathname = usePathname();
  if (LANG_PICKER_ENABLED_PUBLIC) return true;
  if (!pathname) return false;
  const seg = pathname.split("/")[1] ?? "";
  return seg.startsWith("desk-") || seg === "sandbox";
}
