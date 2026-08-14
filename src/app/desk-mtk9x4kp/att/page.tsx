import { requireDeskOwner } from "@/lib/desk/auth";
import { AttDeskClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ATT · Desk Mettrik (interne)",
  robots: { index: false, follow: false },
};

export default async function AttDeskPage() {
  await requireDeskOwner();
  return <AttDeskClient />;
}
