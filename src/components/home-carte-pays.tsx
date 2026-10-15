"use client";

/**
 * Carte des pays de l accueil (Yann 07 sept 2026, point 9, revu le soir).
 *
 * Placement : sous la mention « KPI = INDICATEUR », au-dessus des mini-blocs
 * de societes. Au clic sur une zone : les plus grandes capitalisations du
 * pays, rendues avec LES MEMES mini-blocs 3-KPI que la grille d accueil
 * (memes filtres et restrictions de choix de KPI : scripts/build-home-wow.py,
 * fichier src/data/carte-pays-kpis.json). 10 d un coup, puis un bouton
 * « Montre-moi les 10 suivants » une seule fois (20 par pays au maximum).
 */
import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import {
  ConstellationZones,
  TABS,
  TAB_LABELS_FR,
  TAB_LABELS_EN,
  type PopularData,
} from "@/components/home-popular-block";
import { CarteSteWow, type SteWow } from "@/components/home-wow-grid";
import { SignupGateOverlay } from "@/components/signup-gate-overlay";

export function HomeCartePays({
  locale,
  routePrefix,
  anonLinks = false,
  kpisPerso,
  requireSignupGate = false,
  gatePath = "/",
  zones,
}: {
  /** Yann 13 oct 2026 : cartes fournies par le serveur, societes « visibles en
   *  gratuit » seulement (src/lib/accueil-vitrine.ts). Plus aucune valeur de KPI
   *  d une autre societe dans la page ni dans le code envoye au navigateur. */
  zones: Record<string, SteWow[]>;
  locale: string;
  routePrefix?: string;
  /** Yann 15 sept 2026 : visiteur anonyme, chaque lien de fiche pointe vers l inscription gratuite. */
  anonLinks?: boolean;
  kpisPerso?: Record<string, { nom: string; valeur: string; unite: string; yoy: string | null; periode: string | null }[]>;
  requireSignupGate?: boolean;
  gatePath?: string;
}) {
  // Yann 16 sept 2026 : la zone Monde est affichee par defaut (Google y figure).
  const [activeTab, setActiveTab] = useState<string>(() => (zones.world?.length ? "world" : zones[locale]?.length ? locale : "world"));
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  // Yann 30 sept 2026 : vitrine ouverte aux anonymes = liste « 100 % visibles en gratuit » (base).
  const hoverTimer = useRef<number | null>(null);

  const labels = locale === "fr" ? TAB_LABELS_FR : TAB_LABELS_EN;
  const isFr = locale === "fr";

  const rows = useMemo<SteWow[]>(
    () =>
      (zones[activeTab] ?? []).slice(0, 20).map((s) =>
        kpisPerso?.[s.ticker.toUpperCase()]?.length ? ({ ...s, kpis: kpisPerso[s.ticker.toUpperCase()] } as unknown as SteWow) : s,
      ),
    [zones, activeTab, kpisPerso],
  );

  const handleEnter = useCallback((key: string) => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHoveredTab(key), 220);
  }, []);
  const handleLeave = useCallback(() => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    setHoveredTab(null);
  }, []);

  if (rows.length === 0) return null;

  const buildCompanyHref = (ticker: string): string => {
    const base = routePrefix ? `${routePrefix}/${ticker.toLowerCase()}` : `/${ticker.toLowerCase()}`;
    // 15 oct 2026 : anonyme = inscription sur toute carte ; connecte = fiche (floutage habituel de la fiche).
    return anonLinks ? `/?auth=signup&next=${encodeURIComponent(base)}` : base;
  };

  // Yann 07 sept 2026 : exactement 10 sociétés (2 colonnes de 5), pas de bouton.
  const visibles = rows.slice(0, 10);

  const wrapGate = (key: string, child: React.ReactNode) =>
    requireSignupGate ? (
      <SignupGateOverlay key={key} enabled={requireSignupGate} gatePath={gatePath} initialAuthed={!requireSignupGate}>
        {child}
      </SignupGateOverlay>
    ) : (
      <Fragment key={key}>{child}</Fragment>
    );

  return (
    <div className="mb-8">
      <ConstellationZones
        tabs={TABS.filter((tb) => (zones[tb.key]?.length ?? 0) >= 1)}
        labels={labels}
        activeTab={activeTab}
        hoveredTab={hoveredTab}
        data={zones as unknown as PopularData}
        onPick={(k) => setActiveTab(k)}
        onEnter={handleEnter}
        onLeave={handleLeave}
        buildHref={buildCompanyHref}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visibles.map((s) => wrapGate(s.ticker, <CarteSteWow s={s} buildHref={buildCompanyHref} />))}
      </div>

    </div>
  );
}
