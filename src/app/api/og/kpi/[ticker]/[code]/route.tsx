import { ImageResponse } from "next/og";
import { loadV17Company } from "@/lib/company-core/load-company";
import { codeKpi } from "@/lib/kpi-link";
import { formatHeroValue } from "@/lib/data";

/** Carte image d un KPI pour les apercus de liens (X, LinkedIn...). Yann 3 sept 2026. */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ ticker: string; code: string }> }) {
  const { ticker, code } = await ctx.params;
  const r = await loadV17Company(ticker, { mode: "v18", locale: "fr" });
  const kpi = r.kind === "ready" ? (r.company.kpis ?? []).find((k) => codeKpi(String(k.short)) === code) : undefined;
  if (r.kind !== "ready" || !kpi) {
    return new ImageResponse(
      <div style={{ width: "100%", height: "100%", background: "#050507", display: "flex", alignItems: "center", justifyContent: "center", color: "#fafafa", fontSize: 64, fontWeight: 700 }}>Mettrik AI</div>,
      { width: 1200, height: 630 },
    );
  }
  const c = r.company;
  const nom = kpi.name_fr || kpi.name_en || String(kpi.short);
  const v = typeof kpi.value === "number" ? formatHeroValue(kpi.value, kpi.unit ?? "") : null;
  const valeur = v ? v.value : String(kpi.value ?? "");
  const unite = v ? v.unit : (kpi.unit ?? "");
  const hist = (Array.isArray(kpi.history) ? kpi.history : []).filter((x): x is number => typeof x === "number").slice(-12);
  const max = Math.max(...hist.map(Math.abs), 1);
  const yoy = typeof kpi.yoy === "string" ? kpi.yoy : null;
  const positif = yoy ? !yoy.trim().startsWith("-") : true;
  const yoyFr = yoy ? yoy.replace(".", ",").replace(/(\d)%/, "$1 %") : "";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #07070c 0%, #0b0a14 60%, #0a1018 100%)", display: "flex", flexDirection: "column", padding: 56, color: "#fafafa", fontFamily: "Helvetica, Arial, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 22, color: "#a1a1aa", letterSpacing: 2, textTransform: "uppercase" }}>{`${c.name} · ${c.ticker}`}</div>
            <div style={{ fontSize: 40, fontWeight: 700, marginTop: 8, maxWidth: 760, lineHeight: 1.15 }}>{nom}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 26, fontWeight: 800 }}>
            <span style={{ color: "#a78bfa" }}>Mettrik</span><span style={{ color: "#67e8f9", marginLeft: 8 }}>AI</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 40, flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
              <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: -4, lineHeight: 1 }}>{valeur}</div>
              <div style={{ fontSize: 40, color: "#a1a1aa" }}>{unite}</div>
            </div>
            {yoy && (
              <div style={{ marginTop: 18, display: "flex" }}>
                <div style={{ fontSize: 28, fontWeight: 700, padding: "8px 18px", borderRadius: 999, background: positif ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)", color: positif ? "#34d399" : "#fb7185", border: `1px solid ${positif ? "#10b98166" : "#f43f5e66"}` }}>
                  {`${yoyFr} vs N-1`}
                </div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 220 }}>
            {hist.map((h, i) => (
              <div key={i} style={{ width: 34, height: Math.max(8, Math.round((Math.abs(h) / max) * 200)), borderRadius: 6, background: i === hist.length - 1 ? "linear-gradient(180deg,#a78bfa,#38bdf8)" : "rgba(124,92,240,0.45)", boxShadow: i === hist.length - 1 ? "0 0 24px rgba(167,139,250,0.7)" : "none" }} />
            ))}
          </div>
        </div>
        <div style={{ marginTop: 28, fontSize: 20, color: "#71717a", display: "flex", justifyContent: "space-between" }}>
          <span>Chiffre extrait des rapports officiels</span><span>mettrik.ai</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
