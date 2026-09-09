import { SandboxClient } from "./sandbox-client";

export const metadata = {
  title: "Sandbox · Mettrik",
  robots: { index: false, follow: false },
};

/** 9 sept 2026 : la page reste un composant serveur (metadata) ; toute la
 *  logique (usage local, zones, recherche) vit dans sandbox-client.tsx. */
export default function SandboxPage() {
  return <SandboxClient />;
}
