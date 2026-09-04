import { redirect } from "next/navigation";

/** Yann 5 sept 2026 : l atelier GICS vit dans la sandbox (/sandbox/gics). */
export default function GicsRedirect() {
  redirect("/sandbox/gics");
}
