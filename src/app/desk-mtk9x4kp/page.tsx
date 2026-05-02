import { requireDeskOwner } from "@/lib/desk/auth";
import { DeskClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Desk · Mettrik (interne)",
  robots: { index: false, follow: false },
};

export default async function DeskPage() {
  const { email } = await requireDeskOwner();
  return <DeskClient ownerEmail={email} />;
}
