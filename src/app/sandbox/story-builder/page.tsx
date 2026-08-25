import { requireDeskOwner } from "@/lib/desk/auth";
import { listStoryKpis } from "@/lib/desk/story-kpis";
import { StoryBuilderClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "KPI story · Mettrik (sandbox)",
  robots: { index: false, follow: false },
};

export default async function StoryBuilderPage() {
  await requireDeskOwner();
  const rows = await listStoryKpis();
  return <StoryBuilderClient initialRows={rows} />;
}
