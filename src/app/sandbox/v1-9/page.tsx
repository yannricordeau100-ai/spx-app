import { redirect } from "next/navigation";

/**
 * /sandbox/v1-9 → redirect vers /sandbox/v1-9-5 (le hub publishable canonique).
 * Yann 26 mai : retire toute trace de "publishable" dans les URL.
 */
export default function SandboxV19RedirectPage() {
  redirect("/sandbox/v1-9-5");
}
