"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Users,
  TrendingUp,
  MapPin,
  Smartphone,
  Link as LinkIcon,
  FileText,
  Filter,
} from "lucide-react";

type Props = {
  isConfigured: boolean;
  plausibleDomain: string;
};

type SectionKey =
  | "overview"
  | "daily"
  | "pages"
  | "referrers"
  | "devices"
  | "countries"
  | "bounce";

const SECTIONS: Array<{
  key: SectionKey;
  title: string;
  description: string;
  Icon: typeof Users;
}> = [
  {
    key: "overview",
    title: "Visites cumulées",
    description: "Total des visites depuis le lancement, hors ton IP.",
    Icon: Users,
  },
  {
    key: "daily",
    title: "Visites par jour",
    description: "Courbe journalière sur les 30 derniers jours.",
    Icon: TrendingUp,
  },
  {
    key: "pages",
    title: "Top pages",
    description: "Pages les plus consultées du site.",
    Icon: FileText,
  },
  {
    key: "referrers",
    title: "Top référents",
    description: "D'où viennent les visiteurs (Google, X, LinkedIn, etc.).",
    Icon: LinkIcon,
  },
  {
    key: "devices",
    title: "Devices",
    description: "Répartition mobile, tablette, desktop.",
    Icon: Smartphone,
  },
  {
    key: "countries",
    title: "Pays",
    description: "Top pays des visiteurs.",
    Icon: MapPin,
  },
  {
    key: "bounce",
    title: "Taux de rebond",
    description: "Pourcentage de visites à une seule page.",
    Icon: Filter,
  },
];

export function VisitorsAnalyticsClient({
  isConfigured,
  plausibleDomain,
}: Props) {
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    overview: true,
    daily: false,
    pages: false,
    referrers: false,
    devices: false,
    countries: false,
    bounce: false,
  });

  const [excludeMyIp, setExcludeMyIp] = useState(true);

  function toggle(key: SectionKey) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function expandAll() {
    setExpanded({
      overview: true,
      daily: true,
      pages: true,
      referrers: true,
      devices: true,
      countries: true,
      bounce: true,
    });
  }

  function collapseAll() {
    setExpanded({
      overview: false,
      daily: false,
      pages: false,
      referrers: false,
      devices: false,
      countries: false,
      bounce: false,
    });
  }

  return (
    <div className="space-y-6">
      {!isConfigured && <ProviderSetupBanner domain={plausibleDomain} />}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={excludeMyIp}
            onChange={(e) => setExcludeMyIp(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-white/5 accent-violet-400"
          />
          <span>
            Exclure mon trafic (2 Mac + iPhone hotspot)
            <span className="ml-2 text-xs text-white/40">
              filtre cote serveur via Plausible
            </span>
          </span>
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium transition hover:bg-white/10"
          >
            Tout deplier
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium transition hover:bg-white/10"
          >
            Tout replier
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {SECTIONS.map((section) => (
          <CollapsibleSection
            key={section.key}
            title={section.title}
            description={section.description}
            Icon={section.Icon}
            isOpen={expanded[section.key]}
            onToggle={() => toggle(section.key)}
          >
            <SectionPlaceholder
              isConfigured={isConfigured}
              sectionKey={section.key}
            />
          </CollapsibleSection>
        ))}
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  description,
  Icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  Icon: typeof Users;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04]"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium">{title}</div>
          <div className="text-xs text-white/50">{description}</div>
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-white/40" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-white/8 px-4 py-4">{children}</div>
      )}
    </div>
  );
}

function SectionPlaceholder({
  isConfigured,
  sectionKey,
}: {
  isConfigured: boolean;
  sectionKey: SectionKey;
}) {
  if (!isConfigured) {
    return (
      <div className="text-sm text-white/40">
        Donnees indisponibles : provider analytics non configure (voir
        banniere en haut).
      </div>
    );
  }

  return (
    <div className="text-sm text-white/40">
      Section {sectionKey} : branchement Plausible API a livrer en V2 (cf
      bandeau de configuration).
    </div>
  );
}

function ProviderSetupBanner({ domain }: { domain: string }) {
  return (
    <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-5">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" />
        <div className="flex-1 space-y-3 text-sm">
          <div className="font-semibold text-orange-200">
            Provider analytics non configure
          </div>

          <p className="text-white/70">
            Le composant Plausible est pret cote code
            (<code className="rounded bg-white/5 px-1 py-0.5 text-[11px]">
              src/components/analytics/plausible.tsx
            </code>
            ) mais aucune variable d&apos;environnement n&apos;est definie.
            Etat actuel :
          </p>

          <ul className="ml-5 list-disc space-y-1 text-white/60">
            <li>
              <code className="rounded bg-white/5 px-1 py-0.5 text-[11px]">
                NEXT_PUBLIC_PLAUSIBLE_DOMAIN
              </code>{" "}
              ={" "}
              <code className="rounded bg-white/5 px-1 py-0.5 text-[11px]">
                {domain || "(vide)"}
              </code>
            </li>
            <li>
              <code className="rounded bg-white/5 px-1 py-0.5 text-[11px]">
                PLAUSIBLE_API_KEY
              </code>{" "}
              = (vide)
            </li>
          </ul>

          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="mb-2 font-medium text-white">
              Activer Plausible (10 min)
            </div>
            <ol className="ml-5 list-decimal space-y-1.5 text-white/70">
              <li>
                Creer un compte sur{" "}
                <a
                  href="https://plausible.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-300 underline"
                >
                  plausible.io
                </a>{" "}
                (essai 30 jours, puis 9 EUR par mois).
              </li>
              <li>
                Ajouter le site <code>mettrik.ai</code> dans le dashboard
                Plausible.
              </li>
              <li>
                Dans Settings &gt; Visibility, generer une cle API
                (scope <code>stats:read</code>).
              </li>
              <li>
                Sur Vercel (Project Settings &gt; Environment Variables),
                ajouter :
                <ul className="ml-5 mt-1 list-disc space-y-0.5">
                  <li>
                    <code className="rounded bg-white/5 px-1 py-0.5 text-[11px]">
                      NEXT_PUBLIC_PLAUSIBLE_DOMAIN
                    </code>{" "}
                    = <code>mettrik.ai</code>
                  </li>
                  <li>
                    <code className="rounded bg-white/5 px-1 py-0.5 text-[11px]">
                      PLAUSIBLE_API_KEY
                    </code>{" "}
                    = (la cle generee)
                  </li>
                </ul>
              </li>
              <li>
                Redeployer la branche staging. Le script Plausible
                commencera a tracker les visites immediatement.
              </li>
              <li>
                Dans le dashboard Plausible &gt; Settings &gt; Excluded
                IPs, ajouter tes IP (2 Mac fixe + range hotspot iPhone)
                pour ne pas te compter dans les visites.
              </li>
            </ol>
          </div>

          <p className="text-white/50">
            Une fois configure, cette page branchera les appels a
            <code className="ml-1 rounded bg-white/5 px-1 py-0.5 text-[11px]">
              api.plausible.io/api/v2/query
            </code>{" "}
            en server component (la cle API reste cote serveur).
          </p>
        </div>
      </div>
    </div>
  );
}
