import type { Metadata } from "next";
import LogosClient from "./client";

export const metadata: Metadata = {
  title: "Concepts · Logos Mettrik AI",
  description:
    "Exploration logos : 7 protos horizontal + carré (favicon / avatar), dark + light.",
};

export default function Page() {
  return <LogosClient />;
}
