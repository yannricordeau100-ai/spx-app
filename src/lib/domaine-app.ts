// 15 oct 2026 : sous-domaine app.mettrik.ai (docs/APP-SOUS-DOMAINE.md).
// Vitrine (accueil, tarifs, contact, pages legales) sur mettrik.ai, fiches et
// compte sur app.mettrik.ai. Aucun effet sur *.vercel.app ni en local.

export const URL_APP = "https://app.mettrik.ai";
export const URL_VITRINE = "https://mettrik.ai";

function sansPort(host: string): string {
  return (host ?? "").toLowerCase().split(":")[0];
}

/** mettrik.ai ou www.mettrik.ai */
export function estHoteVitrine(host: string): boolean {
  const h = sansPort(host);
  return h === "mettrik.ai" || h === "www.mettrik.ai";
}

export function estHoteApp(host: string): boolean {
  return sansPort(host) === "app.mettrik.ai";
}

/** Domaine des cookies Supabase : partage entre mettrik.ai et app.mettrik.ai. */
export function domaineCookies(host: string): string | undefined {
  const h = sansPort(host);
  return h === "mettrik.ai" || h.endsWith(".mettrik.ai") ? ".mettrik.ai" : undefined;
}

/** Origine des liens d authentification : app.mettrik.ai depuis la vitrine. */
export function origineAuth(host: string, proto: string): string {
  if (estHoteVitrine(host)) return URL_APP;
  return `${proto}://${host}`;
}
