import Link from "next/link";
import { LocaleFlagsRow } from "@/components/locale-flags-row";
import { SocialLinksRow } from "@/components/social-links-row";

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
/** Rappel unique, visible tout en bas de chaque page. */
function RappelImportant({ compact = false }: { compact?: boolean }) {
  return (
    <p
      className={`mx-auto max-w-3xl text-center leading-relaxed text-zinc-500 ${compact ? "text-[11px]" : "mt-5 border-t border-[#1a1a1a] pt-4 text-[11.5px]"}`}
    >
      <strong className="font-semibold text-zinc-400">Rappel important :</strong> Mettrik AI donne une information
      générale, non personnalisée, qui n&apos;est pas un conseil en investissement. Les données, issues des documents
      officiels des sociétés, peuvent contenir des erreurs ou des retards. Les performances passées ne préjugent pas
      des performances futures. Tout investissement comporte un risque de perte en capital.
    </p>
  );
}

export function DisclaimerFooter({ variant = "full" }: { variant?: "full" | "compact" }) {
  if (variant === "compact") {
    return (
      <footer className="border-t border-[#1a1a1a] bg-[#070707] px-4 py-5 text-center text-[11px] text-zinc-500 sm:px-6">
        <div className="mt-2 inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
          <Link href="/legal/mentions" className="hover:text-zinc-300">Mentions légales</Link>
          <Link href="/legal/conditions" className="hover:text-zinc-300">Conditions générales</Link>
          <Link href="/legal/confidentialite" className="hover:text-zinc-300">Confidentialité</Link>
          <span>· © {new Date().getFullYear()} Mettrik AI</span>
        </div>
        <div className="mt-3"><RappelImportant compact /></div>
      </footer>
    );
  }

  return (
    <footer className="mt-8 border-t border-[#1a1a1a] bg-[#070707] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-8 md:grid-cols-[2fr_1fr_1fr]">
          {/* Brand + disclaimer */}
          <div>
            <div className="font-display text-[18px] font-bold tracking-tight text-zinc-100">Mettrik AI</div>
            <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-500">
              KPI Intelligence pour investisseurs
            </div>
            <p className="mt-4 max-w-md text-[12.5px] leading-relaxed text-zinc-400">
              <strong>Mettrik AI</strong> est un site d&apos;analyse boursière pour investisseurs particuliers. Il présente,
              pour les grandes sociétés cotées aux États-Unis et en Europe, les indicateurs clés (KPI) qui
              expliquent leurs résultats : chiffres trimestriels et historiques, scores, risques et synthèses des
              conférences de résultats, tirés des documents officiels des sociétés.
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
              <li><Link href="/contact" className="text-zinc-300 hover:text-zinc-100">Contact</Link></li>
              <li><Link href="/pricing" className="text-zinc-300 hover:text-zinc-100">Tarifs</Link></li>
              <li><Link href="/partenaires" className="text-zinc-300 hover:text-zinc-100">Rejoindre Mettrik</Link></li>
            </ul>
            {/* Yann 5 oct 2026 : le bouton X vit dans le pied de page du site, plus dans le corps des fiches. */}
            <div className="mt-4">
              <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-500">Suivre Mettrik AI</div>
              <SocialLinksRow align="left" size="compact" />
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-baseline gap-3 border-t border-[#1a1a1a] pt-5 text-[11px] text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Mettrik AI · Tous droits réservés.</span>
          <LocaleFlagsRow align="center" />
          <span className="font-mono">www.mettrik.ai</span>
        </div>
        <RappelImportant />
      </div>
    </footer>
  );
}
