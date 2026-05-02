"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderOpen, RefreshCw, FileText } from "lucide-react";
import { DeskCard, Empty, GhostButton, HelpTip, Pill } from "./ui";

type PdfDoc = {
  ticker: string;
  filename: string;
  size_kb: number;
  modified_at: string;
  type: "10-K" | "10-Q" | "8-K" | "DEF14A" | "ER" | "other";
  year: number | null;
};

const TYPE_COLOR = { "10-K": "violet", "10-Q": "cyan", "8-K": "amber", "DEF14A": "green", "ER": "red", "other": "zinc" } as const;

export function TabDocuments() {
  const [docs, setDocs] = useState<PdfDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [root, setRoot] = useState<string>("");

  async function load() {
    setLoading(true);
    setErr(null);
    const r = await fetch("/api/desk/scan-pdfs");
    const data = await r.json();
    if (data.error) setErr(data.error);
    setDocs(data.docs ?? []);
    setRoot(data.root ?? "");
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const byTicker = useMemo(() => {
    const m: Record<string, PdfDoc[]> = {};
    for (const d of docs) {
      m[d.ticker] = m[d.ticker] ?? [];
      m[d.ticker].push(d);
    }
    return m;
  }, [docs]);

  const totalSize = docs.reduce((a, b) => a + b.size_kb, 0);

  return (
    <div>
      <DeskCard className="mb-4">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-zinc-200">Documents 10-K / 10-Q / 8-K / etc.</span>
          <HelpTip>
            Scan automatique du dossier <code className="text-zinc-300">{root || "10-K Desktop"}</code> sur ton Mac. Les PDFs sont classés par ticker (sous-dossier) et par type. <strong>Marche uniquement en dev local</strong> (Vercel n'a pas accès à ton Desktop). C'est un outil interne.
          </HelpTip>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-zinc-400">
          <span><strong className="font-mono text-zinc-100">{docs.length}</strong> PDFs</span>
          <span><strong className="font-mono text-zinc-100">{Object.keys(byTicker).length}</strong> sociétés</span>
          <span><strong className="font-mono text-zinc-100">{(totalSize / 1024).toFixed(1)}</strong> Mo total</span>
          <GhostButton onClick={load} className="ml-auto">
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Rescanner
          </GhostButton>
        </div>
        {err && (
          <div className="mt-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-2 text-[11.5px] text-rose-300">
            ⚠️ {err}
          </div>
        )}
      </DeskCard>

      {loading && <div className="text-[12px] text-zinc-500">Scan en cours…</div>}

      {!loading && docs.length === 0 && (
        <Empty
          icon={FolderOpen}
          title="Aucun PDF trouvé"
          description={`Le dossier ${root} est vide ou inexistant. Vérifie le chemin dans /api/desk/scan-pdfs/route.ts si tes PDFs sont ailleurs.`}
        />
      )}

      <div className="space-y-4">
        {Object.entries(byTicker).map(([ticker, files]) => (
          <DeskCard key={ticker}>
            <div className="mb-3 flex items-baseline gap-2">
              <span className="font-mono text-[14px] font-bold uppercase tracking-wider text-violet-300">{ticker}</span>
              <span className="text-[11px] text-zinc-500">{files.length} fichier{files.length > 1 ? "s" : ""}</span>
            </div>
            <div className="space-y-1.5">
              {files.map((f) => (
                <div key={f.filename} className="flex items-center gap-3 rounded-md border border-white/8 bg-white/[0.02] px-3 py-1.5 text-[12px]">
                  <FileText className="size-3.5 text-zinc-500" />
                  <Pill color={TYPE_COLOR[f.type]}>{f.type}</Pill>
                  {f.year && <Pill color="zinc">{f.year}</Pill>}
                  <span className="flex-1 truncate text-zinc-300">{f.filename}</span>
                  <span className="font-mono text-[10.5px] text-zinc-500">{f.size_kb} ko</span>
                  <span className="font-mono text-[10.5px] text-zinc-600">{new Date(f.modified_at).toLocaleDateString("fr-FR")}</span>
                </div>
              ))}
            </div>
          </DeskCard>
        ))}
      </div>
    </div>
  );
}
