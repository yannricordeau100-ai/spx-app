import status from "@/data/extraction-status.json";

/**
 * /sandbox/extraction-monitor — Suivi de la GRANDE OPÉRATION base 5 ans
 * (Yann 11 juin 2026). Montre, par société × bloc, la couverture et le statut
 * vert / orange / rouge. Vert = données présentes (et verbatim quand src=xbrl).
 * Rouge = à faire / à reprendre. Source : src/data/extraction-status.json
 * (régénéré par scripts/datalake/build_status.py à chaque avancée).
 */
export const dynamic = "force-static";

type Cell = { f: number; r: number; s: "green" | "orange" | "red"; src?: string };
type Row = Record<string, Cell>;
const data = status as unknown as {
  generated_at: string;
  scope_n: number;
  tickers: Record<string, Row>;
};

const BLOCKS = [
  ["financier", "Financier (XBRL)"],
  ["ca_segments", "CA / segments + géo"],
  ["kpi_normaux", "KPI normaux (5 ans)"],
  ["story", "Story (2 derniers earnings)"],
  ["gouvernance", "Gouvernance & rémunération"],
] as const;

const COLOR = { green: "#22c55e", orange: "#f59e0b", red: "#ef4444" };

function agg() {
  const out: Record<string, { green: number; orange: number; red: number }> = {};
  for (const [b] of BLOCKS) out[b] = { green: 0, orange: 0, red: 0 };
  for (const row of Object.values(data.tickers)) {
    for (const [b] of BLOCKS) {
      const s = row[b]?.s;
      if (s) out[b][s] += 1;
    }
  }
  return out;
}

export default function Page() {
  const a = agg();
  const tickers = Object.keys(data.tickers).sort();
  const priority = ["META", "GOOGL"];
  const dot = (s?: string) => (
    <span style={{ display: "inline-block", width: 11, height: 11, borderRadius: 3, background: s ? COLOR[s as keyof typeof COLOR] : "#3f3f46" }} />
  );

  return (
    <main style={{ minHeight: "100vh", background: "#09090b", color: "#e4e4e7", padding: "28px 32px", fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Monitoring extraction · base 5 ans</h1>
      <p style={{ color: "#a1a1aa", fontSize: 13, marginBottom: 8 }}>
        {data.scope_n} sociétés · généré {data.generated_at} · <b style={{ color: "#22c55e" }}>vert</b> = extrait VERBATIM par la nouvelle opération (data-lake) · <b style={{ color: "#f59e0b" }}>orange</b> = partiel · <b style={{ color: "#ef4444" }}>rouge</b> = reste à faire
      </p>
      <p style={{ color: "#71717a", fontSize: 12, marginBottom: 24 }}>
        Ne reflète PAS l&apos;ancienne data du site (toujours en place) : uniquement l&apos;avancée de la base 5 ans vérifiable. Risques / IA / événements = qualitatifs, suivi séparé.
      </p>

      {/* Résumé global par bloc */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, maxWidth: 760, marginBottom: 32 }}>
        {BLOCKS.map(([b, label]) => {
          const g = a[b], tot = g.green + g.orange + g.red || 1;
          return (
            <div key={b} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 230, fontSize: 13 }}>{label}</div>
              <div style={{ flex: 1, display: "flex", height: 18, borderRadius: 5, overflow: "hidden", background: "#18181b" }}>
                <div style={{ width: `${(g.green / tot) * 100}%`, background: COLOR.green }} />
                <div style={{ width: `${(g.orange / tot) * 100}%`, background: COLOR.orange }} />
                <div style={{ width: `${(g.red / tot) * 100}%`, background: COLOR.red }} />
              </div>
              <div style={{ width: 150, fontSize: 12, fontFamily: "ui-monospace", color: "#a1a1aa" }}>
                <span style={{ color: COLOR.green }}>{g.green}</span> / <span style={{ color: COLOR.orange }}>{g.orange}</span> / <span style={{ color: COLOR.red }}>{g.red}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Priorité META / GOOGL */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Priorité (META + GOOGL)</h2>
      <table style={{ borderCollapse: "collapse", fontSize: 12, marginBottom: 32 }}>
        <thead>
          <tr><th style={{ textAlign: "left", padding: "4px 10px", color: "#a1a1aa" }}>Ticker</th>
            {BLOCKS.map(([b, l]) => <th key={b} style={{ padding: "4px 8px", color: "#a1a1aa", fontWeight: 500 }}>{l.split(" ")[0]}</th>)}</tr>
        </thead>
        <tbody>
          {priority.map((tk) => (
            <tr key={tk} style={{ borderTop: "1px solid #27272a" }}>
              <td style={{ padding: "6px 10px", fontWeight: 700 }}>{tk}</td>
              {BLOCKS.map(([b]) => {
                const c = data.tickers[tk]?.[b];
                return <td key={b} style={{ padding: "6px 8px", textAlign: "center" }}>{dot(c?.s)} <span style={{ color: "#71717a", fontFamily: "ui-monospace" }}>{c ? `${c.f}/${c.r}` : ""}</span></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Matrice complète (scrollable) */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Toutes les sociétés ({tickers.length})</h2>
      <div style={{ maxHeight: 560, overflow: "auto", border: "1px solid #27272a", borderRadius: 8 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
          <thead style={{ position: "sticky", top: 0, background: "#18181b" }}>
            <tr><th style={{ textAlign: "left", padding: "6px 10px", color: "#a1a1aa" }}>Ticker</th>
              {BLOCKS.map(([b, l]) => <th key={b} style={{ padding: "6px 6px", color: "#a1a1aa", fontWeight: 500 }}>{l.split(" ")[0].slice(0, 9)}</th>)}</tr>
          </thead>
          <tbody>
            {tickers.map((tk) => (
              <tr key={tk} style={{ borderTop: "1px solid #1f1f23" }}>
                <td style={{ padding: "4px 10px", fontFamily: "ui-monospace" }}>{tk}</td>
                {BLOCKS.map(([b]) => <td key={b} style={{ padding: "4px 6px", textAlign: "center" }}>{dot(data.tickers[tk]?.[b]?.s)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
