import { QualityTreeClient } from "./client";
import { QUALITY_TREE } from "@/lib/quality-tree";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quality Tree · Mettrik AI",
  robots: { index: false, follow: false },
};

export default async function QualityTreePage() {
  return <QualityTreeClient tree={QUALITY_TREE} />;
}
