import { requireDeskOwner } from "@/lib/desk/auth";
import { LogoLabClient } from "./client";
import activeWordmark from "@/data/active-wordmark.json";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Logo Lab · Mettrik (sandbox)",
  robots: { index: false, follow: false },
};

/**
 * Logo Lab : galerie de variantes du wordmark Mettrik. Yann clique sur
 * "Appliquer" pour propager la variante choisie partout (BrandWordmark,
 * MettrikWordmark) via `src/data/active-wordmark.json`.
 *
 * Auth-gate : email Yann uniquement (cf requireDeskOwner).
 */
export default async function LogoLabPage() {
  await requireDeskOwner();
  return <LogoLabClient initialActiveId={activeWordmark.id} />;
}
