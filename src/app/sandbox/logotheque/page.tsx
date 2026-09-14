/**
 * /sandbox/logotheque — images de marque fournies par Yann (avec tous leurs
 * usages produit et hors site), affectation du logo par emplacement, et
 * gestion croix / suppression multiple (Yann 31 août 2026, refonte 2 sept).
 * Onglet MarketBeat ajouté le 14 sept 2026 (logos de toutes les sociétés).
 */
import {
  chargeMasquesLogotheque,
  chargeReglagesLogotheque,
} from "@/lib/desk/logotheque-store";
import universJson from "@/data/v1-9-5-clean-all-tickers.json";
import nomsJson from "@/data/v1-9-5-names.json";
import logosMarketBeatJson from "@/data/logos-marketbeat.json";
import { LogothequeClient } from "./client";
import type { LigneMarketBeat } from "./marketbeat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Logothèque · Sandbox Mettrik" };

type FicheMarketBeat = {
  url?: string;
  fichier?: string;
  nom?: string;
  nom_marketbeat?: string;
  ok?: boolean;
  verifie_nom?: boolean;
  remplace?: boolean;
  erreur?: string;
  image_suspecte?: boolean;
};

const SUFFIXES_NON_US = new Set([
  "PA", "DE", "AS", "SW", "L", "MI", "MC", "BR", "ST", "CO", "HE", "LS",
  "VI", "OL", "IR", "T", "HK", "KS",
]);

function safeTicker(t: string) {
  return t.toUpperCase().replace(/\./g, "-");
}

function lignesMarketBeat(): LigneMarketBeat[] {
  const tickers = (universJson as { tickers: string[] }).tickers;
  const noms = nomsJson as Record<string, string>;
  const fiches = (logosMarketBeatJson as { par_ticker?: Record<string, FicheMarketBeat> })
    .par_ticker ?? {};
  return tickers.map((ticker) => {
    const f = fiches[ticker] ?? {};
    const suffixe = ticker.includes(".") ? ticker.split(".").pop()!.toUpperCase() : "";
    return {
      ticker,
      safe: safeTicker(ticker),
      nom: noms[ticker] ?? f.nom ?? ticker,
      nonUs: SUFFIXES_NON_US.has(suffixe),
      recupere: Boolean(f.ok),
      fichier: f.fichier ?? "",
      nomMarketBeat: f.nom_marketbeat ?? "",
      remplace: Boolean(f.remplace),
      aVerifier: Boolean(f.image_suspecte),
      erreur: f.erreur ?? "",
    };
  });
}

export default async function Page() {
  const [reglages, masques] = await Promise.all([
    chargeReglagesLogotheque(),
    chargeMasquesLogotheque(),
  ]);
  return (
    <LogothequeClient
      initial={reglages}
      masquesInitial={masques}
      lignesMarketBeat={lignesMarketBeat()}
    />
  );
}
