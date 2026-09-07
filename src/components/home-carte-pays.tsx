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
import ZONES_KPIS from "@/data/carte-pays-kpis.json";

export function HomeCartePays({
  locale,
  routePrefix,
  requireSignupGate = false,
  gatePath = "/",
}: {
  locale: string;
  routePrefix?: string;
  requireSignupGate?: boolean;
  gatePath?: string;
}) {
  const zones = (ZONES_KPIS as { zones: Record<string, SteWow[]> }).zones;
  const [activeTab, setActiveTab] = useState<string>(() => (zones[locale]?.length ? locale : "world"));
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [montrePlus, setMontrePlus] = useState(false);
  const hoverTimer = useRef<number | null>(null);

  const labels = locale === "fr" ? TAB_LABELS_FR : TAB_LABELS_EN;
  const isFr = locale === "fr";

  const rows = useMemo<SteWow[]>(() => (zones[activeTab] ?? []).slice(0, 20), [zones, activeTab]);

  const handleEnter = useCallback((key: string) => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHoveredTab(key), 220);
  }, []);
  const handleLeave = useCallback(() => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    setHoveredTab(null);
  }, []);

  if (rows.length === 0) return null;

  const buildCompanyHref = (ticker: string): string =>
    routePrefix ? `${routePrefix}/${ticker.toLowerCase()}` : `/${ticker.toLowerCase()}`;

  const visibles = rows.slice(0, montrePlus ? 20 : 10);
  const resteACharger = !montrePlus && rows.length > 10;

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
        tabs={TABS.filter((tb) => (zones[tb.key]?.length ?? 0) >= 3)}
        labels={labels}
        activeTab={activeTab}
        hoveredTab={hoveredTab}
        data={zones as unknown as PopularData}
        onPick={(k) => {
          setActiveTab(k);
          setMontrePlus(false);
        }}
        onEnter={handleEnter}
        onLeave={handleLeave}
        buildHref={buildCompanyHref}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visibles.map((s) => wrapGate(s.ticker, <CarteSteWow s={s} buildHref={buildCompanyHref} />))}
      </div>
      {resteACharger && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setMontrePlus(true)}
            className="rounded-lg border border-violet-500/30 bg-violet-500/[0.06] px-3.5 py-2 text-[12.5px] font-medium text-violet-100 transition-all hover:bg-violet-500/15"
          >
            {isFr ? "Montre-moi les 10 suivants" : "Show me the next 10"}
          </button>
        </div>
      )}
    </div>
  );
}
