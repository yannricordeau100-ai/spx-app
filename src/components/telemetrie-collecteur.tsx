"use client";

/**
 * Collecteur de télémétrie première partie (Yann 31 août 2026).
 *
 * Monté une fois dans le layout racine. Mesure, sans aucun service tiers :
 *  - pages vues, durée de visite par page, profondeur de scroll ;
 *  - clics sur liens et boutons (libellé tronqué, jamais de contenu saisi) ;
 *  - erreurs JavaScript ;
 *  - latence des appels /api/* vus du client (couche logicielle) ;
 *  - repères de performance (TTFB, DOM prêt, premier rendu).
 *
 * Les événements sont mis en lot et expédiés par sendBeacon vers
 * /api/telemetrie toutes les 12 s et au départ de la page. Un interrupteur
 * global (sandbox → Télémétrie) coupe toute collecte : l'API répond alors
 * inactif et le collecteur se tait.
 *
 * Jamais collecté : contenu des champs de saisie, mots de passe, IP en clair
 * (hachée côté serveur), aucune donnée envoyée à un domaine tiers.
 */

import { useEffect } from "react";

type Evt = Record<string, unknown>;

const CLE_SESSION = "mtk-tel-session";

function idSession(): string {
  try {
    let v = sessionStorage.getItem(CLE_SESSION);
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(CLE_SESSION, v);
    }
    return v;
  } catch {
    return "sans-session";
  }
}

function contexte(): Evt {
  const ua = navigator.userAgent;
  const appareil = /Mobi|Android.+Mobile/.test(ua) ? "mobile" : /iPad|Tablet/.test(ua) ? "tablette" : "ordinateur";
  const navigateurs: [RegExp, string][] = [
    [/Edg\//, "Edge"], [/OPR\//, "Opera"], [/Chrome\//, "Chrome"],
    [/Safari\//, "Safari"], [/Firefox\//, "Firefox"],
  ];
  const os: [RegExp, string][] = [
    [/Windows/, "Windows"], [/Mac OS X/, "macOS"], [/Android/, "Android"],
    [/iPhone|iPad|iOS/, "iOS"], [/Linux/, "Linux"],
  ];
  return {
    session_id: idSession(),
    appareil,
    navigateur: (navigateurs.find(([r]) => r.test(ua)) ?? [0, "autre"])[1],
    os: (os.find(([r]) => r.test(ua)) ?? [0, "autre"])[1],
    ecran: `${window.screen.width}x${window.screen.height}`,
    langue: navigator.language,
  };
}

export function TelemetrieCollecteur() {
  useEffect(() => {
    let actif = true;
    let vivant = true;
    const lot: Evt[] = [];
    const base = contexte();

    const pousse = (e: Evt) => {
      if (!actif || !vivant) return;
      lot.push({ ...base, chemin: location.pathname, ...e });
      if (lot.length >= 40) expedie();
    };

    const expedie = () => {
      if (!lot.length) return;
      const corps = JSON.stringify({ evenements: lot.splice(0, lot.length) });
      try {
        if (!navigator.sendBeacon?.("/api/telemetrie", new Blob([corps], { type: "application/json" }))) {
          void fetch("/api/telemetrie", { method: "POST", body: corps, keepalive: true, headers: { "content-type": "application/json" } });
        }
      } catch { /* la telemetrie ne casse jamais la page */ }
    };

    // Interrupteur global : un GET leger dit si la collecte est active.
    void fetch("/api/telemetrie")
      .then((r) => (r.ok ? r.json() : { actif: true }))
      .then((j) => { actif = j?.actif !== false; })
      .catch(() => {});

    // ---- pages vues + duree + scroll max (SPA : suit les navigations) ----
    let cheminCourant = location.pathname;
    let debut = performance.now();
    let scrollMax = 0;
    const finDePage = () => {
      pousse({ type: "page", nom: "vue", chemin: cheminCourant, referrer: document.referrer.slice(0, 300), duree_ms: Math.round(performance.now() - debut) });
      if (scrollMax > 0) pousse({ type: "scroll", nom: "profondeur", chemin: cheminCourant, props: { pct: scrollMax } });
    };
    const surScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      if (h > 0) scrollMax = Math.max(scrollMax, Math.min(100, Math.round((window.scrollY / h) * 100)));
    };
    const verifieNavigation = () => {
      if (location.pathname !== cheminCourant) {
        finDePage();
        cheminCourant = location.pathname;
        debut = performance.now();
        scrollMax = 0;
      }
    };
    const minuterieNav = window.setInterval(verifieNavigation, 800);

    // ---- clics ----
    const surClic = (ev: MouseEvent) => {
      const cible = (ev.target as HTMLElement)?.closest?.("a, button, [role=button], [data-track]") as HTMLElement | null;
      if (!cible) return;
      const nom =
        cible.getAttribute("data-track") ||
        cible.getAttribute("aria-label") ||
        cible.textContent?.trim().slice(0, 80) ||
        cible.tagName.toLowerCase();
      const href = cible.getAttribute("href") ?? undefined;
      pousse({ type: "clic", nom, props: href ? { href: href.slice(0, 200) } : {} });
    };

    // ---- erreurs JS ----
    const surErreur = (ev: ErrorEvent) => {
      pousse({ type: "erreur", nom: (ev.message || "erreur").slice(0, 160), props: { source: (ev.filename || "").slice(0, 200), ligne: ev.lineno } });
    };
    const surRejet = (ev: PromiseRejectionEvent) => {
      pousse({ type: "erreur", nom: String(ev.reason ?? "promesse rejetee").slice(0, 160) });
    };

    // ---- latence API + perf de chargement (couche logicielle) ----
    let obs: PerformanceObserver | null = null;
    try {
      obs = new PerformanceObserver((liste) => {
        for (const entree of liste.getEntries()) {
          if (entree.entryType === "resource") {
            const r = entree as PerformanceResourceTiming;
            const u = r.name;
            const i = u.indexOf("/api/");
            if (i !== -1 && !u.includes("/api/telemetrie")) {
              pousse({ type: "api", nom: u.slice(i).split("?")[0].slice(0, 120), duree_ms: Math.round(r.duration) });
            }
          } else if (entree.entryType === "navigation") {
            const n = entree as PerformanceNavigationTiming;
            pousse({ type: "perf", nom: "chargement", props: { ttfb_ms: Math.round(n.responseStart), dom_ms: Math.round(n.domContentLoadedEventEnd), total_ms: Math.round(n.loadEventEnd || n.domContentLoadedEventEnd) } });
          }
        }
      });
      obs.observe({ entryTypes: ["resource", "navigation"] });
    } catch { /* navigateur sans PerformanceObserver */ }

    const minuterie = window.setInterval(expedie, 12_000);
    const surCache = () => { if (document.visibilityState === "hidden") { finDePage(); expedie(); } };

    window.addEventListener("scroll", surScroll, { passive: true });
    document.addEventListener("click", surClic, { capture: true, passive: true });
    window.addEventListener("error", surErreur);
    window.addEventListener("unhandledrejection", surRejet);
    document.addEventListener("visibilitychange", surCache);

    return () => {
      vivant = false;
      window.clearInterval(minuterie);
      window.clearInterval(minuterieNav);
      obs?.disconnect();
      window.removeEventListener("scroll", surScroll);
      document.removeEventListener("click", surClic, { capture: true } as EventListenerOptions);
      window.removeEventListener("error", surErreur);
      window.removeEventListener("unhandledrejection", surRejet);
      document.removeEventListener("visibilitychange", surCache);
    };
  }, []);

  return null;
}
