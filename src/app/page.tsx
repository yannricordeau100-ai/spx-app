import { Suspense } from "react";
import { redirect } from "next/navigation";
import { HomeView } from "@/components/home-view";
import { AuthNav } from "@/components/auth-nav";
import { AuthModal } from "@/components/auth-modal";
import { AuthRequiredBanner } from "@/components/auth-required-banner";
import { ThemeToggle } from "@/components/theme-toggle";
import { DisclaimerFooter } from "@/components/legal/disclaimer-footer";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function safeNextParam(raw: string | string[] | undefined): string | null {
  if (typeof raw !== "string" || !raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    auth?: string;
    next?: string;
    error?: string;
    info?: string;
  }>;
}) {
  const sp = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Cas anti-flash : un user déjà connecté qui atterrit sur la home avec
  // un `?auth=signin&next=/foo` ou `?next=/foo` résiduel (proxy redirect
  // alors que la session venait d'être restaurée, lien partagé, etc.).
  // On ne lui colle pas la modal en pleine face : on l'envoie directement
  // sur la cible.
  const wantsAuth =
    sp.auth === "signin" || sp.auth === "signup" || sp.auth === "reset";
  if (user && (wantsAuth || sp.next)) {
    const next = safeNextParam(sp.next) ?? "/";
    redirect(next);
  }

  return (
    <>
      <div className="fixed right-4 top-4 z-50 flex items-center gap-3 sm:right-6 sm:top-6">
        <ThemeToggle />
        <AuthNav />
      </div>
      <HomeView />
      {!user && (
        <Suspense fallback={null}>
          <AuthRequiredBanner />
          <AuthModal />
        </Suspense>
      )}
      <DisclaimerFooter />
    </>
  );
}
