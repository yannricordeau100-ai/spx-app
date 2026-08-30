import { requireDeskOwner } from "@/lib/desk/auth";
import { BlocksControlClient } from "./client";
import { getGlobalToggles, getPerTickerOverrides } from "@/lib/v1-9-blocks-control";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Blocks Control · V1.9.5 · Desk · Mettrik AI",
  robots: { index: false, follow: false },
};

export default async function BlocksControlPage() {
  await requireDeskOwner();
  const globals = getGlobalToggles();
  const perTicker = getPerTickerOverrides();
  return <BlocksControlClient initialGlobals={globals} initialPerTicker={perTicker} />;
}
