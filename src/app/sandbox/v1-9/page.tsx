import { redirect } from "next/navigation";

/**
 * /sandbox/v1-9 → redirect vers /sandbox/v1-9-publishable
 *
 * Yann 21 mai 2026 : visibilité stés OK uniquement (clean_all post-audit qualité).
 * L'ancienne page hub V1.9 (univers 924 stés + filter publishable 775) est remplacée
 * par la page publishable qui n'affiche QUE les stés `is_clean_all=true`.
 *
 * Les pages détail /sandbox/v1-9/<ticker> restent accessibles (sous-route enfant
 * non affectée par ce redirect côté Next.js routing).
 */
export default function SandboxV19RedirectPage() {
  redirect("/sandbox/v1-9-publishable");
}
