import { requireDeskOwner } from "@/lib/desk/auth";
import { listBugs } from "@/lib/desk/bugs";
import { BugsClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Bug tracker · Mettrik (interne)",
  robots: { index: false, follow: false },
};

export default async function BugsAdminPage() {
  await requireDeskOwner();
  const bugs = await listBugs();
  return <BugsClient initialBugs={bugs} />;
}
