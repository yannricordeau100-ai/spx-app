import { promises as fs } from "fs";
import path from "path";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { HomeView } from "@/components/home-view";
import { AuthNav } from "@/components/auth-nav";
import { AuthModal } from "@/components/auth-modal";
import { AuthRequiredBanner } from "@/components/auth-required-banner";
import { ThemeToggle } from "@/components/theme-toggle";
import { DisclaimerFooter } from "@/components/legal/disclaimer-footer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Sur staging (`VERCEL_GIT_COMMIT_REF=staging`) ou en preview branch staging,
 * la home `/` affiche directement le hub V1.7 (1607 stés) au lieu de la
 * home V1 (5 stés). En prod, comportement V1 inchangé.
 *
 * Source : `src/data/v2-pipeline/_merged.json` filtré sur `_validation*`
 * + `kpis.length > 0` (cf. /sandbox/v1-7/page.tsx).
 */
const IS_STAGING =
  process.env.VERCEL_GIT_COMMIT_REF === "staging" ||
  process.env.NEXT_PUBLIC_DEPLOY_TARGET === "staging";

async function loadV17(): Promise<Record<string, Company>> {
  const dir = path.join(process.cwd(), "src/data/v2-pipeline");
  try {
    const merged = await fs.readFile(path.join(dir, "_merged.json"), "utf-8");
    const all = JSON.parse(merged) as Record<
      string,
      Company & { _validation?: unknown; _validation_global?: unknown }
    >;
    const out: Record<string, Company> = {};
    for (const [t, v] of Object.entries(all)) {
      if (
        v &&
        typeof v === "object" &&
        (v._validation || v._validation_global) &&
        Array.isArray(v.kpis) &&
        v.kpis.length > 0
      ) {
        out[t] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

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

  // Staging : home = V1.7 hub (1607 stés validées), href -> /sandbox/v1-7/<t>.
  // Prod : home = V1 (5 stés), href -> /<t>.
  let v17Datasets: Record<string, Company> | null = null;
  let v17Tickers: string[] | null = null;
  if (IS_STAGING) {
    v17Datasets = await loadV17();
    v17Tickers = Object.keys(v17Datasets).sort();
  }

  return (
    <>
      <div className="fixed right-4 top-4 z-50 flex items-center gap-3 sm:right-6 sm:top-6">
        <ThemeToggle />
        <AuthNav />
      </div>
      {IS_STAGING && v17Datasets && v17Tickers ? (
        <HomeView
          companies={v17Datasets}
          tickers={v17Tickers}
          hrefBuilder={(t) => `/sandbox/v1-7/${t.toLowerCase()}`}
        />
      ) : (
        <HomeView />
      )}
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
