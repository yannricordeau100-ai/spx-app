import type { Metadata } from "next";
import DATA from "@/data/hors-indices-kpis.json";
import { HorsIndicesClient } from "./client";

export const metadata: Metadata = { title: "Hors indices · Sandbox · Mettrik" };

export default function Page() {
  return <HorsIndicesClient data={DATA.societes} />;
}
