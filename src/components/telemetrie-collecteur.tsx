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
    // 15 oct 2026 : iOS avant macOS (l agent d un iPhone contient « Mac OS X »).
    [/Windows/, "Windows"], [/iPhone|iPad|iOS/, "iOS"], [/Mac OS X/, "macOS"],
    [/Android/, "Android"], [/Linux/, "Linux"],
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

const CLE_ARRIVEE = "mtk-tel-arrivee";

/**
 * Provenance a l ARRIVEE sur le site (Yann 15 oct 2026) : referent et
 * parametres utm de la premiere page de l onglet, gardes pour toute la visite.
 * Avant, ils n etaient lus qu au depart de chaque page : une navigation
 * interne effacait les utm de la page d arrivee.
 */
function arrivee(): Record<string, string> {
  try {
    const deja = sessionStorage.getItem(CLE_ARRIVEE);
    if (deja) return JSON.parse(deja) as Record<string, string>;
  } catch { /* stockage indisponible */ }
  const q = new URLSearchParams(location.search);
  const a: Record<string, string> = { arr_chemin: location.pathname.slice(0, 200) };
  let ref = "";
  try {
    if (document.referrer && new URL(document.referrer).host !== location.host) ref = document.referrer.slice(0, 300);
  } catch { /* referent illisible */ }
  if (ref) a.arr_ref = ref;
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) { const v = q.get(k); if (v) a[`arr_${k}`] = v.slice(0, 120); }
  try { sessionStorage.setItem(CLE_ARRIVEE, JSON.stringify(a)); } catch { /* idem */ }
  return a;
}

export function TelemetrieCollecteur() {
  useEffect(() => {
    let actif = true;
    let vivant = true;
    const lot: Evt[] = [];
    const base = contexte();
    const provenanceArrivee = arrivee();

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
      // Yann 12 sept 2026 : provenance detaillee (site, parametres de campagne,
      // lien de partage Mettrik) pour savoir d ou viennent les visiteurs.
      const q = new URLSearchParams(location.search);
      const provenance: Record<string, unknown> = { hote: location.host, ...provenanceArrivee };
      // Outil automatise (Playwright, Selenium) : le serveur l isole.
      if (navigator.webdriver) provenance.wd = true;
      for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "ref", "src", "s"]) { const v = q.get(k); if (v) provenance[k] = v.slice(0, 120); }
      pousse({ type: "page", nom: "vue", chemin: cheminCourant, referrer: document.referrer.slice(0, 300), duree_ms: Math.round(performance.now() - debut), props: provenance });
      if (scrollMax > 0) pousse({ type: "scroll", nom: "profondeur", chemin: cheminCourant, props: { pct: scrollMax } });
    };
    const surScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      if (h > 0) scrollMax = Math.max(scrollMax, Math.min(100, Math.round((window.scrollY / h) * 100)));
    };
    const verifieNavigation = () => {
      if (location.pathname !== cheminCourant) {
        envoieVitaux();
        finDePage();
        window.clearTimeout(minuterieContenu);
        minuterieContenu = window.setTimeout(controleContenu, 5000);
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

    // ---- PROBLEMES VUS PAR LES VISITEURS (Yann 15 oct 2026) ----
    // Tout part en type « erreur » avec une categorie (props.cat) ; au plus
    // 25 signalements par page chargee, une seule fois par cle identique.
    const dejaSignale = new Set<string>();
    const probleme = (cat: string, nom: string, props: Evt = {}, chemin: string = location.pathname) => {
      const cle = `${cat}|${nom}|${chemin}`;
      if (dejaSignale.has(cle) || dejaSignale.size >= 25) return;
      dejaSignale.add(cle);
      pousse({ type: "erreur", nom: nom.slice(0, 160), chemin, props: { cat, ...props } });
    };
    // Erreurs React minifiees regroupees par code (#418, #423...) ;
    // 418, 419, 423 et 425 sont des erreurs d hydratation.
    const classeErreur = (msg: string): [string, string] => {
      const m = msg.match(/Minified React error #(\d+)/) ?? msg.match(/react\.dev\/errors\/(\d+)/);
      if (m) return [["418", "419", "423", "425"].includes(m[1]) ? "hydratation" : "js", `React #${m[1]}`];
      if (/hydrat/i.test(msg)) return ["hydratation", msg];
      return ["js", msg];
    };
    const surErreur = (ev: ErrorEvent) => {
      const [cat, nom] = classeErreur(ev.message || String(ev.error ?? "erreur"));
      probleme(cat, nom, { source: (ev.filename || "").slice(0, 200), ligne: ev.lineno });
    };
    const surRejet = (ev: PromiseRejectionEvent) => {
      const r = ev.reason as { message?: string } | string | null;
      const [cat, nom] = classeErreur(typeof r === "string" ? r : r?.message ?? "promesse rejetee");
      probleme(cat, nom);
    };
    // Images et logos casses (l evenement « error » d une image ne remonte
    // qu en phase de capture).
    const surRessource = (ev: Event) => {
      const el = ev.target as HTMLElement | null;
      if (el && el.tagName === "IMG") {
        const src = ((el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src || "").split("?")[0];
        probleme("image", src.replace(location.origin, "").slice(0, 160) || "image");
      }
    };
    // Page 404 ou 5xx servie : statut HTTP de la navigation si le navigateur
    // le donne, sinon le marqueur pose par not-found.tsx et error.tsx.
    const controlePage = () => {
      let statut = 0;
      try { statut = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming & { responseStatus?: number })?.responseStatus ?? 0; } catch { /* ancien navigateur */ }
      const marque = document.querySelector("[data-mtk-statut]")?.getAttribute("data-mtk-statut");
      if (marque === "404" || statut === 404) probleme("http404", location.pathname);
      else if (marque === "5xx" || statut >= 500) probleme("http5xx", location.pathname, { statut });
    };
    // Requetes en echec : API du site et authentification Supabase (inscription,
    // connexion). Les echecs des formulaires (contact, inscription, paiement,
    // support) sont classes a part.
    const fetchOrigine = window.fetch;
    const FORMULAIRES = /\/api\/(contact|support|billing|checkout|referrals)|\/auth\/v1\/(signup|token|otp|recover)/;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const u = typeof args[0] === "string" ? args[0] : args[0] instanceof URL ? args[0].href : (args[0] as Request).url;
      const suivi = !!u && !u.includes("/api/telemetrie") && (u.includes("/api/") || u.includes("/auth/v1/"));
      const chemin = suivi ? u.replace(/^https?:\/\/[^/]+/, "").split("?")[0].slice(0, 120) : "";
      try {
        const r = await fetchOrigine(...args);
        if (suivi && (r.status >= 500 || (r.status >= 400 && r.status !== 401 && r.status !== 404) || (FORMULAIRES.test(chemin) && r.status >= 400))) {
          probleme(FORMULAIRES.test(chemin) ? "formulaire" : "fetch", `${chemin} ${r.status}`);
        }
        return r;
      } catch (e) {
        if (suivi && !(e instanceof DOMException && e.name === "AbortError")) probleme(FORMULAIRES.test(chemin) ? "formulaire" : "fetch", `${chemin} reseau`);
        throw e;
      }
    };
    // Formulaire envoye puis message d erreur affiche (role="alert" ou champ
    // invalide) dans les 6 s.
    const surEnvoi = (ev: Event) => {
      const f = ev.target as HTMLFormElement | null;
      const nomForm = (f?.getAttribute("data-track") || f?.getAttribute("aria-label") || f?.id || f?.getAttribute("action") || "formulaire").slice(0, 60);
      window.setTimeout(() => {
        const alerte = document.querySelector('[role="alert"]:not(:empty), [aria-invalid="true"]');
        if (alerte) probleme("formulaire", `${nomForm} : ${(alerte.textContent || "champ invalide").trim().slice(0, 100)}`);
      }, 6000);
    };
    // Captcha : le composant Turnstile emet « mtk:probleme » en cas d echec.
    const surProbleme = (ev: Event) => {
      const d = (ev as CustomEvent).detail as { cat?: unknown; nom?: unknown } | null;
      if (d && typeof d.cat === "string" && typeof d.nom === "string") probleme(d.cat.slice(0, 20), d.nom);
    };
    // Clics de rage (3 clics en 1 s a moins de 30 px) et clics morts (bouton
    // ou lien sans aucun effet visible dans la seconde : ni changement de page
    // ni modification de la page).
    let mutations = 0;
    const obsDom = typeof MutationObserver !== "undefined" ? new MutationObserver(() => { mutations++; }) : null;
    obsDom?.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
    const derniersClics: Array<{ t: number; x: number; y: number }> = [];
    const libelle = (el: Element | null) => (el?.getAttribute("data-track") || el?.getAttribute("aria-label") || el?.textContent?.trim().slice(0, 60) || el?.tagName.toLowerCase() || "?");
    const surClicProbleme = (ev: MouseEvent) => {
      const t = performance.now();
      derniersClics.push({ t, x: ev.clientX, y: ev.clientY });
      while (derniersClics.length && t - derniersClics[0].t > 1000) derniersClics.shift();
      const proches = derniersClics.filter((c) => Math.abs(c.x - ev.clientX) < 30 && Math.abs(c.y - ev.clientY) < 30);
      const cible = (ev.target as HTMLElement)?.closest?.("a, button, [role=button]") ?? (ev.target as Element | null);
      if (proches.length >= 3) { probleme("rage", libelle(cible)); derniersClics.length = 0; }
      const interactif = (ev.target as HTMLElement)?.closest?.("a[href], button, [role=button]");
      if (interactif && !(interactif as HTMLButtonElement).disabled && interactif.getAttribute("target") !== "_blank" && !interactif.hasAttribute("download")) {
        const avant = mutations, url = location.href;
        window.setTimeout(() => { if (mutations === avant && location.href === url) probleme("mort", libelle(interactif)); }, 1000);
      }
    };
    // Fiche societe : blocs « Disponible bientot » et ecran blanc apres 5 s.
    const controleContenu = () => {
      const texte = document.body?.innerText ?? "";
      if (texte.trim().length < 20) probleme("ecran_blanc", location.pathname);
      const bientot = (texte.match(/Disponible bientôt/g) ?? []).length;
      if (bientot) probleme("bientot", location.pathname, { blocs: bientot });
    };
    let minuterieContenu = window.setTimeout(controleContenu, 5000);
    window.setTimeout(controlePage, 1500);
    // Pages lentes : LCP, INP (approche : plus longue interaction), CLS.
    let lcp = 0, inp = 0, cls = 0;
    const obsVitaux: PerformanceObserver[] = [];
    const observe = (type: string, cb: (e: PerformanceEntry) => void, extra: Record<string, unknown> = {}) => {
      try { const o = new PerformanceObserver((l) => l.getEntries().forEach(cb)); o.observe({ type, buffered: true, ...extra } as PerformanceObserverInit); obsVitaux.push(o); } catch { /* non supporte */ }
    };
    observe("largest-contentful-paint", (e) => { lcp = Math.max(lcp, e.startTime); });
    observe("event", (e) => { inp = Math.max(inp, e.duration); }, { durationThreshold: 40 });
    observe("layout-shift", (e) => { const l = e as PerformanceEntry & { value: number; hadRecentInput: boolean }; if (!l.hadRecentInput) cls += l.value; });
    let vitauxEnvoyes = false;
    const envoieVitaux = () => {
      if (vitauxEnvoyes || (!lcp && !inp && !cls)) return;
      vitauxEnvoyes = true;
      pousse({ type: "perf", nom: "vitaux", chemin: cheminCourant, props: { lcp_ms: Math.round(lcp), inp_ms: Math.round(inp), cls: Math.round(cls * 1000) / 1000 } });
      const lents: string[] = [];
      if (lcp > 4000) lents.push(`LCP ${(lcp / 1000).toFixed(1)} s`);
      if (inp > 500) lents.push(`INP ${Math.round(inp)} ms`);
      if (cls > 0.25) lents.push(`CLS ${cls.toFixed(2)}`);
      if (lents.length) probleme("lent", lents.join(", "), {}, cheminCourant);
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

    // ---- evenements nommes (Yann 13 oct 2026) ----
    // Un composant emet `window.dispatchEvent(new CustomEvent("mtk:track",
    // { detail: { type, nom, props } }))` (ex. « KPI ouvert » sur une fiche).
    // Memes regles que le reste : meme lot, meme table, memes exclusions a
    // l ingestion ; types limites a ceux que le serveur accepte.
    const surTrack = (ev: Event) => {
      const d = (ev as CustomEvent).detail as { type?: unknown; nom?: unknown; props?: unknown } | null;
      if (!d || d.type !== "clic" || typeof d.nom !== "string") return;
      const props = d.props && typeof d.props === "object" && !Array.isArray(d.props) ? (d.props as Evt) : {};
      pousse({ type: "clic", nom: d.nom.slice(0, 80), props });
    };

    const minuterie = window.setInterval(expedie, 12_000);
    // Yann 13 oct 2026 (duree faussee) : a l arriere-plan, la vue en cours est
    // close et expediee ; au retour, le chrono et le scroll repartent de zero.
    // Avant, `debut` n etait pas remis a zero : la vue suivante comptait aussi
    // tout le temps passe onglet cache, et la meme duree une seconde fois.
    const surCache = () => {
      if (document.visibilityState === "hidden") { envoieVitaux(); finDePage(); expedie(); }
      else { debut = performance.now(); scrollMax = 0; }
    };

    window.addEventListener("scroll", surScroll, { passive: true });
    document.addEventListener("click", surClic, { capture: true, passive: true });
    window.addEventListener("error", surErreur);
    window.addEventListener("unhandledrejection", surRejet);
    window.addEventListener("error", surRessource, true);
    document.addEventListener("submit", surEnvoi, true);
    document.addEventListener("click", surClicProbleme, { capture: true, passive: true });
    window.addEventListener("mtk:probleme", surProbleme);
    document.addEventListener("visibilitychange", surCache);
    window.addEventListener("mtk:track", surTrack);

    return () => {
      vivant = false;
      window.clearInterval(minuterie);
      window.clearInterval(minuterieNav);
      obs?.disconnect();
      window.removeEventListener("scroll", surScroll);
      document.removeEventListener("click", surClic, { capture: true } as EventListenerOptions);
      window.removeEventListener("error", surErreur);
      window.removeEventListener("unhandledrejection", surRejet);
      window.removeEventListener("error", surRessource, true);
      document.removeEventListener("submit", surEnvoi, true);
      document.removeEventListener("click", surClicProbleme, { capture: true } as EventListenerOptions);
      window.removeEventListener("mtk:probleme", surProbleme);
      window.clearTimeout(minuterieContenu);
      obsDom?.disconnect();
      obsVitaux.forEach((o) => o.disconnect());
      window.fetch = fetchOrigine;
      window.removeEventListener("mtk:track", surTrack);
    };
  }, []);

  return null;
}
