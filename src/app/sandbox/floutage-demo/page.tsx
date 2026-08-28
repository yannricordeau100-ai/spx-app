import type { Metadata } from "next";
import { FloutageDemoClient } from "./client";

export const metadata: Metadata = {
  title: "Démo floutage par zones · Sandbox · Mettrik",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <FloutageDemoClient />;
}
