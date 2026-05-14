import BREAKDOWN from "@/data/top307-breakdown.json";
import { Top307Client } from "./client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Top 307 breakdown · Mettrik AI",
  robots: { index: false, follow: false },
};

export type Top307Row = {
  ticker: string;
  name: string;
  country: string;
  market_cap: number;
  market_cap_usd: number;
  market_cap_currency: string;
  sector: string;
  rank_world: number;
  rank_us?: number;
  rank_fr?: number;
  rank_ch?: number;
  rank_de?: number;
};

export default function Top307Page() {
  return <Top307Client rows={(BREAKDOWN as unknown as Top307Row[])} />;
}
