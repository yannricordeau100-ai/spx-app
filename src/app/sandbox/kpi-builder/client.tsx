"use client";

/**
 * Stub minimal — Yann 18 mai 2026 CONV-DEPAN : ce fichier était manquant
 * (référencé par page.tsx mais jamais commité par CONV-DATA). Stub pour
 * débloquer le build Vercel. À remplacer par la vraie implémentation.
 */

export type KpiRequestRow = {
  id: string;
  ticker: string;
  kpi_name: string;
  status: string;
  created_at: string;
};

export function KpiBuilderClient({
  initialRows,
  initialRequests,
}: {
  initialRows?: KpiRequestRow[];
  initialRequests?: KpiRequestRow[];
}) {
  return (
    <div className="min-h-screen bg-[#050507] p-6 text-zinc-100">
      <h1 className="mb-4 text-[24px] font-bold">KPI Builder · stub</h1>
      <p className="text-[13px] text-zinc-400">
        Ce composant est un stub temporaire (CONV-DEPAN 18 mai 2026 pour
        débloquer build). Le vrai client.tsx doit être créé par CONV-DATA.
      </p>
      <p className="mt-2 text-[12px] text-zinc-500">
        {(initialRows ?? initialRequests ?? []).length} ligne(s) initiale(s) reçue(s).
      </p>
    </div>
  );
}
