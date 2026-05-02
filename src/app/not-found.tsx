import Link from "next/link";
import { Home, Search } from "lucide-react";

export const metadata = {
  title: "Page introuvable · Mettrik AI",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col bg-[#050505] text-zinc-100">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[600px]"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(167,139,250,0.18), transparent 60%)",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <div className="font-display text-[120px] font-bold leading-none tracking-tighter sm:text-[160px]"
          style={{
            backgroundImage: "linear-gradient(135deg, #fafafa 0%, #a78bfa 50%, #22d3ee 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}>
          404
        </div>
        <h1 className="mt-4 font-display text-[28px] font-bold tracking-tight sm:text-[32px]">
          Page introuvable
        </h1>
        <p className="mt-3 max-w-md text-[14px] leading-relaxed text-zinc-400">
          Cette page n&apos;existe pas ou a été déplacée. Si tu pensais arriver sur une société, vérifie le ticker
          dans l&apos;URL (ex : <code className="rounded bg-white/[0.05] px-1.5 py-0.5 text-zinc-300">/googl</code>).
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-violet-400"
          >
            <Home className="size-4" />
            Retour à l&apos;accueil
          </Link>
          <Link
            href="/?search=1"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.03] px-5 py-2.5 text-[13.5px] font-medium text-zinc-200 transition-colors hover:bg-white/[0.07]"
          >
            <Search className="size-4" />
            Chercher une société
          </Link>
        </div>

        <div className="mt-12 inline-flex items-baseline gap-2 text-[11px] text-zinc-500">
          <span className="size-1.5 rounded-full bg-violet-400/50" />
          <span>Mettrik AI · KPI Intelligence</span>
        </div>
      </div>
    </div>
  );
}
