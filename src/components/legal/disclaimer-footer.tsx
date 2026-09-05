import Link from "next/link";
import { VERSION } from "@/lib/version";
import { LocaleFlagsRow } from "@/components/locale-flags-row";

/**
 * Footer global avec :
 *   1. Disclaimer financier (obligatoire AMF / FINMA-friendly)
 *   2. Liens vers les pages légales
 *   3. Branding Mettrik AI
 *
 * À ajouter en bas de chaque page publique de l'app (home, page société,
 * /account, etc.).
 *
 * Texte du disclaimer validé pour les juridictions FR + CH (générique).
 */
export function DisclaimerFooter({ variant = "full" }: { variant?: "full" | "compact" }) {
  if (variant === "compact") {
    return (
      <footer className="border-t border-[#1a1a1a] bg-[#070707] px-4 py-5 text-center text-[11px] text-zinc-500 sm:px-6">
        <p className="mx-auto max-w-2xl">
          Le contenu de Mettrik AI est fourni à titre informatif uniquement et ne constitue pas un conseil
          en investissement.
        </p>
        <div className="mt-2 inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
          <Link href="/legal/mentions" className="hover:text-zinc-300">Mentions légales</Link>
          <Link href="/legal/conditions" className="hover:text-zinc-300">Conditions générales</Link>
          <Link href="/legal/confidentialite" className="hover:text-zinc-300">Confidentialité</Link>
          <Link href="/faq" className="hover:text-zinc-300">FAQ</Link>
          <span>· © {new Date().getFullYear()} Mettrik AI</span>
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-16 border-t border-[#1a1a1a] bg-[#070707] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-8 md:grid-cols-[2fr_1fr_1fr]">
          {/* Brand + disclaimer */}
          <div>
            <div className="font-display text-[18px] font-bold tracking-tight text-zinc-100">Mettrik AI</div>
            <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-500">
              KPI Intelligence pour investisseurs
            </div>
            <p className="mt-4 max-w-md text-[12.5px] leading-relaxed text-zinc-400">
              Le contenu de Mettrik AI est fourni <strong>à titre informatif uniquement</strong> et ne constitue pas
              un conseil en investissement, ni une recommandation d&apos;achat ou de vente d&apos;instruments
              financiers. Les performances passées ne préjugent pas des performances futures. Tout investissement
              comporte des risques, y compris la perte totale du capital investi.
            </p>
          </div>

          {/* Légal */}
          <div>
            <div className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-500">Légal</div>
            <ul className="space-y-1.5 text-[12.5px]">
              <li><Link href="/legal/mentions" className="text-zinc-300 hover:text-zinc-100">Mentions légales</Link></li>
              <li><Link href="/legal/conditions" className="text-zinc-300 hover:text-zinc-100">Conditions générales</Link></li>
              <li><Link href="/legal/confidentialite" className="text-zinc-300 hover:text-zinc-100">Confidentialité</Link></li>
            </ul>
          </div>

          {/* Contact + Engagement */}
          <div>
            <div className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-500">Communauté</div>
            <ul className="space-y-1.5 text-[12.5px]">
              <li><Link href="/faq" className="text-zinc-300 hover:text-zinc-100">Questions fréquentes</Link></li>
              <li><Link href="/contact" className="text-zinc-300 hover:text-zinc-100">Contact</Link></li>
              <li><Link href="/pricing" className="text-zinc-300 hover:text-zinc-100">Tarifs</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-baseline gap-3 border-t border-[#1a1a1a] pt-5 text-[11px] text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Mettrik AI · Tous droits réservés. · <span className="font-mono text-[10.5px] text-zinc-600">v{VERSION}</span></span>
          <LocaleFlagsRow align="center" />
          <span className="font-mono">www.mettrik.ai</span>
        </div>
      </div>
    </footer>
  );
}
