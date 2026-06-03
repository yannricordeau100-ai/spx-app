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

const ADMIN_PATH_PREFIXES = [
  "/desk-mtk9x4kp",
  "/sandbox/admin",
  "/sandbox/languages-toggle",
  "/sandbox/i18n-audit",
];

export function usePickerVisible(): boolean {
  const pathname = usePathname();
  if (LANG_PICKER_ENABLED_PUBLIC) return true;
  if (!pathname) return false;
  return ADMIN_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}
