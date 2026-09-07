"use client";

/**
 * Carte des pays de l accueil (Yann 07 sept 2026, point 9).
 *
 * L ancien bloc « Actions les plus populaires » est archive ; on GARDE sa
 * constellation des zones, placee sous le bloc « Pourquoi utiliser
 * Mettrik AI ? ». Au clic sur une zone : les societes du pays dans le meme
 * style de mini-blocs qu avant, 10 d un coup, puis un bouton « Montre-moi
 * les 10 suivants » une seule fois (20 societes par pays au maximum), tri
 * par capitalisation decroissante (src/data/market-cap-order.json via
 * /api/carte-pays).
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConstellationZones,
  StockRow,
  TABS,
  TAB_LABELS_FR,
  TAB_LABELS_EN,
  type PopularData,
  type PopularRow,
} from "@/components/home-popular-block";
import { SignupGateOverlay } from "@/components/signup-gate-overlay";

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
  const [data, setData] = useState<PopularData | null>(null);
  const [activeTab, setActiveTab] = useState<string>("world");
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const [montrePlus, setMontrePlus] = useState(false);
  const hoverTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await fetch("/api/carte-pays", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as PopularData;
        if (!cancel) setData(j);
      } catch {
        // silencieux
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    const visitorTab = TABS.find((tb) => tb.key === locale)?.key ?? "world";
    setActiveTab(visitorTab);
  }, [locale]);

  // Parcours automatique des zones tant que le visiteur n a rien choisi.
  useEffect(() => {
    if (!data || pinned || hoveredTab) return;
    const cles = TABS.filter((tb) => {
      const zr = data[tb.key];
      return Array.isArray(zr) && zr.length >= 3;
    }).map((tb) => tb.key);
    if (cles.length < 2) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setActiveTab((cur) => cles[(cles.indexOf(cur) + 1) % cles.length]!);
    }, 3500);
    return () => window.clearInterval(id);
  }, [data, pinned, hoveredTab]);

  const labels = locale === "fr" ? TAB_LABELS_FR : TAB_LABELS_EN;
  const isFr = locale === "fr";

  const rows = useMemo<PopularRow[]>(() => {
    if (!data) return [];
    const list = data[activeTab];
    return Array.isArray(list) ? (list as PopularRow[]).slice(0, 20) : [];
  }, [data, activeTab]);

  const handleEnter = useCallback((key: string) => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHoveredTab(key), 220);
  }, []);
  const handleLeave = useCallback(() => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    setHoveredTab(null);
  }, []);

  if (!data || rows.length === 0) return null;

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
    <section className="mx-auto mt-14 max-w-3xl px-4 sm:mt-16 sm:px-0">
      <div className="mb-3 text-center font-mono text-[11px] uppercase tracking-[0.15em] text-zinc-500">
        {isFr ? "Explorer par pays" : "Explore by country"}
      </div>
      <p className="mb-6 text-center text-[13px] leading-relaxed text-zinc-400">
        {isFr
          ? "Cliquez une zone : les plus grandes capitalisations du pays."
          : "Click a region: the largest market caps of that country."}
      </p>
      <ConstellationZones
        tabs={TABS.filter((tb) => {
          const zr = data[tb.key];
          return Array.isArray(zr) && zr.length >= 3;
        })}
        labels={labels}
        activeTab={activeTab}
        hoveredTab={hoveredTab}
        data={data}
        onPick={(k) => {
          setActiveTab(k);
          setPinned(true);
          setMontrePlus(false);
        }}
        onEnter={handleEnter}
        onLeave={handleLeave}
        buildHref={buildCompanyHref}
      />
      <div className="space-y-2">
        {visibles.map((r, i) =>
          wrapGate(r.ticker, <StockRow row={r} rank={i + 1} totalShown={visibles.length} buildHref={buildCompanyHref} />),
        )}
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
    </section>
  );
}
