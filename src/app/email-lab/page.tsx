import { EmailLabClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Email Lab · Mettrik",
};

export default function EmailLabPage() {
  return <EmailLabClient />;
}
