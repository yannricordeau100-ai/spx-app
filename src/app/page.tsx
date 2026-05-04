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
// Import JSON direct : 16MB bundlé dans la fonction serverless (vs
// fs.readFile qui rate l'output-file-tracing pour ce gros fichier).
import V17_MERGED from "@/data/v2-pipeline/_merged.json";

export const dynamic = "force-dynamic";

/**
 * Sur staging (`VERCEL_GIT_COMMIT_REF=staging`), la home `/` affiche
 * le hub V1.7 (stés Pass 3 validées) au lieu de la home V1 (5 stés).
 * En prod, comportement V1 inchangé.
 */
const IS_STAGING =
  process.env.VERCEL_GIT_COMMIT_REF === "staging" ||
  process.env.NEXT_PUBLIC_DEPLOY_TARGET === "staging";

function loadV17(): Record<string, Company> {
  const all = V17_MERGED as unknown as Record<
    string,
    Company & { _validation?: unknown; _validation_global?: unknown }
  >;
  const out: Record<string, Company> = {};
  for (const [t, v] of Object.entries(all)) {
    if (!v || typeof v !== "object") continue;
    if (!v._validation && !v._validation_global) continue;
    if (!Array.isArray(v.kpis) || v.kpis.length === 0) continue;
    // Vérifie que le hero est utilisable côté HomeView : tous les champs
    // string requis doivent être présents (rate(), parsePct(), formatUnit()
    // crashent sur undefined). Sinon skip.
    const hero =
      v.kpis.find((k) => k && k.short === v.hero_kpi) ?? v.kpis[0];
    if (
      !hero ||
      typeof hero.value !== "string" ||
      typeof hero.yoy !== "string" ||
      typeof hero.type !== "string" ||
      typeof hero.unit !== "string" ||
      typeof hero.short !== "string"
    )
      continue;
    out[t] = v;
  }
  return out;
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
    v17Datasets = loadV17();
    // Cap temporaire à 30 pour isoler une éventuelle sté qui crashe.
    v17Tickers = Object.keys(v17Datasets).sort().slice(0, 30);
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
