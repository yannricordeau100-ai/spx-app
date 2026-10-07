"use client";

import { usePathname } from "next/navigation";

/** Pages internes ou techniques : pas de pied de page public. */
const EXCLUS = ["/sandbox", "/concepts", "/desk-", "/admin", "/chart-lab", "/email-lab", "/maintenance", "/whoami", "/api"];

export function FooterGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  if (EXCLUS.some((p) => pathname === p || pathname.startsWith(p.endsWith("-") ? p : p + "/"))) return null;
  return <>{children}</>;
}
