"use client";

import { useState } from "react";
import { Map, Lock } from "lucide-react";
import { DeskCard, HelpTip, Pill } from "./ui";

/**
 * Roadmap "lancement Mettrik" — items consolidés depuis l'autre conv.
 *
 * Code couleur :
 *   - rouge    : items que je (Yann) ne veux probablement PAS, ou qui ne
 *                s'appliquent pas à mon positionnement. À supprimer après vérif.
 *   - vert     : à faire à coup sûr avant lancement.
 *   - gris     : à décider plus tard.
 *
 * Pour Claude (autre conv) : ne touche pas à cet onglet. C'est mon point de
 * référence pour piloter la roadmap. Les modifications viendront via UI dans
 * le desk (édition inline, à venir si Yann veut).
 */

type Verdict = "yes" | "no" | "maybe";
type Item = {
  id: string;
  title: string;
  category: string;
  verdict: Verdict;
  effort: string;
  why?: string;
  reason_no?: string;     // raison pour laquelle Yann ne veut probablement pas
  mockup_in_concepts?: string; // si un mockup existe dans /concepts
};

const ITEMS: Item[] = [
  // ===== BLOQUANTS =====
  {
    id: "scaleup-content",
    title: "Scale-up contenu (5 → 30-100 sociétés)",
    category: "Bloquant",
    verdict: "maybe",
    effort: "2-3 sem pipeline + flux continu",
    why: "Crédibilité publique : 5 sociétés c'est démo. Mais V1 launch peut se faire à 5 si positionnement clair (« sociétés flagship »).",
  },
  {
    id: "legal-cgu-cgv",
    title: "CGU + CGV France",
    category: "Bloquant",
    verdict: "yes",
    effort: "2-5 jours via Captain Contrat / LegalPlace",
    why: "Obligatoire pour vendre un abonnement en France.",
  },
  {
    id: "legal-privacy-rgpd",
    title: "Politique de confidentialité (RGPD)",
    category: "Bloquant",
    verdict: "yes",
    effort: "1 jour",
  },
  {
    id: "legal-mentions",
    title: "Mentions légales obligatoires",
    category: "Bloquant",
    verdict: "yes",
    effort: "1 jour",
  },
  {
    id: "cookie-banner",
    title: "Cookie banner",
    category: "Bloquant",
    verdict: "maybe",
    effort: "1 jour",
    why: "Inutile si tu utilises uniquement Plausible (privacy-first, sans cookies). Obligatoire si Posthog/GA.",
  },
  {
    id: "amf-disclaimer",
    title: "Disclaimer AMF (« ne constitue pas un conseil en investissement »)",
    category: "Bloquant",
    verdict: "yes",
    effort: "5 min (texte dans le footer)",
    why: "OBLIGATOIRE en France pour ne pas tomber dans le statut CIF (Conseiller en Investissements Financiers, qui exige certif ORIAS). Sans ça = risque juridique sérieux.",
  },
  {
    id: "mobile-qa",
    title: "Vérification mobile complète (3 variantes × 10 sections)",
    category: "Bloquant",
    verdict: "yes",
    effort: "2-4 jours QA",
    why: "Beaucoup de hover-only à adapter en tap.",
  },

  // ===== HAUTEUR baggr / fiscal.ai =====
  {
    id: "screener",
    title: "Screener multi-critères (filtres secteur / scores / risques)",
    category: "Différenciation",
    verdict: "yes",
    effort: "1 sem",
    why: "Au-delà de 30 sociétés, sans screener les users ne trouvent rien.",
    mockup_in_concepts: "Mockup statique disponible dans /concepts → onglet Screener",
  },
  {
    id: "n-vs-n",
    title: "Comparaison N-vs-N (3-5 sociétés en simultané)",
    category: "Différenciation",
    verdict: "yes",
    effort: "3-4 jours",
    why: "Vrai use-case investisseur. Actuellement comparaison 1-vs-1.",
    mockup_in_concepts: "Mockup statique disponible dans /concepts → onglet Comparaison N-vs-N",
  },
  {
    id: "marketing-landing",
    title: "Page d'accueil marketing (proposition de valeur + CTA)",
    category: "Différenciation",
    verdict: "yes",
    effort: "2-3 jours",
    why: "Premier canal d'acquisition. Sans landing claire, conversion proche de zéro.",
    mockup_in_concepts: "Mockup statique disponible dans /concepts → onglet Landing marketing",
  },
  {
    id: "onboarding",
    title: "Onboarding (4 écrans après signup)",
    category: "Différenciation",
    verdict: "yes",
    effort: "1 sem",
    why: "Sans onboarding, les inscriptions ne se convertissent pas.",
    mockup_in_concepts: "Mockup statique disponible dans /concepts → onglet Onboarding",
  },

  // ===== PRODUCTION-READINESS =====
  {
    id: "perf-lighthouse",
    title: "Audit Lighthouse + optimisation",
    category: "Production",
    verdict: "yes",
    effort: "2-3 jours",
    why: "Mobile + desktop, code-splitting des charts, ISR sur pages société.",
  },
  {
    id: "seo-basic",
    title: "SEO basique (sitemap, robots, OG images, JSON-LD)",
    category: "Production",
    verdict: "yes",
    effort: "2 jours",
    why: "Le SEO est ton premier canal d'acquisition gratuit. Critique.",
  },
  {
    id: "monitoring",
    title: "Monitoring (Sentry erreurs + Plausible analytics)",
    category: "Production",
    verdict: "yes",
    effort: "1 jour",
    why: "Sans ça tu navigues à l'aveugle quand un bug en prod casse l'expérience.",
  },
  {
    id: "error-pages",
    title: "Pages d'erreur (404, 500, error boundaries)",
    category: "Production",
    verdict: "yes",
    effort: "0.5 jour",
  },

  // ===== INFRA EMAILS =====
  {
    id: "email-sender",
    title: "Émission emails réelle (Resend / Postmark)",
    category: "Email",
    verdict: "yes",
    effort: "1 sem",
    why: "Templates email-lab existent. Manque sender + préférences user + unsubscribe + scheduler.",
  },

  // ===== DIFFÉRENCIATION FORTE (optionnel) =====
  {
    id: "watchlists-alerts",
    title: "Watchlists + alertes par KPI + digest hebdo",
    category: "Différenciation +",
    verdict: "maybe",
    effort: "1 sem",
    why: "Très haute valeur pour investisseurs actifs. À prioriser après V1 launch selon feedback.",
  },
  {
    id: "glossaire",
    title: "Glossaire / page Méthodologie",
    category: "Différenciation +",
    verdict: "yes",
    effort: "2-3 jours",
    why: "CRUCIAL pour la confiance investisseur. Comment tu scores les risques, calcules le CAGR, etc.",
  },
  {
    id: "sources-public",
    title: "Documentation publique des sources (lien 10-K, date, freshness)",
    category: "Différenciation +",
    verdict: "yes",
    effort: "2 jours",
    why: "Règle freshness existe déjà (FreshnessIndicator), à exposer publiquement.",
  },

  // ===== ÉLÉMENTS QUE TU NE VEUX PROBABLEMENT PAS (à valider) =====
  {
    id: "scaleup-aggressive",
    title: "Scale-up immédiat à 100 sociétés AVANT lancement",
    category: "Bloquant",
    verdict: "no",
    effort: "rejeté",
    reason_no: "Tu peux lancer en V1 (5 sociétés flagship bien polies) + raconter le scale-up V2 dans la roadmap publique. Lance vite, valide marché, scale après.",
  },
  {
    id: "ab-testing",
    title: "A/B testing infrastructure",
    category: "Production",
    verdict: "no",
    effort: "1-2 sem",
    reason_no: "Pas avant d'avoir 1000+ users. Avant ça, l'A/B test n'a pas de signal statistique fiable.",
  },
  {
    id: "support-helpdesk",
    title: "Help center / centre de support",
    category: "Différenciation +",
    verdict: "no",
    effort: "1 sem",
    reason_no: "Email de contact suffit pour V1. Help center se construit progressivement à partir des questions reçues.",
  },
];

const CATEGORIES = ["Bloquant", "Différenciation", "Production", "Email", "Différenciation +"];

export function TabRoadmap() {
  const [filter, setFilter] = useState<"all" | "yes" | "no" | "maybe">("all");

  const filtered = ITEMS.filter((i) => filter === "all" || i.verdict === filter);
  const counts = {
    yes: ITEMS.filter((i) => i.verdict === "yes").length,
    no: ITEMS.filter((i) => i.verdict === "no").length,
    maybe: ITEMS.filter((i) => i.verdict === "maybe").length,
  };

  return (
    <div>
      <DeskCard className="mb-4">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-zinc-200">Roadmap lancement Mettrik AI</span>
          <HelpTip>
            Liste consolidée des items à faire avant le lancement public, partagée par l'autre conv. Code couleur : <strong className="text-emerald-300">vert</strong> = à faire sûr · <strong className="text-zinc-400">gris</strong> = à décider · <strong className="text-rose-300">rouge</strong> = items que je pense que tu ne veux pas, à supprimer après vérification.
          </HelpTip>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[12px] text-zinc-400">
          <span>{ITEMS.length} items</span>
          <span className="inline-flex items-center gap-1.5"><Pill color="green">{counts.yes}</Pill> à faire</span>
          <span className="inline-flex items-center gap-1.5"><Pill color="zinc">{counts.maybe}</Pill> à décider</span>
          <span className="inline-flex items-center gap-1.5"><Pill color="red">{counts.no}</Pill> probablement non</span>
        </div>
        <div className="mt-3 flex gap-1">
          {(["all", "yes", "maybe", "no"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md border px-2.5 py-1 text-[11px] transition-colors ${
                filter === f ? "border-violet-500/40 bg-violet-500/15 text-violet-100" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {f === "all" ? "Tout" : f === "yes" ? "À faire" : f === "no" ? "Non" : "À décider"}
            </button>
          ))}
        </div>
      </DeskCard>

      {CATEGORIES.map((cat) => {
        const items = filtered.filter((i) => i.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat} className="mb-5">
            <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-500">{cat}</div>
            <div className="space-y-2">
              {items.map((item) => <Row key={item.id} item={item} />)}
            </div>
          </div>
        );
      })}

      <DeskCard className="mt-4 border-violet-500/20 bg-violet-500/[0.04]">
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 size-4 text-violet-300" />
          <div className="text-[12px] text-violet-200">
            <strong>Notes :</strong> j'ai marqué en rouge ce qui me semble peu pertinent pour ton positionnement (scale-up agressif avant validation marché, A/B testing prématuré, help center anticipé). Tu peux les supprimer après vérification. <HelpTip>Ces items ne sont qu'une opinion de l'autre Claude. Garde ceux qui te parlent, supprime le reste.</HelpTip>
          </div>
        </div>
      </DeskCard>
    </div>
  );
}

function Row({ item }: { item: Item }) {
  const verdictColor = item.verdict === "yes" ? "green" : item.verdict === "no" ? "red" : "zinc";
  const verdictLabel = item.verdict === "yes" ? "✓ à faire" : item.verdict === "no" ? "✗ probablement non" : "? à décider";
  const borderClass = item.verdict === "yes"
    ? "border-emerald-500/20"
    : item.verdict === "no"
    ? "border-rose-500/30 bg-rose-500/[0.03]"
    : "border-white/8";

  return (
    <div className={`rounded-xl border bg-white/[0.02] p-3 ${borderClass}`}>
      <div className="flex items-baseline gap-2">
        <Pill color={verdictColor as "green" | "red" | "zinc"}>{verdictLabel}</Pill>
        <span className={`flex-1 text-[13px] font-medium ${item.verdict === "no" ? "text-rose-200/80" : "text-zinc-100"}`}>
          {item.title}
        </span>
        <span className="text-[10.5px] text-zinc-500">{item.effort}</span>
      </div>
      {item.why && (
        <p className={`mt-1.5 text-[11.5px] ${item.verdict === "no" ? "text-rose-200/60" : "text-zinc-400"}`}>{item.why}</p>
      )}
      {item.reason_no && (
        <p className="mt-1.5 text-[11.5px] italic text-rose-300/80">→ {item.reason_no}</p>
      )}
      {item.mockup_in_concepts && (
        <p className="mt-1.5 text-[11px] text-violet-300">📐 {item.mockup_in_concepts}</p>
      )}
    </div>
  );
}
