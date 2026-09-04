import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireDeskOwner } from "@/lib/desk/auth";
import { TabGics } from "@/components/desk/tab-gics";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Taxonomie GICS · Mettrik (interne)",
  robots: { index: false, follow: false },
};

/**
 * Yann 5 sept 2026 : la taxonomie GICS sort du desk pour devenir un outil a
 * part, avec sa propre adresse. Etape 1 d un chantier plus large : par
 * categorie (secteur, groupe, industrie, sous-industrie), retrouver les
 * types de KPI parfaits et les implementer sans donnees, puis relier les
 * recherches (Claude) aux societes de chaque categorie.
 */
export default async function GicsPage() {
  await requireDeskOwner();
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/desk-mtk9x4kp" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100">
          <ArrowLeft className="size-4" />
          Desk
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Outil interne</span>
      </nav>
      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <h1 className="font-display text-[26px] font-bold tracking-tight">Taxonomie GICS</h1>
        <p className="mt-1 text-[13px] text-zinc-400">
          11 secteurs, 25 groupes, 74 industries, 163 sous-industries. Base du chantier « KPI par catégorie ».
        </p>
        <div className="mt-6">
          <TabGics />
        </div>
      </main>
    </div>
  );
}
